import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeExportForOwner } from '../src/native-export-delivery.js';
import { verifyNativeExport } from '../src/native-export.js';
import { NativeBuildQueue } from '../src/native-build-queue.js';
import { HostedWorkspaceService } from '../src/hosted-workspace.js';
import { RepositoryError } from '../src/repository.js';
import { releaseBuildCommand, type NativeBuildEvidence, type ReleaseBuildInput } from '../src/release-build.js';

test('owner ZIP delivery requires a current private, untampered READY receipt', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vegalaunch-native-delivery-'));
  const owner = `cr_${'1'.repeat(32)}`; const project = `ch_${'2'.repeat(32)}`;
  const job = `job_${'3'.repeat(32)}`;
  const principal = { accountId: owner, issuer: 'test', subject: 'owner', email: 'owner@test.invalid' };
  const bytes = Buffer.alloc(2048, 7);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const input = { format: 'vegalaunch-vega-build-input-v1', creatorAccountId: owner,
    projectId: project, fingerprint: 'a'.repeat(64), sourceHash: 'b'.repeat(64),
    deploymentId: `dep_${'4'.repeat(32)}`, packageId: 'com.creator.channel',
    specRevision: 8, publishedRelease: { releaseId: `rel_${'5'.repeat(32)}`, sequence: 1 },
    manifestEndpoint: 'https://tv.creator.example/public/v1/deployments/current' } as ReleaseBuildInput;
  const evidence = { inputFingerprint: input.fingerprint, sourceHash: input.sourceHash,
    deploymentId: input.deploymentId, packageId: input.packageId, inspectedPackageId: input.packageId,
    target: 'x86_64', buildType: 'Release', publishedRelease: input.publishedRelease,
    artifactPath: 'build/x86_64/Release/creator_x86_64.vpkg', bytes: bytes.length, sha256: digest,
    command: releaseBuildCommand(input), toolchain: { node: 'v24.21.0', npm: '12.2.0',
      vegaCli: '1.4.4', vegaSdk: '0.24.12112' }, dependencyLockSha256: 'c'.repeat(64) } as NativeBuildEvidence;
  let current = true; let ready = true;
  const receipt = { input, evidence, name: `${job}.vpkg`, sha256: digest, bytes: bytes.length };
  const queue = { readyArtifact: async (accountId: string, projectId: string, jobId: string) =>
    ready && accountId === owner && projectId === project && jobId === job ? receipt : null } as unknown as NativeBuildQueue;
  const workspace = { assertReleaseBuildInputCurrent: async () => {
    if (!current) throw new RepositoryError('CONFLICT', 'Build input changed');
  } } as unknown as HostedWorkspaceService;
  const file = join(root, `${job}.vpkg`);
  try {
    await writeFile(file, bytes);
    const allowRights = async () => {};
    const result = await nativeExportForOwner(queue,workspace,principal,project,job,root,allowRights);
    assert.equal(result.vpkgSha256,digest);
    verifyNativeExport(result.zip,result.vpkgName,digest);
    await assert.rejects(nativeExportForOwner(queue,workspace,{ ...principal, accountId: `cr_${'9'.repeat(32)}` },project,job,root,allowRights), { code:'NOT_FOUND' });
    await assert.rejects(nativeExportForOwner(queue,workspace,principal,project,job,root,async () => {
      throw new RepositoryError('CONFLICT','Rights revoked');
    }), { code:'CONFLICT' });
    current = false;
    await assert.rejects(nativeExportForOwner(queue,workspace,principal,project,job,root,allowRights), { code:'CONFLICT' });
    current = true; ready = false;
    await assert.rejects(nativeExportForOwner(queue,workspace,principal,project,job,root,allowRights), { code:'NOT_FOUND' });
    ready = true;
    await writeFile(file,Buffer.alloc(2048,8));
    await assert.rejects(nativeExportForOwner(queue,workspace,principal,project,job,root,allowRights), { code:'CONFLICT' });
    await rm(file); await symlink('/etc/hosts',file);
    await assert.rejects(nativeExportForOwner(queue,workspace,principal,project,job,root,allowRights), { code:'CONFLICT' });
  } finally { await rm(root,{ recursive:true,force:true }); }
});
