/** Only executed inside the operator-qualified bubblewrap mount/network/PID sandbox. */
import { spawn, spawnSync } from 'node:child_process';
import { cp, copyFile, lstat, readFile, statfs, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { produceIsolatedRelease, type ReleaseBuildInput, type NativeToolchain } from './release-build.js';
import { assertNativeBuildLimits } from './native-build-limits.js';

const PINNED: NativeToolchain = { node: 'v24.21.0', npm: '12.2.0', vegaCli: '1.4.4', vegaSdk: '0.24.12112' };
const deadline = Date.now() + 12 * 60_000;
const deny = (reason: string): never => { throw new Error(reason); };
const OUTPUT_TAIL = 4_096;
function safeTail(value: string): string {
  return value.slice(-OUTPUT_TAIL).replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[redacted-key]')
    .replace(/\b(?:Bearer|Basic)\s+[^\s]+/gi, '[redacted-authorization]')
    .replace(/(https?:\/\/)[^\s/?#]+[^\s]*/gi, '$1[redacted-url]')
    .replace(/\b(?:token|secret|password|authorization|credential)\s*[:=]\s*[^\s,;]+/gi, '[redacted-secret]')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ');
}

async function assertSandbox(): Promise<void> {
  if (process.version !== PINNED.node ||
    Object.keys(process.env).some(key => /^(?:PG|DATABASE_|AWS_|GOOGLE_|OIDC_|SESSION_|FIRELAUNCH_)/.test(key)))
    deny('Sandbox environment or toolchain invalid');
  if ((await readFile('/proc/1/comm', 'utf8')).trim() !== 'node' &&
      (await readFile('/proc/1/comm', 'utf8')).trim() !== 'bwrap') deny('Private PID namespace missing');
  if ((await readFile('/proc/net/route', 'utf8')).trim().split('\n').length > 1)
    deny('Sandbox network route is present');
  for (const forbidden of ['/run/postgresql','/srv/firelaunch','/etc/firelaunch',
    '/home/deploy','/root/.aws','/root/.ssh']) {
    if (await lstat(forbidden).then(() => true, () => false)) deny('Control-plane path visible');
  }
  const cgroup = (await readFile('/proc/self/cgroup', 'utf8')).trim().split('\n').find(line => line.startsWith('0::'))?.slice(3);
  if (!cgroup || cgroup.includes('..')) deny('Cgroup unavailable');
  const root = join('/sys/fs/cgroup', cgroup!);
  const [cpu, memory, pids, disk] = await Promise.all([
    readFile(join(root, 'cpu.max'), 'utf8'), readFile(join(root, 'memory.max'), 'utf8'),
    readFile(join(root, 'pids.max'), 'utf8'), statfs('/job')]);
  assertNativeBuildLimits(cpu,memory,pids,disk.bsize*disk.blocks);
}

async function main(): Promise<void> {
  await assertSandbox();
  const sdkPath = '/opt/vega/sdk/vega-sdk/main/0.24.12112';
  const linked = spawnSync('/opt/vega/bin/vega', ['sdk','link','--path',sdkPath,'--non-interactive'],
    { env: { HOME:'/tmp', PATH:'/usr/bin:/bin:/opt/vega/bin' }, stdio:'ignore', timeout:30_000 });
  if (linked.status !== 0) deny('Pinned Vega SDK unavailable');
  const input = JSON.parse(await readFile('/job/input.json', 'utf8')) as ReleaseBuildInput;
  const cache = await lstat('/opt/npm-cache');
  if (!cache.isDirectory() || cache.isSymbolicLink()) deny('Reviewed offline npm cache missing');
  await cp('/opt/npm-cache','/job/npm-cache',{ recursive:true,filter:async file => {
    if ((await lstat(file)).isSymbolicLink()) deny('Offline cache symlink');
    return true;
  } });
  const invoke = async (command: readonly string[], cwd: string) => {
    if (cwd !== '/job/source' || Date.now() >= deadline) deny('Build timed out');
    const startedAt = Date.now();
    const stage = command[0] === 'npm' ? `npm ${command[1]}` : command[1] === 'build-vega' ? 'vega release build' : `vpt ${command[1]}`;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutTail = '';
    let stderrTail = '';
    let infoOutput = '';
    let timedOut = false;
    let exitSignal: NodeJS.Signals | null = null;
    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(command[0]!, command.slice(1), { cwd, shell: false, detached: true,
        env: { HOME: '/tmp', TMPDIR: '/tmp', PATH: '/usr/bin:/bin:/opt/vega/bin',
          KEPLER_SDK_PATH: sdkPath, CI: 'true',
          npm_config_offline: 'true', npm_config_cache: '/job/npm-cache', npm_config_update_notifier: 'false' },
        stdio: ['ignore', 'pipe', 'pipe'] });
      const kill = () => { try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); } };
      const timer = setTimeout(() => { timedOut = true; kill(); }, Math.max(1, deadline - Date.now()));
      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        stdoutTail = (stdoutTail + chunk.toString('utf8')).slice(-OUTPUT_TAIL);
        if (command[0] === 'vpt' && command[1] === 'info') {
          infoOutput += chunk.toString('utf8');
          if (Buffer.byteLength(infoOutput) > 64_000) kill();
        }
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrBytes += chunk.length;
        stderrTail = (stderrTail + chunk.toString('utf8')).slice(-OUTPUT_TAIL);
      });
      child.on('error', reject);
      child.on('close', (code, signal) => { clearTimeout(timer); exitSignal = signal; resolve(code ?? -1); });
    });
    process.stderr.write(`Native command ${JSON.stringify({ stage, exitCode, signal: exitSignal, timedOut,
      stdoutBytes, stderrBytes, elapsedMs: Date.now() - startedAt })}\n`);
    if (exitCode !== 0 || timedOut) process.stderr.write(`Native command tails ${JSON.stringify({
      stage, stdout: safeTail(stdoutTail), stderr: safeTail(stderrTail) })}\n`);
    if (timedOut || Date.now() >= deadline) deny('Build command timed out');
    return { exitCode, startedAt, stdout: infoOutput };
  };
  const evidence = await produceIsolatedRelease(input, '/job/source', PINNED, invoke);
  await copyFile(join('/job/source', evidence.artifactPath), '/job/output.vpkg');
  await writeFile('/job/evidence.json', JSON.stringify(evidence), { flag: 'wx', mode: 0o600 });
}

