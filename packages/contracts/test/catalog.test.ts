import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CATALOG_SCHEMA_VERSION, catalogInventorySchema, catalogItemSchema, catalogSourceSchema,
  collectionSchema, externalIdentifierSchema, mediaAssetSchema, mediaRightsSchema,
  type CatalogInventory
} from '../src/index.js';

const hex = (digit: string) => digit.repeat(32);
const creatorAccountId = `cr_${hex('a')}`;
const projectId = `ch_${hex('b')}`;
const timestamp = '2026-10-09T00:00:00.000Z';
const scope = { creatorAccountId, projectId };
const creatorId = (kind: 'feed_item_id' | 'upload_id', value: string) => ({ provider: 'creator' as const, kind, value });
const amazonId = (kind: 'asin' | 'sku' | 'seller_id', value: string) =>
  ({ provider: 'amazon' as const, marketplace: 'US', kind, value });
const permission = { retrieval: 'creator_asserted' as const, tvDisplay: 'creator_asserted' as const, verificationEvidenceId: `ev_${hex('e')}` };
const source = (id: string, type: 'creator_csv' | 'creator_json' | 'creator_https_feed' | 'creator_upload', state: 'discovered' | 'verified' | 'syncing' = 'verified') => ({
  schemaVersion: CATALOG_SCHEMA_VERSION, id, ...scope, type, state,
  ...(type === 'creator_https_feed' ? { endpointUrl: 'https://creator.example.com/catalog.json' } : {}),
  permission: state === 'discovered' ? { retrieval: 'unknown' as const, tvDisplay: 'unknown' as const } : permission
});
const item = (id: string, sourceId: string, kind: 'video' | 'audio' | 'book' | 'listing', externalId: ReturnType<typeof creatorId>, title: string) => ({
  schemaVersion: CATALOG_SCHEMA_VERSION, id, ...scope, kind,
  sourceRecord: { sourceId, externalId, observedAt: timestamp, metadata: { title } },
  externalIdentifiers: [externalId], mediaAssetIds: [] as string[]
});
const clearedRights = { status: 'cleared' as const, basis: 'creator_asserted' as const,
  permittedUse: 'television_playback' as const, assertedAt: timestamp };
const asset = (id: string, catalogItemId: string, kind: 'video' | 'audio') => ({
  schemaVersion: CATALOG_SCHEMA_VERSION, id, ...scope, catalogItemId, kind,
  location: { type: 'https' as const, url: 'https://media.example.com/creator-owned.mp4' },
  rights: clearedRights, deliveryEligible: true
});

const videoSource = source(`src_${hex('1')}`, 'creator_https_feed', 'syncing');
const audioSource = source(`src_${hex('2')}`, 'creator_json');
const writingSource = source(`src_${hex('3')}`, 'creator_csv');
const video = { ...item(`ci_${hex('1')}`, videoSource.id, 'video', creatorId('feed_item_id', 'film-1'), 'Forest Film'), mediaAssetIds: [`ma_${hex('1')}`] };
const audio = { ...item(`ci_${hex('2')}`, audioSource.id, 'audio', creatorId('feed_item_id', 'episode-1'), 'Field Recording'), mediaAssetIds: [`ma_${hex('2')}`] };
const book = { ...item(`ci_${hex('3')}`, writingSource.id, 'book', creatorId('feed_item_id', 'book-1'), 'Forest Essays'),
  creatorOverrides: { title: 'Forest Essays: TV Edition', editedAt: timestamp } };
const videoAsset = asset(`ma_${hex('1')}`, video.id, 'video');
const audioAsset = { ...asset(`ma_${hex('2')}`, audio.id, 'audio'), location: { type: 'upload' as const, key: 'media/audio/episode.mp3' } };
const shelf = { schemaVersion: CATALOG_SCHEMA_VERSION, id: `col_${hex('1')}`, ...scope,
  kind: 'bookshelf' as const, title: 'Reading Room', itemIds: [book.id] };
const inventory = (): CatalogInventory => ({
  schemaVersion: CATALOG_SCHEMA_VERSION, ...scope, sources: [videoSource, audioSource, writingSource], items: [video, audio, book],
  mediaAssets: [videoAsset, audioAsset], collections: [shelf]
});

