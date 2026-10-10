import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Pool } from 'pg';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';
import { OidcVerifier } from '../src/auth/oidc.js';
import { HostedAuth } from '../src/auth/sessions.js';
import { ProjectRepository } from '../src/repository.js';
import { createApi } from '../src/api.js';

const baseUrl = process.env.FIRELAUNCH_TEST_DATABASE_URL;
const databaseTest = baseUrl ? test : test.skip;

databaseTest('Postgres ownership, CAS, uniqueness, restart and migration rollback', async () => {
  const admin = new Pool({ connectionString: baseUrl });
  const dbName = `firelaunch_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(baseUrl!);
  url.pathname = `/${dbName}`;
  await admin.query(`CREATE DATABASE ${dbName}`);
  let first: HostedProjectRepository | undefined;
  let second: HostedProjectRepository | undefined;
  try {
    first = await HostedProjectRepository.connect(url.toString());
    second = await HostedProjectRepository.connect(url.toString());
    const aId = await first.accountForIdentity({ issuer: 'https://issuer.example', subject: 'a', email: 'a@example.com' });
    const bId = await first.accountForIdentity({ issuer: 'https://issuer.example', subject: 'b', email: 'b@example.com' });
    const concurrentAccounts = await Promise.all([
      first.accountForIdentity({ issuer: 'https://issuer.example', subject: 'new', email: 'new@example.com' }),
      second.accountForIdentity({ issuer: 'https://issuer.example', subject: 'new', email: 'new@example.com' })
    ]);
    assert.equal(concurrentAccounts[0], concurrentAccounts[1]);
    assert.notEqual(aId, bId);
    assert.equal(await second.accountForIdentity({ issuer: 'https://issuer.example', subject: 'a', email: 'new@example.com' }), aId);
    const a: AuthenticatedPrincipal = { accountId: aId, issuer: 'https://issuer.example', subject: 'a', email: 'a@example.com' };
    const b: AuthenticatedPrincipal = { accountId: bId, issuer: 'https://issuer.example', subject: 'b', email: 'b@example.com' };
    const forged = { ...b, accountId: aId };
    const created = await first.create(a, { title: 'First channel' });
    assert.match(created.id, /^ch_[a-f0-9]{32}$/);
    assert.equal(created.spec.schemaVersion, 1);
    assert.equal((await second.list(a)).length, 1);
    assert.deepEqual(await second.read(a, created.id), created);
    assert.deepEqual(await second.list(b), []);
    await assert.rejects(second.read(b, created.id), { code: 'NOT_FOUND' });
    await assert.rejects(second.read(forged, created.id), { code: 'NOT_FOUND' });
    await assert.rejects(second.update(b, created.id, 1, created.spec), { code: 'NOT_FOUND' });
    await assert.rejects(second.update(forged, created.id, 1, created.spec), { code: 'NOT_FOUND' });
    const badDeploymentId = `dep_${randomUUID().replaceAll('-', '')}`;
    await assert.rejects(second.pool.query('INSERT INTO channel_deployments(id, creator_account_id, project_id, channel_id, package_id, deployment) VALUES ($1, $2, $3, $3, $4, $5::jsonb)',
      [badDeploymentId, bId, created.id, 'com.example.wrongowner', JSON.stringify({ id: badDeploymentId, packageId: 'com.example.wrongowner' })]), { code: '23503' });
    const settled = await Promise.allSettled([
      first.update(a, created.id, 1, { ...created.spec, title: 'Winner one' }),
      second.update(a, created.id, 1, { ...created.spec, title: 'Winner two' })
    ]);
    assert.equal(settled.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(settled.filter(result => result.status === 'rejected' && result.reason?.code === 'CONFLICT').length, 1);
    assert.equal((await first.read(a, created.id)).revision, 2);
    await assert.rejects(first.update(a, created.id, 2, { ...created.spec, id: `ch_${'a'.repeat(32)}` }));
    await assert.rejects(first.create(a, { title: 'Bad', creatorAccountId: bId }));

    const other = await second.create(b, { title: 'Other channel' });
    const packageId = 'com.example.uniqueapp';
    const deployment = (principal: AuthenticatedPrincipal, projectId: string) => ({
      schemaVersion: 1, id: `dep_${randomUUID().replaceAll('-', '')}`,
      creatorAccountId: principal.accountId, projectId, channelId: projectId,
      appName: 'Test app', packageId, releaseControl: 'creator', nativeReleaseApproval: 'pending_creator',
      consoleEvidence: { state: 'none' }
    });
    await first.createDeployment(a, deployment(a, created.id));
    assert.equal((await second.readDeployment(a, created.id)).packageId, packageId);
    await assert.rejects(second.readDeployment(b, created.id), { code: 'NOT_FOUND' });
    await assert.rejects(second.createDeployment(b, deployment(b, other.id)), { code: 'CONFLICT' });
    await assert.rejects(second.createDeployment(b, deployment(b, created.id)), { code: 'NOT_FOUND' });
    assert.equal((await second.pool.query('SELECT count(*)::int AS count FROM channel_deployments')).rows[0].count, 1);
    assert.equal((await second.pool.query('SELECT count(*)::int AS count FROM channel_ownerships')).rows[0].count, 2);

    await first.pool.end(); first = undefined;
    const restarted = await HostedProjectRepository.connect(url.toString());
    first = restarted;
    assert.equal(await restarted.accountForIdentity({ issuer: a.issuer, subject: a.subject, email: a.email }), aId);
    assert.equal((await restarted.read(a, created.id)).revision, 2);
    await restarted.pool.query('INSERT INTO firelaunch_schema_migrations(version) VALUES (999)');
    await assert.rejects(restarted.migrate(), /Unsupported hosted database migration/);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 999');
    assert.equal((await restarted.pool.query('SELECT count(*)::int AS count FROM channel_projects')).rows[0].count, 2);

    const directory = await mkdtemp(path.join(tmpdir(), 'firelaunch-hosted-api-'));
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...await exportJWK(publicKey), kid: 'hosted-test', alg: 'RS256', use: 'sig' };
    let signedToken = '';
    const issuerServer = createServer((_request, response) => {
      if (_request.url === '/keys') response.end(JSON.stringify({ keys: [jwk] }));
      else if (_request.url === '/token') response.end(JSON.stringify({ id_token: signedToken }));
      else response.writeHead(404).end();
    });
    issuerServer.listen(0, '127.0.0.1'); await once(issuerServer, 'listening');
    const issuerAddress = issuerServer.address(); assert.ok(issuerAddress && typeof issuerAddress !== 'string');
    const issuer = `http://127.0.0.1:${issuerAddress.port}`;
    const placeholder = createServer();
    placeholder.listen(0, '127.0.0.1'); await once(placeholder, 'listening');
    const address = placeholder.address(); assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    await new Promise<void>(resolve => placeholder.close(() => resolve()));
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const verifier = new OidcVerifier({ issuer, clientId: 'test-client', authorizationEndpoint: `${issuer}/authorize`,
      tokenEndpoint: `${issuer}/token`, jwksUri: `${issuer}/keys`, redirectUri: `${origin}/api/auth/callback` });
    const auth = new HostedAuth(verifier, origin, principal => restarted.accountForIdentity(principal));
    const api = createApi(new ProjectRepository(directory), undefined, { mode: 'hosted', auth }, restarted);
    api.listen(address.port, '127.0.0.1'); await once(api, 'listening');
    try {
      const login = async (subject: string) => {
        const start = await fetch(`${origin}/api/auth/login`, { redirect: 'manual' });
        const authUrl = new URL(start.headers.get('location')!);
        const now = Math.floor(Date.now() / 1000);
        signedToken = await new SignJWT({ iss: issuer, aud: 'test-client', sub: subject, email: `${subject}@example.com`,
          email_verified: true, nonce: authUrl.searchParams.get('nonce'), iat: now, exp: now + 3600 })
          .setProtectedHeader({ alg: 'RS256', kid: 'hosted-test' }).sign(privateKey);
        const finish = await fetch(`${origin}/api/auth/callback?state=${authUrl.searchParams.get('state')}&code=code`, {
          headers: { cookie: start.headers.get('set-cookie')!.split(';')[0]! }, redirect: 'manual' });
        assert.equal(finish.status, 302);
        const cookie = finish.headers.get('set-cookie')!.match(/firelaunch_test_session=[^;]+/)![0];
        const session = await (await fetch(`${origin}/api/auth/session`, { headers: { cookie } })).json();
        return { cookie, session };
      };
      const firstLogin = await login('http-a');
      const secondLogin = await login('http-b');
      const endpoint = `${origin}/api/projects`;
      const post = (login: typeof firstLogin, value: unknown) => fetch(endpoint, { method: 'POST',
        headers: { cookie: login.cookie, origin, 'x-csrf-token': login.session.csrfToken, 'content-type': 'application/json' },
        body: JSON.stringify(value) });
      assert.equal((await post(firstLogin, { title: 'Owned by HTTP A', creatorAccountId: secondLogin.session.accountId })).status, 400);
      const createdResponse = await post(firstLogin, { title: 'Owned by HTTP A' });
      assert.equal(createdResponse.status, 201);
      const owned = await createdResponse.json();
      assert.equal((await fetch(endpoint, { headers: { cookie: secondLogin.cookie } })).status, 200);
      assert.deepEqual(await (await fetch(endpoint, { headers: { cookie: secondLogin.cookie } })).json(), []);
      assert.equal((await fetch(`${endpoint}/${owned.id}`, { headers: { cookie: secondLogin.cookie } })).status, 404);
      const hostilePut = await fetch(`${endpoint}/${owned.id}`, { method: 'PUT',
        headers: { cookie: secondLogin.cookie, origin, 'x-csrf-token': secondLogin.session.csrfToken, 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: 1, spec: owned.spec }) });
      assert.equal(hostilePut.status, 404);
      assert.equal((await fetch(`${endpoint}/${owned.id}`, { headers: { cookie: firstLogin.cookie } })).status, 200);
    } finally {
      await new Promise<void>(resolve => api.close(() => resolve()));
      await new Promise<void>(resolve => issuerServer.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
      process.env.NODE_ENV = previousNodeEnv;
    }

    // The down script is exercised only in this disposable database after all persistence assertions.
    const down = await readFile(new URL('../migrations/001_hosted_ownership.down.sql', import.meta.url), 'utf8');
    await restarted.pool.query('BEGIN');
    await restarted.pool.query(down);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 1');
    await restarted.pool.query('COMMIT');
    await restarted.migrate();
    assert.equal((await restarted.pool.query('SELECT count(*)::int AS count FROM creator_accounts')).rows[0].count, 0);
  } finally {
    if (first) await first.pool.end();
    if (second) await second.pool.end();
    await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);
    await admin.end();
  }
});
