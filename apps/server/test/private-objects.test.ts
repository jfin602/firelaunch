import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { IsolatedObjectStore, PrivateObjectService, privateObjectStoreFromEnv, type PrivateObjectStore } from '../src/private-objects.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';

test('private S3 configuration fails closed without server-only credentials or HTTPS', () => {
  assert.throws(() => privateObjectStoreFromEnv({}), /required/);
  assert.throws(() => privateObjectStoreFromEnv({ VEGALAUNCH_OBJECT_STORE: 's3', VEGALAUNCH_OBJECT_BUCKET: 'test-bucket', VEGALAUNCH_OBJECT_REGION: 'us-east-1' }), /incomplete/);
  assert.throws(() => privateObjectStoreFromEnv({ VEGALAUNCH_OBJECT_STORE: 's3', VEGALAUNCH_OBJECT_BUCKET: 'test-bucket', VEGALAUNCH_OBJECT_REGION: 'us-east-1',
    VEGALAUNCH_OBJECT_ACCESS_KEY_ID: 'test', VEGALAUNCH_OBJECT_SECRET_ACCESS_KEY: 'test', VEGALAUNCH_OBJECT_ENDPOINT: 'http://example.com' }), /HTTPS/);
});

test('private AWS profile is explicit, native-S3 only, and does not fall back to static keys', () => {
  const base = { VEGALAUNCH_OBJECT_STORE: 's3', VEGALAUNCH_OBJECT_BUCKET: 'approved-private-bucket',
    VEGALAUNCH_OBJECT_REGION: 'us-east-2', VEGALAUNCH_OBJECT_ACCESS_KEY_ID: 'invalid-static-key',
    VEGALAUNCH_OBJECT_SECRET_ACCESS_KEY: 'invalid-static-secret' };
  assert.ok(privateObjectStoreFromEnv({ ...base, VEGALAUNCH_OBJECT_AUTH: 'aws-profile', AWS_PROFILE: 'vegalaunch-staging-app' }));
  assert.throws(() => privateObjectStoreFromEnv({ ...base, VEGALAUNCH_OBJECT_AUTH: 'aws-profile' }), /named profile/);
  assert.throws(() => privateObjectStoreFromEnv({ ...base, VEGALAUNCH_OBJECT_AUTH: 'aws-profile', AWS_PROFILE: 'vegalaunch-staging-app',
    VEGALAUNCH_OBJECT_ENDPOINT: 'https://s3.example.test' }), /native S3/);
  assert.throws(() => privateObjectStoreFromEnv({ ...base, VEGALAUNCH_OBJECT_AUTH: 'unknown' }), /Unsupported/);
  assert.ok(privateObjectStoreFromEnv({ ...base }));
});

test('local S3 HTTP requires explicit development and loopback', () => {
  const previous = process.env.NODE_ENV;
  const base = { VEGALAUNCH_OBJECT_STORE: 's3', VEGALAUNCH_OBJECT_BUCKET: 'vegalaunch-source', VEGALAUNCH_OBJECT_REGION: 'us-east-1',
    VEGALAUNCH_OBJECT_ACCESS_KEY_ID: 'test', VEGALAUNCH_OBJECT_SECRET_ACCESS_KEY: 'test', VEGALAUNCH_LOCAL_HOSTED: '1' };
  try {
    process.env.NODE_ENV = 'development';
    for (const host of ['localhost', '127.0.0.1'])
      assert.ok(privateObjectStoreFromEnv({ ...base, NODE_ENV: 'development', VEGALAUNCH_OBJECT_ENDPOINT: `http://${host}:9000` }));
    for (const endpoint of ['http://evil.example:9000', 'http://127.0.0.2:9000', 'http://localhost:9000/path'])
      assert.throws(() => privateObjectStoreFromEnv({ ...base, NODE_ENV: 'development', VEGALAUNCH_OBJECT_ENDPOINT: endpoint }), /HTTPS/);
    assert.throws(() => privateObjectStoreFromEnv({ ...base, NODE_ENV: 'development', VEGALAUNCH_LOCAL_HOSTED: '0', VEGALAUNCH_OBJECT_ENDPOINT: 'http://localhost:9000' }), /HTTPS/);
    process.env.NODE_ENV = 'production';
    assert.throws(() => privateObjectStoreFromEnv({ ...base, NODE_ENV: 'production', VEGALAUNCH_OBJECT_ENDPOINT: 'http://localhost:9000' }), /HTTPS/);
  } finally { process.env.NODE_ENV = previous; }
});