main().catch(async error => {
  if (error instanceof Error && error.message.endsWith('manifest.toml')) {
    try {
      const input = JSON.parse(await readFile('/job/input.json','utf8')) as ReleaseBuildInput;
      const before = input.files['manifest.toml'] ?? '';
      const after = await readFile('/job/source/manifest.toml','utf8');
      const marker = '[wants]\n';
      const beforeAt = before.indexOf(marker); const afterAt = after.indexOf(marker);
      const prefix = beforeAt >= 0 ? before.slice(0,beforeAt).trimEnd() : '';
      const moduleIds = [...after.matchAll(/^id = "(\/com\.amazon\.[A-Za-z0-9_.@-]+)"$/gm)]
        .map(match => match[1]).slice(0,20);
      process.stderr.write(`Native manifest shape ${JSON.stringify({
        prefixMatches: !!prefix && after.startsWith(prefix),
        suffixMatches: beforeAt >= 0 && afterAt >= 0 && after.slice(afterAt) === before.slice(beforeAt),
        beforeBytes: Buffer.byteLength(before), afterBytes: Buffer.byteLength(after), moduleIds
      })}\n`);
    } catch { process.stderr.write('Native manifest shape unavailable\n'); }
  }
  process.stderr.write(`Native sandbox failed: ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exitCode = 1;
});
