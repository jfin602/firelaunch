import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, statfs, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { Pool } from 'pg';
import { NativeBuildQueue } from './native-build-queue.js';
import { assertNativeBuildLimits } from './native-build-limits.js';
import { RELEASE_BUILD_COMMAND, type NativeBuildEvidence, type ReleaseBuildInput } from './release-build.js';

type Job = NonNullable<Awaited<ReturnType<NativeBuildQueue['claim']>>>;
const MAX_VPKG = 500_000_000;
const SDK_WORKSPACE = '/opt/vega/sdk/vega-sdk/main/0.24.12112/workspace';
function required(name: string): string { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value; }
function path(name: string): string { const raw = required(name); const value = resolve(raw);
  if (!isAbsolute(raw) || value === '/') throw new Error(`Unsafe ${name}`); return value; }
async function digest(file: string): Promise<string> { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }

async function runSandbox(image: string, jobDir: string, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new Error('Lease lost before sandbox start');
  await cp(join(image, SDK_WORKSPACE.slice(1)), join(jobDir, 'sdk-workspace'), { recursive: true });
  const args = ['--unshare-user','--unshare-pid','--unshare-net','--unshare-ipc','--unshare-uts',
    '--die-with-parent','--new-session','--clearenv',
    '--ro-bind',image,'/','--bind',jobDir,'/job',
    '--bind',join(jobDir,'sdk-workspace'),SDK_WORKSPACE,'--proc','/proc','--tmpfs','/proc/sys','--dev','/dev',
    '--ro-bind','/sys/fs/cgroup','/sys/fs/cgroup','--tmpfs','/tmp',
    '--setenv','HOME','/tmp','--setenv','PATH','/usr/bin:/bin:/opt/vega/bin',
    '--chdir','/job','/usr/bin/node','/opt/firelaunch-build-app/apps/server/dist/native-build-child.js'];
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn('/usr/bin/bwrap', args, { env: { PATH: '/usr/bin:/bin' },
      stdio: ['ignore','ignore','ignore'], detached: true });
    const stop = () => { try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); } };
    const timer = setTimeout(stop, 12 * 60_000);
    signal.addEventListener('abort', stop, { once: true });
    child.on('error', reject);
    child.on('close', code => { clearTimeout(timer); signal.removeEventListener('abort', stop);
      if (code === 0 && !signal.aborted) resolvePromise(); else reject(new Error('Sandbox build failed or stopped')); });
  });
}

/** Independent readback after all creator build processes have exited. */
async function inspectPackage(image: string, file: string, expectedPackageId: string, root: string): Promise<void> {
  const inspection = await mkdtemp(join(root,'jobs','inspect-'));
  try {
  await cp(join(image,SDK_WORKSPACE.slice(1)),join(inspection,'sdk-workspace'),{ recursive:true });
  async function command(args: string[]): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      let output = '';
      const child = spawn('/usr/bin/bwrap', [
        '--unshare-user','--unshare-pid','--unshare-net','--unshare-ipc','--unshare-uts',
        '--die-with-parent','--new-session','--clearenv','--ro-bind',image,'/',
        '--bind',join(inspection,'sdk-workspace'),SDK_WORKSPACE,
        '--ro-bind',file,'/artifact.vpkg','--proc','/proc','--tmpfs','/proc/sys','--dev','/dev','--tmpfs','/tmp',
        '--setenv','HOME','/tmp','--setenv','PATH','/usr/bin:/bin:/opt/vega/bin',
        '--chdir','/tmp','/usr/bin/vpt',...args,'/artifact.vpkg'],
      { env: { PATH: '/usr/bin:/bin' }, stdio: ['ignore','pipe','ignore'] });
      const timer = setTimeout(() => child.kill('SIGKILL'), 30_000);
      child.stdout?.on('data',(chunk: Buffer) => { output += chunk.toString('utf8');
        if (output.length > 64_000) child.kill('SIGKILL'); });
      child.on('error', reject);
      child.on('close',code => { clearTimeout(timer);
        if (code === 0 && output.length <= 64_000) resolvePromise(output);
        else reject(new Error('Independent VPT inspection failed')); });
    });
  }
  const info = JSON.parse(await command(['info','--json'])) as { id?: unknown; os_version_registry?: { os_versions?: unknown } };
  if (info.id !== expectedPackageId || !Array.isArray(info.os_version_registry?.os_versions) ||
    !info.os_version_registry.os_versions.includes('1.2')) throw new Error('Foreign VPKG package or OS');
  await command(['validate','--no-color']);
  } finally { await rm(inspection,{ recursive:true,force:true }); }
}

