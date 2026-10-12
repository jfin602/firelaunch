import { Pool } from 'pg';
import { mediaStorageFromEnv } from './media-storage.js';
import { MediaWorkerRepository } from './media-worker-repository.js';
import { runOneMediaJob, runTool } from './media-worker.js';

const mode = process.argv[2];
if ((mode !== '--once' && mode !== '--drain') || process.argv.length !== 3)
  throw new Error('Usage: media-worker-cli.ts --once|--drain');
if (!process.env.FIRELAUNCH_WORKER_DATABASE_URL)
  throw new Error('FIRELAUNCH_WORKER_DATABASE_URL is required');
const storage = mediaStorageFromEnv(process.env);
const pool = new Pool({ connectionString: process.env.FIRELAUNCH_WORKER_DATABASE_URL, max: 1 });
const controller = new AbortController();
process.once('SIGINT', () => controller.abort());
process.once('SIGTERM', () => controller.abort());
try {
  const ffmpeg = await runTool('ffmpeg',['-version'],10_000,controller.signal);
  const ffprobe = await runTool('ffprobe',['-version'],10_000,controller.signal);
  process.stdout.write(`${ffmpeg.split('\n')[0]}\n${ffprobe.split('\n')[0]}\n`);
  const repo = new MediaWorkerRepository(pool);
  do {
    const result = await runOneMediaJob(repo,storage,controller.signal);
    process.stdout.write(`media worker: ${result}\n`);
    if (result === 'idle' || controller.signal.aborted) break;
    if (mode === '--once') break;
  } while (true);
} finally { await pool.end(); }
