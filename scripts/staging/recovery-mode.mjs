#!/usr/bin/env node
// Explicit, isolated staging recovery rehearsal. Never switches a live release or database.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ACCOUNT = '363242105231';
const REGION = 'us-east-2';
const SOURCE = `vegalaunch-staging-originals-${ACCOUNT}-use2`;
const DESTINATION = `vegalaunch-staging-media-${ACCOUNT}-use2`;
const RECOVERY_ROLE = `arn:aws:iam::${ACCOUNT}:role/vegalaunch/vegalaunch-staging-private-recovery`;
const DEPLOYER = /^arn:aws:sts::363242105231:assumed-role\/VegaLaunch-Staging-Deployer\/[^/]+$/;
const RECOVERY = /^arn:aws:sts::363242105231:assumed-role\/vegalaunch-staging-private-recovery\/[^/]+$/;
const KEY = /^private\/[a-f0-9]{64}$/;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };

export function parseArgs(args) {
  if (args.length % 2 !== 0) fail('Use --name value pairs');
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    if (!/^--[a-z-]+$/.test(name) || name in result) fail('Invalid or repeated option');
    result[name.slice(2)] = args[index + 1];
  }
  if (!['identity', 'backup', 'restore', 'verify'].includes(result.mode)) fail('Mode must be identity, backup, restore or verify');
  const allowed = new Set(['mode', 'release', 'archive', 'evidence', 'authorization-file', 'source-profile']);
  if (Object.keys(result).some(name => !allowed.has(name))) fail('Unknown option');
  if (!result.release || !result.archive || !result.evidence) fail('Release, archive and evidence paths required');
  if (['backup', 'restore'].includes(result.mode) && !result['authorization-file']) fail('Written authorization file required for backup or restore');
  return result;
}

export function validateScope(env, mode, authorization) {
  if (env.VEGALAUNCH_OBJECT_STORE !== 's3' || env.VEGALAUNCH_OBJECT_AUTH !== 'aws-profile' ||
      env.VEGALAUNCH_OBJECT_REGION !== REGION || env.VEGALAUNCH_OBJECT_BUCKET !== SOURCE ||
      env.VEGALAUNCH_RESTORE_OBJECT_BUCKET !== DESTINATION || env.VEGALAUNCH_OBJECT_ENDPOINT ||
      !/^[a-f0-9]{64}$/i.test(env.VEGALAUNCH_RECOVERY_KEY ?? '')) fail('Recovery configuration is outside approved AWS scope');
  const source = new URL(env.VEGALAUNCH_DATABASE_URL ?? '');
  const sourceName = decodeURIComponent(source.pathname.slice(1));
  if (!/^vegalaunch_(qualification|restore)_[a-z0-9_]{1,42}$/.test(sourceName)) fail('Source database must be isolated');
  if (mode === 'restore' || mode === 'verify') {
    const target = new URL(env.VEGALAUNCH_RESTORE_DATABASE_URL ?? '');
    if (!/^vegalaunch_restore_[a-z0-9_]{1,42}$/.test(decodeURIComponent(target.pathname.slice(1))) || target.href === source.href)
      fail('Destination database must be a separate isolated restore database');
  }
  if (['backup', 'restore'].includes(mode)) {
    if (authorization?.account !== ACCOUNT || authorization?.region !== REGION ||
        authorization?.mode !== mode || authorization?.sourceBucket !== SOURCE ||
        authorization?.destinationBucket !== DESTINATION ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{3,80}$/.test(authorization?.approvalId ?? '') ||
        !Number.isFinite(Date.parse(authorization?.expiresAt)) || Date.parse(authorization.expiresAt) <= Date.now())
      fail('Authorization is absent, expired or outside approved scope');
  }
}

