import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { Pool } from 'pg';
import { z } from 'zod';
import type { PrivateObjectStore } from './private-objects.js';
import { audit } from './operations.js';

const MAX_ARCHIVE = 256_000_000;
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const itemSchema = z.strictObject({ key: z.string().regex(/^private\/[a-f0-9]{64}$/), size: z.number().int().nonnegative().max(1_048_576), sha256: z.string().regex(/^[a-f0-9]{64}$/), contentType: z.string().max(100), contentBase64: z.string() });
const archiveSchema = z.strictObject({ format: z.literal('firelaunch-recovery-v1'), createdAt: z.string().datetime(), retainUntil: z.string().datetime(), databaseSha256: z.string().regex(/^[a-f0-9]{64}$/), databaseBase64: z.string(), objects: z.array(itemSchema).max(100_000) });
export type RecoveryManifest = { format: string; createdAt: string; retainUntil: string; databaseSha256: string; objects: { key: string; size: number; sha256: string; contentType: string }[] };

function pgEnv(urlString: string): { env: NodeJS.ProcessEnv; database: string; adminUrl: string } {
  const url = new URL(urlString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.pathname || url.pathname === '/') throw new Error('PostgreSQL URL required');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(database)) throw new Error('Unsafe database name');
  const admin = new URL(url); admin.pathname = '/postgres';
  return { database, adminUrl: admin.toString(), env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: database,
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get('sslmode') || 'prefer' } };
}

async function command(name: 'pg_dump' | 'pg_restore', args: string[], env: NodeJS.ProcessEnv, input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(name, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    const output: Buffer[] = []; let size = 0;
    child.stdout.on('data', (part: Buffer) => { size += part.length; if (size > MAX_ARCHIVE) child.kill(); else output.push(part); });
    // Never include pg tool stderr in errors: it can contain private SQL or configuration.
    child.stderr.resume();
    child.stdin.on('error', () => { /* process error/exit reports the failure without exposing input */ });
    child.on('error', () => reject(new Error(`${name} unavailable`)));
    child.on('close', code => code === 0 ? resolve(Buffer.concat(output)) : reject(new Error(`${name} failed`)));
    if (input) child.stdin.end(input); else child.stdin.end();
  });
}

function keyFromHex(hex: string): Buffer {
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error('32-byte recovery key required');
  return Buffer.from(hex, 'hex');
}

function encrypt(payload: Buffer, keyHex: string): Buffer {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromHex(keyHex), nonce);
  return Buffer.concat([Buffer.from('FLREC1'), nonce, cipher.update(payload), cipher.final(), cipher.getAuthTag()]);
}
function decrypt(payload: Buffer, keyHex: string): Buffer {
  if (payload.length < 34 || payload.subarray(0, 6).toString() !== 'FLREC1') throw new Error('Invalid recovery archive');
  const decipher = createDecipheriv('aes-256-gcm', keyFromHex(keyHex), payload.subarray(6, 18));
  decipher.setAuthTag(payload.subarray(payload.length - 16));
  return Buffer.concat([decipher.update(payload.subarray(18, -16)), decipher.final()]);
}

export function sealPrivatePayload(value: unknown, keyHex: string): Buffer {
  const bytes = Buffer.from(JSON.stringify(value));
  if (bytes.length > MAX_ARCHIVE - 34) throw new Error('Private export exceeds size limit');
  return encrypt(bytes, keyHex);
}
export function openPrivatePayload(raw: Buffer, keyHex: string): unknown {
  if (raw.length > MAX_ARCHIVE) throw new Error('Private export exceeds size limit');
  return JSON.parse(decrypt(raw, keyHex).toString('utf8'));
}

function verified(raw: Buffer, keyHex: string) {
  if (raw.length > MAX_ARCHIVE) throw new Error('Recovery archive exceeds size limit');
  const data = archiveSchema.parse(JSON.parse(decrypt(raw, keyHex).toString('utf8')));
  const database = Buffer.from(data.databaseBase64, 'base64');
  if (sha(database) !== data.databaseSha256) throw new Error('Database checksum mismatch');
  for (const item of data.objects) {
    const bytes = Buffer.from(item.contentBase64, 'base64');
    if (bytes.length !== item.size || sha(bytes) !== item.sha256) throw new Error('Object checksum mismatch');
  }
  return { data, database };
}

export function inspectRecoveryArchive(raw: Buffer, keyHex: string): RecoveryManifest {
  const { data } = verified(raw, keyHex);
  return { format: data.format, createdAt: data.createdAt, retainUntil: data.retainUntil, databaseSha256: data.databaseSha256,
    objects: data.objects.map(({ key, size, sha256, contentType }) => ({ key, size, sha256, contentType })) };
}

