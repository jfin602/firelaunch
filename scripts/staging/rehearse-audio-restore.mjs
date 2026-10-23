// Restore a protected pre-cutover archive into a disposable database and object
// directory. This never opens the live database or private S3 bucket for writes.
import { createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const run = promisify(execFile);
const restoreDump = (databaseName, database) => new Promise((resolve, reject) => {
  const child = spawn('runuser', ['-u', 'postgres', '--', 'pg_restore', '--no-owner', '--no-acl', '--exit-on-error', '-d', databaseName],
    { stdio: ['pipe', 'ignore', 'pipe'] });
  let error = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { error = (error + chunk).slice(-2048); });
  child.stdin.on('error', () => { /* close reports the failed restore */ });
  child.on('error', reject);
  child.on('close', code => code === 0 ? resolve() : reject(new Error(`Disposable database restore failed: ${error}`)));
  child.stdin.end(database);
});
const [release, archivePath] = process.argv.slice(2);
if (!release?.startsWith('/srv/firelaunch/releases/') || !archivePath?.startsWith('/var/backups/firelaunch-staging/') ||
    !/^[a-f0-9]{64}$/i.test(process.env.FIRELAUNCH_RECOVERY_KEY ?? '')) throw new Error('Unsafe recovery rehearsal input');
const { inspectRecoveryArchive } = await import(pathToFileURL(`${release}/apps/server/dist/recovery.js`).href);
const encrypted = await readFile(archivePath);
const manifest = inspectRecoveryArchive(encrypted, process.env.FIRELAUNCH_RECOVERY_KEY);
if (encrypted.subarray(0, 6).toString() !== 'FLREC1') throw new Error('Unsupported recovery archive');
const decipher = createDecipheriv('aes-256-gcm', Buffer.from(process.env.FIRELAUNCH_RECOVERY_KEY, 'hex'), encrypted.subarray(6, 18));
decipher.setAuthTag(encrypted.subarray(-16));
const data = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(18, -16)), decipher.final()]).toString('utf8'));
const database = Buffer.from(data.databaseBase64, 'base64');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha(database) !== manifest.databaseSha256 || data.objects.length !== manifest.objects.length) throw new Error('Recovery inspection changed');
const scratch = await mkdtemp('/var/backups/firelaunch-staging/audio-restore-rehearsal-');
const databaseName = `firelaunch_restore_audio_${randomBytes(8).toString('hex')}`;
let created = false;
try {
  await run('runuser', ['-u', 'postgres', '--', 'createdb', databaseName]); created = true;
  await restoreDump(databaseName, database);
  const { stdout } = await run('runuser', ['-u', 'postgres', '--', 'psql', '-At', '-d', databaseName,
    '-c', 'SELECT count(*)::text || chr(32) || coalesce(sum(byte_size), 0)::text FROM private_objects']);
  const [count, total] = stdout.trim().split(' ').map(Number);
  if (count !== manifest.objects.length || total !== manifest.objects.reduce((sum, item) => sum + item.size, 0))
    throw new Error('Restored private-object metadata differs from archive');
  for (const item of data.objects) {
    const target = path.join(scratch, item.key);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, Buffer.from(item.contentBase64, 'base64'), { flag: 'wx', mode: 0o600 });
    if (sha(await readFile(target)) !== item.sha256) throw new Error('Restored private object differs from archive');
  }
  process.stdout.write(`Isolated recovery rehearsal passed: ${count} objects, database SHA-256 ${manifest.databaseSha256}\n`);
} finally {
  if (created) await run('runuser', ['-u', 'postgres', '--', 'dropdb', '--if-exists', '--force', databaseName]).catch(() => undefined);
  await rm(scratch, { recursive: true, force: true });
}
