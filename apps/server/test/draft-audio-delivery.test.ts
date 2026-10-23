import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { Pool } from 'pg';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { DraftAudioDelivery } from '../src/draft-audio-delivery.js';
import type { PrivateObjectStore } from '../src/private-objects.js';

const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const projectId = id('ch', 'a');
const itemId = id('ci', 'b');
const audioAssetId = id('ma', 'c');
const coverAssetId = id('ma', 'd');
const audioObjectId = id('ma', 'e');
const coverObjectId = id('ma', 'f');
const owner = id('cr', '1');
const sourceId = id('src', '2');
const contentId = `item_${createHash('sha256').update('catalog-content-v1\0').update(itemId).digest('hex').slice(0, 32)}`;
const origin = 'https://studio.example.com';
const claim = (use: 'television_display' | 'television_playback') => ({ status: 'cleared', basis: 'creator_asserted',
  permittedUse: use, assertedAt: '2026-10-22T00:00:00.000Z', attestationVersion: 'channel-media-v1' });
const unknown = { status: 'unknown', basis: 'none', permittedUse: 'none' };

test('draft MP3 and cover stream only while exact current channel inclusion and rights hold', async () => {
  const source = { schemaVersion: 1, id: sourceId, creatorAccountId: owner, projectId,
    type: 'creator_upload', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } };
  const item = { schemaVersion: 1, id: itemId, creatorAccountId: owner, projectId, kind: 'audio',
    sourceRecord: { sourceId, externalId: { provider: 'creator', kind: 'upload_id', value: 'track' },
      observedAt: '2026-10-22T00:00:00.000Z', metadata: { title: 'Test track' } },
    externalIdentifiers: [{ provider: 'creator', kind: 'upload_id', value: 'track' }],
    mediaAssetIds: [audioAssetId, coverAssetId] };
  const audio = { schemaVersion: 1, id: audioAssetId, creatorAccountId: owner, projectId,
    catalogItemId: itemId, kind: 'audio', location: { type: 'private_object', objectId: audioObjectId },
    tvDisplayRights: claim('television_display'), tvPlaybackRights: claim('television_playback'), deliveryEligible: false };
  const cover = { ...audio, id: coverAssetId, kind: 'artwork', location: { type: 'private_object', objectId: coverObjectId },
    tvPlaybackRights: unknown };
  const bytes = Buffer.from('ID3' + 'a'.repeat(100));
  const coverBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WZkAAAAASUVORK5CYII=', 'base64');
  const objects = new Map([[`private/${'a'.repeat(64)}`, bytes], [`private/${'b'.repeat(64)}`, coverBytes]]);
  const store = { get: async (key: string) => objects.get(key)!,
    getRange: async (key: string, start: number, end: number) => objects.get(key)!.subarray(start, end + 1) } as PrivateObjectStore;
  let included = true;
  let revoked = false;
  let currentAudio = audio;
  const deliveryUrl = `${origin}/api/draft-audio/${projectId}/${itemId}/${audioAssetId}/audio`;
  const coverUrl = `${origin}/api/draft-audio/${projectId}/${itemId}/${coverAssetId}/cover`;
  const base = fixtureChannel();
  const oldId = base.content[0]!.id;
  const spec = () => ({ ...base, id: projectId,
    content: included ? [{ ...base.content[0], id: contentId, title: 'Test track',
      presentation: 'audio', mediaUrl: deliveryUrl, artwork: coverUrl }] : [],
    pages: base.pages.map(page => ({ ...page, modules: page.modules.map(module =>
      'contentIds' in module ? { ...module, contentIds: included ? module.contentIds.map(value => value === oldId ? contentId : value) : [] } : module) })) });
  const pool = { query: async (sql: string, parameters: unknown[]) => {
    if (sql.includes('SELECT p.content_type, p.byte_size')) return { rows: [{ content_type: parameters[2] === coverAssetId ? 'image/png' : 'audio/mpeg',
      byte_size: parameters[2] === coverAssetId ? coverBytes.length : bytes.length, revoked_at: revoked ? new Date() : null }] };
    const coverRequest = parameters[2] === coverAssetId;
    return { rows: [{ object_key: `private/${(coverRequest ? 'b' : 'a').repeat(64)}`,
      content_type: coverRequest ? 'image/png' : 'audio/mpeg', byte_size: coverRequest ? coverBytes.length : bytes.length,
      sha256: createHash('sha256').update(coverRequest ? coverBytes : bytes).digest('hex'),
      asset_record: coverRequest ? cover : currentAudio, item_record: item, source_record: source,
      spec: spec(), revoked_at: revoked ? new Date() : null }] };
  } } as unknown as Pool;
  const delivery = new DraftAudioDelivery(pool, store, origin);
  assert.equal(await delivery.candidate(owner, projectId, item as never, source as never, audio as never, 'audio'), deliveryUrl);
  assert.equal(await delivery.candidate(owner, projectId, item as never, source as never, cover as never, 'cover'), coverUrl);
  assert.deepEqual((await delivery.read(projectId, itemId, audioAssetId, 'audio', 3, 9)).content, bytes.subarray(3, 10));
  assert.deepEqual((await delivery.read(projectId, itemId, coverAssetId, 'cover')).content, coverBytes);
  await assert.rejects(delivery.read(id('ch', '9'), itemId, audioAssetId, 'audio'), { code: 'NOT_FOUND' });
  included = false;
  await assert.rejects(delivery.read(projectId, itemId, audioAssetId, 'audio'), { code: 'NOT_FOUND' });
  await assert.rejects(delivery.read(projectId, itemId, coverAssetId, 'cover'), { code: 'NOT_FOUND' });
  included = true;
  currentAudio = { ...audio, tvPlaybackRights: { ...claim('television_playback'), status: 'revoked' } } as typeof audio;
  await assert.rejects(delivery.read(projectId, itemId, audioAssetId, 'audio'), { code: 'NOT_FOUND' });
  currentAudio = audio;
  revoked = true;
  await assert.rejects(delivery.read(projectId, itemId, audioAssetId, 'audio'), { code: 'NOT_FOUND' });
  assert.throws(() => delivery.url(id('ch', '9'), itemId, '../secret', 'audio'), { code: 'NOT_FOUND' });
});
