import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { CatalogRepository } from '../src/catalog-repository.js';
import { PublicationRepository } from '../src/publication-repository.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';
import { OidcVerifier } from '../src/auth/oidc.js';
import { HostedAuth } from '../src/auth/sessions.js';
import { createApi } from '../src/api.js';
import { ProjectRepository } from '../src/repository.js';

const databaseTest = process.env.FIRELAUNCH_TEST_DATABASE_URL ? test : test.skip;
const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll('-', '')}`;
const sha256 = (bytes: string) => createHash('sha256').update(bytes).digest('hex');

databaseTest('publication approvals, immutable CAS activation, rights-aware rollback and restart', async () => {
  const base = process.env.FIRELAUNCH_TEST_DATABASE_URL!;
  const admin = new Pool({ connectionString: base });
  const name = `firelaunch_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(base); url.pathname = `/${name}`;
  await admin.query(`CREATE DATABASE ${name}`);
  let first: HostedProjectRepository | undefined;
  let second: HostedProjectRepository | undefined;
  let api: Server | undefined;
  let oidcServer: Server | undefined;
  let directory: string | undefined;
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    first = await HostedProjectRepository.connect(url.toString());
    second = await HostedProjectRepository.connect(url.toString());
    const principal = async (subject: string): Promise<AuthenticatedPrincipal> => ({
      accountId: await first!.accountForIdentity({ issuer: 'https://issuer.example', subject, email: `${subject}@example.com` }),
      issuer: 'https://issuer.example', subject, email: `${subject}@example.com`
    });
    const owner = await principal('publication-owner');
    const foreign = await principal('publication-foreign');
    const forged = { ...foreign, accountId: owner.accountId };
    const project = await first.create(owner, { title: 'Video channel' });
    const deploymentId = id('dep');
    await first.createDeployment(owner, { schemaVersion: 1, id: deploymentId, creatorAccountId: owner.accountId,
      projectId: project.id, channelId: project.id, appName: 'Video channel', packageId: 'com.example.publication',
      releaseControl: 'creator', nativeReleaseApproval: 'creator_approved', consoleEvidence: { state: 'none' } });
    const catalog = new CatalogRepository(first);
    const evidenceId = id('ev');
    await first.pool.query(`INSERT INTO private_objects(id, creator_account_id, project_id, kind, object_key, content_type, byte_size, sha256)
      VALUES ($1,$2,$3,'evidence',$4,'application/pdf',1,$5)`, [evidenceId, owner.accountId, project.id,
      `private/${'a'.repeat(64)}`, sha256('x')]);
    const source = (await catalog.mutate(owner, project.id, 'sources', 'POST', 0, {
      schemaVersion: 1, type: 'creator_json', state: 'verified',
      permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted', verificationEvidenceId: evidenceId }
    })).record!;
    const item = (await catalog.mutate(owner, project.id, 'items', 'POST', 1, {
      schemaVersion: 1, kind: 'video', sourceRecord: { sourceId: source.id,
        externalId: { provider: 'creator', kind: 'feed_item_id', value: 'film-1' },
        observedAt: '2026-10-11T00:00:00.000Z', metadata: { title: 'Film' } },
      externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'film-1' }], mediaAssetIds: []
    })).record!;
    const rights = (use: 'television_display' | 'television_playback') => ({ status: 'cleared', basis: 'creator_asserted',
      permittedUse: use, assertedAt: '2026-10-11T00:00:00.000Z' });
    const playback = (await catalog.mutate(owner, project.id, 'media-assets', 'POST', 2, {
      schemaVersion: 1, catalogItemId: item.id, kind: 'video', location: { type: 'https', url: 'https://media.example.com/film.mp4' },
      rights: rights('television_playback'), deliveryEligible: true
    })).record!;
    const artwork = (await catalog.mutate(owner, project.id, 'media-assets', 'POST', 3, {
      schemaVersion: 1, catalogItemId: item.id, kind: 'artwork', location: { type: 'https', url: 'https://media.example.com/film.jpg' },
      rights: rights('television_display'), deliveryEligible: true
    })).record!;
    const fixture = fixtureChannel();
    const spec = { ...fixture, id: project.id, content: [{ ...fixture.content[0]!, artwork: 'https://media.example.com/film.jpg',
      mediaUrl: 'https://media.example.com/film.mp4' }] };
    const updated = await first.update(owner, project.id, 1, spec);
    const bindings = { content: [{ contentId: fixture.content[0]!.id, catalogItemId: item.id,
      playbackAssetId: playback.id, artworkAssetId: artwork.id }] };
    const publication = new PublicationRepository(first);
    const other = new PublicationRepository(second);
    const request = { projectId: project.id, deploymentId, revisions: { channel: updated.revision, catalog: 4 },
      expectedLiveReleaseId: null, bindings };
    process.env.NODE_ENV = 'test';
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...await exportJWK(publicKey), kid: 'publication-api', alg: 'RS256', use: 'sig' };
    let token = '';
    oidcServer = createServer((req, res) => {
      if (req.url === '/keys') res.end(JSON.stringify({ keys: [jwk] }));
      else if (req.url === '/token') res.end(JSON.stringify({ id_token: token }));
      else res.writeHead(404).end();
    });
    oidcServer.listen(0, '127.0.0.1'); await once(oidcServer, 'listening');
    const issuerAddress = oidcServer.address(); assert.ok(issuerAddress && typeof issuerAddress !== 'string');
    const issuer = `http://127.0.0.1:${issuerAddress.port}`;
    await first.pool.query('INSERT INTO provider_identities(issuer, subject, creator_account_id) VALUES ($1,$2,$3),($1,$4,$5)',
      [issuer, 'owner', owner.accountId, 'foreign', foreign.accountId]);
    const portServer = createServer(); portServer.listen(0, '127.0.0.1'); await once(portServer, 'listening');
    const portAddress = portServer.address(); assert.ok(portAddress && typeof portAddress !== 'string');
    const origin = `http://127.0.0.1:${portAddress.port}`;
    await new Promise<void>(resolve => portServer.close(() => resolve()));
    const verifier = new OidcVerifier({ issuer, clientId: 'publication-test', authorizationEndpoint: `${issuer}/authorize`,
      tokenEndpoint: `${issuer}/token`, jwksUri: `${issuer}/keys`, redirectUri: `${origin}/api/auth/callback` });
    const auth = new HostedAuth(verifier, origin, identity => first!.accountForIdentity(identity));
    directory = await mkdtemp(path.join(tmpdir(), 'firelaunch-publication-api-'));
    api = createApi(new ProjectRepository(directory), undefined, { mode: 'hosted', auth }, first);
    api.listen(portAddress.port, '127.0.0.1'); await once(api, 'listening');
    const login = async (subject: 'owner' | 'foreign') => {
      const started = await fetch(`${origin}/api/auth/login`, { redirect: 'manual' });
      const location = new URL(started.headers.get('location')!);
      const now = Math.floor(Date.now() / 1000);
      token = await new SignJWT({ iss: issuer, aud: 'publication-test', sub: subject, email: `${subject}@example.com`,
        email_verified: true, nonce: location.searchParams.get('nonce'), iat: now, exp: now + 3600 })
        .setProtectedHeader({ alg: 'RS256', kid: 'publication-api' }).sign(privateKey);
      const callback = await fetch(`${origin}/api/auth/callback?state=${location.searchParams.get('state')}&code=fixture`,
        { headers: { cookie: started.headers.get('set-cookie')!.split(';')[0]! }, redirect: 'manual' });
      assert.equal(callback.status, 302);
      const cookie = callback.headers.get('set-cookie')!.match(/firelaunch_local_session=[^;]+/)![0];
      const session = await (await fetch(`${origin}/api/auth/session`, { headers: { cookie } })).json();
      return { cookie, csrf: session.csrfToken as string };
    };
    const ownerLogin = await login('owner');
    const foreignLogin = await login('foreign');
    const publicationPath = `${origin}/api/projects/${project.id}/publication/${deploymentId}`;
    const route = (action: string, input: unknown, credentials = ownerLogin, extra: Record<string, string> = {}) =>
      fetch(`${publicationPath}/${action}`, { method: 'POST', headers: { cookie: credentials.cookie, origin,
        'x-csrf-token': credentials.csrf, 'content-type': 'application/json', ...extra }, body: JSON.stringify(input) });
    const snapshot = { revisions: request.revisions, expectedLiveReleaseId: null, bindings };
    assert.equal((await fetch(`${publicationPath}/status`)).status, 401);
    assert.equal((await fetch(`${publicationPath}/status`, { headers: { cookie: foreignLogin.cookie } })).status, 404);
    assert.equal((await fetch(`${publicationPath}/history`, { headers: { cookie: ownerLogin.cookie } })).status, 200);
    assert.equal((await route('readiness', snapshot, foreignLogin)).status, 404);
    assert.equal((await route('approve', snapshot, foreignLogin, { 'x-user-id': owner.accountId })).status, 404);
    assert.equal((await route('approve', { ...snapshot, creatorAccountId: owner.accountId })).status, 400);
    assert.equal((await fetch(`${publicationPath}/approve`, { method: 'POST', headers: { cookie: ownerLogin.cookie,
      'content-type': 'application/json' }, body: JSON.stringify(snapshot) })).status, 403);
    assert.equal((await route('approve', snapshot, ownerLogin, { 'x-csrf-token': 'bad' })).status, 403);
    assert.equal((await route('approve', snapshot, ownerLogin, { origin: 'https://other.example' })).status, 403);
    assert.equal((await fetch(`${origin}/api/projects/${project.id}/publication/${id('dep')}/status`,
      { headers: { cookie: ownerLogin.cookie } })).status, 404);
    assert.equal((await route('approve', { ...snapshot, revisions: { channel: 1, catalog: 4 } })).status, 409);
    assert.equal((await route('readiness', { ...snapshot, bindings: { content: [] } })).status, 409);
    assert.equal((await route('readiness', snapshot)).status, 200);
    const emptyProject = await first.create(owner, { title: 'No catalog media' });
    const emptyDeploymentId = id('dep');
    await first.createDeployment(owner, { schemaVersion: 1, id: emptyDeploymentId, creatorAccountId: owner.accountId,
      projectId: emptyProject.id, channelId: emptyProject.id, appName: 'Empty channel', packageId: 'com.example.publicationempty',
      releaseControl: 'creator', nativeReleaseApproval: 'creator_approved', consoleEvidence: { state: 'none' } });
    const emptyReadiness = await fetch(`${origin}/api/projects/${emptyProject.id}/publication/${emptyDeploymentId}/readiness`, {
      method: 'POST', headers: { cookie: ownerLogin.cookie, origin, 'x-csrf-token': ownerLogin.csrf, 'content-type': 'application/json' },
      body: JSON.stringify({ revisions: { channel: emptyProject.revision, catalog: 0 }, expectedLiveReleaseId: null,
        bindings: { content: [] } }) });
    assert.equal(emptyReadiness.status, 409);
    assert.match((await emptyReadiness.json()).error.message, /No approved catalog media/);
    const routeApproval = await route('approve', snapshot);
    assert.equal(routeApproval.status, 201);
    const routeApprovalId = (await routeApproval.json()).approvalId as string;
    assert.equal((await publication.history(owner, project.id, deploymentId)).releases.length, 0, 'approval does not publish');
    await assert.rejects(publication.approve(foreign, request), { code: 'NOT_FOUND' });
    await assert.rejects(publication.approve(forged, request), { code: 'NOT_FOUND' });
    await assert.rejects(publication.approve(owner, { ...request, revisions: { channel: 1, catalog: 4 } }), { code: 'CONFLICT' });
    await assert.rejects(publication.approve(owner, { ...request, revisions: { channel: 2, catalog: 3 } }), { code: 'CONFLICT' });
    assert.equal((await publication.history(owner, project.id, deploymentId)).releases.length, 0);
    const a1 = await publication.approve(owner, request);
    const a2 = await other.approve(owner, request);
    await assert.rejects(other.publish(foreign, project.id, deploymentId, a1.approvalId), { code: 'NOT_FOUND' });
    const raced = await Promise.allSettled([
      publication.publish(owner, project.id, deploymentId, a1.approvalId),
      other.publish(owner, project.id, deploymentId, a2.approvalId)
    ]);
    assert.equal(raced.filter(value => value.status === 'fulfilled').length, 1);
    assert.equal(raced.filter(value => value.status === 'rejected' && value.reason.code === 'CONFLICT').length, 1);
    const firstRelease = raced.find(value => value.status === 'fulfilled')!.value;
    assert.equal(firstRelease.manifest.releaseSequence, 1);
    assert.equal(firstRelease.sha256, sha256(firstRelease.bytes));
    const winningApproval = firstRelease.manifest.approvalId;
    const retry = await other.publish(owner, project.id, deploymentId, winningApproval);
    assert.equal(retry.manifest.releaseId, firstRelease.manifest.releaseId);
    assert.equal((await publication.history(owner, project.id, deploymentId)).releases.length, 1);
    const apiRetry = await route('publish', { approvalId: winningApproval });
    assert.equal(apiRetry.status, 200);
    assert.equal((await apiRetry.json()).releaseId, firstRelease.manifest.releaseId);
    assert.equal((await route('publish', { approvalId: routeApprovalId })).status, 409);
    assert.equal((await route('approve', snapshot)).status, 409);
    assert.equal((await fetch(`${publicationPath}/status`, { headers: { cookie: ownerLogin.cookie } })).status, 200);
    await assert.rejects(first.pool.query('UPDATE publication_releases SET manifest_bytes = $2 WHERE id = $1',
      [firstRelease.manifest.releaseId, '{}']), /immutable/);
    await assert.rejects(first.pool.query('UPDATE publication_approvals SET bindings = $2::jsonb WHERE id = $1',
      [winningApproval, '{}']), /immutable/);
    await assert.rejects(publication.approve(owner, request), { code: 'CONFLICT' });
    const liveId = firstRelease.manifest.releaseId;
    const nextRequest = { ...request, expectedLiveReleaseId: liveId };
    const stale = await publication.approve(owner, nextRequest);
    const revoked = { schemaVersion: 1, catalogItemId: item.id, kind: 'video',
      location: { type: 'https', url: 'https://media.example.com/film.mp4' },
      rights: { ...rights('television_playback'), status: 'revoked' }, deliveryEligible: false };
    await first.pool.query('UPDATE catalog_media_assets SET record = $2::jsonb WHERE id = $1',
      [playback.id, JSON.stringify({ ...playback, ...revoked })]);
    await assert.rejects(publication.publish(owner, project.id, deploymentId, stale.approvalId), { code: 'CONFLICT' });
    assert.equal((await route('publish', { approvalId: stale.approvalId })).status, 409);
    assert.equal((await publication.history(owner, project.id, deploymentId)).releases.length, 1, 'rights refusal has no partial release');
    await first.pool.query('UPDATE catalog_media_assets SET record = $2::jsonb WHERE id = $1', [playback.id, JSON.stringify(playback)]);
    await catalog.mutate(owner, project.id, 'media-assets', 'PUT', 4, revoked, playback.id);
    await assert.rejects(publication.publish(owner, project.id, deploymentId, stale.approvalId), { code: 'CONFLICT' });
    assert.equal((await publication.history(owner, project.id, deploymentId)).releases.length, 1);
    await assert.rejects(publication.approve(owner, { ...nextRequest, revisions: { channel: 2, catalog: 5 } }), { code: 'CONFLICT' });
    await catalog.mutate(owner, project.id, 'media-assets', 'PUT', 5, {
      schemaVersion: 1, catalogItemId: item.id, kind: 'video', location: { type: 'https', url: 'https://media.example.com/film.mp4' },
      rights: rights('television_playback'), deliveryEligible: true
    }, playback.id);
    const revised = { ...spec, title: 'Second edition' };
    const projectV3 = await first.update(owner, project.id, 2, revised);
    const secondApproval = await publication.approve(owner, { ...nextRequest,
      revisions: { channel: projectV3.revision, catalog: 6 } });
    const secondResponse = await route('publish', { approvalId: secondApproval.approvalId });
    assert.equal(secondResponse.status, 200);
    const secondRelease = await publication.publish(owner, project.id, deploymentId, secondApproval.approvalId);
    assert.equal((await secondResponse.json()).releaseId, secondRelease.manifest.releaseId);
    assert.equal(secondRelease.manifest.releaseSequence, 2);
    assert.equal(secondRelease.manifest.previousReleaseId, liveId);
    assert.equal(secondRelease.manifest.channel.title, 'Second edition');
    const rollbackRequest = { revisions: { channel: 3, catalog: 6 }, expectedLiveReleaseId: secondRelease.manifest.releaseId,
      rollbackSourceReleaseId: liveId };
    const refusedRollbackResponse = await route('rollback', rollbackRequest);
    assert.equal(refusedRollbackResponse.status, 201);
    const refusedRollbackId = (await refusedRollbackResponse.json()).approvalId as string;
    await first.pool.query('UPDATE catalog_media_assets SET record = $2::jsonb WHERE id = $1',
      [artwork.id, JSON.stringify({ ...artwork, rights: { ...rights('television_display'), status: 'revoked' }, deliveryEligible: false })]);
    assert.equal((await route('publish', { approvalId: refusedRollbackId })).status, 409);
    assert.equal((await publication.history(owner, project.id, deploymentId)).releases.length, 2);
    await first.pool.query('UPDATE catalog_media_assets SET record = $2::jsonb WHERE id = $1', [artwork.id, JSON.stringify(artwork)]);
    await first.pool.query('UPDATE catalog_sources SET record = $2::jsonb WHERE id = $1',
      [source.id, JSON.stringify({ ...source, state: 'discovered', permission: { retrieval: 'revoked', tvDisplay: 'revoked' } })]);
    assert.equal((await route('publish', { approvalId: refusedRollbackId })).status, 409);
    await first.pool.query('UPDATE catalog_sources SET record = $2::jsonb WHERE id = $1', [source.id, JSON.stringify(source)]);
    const rollbackApprovalResponse = await route('rollback', rollbackRequest);
    assert.equal(rollbackApprovalResponse.status, 201);
    const rollbackApprovalId = (await rollbackApprovalResponse.json()).approvalId as string;
    const rollbackResponse = await route('publish', { approvalId: rollbackApprovalId });
    assert.equal(rollbackResponse.status, 200);
    const rollback = await other.publish(owner, project.id, deploymentId, rollbackApprovalId);
    assert.equal((await rollbackResponse.json()).releaseId, rollback.manifest.releaseId);
    assert.equal(rollback.manifest.releaseSequence, 3);
    assert.equal(rollback.manifest.previousReleaseId, secondRelease.manifest.releaseId);
    assert.equal(rollback.manifest.channel.title, firstRelease.manifest.channel.title);
    assert.notEqual(rollback.manifest.releaseId, liveId);
    await assert.rejects(first.pool.query(`UPDATE publication_live_pointers SET release_id = $2, sequence = 1
      WHERE deployment_id = $1`, [deploymentId, liveId]), /must advance/);
    assert.equal((await publication.history(owner, project.id, deploymentId)).releases.length, 3);
    await assert.rejects(other.history(foreign, project.id, deploymentId), { code: 'NOT_FOUND' });
    await first.pool.end(); first = undefined;
    const restarted = await HostedProjectRepository.connect(url.toString()); first = restarted;
    const history = await new PublicationRepository(restarted).history(owner, project.id, deploymentId);
    assert.equal(history.liveReleaseId, rollback.manifest.releaseId);
    assert.deepEqual(history.releases.map(value => value.sequence), [3, 2, 1]);
    const bytes = await restarted.pool.query<{ manifest_bytes: string; sha256: string }>(
      'SELECT manifest_bytes, sha256 FROM publication_releases WHERE id = $1', [liveId]);
    assert.equal(bytes.rows[0]?.manifest_bytes, firstRelease.bytes);
    assert.equal(bytes.rows[0]?.sha256, firstRelease.sha256);
    const exported = (await import('../src/operations.js')).exportAccount;
    const accountExport = await exported(restarted.pool, { get: async () => Buffer.from('x'), put: async () => undefined,
      delete: async () => undefined }, owner.accountId);
    assert.equal(accountExport.publicationReleases.length, 3);
    assert.equal(accountExport.publicationLivePointers.length, 1);
    await assert.rejects(restarted.pool.query('DELETE FROM publication_releases WHERE id = $1', [liveId]), /immutable/);
    await assert.rejects(restarted.pool.query('DELETE FROM publication_approvals WHERE id = $1', [winningApproval]), /immutable/);
    await restarted.pool.query('DELETE FROM catalog_media_assets WHERE project_id = $1', [project.id]);
    await restarted.pool.query('DELETE FROM catalog_item_identifiers WHERE project_id = $1', [project.id]);
    await restarted.pool.query('DELETE FROM catalog_items WHERE project_id = $1', [project.id]);
    await restarted.pool.query('DELETE FROM catalog_sources WHERE project_id = $1', [project.id]);
    await restarted.pool.query('DELETE FROM creator_accounts WHERE id = $1', [owner.accountId]);
    assert.equal((await restarted.pool.query('SELECT count(*)::int AS count FROM publication_releases')).rows[0]?.count, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (api) await new Promise<void>(resolve => api!.close(() => resolve()));
    if (oidcServer) await new Promise<void>(resolve => oidcServer!.close(() => resolve()));
    if (directory) await rm(directory, { recursive: true, force: true });
    if (first) await first.pool.end();
    if (second) await second.pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
