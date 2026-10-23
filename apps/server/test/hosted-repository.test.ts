import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
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
import { MockProvider, type AgentProvider } from '@vegalaunch/agent';
import { IsolatedObjectStore, PrivateObjectService } from '../src/private-objects.js';

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
    assert.deepEqual(await second.create(a, { id: created.id, title: 'First channel' }), created);
    await assert.rejects(second.create(b, { id: created.id, title: 'First channel' }), { code: 'CONFLICT' });
    await assert.rejects(second.create(a, { id: created.id, title: 'Changed title' }), { code: 'CONFLICT' });
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
    const mock = new MockProvider();
    let providerCalls = 0;
    const provider: AgentProvider = { name: 'mock', next: async turns => { providerCalls++; return mock.next(turns); } };
    let api = createApi(new ProjectRepository(directory), provider, { mode: 'hosted', auth }, restarted,
      new PrivateObjectService(restarted, new IsolatedObjectStore(directory)));
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
        const cookie = finish.headers.get('set-cookie')!.match(/firelaunch_local_session=[^;]+/)![0];
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
      const catalogPath = `${endpoint}/${owned.id}/catalog`;
      const catalogOwnerHeaders = { cookie: firstLogin.cookie, origin, 'x-csrf-token': firstLogin.session.csrfToken, 'content-type': 'application/json' };
      const catalogForeignHeaders = { cookie: secondLogin.cookie, origin, 'x-csrf-token': secondLogin.session.csrfToken, 'content-type': 'application/json' };
      const sourceBody = { schemaVersion: 1, type: 'creator_json', state: 'discovered',
        permission: { retrieval: 'unknown', tvDisplay: 'unknown' } };
      assert.equal((await fetch(catalogPath, { headers: { cookie: secondLogin.cookie } })).status, 404);
      assert.equal((await fetch(`${catalogPath}/sources`, { method: 'POST', headers: catalogOwnerHeaders,
        body: JSON.stringify({ expectedRevision: 0, record: sourceBody }) })).status, 201);
      const sourceList = await (await fetch(`${catalogPath}/sources`, { headers: { cookie: firstLogin.cookie } })).json();
      assert.equal(sourceList.revision, 1);
      assert.equal(sourceList.records.length, 1);
      const sourceId = sourceList.records[0].id;
      const feedPreviewPath = `${catalogPath}/imports/feed-preview`;
      const previewBody = JSON.stringify({ sourceId });
      assert.equal((await fetch(feedPreviewPath, { method: 'POST', headers: catalogForeignHeaders, body: previewBody })).status, 404);
      assert.equal((await fetch(feedPreviewPath, { method: 'POST', headers: { cookie: firstLogin.cookie, origin, 'content-type': 'application/json' }, body: previewBody })).status, 403);
      assert.equal((await fetch(feedPreviewPath, { method: 'POST', headers: catalogOwnerHeaders, body: previewBody })).status, 400);
      assert.equal((await fetch(`${catalogPath}/sources/${sourceId}`, { headers: { cookie: firstLogin.cookie } })).status, 200);
      const updatedSource = await fetch(`${catalogPath}/sources/${sourceId}`, { method: 'PUT', headers: catalogOwnerHeaders,
        body: JSON.stringify({ expectedRevision: 1, record: sourceBody }) });
      assert.equal(updatedSource.status, 200);
      assert.equal((await updatedSource.json()).revision, 2);
      assert.equal((await fetch(`${catalogPath}/sources/${sourceId}`, { method: 'DELETE', headers: catalogOwnerHeaders,
        body: JSON.stringify({ expectedRevision: 1 }) })).status, 409);
      assert.equal((await fetch(`${catalogPath}/sources/${sourceList.records[0].id}`, { headers: { cookie: secondLogin.cookie } })).status, 404);
      assert.equal((await fetch(`${catalogPath}/sources`, { method: 'POST', headers: catalogForeignHeaders,
        body: JSON.stringify({ expectedRevision: 1, record: sourceBody }) })).status, 404);
      assert.equal((await fetch(`${catalogPath}/sources`, { method: 'POST', headers: { cookie: firstLogin.cookie, origin, 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: 1, record: sourceBody }) })).status, 403);
      assert.equal((await fetch(`${catalogPath}/sources`, { method: 'POST', headers: catalogOwnerHeaders,
        body: JSON.stringify({ expectedRevision: 2, record: { ...sourceBody, creatorAccountId: secondLogin.session.accountId } }) })).status, 400);
      assert.equal((await fetch(`${catalogPath}/sources/${sourceId}`, { method: 'DELETE', headers: catalogOwnerHeaders,
        body: JSON.stringify({ expectedRevision: 2 }) })).status, 200);
      assert.deepEqual((await (await fetch(catalogPath, { headers: { cookie: firstLogin.cookie } })).json()).sources, []);
      const ownedList = await (await fetch(endpoint, { headers: { cookie: firstLogin.cookie } })).json();
      assert.ok(ownedList.some((project: { id: string }) => project.id === owned.id));
      assert.equal((await fetch(endpoint, { headers: { cookie: secondLogin.cookie } })).status, 200);
      assert.deepEqual(await (await fetch(endpoint, { headers: { cookie: secondLogin.cookie } })).json(), []);
      assert.equal((await fetch(`${endpoint}/${owned.id}`, { headers: { cookie: secondLogin.cookie } })).status, 404);
      const hostilePut = await fetch(`${endpoint}/${owned.id}`, { method: 'PUT',
        headers: { cookie: secondLogin.cookie, origin, 'x-csrf-token': secondLogin.session.csrfToken, 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: 1, spec: owned.spec }) });
      assert.equal(hostilePut.status, 404);
      assert.equal((await fetch(`${endpoint}/${owned.id}`, { headers: { cookie: firstLogin.cookie } })).status, 200);
      const ownedPath = `${endpoint}/${owned.id}`;
      const ownerHeaders = { cookie: firstLogin.cookie, origin, 'x-csrf-token': firstLogin.session.csrfToken, 'content-type': 'application/json' };
      const foreignHeaders = { cookie: secondLogin.cookie, origin, 'x-csrf-token': secondLogin.session.csrfToken, 'content-type': 'application/json' };
      assert.notEqual(firstLogin.session.accountId, secondLogin.session.accountId);
      assert.notEqual(firstLogin.session.csrfToken, secondLogin.session.csrfToken);
      assert.equal((await fetch(endpoint, { headers: { cookie: secondLogin.cookie, 'x-user-id': firstLogin.session.accountId,
        'x-creator-account-id': firstLogin.session.accountId } })).status, 200);
      assert.deepEqual(await (await fetch(endpoint, { headers: { cookie: secondLogin.cookie,
        'x-user-id': firstLogin.session.accountId, 'x-creator-account-id': firstLogin.session.accountId } })).json(), []);
      assert.equal((await fetch(ownedPath, { headers: { cookie: secondLogin.cookie,
        'x-user-id': firstLogin.session.accountId, 'x-creator-account-id': firstLogin.session.accountId } })).status, 404);
      assert.equal((await fetch(ownedPath, { method: 'PUT', headers: { ...foreignHeaders,
        'x-user-id': firstLogin.session.accountId, 'x-creator-account-id': firstLogin.session.accountId },
        body: JSON.stringify({ expectedRevision: 1, spec: owned.spec }) })).status, 404);
      assert.equal((await fetch(ownedPath, { method: 'PUT', headers: { ...foreignHeaders,
        'x-csrf-token': firstLogin.session.csrfToken }, body: JSON.stringify({ expectedRevision: 1, spec: owned.spec }) })).status, 403);
      assert.equal((await fetch(ownedPath, { method: 'PUT', headers: { ...ownerHeaders,
        'x-csrf-token': secondLogin.session.csrfToken }, body: JSON.stringify({ expectedRevision: 1, spec: owned.spec }) })).status, 403);
      const privatePath = `${ownedPath}/private-objects`;
      const objectResponse = await fetch(privatePath, { method: 'POST', headers: ownerHeaders,
        body: JSON.stringify({ kind: 'evidence', contentType: 'application/pdf', contentBase64: Buffer.from('%PDF-1.4\nprivate evidence\n%%EOF').toString('base64') }) });
      assert.equal(objectResponse.status, 201);
      const privateMetadata = await objectResponse.json();
      assert.equal(privateMetadata.kind, 'evidence');
      assert.equal(JSON.stringify(privateMetadata).includes('private/'), false);
      assert.equal((await fetch(`${privatePath}/${privateMetadata.id}`, { headers: { cookie: secondLogin.cookie } })).status, 404);
      assert.equal((await fetch(`${privatePath}/${privateMetadata.id}`, { headers: { cookie: firstLogin.cookie } })).status, 200);
      const mediaResponse = await fetch(privatePath, { method: 'POST', headers: ownerHeaders,
        body: JSON.stringify({ kind: 'media', contentType: 'image/png', contentBase64: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('private media')]).toString('base64') }) });
      assert.equal(mediaResponse.status, 201);
      const mediaMetadata = await mediaResponse.json();
      assert.equal(mediaMetadata.kind, 'media');
      const attachedSourceResponse = await fetch(`${catalogPath}/sources`, { method: 'POST', headers: catalogOwnerHeaders,
        body: JSON.stringify({ expectedRevision: 3, record: sourceBody }) });
      assert.equal(attachedSourceResponse.status, 201);
      const attachedSource = (await attachedSourceResponse.json()).record;
      const externalId = { provider: 'creator', kind: 'feed_item_id', value: 'owned-artwork' };
      const itemResponse = await fetch(`${catalogPath}/items`, { method: 'POST', headers: catalogOwnerHeaders,
        body: JSON.stringify({ expectedRevision: 4, record: { schemaVersion: 1, kind: 'book',
          sourceRecord: { sourceId: attachedSource.id, externalId, observedAt: '2026-10-10T00:00:00.000Z', metadata: { title: 'Owned book' } },
          externalIdentifiers: [externalId], mediaAssetIds: [] } }) });
      assert.equal(itemResponse.status, 201);
      const attachedItem = (await itemResponse.json()).record;
      const rights = { status: 'cleared', basis: 'license_documented', permittedUse: 'television_display',
        assertedAt: '2026-10-10T00:00:00.000Z', evidenceId: privateMetadata.id };
      const attachedResponse = await fetch(`${catalogPath}/media-assets`, { method: 'POST', headers: catalogOwnerHeaders,
        body: JSON.stringify({ expectedRevision: 5, record: { schemaVersion: 1, catalogItemId: attachedItem.id, kind: 'artwork',
          location: { type: 'private_object', objectId: mediaMetadata.id }, tvDisplayRights: rights,
          tvPlaybackRights: { status: 'unknown', basis: 'none', permittedUse: 'none' }, deliveryEligible: true } }) });
      assert.equal(attachedResponse.status, 201);
      const attachedAsset = (await attachedResponse.json()).record;
      const collectionResponse = await fetch(`${catalogPath}/collections`, { method: 'POST', headers: catalogOwnerHeaders,
        body: JSON.stringify({ expectedRevision: 6, record: { schemaVersion: 1, kind: 'bookshelf', title: 'Owned books', itemIds: [attachedItem.id] } }) });
      assert.equal(collectionResponse.status, 201);
      const collection = (await collectionResponse.json()).record;
      const catalogProbes: { label: string; suffix: string; method?: string; body?: unknown }[] = [
        { label: 'catalog snapshot', suffix: '' },
        ...(['sources', 'items', 'media-assets', 'collections'] as const).flatMap(kind => [
          { label: `${kind} list`, suffix: `/${kind}` },
          { label: `${kind} create`, suffix: `/${kind}`, method: 'POST', body: { expectedRevision: 7, record: sourceBody } },
          { label: `${kind} detail`, suffix: `/${kind}/${({ sources: attachedSource.id, items: attachedItem.id, 'media-assets': attachedAsset.id, collections: collection.id })[kind]}` },
          { label: `${kind} update`, suffix: `/${kind}/${({ sources: attachedSource.id, items: attachedItem.id, 'media-assets': attachedAsset.id, collections: collection.id })[kind]}`, method: 'PUT', body: { expectedRevision: 7, record: sourceBody } },
          { label: `${kind} delete`, suffix: `/${kind}/${({ sources: attachedSource.id, items: attachedItem.id, 'media-assets': attachedAsset.id, collections: collection.id })[kind]}`, method: 'DELETE', body: { expectedRevision: 7 } }
        ]),
        ...(['preview', 'approve', 'feed-preview', 'feed-approve'] as const).map(action => ({
          label: `import ${action}`, suffix: `/imports/${action}`, method: 'POST', body: { sourceId: attachedSource.id }
        })),
        { label: 'rights events', suffix: `/media-assets/${attachedAsset.id}/rights-events` }
      ];
      for (const probe of catalogProbes) {
        const options = { method: probe.method ?? 'GET', headers: catalogForeignHeaders,
          ...(probe.body === undefined ? {} : { body: JSON.stringify(probe.body) }) };
        const denied = await fetch(`${catalogPath}${probe.suffix}`, options);
        assert.equal(denied.status, 404, probe.label);
        const absent = await fetch(`${endpoint}/ch_${'f'.repeat(32)}/catalog${probe.suffix}`, options);
        assert.equal(absent.status, denied.status, `${probe.label} existence`);
      }
      for (const kind of ['sources', 'items', 'media-assets', 'collections']) {
        assert.equal((await fetch(`${catalogPath}/${kind}`, { headers: { cookie: firstLogin.cookie } })).status, 200, `${kind} owner list`);
      }
      for (const [kind, id] of Object.entries({ sources: attachedSource.id, items: attachedItem.id,
        'media-assets': attachedAsset.id, collections: collection.id })) {
        assert.equal((await fetch(`${catalogPath}/${kind}/${id}`, { headers: { cookie: firstLogin.cookie } })).status, 200, `${kind} owner detail`);
      }
      const fileContent = '[]';
      const filePreview = await fetch(`${catalogPath}/imports/preview`, { method: 'POST', headers: catalogOwnerHeaders,
        body: JSON.stringify({ sourceId: attachedSource.id, format: 'json', content: fileContent }) });
      assert.equal(filePreview.status, 200);
      const filePlan = await filePreview.json();
      assert.equal((await fetch(`${catalogPath}/imports/approve`, { method: 'POST', headers: catalogOwnerHeaders,
        body: JSON.stringify({ sourceId: attachedSource.id, format: 'json', content: fileContent,
          expectedRevision: filePlan.revision, fingerprint: filePlan.fingerprint }) })).status, 200);
      assert.equal((await fetch(`${catalogPath}/imports/preview`, { method: 'POST',
        headers: { cookie: firstLogin.cookie, origin, 'content-type': 'application/json' }, body: '{}' })).status, 403);
      const maliciousPreview = await fetch(`${catalogPath}/imports/preview`, { method: 'POST', headers: catalogOwnerHeaders,
        body: JSON.stringify({ sourceId: attachedSource.id, format: 'json', content: '[{"externalId":"../bad","kind":"book","title":"x"}]' }) });
      assert.equal(maliciousPreview.status, 200);
      assert.deepEqual((await maliciousPreview.json()).issues.map((issue: { code: string }) => issue.code), ['INVALID']);
      const rightsPath = `${catalogPath}/media-assets/${attachedAsset.id}/rights-events`;
      assert.equal((await fetch(rightsPath, { headers: { cookie: secondLogin.cookie } })).status, 404);
      const rightsResponse = await fetch(rightsPath, { headers: { cookie: firstLogin.cookie } });
      assert.equal(rightsResponse.status, 200);
      assert.equal((await rightsResponse.json()).events.length, 1);
      assert.equal((await fetch(rightsPath, { headers: { cookie: firstLogin.cookie }, method: 'POST' })).status, 403);
      assert.equal((await fetch(`${catalogPath}/media-assets/${attachedAsset.id}`, { method: 'DELETE', headers: catalogOwnerHeaders,
        body: JSON.stringify({ expectedRevision: 7 }) })).status, 200);
      assert.equal((await fetch(`${privatePath}/${mediaMetadata.id}`, { headers: { cookie: secondLogin.cookie } })).status, 404);
      assert.equal((await fetch(`${privatePath}/${mediaMetadata.id}/capability`, { method: 'POST', headers: foreignHeaders, body: '{}' })).status, 404);
      assert.equal((await fetch(`${privatePath}/${mediaMetadata.id}/capability`, { method: 'DELETE', headers: foreignHeaders })).status, 404);
      const mediaCapabilityResponse = await fetch(`${privatePath}/${mediaMetadata.id}/capability`, { method: 'POST', headers: ownerHeaders, body: '{}' });
      assert.equal(mediaCapabilityResponse.status, 200);
      const mediaCapability = (await mediaCapabilityResponse.json()).capability;
      assert.equal((await fetch(`${privatePath}/${mediaMetadata.id}/content`, { headers: { cookie: secondLogin.cookie,
        'x-private-capability': mediaCapability } })).status, 404);
      assert.equal((await fetch(`${privatePath}/${mediaMetadata.id}/content`, { headers: { cookie: firstLogin.cookie,
        'x-private-capability': mediaCapability } })).status, 200);
      assert.equal((await fetch(`${privatePath}/${mediaMetadata.id}`, { method: 'DELETE', headers: foreignHeaders })).status, 404);
      assert.equal((await fetch(privatePath, { method: 'POST', headers: foreignHeaders, body: JSON.stringify({ kind: 'evidence', contentType: 'application/pdf', contentBase64: 'YQ==' }) })).status, 404);
      assert.equal((await fetch(privatePath, { method: 'POST', headers: { cookie: firstLogin.cookie, origin, 'content-type': 'application/json' }, body: '{}' })).status, 403);
      const capabilityResponse = await fetch(`${privatePath}/${privateMetadata.id}/capability`, { method: 'POST', headers: ownerHeaders, body: '{}' });
      assert.equal(capabilityResponse.status, 200);
      const { capability } = await capabilityResponse.json();
      assert.equal((await fetch(`${privatePath}/${privateMetadata.id}/content`, { headers: { cookie: secondLogin.cookie, 'x-private-capability': capability } })).status, 404);
      const contentResponse = await fetch(`${privatePath}/${privateMetadata.id}/content`, { headers: { cookie: firstLogin.cookie, 'x-private-capability': capability } });
      assert.equal(contentResponse.status, 200);
      assert.equal(await contentResponse.text(), '%PDF-1.4\nprivate evidence\n%%EOF');
      assert.equal(contentResponse.headers.get('cache-control'), 'no-store');
      assert.equal((await fetch(`${privatePath}/${privateMetadata.id}/capability`, { method: 'DELETE', headers: ownerHeaders })).status, 200);
      assert.equal((await fetch(`${privatePath}/${privateMetadata.id}/content`, { headers: { cookie: firstLogin.cookie, 'x-private-capability': capability } })).status, 404);
      assert.equal((await fetch(`${privatePath}/${privateMetadata.id}`, { method: 'DELETE', headers: foreignHeaders })).status, 404);
      assert.equal((await fetch(`${privatePath}/${privateMetadata.id}`, { method: 'DELETE', headers: ownerHeaders })).status, 200);
      const sourceResponse = await fetch(`${ownedPath}/code`, { method: 'POST', headers: ownerHeaders, body: '{}' });
      assert.equal(sourceResponse.status, 200);
      const generated = await sourceResponse.json();
      assert.ok(generated.files.includes('manifest.toml'));
      assert.equal(generated.path, null);
      const file = await (await fetch(`${ownedPath}/code/file?path=manifest.toml`, { headers: { cookie: firstLogin.cookie } })).json();
      assert.match(file.content, /com\.amazon\.category\.main/);
      const edit = await fetch(`${ownedPath}/code/file`, { method: 'POST', headers: ownerHeaders,
        body: JSON.stringify({ path: 'manifest.toml', content: `${file.content}\n# owned edit\n`, expectedHash: file.sha256 }) });
      assert.equal(edit.status, 200);
      assert.deepEqual((await (await fetch(`${ownedPath}/code`, { headers: { cookie: firstLogin.cookie } })).json()).changed, ['manifest.toml']);
      assert.match((await second.source({ accountId: firstLogin.session.accountId, issuer, subject: 'http-a', email: 'http-a@example.com' }, owned.id))!.files['manifest.toml']!, /owned edit/);
      const exported = await (await fetch(`${ownedPath}/code/export`, { headers: { cookie: firstLogin.cookie } })).json();
      assert.equal(exported.format, 'vegalaunch-source-export-v1');
      assert.match(exported.files['manifest.toml'], /owned edit/);
      assert.equal((await fetch(`${ownedPath}/code`, { method: 'POST', headers: ownerHeaders, body: '{}' })).status, 409);
      assert.equal((await fetch(`${ownedPath}/build`, { method: 'POST', headers: ownerHeaders, body: '{}' })).status, 200);
      assert.deepEqual(await (await fetch(`${ownedPath}/build`, { headers: { cookie: firstLogin.cookie } })).json(),
        await (await fetch(`${ownedPath}/build`, { method: 'POST', headers: ownerHeaders, body: '{}' })).json());
      assert.equal((await (await fetch(`${ownedPath}/build`, { headers: { cookie: firstLogin.cookie } })).json()).status, 'blocked');
      assert.deepEqual(await readdir(directory), ['private']);
      assert.equal((await (await fetch(`${ownedPath}/bundle`, { method: 'POST', headers: ownerHeaders, body: '{}' })).json()).status, 'blocked');
      const agent = await fetch(`${ownedPath}/agent`, { method: 'POST', headers: ownerHeaders,
        body: JSON.stringify({ expectedRevision: 1, message: 'add page Explore' }) });
      assert.equal(agent.status, 200);
      assert.equal((await restarted.read({ accountId: firstLogin.session.accountId, issuer, subject: 'http-a', email: 'http-a@example.com' }, owned.id)).revision, 2);
      const mutation = await fetch(`${ownedPath}/mutations`, { method: 'POST', headers: ownerHeaders,
        body: JSON.stringify({ expectedRevision: 2, mutation: { type: 'setIdentity', title: 'Still owned', slug: 'still-owned' } }) });
      assert.equal(mutation.status, 200);
      assert.equal((await mutation.json()).revision, 3);
      assert.equal((await (await fetch(`${ownedPath}/agent-status`, { headers: { cookie: firstLogin.cookie } })).json()).provider, 'mock');
      assert.equal((await (await fetch(`${ownedPath}/readiness`, { headers: { cookie: firstLogin.cookie } })).json()).build.status, 'blocked');
      const ownerUpdate = await fetch(ownedPath, { method: 'PUT', headers: ownerHeaders,
        body: JSON.stringify({ expectedRevision: 3, spec: { ...owned.spec, title: 'Owner API update' } }) });
      assert.equal(ownerUpdate.status, 200);
      assert.equal((await ownerUpdate.json()).revision, 4);
      const unsafeContent = { id: `item_${'a'.repeat(32)}`, title: 'Private film', description: '',
        artwork: 'assets/catalog-placeholder.png', presentation: 'video', mediaUrl: `http://127.0.0.1/private/${mediaCapability}` };
      for (const mediaUrl of [unsafeContent.mediaUrl, `https://media.example/film.mp4?capability=${mediaCapability}`]) {
        const refused = await fetch(ownedPath, { method: 'PUT', headers: ownerHeaders,
          body: JSON.stringify({ expectedRevision: 4, spec: { ...owned.spec, content: [{ ...unsafeContent, mediaUrl }] } }) });
        assert.equal(refused.status, 400);
        assert.equal((await refused.json()).error.code, 'INVALID_INPUT');
      }
      assert.equal((await restarted.read({ accountId: firstLogin.session.accountId, issuer, subject: 'http-a', email: 'http-a@example.com' }, owned.id)).revision, 4,
        'rejected media writes leave the saved project unchanged');
      assert.equal((await fetch(`${ownedPath}/code/export`, { headers: { cookie: firstLogin.cookie } })).status, 200);

      const cases: { label: string; suffix: string; method?: string; body?: unknown }[] = [
        { label: 'project read', suffix: '' },
        { label: 'catalog draft read', suffix: '/catalog-draft' },
        { label: 'catalog draft generate', suffix: '/catalog-draft', method: 'POST', body: { creatorType: 'writing', expectedRevision: 4,
          expectedCatalogRevision: 8, itemIds: [attachedItem.id], collectionIds: [] } },
        { label: 'project update', suffix: '', method: 'PUT', body: { expectedRevision: 1, spec: owned.spec } },
        { label: 'mutation', suffix: '/mutations', method: 'POST', body: { expectedRevision: 1, mutation: { type: 'setIdentity', title: 'Stolen', slug: 'stolen' } } },
        { label: 'agent status', suffix: '/agent-status' },
        { label: 'agent', suffix: '/agent', method: 'POST', body: { expectedRevision: 1, message: 'add page Stolen' } },
        { label: 'code overview', suffix: '/code' },
        { label: 'generate', suffix: '/code', method: 'POST', body: {} },
        { label: 'file read', suffix: '/code/file?path=manifest.toml' },
        { label: 'source export', suffix: '/code/export' },
        { label: 'file save', suffix: '/code/file', method: 'POST', body: { path: 'manifest.toml', content: 'stolen', expectedHash: file.sha256 } },
        { label: 'build status', suffix: '/build' },
        { label: 'build', suffix: '/build', method: 'POST', body: {} },
        { label: 'readiness', suffix: '/readiness' },
        { label: 'bundle', suffix: '/bundle', method: 'POST', body: {} }
      ];
      const ownerProviderCalls = providerCalls;
      for (const probe of cases) {
        const result = await fetch(`${ownedPath}${probe.suffix}`, { method: probe.method ?? 'GET', headers: foreignHeaders,
          ...(probe.body === undefined ? {} : { body: JSON.stringify(probe.body) }) });
        assert.equal(result.status, 404, probe.label);
        assert.equal((await result.json()).error.message, 'Project not found', probe.label);
        const missing = await fetch(`${endpoint}/ch_${'f'.repeat(32)}${probe.suffix}`, { method: probe.method ?? 'GET', headers: foreignHeaders,
          ...(probe.body === undefined ? {} : { body: JSON.stringify(probe.body) }) });
        assert.equal(missing.status, result.status, `${probe.label} existence`);
      }
      assert.equal(providerCalls, ownerProviderCalls, 'foreign agent probe did not invoke provider');
      assert.equal((await fetch(`${ownedPath}/code/file?path=..%2fprivate`, { headers: foreignHeaders })).status, 404);
      assert.equal((await fetch(ownedPath, { method: 'PUT', headers: foreignHeaders, body: '{}' })).status, 404);
      assert.equal((await fetch(`${ownedPath}/agent`, { method: 'POST', headers: foreignHeaders, body: '{}' })).status, 404);
      for (const probe of cases) {
        const result = await fetch(`${ownedPath}${probe.suffix}`, { method: probe.method ?? 'GET',
          headers: { 'content-type': 'application/json' }, ...(probe.body === undefined ? {} : { body: JSON.stringify(probe.body) }) });
        assert.equal(result.status, 401, `unsigned ${probe.label}`);
      }
      assert.equal((await fetch(endpoint)).status, 401);
      assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Unsigned' }) })).status, 401);
      assert.equal((await fetch(endpoint, { method: 'POST', headers: { cookie: firstLogin.cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'No CSRF' }) })).status, 403);
      for (const probe of cases.filter(item => item.method && item.method !== 'GET')) {
        const result = await fetch(`${ownedPath}${probe.suffix}`, { method: probe.method,
          headers: { cookie: firstLogin.cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(probe.body) });
        assert.equal(result.status, 403, `csrf ${probe.label}`);
      }
      for (const suffix of ['/catalog-draft', '/agent', '/code', '/code/file', `/private-objects/${mediaMetadata.id}/capability`]) {
        const result = await fetch(`${ownedPath}${suffix}`, { method: 'POST',
          headers: { ...ownerHeaders, 'x-csrf-token': secondLogin.session.csrfToken }, body: '{}' });
        assert.equal(result.status, 403, `forged csrf ${suffix}`);
      }
      assert.equal((await fetch(`${endpoint}/..%2f..%2fetc%2fpasswd/code/file?path=manifest.toml`, { headers: { cookie: firstLogin.cookie } })).status, 404);
      assert.equal((await fetch(`${ownedPath}/code/file?path=..%2fproject.json`, { headers: { cookie: firstLogin.cookie } })).status, 400);
      assert.equal((await fetch(`${endpoint}`, { headers: { cookie: 'firelaunch_local_session=stale' } })).status, 401);
      assert.equal((await fetch(`${ownedPath}/agent`, { method: 'POST', headers: { ...foreignHeaders, 'x-csrf-token': 'bad' }, body: JSON.stringify({ expectedRevision: 1, message: 'probe' }) })).status, 403);
      assert.equal((await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: foreignHeaders })).status, 204);
      assert.equal((await fetch(endpoint, { headers: { cookie: secondLogin.cookie } })).status, 401);
      assert.equal((await fetch(ownedPath, { method: 'PUT', headers: foreignHeaders,
        body: JSON.stringify({ expectedRevision: 4, spec: owned.spec }) })).status, 401);
      await new Promise<void>(resolve => api.close(() => resolve()));
      const restartedAuth = new HostedAuth(verifier, origin, principal => restarted.accountForIdentity(principal));
      api = createApi(new ProjectRepository(directory), provider, { mode: 'hosted', auth: restartedAuth }, restarted,
        new PrivateObjectService(restarted, new IsolatedObjectStore(directory)));
      api.listen(address.port, '127.0.0.1'); await once(api, 'listening');
      // Undici may retry a pooled socket from the stopped server; discard that transport-only failure.
      const afterRestart = async (url: string, options?: RequestInit): Promise<Response> => {
        try { return await fetch(url, { ...options, headers: { ...options?.headers, connection: 'close' } }); }
        catch (error) {
          if (!(error instanceof TypeError) || (error.cause as { code?: string } | undefined)?.code !== 'UND_ERR_SOCKET') throw error;
          return fetch(url, { ...options, headers: { ...options?.headers, connection: 'close' } });
        }
      };
      assert.equal((await afterRestart(endpoint, { headers: { cookie: firstLogin.cookie } })).status, 401, 'process-local session cannot survive API restart');
      const relogin = await login('http-a');
      assert.equal(relogin.session.accountId, firstLogin.session.accountId, 'provider identity persists across API restart');
      assert.notEqual(relogin.session.csrfToken, firstLogin.session.csrfToken);
      assert.equal((await (await fetch(ownedPath, { headers: { cookie: relogin.cookie } })).json()).revision, 4);
      assert.equal((await fetch(`${ownedPath}/code/export`, { headers: { cookie: relogin.cookie } })).status, 200);
      assert.equal((await fetch(`${privatePath}/${mediaMetadata.id}`, { headers: { cookie: relogin.cookie } })).status, 200);
      assert.equal((await fetch(`${privatePath}/${mediaMetadata.id}/content`, { headers: { cookie: relogin.cookie,
        'x-private-capability': mediaCapability } })).status, 200);
      const reloginHeaders = { cookie: relogin.cookie, origin, 'x-csrf-token': relogin.session.csrfToken, 'content-type': 'application/json' };
      const catalogBeforeDraft = await (await fetch(catalogPath, { headers: { cookie: relogin.cookie } })).json();
      const draftInput = { creatorType: 'writing', expectedRevision: 4, expectedCatalogRevision: catalogBeforeDraft.revision,
        itemIds: [attachedItem.id], collectionIds: [collection.id] };
      assert.equal((await fetch(`${ownedPath}/catalog-draft`, { method: 'POST', headers: { ...reloginHeaders, 'x-csrf-token': firstLogin.session.csrfToken },
        body: JSON.stringify(draftInput) })).status, 403);
      const draftResponse = await fetch(`${ownedPath}/catalog-draft`, { method: 'POST', headers: reloginHeaders,
        body: JSON.stringify(draftInput) });
      assert.equal(draftResponse.status, 200);
      const draft = await draftResponse.json();
      assert.equal(draft.project.revision, 5);
      assert.equal(draft.project.spec.content[0].presentation, 'information');
      for (const privateValue of [privateMetadata.id, mediaMetadata.id, mediaCapability, capability]) {
        assert.equal(JSON.stringify(draft.project.spec).includes(privateValue), false);
      }
      assert.equal((await fetch(`${ownedPath}/catalog-draft`, { method: 'POST', headers: reloginHeaders,
        body: JSON.stringify(draftInput) })).status, 409);
      assert.equal((await (await fetch(catalogPath, { headers: { cookie: relogin.cookie } })).json()).revision, catalogBeforeDraft.revision,
        'stale draft request does not mutate catalog');
      assert.equal((await restarted.read({ accountId: relogin.session.accountId, issuer, subject: 'http-a', email: 'http-a@example.com' }, owned.id)).revision, 5);
      assert.equal((await fetch(`${privatePath}/${mediaMetadata.id}`, { method: 'DELETE', headers: { cookie: relogin.cookie,
        origin, 'x-csrf-token': relogin.session.csrfToken } })).status, 200);
    } finally {
      await new Promise<void>(resolve => api.close(() => resolve()));
      await new Promise<void>(resolve => issuerServer.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
      process.env.NODE_ENV = previousNodeEnv;
    }

    // The down script is exercised only in this disposable database after all persistence assertions.
    const down = await readFile(new URL('../migrations/001_hosted_ownership.down.sql', import.meta.url), 'utf8');
    const sourceDown = await readFile(new URL('../migrations/002_hosted_source.down.sql', import.meta.url), 'utf8');
    const objectDown = await readFile(new URL('../migrations/003_private_objects.down.sql', import.meta.url), 'utf8');
    const operationsDown = await readFile(new URL('../migrations/004_operations.down.sql', import.meta.url), 'utf8');
    const catalogDown = await readFile(new URL('../migrations/005_catalog.down.sql', import.meta.url), 'utf8');
    const importDown = await readFile(new URL('../migrations/006_catalog_import_previews.down.sql', import.meta.url), 'utf8');
    const mediaRightsDown = await readFile(new URL('../migrations/007_catalog_media_rights.down.sql', import.meta.url), 'utf8');
    const approvalsDown = await readFile(new URL('../migrations/008_catalog_item_approvals.down.sql', import.meta.url), 'utf8');
    const draftsDown = await readFile(new URL('../migrations/009_catalog_drafts.down.sql', import.meta.url), 'utf8');
    const publicationDown = await readFile(new URL('../migrations/010_publication.down.sql', import.meta.url), 'utf8');
    const pipelineDown = await readFile(new URL('../migrations/011_media_pipeline.down.sql', import.meta.url), 'utf8');
    const directUploadDown = await readFile(new URL('../migrations/012_direct_media_upload.down.sql', import.meta.url), 'utf8');
    const managedDown = await readFile(new URL('../migrations/013_managed_media_jobs.down.sql', import.meta.url), 'utf8');
    const subtitlesDown = await readFile(new URL('../migrations/014_video_subtitles.down.sql', import.meta.url), 'utf8');
    await restarted.pool.query('BEGIN');
    await restarted.pool.query(subtitlesDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 14');
    await restarted.pool.query(managedDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 13');
    await restarted.pool.query(directUploadDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 12');
    await restarted.pool.query(pipelineDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 11');
    await restarted.pool.query(publicationDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 10');
    await restarted.pool.query(draftsDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 9');
    await restarted.pool.query(approvalsDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 8');
    await restarted.pool.query(mediaRightsDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 7');
    await restarted.pool.query(importDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 6');
    await restarted.pool.query(catalogDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 5');
    await restarted.pool.query(operationsDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 4');
    await restarted.pool.query(objectDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 3');
    await restarted.pool.query(sourceDown);
    await restarted.pool.query('DELETE FROM firelaunch_schema_migrations WHERE version = 2');
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