test('video, audio and writing inventory parses; book has no playable media', () => {
  const parsed = catalogInventorySchema.parse(inventory());
  assert.equal(parsed.items.length, 3);
  assert.deepEqual(parsed.items[2].mediaAssetIds, []);
  assert.equal(parsed.items[2].sourceRecord.metadata.title, 'Forest Essays');
  assert.equal(parsed.items[2].creatorOverrides?.title, 'Forest Essays: TV Edition');
  assert.equal(parsed.mediaAssets.length, 2);
});

test('source matching and namespaced identifiers do not confer permission', () => {
  const discovered = source(`src_${hex('4')}`, 'creator_upload', 'discovered');
  assert.equal(catalogSourceSchema.safeParse(discovered).success, true);
  assert.equal(catalogSourceSchema.safeParse({ ...discovered, state: 'syncing' }).success, false);
  assert.equal(catalogSourceSchema.safeParse({ ...writingSource, state: 'syncing' }).success, false);
  const clue = amazonId('asin', 'B012345678');
  assert.equal(externalIdentifierSchema.safeParse(clue).success, true);
  const amazonSource = { ...discovered, type: 'amazon_seller', externalIdentity: amazonId('seller_id', 'SELLER1') };
  assert.equal(catalogSourceSchema.safeParse(amazonSource).success, true);
  assert.equal(catalogSourceSchema.safeParse({ ...amazonSource, state: 'verified', permission }).success, false);
  assert.equal(externalIdentifierSchema.safeParse({ ...clue, marketplace: undefined }).success, false);
  assert.equal(externalIdentifierSchema.safeParse({ ...clue, provider: 'creator' }).success, false);
  const listing = { ...item(`ci_${hex('5')}`, writingSource.id, 'listing', creatorId('feed_item_id', 'listing-1'), 'Synthetic listing'),
    externalIdentifiers: [creatorId('feed_item_id', 'listing-1'), clue] };
  assert.equal(catalogItemSchema.safeParse(listing).success, true);
  assert.deepEqual(listing.mediaAssetIds, []);
});

test('catalog records are strict, bounded and versioned', () => {
  assert.equal(catalogSourceSchema.safeParse({ ...videoSource, accessToken: 'secret' }).success, false);
  assert.equal(catalogSourceSchema.safeParse({ ...videoSource, schemaVersion: 2 }).success, false);
  assert.equal(catalogInventorySchema.safeParse({ ...inventory(), schemaVersion: 2 }).success, false);
  assert.equal(catalogItemSchema.safeParse({ ...video, rawAmazonPayload: {} }).success, false);
  assert.equal(catalogItemSchema.safeParse({ ...video, sourceRecord: { ...video.sourceRecord, privatePayload: {} } }).success, false);
  assert.equal(catalogItemSchema.safeParse({ ...video, sourceRecord: { ...video.sourceRecord, metadata: { ...video.sourceRecord.metadata, title: 'x'.repeat(161) } } }).success, false);
  assert.equal(catalogItemSchema.safeParse({ ...video, creatorOverrides: { editedAt: timestamp } }).success, false);
  assert.equal(mediaAssetSchema.safeParse({ ...videoAsset, privateKey: 'secret' }).success, false);
  assert.equal(mediaAssetSchema.safeParse({ ...videoAsset, rights: { ...clearedRights, listingLicense: true } }).success, false);
  assert.equal(collectionSchema.safeParse({ ...shelf, script: 'evil' }).success, false);
});

test('inventory rejects duplicate IDs and duplicate source records', () => {
  const base = inventory();
  assert.equal(catalogInventorySchema.safeParse({ ...base, sources: [...base.sources, base.sources[0]] }).success, false);
  assert.equal(catalogInventorySchema.safeParse({ ...base, items: [...base.items, base.items[0]] }).success, false);
  assert.equal(catalogInventorySchema.safeParse({ ...base, mediaAssets: [...base.mediaAssets, base.mediaAssets[0]] }).success, false);
  assert.equal(catalogInventorySchema.safeParse({ ...base, collections: [...base.collections, base.collections[0]] }).success, false);
  const duplicateRecord = { ...book, id: `ci_${hex('4')}`, sourceRecord: video.sourceRecord, externalIdentifiers: video.externalIdentifiers };
  assert.equal(catalogInventorySchema.safeParse({ ...base, items: [...base.items, duplicateRecord] }).success, false);
  assert.equal(catalogItemSchema.safeParse({ ...video, externalIdentifiers: [video.sourceRecord.externalId, video.sourceRecord.externalId] }).success, false);
  const aliasCollision = { ...book, externalIdentifiers: [book.sourceRecord.externalId, audio.sourceRecord.externalId],
    sourceRecord: { ...book.sourceRecord, sourceId: audioSource.id } };
  assert.equal(catalogInventorySchema.safeParse({ ...base, items: [video, audio, aliasCollision] }).success, false);
  assert.equal(collectionSchema.safeParse({ ...shelf, itemIds: [book.id, book.id] }).success, false);
});

