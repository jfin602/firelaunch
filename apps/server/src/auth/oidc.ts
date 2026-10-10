import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';

export type AuthenticatedPrincipal = Readonly<{
  accountId: string;
  issuer: string;
  subject: string;
  email: string;
}>;

export type OidcConfiguration = Readonly<{
  issuer: string;
  clientId: string;
  clientSecret?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  redirectUri: string;
}>;

const digest = (value: string) => createHash('sha256').update(value).digest('base64url');
export const randomToken = () => randomBytes(32).toString('base64url');

export class OidcVerifier {
  private readonly jwks;
  constructor(readonly config: OidcConfiguration, private readonly request: typeof fetch = fetch) {
    for (const endpoint of [config.issuer, config.authorizationEndpoint, config.tokenEndpoint, config.jwksUri, config.redirectUri]) {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'test' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
        throw new Error('OIDC endpoints must use HTTPS');
      }
      if (url.username || url.password || url.hash) throw new Error('Unsafe OIDC endpoint');
    }
    if (!config.clientId || config.issuer.endsWith('/') || new URL(config.redirectUri).pathname !== '/api/auth/callback') throw new Error('Invalid OIDC configuration');
    this.jwks = createRemoteJWKSet(new URL(config.jwksUri), { [customFetch]: (input, init) => request(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) }) });
  }

  authorizationUrl(state: string, nonce: string, verifier: string): string {
    const url = new URL(this.config.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', 'openid email');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', digest(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async exchange(code: string, verifier: string, nonce: string): Promise<{ principal: AuthenticatedPrincipal; expiresAt: number }> {
    const params = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.config.redirectUri, client_id: this.config.clientId, code_verifier: verifier });
    if (this.config.clientSecret) params.set('client_secret', this.config.clientSecret);
    const response = await this.request(this.config.tokenEndpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: params, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('OIDC token exchange failed');
    const tokens: unknown = await response.json();
    if (!tokens || typeof tokens !== 'object' || !('id_token' in tokens) || typeof tokens.id_token !== 'string') throw new Error('OIDC ID token missing');
    const { payload } = await jwtVerify(tokens.id_token, this.jwks, { issuer: this.config.issuer, audience: this.config.clientId, algorithms: ['RS256'], requiredClaims: ['sub', 'iat', 'exp', 'nonce'] });
    if (payload.nonce !== nonce || typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || payload.email_verified !== true) throw new Error('OIDC identity claims invalid');
    if ((Array.isArray(payload.aud) && payload.aud.length > 1 || payload.azp !== undefined) && payload.azp !== this.config.clientId) throw new Error('OIDC authorized party invalid');
    if (typeof payload.iat !== 'number' || payload.iat > Math.floor(Date.now() / 1000) + 60 || typeof payload.exp !== 'number') throw new Error('OIDC token time invalid');
    return { principal: { accountId: `cr_${createHash('sha256').update(`${payload.iss}\0${payload.sub}`).digest('hex').slice(0, 32)}`, issuer: this.config.issuer, subject: payload.sub, email: payload.email }, expiresAt: payload.exp * 1000 };
  }
}
