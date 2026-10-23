import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const [release, file] = process.argv.slice(2);
if (!release?.startsWith('/srv/vegalaunch/releases/') || !file ||
    !/^[a-f0-9]{64}$/i.test(process.env.VEGALAUNCH_RECOVERY_KEY ?? '')) {
  throw new Error('Archive inspection configuration incomplete');
}
const { inspectRecoveryArchive } = await import(pathToFileURL(`${release}/apps/server/dist/recovery.js`).href);
const manifest = inspectRecoveryArchive(await readFile(file), process.env.VEGALAUNCH_RECOVERY_KEY);
process.stdout.write(`${manifest.objects.length} ${manifest.databaseSha256}\n`);