async function processJob(queue: NativeBuildQueue, job: Job, root: string, image: string): Promise<void> {
  const controller = new AbortController();
  const timer = setInterval(() => { queue.heartbeat(job.jobId, job.leaseToken)
    .then(ok => { if (!ok) controller.abort(); }, () => controller.abort()); }, 15_000);
  const dir = await mkdtemp(join(root, 'jobs', `${job.jobId}-`));
  try {
    await writeFile(join(dir,'input.json'), JSON.stringify(job.input), { flag: 'wx', mode: 0o600 });
    await runSandbox(image, dir, controller.signal);
    if (controller.signal.aborted) throw new Error('Lease lost');
    const evidence = JSON.parse(await readFile(join(dir,'evidence.json'),'utf8')) as NativeBuildEvidence;
    const input: ReleaseBuildInput = job.input;
    const source = join(dir,'output.vpkg');
    const info = await lstat(source);
    if (!info.isFile() || info.isSymbolicLink() || info.size < 1024 || info.size > MAX_VPKG ||
      evidence.inputFingerprint !== input.fingerprint || evidence.sourceHash !== input.sourceHash ||
      evidence.deploymentId !== input.deploymentId || evidence.packageId !== input.packageId ||
      evidence.publishedRelease.releaseId !== input.publishedRelease.releaseId ||
      evidence.publishedRelease.sequence !== input.publishedRelease.sequence ||
      evidence.inspectedPackageId !== input.packageId ||
      evidence.target !== 'x86_64' || evidence.buildType !== 'Release' ||
      JSON.stringify(evidence.command) !== JSON.stringify(RELEASE_BUILD_COMMAND) ||
      JSON.stringify(evidence.toolchain) !== JSON.stringify({ node:'v24.21.0',npm:'12.2.0',vegaCli:'1.4.4',vegaSdk:'0.24.12112' }) ||
      !/^[a-f0-9]{64}$/.test(evidence.dependencyLockSha256) ||
      evidence.bytes !== info.size || evidence.sha256 !== await digest(source)) throw new Error('Artifact differs from claim');
    await inspectPackage(image,source,input.packageId,root);
    const target = join(root,'artifacts',`${job.jobId}.vpkg`);
    await rename(source,target);
    await chmod(target,0o600);
    if ((await stat(target)).size !== evidence.bytes || await digest(target) !== evidence.sha256 ||
      !await queue.complete(job.jobId,job.leaseToken,evidence)) {
      await rm(target,{ force:true }); throw new Error('Artifact changed or lease lost');
    }
  } catch {
    await queue.fail(job.jobId,job.leaseToken,'SANDBOX_BUILD_FAILED');
  } finally { clearInterval(timer); controller.abort(); await rm(dir,{ recursive:true,force:true }); }
}

