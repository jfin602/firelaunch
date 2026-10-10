import { HostedProjectRepository } from './hosted-repository.js';
import { privateObjectStoreFromEnv, S3PrivateObjectStore } from './private-objects.js';
import { audit, cleanOrphans, deleteAccount, exportAccount, health } from './operations.js';
import { createRecoveryArchive, inspectRecoveryArchive, loadRecoveryArchive, openPrivatePayload, restoreRecoveryArchive, saveRecoveryArchive, sealPrivatePayload } from './recovery.js';

function args(): Map<string, string> {
  const parts = process.argv.slice(2);
  if (parts.length < 1 || (parts.length - 1) % 2) throw new Error('Expected command followed by --name value pairs');
  const result = new Map<string, string>([['command', parts[0]!]]);
  for (let i = 1; i < parts.length; i += 2) {
    if (!/^--[a-z-]+$/.test(parts[i]!) || result.has(parts[i]!)) throw new Error('Invalid operation arguments');
    result.set(parts[i]!, parts[i + 1]!);
  }
  return result;
}
function exact(input: Map<string, string>, command: string, keys: string[]): void {
  if (input.get('command') !== command || [...input.keys()].sort().join(',') !== ['command', ...keys].sort().join(',')) throw new Error(`Invalid ${command} arguments`);
}
function destinationStore() {
  const env = process.env;
  if (!env.FIRELAUNCH_RESTORE_OBJECT_BUCKET || env.FIRELAUNCH_RESTORE_OBJECT_BUCKET === env.FIRELAUNCH_OBJECT_BUCKET) throw new Error('Separate restore bucket required');
  return new S3PrivateObjectStore(env.FIRELAUNCH_RESTORE_OBJECT_BUCKET, { region: env.FIRELAUNCH_OBJECT_REGION ?? '',
    ...(env.FIRELAUNCH_OBJECT_ENDPOINT ? { endpoint: env.FIRELAUNCH_OBJECT_ENDPOINT } : {}),
    accessKeyId: env.FIRELAUNCH_OBJECT_ACCESS_KEY_ID ?? '', secretAccessKey: env.FIRELAUNCH_OBJECT_SECRET_ACCESS_KEY ?? '' });
}

async function main(): Promise<void> {
  const input = args();
  const command = input.get('command');
  const databaseUrl = process.env.FIRELAUNCH_DATABASE_URL ?? '';
  const key = process.env.FIRELAUNCH_RECOVERY_KEY ?? '';
  if (!databaseUrl) throw new Error('FIRELAUNCH_DATABASE_URL is required');
  if (command === 'restore') {
    exact(input, 'restore', ['--in']);
    const target = process.env.FIRELAUNCH_RESTORE_DATABASE_URL;
    if (!target || target === databaseUrl) throw new Error('Separate disposable restore database required');
    const archive = await loadRecoveryArchive(input.get('--in')!);
    const manifest = await restoreRecoveryArchive(archive, key, target, destinationStore());
    process.stdout.write(`${JSON.stringify({ status: 'restored', objects: manifest.objects.length, databaseSha256: manifest.databaseSha256 })}\n`);
    return;
  }
  const repository = await HostedProjectRepository.connect(databaseUrl);
  try {
    const store = privateObjectStoreFromEnv(process.env);
    if (command === 'backup') {
      exact(input, 'backup', ['--out', '--retain-days']);
      const archive = await createRecoveryArchive(repository.pool, databaseUrl, store, key, Number(input.get('--retain-days')));
      try { await saveRecoveryArchive(input.get('--out')!, archive); }
      catch (error) { await audit(repository.pool, 'backup_failed', 'failure'); throw error; }
      const manifest = inspectRecoveryArchive(archive, key);
      await audit(repository.pool, 'backup_succeeded', 'success', undefined, manifest.objects.length);
      process.stdout.write(`${JSON.stringify({ status: 'backed_up', objects: manifest.objects.length, retainUntil: manifest.retainUntil, databaseSha256: manifest.databaseSha256 })}\n`);
    } else if (command === 'health') {
      exact(input, 'health', []);
      const result = await health(repository.pool, store);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (result.status !== 'ok') process.exitCode = 1;
    } else if (command === 'cleanup') {
      exact(input, 'cleanup', []);
      const result = await cleanOrphans(repository.pool, store);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (result.failed) process.exitCode = 1;
    } else if (command === 'account-export') {
      exact(input, 'account-export', ['--account', '--out']);
      const account = input.get('--account')!;
      const result = await exportAccount(repository.pool, store, account);
      await saveRecoveryArchive(input.get('--out')!, sealPrivatePayload({ format: 'firelaunch-account-export-v1', accountId: account, data: result }, key));
      await audit(repository.pool, 'account_exported', 'success', account, result.objects.length);
      process.stdout.write(`${JSON.stringify({ status: 'exported', accountId: account, projects: result.projects.length, objects: result.objects.length })}\n`);
    } else if (command === 'account-delete') {
      exact(input, 'account-delete', ['--account', '--confirmed-export', '--confirm']);
      const account = input.get('--account')!;
      if (input.get('--confirm') !== account) throw new Error('Exact account confirmation required');
      const proof = openPrivatePayload(await loadRecoveryArchive(input.get('--confirmed-export')!), key) as { format?: string; accountId?: string };
      if (proof.format !== 'firelaunch-account-export-v1' || proof.accountId !== account) throw new Error('Matching encrypted account export required');
      const result = await deleteAccount(repository.pool, store, account);
      process.stdout.write(`${JSON.stringify({ status: result.failed ? 'deleted_cleanup_pending' : 'deleted', accountId: account, ...result })}\n`);
      if (result.failed) process.exitCode = 1;
    } else throw new Error('Unknown operation');
  } finally { await repository.pool.end(); }
}

main().catch(() => { process.stderr.write('Operation failed; see redacted audit and runbook.\n'); process.exitCode = 1; });
