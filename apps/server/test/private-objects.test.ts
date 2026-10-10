import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { IsolatedObjectStore, PrivateObjectService, privateObjectStoreFromEnv, type PrivateObjectStore } from '../src/private-objects.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';

test('private S3 configuration fails closed without server-only credentials or HTTPS', () => {
  assert.throws(() => privateObjectStoreFromEnv({}), /required/);
  assert.throws(() => privateObjectStoreFromEnv({ FIRELAUNCH_OBJECT_STORE: 's3', FIRELAUNCH_OBJECT_BUCKET: 'test-bucket', FIRELAUNCH_OBJECT_REGION: 'us-east-1' }), /incomplete/);
  assert.throws(() => privateObjectStoreFromEnv({ FIRELAUNCH_OBJECT_STORE: 's3', FIRELAUNCH_OBJECT_BUCKET: 'test-bucket', FIRELAUNCH_OBJECT_REGION: 'us-east-1',
    FIRELAUNCH_OBJECT_ACCESS_KEY_ID: 'test', FIRELAUNCH_OBJECT_SECRET_ACCESS_KEY: 'test', FIRELAUNCH_OBJECT_ENDPOINT: 'http://example.com' }), /HTTPS/);
});

const baseUrl = process.env.FIRELAUNCH_TEST_DATABASE_URL;
(baseUrl ? test : test.skip)('private object ownership, expiry, revocation, deletion and orphan cleanup on real Postgres', async () => {
  const admin = new Pool({ connectionString: baseUrl });
  const dbName = `firelaunch_p4_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(baseUrl!);
  url.pathname = `/${dbName}`;
  await admin.query(`CREATE DATABASE ${dbName}`);
  const root = await mkdtemp(path.join(tmpdir(), 'firelaunch-p4-objects-'));
  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  let repository: HostedProjectRepository | undefined;
  try {
    repository = await HostedProjectRepository.connect(url.toString());
    const accountA = await repository.accountForIdentity({ issuer: 'https://issuer.example', subject: 'a', email: 'a@example.com' });
    const accountB = await repository.accountForIdentity({ issuer: 'https://issuer.example', subject: 'b', email: 'b@example.com' });
    const a: AuthenticatedPrincipal = { accountId: accountA, issuer: 'https://issuer.example', subject: 'a', email: 'a@example.com' };
    const b: AuthenticatedPrincipal = { accountId: accountB, issuer: 'https://issuer.example', subject: 'b', email: 'b@example.com' };
    const forged = { ...b, accountId: accountA };
    const aProject = await repository.create(a, { title: 'A' });
    const bProject = await repository.create(b, { title: 'B' });
    const store = new IsolatedObjectStore(root);
    let clock = Date.now();
    const service = new PrivateObjectService(repository, store, () => clock);
    const content = Buffer.from('private license evidence');
    const metadata = await service.put(a, aProject.id, 'evidence', 'application/pdf', content);
    assert.match(metadata.id, /^ev_[a-f0-9]{32}$/);
    assert.equal(metadata.byteSize, content.length);
    assert.equal(metadata.contentType, 'application/pdf');
    assert.equal(JSON.stringify(metadata).includes('private/'), false);
    assert.equal(JSON.stringify(metadata).includes(content.toString()), false);
    const row = (await repository.pool.query<{ object_key: string }>('SELECT object_key FROM private_objects WHERE id = $1', [metadata.id])).rows[0]!;
    assert.match(row.object_key, /^private\/[a-f0-9]{64}$/);
    assert.notEqual(row.object_key.includes(aProject.id), true);
    assert.deepEqual(await store.get(row.object_key), content);

    for (const intruder of [b, forged]) {
      await assert.rejects(service.metadata(intruder, aProject.id, metadata.id), { code: 'NOT_FOUND' });
      await assert.rejects(service.issueDownload(intruder, aProject.id, metadata.id), { code: 'NOT_FOUND' });
      await assert.rejects(service.delete(intruder, aProject.id, metadata.id), { code: 'NOT_FOUND' });
    }
    await assert.rejects(service.metadata(a, bProject.id, metadata.id), { code: 'NOT_FOUND' });
    await assert.rejects(service.metadata(a, aProject.id, `ev_${'f'.repeat(32)}`), { code: 'NOT_FOUND' });
    await assert.rejects(service.put(b, aProject.id, 'evidence', 'application/pdf', content), { code: 'NOT_FOUND' });
    await assert.rejects(service.put(a, aProject.id, 'evidence', 'text/html', content), { code: 'INVALID_INPUT' });
    await assert.rejects(service.put(a, aProject.id, 'evidence', 'application/pdf', Buffer.alloc(1_000_001)), { code: 'INVALID_INPUT' });
    await assert.rejects(service.put(a, aProject.id, 'media', 'application/pdf', content), { code: 'INVALID_INPUT' });
    assert.equal((await readdir(path.join(root, 'private'))).length, 1);

    const { capability, expiresAt } = await service.issueDownload(a, aProject.id, metadata.id);
    assert.equal(new Date(expiresAt).getTime() - clock, 60_000);
    assert.equal((await repository.pool.query('SELECT token_hash FROM private_object_capabilities WHERE object_id = $1', [metadata.id])).rows[0].token_hash.includes(capability), false);
    assert.deepEqual((await service.download(a, aProject.id, metadata.id, capability)).content, content);
    await assert.rejects(service.download(b, aProject.id, metadata.id, capability), { code: 'NOT_FOUND' });
    await assert.rejects(service.download(a, aProject.id, metadata.id, capability.slice(0, -1) + 'X'), { code: 'NOT_FOUND' });
    clock += 60_000;
    await assert.rejects(service.download(a, aProject.id, metadata.id, capability), { code: 'NOT_FOUND' });
    const fresh = await service.issueDownload(a, aProject.id, metadata.id);
    await service.revoke(a, aProject.id, metadata.id);
    await assert.rejects(service.download(a, aProject.id, metadata.id, fresh.capability), { code: 'NOT_FOUND' });

    await repository.pool.query(`CREATE FUNCTION reject_private_object() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced metadata failure'; END $$`);
    await repository.pool.query('CREATE TRIGGER reject_private_object BEFORE INSERT ON private_objects FOR EACH ROW EXECUTE FUNCTION reject_private_object()');
    await assert.rejects(service.put(a, aProject.id, 'evidence', 'application/pdf', content), { code: 'STORAGE_ERROR' });
    assert.equal((await readdir(path.join(root, 'private'))).length, 1, 'failed metadata insert removed orphan');
    await repository.pool.query('DROP TRIGGER reject_private_object ON private_objects');
    await repository.pool.query('DROP FUNCTION reject_private_object()');
    const partialStore: PrivateObjectStore = {
      put: async (key, bytes, type) => { await store.put(key, bytes, type); throw new Error('partial object write'); },
      get: key => store.get(key), delete: key => store.delete(key)
    };
    await assert.rejects(new PrivateObjectService(repository, partialStore).put(a, aProject.id, 'evidence', 'application/pdf', content), { code: 'STORAGE_ERROR' });
    assert.equal((await readdir(path.join(root, 'private'))).length, 1, 'failed object write removed partial object');
    await service.delete(a, aProject.id, metadata.id);
    assert.equal((await readdir(path.join(root, 'private'))).length, 0);
    await assert.rejects(service.download(a, aProject.id, metadata.id, fresh.capability), { code: 'NOT_FOUND' });
    assert.equal((await repository.pool.query('SELECT count(*)::int AS count FROM private_object_capabilities')).rows[0].count, 0);
  } finally {
    if (repository) await repository.pool.end();
    await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);
    await admin.end();
    await rm(root, { recursive: true, force: true });
    process.env.NODE_ENV = oldEnv;
  }
});