test('inventory rejects wrong account, project, source and media references', () => {
  const base = inventory();
  assert.equal(catalogInventorySchema.safeParse({ ...base, sources: [{ ...videoSource, creatorAccountId: `cr_${hex('f')}` }, audioSource, writingSource] }).success, false);
  assert.equal(catalogInventorySchema.safeParse({ ...base, items: [{ ...video, projectId: `ch_${hex('f')}` }, audio, book] }).success, false);
  assert.equal(catalogInventorySchema.safeParse({ ...base, items: [{ ...video, sourceRecord: { ...video.sourceRecord, sourceId: `src_${hex('f')}` } }, audio, book] }).success, false);
  assert.equal(catalogInventorySchema.safeParse({ ...base, mediaAssets: [{ ...videoAsset, catalogItemId: book.id }, audioAsset] }).success, false);
  assert.equal(catalogInventorySchema.safeParse({ ...base, collections: [{ ...shelf, itemIds: [`ci_${hex('f')}`] }] }).success, false);
  assert.equal(catalogInventorySchema.safeParse({ ...base, items: [{ ...video, mediaAssetIds: [`ma_${hex('f')}`] }, audio, book] }).success, false);
});

test('source provenance and creator overrides remain separate', () => {
  const base = inventory();
  assert.equal(catalogItemSchema.safeParse({ ...book, externalIdentifiers: [] }).success, false);
  assert.equal(catalogItemSchema.safeParse({ ...book, creatorOverrides: { title: 'My edit', editedAt: timestamp, sourceId: videoSource.id } }).success, false);
  assert.equal(catalogInventorySchema.safeParse({ ...base, items: [{ ...video, sourceRecord: { ...video.sourceRecord, sourceId: writingSource.id } }, audio, book] }).success, true);
  const amazonRecord = { ...video, sourceRecord: { ...video.sourceRecord, externalId: amazonId('asin', 'B012345678') }, externalIdentifiers: [amazonId('asin', 'B012345678')] };
  assert.equal(catalogInventorySchema.safeParse({ ...base, items: [amazonRecord, audio, book] }).success, false);
});

test('unknown or revoked media rights cannot claim TV delivery', () => {
  const unknown = { status: 'unknown', basis: 'none', permittedUse: 'none' };
  const revoked = { ...clearedRights, status: 'revoked' };
  assert.equal(mediaRightsSchema.safeParse(unknown).success, true);
  assert.equal(mediaAssetSchema.safeParse({ ...videoAsset, rights: unknown, deliveryEligible: false }).success, true);
  assert.equal(mediaAssetSchema.safeParse({ ...videoAsset, rights: unknown }).success, false);
  assert.equal(mediaAssetSchema.safeParse({ ...videoAsset, rights: revoked }).success, false);
  assert.equal(mediaAssetSchema.safeParse({ ...videoAsset, rights: revoked, deliveryEligible: false }).success, true);
  assert.equal(mediaAssetSchema.safeParse({ ...audioAsset, rights: { ...clearedRights, permittedUse: 'television_display' } }).success, false);
  assert.equal(mediaRightsSchema.safeParse({ ...clearedRights, basis: 'license_documented' }).success, false);
});

test('source, artwork and media URLs and upload keys reject unsafe locations', () => {
  for (const url of ['http://example.com/file', 'https://user:pass@example.com/file', 'https://example.com/file#token',
    'https://localhost/file', 'https://127.0.0.1/file', 'https://[::1]/file', 'file:///etc/passwd',
    'javascript:alert(1)', 'https://example.com/' + 'a'.repeat(2048)]) {
    assert.equal(catalogSourceSchema.safeParse({ ...videoSource, endpointUrl: url }).success, false, url);
    assert.equal(catalogItemSchema.safeParse({ ...book, creatorOverrides: { ...book.creatorOverrides, artworkUrl: url } }).success, false, url);
    assert.equal(mediaAssetSchema.safeParse({ ...videoAsset, location: { type: 'https', url } }).success, false, url);
  }
  assert.equal(mediaAssetSchema.safeParse({ ...audioAsset, location: { type: 'upload', key: 'media/../secret.mp3' } }).success, false);
});