async function pruneOrphans(queue: NativeBuildQueue, root: string): Promise<void> {
  const now = Date.now();
  for (const name of (await readdir(join(root,'jobs'))).slice(0,100)) {
    if (!/^job_[a-f0-9]{32}-[a-z0-9]+$/.test(name)) continue;
    const entry = join(root,'jobs',name);
    const info = await lstat(entry).catch(() => null);
    if (info?.isDirectory() && !info.isSymbolicLink() && now-info.mtimeMs > 15*60_000)
      await rm(entry,{ recursive:true,force:true });
  }
  for (const name of (await readdir(join(root,'artifacts'))).slice(0,100)) {
    if (!/^job_[a-f0-9]{32}\.vpkg$/.test(name)) continue;
    const entry = join(root,'artifacts',name);
    const info = await lstat(entry).catch(() => null);
    if (info?.isFile() && !info.isSymbolicLink() && now-info.mtimeMs > 24*60*60_000 &&
      !await queue.retainArtifact(name.slice(0,-5),name)) await rm(entry,{ force:true });
  }
}

async function main(): Promise<void> {
  if (process.getuid?.() === 0) throw new Error('Worker must run under its dedicated unprivileged UID');
  const root = path('FIRELAUNCH_BUILD_STORAGE_ROOT');
  const image = path('FIRELAUNCH_BUILD_RUNTIME_IMAGE');
  const [rootInfo,imageInfo,disk] = await Promise.all([lstat(root),lstat(image),statfs(root)]);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || !imageInfo.isDirectory() || imageInfo.isSymbolicLink() ||
    await realpath(root) !== root || await realpath(image) !== image ||
    rootInfo.uid !== process.getuid?.() || (rootInfo.mode & 0o077) !== 0 ||
    imageInfo.uid !== 0 || (imageInfo.mode & 0o022) !== 0 ||
    disk.bsize * disk.blocks > 20_000_000_000 || disk.bsize * disk.blocks < 1_000_000_000 ||
    !image.startsWith('/opt/firelaunch-build-runtime')) throw new Error('Qualified bounded storage/runtime image absent');
  const cgroup = (await readFile('/proc/self/cgroup','utf8')).trim().split('\n').find(line => line.startsWith('0::'))?.slice(3);
  if (!cgroup || cgroup.includes('..')) throw new Error('Dedicated cgroup v2 absent');
  const group = join('/sys/fs/cgroup',cgroup);
  const [cpu,memory,pids] = await Promise.all([
    readFile(join(group,'cpu.max'),'utf8'),readFile(join(group,'memory.max'),'utf8'),readFile(join(group,'pids.max'),'utf8')]);
  assertNativeBuildLimits(cpu,memory,pids,disk.bsize*disk.blocks);
  const bwrap = await lstat('/usr/bin/bwrap');
  if (!bwrap.isFile()) throw new Error('Sandbox executable absent');
  for (const name of ['usr/bin/node','usr/bin/npm','usr/bin/vpt','opt/vega/bin/vega',
    'opt/firelaunch-build-app/apps/server/dist/native-build-child.js','opt/npm-cache','job','artifact.vpkg','sys/fs/cgroup']) {
    await lstat(join(image,name));
  }
  await mkdir(join(root,'jobs'),{ recursive:true,mode:0o700 });
  await mkdir(join(root,'artifacts'),{ recursive:true,mode:0o700 });
  for (const name of ['jobs','artifacts']) {
    const info = await lstat(join(root,name));
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0)
      throw new Error('Unsafe worker storage directory');
  }
  const pool = new Pool({ connectionString: required('FIRELAUNCH_BUILD_DATABASE_URL'), max: 2 });
  const queue = new NativeBuildQueue(pool);
  try {
    for (;;) {
      const job = await queue.claim();
      if (job) await processJob(queue,job,root,image);
      else await new Promise(resolve => setTimeout(resolve,3000));
      for (const artifact of await queue.expiredArtifacts()) {
        await rm(join(root,'artifacts',artifact.name),{ force:true });
        await queue.acknowledgeArtifactRemoval(artifact.jobId,artifact.name);
      }
      await pruneOrphans(queue,root);
    }
  } finally { await pool.end(); }
}

main().catch(() => { process.stderr.write('Native build worker stopped; see operator logs\n'); process.exitCode=1; });