function aws(args, env, outputFile) {
  const command = ['--region', REGION, ...args];
  if (outputFile) command.push(outputFile);
  return execFileSync('aws', command, { env, encoding: outputFile ? undefined : 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20_000_000 });
}
function awsJson(args, env) { return JSON.parse(aws([...args, '--output', 'json'], env)); }
function checkIdentity(identity, pattern) {
  if (identity.Account !== ACCOUNT || !pattern.test(identity.Arn)) fail('Unexpected AWS identity');
}
function profileEnv(base, credentials, temp) {
  const file = join(temp, 'credentials');
  const config = join(temp, 'config');
  for (const field of ['AccessKeyId', 'SecretAccessKey', 'SessionToken']) {
    if (typeof credentials[field] !== 'string' || !/^[A-Za-z0-9/+=]+$/.test(credentials[field])) fail('Invalid temporary credential');
  }
  writeFileSync(file, `[vegalaunch-staging-recovery]\naws_access_key_id=${credentials.AccessKeyId}\naws_secret_access_key=${credentials.SecretAccessKey}\naws_session_token=${credentials.SessionToken}\n`, { mode: 0o600, flag: 'wx' });
  writeFileSync(config, `[profile vegalaunch-staging-recovery]\nregion=${REGION}\n`, { mode: 0o600, flag: 'wx' });
  const env = { ...base, AWS_SHARED_CREDENTIALS_FILE: file, AWS_CONFIG_FILE: config, AWS_PROFILE: 'vegalaunch-staging-recovery' };
  delete env.AWS_ACCESS_KEY_ID; delete env.AWS_SECRET_ACCESS_KEY; delete env.AWS_SESSION_TOKEN;
  return env;
}
function manifestKeys(manifest) {
  const keys = manifest.objects.map(object => object.key);
  if (keys.some(key => !KEY.test(key)) || new Set(keys).size !== keys.length) fail('Archive contains unsafe or duplicate object keys');
  return keys;
}
function assertVacant(key, env) {
  const versions = awsJson(['s3api', 'list-object-versions', '--bucket', DESTINATION, '--prefix', key, '--max-keys', '1000'], env);
  if (versions.IsTruncated || [...(versions.Versions ?? []), ...(versions.DeleteMarkers ?? [])].some(entry => entry.Key === key))
    fail('Recovery destination has an existing current or historical object');
}
function inspectObject(bucket, object, env, temp) {
  const metadata = awsJson(['s3api', 'head-object', '--bucket', bucket, '--key', object.key], env);
  if (metadata.ServerSideEncryption !== 'AES256' || metadata.ContentType !== object.contentType || metadata.ContentLength !== object.size)
    fail('Object metadata or AES256 encryption mismatch');
  const file = join(temp, 'object');
  aws(['s3api', 'get-object', '--bucket', bucket, '--key', object.key], env, file);
  const digest = sha(readFileSync(file));
  rmSync(file);
  if (digest !== object.sha256) fail('Object SHA-256 mismatch');
  return metadata.VersionId ?? null;
}
async function schemaCheck(release, env) {
  const require = createRequire(join(release, 'package.json'));
  const { Pool } = require('pg');
  const migrations = readdirSync(join(release, 'apps/server/migrations')).filter(name => /^\d{3}_.+\.up\.sql$/.test(name));
  const maximum = Math.max(...migrations.map(name => Number(name.slice(0, 3))));
  const pool = new Pool({ connectionString: env.VEGALAUNCH_DATABASE_URL, max: 1 });
  try {
    const result = await pool.query('SELECT max(version)::int AS version FROM vegalaunch_schema_migrations');
    if (result.rows[0]?.version !== maximum) fail('Release and source database schema differ; backup would migrate the database');
    return maximum;
  } finally { await pool.end(); }
}
async function referenceCheck(release, url, manifest) {
  const require = createRequire(join(release, 'package.json'));
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const rows = (await pool.query('SELECT object_key, sha256, byte_size, content_type FROM private_objects ORDER BY object_key')).rows;
    const expected = [...manifest.objects].sort((a, b) => a.key.localeCompare(b.key));
    if (rows.length !== expected.length || rows.some((row, index) => row.object_key !== expected[index].key ||
        row.sha256 !== expected[index].sha256 || row.byte_size !== expected[index].size ||
        row.content_type !== expected[index].contentType)) fail('Database and object reference mismatch');
  } finally { await pool.end(); }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceProfile = args['source-profile'] ?? 'vegalaunch-deployer';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(sourceProfile)) fail('Invalid source profile');
  const release = resolve(args.release);
  if (!readFileSync(join(release, 'package.json'))) fail('Release unavailable');
  const authorization = args['authorization-file'] ? JSON.parse(readFileSync(args['authorization-file'], 'utf8')) : undefined;
  validateScope(process.env, args.mode, authorization);
  const started = performance.now();
  const temp = mkdtempSync(join(tmpdir(), 'vegalaunch-recovery-'));
  try {
    const original = { ...process.env, AWS_PROFILE: sourceProfile };
    delete original.AWS_ACCESS_KEY_ID; delete original.AWS_SECRET_ACCESS_KEY; delete original.AWS_SESSION_TOKEN;
    checkIdentity(awsJson(['sts', 'get-caller-identity'], original), DEPLOYER);
    const assumed = awsJson(['sts', 'assume-role', '--role-arn', RECOVERY_ROLE,
      '--role-session-name', `vegalaunch-recovery-${Date.now()}`,
      '--source-identity', 'vegalaunch-jfin', '--duration-seconds', '3600'], original);
    const env = profileEnv(process.env, assumed.Credentials, temp);
    checkIdentity(awsJson(['sts', 'get-caller-identity'], env), RECOVERY);
    const evidence = { status: 'COMPLETE', mode: args.mode, account: ACCOUNT, region: REGION,
      recoveryRole: RECOVERY_ROLE, approvalId: authorization?.approvalId ?? null,
      startedUtc: new Date().toISOString(), schema: null, objects: null, archiveSha256: null, databaseSha256: null };
    if (args.mode !== 'identity') {
      evidence.schema = await schemaCheck(release, env);
      const archive = resolve(args.archive);
      if (args.mode === 'backup') {
        execFileSync('node', [join(release, 'apps/server/dist/operations-cli.js'), 'backup', '--out', archive, '--retain-days', '30'],
          { env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 100_000 });
      }
      const raw = readFileSync(archive);
      const { inspectRecoveryArchive } = await import(pathToFileURL(join(release, 'apps/server/dist/recovery.js')).href);
      const manifest = inspectRecoveryArchive(raw, env.VEGALAUNCH_RECOVERY_KEY);
      manifestKeys(manifest);
      evidence.objects = manifest.objects.length;
      evidence.archiveSha256 = sha(raw);
      evidence.databaseSha256 = manifest.databaseSha256;
      if (args.mode === 'restore') for (const object of manifest.objects) assertVacant(object.key, env);
      if (args.mode === 'backup') for (const object of manifest.objects) inspectObject(SOURCE, object, env, temp);
      if (args.mode === 'restore') {
        execFileSync('node', [join(release, 'apps/server/dist/operations-cli.js'), 'restore', '--in', archive],
          { env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 100_000 });
      }
      if (args.mode === 'restore' || args.mode === 'verify') {
        await referenceCheck(release, env.VEGALAUNCH_RESTORE_DATABASE_URL, manifest);
        for (const object of manifest.objects) inspectObject(DESTINATION, object, env, temp);
      }
    }
    evidence.durationSeconds = Number(((performance.now() - started) / 1000).toFixed(3));
    evidence.finishedUtc = new Date().toISOString();
    writeFileSync(args.evidence, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    process.stdout.write(`Recovery ${args.mode} complete; sanitized evidence: ${args.evidence}\n`);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
if (process.argv[1] && basename(process.argv[1]) === 'recovery-mode.mjs')
  main().catch(() => {
    const index = process.argv.indexOf('--evidence');
    if (index >= 0 && process.argv[index + 1]) {
      try { writeFileSync(process.argv[index + 1], `${JSON.stringify({ status: 'INCOMPLETE', finishedUtc: new Date().toISOString(),
        note: 'Inspect the isolated database and destination object versions before retrying.' }, null, 2)}\n`, { mode: 0o600, flag: 'wx' }); }
      catch { /* Never overwrite earlier qualification evidence. */ }
    }
    process.stderr.write('Recovery operation failed. Preserve archive and inspect destination before retrying.\n');
    process.exitCode = 1;
  });
