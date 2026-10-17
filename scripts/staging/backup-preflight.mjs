import { createRequire } from 'node:module';

const [release] = process.argv.slice(2);
if (!release?.startsWith('/srv/firelaunch/releases/')) throw new Error('Staging release required');
const require = createRequire(`${release}/package.json`);
const pg = require('pg');

const url = process.env.FIRELAUNCH_DATABASE_URL;
if (!url || !/^[a-f0-9]{64}$/i.test(process.env.FIRELAUNCH_RECOVERY_KEY ?? '') ||
    process.env.FIRELAUNCH_OBJECT_STORE !== 's3' || !process.env.FIRELAUNCH_OBJECT_BUCKET ||
    (process.env.FIRELAUNCH_OBJECT_AUTH === 'aws-profile'
      ? (!process.env.AWS_PROFILE || Boolean(process.env.FIRELAUNCH_OBJECT_ENDPOINT))
      : (Boolean(process.env.FIRELAUNCH_OBJECT_AUTH && process.env.FIRELAUNCH_OBJECT_AUTH !== 'static') ||
        !process.env.FIRELAUNCH_OBJECT_ACCESS_KEY_ID || !process.env.FIRELAUNCH_OBJECT_SECRET_ACCESS_KEY))) {
  throw new Error('Staging backup configuration incomplete');
}
const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
try {
  const result = await pool.query(`SELECT
    (SELECT max(version)::int FROM firelaunch_schema_migrations) AS migration,
    pg_database_size(current_database())::bigint AS database_bytes,
    (SELECT count(*)::int FROM private_objects) AS object_count,
    (SELECT coalesce(sum(byte_size), 0)::bigint FROM private_objects) AS object_bytes`);
  const row = result.rows[0];
  if (!Number.isSafeInteger(row?.migration) || row.migration < 1 ||
      !Number.isSafeInteger(Number(row.database_bytes)) ||
      !Number.isSafeInteger(row.object_count) ||
      !Number.isSafeInteger(Number(row.object_bytes))) throw new Error('Invalid backup size estimate');
  process.stdout.write(`${row.migration} ${row.database_bytes} ${row.object_count} ${row.object_bytes}\n`);
} finally {
  await pool.end();
}
