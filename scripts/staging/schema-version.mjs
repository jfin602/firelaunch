import pg from 'pg';

const url = process.env.FIRELAUNCH_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('Staging database URL missing');
const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5000 });
try {
  const result = await pool.query('SELECT coalesce(max(version),0)::int AS version FROM firelaunch_schema_migrations');
  const version = result.rows[0]?.version;
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('Invalid staging schema');
  process.stdout.write(`${version}\n`);
} finally {
  await pool.end();
}
