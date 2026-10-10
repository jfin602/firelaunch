import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { once } from 'node:events';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { IsolatedObjectStore, PrivateObjectService, type PrivateObjectStore } from '../src/private-objects.js';
import { cleanOrphans, deleteAccount, exportAccount, health } from '../src/operations.js';
import { createRecoveryArchive, inspectRecoveryArchive, openPrivatePayload, restoreRecoveryArchive, sealPrivatePayload } from '../src/recovery.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';
import { createApi } from '../src/api.js';
import { ProjectRepository } from '../src/repository.js';
import type { ServerMode } from '../src/auth/config.js';

const base = process.env.FIRELAUNCH_TEST_DATABASE_URL;
const integration = base ? test : test.skip;
const key = 'a7'.repeat(32);

integration('real Postgres backup, isolated restore, concurrent update, privacy delete and failed object recovery', async () => {
  const admin = new Pool({ connectionString: base });
  const suffix = randomUUID().replaceAll('-', '');
  const sourceName = `firelaunch_p6_${suffix}`;
  const restoreName = `firelaunch_restore_${suffix}`;
  const url = new URL(base!); url.pathname = `/${sourceName}`;
  const destination = new URL(base!); destination.pathname = `/${restoreName}`;
  const sourceRoot = await mkdtemp(path.join(tmpdir(), 'fl-p6-source-'));
  const destRoot = await mkdtemp(path.join(tmpdir(), 'fl-p6-restore-'));
  const priorEnv = process.env.NODE_ENV; process.env.NODE_ENV = 'test';
  let repository: HostedProjectRepository | undefined;
  let second: HostedProjectRepository | undefined;
  try {
    await admin.query(`CREATE DATABASE ${sourceName}`);
    repository = await HostedProjectRepository.connect(url.toString());
    second = await HostedProjectRepository.connect(url.toString());
    const aId = await repository.accountForIdentity({ issuer: 'https://issuer.example', subject: 'a', email: 'a@example.com' });
    const bId = await repository.accountForIdentity({ issuer: 'https://issuer.example', subject: 'b', email: 'b@example.com' });
    const a: AuthenticatedPrincipal = { accountId: aId, issuer: 'https://issuer.example', subject: 'a', email: 'a@example.com' };
    const b: AuthenticatedPrincipal = { accountId: bId, issuer: 'https://issuer.example', subject: 'b', email: 'b@example.com' };
    const aProject = await repository.create(a, { title: 'Private A' });
    const bProject = await repository.create(b, { title: 'Private B' });
    const store = new IsolatedObjectStore(sourceRoot);
    assert.deepEqual(await health(repository.pool, store), { status: 'ok', database: true, objectStore: true, migration: 4 });
    const objects = new PrivateObjectService(repository, store);
    const first = await objects.put(a, aProject.id, 'evidence', 'application/pdf', Buffer.from('a evidence'));
    await objects.put(b, bProject.id, 'media', 'image/png', Buffer.from('b image'));
    const capability = await objects.issueDownload(a, aProject.id, first.id);
    let updated = false;
    const concurrentStore: PrivateObjectStore = {
      put: (name, content, type) => store.put(name, content, type),
      delete: name => store.delete(name),
      get: async name => {
        if (!updated) { updated = true; await second!.update(b, bProject.id, 1, { ...bProject.spec, title: 'New B' }); }
        return store.get(name);
      }
    };
    const archive = await createRecoveryArchive(repository.pool, url.toString(), concurrentStore, key, 7);
    const manifest = inspectRecoveryArchive(archive, key);
    assert.equal(manifest.objects.length, 2);
    assert.ok(new Date(manifest.retainUntil).getTime() > Date.now());
    assert.equal((await second.read(b, bProject.id)).revision, 2);
    assert.throws(() => inspectRecoveryArchive(Buffer.concat([archive.subarray(0, 30), Buffer.from([archive[30]! ^ 1]), archive.subarray(31)]), key));
    await assert.rejects(restoreRecoveryArchive(archive, 'b6'.repeat(32), destination.toString(), new IsolatedObjectStore(destRoot)));
    assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [restoreName])).rowCount, 0);

    const failingStore: PrivateObjectStore = {
      put: async (name, content, type) => { await new IsolatedObjectStore(destRoot).put(name, content, type); if (name === manifest.objects[1]!.key) throw new Error('object emulator outage after write'); },
      get: name => new IsolatedObjectStore(destRoot).get(name), delete: name => new IsolatedObjectStore(destRoot).delete(name)
    };
    await assert.rejects(restoreRecoveryArchive(archive, key, destination.toString(), failingStore));
    assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [restoreName])).rowCount, 0);
    assert.equal((await readdir(path.join(destRoot, 'private'))).length, 0);

    await restoreRecoveryArchive(archive, key, destination.toString(), new IsolatedObjectStore(destRoot));
    await assert.rejects(restoreRecoveryArchive(archive, key, destination.toString(), new IsolatedObjectStore(destRoot)), /already exists/);
    const restored = await HostedProjectRepository.connect(destination.toString());
    try {
      assert.equal((await restored.read(b, bProject.id)).revision, 1, 'backup used one SQL snapshot');
      assert.equal((await restored.list(a)).length, 1);
      assert.equal((await restored.list(b)).length, 1);
      await assert.rejects(restored.read(a, bProject.id), { code: 'NOT_FOUND' });
      assert.equal((await restored.pool.query('SELECT count(*)::int AS n FROM private_object_capabilities')).rows[0].n, 0);
      const restoredObjects = (await restored.pool.query<{ object_key: string; sha256: string }>('SELECT object_key, sha256 FROM private_objects ORDER BY object_key')).rows;
      for (const row of restoredObjects) assert.equal(row.sha256, manifest.objects.find(item => item.key === row.object_key)?.sha256);
    } finally { await restored.pool.end(); }

    const restartedStore = new IsolatedObjectStore(sourceRoot);
    const exportData = await exportAccount(repository.pool, restartedStore, aId);
    assert.equal(exportData.projects.length, 1);
    assert.equal(exportData.providerIdentities.length, 1);
    assert.equal(exportData.objects.length, 1);
    assert.equal(JSON.stringify(exportData).includes('private/'), false);
    assert.equal(JSON.stringify(exportData).includes(capability.capability), false);
    const sealed = sealPrivatePayload({ format: 'firelaunch-account-export-v1', accountId: aId, data: exportData }, key);
    assert.equal(sealed.includes(Buffer.from('a evidence')), false);
    assert.equal((openPrivatePayload(sealed, key) as { accountId: string }).accountId, aId);
    let deletionOutage = true;
    const unavailableStore: PrivateObjectStore = { put: (name, content, type) => store.put(name, content, type), get: name => store.get(name),
      delete: async name => { if (deletionOutage) throw new Error('object emulator down'); await store.delete(name); } };
    assert.deepEqual(await deleteAccount(repository.pool, unavailableStore, aId), { queued: 1, cleaned: 0, failed: 1 });
    assert.equal((await repository.pool.query('SELECT count(*)::int AS n FROM private_object_capabilities WHERE creator_account_id = $1', [aId])).rows[0].n, 0);
    assert.equal((await repository.pool.query('SELECT count(*)::int AS n FROM private_object_garbage')).rows[0].n, 1);
    await assert.rejects(objects.download(a, aProject.id, first.id, capability.capability), { code: 'NOT_FOUND' });
    assert.equal((await repository.list(b)).length, 1);
    deletionOutage = false;
    assert.deepEqual(await cleanOrphans(repository.pool, unavailableStore), { cleaned: 1, failed: 0 });
    assert.equal((await repository.pool.query('SELECT count(*)::int AS n FROM private_object_garbage')).rows[0].n, 0);
    assert.equal((await readdir(path.join(sourceRoot, 'private'))).length, 1);
  } finally {
    if (second) await second.pool.end();
    if (repository) await repository.pool.end();
    await admin.query(`DROP DATABASE IF EXISTS ${restoreName} WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS ${sourceName} WITH (FORCE)`);
    await admin.end();
    await rm(sourceRoot, { recursive: true, force: true });
    await rm(destRoot, { recursive: true, force: true });
    process.env.NODE_ENV = priorEnv;
  }
});

test('public routes never dispatch operator recovery, deletion or health commands', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'fl-p6-routes-'));
  const mode = { mode: 'hosted', auth: { session: () => null } } as unknown as ServerMode;
  const api = createApi(new ProjectRepository(root), undefined, mode);
  try {
    api.listen(0, '127.0.0.1'); await once(api, 'listening');
    const address = api.address(); assert.ok(address && typeof address !== 'string');
    for (const route of ['/api/ops', '/api/backup', '/api/restore', '/api/health', '/api/account-delete', '/api/projects/backup']) {
      const response = await fetch(`http://127.0.0.1:${address.port}${route}`, { method: 'POST' });
      assert.equal(response.status, 401, route);
    }
  } finally { await new Promise<void>(resolve => api.close(() => resolve())); await rm(root, { recursive: true, force: true }); }
});
