import { HostedProjectRepository } from '../hosted-repository.js';
import { LegacyImporter } from './legacy-import.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const value = (flag: string) => { const position = args.indexOf(flag); return position < 0 ? undefined : args[position + 1]; };
  const dataRoot = value('--data-root');
  const account = value('--creator-account');
  const apply = args.includes('--apply');
  const expected = ['--data-root', dataRoot, '--creator-account', account, ...(apply ? ['--apply'] : [])];
  if (!dataRoot || !account || args.length !== expected.length || args.some((arg, index) => arg !== expected[index]))
    throw new Error('Usage: npm run migration:p0 -- --data-root ABSOLUTE_PATH --creator-account cr_ID [--apply]');
  if (!dataRoot.startsWith('/')) throw new Error('Legacy data root must be absolute');
  const repository = await HostedProjectRepository.connect(process.env.FIRELAUNCH_DATABASE_URL ?? '');
  try {
    const importer = new LegacyImporter(repository.pool, dataRoot, account);
    const results = [];
    for (const id of await importer.projectIds()) results.push(await importer.run(id, apply));
    process.stdout.write(`${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', destination: account, results }, null, 2)}\n`);
    if (results.some(result => result.status === 'error' || result.status === 'collision')) process.exitCode = 1;
  } finally { await repository.pool.end(); }
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : 'Import failed'}\n`); process.exitCode = 1; });