const baseUrl = process.env.VEGALAUNCH_TEST_DATABASE_URL;
(baseUrl ? test : test.skip)('schema 15 stores a bounded large private MP3 without widening other private types', async () => {
  const admin = new Pool({ connectionString: baseUrl });
  const dbName = `vegalaunch_audio_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(baseUrl!); url.pathname = `/${dbName}`;
  const root = await mkdtemp(path.join(tmpdir(), 'vegalaunch-audio-objects-'));
  let repository: HostedProjectRepository | undefined;
  const oldEnv = process.env.NODE_ENV; process.env.NODE_ENV = 'test';
  try {
    await admin.query(`CREATE DATABASE ${dbName}`);
    repository = await HostedProjectRepository.connect(url.toString());
    const accountId = await repository.accountForIdentity({ issuer: 'https://issuer.example', subject: 'audio', email: 'audio@example.com' });
    const principal: AuthenticatedPrincipal = { accountId, issuer: 'https://issuer.example', subject: 'audio', email: 'audio@example.com' };
    const project = await repository.create(principal, { title: 'Audio' });
    const source = path.join(root, 'two-megabyte.mp3');
    const bytes = Buffer.alloc(2_000_000); bytes.set(Buffer.from('ID3'));
    await writeFile(source, bytes);
    const service = new PrivateObjectService(repository, new IsolatedObjectStore(root));
    const object = await service.put(principal, project.id, 'media', 'audio/mpeg', {
      file: source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), head: bytes.subarray(0, 16)
    }, true);
    assert.equal(object.byteSize, 2_000_000);
    await assert.rejects(repository.pool.query(`UPDATE private_objects SET content_type = 'image/png' WHERE id = $1`, [object.id]), /private_objects_byte_size_check/);
    assert.equal((await service.metadata(principal, project.id, object.id)).contentType, 'audio/mpeg');
  } finally {
    await repository?.pool.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.end();
    await rm(root, { recursive: true, force: true });
    process.env.NODE_ENV = oldEnv;
  }
});
(baseUrl ? test : test.skip)('private object ownership, expiry, revocation, deletion and orphan cleanup on real Postgres', async () => {
  const admin = new Pool({ connectionString: baseUrl });
  const dbName = `vegalaunch_p4_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(baseUrl!);
  url.pathname = `/${dbName}`;
  await admin.query(`CREATE DATABASE ${dbName}`);
  const root = await mkdtemp(path.join(tmpdir(), 'vegalaunch-p4-objects-'));
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
    const content = Buffer.from('%PDF-1.4\nprivate license evidence\n%%EOF');
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
    await assert.rejects(service.put(a, aProject.id, 'evidence', 'image/png', content), { code: 'INVALID_INPUT' });
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
    await repository.pool.query(`INSERT INTO private_objects(id, creator_account_id, project_id, kind, object_key, content_type, byte_size, sha256)
      SELECT 'ev_' || md5('quota-' || n::text), $1, $2, 'evidence', 'private/' || repeat(md5('quota-' || n::text), 2),
      'application/pdf', 1, repeat('a', 64) FROM generate_series(1, 1000) AS n`, [a.accountId, aProject.id]);
    await assert.rejects(service.put(a, aProject.id, 'evidence', 'application/pdf', content), { code: 'INVALID_INPUT' });
    assert.equal((await readdir(path.join(root, 'private'))).length, 1, 'quota rejection removed uploaded object');
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
