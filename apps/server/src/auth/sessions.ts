import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { OidcVerifier, randomToken, type AuthenticatedPrincipal } from './oidc.js';

const SESSION_MS = 8 * 60 * 60_000;
const LOGIN_MS = 5 * 60_000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const same = (left: string, right: string) => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

function cookies(request: IncomingMessage): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const divider = part.indexOf('=');
    if (divider > 0) result[part.slice(0, divider).trim()] = part.slice(divider + 1).trim();
  }
  return result;
}

type Login = { nonce: string; verifier: string; expiresAt: number };
type Session = { principal: AuthenticatedPrincipal; csrf: string; expiresAt: number };

// Sessions remain process-local and revocable; creator account mapping is persisted by P2.
export class HostedAuth {
  private readonly logins = new Map<string, Login>();
  private readonly sessions = new Map<string, Session>();
  readonly publicOrigin: string;
  private readonly secure: boolean;
  private readonly sessionCookie: string;
  private readonly stateCookie: string;

  constructor(readonly verifier: OidcVerifier, publicOrigin: string,
    private readonly resolveAccount: (principal: AuthenticatedPrincipal) => Promise<string>) {
    const origin = new URL(publicOrigin);
    if (origin.origin !== publicOrigin || (origin.protocol !== 'https:' && !(process.env.NODE_ENV === 'test' && origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) throw new Error('Hosted public origin must be HTTPS');
    if (new URL(verifier.config.redirectUri).origin !== publicOrigin) throw new Error('OIDC callback origin mismatch');
    this.publicOrigin = publicOrigin;
    this.secure = origin.protocol === 'https:';
    this.sessionCookie = this.secure ? '__Host-firelaunch_session' : 'firelaunch_test_session';
    this.stateCookie = this.secure ? '__Host-firelaunch_state' : 'firelaunch_test_state';
  }

  private cookie(name: string, value: string, age: number): string {
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${this.secure ? '; Secure' : ''}`;
  }

  private clear(name: string): string { return this.cookie(name, '', 0); }

  private safeHost(request: IncomingMessage): boolean {
    const host = new URL(this.publicOrigin).host;
    const forwardedHost = request.headers['x-forwarded-host'];
    const forwardedProto = request.headers['x-forwarded-proto'];
    return request.headers.host === host && !request.headers.forwarded
      && (forwardedHost === undefined || forwardedHost === host)
      && (forwardedProto === undefined || forwardedProto === (this.secure ? 'https' : 'http'));
  }

  private sameOrigin(request: IncomingMessage): boolean { return request.headers.origin === this.publicOrigin; }

  session(request: IncomingMessage): Session | null {
    if (!this.safeHost(request)) return null;
    const token = cookies(request)[this.sessionCookie];
    if (!token) return null;
    const key = hash(token);
    const session = this.sessions.get(key);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) { this.sessions.delete(key); return null; }
    return session;
  }

  authorizedMutation(request: IncomingMessage, session: Session): boolean {
    const csrf = request.headers['x-csrf-token'];
    return this.sameOrigin(request) && typeof csrf === 'string' && same(csrf, session.csrf);
  }

  begin(request: IncomingMessage, response: ServerResponse): void {
    if (!this.safeHost(request)) { response.writeHead(400).end(); return; }
    for (const [key, login] of this.logins) if (login.expiresAt <= Date.now()) this.logins.delete(key);
    if (this.logins.size >= 10_000) { response.writeHead(503).end(); return; }
    const state = randomToken(); const nonce = randomToken(); const verifier = randomToken();
    this.logins.set(hash(state), { nonce, verifier, expiresAt: Date.now() + LOGIN_MS });
    response.writeHead(302, { location: this.verifier.authorizationUrl(state, nonce, verifier), 'set-cookie': this.cookie(this.stateCookie, state, 300), 'cache-control': 'no-store' }).end();
  }

  async callback(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    if (!this.safeHost(request) || url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length !== 1 || url.searchParams.has('error')) { response.writeHead(400).end(); return; }
    const state = url.searchParams.get('state'); const code = url.searchParams.get('code');
    const cookieState = cookies(request)[this.stateCookie];
    const login = state ? this.logins.get(hash(state)) : undefined;
    if (state) this.logins.delete(hash(state));
    if (!state || !code || !cookieState || !same(state, cookieState) || !login || login.expiresAt <= Date.now()) {
      response.writeHead(400, { 'set-cookie': this.clear(this.stateCookie), 'cache-control': 'no-store' }).end(); return;
    }
    try {
      const identity = await this.verifier.exchange(code, login.verifier, login.nonce);
      const accountId = await this.resolveAccount(identity.principal);
      const previous = cookies(request)[this.sessionCookie];
      if (previous) this.sessions.delete(hash(previous));
      for (const [key, session] of this.sessions) if (session.expiresAt <= Date.now()) this.sessions.delete(key);
      if (this.sessions.size >= 10_000) { response.writeHead(503, { 'set-cookie': this.clear(this.stateCookie) }).end(); return; }
      const token = randomToken();
      this.sessions.set(hash(token), { principal: { ...identity.principal, accountId }, csrf: randomToken(), expiresAt: Math.min(Date.now() + SESSION_MS, identity.expiresAt) });
      response.writeHead(302, { location: this.publicOrigin + '/', 'set-cookie': [this.clear(this.stateCookie), this.cookie(this.sessionCookie, token, Math.floor(SESSION_MS / 1000))], 'cache-control': 'no-store' }).end();
    } catch {
      response.writeHead(401, { 'set-cookie': this.clear(this.stateCookie), 'cache-control': 'no-store' }).end();
    }
  }

  logout(request: IncomingMessage, response: ServerResponse): void {
    const session = this.session(request);
    if (!session) { response.writeHead(401).end(); return; }
    if (!this.authorizedMutation(request, session)) { response.writeHead(403).end(); return; }
    const token = cookies(request)[this.sessionCookie];
    if (token) this.sessions.delete(hash(token));
    response.writeHead(204, { 'set-cookie': this.clear(this.sessionCookie), 'cache-control': 'no-store' }).end();
  }
}
