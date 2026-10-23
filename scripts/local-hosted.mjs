#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, chmodSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { S3Client, CreateBucketCommand, HeadBucketCommand, GetBucketPolicyCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const state = join(root, '.codex-runs', 'c2-local');
const envFile = join(root, '.env.c2-local');
const command = process.argv[2];
if (!['setup', 'start', 'check'].includes(command)) throw new Error('Use setup, start, or check');
mkdirSync(state, { recursive: true, mode: 0o700 });
chmodSync(state, 0o700);
const pgBin = '/usr/lib/postgresql/16/bin';
const binary = (name) => existsSync(join(pgBin, name)) ? join(pgBin, name) : name;
const run = (program, args, options = {}) => {
  const result = spawnSync(program, args, { stdio: 'ignore', ...options });
  if (result.status !== 0) throw new Error(`${program.split('/').at(-1)} failed; inspect local service setup`);
};
const load = () => {
  if (!existsSync(envFile)) throw new Error('Run local-hosted setup first');
  const env = {};
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) throw new Error('Invalid local environment file');
    env[match[1]] = match[2];
  }
  return env;
};
const save = (env) => {
  const content = Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  writeFileSync(envFile, content, { mode: 0o600, flag: 'wx' });
};
const pgData = join(state, 'postgres');
const minioData = join(state, 'minio');
const minioLog = join(state, 'minio.log');
const s3Endpoint = 'http://127.0.0.1:9000';
const origin = 'http://127.0.0.1:4173';
const callback = env => `${env.VEGALAUNCH_PUBLIC_ORIGIN}/api/auth/callback`;
const pgUrl = (password, name) => `postgresql://jfin:${encodeURIComponent(password)}@127.0.0.1:55437/${name}`;
const secret = () => randomBytes(32).toString('hex');
const pgCtl = (action) => run(binary('pg_ctl'), ['-D', pgData, '-l', join(state, 'postgres.log'), '-o', `-h 127.0.0.1 -p 55437 -k ${state}`, action]);
const pgReady = () => spawnSync(binary('pg_isready'), ['-h', '127.0.0.1', '-p', '55437'], { stdio: 'ignore' }).status === 0;
const s3Ready = async () => { try { return (await fetch(`${s3Endpoint}/minio/health/live`, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; } };
async function startServices(env) {
  if (!pgReady()) pgCtl('start');
  if (!await s3Ready()) {
    const minioBin = process.env.MINIO_BIN || (existsSync(join(state, 'toolchain', 'minio')) ? join(state, 'toolchain', 'minio') : 'minio');
    if (spawnSync('which', [minioBin], { stdio: 'ignore' }).status !== 0 && !existsSync(minioBin))
      throw new Error('MinIO executable missing: install a trusted MinIO build or set MINIO_BIN');
    mkdirSync(minioData, { recursive: true, mode: 0o700 });
    const log = openSync(minioLog, 'a', 0o600);
    const child = spawn(minioBin, ['server', '--address', '127.0.0.1:9000', '--console-address', '127.0.0.1:9001', minioData], {
      env: { ...process.env, MINIO_ROOT_USER: env.VEGALAUNCH_OBJECT_ACCESS_KEY_ID, MINIO_ROOT_PASSWORD: env.VEGALAUNCH_OBJECT_SECRET_ACCESS_KEY,
        MINIO_KMS_SECRET_KEY: `local-c2:${Buffer.from(env.VEGALAUNCH_LOCAL_KMS_KEY, 'hex').toString('base64')}` },
      stdio: ['ignore', log, log], detached: true
    });
    child.unref(); closeSync(log);
    for (let i = 0; i < 40 && !await s3Ready(); i++) await delay(250);
    if (!await s3Ready()) throw new Error('MinIO did not start; inspect restricted .codex-runs/c2-local/minio.log');
  }
}
function s3(env) {
  return new S3Client({ region: 'us-east-1', endpoint: s3Endpoint, forcePathStyle: true,
    credentials: { accessKeyId: env.VEGALAUNCH_OBJECT_ACCESS_KEY_ID, secretAccessKey: env.VEGALAUNCH_OBJECT_SECRET_ACCESS_KEY } });
}
async function checkBuckets(env, create = false) {
  const client = s3(env);
  try {
    for (const bucket of ['vegalaunch-source', 'vegalaunch-restore']) {
      try { await client.send(new HeadBucketCommand({ Bucket: bucket })); }
      catch (error) {
        if (!create || error?.$metadata?.httpStatusCode !== 404) throw error;
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
      }
      try { await client.send(new GetBucketPolicyCommand({ Bucket: bucket })); throw new Error(`${bucket} has a bucket policy; expected private default`); }
      catch (error) { if (error?.name !== 'NoSuchBucketPolicy') throw error; }
      try { await fetch(`${s3Endpoint}/${bucket}/`, { signal: AbortSignal.timeout(3000) }).then(response => {
        if (response.status !== 403) throw new Error(`${bucket} allows anonymous access`);
      }); } catch (error) { throw error; }
    }
  } finally { client.destroy(); }
}
async function setup() {
  let env;
  if (existsSync(envFile)) {
    env = load();
    validateBase(env);
  } else {
    if (existsSync(pgData)) throw new Error('Local PostgreSQL data already exists without configuration; inspect before retrying');
    const password = secret();
    const passwordFile = join(state, 'postgres-password');
    writeFileSync(passwordFile, password + '\n', { mode: 0o600, flag: 'wx' });
    try { run(binary('initdb'), ['-D', pgData, '-U', 'jfin', '-A', 'scram-sha-256', '--pwfile', passwordFile]); }
    finally { await import('node:fs/promises').then(fs => fs.rm(passwordFile, { force: true })); }
    env = {
    NODE_ENV: 'development', VEGALAUNCH_MODE: 'hosted', VEGALAUNCH_LOCAL_HOSTED: '1', VEGALAUNCH_PUBLIC_ORIGIN: origin,
    VEGALAUNCH_OIDC_CLIENT_ID: '', VEGALAUNCH_OIDC_CLIENT_SECRET: '', VEGALAUNCH_OIDC_ISSUER: 'https://accounts.google.com',
    DATABASE_URL: pgUrl(password, 'vegalaunch_c2_source'), VEGALAUNCH_DATABASE_URL: pgUrl(password, 'vegalaunch_c2_source'),
    VEGALAUNCH_RESTORE_DATABASE_URL: pgUrl(password, `vegalaunch_restore_c2_${randomBytes(4).toString('hex')}`),
    VEGALAUNCH_OBJECT_STORE: 's3', VEGALAUNCH_OBJECT_BUCKET: 'vegalaunch-source', VEGALAUNCH_RESTORE_OBJECT_BUCKET: 'vegalaunch-restore',
    VEGALAUNCH_OBJECT_REGION: 'us-east-1', VEGALAUNCH_OBJECT_ENDPOINT: s3Endpoint,
    VEGALAUNCH_OBJECT_ACCESS_KEY_ID: `c2${randomBytes(10).toString('hex')}`,
    VEGALAUNCH_OBJECT_SECRET_ACCESS_KEY: secret(), VEGALAUNCH_LOCAL_KMS_KEY: secret(), VEGALAUNCH_RECOVERY_KEY: secret(), PORT: '4174'
    };
    save(env);
  }
  await startServices(env);
  const adminUrl = new URL(env.DATABASE_URL); adminUrl.pathname = '/postgres';
  const admin = new Pool({ connectionString: adminUrl.toString() });
  try {
    const found = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'vegalaunch_c2_source'");
    if (!found.rowCount) await admin.query('CREATE DATABASE vegalaunch_c2_source');
  } finally { await admin.end(); }
  await checkBuckets(env, true);
  process.stdout.write(`Local c2 resources ready. Set Google client credentials in .env.c2-local (mode 0600).\nRedirect URI: ${callback(env)}\n`);
}
function validateBase(env) {
  const required = ['DATABASE_URL', 'VEGALAUNCH_RECOVERY_KEY', 'VEGALAUNCH_OBJECT_ACCESS_KEY_ID', 'VEGALAUNCH_OBJECT_SECRET_ACCESS_KEY', 'VEGALAUNCH_LOCAL_KMS_KEY'];
  for (const key of required) if (!env[key]) throw new Error(`${key} is required in .env.c2-local`);
  const source = new URL(env.DATABASE_URL);
  const restore = new URL(env.VEGALAUNCH_RESTORE_DATABASE_URL ?? '');
  if (env.NODE_ENV !== 'development' || env.VEGALAUNCH_MODE !== 'hosted' || env.VEGALAUNCH_LOCAL_HOSTED !== '1' ||
      !['http://127.0.0.1:4173', 'http://localhost:4173'].includes(env.VEGALAUNCH_PUBLIC_ORIGIN) || env.VEGALAUNCH_OBJECT_ENDPOINT !== s3Endpoint ||
      env.VEGALAUNCH_OBJECT_BUCKET !== 'vegalaunch-source' || env.VEGALAUNCH_RESTORE_OBJECT_BUCKET !== 'vegalaunch-restore' ||
      env.VEGALAUNCH_DATABASE_URL !== env.DATABASE_URL || source.hostname !== '127.0.0.1' || source.port !== '55437' || source.pathname !== '/vegalaunch_c2_source' ||
      restore.hostname !== '127.0.0.1' || restore.port !== '55437' || !/^\/vegalaunch_restore_c2_[a-f0-9]{8}$/.test(restore.pathname)) throw new Error('Unexpected local hosted configuration');
}
function validate(env) {
  validateBase(env);
  for (const key of ['VEGALAUNCH_OIDC_CLIENT_ID', 'VEGALAUNCH_OIDC_CLIENT_SECRET']) if (!env[key]) throw new Error(`${key} is required in .env.c2-local`);
}
async function start() {
  const env = load(); validate(env);
  await startServices(env); await checkBuckets(env);
  process.stdout.write(`Studio: ${env.VEGALAUNCH_PUBLIC_ORIGIN}\nGoogle redirect URI: ${callback(env)}\n`);
  const children = [spawn('node', ['--import', 'tsx', 'apps/server/src/index.ts'], { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit' }),
    spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', new URL(env.VEGALAUNCH_PUBLIC_ORIGIN).hostname, '--port', '4173'],
      { cwd: join(root, 'apps', 'studio'), env: { ...process.env, ...env }, stdio: 'inherit' })];
  const stop = () => children.forEach(child => child.kill('SIGTERM'));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  await Promise.race(children.map(child => new Promise(resolve => child.on('exit', resolve)))); stop();
}
async function check() {
  const env = load(); validateBase(env); await startServices(env); await checkBuckets(env);
  const admin = new Pool({ connectionString: env.DATABASE_URL });
  try { await admin.query('SELECT 1'); } finally { await admin.end(); }
  process.stdout.write(`PostgreSQL and private MinIO buckets ready. Google redirect URI: ${callback(env)}\n`);
}
try { if (command === 'setup') await setup(); else if (command === 'start') await start(); else await check(); }
catch (error) { process.stderr.write(`Local hosted ${command} failed: ${error.message}\n`); process.exitCode = 1; }
