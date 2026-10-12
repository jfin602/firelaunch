import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HostedProjectRepository } from './hosted-repository.js';
import { reserveRevokedMediaInvalidation, finishMediaInvalidation } from './media-invalidation.js';
import { mediaStorageFromEnv, mediaStorageConfigFromEnv } from './media-storage.js';

const run = promisify(execFile);
const [flag, projectId, assetId] = process.argv.slice(2);
const profile = process.env.FIRELAUNCH_MEDIA_INVALIDATION_PROFILE;
const distribution = process.env.FIRELAUNCH_MEDIA_INVALIDATION_DISTRIBUTION_ID;
if (flag !== '--execute' || process.argv.length !== 5 ||
  process.env.FIRELAUNCH_MEDIA_INVALIDATION_ENABLED !== '1' ||
  !profile || !/^[A-Za-z0-9_-]{3,64}$/.test(profile) || profile === 'default' ||
  !distribution || !/^[A-Z0-9]{8,32}$/.test(distribution) ||
  process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SESSION_TOKEN)
  throw new Error('Explicit invalidation enablement, named role profile, distribution and --execute project asset are required');
process.env.AWS_PROFILE = profile;
const config = mediaStorageConfigFromEnv(process.env);
const aws = async (args: string[]) => {
  const result = await run('aws', [...args, '--profile', profile, '--output', 'json'], { timeout: 30_000, maxBuffer: 16_384 });
  return JSON.parse(result.stdout) as Record<string, any>;
};
const identity = await aws(['sts', 'get-caller-identity']);
if (typeof identity.Arn !== 'string' || !identity.Arn.includes(':assumed-role/') ||
  identity.Arn.split(':assumed-role/')[1]?.split('/')[0] === 'root')
  throw new Error('A named assumed operator role is required');
const distributionInfo = await aws(['cloudfront', 'get-distribution', '--id', distribution]);
const host = new URL(config.cloudFrontOrigin).hostname;
const actual = distributionInfo.Distribution;
if (!actual?.DistributionConfig?.Enabled ||
  actual.DomainName !== host && !actual.DistributionConfig?.Aliases?.Items?.includes(host))
  throw new Error('Configured CloudFront origin does not match the selected distribution');
const repository = await HostedProjectRepository.connect(process.env.DATABASE_URL ?? '');
try {
  const reserved = await reserveRevokedMediaInvalidation(repository.pool, projectId!, assetId!);
  try {
    const storage = mediaStorageFromEnv(process.env);
    const removed = await storage.removePublishedAsset(reserved.scope);
    const path = `/media/${reserved.scope.creatorAccountId.slice(3)}/${projectId!.slice(3)}/${assetId!.slice(3)}/delivery/*`;
    const result = await aws(['cloudfront', 'create-invalidation', '--distribution-id', distribution,
      '--paths', path]);
    if (!result.Invalidation?.Id) throw new Error('CloudFront did not acknowledge invalidation');
    await finishMediaInvalidation(repository.pool, reserved.auditId, true);
    process.stdout.write(`Removed ${removed} origin objects; CloudFront invalidation ${result.Invalidation.Id} requested. Cached/offline copies may remain.\n`);
  } catch (error) {
    await finishMediaInvalidation(repository.pool, reserved.auditId, false);
    throw error;
  }
} finally { await repository.pool.end(); }
