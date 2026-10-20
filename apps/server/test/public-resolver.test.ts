import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { createApi } from '../src/api.js';
import { ProjectRepository } from '../src/repository.js';
import type { HostedProjectRepository } from '../src/hosted-repository.js';
import type { HostedAuth } from '../src/auth/sessions.js';
import { canonicalBytes } from '../src/publication-repository.js';
import { ManagedArtworkDelivery } from '../src/managed-artwork.js';
import { PublicReleaseResolver } from '../src/public-resolver.js';
import type { S3MediaStorage } from '../src/media-storage.js';
import type { PrivateObjectStore } from '../src/private-objects.js';
import { catalogItemSchema, catalogSourceSchema, mediaAssetSchema, publishedManifestSchema } from '@firelaunch/contracts';

const hex = (digit: string) => digit.repeat(32);
const deploymentId = `dep_${hex('a')}`;
const foreignId = `dep_${hex('b')}`;
const releaseId = `rel_${hex('c')}`;
const nextReleaseId = `rel_${hex('d')}`;
const digest = (bytes: string) => createHash('sha256').update(bytes).digest('hex');

test('public resolver serves only valid approved immutable bytes and one-snapshot pointers', async () => {
  const original = fixtureChannel();
  const channel = { ...original, content: original.content.map(content => ({ ...content,
    artwork: 'https://media.example.com/cover.jpg' })) };
  const manifest = {
    schemaVersion: 1, releaseId, releaseSequence: 1, publishedAt: '2026-10-11T00:00:00.000Z',
    deployment: { id: deploymentId, projectId: original.id, channelId: original.id, packageId: 'com.example.tv' },
    approvedContentRevision: { channel: 2, catalog: 4 }, approvalId: `ap_${hex('e')}`,
    clientCompatibility: { minSchemaVersion: 1, maxSchemaVersion: 1, channelSchemaVersion: 1 }, channel,
    media: [{ id: `ma_${hex('1')}`, kind: 'video', url: original.content[0]!.mediaUrl },
      { id: `ma_${hex('2')}`, kind: 'artwork', url: channel.content[0]!.artwork }],
    bindings: { content: [{ contentId: channel.content[0]!.id, catalogItemId: `ci_${hex('3')}`,
      playbackAssetId: `ma_${hex('1')}`, artworkAssetId: `ma_${hex('2')}` }] }
  };
  const row = (value: unknown, id: string, sequence: number) => {
    const manifestBytes = canonicalBytes(value);
    return { id, sequence, manifest_bytes: manifestBytes, sha256: digest(manifestBytes),
      creator_account_id: `cr_${hex('f')}`, project_id: original.id };
  };
  const releases = new Map([[releaseId, row(manifest, releaseId, 1)]]);
  let currentId = releaseId;
  let queries = 0;
  const catalogSource = { schemaVersion: 1, id: `src_${hex('4')}`, creatorAccountId: `cr_${hex('f')}`,
    projectId: original.id, type: 'creator_json', state: 'verified',
    permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted',
      verificationEvidenceId: `ev_${hex('5')}` } };
  const catalogItem = { schemaVersion: 1, id: `ci_${hex('3')}`, creatorAccountId: `cr_${hex('f')}`,
    projectId: original.id, kind: 'video', sourceRecord: { sourceId: catalogSource.id,
      externalId: { provider: 'creator', kind: 'feed_item_id', value: 'fixture' },
      observedAt: '2026-10-11T00:00:00.000Z', metadata: { title: 'Oceans' } },
    externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'fixture' }],
    mediaAssetIds: manifest.media.map(asset => asset.id) };
  const catalogAssets: Array<{ id: string; revoked_at: Date | null; record: unknown;
    item_record: unknown; source_record: unknown }> = manifest.media.map(asset => ({ id: asset.id, revoked_at: null,
    record: { schemaVersion: 1, id: asset.id, creatorAccountId: `cr_${hex('f')}`,
      projectId: original.id, catalogItemId: catalogItem.id, kind: asset.kind,
      location: { type: 'https', url: asset.url }, rights: { status: 'cleared', basis: 'creator_asserted',
        permittedUse: asset.kind === 'artwork' ? 'television_display' : 'television_playback',
        assertedAt: '2026-10-11T00:00:00.000Z' }, deliveryEligible: true },
    item_record: catalogItem, source_record: catalogSource }));
  const repository = { pool: { query: async (sql: string, parameters: unknown[]) => {
    queries++;
    if (sql.includes('FROM catalog_media_assets a')) return {
      rows: parameters[0] === `cr_${hex('f')}` && parameters[1] === original.id ?
        catalogAssets.filter(asset => (parameters[2] as string[]).includes(asset.id)) : [] };
    if (parameters[0] !== deploymentId) return { rows: [] };
    const selected = sql.includes('publication_live_pointers') ? currentId : parameters[1];
    return { rows: selected && releases.has(selected) ? [releases.get(selected)] : [] };
  } } } as unknown as HostedProjectRepository;
  const auth = { session: () => null } as unknown as HostedAuth;
  const api = createApi(new ProjectRepository('/tmp/firelaunch-public-resolver-unused'), undefined,
    { mode: 'hosted', auth }, repository);
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  const address = api.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const base = `/public/v1/deployments/${deploymentId}`;
  const get = (path: string, options?: RequestInit) => fetch(`${origin}${path}`, options);
  try {
    const pointer = await get(`${base}/current`);
    assert.equal(pointer.status, 200);
    assert.match(pointer.headers.get('content-type')!, /^application\/json/);
    assert.equal(pointer.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
    assert.deepEqual(await pointer.json(), { deploymentId, releaseId, releaseSequence: 1, sha256: releases.get(releaseId)!.sha256 });
    const immutable = await get(`${base}/releases/${releaseId}`);
    assert.equal(immutable.status, 200);
    assert.equal(immutable.headers.get('cache-control'), 'public, max-age=60, immutable');
    assert.equal(immutable.headers.get('etag'), `"${releases.get(releaseId)!.sha256}"`);
    assert.equal(immutable.headers.get('content-length'), String(Buffer.byteLength(releases.get(releaseId)!.manifest_bytes)));
    assert.equal(await immutable.text(), releases.get(releaseId)!.manifest_bytes);
    for (const path of [`${base}/current`, `${base}/releases/${releaseId}`]) {
      const response = await get(path);
      const cached = await get(path, { headers: { 'if-none-match': response.headers.get('etag')! } });
      assert.equal(cached.status, 304);
      assert.equal(await cached.text(), '');
      assert.equal(cached.headers.get('cache-control'), response.headers.get('cache-control'));
    }
    const neverPublished = `rel_${hex('0')}`;
    for (const path of [`/public/v1/deployments/${foreignId}/current`, `${base}/releases/${neverPublished}`,
      `${base}/releases/${releaseId}/extra`, `${base}/releases/${releaseId}?draft=1`,
      `${base}/releases/%2e%2e`, `${base}//current`, `${base}/current?`, `${base}/current/`]) {
      const response = await get(path);
      assert.equal(response.status, 404, path);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal((await get(`${base}/current`, { method: 'POST' })).status, 404);
    assert.equal((await get(`${base}/current`, { method: 'HEAD' })).status, 404);
    const bodyHeaderStatus = await new Promise<number>((resolve, reject) => {
      const attempt = httpRequest(`${origin}${base}/current`, { headers: { 'content-length': '0' } }, response => {
        response.resume(); resolve(response.statusCode ?? 0);
      });
      attempt.on('error', reject);
      attempt.end();
    });
    assert.equal(bodyHeaderStatus, 404);
    assert.equal((await get(`${base}/current`, { headers: { range: 'bytes=0-5' } })).status, 404);
    assert.equal((await get(`${base}/current`, { headers: { 'if-none-match': 'x'.repeat(129) } })).status, 404);
    assert.equal((await get(`/api/projects/${original.id}/publication/${deploymentId}/history`)).status, 401);
    assert.equal((await get('/api/projects')).status, 401);
    assert.equal((await get('/api/auth/session')).status, 401);

    const second = { ...manifest, releaseId: nextReleaseId, releaseSequence: 2, previousReleaseId: releaseId,
      channel: { ...channel, title: 'New edition' } };
    releases.set(nextReleaseId, row(second, nextReleaseId, 2));
    currentId = nextReleaseId;
    const afterSwitch = await get(`${base}/current`, { headers: { 'if-none-match': pointer.headers.get('etag')! } });
    assert.equal(afterSwitch.status, 200, 'the former live pointer ETag cannot hide an update');
    assert.equal((await afterSwitch.json()).releaseId, nextReleaseId);
    const snapshots = await Promise.all(Array.from({ length: 20 }, () => get(`${base}/current`).then(response => response.json())));
    assert.ok(snapshots.every(value => value.releaseId === nextReleaseId && value.releaseSequence === 2 &&
      value.sha256 === releases.get(nextReleaseId)!.sha256));
    assert.equal((await get(`${base}/releases/${releaseId}`).then(response => response.json())).releaseSequence, 1);
    assert.ok(queries >= 25);

    catalogAssets[0]!.revoked_at = new Date('2026-10-12T00:00:00.000Z');
    assert.equal((await get(`${base}/current`)).status, 404);
    assert.equal((await get(`${base}/releases/${releaseId}`)).status, 404);
    catalogAssets[0]!.revoked_at = null;
    assert.equal((await get(`${base}/current`)).status, 200);

    const badValues = [
      { ...releases.get(nextReleaseId)!, sha256: hex('0') + hex('0') },
      row({ ...second, creatorAccountId: `cr_${hex('a')}`, privateKey: 'secret' }, nextReleaseId, 2),
      row({ ...second, media: [{ ...second.media[0], url: 'https://media.example.com/film.mp4?token=private' }, second.media[1]] }, nextReleaseId, 2),
      row({ ...second, deployment: { ...second.deployment, id: foreignId } }, nextReleaseId, 2),
      { ...releases.get(nextReleaseId)!, manifest_bytes: ' '.repeat(1_048_577) },
      { ...releases.get(nextReleaseId)!, manifest_bytes: '{' },
      (() => { const manifestBytes = releases.get(nextReleaseId)!.manifest_bytes.replace('"releaseId":',
        '"releaseId":"private-secret","releaseId":'); return { ...releases.get(nextReleaseId)!,
        manifest_bytes: manifestBytes, sha256: digest(manifestBytes) }; })(),
      (() => { const manifestBytes = `${releases.get(nextReleaseId)!.manifest_bytes} `; return {
        ...releases.get(nextReleaseId)!, manifest_bytes: manifestBytes, sha256: digest(manifestBytes) }; })(),
      { ...releases.get(nextReleaseId)!, sequence: 3 }
    ];
    for (const value of badValues) {
      releases.set(nextReleaseId, value);
      for (const path of [`${base}/current`, `${base}/releases/${nextReleaseId}`]) {
        const response = await get(path);
        assert.equal(response.status, 404);
        assert.doesNotMatch(await response.text(), /secret|privateKey|token=private/);
      }
    }
  } finally {
    await new Promise<void>(resolve => api.close(() => resolve()));
  }
  const local = createApi(new ProjectRepository('/tmp/firelaunch-public-resolver-unused'), undefined,
    { mode: 'local-legacy' });
  local.listen(0, '127.0.0.1');
  await once(local, 'listening');
  try {
    const localAddress = local.address();
    assert.ok(localAddress && typeof localAddress !== 'string');
    assert.equal((await fetch(`http://127.0.0.1:${localAddress.port}${base}/current`)).status, 404);
  } finally {
    await new Promise<void>(resolve => local.close(() => resolve()));
  }
});

