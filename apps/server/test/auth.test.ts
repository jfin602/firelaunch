import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createApi } from '../src/api.js';
import { ProjectRepository } from '../src/repository.js';
import { HostedAuth } from '../src/auth/sessions.js';
import { OidcVerifier } from '../src/auth/oidc.js';
import { serverModeFromEnv } from '../src/auth/config.js';

const oldEnvironment = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';

test('hosted OIDC validates code flow, tokens, session rotation, CSRF and logout', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'firelaunch-auth-'));
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'fixture-key', alg: 'RS256', use: 'sig' };
  let issuer = '';
  let token = '';
  let tokenPosts = 0;
  let expectedChallenge = '';
  const oidcServer = createServer(async (request, response) => {
    if (request.url === '/keys') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ keys: [jwk] })); return; }
    if (request.url === '/token') {
      tokenPosts++;
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk);
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      assert.equal(form.get('grant_type'), 'authorization_code');
      assert.equal(form.get('code'), 'one-time-code');
      assert.equal(createHash('sha256').update(form.get('code_verifier')!).digest('base64url'), expectedChallenge);
      response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ id_token: token })); return;
    }
    response.writeHead(404).end();
  });
  oidcServer.listen(0, '127.0.0.1'); await once(oidcServer, 'listening');
  const issuerAddress = oidcServer.address(); assert.ok(issuerAddress && typeof issuerAddress !== 'string');
  issuer = `http://127.0.0.1:${issuerAddress.port}`;
  const placeholder = new ProjectRepository(directory);
  const api = createApi(placeholder);
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const address = api.address(); assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${origin}/api/projects`)).status, 401);
  const verifier = new OidcVerifier({ issuer, clientId: 'firelaunch-fixture', authorizationEndpoint: `${issuer}/authorize`, tokenEndpoint: `${issuer}/token`, jwksUri: `${issuer}/keys`, redirectUri: `${origin}/api/auth/callback` });
  const auth = new HostedAuth(verifier, origin);
  // Recreate the API on the same port with the hosted configuration.
  await new Promise<void>(resolve => api.close(() => resolve()));
  const hosted = createApi(placeholder, undefined, { mode: 'hosted', auth });
  hosted.listen(address.port, '127.0.0.1'); await once(hosted, 'listening');
  const sign = async (nonce: string, changes: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: issuer, aud: 'firelaunch-fixture', sub: 'creator-1', email: 'creator@example.com', email_verified: true, nonce, iat: now, exp: now + 3600, ...changes };
    return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' }).sign(privateKey);
  };
  const begin = async () => {
    const response = await fetch(`${origin}/api/auth/login`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const url = new URL(response.headers.get('location')!);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('response_type'), 'code');
    expectedChallenge = url.searchParams.get('code_challenge')!;
    return { state: url.searchParams.get('state')!, nonce: url.searchParams.get('nonce')!, stateCookie: response.headers.get('set-cookie')!.split(';')[0]! };
  };
  const finish = async (login: Awaited<ReturnType<typeof begin>>, cookie = login.stateCookie) => fetch(`${origin}/api/auth/callback?state=${login.state}&code=one-time-code`, { headers: { cookie }, redirect: 'manual' });
  try {
    assert.equal((await fetch(`${origin}/api/projects`)).status, 401);
    assert.equal((await fetch(`${origin}/api/projects`, { headers: { 'x-user-id': 'cr_fake' } })).status, 401);
    const first = await begin();
    token = await sign(first.nonce);
    assert.equal((await finish(first, 'wrong=cookie')).status, 400);
    assert.equal(tokenPosts, 0);
    const invalidCases = [
      ['tampered', `${token.slice(0, -2)}xx`],
      ['audience', await sign(first.nonce, { aud: 'other-app' })],
      ['issuer', await sign(first.nonce, { iss: 'http://wrong.example' })],
      ['expired', await sign(first.nonce, { exp: Math.floor(Date.now() / 1000) - 1 })],
      ['nonce', await sign('wrong-nonce')],
      ['email', await sign(first.nonce, { email_verified: false })]
    ] as const;
    for (const [label, badToken] of invalidCases) {
      const attempt = await begin();
      token = label === 'nonce' ? await sign('wrong-nonce') : label === 'email' ? await sign(attempt.nonce, { email_verified: false }) : label === 'audience' ? await sign(attempt.nonce, { aud: 'other-app' }) : label === 'issuer' ? await sign(attempt.nonce, { iss: 'http://wrong.example' }) : label === 'expired' ? await sign(attempt.nonce, { exp: Math.floor(Date.now() / 1000) - 1 }) : badToken;
      assert.equal((await finish(attempt)).status, 401, label);
      assert.equal((await finish(attempt)).status, 400, `${label} replay`);
    }
    const valid = await begin(); token = await sign(valid.nonce);
    const completed = await finish(valid);
    assert.equal(completed.status, 302);
    const sessionCookie = completed.headers.get('set-cookie')!.match(/firelaunch_test_session=[^;]+/)![0];
    assert.match(completed.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(completed.headers.get('set-cookie')!, /SameSite=Lax/);
    assert.equal((await finish(valid)).status, 400);
    const sessionResponse = await fetch(`${origin}/api/auth/session`, { headers: { cookie: sessionCookie } });
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json();
    assert.match(session.accountId, /^cr_[a-f0-9]{32}$/);
    assert.equal(session.email, 'creator@example.com');
    const write = (headers: Record<string, string>) => fetch(`${origin}/api/projects`, { method: 'POST', headers: { cookie: sessionCookie, 'content-type': 'application/json', ...headers }, body: '{}' });
    assert.equal((await write({})).status, 403);
    assert.equal((await write({ origin: 'https://other.example', 'x-csrf-token': session.csrfToken })).status, 403);
    assert.equal((await write({ origin, 'x-csrf-token': 'bad' })).status, 403);
    assert.equal((await write({ origin, 'x-csrf-token': session.csrfToken })).status, 503);
    assert.equal((await fetch(`${origin}/api/projects`, { headers: { cookie: sessionCookie } })).status, 503);
    assert.equal((await fetch(`${origin}/api/auth/session`, { headers: { cookie: sessionCookie, 'x-forwarded-host': 'evil.example' } })).status, 401);
    assert.equal((await fetch(`${origin}/api/auth/session`, { headers: { cookie: sessionCookie, 'x-forwarded-proto': 'https' } })).status, 401);
    const rotation = await begin(); token = await sign(rotation.nonce);
    const rotated = await finish(rotation, `${rotation.stateCookie}; ${sessionCookie}`);
    assert.equal(rotated.status, 302);
    assert.equal((await fetch(`${origin}/api/auth/session`, { headers: { cookie: sessionCookie } })).status, 401);
    const nextCookie = rotated.headers.get('set-cookie')!.match(/firelaunch_test_session=[^;]+/)![0];
    assert.notEqual(nextCookie, sessionCookie);
    const nextSession = await (await fetch(`${origin}/api/auth/session`, { headers: { cookie: nextCookie } })).json();
    assert.equal((await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { cookie: nextCookie, origin, 'x-csrf-token': nextSession.csrfToken } })).status, 204);
    assert.equal((await fetch(`${origin}/api/auth/session`, { headers: { cookie: nextCookie } })).status, 401);
    const expiring = await begin(); token = await sign(expiring.nonce);
    const expiringResponse = await finish(expiring);
    const expiringCookie = expiringResponse.headers.get('set-cookie')!.match(/firelaunch_test_session=[^;]+/)![0];
    const present = Date.now;
    Date.now = () => present() + 9 * 60 * 60_000;
    try { assert.equal((await fetch(`${origin}/api/auth/session`, { headers: { cookie: expiringCookie } })).status, 401); }
    finally { Date.now = present; }
  } finally {
    await new Promise<void>(resolve => hosted.close(() => resolve()));
    await new Promise<void>(resolve => oidcServer.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('production configuration rejects fixture origins and missing Google secrets', () => {
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => serverModeFromEnv({ FIRELAUNCH_MODE: 'hosted', FIRELAUNCH_PUBLIC_ORIGIN: 'http://127.0.0.1:4000', FIRELAUNCH_OIDC_CLIENT_ID: 'fixture', FIRELAUNCH_OIDC_CLIENT_SECRET: 'secret' }));
    assert.throws(() => serverModeFromEnv({ FIRELAUNCH_MODE: 'hosted', FIRELAUNCH_PUBLIC_ORIGIN: 'https://studio.example', FIRELAUNCH_OIDC_CLIENT_ID: 'fixture' }));
    assert.throws(() => serverModeFromEnv({ FIRELAUNCH_MODE: 'hosted', FIRELAUNCH_PUBLIC_ORIGIN: 'https://studio.example', FIRELAUNCH_OIDC_CLIENT_ID: 'fixture', FIRELAUNCH_OIDC_CLIENT_SECRET: 'secret', FIRELAUNCH_OIDC_ISSUER: 'http://127.0.0.1:4000' }));
    assert.throws(() => serverModeFromEnv({}));
    assert.throws(() => serverModeFromEnv({ FIRELAUNCH_MODE: 'local-legacy', HOST: '0.0.0.0' }));
    assert.throws(() => serverModeFromEnv({ FIRELAUNCH_MODE: 'local-legacy', NODE_ENV: 'production' }));
  } finally { process.env.NODE_ENV = oldEnvironment; }
});

test('HTTPS hosted login sets secure host-only cookies behind a matching proxy', async () => {
  process.env.NODE_ENV = 'test';
  const verifier = new OidcVerifier({
    issuer: 'http://127.0.0.1:9999', clientId: 'fixture',
    authorizationEndpoint: 'http://127.0.0.1:9999/authorize', tokenEndpoint: 'http://127.0.0.1:9999/token',
    jwksUri: 'http://127.0.0.1:9999/keys', redirectUri: 'https://studio.example/api/auth/callback'
  });
  const auth = new HostedAuth(verifier, 'https://studio.example');
  const server = createServer((request, response) => auth.begin(request, response));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try {
    const send = (host: string) => new Promise<{ status: number; cookie: string }>((resolve, reject) => {
      const request = httpRequest({ hostname: '127.0.0.1', port: address.port, path: '/', headers: { host, 'x-forwarded-host': host, 'x-forwarded-proto': 'https' } }, response => {
        response.resume(); response.on('end', () => resolve({ status: response.statusCode!, cookie: response.headers['set-cookie']?.[0] ?? '' }));
      });
      request.on('error', reject); request.end();
    });
    const result = await send('studio.example');
    assert.equal(result.status, 302);
    assert.match(result.cookie, /^__Host-firelaunch_state=/);
    assert.match(result.cookie, /; Secure/);
    assert.doesNotMatch(result.cookie, /Domain=/);
    assert.equal((await send('evil.example')).status, 400);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); process.env.NODE_ENV = oldEnvironment; }
});
