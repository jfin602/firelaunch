import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const release = process.argv[2];
if (!release?.startsWith('/srv/firelaunch/releases/')) throw new Error('Staging release required');
const require = createRequire(`${release}/package.json`);
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.VEGALAUNCH_DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock($1)', [482921]);
  const rows = (await client.query('SELECT version FROM firelaunch_schema_migrations ORDER BY version DESC LIMIT 1')).rows;
  if (rows[0]?.version !== 15) throw new Error('Schema 15 is not the active tip');
  const sql = await readFile(`${release}/apps/server/migrations/015_private_audio.down.sql`, 'utf8');
  await client.query(sql);
  await client.query('DELETE FROM firelaunch_schema_migrations WHERE version = 15');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally { client.release(); await pool.end(); }
