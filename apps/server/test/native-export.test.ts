import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createNativeExport, verifyNativeExport } from '../src/native-export.js';
import { releaseBuildCommand, type NativeBuildEvidence, type ReleaseBuildInput } from '../src/release-build.js';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const input = {
  fingerprint: 'a'.repeat(64), sourceHash: 'b'.repeat(64), projectId: `ch_${'1'.repeat(32)}`,
  specRevision: 7, deploymentId: `dep_${'2'.repeat(32)}`, packageId: 'com.creator.channel',
  manifestEndpoint: `https://creator.example.tv/public/v1/deployments/dep_${'2'.repeat(32)}/current`,
  publishedRelease: { releaseId: `rel_${'3'.repeat(32)}`, sequence: 1 }
} as ReleaseBuildInput;
const vpkg = Buffer.alloc(2048, 7); // Deterministic worker fixture, never native build evidence.
const evidence = {
  inputFingerprint: input.fingerprint, sourceHash: input.sourceHash, deploymentId: input.deploymentId,
  packageId: input.packageId, inspectedPackageId: input.packageId, target: 'x86_64', buildType: 'Release',
  publishedRelease: input.publishedRelease, artifactPath: 'build/x86_64/Release/creator_x86_64.vpkg',
  bytes: vpkg.length, sha256: sha(vpkg), command: releaseBuildCommand(input),
  toolchain: { node: 'v24.21.0', npm: '12.2.0', vegaCli: '1.4.4', vegaSdk: '0.24.12112' },
  dependencyLockSha256: 'c'.repeat(64)
} as NativeBuildEvidence;

test('native ZIP has four bounded verified entries and two SHA-256 identities', () => {
  const result = createNativeExport(input, evidence, vpkg);
  assert.equal(result.zipSha256, sha(result.zip));
  assert.equal(result.vpkgSha256, sha(vpkg));
  assert.equal(result.vpkgName, 'com.creator.channel_x86_64.vpkg');
  assert.doesNotThrow(() => verifyNativeExport(result.zip, result.vpkgName, result.vpkgSha256));
  assert.ok(result.zip.includes(Buffer.from('vega device install-app')));
  assert.ok(result.zip.includes(Buffer.from('vega device launch-app')));
  assert.ok(result.zip.includes(Buffer.from(input.manifestEndpoint)));
});

test('changed identity, stale input, wrong bytes and unsafe artifact path never create ZIP', () => {
  for (const changed of [
    { ...evidence, inputFingerprint: 'd'.repeat(64) },
    { ...evidence, inspectedPackageId: 'com.foreign.channel' },
    { ...evidence, publishedRelease: { ...evidence.publishedRelease, sequence: 2 } },
    { ...evidence, artifactPath: '../creator_x86_64.vpkg' },
    { ...evidence, bytes: vpkg.length + 1 },
    { ...evidence, sha256: '0'.repeat(64) }
  ]) assert.throws(() => createNativeExport(input, changed, vpkg), { code: 'CONFLICT' });
  assert.throws(() => createNativeExport(input, evidence, Buffer.alloc(10)), { code: 'CONFLICT' });
});

test('ZIP verifier rejects byte tampering, traversal names, trailing content and oversized entries', () => {
  const result = createNativeExport(input, evidence, vpkg);
  const tampered = Buffer.from(result.zip); tampered[80] ^= 1;
  assert.throws(() => verifyNativeExport(tampered, result.vpkgName, result.vpkgSha256), { code: 'CONFLICT' });
  const traversal = Buffer.from(result.zip); traversal.write('../', 30, 'utf8');
  assert.throws(() => verifyNativeExport(traversal, result.vpkgName, result.vpkgSha256), { code: 'CONFLICT' });
  const oversized = Buffer.from(result.zip); oversized.writeUInt32LE(0xffffffff, 18);
  assert.throws(() => verifyNativeExport(oversized, result.vpkgName, result.vpkgSha256), { code: 'CONFLICT' });
  assert.throws(() => verifyNativeExport(Buffer.concat([result.zip, Buffer.alloc(1)]), result.vpkgName, result.vpkgSha256), { code: 'CONFLICT' });
});
