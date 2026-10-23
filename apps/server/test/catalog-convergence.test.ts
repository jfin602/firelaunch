import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { mediaUseEligible } from '@vegalaunch/contracts';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { CatalogRepository } from '../src/catalog-repository.js';
import { HostedWorkspaceService } from '../src/hosted-workspace.js';
import { PrivateObjectService, type PrivateObjectStore } from '../src/private-objects.js';
import { exportAccount } from '../src/operations.js';

const database = process.env.FIRELAUNCH_TEST_DATABASE_URL;

(database ? test : test.skip)('video, audio and writing catalog paths retain rights, overrides and isolation across restart and export', async () => {
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
    const owner = await identity('convergence-owner');
    const foreign = await identity('convergence-foreign');
    const project = await repository.create(owner, { title: 'Creator catalog' });
    const stored = new Map<string, Buffer>();
    const store: PrivateObjectStore = {
      put: async (key, bytes) => { stored.set(key, bytes); },
      get: async key => stored.get(key)!,
      delete: async key => { stored.delete(key); }
    };
    const objects = new PrivateObjectService(repository, store);
    let feed = JSON.stringify([{ externalId: 'video-1', kind: 'video', title: 'First video' }]);
    const catalog = new CatalogRepository(repository, async endpoint => {
      assert.equal(endpoint, 'https://creator.example/feed'); return feed;
    });
    const addSource = async (type: 'creator_https_feed' | 'creator_csv' | 'creator_json') => {
      const revision = (await catalog.read(owner, project.id)).revision;
      return (await catalog.mutate(owner, project.id, 'sources', 'POST', revision, {
        schemaVersion: 1, type, state: 'discovered',
        ...(type === 'creator_https_feed' ? { endpointUrl: 'https://creator.example/feed' } : {}),
        permission: { retrieval: type === 'creator_https_feed' ? 'creator_asserted' : 'unknown', tvDisplay: 'unknown' }
      })).record!;
    };
    const videoSource = await addSource('creator_https_feed');
    const audioSource = await addSource('creator_csv');
    const writingSource = await addSource('creator_json');
    const audio = 'externalId,kind,title\naudio-1,audio,First audio';
    const writing = JSON.stringify([{ externalId: 'book-1', kind: 'book', title: 'First book' }]);
    const importFile = async (sourceId: string, format: 'csv' | 'json', content: string) => {
      const preview = await catalog.previewImport(owner, project.id, sourceId, format, content);
      assert.deepEqual(preview.issues, []);
      return catalog.approveImport(owner, project.id, sourceId, format, content, preview.revision, preview.fingerprint);
    };
    const videoPreview = await catalog.previewFeed(owner, project.id, videoSource.id);
    assert.equal((await catalog.read(owner, project.id)).items.length, 0);
    assert.equal((await catalog.approveImport(owner, project.id, videoSource.id, 'feed', videoPreview.content,
      videoPreview.revision, videoPreview.fingerprint)).created, 1);
    assert.equal((await importFile(audioSource.id, 'csv', audio)).created, 1);
    assert.equal((await importFile(writingSource.id, 'json', writing)).created, 1);
    let snapshot = await catalog.read(owner, project.id);
    assert.deepEqual(snapshot.items.map(item => item.kind).sort(), ['audio', 'book', 'video']);
    assert.ok(snapshot.items.every(item => item.mediaAssetIds.length === 0 && !item.creatorOverrides));
    const book = snapshot.items.find(item => item.kind === 'book')!;
    const { id: _id, creatorAccountId: _owner, projectId: _project, ...editableBook } = book;
    await catalog.mutate(owner, project.id, 'items', 'PUT', snapshot.revision,
      { ...editableBook, creatorOverrides: { title: 'Creator edition', editedAt: new Date().toISOString() } }, book.id);
    snapshot = await catalog.read(owner, project.id);
    const collection = (await catalog.mutate(owner, project.id, 'collections', 'POST', snapshot.revision,
      { schemaVersion: 1, kind: 'bookshelf', title: 'Read on TV', itemIds: [book.id] })).record!;
    const replacement = JSON.stringify([{ externalId: 'book-1', kind: 'book', title: 'Publisher revised book' }]);
    assert.equal((await importFile(writingSource.id, 'json', replacement)).updated, 1);
    assert.equal((await importFile(writingSource.id, 'json', replacement)).unchanged, 1);
    const repeatFeed = await catalog.previewFeed(owner, project.id, videoSource.id);
    assert.equal((await catalog.approveImport(owner, project.id, videoSource.id, 'feed', repeatFeed.content,
      repeatFeed.revision, repeatFeed.fingerprint)).unchanged, 1);
    feed = JSON.stringify([{ externalId: 'video-1', kind: 'audio', title: 'Wrong kind' }]);
    const ambiguous = await catalog.previewFeed(owner, project.id, videoSource.id);
    assert.deepEqual(ambiguous.issues.map(issue => issue.code), ['AMBIGUOUS']);
    await assert.rejects(catalog.approveImport(owner, project.id, videoSource.id, 'feed', ambiguous.content,
      ambiguous.revision, ambiguous.fingerprint), { code: 'INVALID_INPUT' });
    await assert.rejects(catalog.previewImport(foreign, project.id, writingSource.id, 'json', writing), { code: 'NOT_FOUND' });
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('private cover')]);
    const uploaded = await objects.put(owner, project.id, 'media', 'image/png', png);
    const evidence = await objects.put(owner, project.id, 'evidence', 'application/pdf', Buffer.from('%PDF-1.4\nlicensed\n%%EOF'));
    const display = { status: 'cleared', basis: 'license_documented', permittedUse: 'television_display',
      assertedAt: new Date().toISOString(), evidenceId: evidence.id };
    const unknown = { status: 'unknown', basis: 'none', permittedUse: 'none' };
    snapshot = await catalog.read(owner, project.id);
    const asset = (await catalog.mutate(owner, project.id, 'media-assets', 'POST', snapshot.revision,
      { schemaVersion: 1, catalogItemId: book.id, kind: 'artwork', location: { type: 'private_object', objectId: uploaded.id },
        tvDisplayRights: display, tvPlaybackRights: unknown, deliveryEligible: true })).record!;
    assert.equal(mediaUseEligible(asset as never, 'television_display'), true);
    assert.equal(mediaUseEligible(asset as never, 'television_playback'), false);
    await assert.rejects(objects.metadata(foreign, project.id, uploaded.id), { code: 'NOT_FOUND' });
    const capability = await objects.issueDownload(owner, project.id, uploaded.id);
    await assert.rejects(objects.download(foreign, project.id, uploaded.id, capability.capability), { code: 'NOT_FOUND' });
    await repository.pool.end(); repository = undefined;
    repository = await HostedProjectRepository.connect(url.toString());
    const restarted = new CatalogRepository(repository);
    const persisted = await restarted.read(owner, project.id);
    assert.equal(persisted.items.length, 3);
    assert.equal(persisted.items.find(item => item.id === book.id)?.sourceRecord.metadata.title, 'Publisher revised book');
    assert.equal(persisted.items.find(item => item.id === book.id)?.creatorOverrides?.title, 'Creator edition');
    assert.deepEqual(persisted.collections.find(value => value.id === collection.id)?.itemIds, [book.id]);
    assert.deepEqual(persisted.items.find(item => item.id === book.id)?.mediaAssetIds, [asset.id]);
    assert.equal((await restarted.rightsEvents(owner, project.id, asset.id)).length, 1);
    await assert.rejects(restarted.read(foreign, project.id), { code: 'NOT_FOUND' });
    const workspace = new HostedWorkspaceService(repository);
    await workspace.generate(owner, project.id);
    const exported = await workspace.exportSource(owner, project.id);
    assert.equal(exported.format, 'firelaunch-source-export-v1');
    assert.ok(exported.files['manifest.toml']?.includes('com.amazon.category.main'));
    assert.equal(JSON.stringify(exported).includes(uploaded.id), false);
    assert.equal(JSON.stringify(exported).includes(evidence.id), false);
    const accountExport = await exportAccount(repository.pool, store, owner.accountId);
    const exportedCatalog = accountExport.catalog[0] as { items: { id: string }[]; collections: { id: string }[] };
    assert.equal(exportedCatalog.items.length, 3);
    assert.deepEqual(exportedCatalog.collections.map(value => value.id), [collection.id]);
    assert.equal(accountExport.objects.length, 2);
    assert.equal(JSON.stringify(accountExport).includes('private/'), false);
    assert.deepEqual((await exportAccount(repository.pool, store, foreign.accountId)).catalog, []);
    assert.equal((await workspace.buildStatus(owner, project.id)).status, 'blocked');
    await assert.rejects(workspace.exportSource(foreign, project.id), { code: 'NOT_FOUND' });
  } finally {
    if (repository) await repository.pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
