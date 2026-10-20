import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { ManagedArtworkDelivery } from '../src/managed-artwork.js';
import type { PrivateObjectStore } from '../src/private-objects.js';
import type { S3MediaStorage } from '../src/media-storage.js';

const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const owner = id('cr', '1'), project = id('ch', '2'), itemId = id('ci', '3');
const objectId = id('ma', '4'), deployment = id('dep', '5'), release = id('rel', '6'), assetId = id('ma', '7');
const body = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 8, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]);
const sha256 = createHash('sha256').update(body).digest('hex');
const source = { schemaVersion: 1, id: id('src', '8'), creatorAccountId: owner, projectId: project,
  type: 'creator_json', state: 'verified', permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted',
    verificationEvidenceId: id('ev', '9') } };
const item = { schemaVersion: 1, id: itemId, creatorAccountId: owner, projectId: project, kind: 'video',
  sourceRecord: { sourceId: source.id, externalId: { provider: 'creator', kind: 'feed_item_id', value: 'fixture' },
    observedAt: '2026-10-11T00:00:00.000Z', metadata: { title: 'Film' } },
  externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'fixture' }], mediaAssetIds: [assetId] };
const asset = { schemaVersion: 1, id: assetId, creatorAccountId: owner, projectId: project,
  catalogItemId: itemId, kind: 'artwork', location: { type: 'private_object', objectId },
  tvDisplayRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt: '2026-10-11T00:00:00.000Z' },
  tvPlaybackRights: { status: 'unknown', basis: 'none', permittedUse: 'none' }, deliveryEligible: true };

test('approved private artwork resolves without writes, publishes once and retries idempotently', async () => {
  let row: Record<string, unknown> = { object_key: 'private/' + 'a'.repeat(64), content_type: 'image/jpeg', byte_size: body.length,
    sha256, asset_record: asset, item_record: item, source_record: source, revoked_at: null };
  const store = { get: async (key: string) => { if (key !== row.object_key) throw new Error('missing'); return body; },
    put: async () => { throw new Error('private store cannot publish'); }, delete: async () => {} } as PrivateObjectStore;
  const pool = { query: async (_sql: string, args: unknown[]) => ({ rows: args[0] === objectId && args[1] === project &&
    args[2] === owner && args[3] === assetId && args[4] === itemId ? [row] : [] }) } as unknown as Pool;
  const copies = new Map<string, Buffer>();
  const media = {
    publishedArtworkUrl: (_scope: unknown, selectedRelease: string, hash: string) => `https://cdn.example.com/${assetId}/${selectedRelease}/${hash}.jpg`,
    publishVerifiedArtwork: async (_scope: unknown, selectedRelease: string, bytes: Buffer, hash: string) => {
      const key = `${selectedRelease}/${hash}`;
      if (copies.has(key) && !copies.get(key)!.equals(bytes)) throw new Error('copy differs');
      copies.set(key, bytes);
      return `https://cdn.example.com/${assetId}/${selectedRelease}/${hash}.jpg`;
    }
  } as unknown as S3MediaStorage;
  const delivery = new ManagedArtworkDelivery(pool, store, 'https://studio.example.com', media);
  const prepare = () => delivery.prepare(owner, project, itemId, objectId, deployment, release, assetId);
  const prepared = await prepare();
  assert.equal(prepared.url, `https://cdn.example.com/${assetId}/${release}/${sha256}.jpg`);
  assert.equal(copies.size, 0, 'readiness has no storage write');
  await delivery.publish(prepared);
  await delivery.publish(prepared);
  assert.deepEqual(copies.get(`${release}/${sha256}`), body);
  await assert.rejects(delivery.prepare(id('cr', 'a'), project, itemId, objectId, deployment, release, assetId));
  await assert.rejects(delivery.prepare(owner, project, id('ci', 'a'), objectId, deployment, release, assetId));
  await assert.rejects(delivery.prepare(owner, project, itemId, objectId, deployment, release, '../unsafe'));
  row = { ...row, revoked_at: new Date() }; await assert.rejects(prepare());
  row = { ...row, revoked_at: null, content_type: 'image/webp' }; await assert.rejects(prepare());
  row = { ...row, content_type: 'image/jpeg', sha256: '0'.repeat(64) }; await assert.rejects(prepare());
  row = { ...row, sha256, asset_record: { ...asset, deliveryEligible: false } }; await assert.rejects(prepare());
  row = { ...row, asset_record: asset, source_record: { ...source, state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } } };
  await assert.rejects(prepare());
  row = { ...row, source_record: source, object_key: '../unsafe' }; await assert.rejects(prepare());
  assert.deepEqual(copies.get(`${release}/${sha256}`), body, 'old approved copy remains');
});
