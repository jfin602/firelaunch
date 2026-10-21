import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import { NativeBuildQueue } from './native-build-queue.js';
import { createNativeExport } from './native-export.js';
import { HostedWorkspaceService } from './hosted-workspace.js';
import { RepositoryError } from './repository.js';
import type { ReleaseBuildInput } from './release-build.js';

const MAX_VPKG = 500_000_000;
const fail = (message: string): never => { throw new RepositoryError('CONFLICT', message); };

/** The only API read of the worker's private artifact area. No worker job/source paths are shared. */
export async function nativeExportForOwner(queue: NativeBuildQueue, workspace: HostedWorkspaceService,
  principal: AuthenticatedPrincipal, projectId: string, jobId: string, artifactRoot: string,
  assertRights: (input: ReleaseBuildInput) => Promise<void>) {
  const receipt = await queue.readyArtifact(principal.accountId, projectId, jobId);
  if (!receipt) throw new RepositoryError('NOT_FOUND', 'Native export not found');
  if (!artifactRoot || !isAbsolute(artifactRoot) || resolve(artifactRoot) === '/' ||
    !/^job_[a-f0-9]{32}\.vpkg$/.test(receipt.name) || receipt.name !== `${jobId}.vpkg`)
    fail('Native artifact store unavailable');
  await workspace.assertReleaseBuildInputCurrent(principal, projectId, receipt.input.fingerprint);
  await assertRights(receipt.input);
  const root = resolve(artifactRoot);
  const rootInfo = await lstat(root).catch(() => null);
  if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink() || await realpath(root) !== root)
    fail('Native artifact store unavailable');
  const file = join(root, receipt.name);
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => fail('Native artifact unavailable'));
  let vpkg: Buffer;
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size < 1024 || info.size > MAX_VPKG || info.size !== receipt.bytes)
      fail('Native artifact size differs');
    vpkg = await handle.readFile();
  } finally { await handle.close(); }
  const exported = createNativeExport(receipt.input, receipt.evidence, vpkg);
  if (exported.vpkgSha256 !== receipt.sha256) fail('Native artifact receipt differs');
  await workspace.assertReleaseBuildInputCurrent(principal, projectId, receipt.input.fingerprint);
  await assertRights(receipt.input);
  const stillReady = await queue.readyArtifact(principal.accountId, projectId, jobId);
  if (!stillReady || stillReady.sha256 !== receipt.sha256 || stillReady.bytes !== receipt.bytes ||
    stillReady.input.fingerprint !== receipt.input.fingerprint) fail('Native artifact changed during download');
  return { ...exported, bytes: receipt.bytes, packageId: receipt.input.packageId,
    deploymentId: receipt.input.deploymentId, release: receipt.input.publishedRelease };
}
