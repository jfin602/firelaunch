import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool } from 'pg';
import { CatalogRepository } from '../src/catalog-repository.js';
import { CatalogProjectionService } from '../src/catalog-projection.js';
import { HostedProjectRepository } from '../src/hosted-repository.js';

const database = process.env.FIRELAUNCH_TEST_DATABASE_URL;

(database ? test : test.skip)('projection enforces owner, review, selection, rights, stable bindings and revision checks', async () => {
  const admin = new Pool({ connectionString: database });
  const name = `firelaunch_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(database!); url.pathname = `/${name}`;
  await admin.query(`CREATE DATABASE ${name}`);
  let repository: HostedProjectRepository | undefined;
  try {
    repository = await HostedProjectRepository.connect(url.toString());
    const identity = async (subject: string) => ({
      accountId: await repository!.accountForIdentity({ issuer: 'https://issuer.example', subject, email: `${subject}@example.com` }),
      issuer: 'https://issuer.example', subject, email: `${subject}@example.com`
    });
    const owner = await identity('projection-a');
    const foreign = await identity('projection-b');
    const project = await repository.create(owner, { title: 'Projected catalog' });
    const otherProject = await repository.create(foreign, { title: 'Foreign catalog' });
    const catalog = new CatalogRepository(repository);
    const projection = new CatalogProjectionService(repository, catalog);
    const sourceRecord = { schemaVersion: 1, type: 'creator_json', state: 'discovered',
      permission: { retrieval: 'unknown', tvDisplay: 'unknown' } };
    const source = (await catalog.mutate(owner, project.id, 'sources', 'POST', 0, sourceRecord)).record!;
    const foreignSource = (await catalog.mutate(foreign, otherProject.id, 'sources', 'POST', 0, sourceRecord)).record!;
    const content = JSON.stringify([
      { externalId: 'book-1', kind: 'book', title: 'Source title', description: 'Source description' },
      { externalId: 'video-1', kind: 'video', title: 'Film' }
    ]);
    const preview = await catalog.previewImport(owner, project.id, source.id, 'json', content);
    assert.equal((await catalog.read(owner, project.id)).items.length, 0);
    await catalog.approveImport(owner, project.id, source.id, 'json', content, preview.revision, preview.fingerprint);
    let inventory = await catalog.read(owner, project.id);
    const book = inventory.items.find(item => item.kind === 'book')!;
    const video = inventory.items.find(item => item.kind === 'video')!;
    const foreignItem = (await catalog.mutate(foreign, otherProject.id, 'items', 'POST', 1, {
      schemaVersion: 1, kind: 'book', sourceRecord: { sourceId: foreignSource.id,
        externalId: { provider: 'creator', kind: 'feed_item_id', value: 'foreign' },
        observedAt: '2026-10-10T00:00:00.000Z', metadata: { title: 'Foreign' } },
      externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'foreign' }], mediaAssetIds: []
    })).record!;
    const choose = (itemIds: string[], collectionIds: string[] = []) => ({
      expectedProjectRevision: project.revision, expectedCatalogRevision: inventory.revision, itemIds, collectionIds
    });
    await assert.rejects(projection.project(foreign, project.id, choose([book.id])), { code: 'NOT_FOUND' });
    await assert.rejects(projection.project({ ...foreign, accountId: owner.accountId }, project.id, choose([book.id])), { code: 'NOT_FOUND' });
    await assert.rejects(projection.project(owner, project.id, choose([foreignItem.id])), { code: 'NOT_FOUND' });
    await assert.rejects(projection.project(owner, project.id, choose([`ci_${'f'.repeat(32)}`])), { code: 'NOT_FOUND' });
    await assert.rejects(projection.project(owner, project.id, choose([], [foreignSource.id])), { name: 'ZodError' });
    const unreviewed = (await catalog.mutate(owner, project.id, 'items', 'POST', inventory.revision, {
      schemaVersion: 1, kind: 'book', sourceRecord: { sourceId: source.id,
        externalId: { provider: 'creator', kind: 'feed_item_id', value: 'new-entry' },
        observedAt: '2026-10-10T00:00:00.000Z', metadata: { title: 'Creator entry' } },
      externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'new-entry' }], mediaAssetIds: []
    })).record!;
    inventory = await catalog.read(owner, project.id);
    assert.equal((await projection.project(owner, project.id, choose([unreviewed.id]))).bindings[0]?.baseline?.presentation, 'information');
    const editable = (({ id: _id, creatorAccountId: _owner, projectId: _project, ...rest }) => rest)(book);
    await catalog.mutate(owner, project.id, 'items', 'PUT', inventory.revision,
      { ...editable, creatorOverrides: { title: 'Creator title', description: 'Creator description', editedAt: '2026-10-10T00:00:00.000Z' } }, book.id);
    inventory = await catalog.read(owner, project.id);
    const collection = (await catalog.mutate(owner, project.id, 'collections', 'POST', inventory.revision,
      { schemaVersion: 1, kind: 'bookshelf', title: 'Shelf', itemIds: [book.id] })).record!;
    inventory = await catalog.read(owner, project.id);
    const selected = await projection.project(owner, project.id, choose([book.id, video.id], [collection.id]));
    assert.equal(selected.bindings.length, 2, 'selection and collection membership deduplicate');
    assert.equal(selected.bindings[0]?.baseline?.title, 'Creator title');
    assert.equal(selected.bindings[0]?.baseline?.description, 'Creator description');
    assert.equal(selected.bindings[0]?.baseline?.presentation, 'information');
    assert.equal(selected.bindings[0]?.baseline?.mediaUrl, undefined);
    assert.equal(selected.bindings[1]?.baseline, null, 'video needs cleared playback');
    assert.equal(selected.bindings[1]?.blockedReason, 'playback_rights_or_delivery_missing');
    assert.equal(selected.collections[0]?.contentIds[0], selected.bindings[0]?.contentId);
    assert.deepEqual(await projection.project(owner, project.id, choose([book.id, video.id], [collection.id])), selected);
    assert.equal(JSON.stringify(selected).includes('video-1'), false, 'external source identity is not projected');
    for (const privateField of ['creatorAccountId', 'sourceRecord', 'externalIdentifiers', 'mediaAssetIds', 'evidenceId', 'objectId']) {
      assert.equal(JSON.stringify(selected).includes(privateField), false, `${privateField} is not projected`);
    }

    const unknown = { status: 'unknown', basis: 'none', permittedUse: 'none' };
    const playback = { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_playback', assertedAt: '2026-10-10T00:00:00.000Z' };
    const display = { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt: '2026-10-10T00:00:00.000Z' };
    const signed = (await catalog.mutate(owner, project.id, 'media-assets', 'POST', inventory.revision, {
      schemaVersion: 1, catalogItemId: book.id, kind: 'artwork',
      location: { type: 'https', url: 'https://media.example/cover.jpg?X-Amz-Signature=private' },
      tvDisplayRights: display, tvPlaybackRights: unknown, deliveryEligible: true
    })).record!;
    inventory = await catalog.read(owner, project.id);
    const draft = await projection.project(owner, project.id, choose([book.id]));
    assert.equal(draft.bindings[0]?.baseline?.artwork, 'assets/catalog-placeholder.png');
    assert.equal(JSON.stringify(draft).includes('X-Amz-Signature'), false);
    const pending = (await catalog.mutate(owner, project.id, 'media-assets', 'POST', inventory.revision, {
      schemaVersion: 1, catalogItemId: video.id, kind: 'video', location: { type: 'https', url: 'https://media.example/film.mp4' },
      tvDisplayRights: unknown, tvPlaybackRights: unknown, deliveryEligible: false
    })).record!;
    inventory = await catalog.read(owner, project.id);
    assert.equal((await projection.project(owner, project.id, choose([video.id]))).bindings[0]?.baseline, null);
    const assetBody = (({ id: _id, creatorAccountId: _owner, projectId: _project, ...rest }) => rest)(pending);
    await catalog.mutate(owner, project.id, 'media-assets', 'PUT', inventory.revision,
      { ...assetBody, tvPlaybackRights: playback, deliveryEligible: true }, pending.id);
    inventory = await catalog.read(owner, project.id);
    const playable = await projection.project(owner, project.id, choose([video.id]));
    assert.equal(playable.bindings[0]?.baseline?.mediaUrl, 'https://media.example/film.mp4');
    assert.equal(playable.bindings[0]?.baseline?.presentation, 'video');
    assert.equal(playable.bindings[0]?.contentId, selected.bindings[1]?.contentId);
    await assert.rejects(projection.project(owner, project.id, { ...choose([video.id]), expectedCatalogRevision: inventory.revision - 1 }), { code: 'CONFLICT' });
    await assert.rejects(projection.project(owner, project.id, { ...choose([video.id]), expectedProjectRevision: project.revision + 1 }), { code: 'CONFLICT' });
    await catalog.mutate(owner, project.id, 'media-assets', 'PUT', inventory.revision,
      { ...assetBody, tvPlaybackRights: { status: 'revoked', basis: 'creator_asserted', permittedUse: 'television_playback' }, deliveryEligible: false }, pending.id);
    inventory = await catalog.read(owner, project.id);
    assert.equal((await projection.project(owner, project.id, choose([video.id]))).bindings[0]?.baseline, null);
    assert.equal((await catalog.read(owner, project.id)).items.find(item => item.id === book.id)?.sourceRecord.metadata.title, 'Source title');
    assert.equal((await repository.read(owner, project.id)).revision, project.revision, 'projection never mutates ChannelSpec');
    assert.equal((await catalog.read(owner, project.id)).mediaAssets.find(asset => asset.id === signed.id)?.location.type, 'https');
    // A pre-migration item without a durable approval record must be reviewed again.
    await repository.pool.query('DELETE FROM catalog_item_approvals WHERE item_id = $1 AND project_id = $2 AND creator_account_id = $3',
      [book.id, project.id, owner.accountId]);
    await assert.rejects(projection.project(owner, project.id, choose([book.id])), { code: 'NOT_FOUND' });
    const rereview = await catalog.previewImport(owner, project.id, source.id, 'json', content);
    const approvedAgain = await catalog.approveImport(owner, project.id, source.id, 'json', content, rereview.revision, rereview.fingerprint);
    assert.equal(approvedAgain.revision, inventory.revision + 1);
    inventory = await catalog.read(owner, project.id);
    assert.equal((await projection.project(owner, project.id, choose([book.id]))).bindings[0]?.baseline?.title, 'Creator title');
    const storedSource = inventory.sources.find(value => value.id === source.id)!;
    const sourceBody = (({ id: _id, creatorAccountId: _owner, projectId: _project, ...rest }) => rest)(storedSource);
    await catalog.mutate(owner, project.id, 'sources', 'PUT', inventory.revision,
      { ...sourceBody, permission: { retrieval: 'revoked', tvDisplay: 'revoked' } }, source.id);
    inventory = await catalog.read(owner, project.id);
    assert.equal((await projection.project(owner, project.id, choose([book.id]))).bindings[0]?.blockedReason, 'source_revoked');
  } finally {
    await repository?.pool.end();
    // The repository pool is closed above; a normal DROP catches leaked clients
    // instead of terminating an in-flight assertion after the test returns.
    await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  }
});