/** Snapshot links pg_dump and object metadata. Concurrent deletion makes backup fail closed on missing bytes. */
export async function createRecoveryArchive(pool: Pool, databaseUrl: string, store: PrivateObjectStore, keyHex: string, retentionDays = 30): Promise<Buffer> {
  keyFromHex(keyHex);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) throw new Error('Retention must be 1-365 days');
  await audit(pool, 'backup_started', 'started');
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot = (await client.query<{ snapshot: string }>('SELECT pg_export_snapshot() AS snapshot')).rows[0]!.snapshot;
    const rows = (await client.query<{ object_key: string; content_type: string; byte_size: number; sha256: string }>('SELECT object_key, content_type, byte_size, sha256 FROM private_objects ORDER BY object_key')).rows;
    if (rows.length > 100_000) throw new Error('Recovery object count exceeds limit');
    const database = await command('pg_dump', ['--format=custom', '--no-owner', '--no-acl', `--snapshot=${snapshot}`], pgEnv(databaseUrl).env);
    const objects = [];
    for (const row of rows) {
      const content = await store.get(row.object_key);
      if (content.length !== row.byte_size || sha(content) !== row.sha256) throw new Error('Private object changed during backup');
      objects.push({ key: row.object_key, contentType: row.content_type, size: content.length, sha256: row.sha256, contentBase64: content.toString('base64') });
    }
    const now = Date.now();
    const body = Buffer.from(JSON.stringify({ format: 'firelaunch-recovery-v1', createdAt: new Date(now).toISOString(), retainUntil: new Date(now + retentionDays * 86_400_000).toISOString(),
      databaseSha256: sha(database), databaseBase64: database.toString('base64'), objects }));
    if (body.length > MAX_ARCHIVE - 34) throw new Error('Recovery archive exceeds size limit');
    const encrypted = encrypt(body, keyHex);
    await client.query('COMMIT');
    return encrypted;
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); await audit(pool, 'backup_failed', 'failure'); throw error; }
  finally { client.release(); }
}

/** Creates only a new firelaunch_restore_* database. Destination object store must be separately isolated. */
export async function restoreRecoveryArchive(raw: Buffer, keyHex: string, destinationUrl: string, destinationStore: PrivateObjectStore): Promise<RecoveryManifest> {
  await audit(undefined, 'recovery_started', 'started');
  let checked: ReturnType<typeof verified>;
  try { checked = verified(raw, keyHex); }
  catch (error) { await audit(undefined, 'recovery_failed', 'failure'); throw error; }
  const { data, database } = checked;
  const { database: name, adminUrl, env } = pgEnv(destinationUrl);
  if (!/^firelaunch_restore_[a-z0-9_]{1,42}$/.test(name)) throw new Error('Disposable restore database name required');
  const admin = new Pool({ connectionString: adminUrl });
  let created = false;
  const uploaded: string[] = [];
  try {
    if ((await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])).rowCount) throw new Error('Restore destination already exists');
    for (const item of data.objects) {
      try { await destinationStore.get(item.key); throw new Error('Restore object destination is not empty'); }
      catch (error) { if (!/NoSuchKey|ENOENT|not found/i.test(String(error))) throw error; }
    }
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    await command('pg_restore', ['--no-owner', '--no-acl', '--exit-on-error', '-d', name], env, database);
    const restored = new Pool({ connectionString: destinationUrl });
    try {
      const rows = (await restored.query<{ object_key: string; sha256: string; byte_size: number }>('SELECT object_key, sha256, byte_size FROM private_objects ORDER BY object_key')).rows;
      if (rows.length !== data.objects.length || rows.some((row, index) => row.object_key !== data.objects[index]!.key || row.sha256 !== data.objects[index]!.sha256 || row.byte_size !== data.objects[index]!.size)) throw new Error('Restored metadata mismatch');
      await restored.query('DELETE FROM private_object_capabilities');
      for (const item of data.objects) { uploaded.push(item.key); await destinationStore.put(item.key, Buffer.from(item.contentBase64, 'base64'), item.contentType); }
      for (const item of data.objects) if (sha(await destinationStore.get(item.key)) !== item.sha256) throw new Error('Restored object mismatch');
      await audit(restored, 'recovery_succeeded', 'success', undefined, data.objects.length);
    } finally { await restored.end(); }
    return inspectRecoveryArchive(raw, keyHex);
  } catch (error) {
    for (const key of uploaded) await destinationStore.delete(key).catch(() => undefined);
    if (created) await admin.query(`DROP DATABASE ${name} WITH (FORCE)`).catch(() => undefined);
    await audit(undefined, 'recovery_failed', 'failure');
    throw error;
  } finally { await admin.end(); }
}

export async function saveRecoveryArchive(file: string, archive: Buffer): Promise<void> { await writeFile(file, archive, { flag: 'wx', mode: 0o600 }); }
export async function loadRecoveryArchive(file: string): Promise<Buffer> { const raw = await readFile(file); if (raw.length > MAX_ARCHIVE) throw new Error('Recovery archive exceeds size limit'); return raw; }
