import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { PrivateObjectService, S3PrivateObjectStore } from '../src/private-objects.js';
import { inspectRecoveryArchive } from '../src/recovery.js';

const enabled = process.env.VEGALAUNCH_LOCAL_S3_TEST === '1';
(enabled ? test : test.skip)('actual MinIO S3 buckets and operations CLI backup/restore stay separate', async () => {
  const base = process.env.VEGALAUNCH_DATABASE_URL!;
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const sourceName = `vegalaunch_c2_drill_${suffix}`;
  const restoreName = `vegalaunch_restore_${suffix}`;
  const sourceUrl = new URL(base); sourceUrl.pathname = `/${sourceName}`;
  const restoreUrl = new URL(base); restoreUrl.pathname = `/${restoreName}`;
  const adminUrl = new URL(base); adminUrl.pathname = '/postgres';
  const admin = new Pool({ connectionString: adminUrl.toString() });
  const directory = await mkdtemp(path.join(tmpdir(), 'vegalaunch-c2-s3-'));
  const archivePath = path.join(directory, 'backup.flrec');
  const storage = { region: process.env.VEGALAUNCH_OBJECT_REGION!, endpoint: process.env.VEGALAUNCH_OBJECT_ENDPOINT!,
    accessKeyId: process.env.VEGALAUNCH_OBJECT_ACCESS_KEY_ID!, secretAccessKey: process.env.VEGALAUNCH_OBJECT_SECRET_ACCESS_KEY!, allowLocalHttp: true };
  const source = new S3PrivateObjectStore(process.env.VEGALAUNCH_OBJECT_BUCKET!, storage);
  const destination = new S3PrivateObjectStore(process.env.VEGALAUNCH_RESTORE_OBJECT_BUCKET!, storage);
  const keys: string[] = [];
  let repository: HostedProjectRepository | undefined;
  try {
    assert.notEqual(process.env.VEGALAUNCH_OBJECT_BUCKET, process.env.VEGALAUNCH_RESTORE_OBJECT_BUCKET);
    assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [sourceName])).rowCount, 0);
    assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [restoreName])).rowCount, 0);
    await admin.query(`CREATE DATABASE ${sourceName}`);
    repository = await HostedProjectRepository.connect(sourceUrl.toString());
    // Storage drill data is synthetic; this does not represent a Google login.
    const principal = { issuer: 'urn:vegalaunch:c2-storage-drill', subject: suffix, email: 'drill@example.invalid', accountId: '' };
    principal.accountId = await repository.accountForIdentity(principal);
    const project = await repository.create(principal, { title: 'Storage drill' });
    const bytes = Buffer.concat([Buffer.from('%PDF-1.4\n'), randomBytes(37), Buffer.from('\n%%EOF')]);
    const item = await new PrivateObjectService(repository, source).put(principal, project.id, 'evidence', 'application/pdf', bytes);
    const row = (await repository.pool.query<{ object_key: string }>('SELECT object_key FROM private_objects WHERE id = $1', [item.id])).rows[0]!;
    keys.push(row.object_key);
    assert.deepEqual(await source.get(row.object_key), bytes);
    await assert.rejects(destination.get(row.object_key));
    const cliEnv = { ...process.env, VEGALAUNCH_DATABASE_URL: sourceUrl.toString(), VEGALAUNCH_RESTORE_DATABASE_URL: restoreUrl.toString() };
    const ops = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'apps/server/src/operations-cli.ts', ...args], { cwd: process.cwd(), env: cliEnv, encoding: 'utf8' });
    assert.equal(ops('health').status, 0, 'source health');
    assert.equal(ops('backup', '--out', archivePath, '--retain-days', '1').status, 0, 'actual CLI backup');
    const manifest = inspectRecoveryArchive(await readFile(archivePath), process.env.VEGALAUNCH_RECOVERY_KEY!);
    assert.equal(manifest.objects.length, 1);
    assert.equal(manifest.objects[0]?.sha256, item.sha256);
    assert.equal(ops('restore', '--in', archivePath).status, 0, 'actual CLI restore');
    assert.deepEqual(await destination.get(row.object_key), bytes);
    assert.deepEqual(await source.get(row.object_key), bytes);
    const restored = await HostedProjectRepository.connect(restoreUrl.toString());
    try {
      assert.equal((await restored.read(principal, project.id)).revision, 1);
      const stranger = { ...principal, subject: `${suffix}-other` };
      stranger.accountId = await restored.accountForIdentity(stranger);
      await assert.rejects(restored.read(stranger, project.id), { code: 'NOT_FOUND' });
    } finally { await restored.pool.end(); }
  } finally {
    if (repository) await repository.pool.end();
    for (const key of keys) { await source.delete(key).catch(() => undefined); await destination.delete(key).catch(() => undefined); }
    await admin.query(`DROP DATABASE IF EXISTS ${restoreName} WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS ${sourceName} WITH (FORCE)`);
    await admin.end(); await rm(directory, { recursive: true, force: true });
  }
});
