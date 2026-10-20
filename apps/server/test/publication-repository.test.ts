import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { CatalogRepository } from '../src/catalog-repository.js';
import { CatalogProjectionService } from '../src/catalog-projection.js';
import { PublicationRepository, canonicalBytes } from '../src/publication-repository.js';
import { PublicReleaseResolver } from '../src/public-resolver.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';
import { OidcVerifier } from '../src/auth/oidc.js';
import { HostedAuth } from '../src/auth/sessions.js';
import { createApi } from '../src/api.js';
import { ProjectRepository } from '../src/repository.js';
import { generateProject } from '../../../packages/generator/src/index.js';
import type { S3MediaStorage } from '../src/media-storage.js';
import { reserveRevokedMediaInvalidation, finishMediaInvalidation } from '../src/media-invalidation.js';

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
  let clientDirectory: string | undefined;
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
    const newProject = await first.create(owner, { title: 'Owner deployment' });
    const deploymentPath = `${origin}/api/projects/${newProject.id}/deployment`;
    const createInput = { appName: 'Owner deployment', packageId: 'com.example.ownerdeployment',
      manifestEndpoint: 'https://tv.example.org/', nativeReleaseApproval: 'creator_approved' };
    const createRoute = (input: unknown, credentials = ownerLogin, headers: Record<string, string> = {}) =>
      fetch(deploymentPath, { method: 'POST', headers: { cookie: credentials.cookie, origin,
        'x-csrf-token': credentials.csrf, 'content-type': 'application/json', ...headers }, body: JSON.stringify(input) });
    assert.equal((await fetch(deploymentPath, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(createInput) })).status, 401);
    assert.equal((await createRoute(createInput, foreignLogin)).status, 404);
    assert.equal((await createRoute(createInput, ownerLogin, { 'x-csrf-token': 'bad' })).status, 403);
    assert.equal((await createRoute({ ...createInput, creatorAccountId: foreign.accountId })).status, 400);
    assert.equal((await createRoute({ ...createInput, manifestEndpoint: 'https://tv.example.org/api' })).status, 400);
    assert.equal((await createRoute({ ...createInput, manifestEndpoint: 'https://127.0.0.1/' })).status, 400);
    const createdDeploymentResponse = await createRoute(createInput);
    assert.equal(createdDeploymentResponse.status, 201);
    const createdDeployment = await createdDeploymentResponse.json();
    assert.match(createdDeployment.id, /^dep_[a-f0-9]{32}$/);
    assert.equal(createdDeployment.creatorAccountId, owner.accountId);
    assert.equal(createdDeployment.projectId, newProject.id);
    assert.deepEqual(await (await fetch(deploymentPath, { headers: { cookie: ownerLogin.cookie } })).json(), createdDeployment);
    assert.equal((await createRoute(createInput)).status, 409, 'one immutable deployment per project');
    assert.equal((await fetch(`${origin}/api/projects/${newProject.id}/publication/${createdDeployment.id}/status`,
      { headers: { cookie: ownerLogin.cookie } })).status, 200);
    const publicationPath = `${origin}/api/projects/${project.id}/publication/${deploymentId}`;
    const publicPath = `${origin}/public/v1/deployments/${deploymentId}`;
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
    assert.equal((await fetch(`${publicPath}/current`)).status, 404);
    assert.equal((await fetch(`${origin}/public/v1/deployments/${emptyDeploymentId}/current`)).status, 404);
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
    const anonymousRelease = await fetch(`${publicPath}/releases/${firstRelease.manifest.releaseId}`);
    assert.equal(anonymousRelease.status, 200);
    assert.equal(anonymousRelease.headers.get('etag'), `"${firstRelease.sha256}"`);
    assert.equal(await anonymousRelease.text(), firstRelease.bytes);
    assert.equal(anonymousRelease.headers.get('cache-control'), 'public, max-age=60, immutable');
    assert.equal((await fetch(`${origin}/public/v1/deployments/${id('dep')}/releases/${firstRelease.manifest.releaseId}`)).status, 404);
    const anonymousCurrent = await fetch(`${publicPath}/current`, { headers: { cookie: foreignLogin.cookie } });
    assert.deepEqual(await anonymousCurrent.json(), { deploymentId, releaseId: firstRelease.manifest.releaseId,
      releaseSequence: 1, sha256: firstRelease.sha256 });
    assert.equal(anonymousCurrent.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
    assert.equal((await fetch(`${publicPath}/releases/${firstRelease.manifest.releaseId}`,
      { headers: { cookie: ownerLogin.cookie } })).status, 200);
    assert.doesNotMatch(firstRelease.bytes, /private\/|verificationEvidenceId|creatorAccountId|object_key|signedUrl/);
    const foreignProject = await first.create(foreign, { title: 'Other creator' });
    const foreignDeploymentId = id('dep');
    const foreignDeployment = { schemaVersion: 1 as const, id: foreignDeploymentId,
      creatorAccountId: foreign.accountId, projectId: foreignProject.id, channelId: foreignProject.id,
      appName: 'Other creator', packageId: 'com.example.othercreator', releaseControl: 'creator' as const,
      nativeReleaseApproval: 'creator_approved' as const, manifestEndpoint: 'https://tv.example.org/',
      consoleEvidence: { state: 'none' as const } };
    await first.createDeployment(foreign, foreignDeployment);
    await assert.rejects(catalog.mutate(foreign, foreignProject.id, 'sources', 'POST', 0, {
      schemaVersion: 1, type: 'creator_json', state: 'verified',
      permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted', verificationEvidenceId: evidenceId }
    }), { code: 'INVALID_INPUT' });
    const foreignEvidenceId = id('ev');
    await first.pool.query(`INSERT INTO private_objects(id, creator_account_id, project_id, kind, object_key, content_type, byte_size, sha256)
      VALUES ($1,$2,$3,'evidence',$4,'application/pdf',1,$5)`, [foreignEvidenceId, foreign.accountId, foreignProject.id,
      `private/${'b'.repeat(64)}`, sha256('y')]);
    const foreignSource = (await catalog.mutate(foreign, foreignProject.id, 'sources', 'POST', 0, {
      schemaVersion: 1, type: 'creator_json', state: 'verified',
      permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted', verificationEvidenceId: foreignEvidenceId }
    })).record!;
    const foreignItem = (await catalog.mutate(foreign, foreignProject.id, 'items', 'POST', 1, {
      schemaVersion: 1, kind: 'video', sourceRecord: { sourceId: foreignSource.id,
        externalId: { provider: 'creator', kind: 'feed_item_id', value: 'other-film' },
        observedAt: '2026-10-11T00:00:00.000Z', metadata: { title: 'Other film' } },
      externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'other-film' }], mediaAssetIds: []
    })).record!;
    const foreignPlayback = (await catalog.mutate(foreign, foreignProject.id, 'media-assets', 'POST', 2, {
      schemaVersion: 1, catalogItemId: foreignItem.id, kind: 'video',
      location: { type: 'https', url: 'https://media.example.com/other.mp4' },
      rights: rights('television_playback'), deliveryEligible: true
    })).record!;
    const foreignArtwork = (await catalog.mutate(foreign, foreignProject.id, 'media-assets', 'POST', 3, {
      schemaVersion: 1, catalogItemId: foreignItem.id, kind: 'artwork',
      location: { type: 'https', url: 'https://media.example.com/other.jpg' },
      rights: rights('television_display'), deliveryEligible: true
    })).record!;
    const foreignSpec = { ...spec, id: foreignProject.id, title: 'Other creator',
      content: [{ ...spec.content[0]!, mediaUrl: 'https://media.example.com/other.mp4',
        artwork: 'https://media.example.com/other.jpg' }] };
    const foreignUpdated = await first.update(foreign, foreignProject.id, 1, foreignSpec);
    const foreignRequest = { projectId: foreignProject.id, deploymentId: foreignDeploymentId,
      revisions: { channel: foreignUpdated.revision, catalog: 4 }, expectedLiveReleaseId: null,
      bindings: { content: [{ contentId: foreignSpec.content[0]!.id, catalogItemId: foreignItem.id,
        playbackAssetId: foreignPlayback.id, artworkAssetId: foreignArtwork.id }] } };
    await assert.rejects(publication.approve(owner, foreignRequest), { code: 'NOT_FOUND' });
    const foreignApproval = await publication.approve(foreign, foreignRequest);
    const foreignRelease = await publication.publish(foreign, foreignProject.id, foreignDeploymentId, foreignApproval.approvalId);
    assert.equal((await fetch(`${origin}/public/v1/deployments/${foreignDeploymentId}/current`).then(response => response.json())).releaseId,
      foreignRelease.manifest.releaseId);
    assert.equal((await fetch(`${publicPath}/releases/${foreignRelease.manifest.releaseId}`)).status, 404);
    assert.equal((await fetch(`${origin}/public/v1/deployments/${foreignDeploymentId}/releases/${firstRelease.manifest.releaseId}`)).status, 404);
    assert.doesNotMatch(foreignRelease.bytes, /private\/|verificationEvidenceId|creatorAccountId|object_key|signedUrl/);
    const clientOrigin = 'https://tv.example.org';
    const generated = await generateProject(spec, { schemaVersion: 1, id: deploymentId,
      creatorAccountId: owner.accountId, projectId: project.id, channelId: project.id,
      appName: 'Video channel', packageId: 'com.example.publication', releaseControl: 'creator',
      nativeReleaseApproval: 'creator_approved', manifestEndpoint: `${clientOrigin}/`,
      consoleEvidence: { state: 'none' } });
    const local = await generateProject(spec);
    assert.equal(local.files.has('src/release-config.json'), false, 'P0 generation remains static');
    assert.equal(local.files.has('src/remote-release.js'), false);
    assert.deepEqual(JSON.parse(generated.files.get('src/release-config.json')!), {
      deploymentId, channelId: project.id, packageId: 'com.example.publication', origin: clientOrigin
    });
    clientDirectory = await mkdtemp(path.join(process.cwd(), 'node_modules', '.firelaunch-convergence-'));
    await mkdir(path.join(clientDirectory, 'src'));
    await writeFile(path.join(clientDirectory, 'package.json'), '{"type":"module"}');
    for (const name of ['src/remote-release.js', 'src/sha256.js', 'src/tv-runtime.js'])
      await writeFile(path.join(clientDirectory, name), generated.files.get(name)!);
    const { createChannelLoader } = await import(pathToFileURL(path.join(clientDirectory, 'src/remote-release.js')).href);
    const config = JSON.parse(generated.files.get('src/release-config.json')!);
    const bundled = JSON.parse(generated.files.get('src/channel.json')!);
    const stored = new Map<string, string>();
    const storage = { getItem: async (key: string) => stored.get(key) ?? null,
      setItem: async (key: string, value: string) => { stored.set(key, value); } };
    let offline = false;
    let replacement: string | undefined;
    let pointerReplacement: string | undefined;
    const wireGet = async (url: string, limit: number): Promise<string> => {
      if (offline) throw new Error('offline');
      assert.ok(url.startsWith(`${clientOrigin}/public/v1/deployments/${deploymentId}/`));
      const response = await fetch(url.replace(clientOrigin, origin));
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      const bytes = url.endsWith('/current') && pointerReplacement ? pointerReplacement
        : replacement && url.includes('/releases/') ? replacement : await response.text();
      if (Buffer.byteLength(bytes) > limit) throw new Error('response too large');
      return bytes;
    };
    const received: string[] = [];
    const loader = createChannelLoader(config, bundled, { get: wireGet, storage,
      onChannel: (channel: { title: string }) => received.push(channel.title) });
    assert.equal(await loader.start(), true);
    assert.deepEqual(received, [spec.title]);
    assert.equal(await loader.refresh(), false, 'unchanged current pointer does not reload');
    assert.equal(stored.size, 1);
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
    assert.equal((await fetch(`${publicPath}/current`)).status, 404, 'revoked rights suppress the public pointer');
    await first.pool.query('UPDATE catalog_media_assets SET record = $2::jsonb WHERE id = $1', [playback.id, JSON.stringify(playback)]);
    assert.equal((await fetch(`${publicPath}/current`).then(response => response.json())).releaseId, firstRelease.manifest.releaseId);
    await catalog.mutate(owner, project.id, 'media-assets', 'PUT', 4, revoked, playback.id);
    assert.equal((await fetch(`${publicPath}/releases/${liveId}`)).status, 404);
    await assert.rejects(publication.publish(owner, project.id, deploymentId, stale.approvalId), { code: 'CONFLICT' });
    assert.equal((await publication.history(owner, project.id, deploymentId)).releases.length, 1);
    await assert.rejects(publication.approve(owner, { ...nextRequest, revisions: { channel: 2, catalog: 5 } }), { code: 'CONFLICT' });
    await catalog.mutate(owner, project.id, 'media-assets', 'PUT', 5, {
      schemaVersion: 1, catalogItemId: item.id, kind: 'video', location: { type: 'https', url: 'https://media.example.com/film.mp4' },
      rights: rights('television_playback'), deliveryEligible: true
    }, playback.id);
    assert.equal((await fetch(`${publicPath}/releases/${liveId}`)).status, 200);
    const revised = { ...spec, title: 'Second edition' };
    const projectV3 = await first.update(owner, project.id, 2, revised);
    const secondApproval = await publication.approve(owner, { ...nextRequest,
      revisions: { channel: projectV3.revision, catalog: 6 } });
    const pointerReads = Array.from({ length: 20 }, () => fetch(`${publicPath}/current`).then(response => response.json()));
    const secondResponse = await route('publish', { approvalId: secondApproval.approvalId });
    assert.equal(secondResponse.status, 200);
    const secondRelease = await publication.publish(owner, project.id, deploymentId, secondApproval.approvalId);
    assert.equal((await secondResponse.json()).releaseId, secondRelease.manifest.releaseId);
    assert.equal(secondRelease.manifest.releaseSequence, 2);
    assert.equal(secondRelease.manifest.previousReleaseId, liveId);
    assert.equal(secondRelease.manifest.channel.title, 'Second edition');
    const seen = await Promise.all(pointerReads);
    assert.ok(seen.every(pointer => pointer.releaseId === liveId && pointer.releaseSequence === 1 && pointer.sha256 === firstRelease.sha256 ||
      pointer.releaseId === secondRelease.manifest.releaseId && pointer.releaseSequence === 2 && pointer.sha256 === secondRelease.sha256));
    assert.equal((await fetch(`${publicPath}/current`).then(response => response.json())).releaseId, secondRelease.manifest.releaseId);
    assert.equal(await fetch(`${publicPath}/releases/${liveId}`).then(response => response.text()), firstRelease.bytes);
    assert.equal(await loader.refresh(), true);
    assert.deepEqual(received, [spec.title, 'Second edition']);
    offline = true;
    const restartedTitles: string[] = [];
    const restartedLoader = createChannelLoader(config, bundled, { get: wireGet, storage,
      onChannel: (channel: { title: string }) => restartedTitles.push(channel.title) });
    assert.equal(await restartedLoader.start(), false);
    assert.deepEqual(restartedTitles, ['Second edition'], 'verified LKG survives an offline restart');
    offline = false;
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
    for (const [reason, invalidBytes, invalidDigest] of [
      ['bad digest', rollback.bytes, '0'.repeat(64)],
      ['incompatible schema', canonicalBytes({ ...rollback.manifest,
        clientCompatibility: { minSchemaVersion: 2, maxSchemaVersion: 2, channelSchemaVersion: 2 } }), undefined],
      ['wrong deployment', canonicalBytes({ ...rollback.manifest,
        deployment: { ...rollback.manifest.deployment, id: foreignDeploymentId } }), undefined]
    ] as const) {
      replacement = invalidBytes;
      pointerReplacement = JSON.stringify({ deploymentId, releaseId: rollback.manifest.releaseId,
        releaseSequence: 3, sha256: invalidDigest ?? sha256(invalidBytes) });
      assert.equal(await restartedLoader.refresh(), false, reason);
      assert.deepEqual(restartedTitles, ['Second edition']);
    }
    replacement = undefined;
    pointerReplacement = undefined;
    assert.equal(await restartedLoader.refresh(), true, 'new-sequence rollback is a valid remote update');
    assert.deepEqual(restartedTitles, ['Second edition', spec.title]);
    assert.equal((await fetch(`${publicPath}/current`).then(response => response.json())).releaseId, rollback.manifest.releaseId);
    await assert.rejects(first.pool.query(`UPDATE publication_live_pointers SET release_id = $2, sequence = 1
      WHERE deployment_id = $1`, [deploymentId, liveId]), /must advance/);
    assert.equal((await publication.history(owner, project.id, deploymentId)).releases.length, 3);
    assert.deepEqual(await publication.currentSummary(owner, project.id, deploymentId), {
      releaseId: rollback.manifest.releaseId, sequence: 3,
      revisions: rollback.manifest.approvedContentRevision, catalogItemIds: [item.id]
    });
    await assert.rejects(publication.currentSummary(foreign, project.id, deploymentId), { code: 'NOT_FOUND' });
    await assert.rejects(other.history(foreign, project.id, deploymentId), { code: 'NOT_FOUND' });
    await first.pool.end(); first = undefined;
    const restarted = await HostedProjectRepository.connect(url.toString()); first = restarted;
    const history = await new PublicationRepository(restarted).history(owner, project.id, deploymentId);
    assert.equal(history.liveReleaseId, rollback.manifest.releaseId);
    assert.deepEqual(history.releases.map(value => value.sequence), [3, 2, 1]);
    assert.equal((await new PublicReleaseResolver(restarted).current(deploymentId)).id, rollback.manifest.releaseId);
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
    const privatePlayback = { schemaVersion: 1, catalogItemId: item.id, kind: 'video',
      location: { type: 'managed_hls' }, rights: undefined,
      tvDisplayRights: rights('television_display'), tvPlaybackRights: rights('television_playback'), deliveryEligible: true };
    await new CatalogRepository(restarted).mutate(owner, project.id, 'media-assets', 'PUT', 6, privatePlayback, playback.id);
    const uploadId = id('up'); const jobId = id('job'); const setId = id('rs');
    const prefix = `media/${owner.accountId.slice(3)}/${project.id.slice(3)}/${playback.id.slice(3)}`;
    const masterSha = 'a'.repeat(64);
    const hlsClient = await restarted.pool.connect();
    try {
      await hlsClient.query('BEGIN');
      await hlsClient.query(`INSERT INTO media_upload_sessions(id,creator_account_id,project_id,item_id,asset_id,
        idempotency_key,state,original_key,expected_bytes,expected_sha256,verified_bytes,verified_sha256,
        content_type,expires_at) VALUES ($1,$2,$3,$4,$5,$6,'verified',$7,100,$8,100,$8,'video/mp4',now()+interval '1 hour')`,
      [uploadId, owner.accountId, project.id, item.id, playback.id, 'publication-hls-test-001', `${prefix}/original/${uploadId.slice(3)}.mp4`, masterSha]);
      await hlsClient.query(`INSERT INTO media_processing_jobs(id,upload_session_id,creator_account_id,project_id,
        item_id,asset_id,profile,state,rendition_set_id) VALUES ($1,$2,$3,$4,$5,$6,'hls-avc-aac-v1','ready',$7)`,
      [jobId, uploadId, owner.accountId, project.id, item.id, playback.id, setId]);
      await hlsClient.query(`INSERT INTO media_rendition_sets(id,job_id,creator_account_id,project_id,item_id,
        asset_id,profile,master_key,master_sha256,variants,verified_at) VALUES
        ($1,$2,$3,$4,$5,$6,'hls-avc-aac-v1',$7,$8,$9::jsonb,now())`,
      [setId, jobId, owner.accountId, project.id, item.id, playback.id,
        `${prefix}/staged/${setId.slice(3)}/master.m3u8`, masterSha, JSON.stringify([{
          height: 480, playlistKey: `${prefix}/staged/${setId.slice(3)}/v480.m3u8`,
          playlistSha256: 'b'.repeat(64), segmentsSha256: 'c'.repeat(64), segmentCount: 1 }])]);
      await hlsClient.query('COMMIT');
    } catch (error) { await hlsClient.query('ROLLBACK'); throw error; }
    finally { hlsClient.release(); }
    const hlsUrl = `https://media.example.org/${prefix}/delivery/${setId.slice(3)}/${masterSha}/master.m3u8`;
    let promoted = 0;
    const publisher = { publishedMasterUrl: (scope: { creatorAccountId: string; projectId: string; mediaAssetId: string }) => {
      assert.deepEqual(scope, { creatorAccountId: owner.accountId, projectId: project.id, mediaAssetId: playback.id });
      return hlsUrl;
    }, publishVerifiedHls: async () => { promoted++; return hlsUrl; } } as unknown as S3MediaStorage;
    const projection = new CatalogProjectionService(restarted, new CatalogRepository(restarted), publisher);
    const selection = { expectedProjectRevision: 3, expectedCatalogRevision: 7,
      itemIds: [item.id], collectionIds: [] };
    assert.equal((await projection.project(owner, project.id, selection)).bindings[0]?.baseline?.mediaUrl, hlsUrl);
    await assert.rejects(projection.project(foreign, project.id, selection), { code: 'NOT_FOUND' });
    const hlsPublication = new PublicationRepository(restarted, publisher);
    const hlsRequest = { ...request, revisions: { channel: 3, catalog: 7 },
      expectedLiveReleaseId: rollback.manifest.releaseId };
    await assert.rejects(hlsPublication.approve(foreign, hlsRequest), { code: 'NOT_FOUND' });
    await assert.rejects(new PublicationRepository(restarted).approve(owner, hlsRequest), { code: 'CONFLICT' });
    await restarted.pool.query(`UPDATE media_processing_jobs SET state='revoked',rendition_set_id=NULL WHERE id=$1`, [jobId]);
    assert.equal((await projection.project(owner, project.id, selection)).bindings[0]?.baseline, null);
    await assert.rejects(hlsPublication.approve(owner, hlsRequest), { code: 'CONFLICT' });
    await restarted.pool.query(`UPDATE media_processing_jobs SET state='ready',rendition_set_id=$2 WHERE id=$1`, [jobId, setId]);
    const hlsApproval = await hlsPublication.approve(owner, hlsRequest);
    const losingApproval = await hlsPublication.approve(owner, hlsRequest);
    assert.equal(promoted, 0, 'approval never exposes staged media');
    const hlsRelease = await hlsPublication.publish(owner, project.id, deploymentId, hlsApproval.approvalId);
    assert.equal(promoted, 1);
    assert.equal(hlsRelease.manifest.schemaVersion, 1);
    assert.equal(hlsRelease.manifest.channel.content[0]?.mediaUrl, hlsUrl);
    assert.doesNotMatch(hlsRelease.bytes, /managed_hls|private_object|original|staged|signedUrl|verificationEvidenceId/);
    await assert.rejects(hlsPublication.publish(owner, project.id, deploymentId, losingApproval.approvalId), { code: 'CONFLICT' });
    assert.equal((await new PublicReleaseResolver(restarted).current(deploymentId)).id, hlsRelease.manifest.releaseId);
    await restarted.pool.query(`INSERT INTO media_asset_lifecycle(asset_id,item_id,project_id,creator_account_id,revoked_at)
      VALUES ($1,$2,$3,$4,now()) ON CONFLICT (asset_id) DO UPDATE SET revoked_at=now()`,
    [playback.id, item.id, project.id, owner.accountId]);
    await assert.rejects(new PublicReleaseResolver(restarted).current(deploymentId), { code: 'NOT_FOUND' });
    await assert.rejects(reserveRevokedMediaInvalidation(restarted.pool, project.id, playback.id), /Active release/);
    await restarted.pool.query('DELETE FROM publication_live_pointers WHERE project_id=$1 AND creator_account_id=$2',
      [project.id, owner.accountId]);
    const reservation = await reserveRevokedMediaInvalidation(restarted.pool, project.id, playback.id);
    assert.deepEqual(reservation.scope, { creatorAccountId: owner.accountId, projectId: project.id, mediaAssetId: playback.id });
    await finishMediaInvalidation(restarted.pool, reservation.auditId, false);
    const retryReservation = await reserveRevokedMediaInvalidation(restarted.pool, project.id, playback.id);
    await finishMediaInvalidation(restarted.pool, retryReservation.auditId, true);
    await assert.rejects(reserveRevokedMediaInvalidation(restarted.pool, project.id, playback.id), /rate limit/);
    await assert.rejects(reserveRevokedMediaInvalidation(restarted.pool, foreignProject.id, playback.id), /Revoked owned/);
    assert.equal((await restarted.pool.query('SELECT manifest_bytes FROM publication_releases WHERE id=$1',
      [hlsRelease.manifest.releaseId])).rows[0]?.manifest_bytes, hlsRelease.bytes);
    await restarted.pool.query('UPDATE media_processing_jobs SET state=$2,rendition_set_id=NULL WHERE id=$1', [jobId, 'revoked']);
    await restarted.pool.query('DELETE FROM media_rendition_sets WHERE id=$1', [setId]);
    await restarted.pool.query('DELETE FROM media_processing_jobs WHERE id=$1', [jobId]);
    await restarted.pool.query('DELETE FROM media_upload_sessions WHERE id=$1', [uploadId]);
    await restarted.pool.query('DELETE FROM media_asset_lifecycle WHERE asset_id=$1', [playback.id]);
    await restarted.pool.query('DELETE FROM catalog_media_assets WHERE project_id = $1', [project.id]);
    await restarted.pool.query('DELETE FROM catalog_item_identifiers WHERE project_id = $1', [project.id]);
    await restarted.pool.query('DELETE FROM catalog_items WHERE project_id = $1', [project.id]);
    await restarted.pool.query('DELETE FROM catalog_sources WHERE project_id = $1', [project.id]);
    await restarted.pool.query('DELETE FROM creator_accounts WHERE id = $1', [owner.accountId]);
    await restarted.pool.query('DELETE FROM catalog_media_assets WHERE project_id = $1', [foreignProject.id]);
    await restarted.pool.query('DELETE FROM catalog_item_identifiers WHERE project_id = $1', [foreignProject.id]);
    await restarted.pool.query('DELETE FROM catalog_items WHERE project_id = $1', [foreignProject.id]);
    await restarted.pool.query('DELETE FROM catalog_sources WHERE project_id = $1', [foreignProject.id]);
    await restarted.pool.query('DELETE FROM creator_accounts WHERE id = $1', [foreign.accountId]);
    assert.equal((await restarted.pool.query('SELECT count(*)::int AS count FROM publication_releases')).rows[0]?.count, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (api) await new Promise<void>(resolve => api!.close(() => resolve()));
    if (oidcServer) await new Promise<void>(resolve => oidcServer!.close(() => resolve()));
    if (directory) await rm(directory, { recursive: true, force: true });
    if (clientDirectory) await rm(clientDirectory, { recursive: true, force: true });
    if (first) await first.pool.end();
    if (second) await second.pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
