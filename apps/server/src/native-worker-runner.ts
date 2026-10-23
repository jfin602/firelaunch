import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdtemp, readFile, rm, statfs } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import type { KeyObject } from 'node:crypto';
import { produceIsolatedRelease, type NativeToolchain } from './release-build.js';
import { signWorkerReceipt, verifyWorkerClaim, type WorkerClaim, type WorkerReceipt } from './native-worker-protocol.js';
import { RepositoryError } from './repository.js';

const deny = (message: string): never => { throw new RepositoryError('CONFLICT', message); };
const COMMAND_TIMEOUT_MS = 12 * 60_000;
const MAX_STDOUT = 64_000;
const MAX_PACKAGE_BYTES = 500_000_000;
const PINNED_TOOLCHAIN: NativeToolchain = Object.freeze({ node: 'v24.21.0', npm: '12.2.0',
  vegaCli: '1.4.4', vegaSdk: '0.24.12112' });

async function assertResourceLimits(workspaceRoot: string): Promise<void> {
  const cgroup = (await readFile('/proc/self/cgroup', 'utf8')).trim().split('\n')
    .find(line => line.startsWith('0::'))?.slice(3);
  if (!cgroup || cgroup.split('/').includes('..')) deny('Dedicated cgroup v2 required');
  const directory = resolve('/sys/fs/cgroup', `.${cgroup}`);
  if (!directory.startsWith('/sys/fs/cgroup/')) deny('Unsafe worker cgroup');
  const [cpu, memory, processes, filesystem] = await Promise.all([
    readFile(join(directory, 'cpu.max'), 'utf8'),
    readFile(join(directory, 'memory.max'), 'utf8'),
    readFile(join(directory, 'pids.max'), 'utf8'), statfs(workspaceRoot)
  ]);
  const quota = Number(cpu.trim().split(/\s+/)[0]);
  const period = Number(cpu.trim().split(/\s+/)[1]);
  const memoryBytes = Number(memory.trim());
  const processCount = Number(processes.trim());
  const diskBytes = filesystem.bsize * filesystem.blocks;
  if (!Number.isFinite(quota) || quota <= 0 || !Number.isFinite(period) || period <= 0 || quota / period > 2 ||
    !Number.isSafeInteger(memoryBytes) || memoryBytes < 1_000_000_000 || memoryBytes > 8_000_000_000 ||
    !Number.isSafeInteger(processCount) || processCount < 1 || processCount > 256 ||
    !Number.isSafeInteger(diskBytes) || diskBytes < 1_000_000_000 || diskBytes > 20_000_000_000)
    deny('Worker CPU, memory, process or dedicated filesystem limit missing');
}

export type QualifiedWorkerConfig = Readonly<{
  /** This callback must verify an independently controlled worker, including UID,
   * secret-free mounts, cgroup and disk limits, and egress policy. No default exists. */
  assertIsolation: () => Promise<void>;
  workspaceRoot: string; workerId: string; toolchain: NativeToolchain;
  apiPublicKey: KeyObject; workerPrivateKey: KeyObject;
  /** Operator-pinned PATH from the worker image, never supplied by a creator. */
  executablePath: string;
}>;

function childEnvironment(home: string, executablePath: string): NodeJS.ProcessEnv {
  if (!executablePath.split(':').every(part => isAbsolute(part) && !part.split('/').includes('..')))
    deny('Unpinned worker executable path');
  return { HOME: home, TMPDIR: home, PATH: executablePath,
    npm_config_cache: join(home, '.npm-cache'), npm_config_update_notifier: 'false',
    CI: 'true' };
}

/** Run only inside the independently qualified worker boundary. No hosted API route calls this. */
export async function runQualifiedWorkerClaim(claim: WorkerClaim, config: QualifiedWorkerConfig,
  signal?: AbortSignal): Promise<{ receipt: WorkerReceipt; vpkg: Buffer }> {
  verifyWorkerClaim(claim, config.apiPublicKey);
  if (process.getuid?.() === 0 || signal?.aborted) deny('Worker must be unprivileged and active');
  if (!isAbsolute(config.workspaceRoot) || resolve(config.workspaceRoot) === '/' ||
    !/^[a-z0-9][a-z0-9-]{2,63}$/.test(config.workerId)) deny('Unsafe worker configuration');
  if (JSON.stringify(config.toolchain) !== JSON.stringify(PINNED_TOOLCHAIN) || process.version !== PINNED_TOOLCHAIN.node)
    deny('Worker toolchain differs from pinned image');
  // In particular, refuse an inherited hosted control-plane environment.
  if (Object.keys(process.env).some(name => /^(?:AWS_|PG|DATABASE_|GOOGLE_|VEGALAUNCH_|OIDC_|SESSION_)/.test(name)))
    deny('Credential-bearing worker environment');
  await assertResourceLimits(config.workspaceRoot);
  await config.assertIsolation();
  const root = await lstat(config.workspaceRoot).catch(() => null);
  if (!root?.isDirectory() || root.isSymbolicLink()) deny('Unsafe worker workspace root');
  const job = await mkdtemp(join(config.workspaceRoot, `native-${randomBytes(8).toString('hex')}-`));
  const source = join(job, 'source');
  const deadline = Math.min(claim.expiresAt, Date.now() + COMMAND_TIMEOUT_MS);
  try {
    const invoke = async (command: readonly string[], cwd: string) => {
      if (cwd !== source || signal?.aborted || Date.now() >= deadline) deny('Worker job canceled or expired');
      const startedAt = Date.now();
      const output: Buffer[] = [];
      let outputBytes = 0;
      const exitCode = await new Promise<number>((fulfill, reject) => {
        const child = spawn(command[0]!, command.slice(1), {
          cwd, env: childEnvironment(job, config.executablePath), shell: false, detached: true,
          stdio: ['ignore', 'pipe', 'ignore']
        });
        const stop = () => { try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); } };
        const timer = setTimeout(stop, Math.max(1, deadline - Date.now()));
        const cancel = () => stop();
        signal?.addEventListener('abort', cancel, { once: true });
        child.stdout?.on('data', (chunk: Buffer) => {
          outputBytes += chunk.length;
          if (outputBytes > MAX_STDOUT) stop();
          else if (command[0] === 'vpt' && command[1] === 'info') output.push(chunk);
        });
        child.on('error', reject);
        child.on('close', code => { stop(); clearTimeout(timer); signal?.removeEventListener('abort', cancel); fulfill(code ?? -1); });
      });
      if (signal?.aborted || Date.now() > deadline || outputBytes > MAX_STDOUT) deny('Worker command timed out, canceled or oversized');
      return { exitCode, startedAt, stdout: Buffer.concat(output).toString('utf8') };
    };
    const evidence = await produceIsolatedRelease(claim.input, source, config.toolchain, invoke);
    const artifact = resolve(source, evidence.artifactPath);
    if (!artifact.startsWith(`${source}${sep}`)) deny('Worker artifact path escaped job');
    const info = await lstat(artifact);
    if (!info.isFile() || info.isSymbolicLink() || info.size !== evidence.bytes || info.size > MAX_PACKAGE_BYTES)
      deny('Worker artifact changed');
    const vpkg = await readFile(artifact);
    if (createHash('sha256').update(vpkg).digest('hex') !== evidence.sha256) deny('Worker artifact changed');
    const receipt = signWorkerReceipt(claim, evidence, config.workerId, Date.now(), config.workerPrivateKey);
    return { receipt, vpkg };
  } finally {
    await rm(job, { recursive: true, force: true });
  }
}
