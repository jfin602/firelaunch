import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { signWorkerClaim, verifyWorkerClaim, signWorkerReceipt, acceptWorkerReceipt } from '../src/native-worker-protocol.js';
import { runQualifiedWorkerClaim } from '../src/native-worker-runner.js';
import { releaseBuildCommand, type NativeBuildEvidence, type ReleaseBuildInput } from '../src/release-build.js';

const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const api = generateKeyPairSync('ed25519');
const worker = generateKeyPairSync('ed25519');
const impostor = generateKeyPairSync('ed25519');
const now = Date.now();
const vpkg = Buffer.alloc(2048, 7); // Synthetic protocol fixture, never native qualification.
const input = {
  format: 'firelaunch-vega-build-input-v1', projectId: `ch_${'1'.repeat(32)}`,
  creatorAccountId: `cr_${'2'.repeat(32)}`, specRevision: 7, sourceRevision: 7,
  generatorFingerprint: '3'.repeat(64), deploymentId: `dep_${'4'.repeat(32)}`,
  packageId: 'com.creator.channel', manifestEndpoint: `https://creator.example.tv/public/v1/deployments/dep_${'4'.repeat(32)}/current`,
  publishedRelease: { releaseId: `rel_${'5'.repeat(32)}`, sequence: 1 },
  files: {}, fileSha256: {}, sourceHash: '6'.repeat(64), fingerprint: '7'.repeat(64)
} as ReleaseBuildInput;
const evidence = {
  inputFingerprint: input.fingerprint, sourceHash: input.sourceHash,
  command: releaseBuildCommand(input), target: 'x86_64', buildType: 'Release',
  toolchain: { node: 'v24.21.0', npm: '12.2.0', vegaCli: '1.4.4', vegaSdk: '0.24.12112' },
  dependencyLockSha256: '8'.repeat(64), artifactPath: 'build/x86_64/Release/channel_x86_64.vpkg',
  bytes: vpkg.length, sha256: sha(vpkg), deploymentId: input.deploymentId,
  packageId: input.packageId, publishedRelease: input.publishedRelease, inspectedPackageId: input.packageId
} as NativeBuildEvidence;
const jobId = `job_${'a'.repeat(32)}`;
const nonce = 'b'.repeat(64);
const claim = signWorkerClaim(input, jobId, 1, nonce, now, now + 60_000, api.privateKey);
const receipt = signWorkerReceipt(claim, evidence, 'vega-worker-1', now + 1000, worker.privateKey);

function acceptance(overrides: {
  current?: (value: ReleaseBuildInput) => Promise<void>;
  consume?: () => Promise<boolean>;
  canceled?: () => Promise<boolean>;
  at?: number;
} = {}) {
  return (c = claim, r = receipt, bytes = vpkg, key = worker.publicKey) =>
    acceptWorkerReceipt(c, r, bytes, 'vega-worker-1', api.publicKey, key,
      overrides.current ?? (async () => {}), overrides.consume ?? (async () => true),
      overrides.canceled ?? (async () => false), overrides.at ?? now + 2000);
}

test('signed claim and inspected receipt bind owner, project, deployment, release and bytes', async () => {
  verifyWorkerClaim(claim, api.publicKey, now);
  const exported = await acceptance()(claim, receipt);
  assert.equal(exported.vpkgSha256, evidence.sha256);
  assert.ok(exported.zip.includes(Buffer.from(input.packageId)));
  for (const changed of [
    { ...input, creatorAccountId: `cr_${'c'.repeat(32)}` },
    { ...input, projectId: `ch_${'d'.repeat(32)}` },
    { ...input, deploymentId: `dep_${'e'.repeat(32)}` },
    { ...input, publishedRelease: { ...input.publishedRelease, sequence: 2 } },
    { ...input, fingerprint: 'f'.repeat(64) }
  ]) assert.throws(() => verifyWorkerClaim({ ...claim, input: changed }, api.publicKey, now), { code: 'CONFLICT' });
  await assert.rejects(acceptance()(claim, receipt, Buffer.alloc(2048, 0)), { code: 'CONFLICT' });
});

test('spoofed, mismatched, expired and canceled receipts fail before ZIP acceptance', async () => {
  await assert.rejects(acceptance()(claim, { ...receipt, signature: '0'.repeat(128) }), { code: 'CONFLICT' });
  await assert.rejects(acceptance()(claim, receipt, vpkg, impostor.publicKey), { code: 'CONFLICT' });
  await assert.rejects(acceptance()(claim, { ...receipt, nonce: 'c'.repeat(64) }), { code: 'CONFLICT' });
  await assert.rejects(acceptance({ at: now + 60_001 })(), { code: 'CONFLICT' });
  await assert.rejects(acceptance({ canceled: async () => true })(), { code: 'CONFLICT' });
  await assert.rejects(acceptance({ current: async () => { throw new Error('stale'); } })(), /stale/);
});

test('one-time durable claim consumption prevents replay; retry needs a new attempt and nonce', async () => {
  const used = new Set<string>();
  const consume = async () => { const key = `${claim.jobId}:${claim.attempt}:${claim.nonce}`;
    if (used.has(key)) return false; used.add(key); return true; };
  await acceptance({ consume })();
  await assert.rejects(acceptance({ consume })(), { code: 'CONFLICT' });
  const retry = signWorkerClaim(input, jobId, 2, 'd'.repeat(64), now, now + 60_000, api.privateKey);
  const retryReceipt = signWorkerReceipt(retry, evidence, 'vega-worker-1', now + 1000, worker.privateKey);
  await acceptance()(retry, retryReceipt);
  assert.throws(() => signWorkerClaim(input, jobId, 4, nonce, now, now + 60_000, api.privateKey), { code: 'CONFLICT' });
  assert.throws(() => signWorkerClaim(input, jobId, 1, nonce, now, now + 900_001, api.privateKey), { code: 'CONFLICT' });
});

test('worker runner refuses missing isolation proof and canceled claims before any build', async () => {
  const configuration = { assertIsolation: async () => { throw new Error('No qualified external boundary'); },
    workspaceRoot: '/tmp', workerId: 'vega-worker-1', toolchain: evidence.toolchain,
    apiPublicKey: api.publicKey, workerPrivateKey: worker.privateKey,
    executablePath: '/usr/bin:/bin' };
  await assert.rejects(runQualifiedWorkerClaim(claim, configuration),
    /No qualified external boundary|Credential-bearing worker environment|Worker CPU, memory, process or dedicated filesystem limit missing/);
  const prior = process.env.FIRELAUNCH_TEST_SECRET;
  process.env.FIRELAUNCH_TEST_SECRET = 'synthetic-sentinel';
  try {
    await assert.rejects(runQualifiedWorkerClaim(claim, configuration), /Credential-bearing worker environment/);
  } finally {
    if (prior === undefined) delete process.env.FIRELAUNCH_TEST_SECRET;
    else process.env.FIRELAUNCH_TEST_SECRET = prior;
  }
  const canceled = new AbortController(); canceled.abort();
  await assert.rejects(runQualifiedWorkerClaim(claim, configuration, canceled.signal), { code: 'CONFLICT' });
});
