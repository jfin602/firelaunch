import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { ManagedArtworkDelivery } from '../src/managed-artwork.js';
import type { PrivateObjectStore } from '../src/private-objects.js';

const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const owner = id('cr', '1'), project = id('ch', '2'), objectId = id('ma', '3');
const deployment = id('dep', '4'), release = id('rel', '5'), asset = id('ma', '6');
const body = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x02]);
const sha256 = createHash('sha256').update(body).digest('hex');

test('managed thumbnail copies verified owned bytes only into immutable release scope', async () => {
  const objects = new Map<string, Buffer>([['private/' + 'a'.repeat(64), body]]);
  const store = { put: async (key: string, content: Buffer) => { if (objects.has(key)) throw new Error('exists'); objects.set(key, content); },
    get: async (key: string) => { const value = objects.get(key); if (!value) throw new Error('missing'); return value; },
    delete: async () => {} } as PrivateObjectStore;
  const pool = { query: async (_sql: string, args: unknown[]) => ({ rows: args[0] === objectId && args[1] === project && args[2] === owner ?
    [{ object_key: 'private/' + 'a'.repeat(64), content_type: 'image/jpeg', byte_size: body.length, sha256 }] : [] }) } as unknown as Pool;
  const delivery = new ManagedArtworkDelivery(pool, store, 'https://studio.example.com');
  const prepared = await delivery.prepare(owner, project, objectId, deployment, release, asset);
  assert.equal(prepared.url, `https://studio.example.com/api/public-artwork/${deployment}/${release}/${asset}/${sha256}.jpg`);
  assert.notEqual(prepared.key, 'private/' + 'a'.repeat(64));
  assert.equal(objects.has(prepared.key), false, 'readiness has no publication side effect');
  await delivery.publish(prepared);
  await delivery.publish(prepared);
  assert.deepEqual(await delivery.read(deployment, release, asset, sha256, 'image/jpeg'), body);
  await assert.rejects(delivery.read(deployment, id('rel', '7'), asset, sha256, 'image/jpeg'));
  await assert.rejects(delivery.prepare(id('cr', '8'), project, objectId, deployment, release, asset));
  objects.set(prepared.key, Buffer.from([0xff, 0xd8, 0xff, 0x00]));
  await assert.rejects(delivery.read(deployment, release, asset, sha256, 'image/jpeg'));
});