test('public thumbnail route requires an approved release, unchanged private source and current rights', async () => {
  const original = fixtureChannel();
  const owner = `cr_${hex('f')}`, itemId = `ci_${hex('3')}`, videoId = `ma_${hex('1')}`;
  const artworkId = `ma_${hex('2')}`, objectId = `ma_${hex('6')}`;
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 8, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]);
  const imageHash = createHash('sha256').update(image).digest('hex');
  const path = `/api/public-artwork/${deploymentId}/${releaseId}/${artworkId}/${imageHash}.jpg`;
  const imageUrl = `https://studio.example.com${path}`;
  const channel = { ...original, content: original.content.map(content => ({ ...content, artwork: imageUrl })) };
  const manifest = { schemaVersion: 1, releaseId, releaseSequence: 1, publishedAt: '2026-10-11T00:00:00.000Z',
    deployment: { id: deploymentId, projectId: original.id, channelId: original.id, packageId: 'com.example.tv' },
    approvedContentRevision: { channel: 2, catalog: 4 }, approvalId: `ap_${hex('e')}`,
    clientCompatibility: { minSchemaVersion: 1, maxSchemaVersion: 1, channelSchemaVersion: 1 }, channel,
    media: [{ id: videoId, kind: 'video', url: original.content[0]!.mediaUrl }, { id: artworkId, kind: 'artwork', url: imageUrl }],
    bindings: { content: [{ contentId: channel.content[0]!.id, catalogItemId: itemId, playbackAssetId: videoId, artworkAssetId: artworkId }] } };
  const bytes = canonicalBytes(manifest);
  const release = { id: releaseId, sequence: 1, manifest_bytes: bytes, sha256: digest(bytes),
    creator_account_id: owner, project_id: original.id };
  const source = { schemaVersion: 1, id: `src_${hex('4')}`, creatorAccountId: owner, projectId: original.id,
    type: 'creator_json', state: 'verified', permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted',
      verificationEvidenceId: `ev_${hex('5')}` } };
  const item = { schemaVersion: 1, id: itemId, creatorAccountId: owner, projectId: original.id, kind: 'video',
    sourceRecord: { sourceId: source.id, externalId: { provider: 'creator', kind: 'feed_item_id', value: 'fixture' },
      observedAt: '2026-10-11T00:00:00.000Z', metadata: { title: 'Oceans' } },
    externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'fixture' }], mediaAssetIds: [videoId, artworkId] };
  const rights = (use: string) => ({ status: 'cleared', basis: 'creator_asserted', permittedUse: use,
    assertedAt: '2026-10-11T00:00:00.000Z' });
  const video = { schemaVersion: 1, id: videoId, creatorAccountId: owner, projectId: original.id,
    catalogItemId: itemId, kind: 'video', location: { type: 'https', url: original.content[0]!.mediaUrl },
    rights: rights('television_playback'), deliveryEligible: true };
  const artwork = { schemaVersion: 1, id: artworkId, creatorAccountId: owner, projectId: original.id,
    catalogItemId: itemId, kind: 'artwork', location: { type: 'private_object', objectId },
    tvDisplayRights: rights('television_display'), tvPlaybackRights: { status: 'unknown', basis: 'none', permittedUse: 'none' }, deliveryEligible: true };
  assert.equal(publishedManifestSchema.safeParse(manifest).success, true);
  assert.equal(catalogItemSchema.safeParse(item).success, true);
  assert.equal(catalogSourceSchema.safeParse(source).success, true);
  assert.equal(mediaAssetSchema.safeParse(video).success, true);
  assert.equal(mediaAssetSchema.safeParse(artwork).success, true);
  let revoked = false;
  let currentObjectHash = imageHash;
  const copied = new Map<string, Buffer>();
  const store = { put: async (key: string, body: Buffer) => { copied.set(key, body); },
    get: async (key: string) => { const body = copied.get(key); if (!body) throw new Error('missing'); return body; },
    delete: async () => {} } as PrivateObjectStore;
  const pool = { query: async (sql: string, args: unknown[]) => {
    if (sql.includes('FROM catalog_media_assets a')) return { rows: [
      { id: videoId, record: video, item_record: item, source_record: source, revoked_at: null },
      { id: artworkId, record: artwork, item_record: item, source_record: source, revoked_at: revoked ? new Date() : null }
    ] };
    if (sql.includes('FROM private_objects')) return { rows: args[1] === owner && args[2] === original.id ?
      [{ id: objectId, sha256: currentObjectHash, content_type: 'image/jpeg' }] : [] };
    return { rows: args[0] === deploymentId && args[1] === releaseId ? [release] : [] };
  } } as unknown as HostedProjectRepository['pool'];
  const delivery = new ManagedArtworkDelivery(pool, store, 'https://studio.example.com');
  // The public route reads the immutable published copy; no private upload capability is issued.
  const key = `private/${createHash('sha256').update(`published-artwork-v1\0${deploymentId}\0${releaseId}\0${artworkId}\0${imageHash}`).digest('hex')}`;
  copied.set(key, image);
  const repository = { pool } as HostedProjectRepository;
  const api = createApi(new ProjectRepository('/tmp/firelaunch-managed-artwork-unused'), undefined,
    { mode: 'hosted', auth: { session: () => null } as HostedAuth }, repository, undefined, undefined, undefined, delivery);
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const address = api.address(); assert.ok(address && typeof address !== 'string');
  const get = (suffix = '', options?: RequestInit) => fetch(`http://127.0.0.1:${address.port}${path}${suffix}`, options);
  try {
    const okay = await get();
    assert.equal(okay.status, 200);
    assert.equal(okay.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await okay.arrayBuffer()), image);
    assert.equal((await get('', { headers: { 'if-none-match': `"${imageHash}"` } })).status, 304);
    assert.equal((await get('?token=1')).status, 404);
    assert.equal((await get('', { method: 'HEAD' })).status, 404);
    currentObjectHash = '0'.repeat(64);
    assert.equal((await get()).status, 404, 'replacing the source invalidates the old live thumbnail');
    currentObjectHash = imageHash; revoked = true;
    assert.equal((await get()).status, 404, 'revoked artwork cannot resolve');
    revoked = false;
    const cdnUrl = `https://media.example.org/media/${owner.slice(3)}/${original.id.slice(3)}/${artworkId.slice(3)}/delivery/artwork/${releaseId}/${imageHash}/poster.jpg`;
    const cdnManifest = { ...manifest,
      channel: { ...channel, content: channel.content.map(content => ({ ...content, artwork: cdnUrl })) },
      media: manifest.media.map(media => media.id === artworkId ? { ...media, url: cdnUrl } : media) };
    release.manifest_bytes = canonicalBytes(cdnManifest);
    release.sha256 = digest(release.manifest_bytes);
    const cdnStorage = { publishedArtworkUrl: () => cdnUrl } as unknown as S3MediaStorage;
    const cdnResolver = new PublicReleaseResolver(repository,
      new ManagedArtworkDelivery(pool, store, 'https://studio.example.com', cdnStorage));
    assert.equal((await cdnResolver.release(deploymentId, releaseId)).sha256, release.sha256);
    currentObjectHash = '0'.repeat(64);
    await assert.rejects(cdnResolver.release(deploymentId, releaseId), 'a replaced source cannot resolve old CDN art');
  } finally { await new Promise<void>(resolve => api.close(() => resolve())); }
});
