import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { CatalogRepository } from '../src/catalog-repository.js';
import { CatalogProjectionService } from '../src/catalog-projection.js';
import { MediaPipelineRepository } from '../src/media-pipeline-repository.js';

const base = process.env.FIRELAUNCH_TEST_DATABASE_URL;

(base ? test : test.skip)('private video keeps owned catalog, rights and shelf placement across restart', async () => {
  const admin = new Pool({ connectionString: base });
  const name = `firelaunch_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(base!); url.pathname = `/${name}`;
  await admin.query(`CREATE DATABASE ${name}`);
  let first: HostedProjectRepository | undefined;
  let restarted: HostedProjectRepository | undefined;
  try {
    first = await HostedProjectRepository.connect(url.toString());
    const principal = async (subject: string) => ({
      accountId: await first!.accountForIdentity({ issuer: 'https://issuer.example', subject,
        email: `${subject}@example.com` }), issuer: 'https://issuer.example', subject, email: `${subject}@example.com`
    });
    const owner = await principal('video-placement-owner');
    const foreign = await principal('video-placement-foreign');
    const project = await first.create(owner, { title: 'My channel' });
    const catalog = new CatalogRepository(first);
    const source = (await catalog.mutate(owner, project.id, 'sources', 'POST', 0, {
      schemaVersion: 1, type: 'creator_upload', state: 'discovered',
      permission: { retrieval: 'unknown', tvDisplay: 'unknown' }
    })).record!;
    const externalId = { provider: 'creator', kind: 'upload_id', value: 'a'.repeat(64) } as const;
    const itemInput = { schemaVersion: 1, kind: 'video', sourceRecord: { sourceId: source.id, externalId,
      observedAt: new Date().toISOString(), metadata: { title: 'My film', description: 'Owned video' } },
      externalIdentifiers: [externalId], mediaAssetIds: [] };
    const item = (await catalog.mutate(owner, project.id, 'items', 'POST', 1, itemInput)).record!;
    const collection = (await catalog.mutate(owner, project.id, 'collections', 'POST', 2,
      { schemaVersion: 1, kind: 'series', title: 'Videos', itemIds: [item.id] })).record!;
    const assertedAt = new Date().toISOString();
    const claim = (use: 'television_display' | 'television_playback') =>
      ({ status: 'cleared', basis: 'creator_asserted', permittedUse: use, assertedAt });
    const asset = (await catalog.mutate(owner, project.id, 'media-assets', 'POST', 3, {
      schemaVersion: 1, catalogItemId: item.id, kind: 'video', location: { type: 'managed_hls' },
      tvDisplayRights: claim('television_display'), tvPlaybackRights: claim('television_playback'), deliveryEligible: true
    })).record!;
    const pipeline = new MediaPipelineRepository(first);
    const uploadInput = { idempotencyKey: 'placement-retry-key-001', expectedBytes: 42,
      expectedSha256: 'b'.repeat(64), claimedDurationSeconds: 12, partSize: 8 * 1024 * 1024,
      partCount: 1, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
    const upload = await pipeline.createUpload(owner, project.id, asset.id, uploadInput);
    assert.equal((await pipeline.createUpload(owner, project.id, asset.id, uploadInput)).id, upload.id);
    assert.equal(await pipeline.attachS3Upload(owner, project.id, asset.id, upload.id, 'private-upload-token'), true);
    await pipeline.recordCompletedOriginal(owner, project.id, asset.id, upload.id, 0);
    const subtitleObjectId = `ma_${randomUUID().replaceAll('-', '')}`;
    const subtitleId = `st_${randomUUID().replaceAll('-', '')}`;
    await first.pool.query(`INSERT INTO private_objects(id, creator_account_id, project_id, kind, object_key, content_type, byte_size, sha256)
      VALUES ($1,$2,$3,'media',$4,'text/vtt',24,$5)`, [subtitleObjectId, owner.accountId, project.id,
      `private/${randomUUID().replaceAll('-', '').padEnd(64, '0')}`, 'c'.repeat(64)]);
    await first.pool.query(`INSERT INTO video_subtitle_tracks(id, creator_account_id, project_id, item_id, video_asset_id,
      object_id, language, byte_size, sha256, version, state) VALUES ($1,$2,$3,$4,$5,$6,'en',24,$7,1,'removed')`,
    [subtitleId, owner.accountId, project.id, item.id, asset.id, subtitleObjectId, 'c'.repeat(64)]);
    const nextId = { provider: 'creator', kind: 'upload_id', value: 'd'.repeat(64) } as const;
    const nextItem = (await catalog.mutate(owner, project.id, 'items', 'POST', 4, {
      ...itemInput, sourceRecord: { ...itemInput.sourceRecord, externalId: nextId, metadata: { title: 'Next film' } },
      externalIdentifiers: [nextId]
    })).record!;
    assert.equal((await first.pool.query('SELECT count(*)::int AS count FROM video_subtitle_tracks WHERE id = $1',
      [subtitleId])).rows[0].count, 1, 'retained subtitle history remains linked');
    await assert.rejects(catalog.mutate(owner, project.id, 'items', 'POST', 5, itemInput), { code: 'INVALID_INPUT' });
    await assert.rejects(catalog.mutate(foreign, project.id, 'collections', 'POST', 5,
      { schemaVersion: 1, kind: 'series', title: 'Foreign', itemIds: [item.id] }), { code: 'NOT_FOUND' });
    await first.pool.end(); first = undefined;

    restarted = await HostedProjectRepository.connect(url.toString());
    const after = new CatalogRepository(restarted);
    const stored = await after.read(owner, project.id);
    assert.equal(stored.items.length, 2);
    assert.equal(stored.mediaAssets.length, 1);
    assert.equal(stored.collections.length, 1);
    const storedFilm = stored.items.find(value => value.id === item.id);
    assert.equal(storedFilm?.projectId, project.id);
    assert.equal(storedFilm?.sourceRecord.metadata.title, 'My film');
    assert.equal(storedFilm?.sourceRecord.metadata.description, 'Owned video');
    assert.deepEqual(storedFilm?.mediaAssetIds, [asset.id]);
    assert.deepEqual(stored.collections[0]?.itemIds, [item.id]);
    assert.equal(stored.items.find(value => value.id === nextItem.id)?.sourceRecord.sourceId, source.id);
    assert.equal(stored.collections[0]?.title, 'Videos');
    assert.equal(stored.collections[0]?.projectId, project.id);
    assert.equal(stored.mediaAssets[0]?.tvDisplayRights?.status, 'cleared');
    assert.equal(stored.mediaAssets[0]?.tvPlaybackRights?.status, 'cleared');
    assert.equal((await after.rightsEvents(owner, project.id, asset.id)).length, 1);
    assert.equal((await new MediaPipelineRepository(restarted).upload(owner, project.id, asset.id, upload.id)).state, 'completed');
    await assert.rejects(after.read(foreign, project.id), { code: 'NOT_FOUND' });
    await assert.rejects(new MediaPipelineRepository(restarted).upload(foreign, project.id, asset.id, upload.id), { code: 'NOT_FOUND' });
    const projection = await new CatalogProjectionService(restarted, after).project(owner, project.id, {
      expectedProjectRevision: project.revision, expectedCatalogRevision: stored.revision,
      itemIds: [], collectionIds: [collection.id]
    });
    assert.equal(projection.bindings[0]?.catalogItemId, item.id);
    assert.equal(projection.bindings[0]?.baseline, null, 'private upload cannot enter playable ChannelSpec');
  } finally {
    await first?.pool.end();
    await restarted?.pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
