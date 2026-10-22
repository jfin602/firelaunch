import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { CatalogRepository } from '../src/catalog-repository.js';
import { PrivateObjectService, type PrivateObjectStore } from '../src/private-objects.js';
import { mediaUseEligible } from '@firelaunch/contracts';

const baseUrl = process.env.FIRELAUNCH_TEST_DATABASE_URL;
const databaseTest = baseUrl ? test : test.skip;

databaseTest('catalog SQL ownership, revisions, references and rollback with two creators', async () => {
  const admin = new Pool({ connectionString: baseUrl });
  const name = `firelaunch_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(baseUrl!); url.pathname = `/${name}`;
  await admin.query(`CREATE DATABASE ${name}`);
  let first: HostedProjectRepository | undefined;
  let second: HostedProjectRepository | undefined;
  try {
    first = await HostedProjectRepository.connect(url.toString());
    second = await HostedProjectRepository.connect(url.toString());
    const identity = async (repository: HostedProjectRepository, subject: string) => ({
      accountId: await repository.accountForIdentity({ issuer: 'https://issuer.example', subject, email: `${subject}@example.com` }),
      issuer: 'https://issuer.example', subject, email: `${subject}@example.com`
    });
    const a = await identity(first, 'catalog-a');
    const b = await identity(first, 'catalog-b');
    const aProject = await first.create(a, { title: 'Books' });
    const bProject = await first.create(b, { title: 'Other books' });
    const one = new CatalogRepository(first);
    const two = new CatalogRepository(second);
    const source = { schemaVersion: 1, type: 'creator_json', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } };
    const aSource = (await one.mutate(a, aProject.id, 'sources', 'POST', 0, source)).record!;
    const bSource = (await two.mutate(b, bProject.id, 'sources', 'POST', 0, source)).record!;
    assert.equal((await one.read(a, aProject.id)).revision, 1);
    await assert.rejects(two.read(b, aProject.id), { code: 'NOT_FOUND' });
    await assert.rejects(two.read({ ...b, accountId: a.accountId }, aProject.id), { code: 'NOT_FOUND' });
    await assert.rejects(two.mutate(b, aProject.id, 'sources', 'POST', 1, source), { code: 'NOT_FOUND' });
    const book = (sourceId: string, value: string) => ({ schemaVersion: 1, kind: 'book',
      sourceRecord: { sourceId, externalId: { provider: 'creator', kind: 'feed_item_id', value },
        observedAt: '2026-10-10T00:00:00.000Z', metadata: { title: 'A novel' } },
      externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value }], mediaAssetIds: [] });
    await assert.rejects(one.mutate(a, aProject.id, 'items', 'POST', 1, book(bSource.id, 'foreign')), { code: 'INVALID_INPUT' });
    assert.deepEqual((await one.read(a, aProject.id)).items, [], 'foreign reference rolled back');
    const aBook = (await one.mutate(a, aProject.id, 'items', 'POST', 1, book(aSource.id, 'novel-1'))).record!;
    assert.equal((aBook as { kind: string }).kind, 'book');
    assert.deepEqual((aBook as { mediaAssetIds: string[] }).mediaAssetIds, []);
    const revision = (await one.read(a, aProject.id)).revision;
    const outcomes = await Promise.allSettled([
      one.mutate(a, aProject.id, 'items', 'POST', revision, book(aSource.id, 'novel-2')),
      two.mutate(a, aProject.id, 'items', 'POST', revision, book(aSource.id, 'novel-3'))
    ]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(result => result.status === 'rejected' && result.reason?.code === 'CONFLICT').length, 1);
    const afterRace = await one.read(a, aProject.id);
    assert.equal(afterRace.items.length, 2);
    await assert.rejects(one.mutate(a, aProject.id, 'items', 'POST', afterRace.revision, book(aSource.id, 'novel-1')), { code: 'INVALID_INPUT' });
    assert.equal((await one.read(a, aProject.id)).revision, afterRace.revision, 'duplicate rolled back without increment');
    await assert.rejects(one.mutate(a, aProject.id, 'collections', 'POST', afterRace.revision,
      { schemaVersion: 1, kind: 'bookshelf', title: 'Foreign', itemIds: [`ci_${'f'.repeat(32)}`] }), { code: 'INVALID_INPUT' });
    const collection = (await one.mutate(a, aProject.id, 'collections', 'POST', afterRace.revision,
      { schemaVersion: 1, kind: 'bookshelf', title: 'Reading', itemIds: [aBook.id] })).record!;
    await assert.rejects(one.mutate(a, aProject.id, 'items', 'DELETE', afterRace.revision + 1, undefined, aBook.id), { code: 'INVALID_INPUT' });
    assert.equal((await one.read(a, aProject.id)).collections[0]?.id, collection.id);
    const asset = (await one.mutate(a, aProject.id, 'media-assets', 'POST', afterRace.revision + 1,
      { schemaVersion: 1, catalogItemId: aBook.id, kind: 'artwork', location: { type: 'https', url: 'https://example.com/cover.jpg' },
        rights: { status: 'unknown', basis: 'none', permittedUse: 'none' }, deliveryEligible: false })).record!;
    assert.deepEqual((await one.read(a, aProject.id)).items.find(item => item.id === aBook.id)?.mediaAssetIds, [asset.id]);
    const stored = new Map<string, Buffer>();
    const store: PrivateObjectStore = { put: async (key, bytes) => { stored.set(key, bytes); },
      get: async key => stored.get(key)!, delete: async key => { stored.delete(key); } };
    const privateObjects = new PrivateObjectService(first, store);
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('creator artwork')]);
    const upload = await privateObjects.put(a, aProject.id, 'media', 'image/png', png);
    const audioUpload = await privateObjects.put(a, aProject.id, 'media', 'audio/mpeg', Buffer.from('ID3creator audio'));
    const evidence = await privateObjects.put(a, aProject.id, 'evidence', 'application/pdf', Buffer.from('%PDF-1.4\ncreator consent\n%%EOF'));
    const foreignUpload = await privateObjects.put(b, bProject.id, 'media', 'image/png', png);
    const foreignEvidenceObject = await privateObjects.put(b, bProject.id, 'evidence', 'application/pdf', Buffer.from('%PDF-1.4\nforeign\n%%EOF'));
    const unknown = { status: 'unknown', basis: 'none', permittedUse: 'none' };
    const display = { status: 'cleared', basis: 'license_documented', permittedUse: 'television_display',
      assertedAt: '2026-10-10T00:00:00.000Z', evidenceId: evidence.id };
    const attachment = { schemaVersion: 1, catalogItemId: aBook.id, kind: 'artwork',
      location: { type: 'private_object', objectId: upload.id }, tvDisplayRights: display, tvPlaybackRights: unknown, deliveryEligible: true };
    const mediaRevision = (await one.read(a, aProject.id)).revision;
    await assert.rejects(one.mutate(a, aProject.id, 'media-assets', 'POST', mediaRevision,
      { ...attachment, location: { type: 'private_object', objectId: foreignUpload.id } }), { code: 'INVALID_INPUT' });
    await assert.rejects(one.mutate(a, aProject.id, 'media-assets', 'POST', mediaRevision,
      { ...attachment, location: { type: 'private_object', objectId: audioUpload.id } }), { code: 'INVALID_INPUT' });
    await assert.rejects(one.mutate(a, aProject.id, 'media-assets', 'POST', mediaRevision,
      { ...attachment, tvDisplayRights: { ...display, evidenceId: foreignEvidenceObject.id } }), { code: 'INVALID_INPUT' });
    assert.equal((await one.read(a, aProject.id)).revision, mediaRevision);
    const attached = (await one.mutate(a, aProject.id, 'media-assets', 'POST', mediaRevision, attachment)).record!;
    assert.equal(mediaUseEligible(attached as never, 'television_display'), true);
    assert.equal(mediaUseEligible(attached as never, 'television_playback'), false);
    assert.equal(JSON.stringify(attached).includes('private/'), false);
    assert.equal(JSON.stringify(attached).includes('creator consent'), false);
    const events = await one.rightsEvents(a, aProject.id, attached.id);
    assert.equal(events.length, 1);
    assert.equal(JSON.stringify(events).includes('private/'), false);
    await assert.rejects(two.rightsEvents(b, aProject.id, attached.id), { code: 'NOT_FOUND' });
    await assert.rejects(privateObjects.delete(a, aProject.id, upload.id), { code: 'STORAGE_ERROR' });
    const capability = await privateObjects.issueDownload(a, aProject.id, upload.id);
    await privateObjects.revoke(a, aProject.id, upload.id);
    await assert.rejects(privateObjects.download(a, aProject.id, upload.id, capability.capability), { code: 'NOT_FOUND' });
    const revoked = { ...attachment, tvDisplayRights: { ...display, status: 'revoked' }, deliveryEligible: false };
    await one.mutate(a, aProject.id, 'media-assets', 'PUT', mediaRevision + 1, revoked, attached.id);
    const afterRevoke = (await one.read(a, aProject.id)).mediaAssets.find(value => value.id === attached.id)!;
    assert.equal(mediaUseEligible(afterRevoke, 'television_display'), false);
    assert.equal((await one.rightsEvents(a, aProject.id, attached.id)).length, 2);
    const removeRevision = (await one.read(a, aProject.id)).revision;
    await one.mutate(a, aProject.id, 'media-assets', 'DELETE', removeRevision, undefined, attached.id);
    await privateObjects.delete(a, aProject.id, upload.id);
    const audioRevision = (await one.read(a, aProject.id)).revision;
    const bookAudio = (await one.mutate(a, aProject.id, 'media-assets', 'POST', audioRevision, {
      schemaVersion: 1, catalogItemId: aBook.id, kind: 'audio',
      location: { type: 'private_object', objectId: audioUpload.id },
      tvDisplayRights: unknown, tvPlaybackRights: unknown, deliveryEligible: false
    })).record!;
    const beforeBinding = await one.read(a, aProject.id);
    const boundBook = beforeBinding.items.find(item => item.id === aBook.id)!;
    const { id: _bookId, creatorAccountId: _bookOwner, projectId: _bookProject, ...bookRecord } = boundBook;
    await one.mutate(a, aProject.id, 'items', 'PUT', beforeBinding.revision,
      { ...bookRecord, audiobook: { audioAssetId: bookAudio.id } }, aBook.id);
    const beforeAudioRemoval = await one.read(a, aProject.id);
    assert.equal(beforeAudioRemoval.items.find(item => item.id === aBook.id)?.audiobook?.audioAssetId, bookAudio.id);
    await one.mutate(a, aProject.id, 'media-assets', 'DELETE', beforeAudioRemoval.revision, undefined, bookAudio.id);
    const afterAudioRemoval = await one.read(a, aProject.id);
    assert.equal(afterAudioRemoval.items.find(item => item.id === aBook.id)?.audiobook, undefined);
    assert.equal(afterAudioRemoval.items.find(item => item.id === aBook.id)?.mediaAssetIds.includes(bookAudio.id), false);
    assert.equal(afterAudioRemoval.items.find(item => item.id === aBook.id)?.mediaAssetIds.includes(asset.id), true,
      'removing audiobook keeps the book cover');
    assert.equal([...stored.values()].some(value => value.equals(png)), true, 'foreign upload remains private');
    await assert.rejects(two.mutate(b, bProject.id, 'media-assets', 'POST', 1,
      { schemaVersion: 1, catalogItemId: aBook.id, kind: 'artwork', location: { type: 'https', url: 'https://example.com/cover.jpg' },
        rights: { status: 'unknown', basis: 'none', permittedUse: 'none' }, deliveryEligible: false }), { code: 'INVALID_INPUT' });
    assert.equal((await second.pool.query('SELECT count(*)::int AS count FROM catalog_item_identifiers WHERE item_id = $1', [aBook.id])).rows[0].count, 1);
    const otherBook = (await one.read(a, aProject.id)).items.find(item => item.id !== aBook.id)!;
    await assert.rejects(second.pool.query('INSERT INTO catalog_item_identifiers(source_id, project_id, creator_account_id, item_id, provider, marketplace, kind, value) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [aSource.id, aProject.id, a.accountId, otherBook.id, 'creator', '', 'feed_item_id', 'novel-1']), { code: '23505' });
    const foreignEvidence = `ev_${randomUUID().replaceAll('-', '')}`;
    await assert.rejects(second.pool.query('INSERT INTO private_objects(id, creator_account_id, project_id, kind, object_key, content_type, byte_size, sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [`ev_${randomUUID().replaceAll('-', '')}`, b.accountId, bProject.id, 'media', `private/${'d'.repeat(64)}`, 'image/png', 1, 'c'.repeat(64)]), { code: '23514' });
    await second.pool.query('INSERT INTO private_objects(id, creator_account_id, project_id, kind, object_key, content_type, byte_size, sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [foreignEvidence, b.accountId, bProject.id, 'evidence', `private/${'b'.repeat(64)}`, 'application/pdf', 1, 'c'.repeat(64)]);
    const beforeEvidence = (await one.read(a, aProject.id)).revision;
    await assert.rejects(one.mutate(a, aProject.id, 'sources', 'POST', beforeEvidence,
      { schemaVersion: 1, type: 'creator_json', state: 'verified',
        permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted', verificationEvidenceId: foreignEvidence } }), { code: 'INVALID_INPUT' });
    assert.equal((await one.read(a, aProject.id)).revision, beforeEvidence, 'foreign evidence rolled back');
    const keyedSource = { ...source, externalIdentity: { provider: 'creator', kind: 'feed_item_id', value: 'file-one' } };
    await one.mutate(a, aProject.id, 'sources', 'POST', beforeEvidence, keyedSource);
    await assert.rejects(one.mutate(a, aProject.id, 'sources', 'POST', beforeEvidence + 1, keyedSource), { code: 'CONFLICT' });
    assert.equal((await one.read(a, aProject.id)).revision, beforeEvidence + 1, 'duplicate source identity rolled back');
    await first.pool.end(); first = undefined;
    const restarted = await HostedProjectRepository.connect(url.toString()); first = restarted;
    assert.equal((await new CatalogRepository(restarted).read(a, aProject.id)).mediaAssets[0]?.id, asset.id);
    await assert.rejects(restarted.pool.query('INSERT INTO catalog_items(id, project_id, creator_account_id, source_id, record) VALUES ($1,$2,$3,$4,$5::jsonb)',
      [`ci_${'f'.repeat(32)}`, aProject.id, a.accountId, bSource.id, JSON.stringify({ id: `ci_${'f'.repeat(32)}`, projectId: aProject.id, creatorAccountId: a.accountId, schemaVersion: 1, sourceRecord: { sourceId: bSource.id } })]), { code: '23503' });
  } finally {
    if (first) await first.pool.end();
    if (second) await second.pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
