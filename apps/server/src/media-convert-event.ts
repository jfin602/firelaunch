import { managedJobObservationSchema, type ManagedJobObservation } from '@firelaunch/contracts';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue | null => value && typeof value === 'object' && !Array.isArray(value)
  ? value as RecordValue : null;
const safeJobId = /^[A-Za-z0-9_-]{1,128}$/;
const safeKey = /^media\/[a-f0-9]{32}\/[a-f0-9]{32}\/[a-f0-9]{32}\/(?:original\/[a-f0-9]{32}\.mp4|staged\/[a-f0-9]{32}\/)$/;

export type TrustedManagedJob = Readonly<{
  // Obtained with authenticated MediaConvert GetJob in the configured account/Region, never copied from an event.
  id: string; status: string; queueArn: string; roleArn: string; originalUri: string;
  stagingUri: string; intentToken: string; profileHash: string; errorCode?: string;
  outputHeights?: readonly number[]; durationMs?: number; settingsMatch?: boolean;
}>;
export type ExpectedManagedJob = Readonly<{
  awsAccountId: string; awsRegion: string; awsJobId: string; queueArn: string;
  mediaConvertRoleArn: string; originalsBucket: string; stagingBucket: string;
  originalKey: string; outputStagingPrefix: string; intentToken: string; profileHash: string;
}>;

export function verifyTrustedMediaConvertJob(provider: TrustedManagedJob,
  expected: ExpectedManagedJob): ManagedJobObservation | null {
  const originalScope = expected.originalKey.split('/').slice(0, 4).join('/');
  const outputScope = expected.outputStagingPrefix.split('/').slice(0, 4).join('/');
  if (!safeJobId.test(expected.awsJobId) ||
    !safeKey.test(expected.originalKey) || !safeKey.test(expected.outputStagingPrefix) ||
    originalScope !== outputScope ||
    !expected.originalKey.endsWith('.mp4') || !expected.outputStagingPrefix.endsWith('/') ||
    !expected.outputStagingPrefix.includes('/staged/') ||
    provider.id !== expected.awsJobId || provider.queueArn !== expected.queueArn ||
    provider.roleArn !== expected.mediaConvertRoleArn ||
    provider.originalUri !== `s3://${expected.originalsBucket}/${expected.originalKey}` ||
    provider.stagingUri !== `s3://${expected.stagingBucket}/${expected.outputStagingPrefix}` ||
    provider.intentToken !== expected.intentToken || provider.profileHash !== expected.profileHash ||
    provider.settingsMatch !== true ||
    (provider.status === 'COMPLETE' &&
      (!provider.outputHeights || provider.outputHeights.length !== 2 ||
        provider.outputHeights[0] !== 480 || provider.outputHeights[1] !== 720 ||
        provider.durationMs === undefined || provider.durationMs <= 0 || provider.durationMs > 1_800_000))) return null;
  const status = provider.status === 'SUBMITTED' ? 'SUBMITTED' :
    provider.status === 'PROGRESSING' ? 'PROGRESSING' :
    provider.status === 'COMPLETE' ? 'COMPLETE' : provider.status === 'ERROR' ? 'ERROR' :
      provider.status === 'CANCELED' ? 'CANCELED' : null;
  if (!status) return null;
  return managedJobObservationSchema.safeParse({ awsAccountId: expected.awsAccountId,
    awsRegion: expected.awsRegion, awsJobId: expected.awsJobId, status,
    ...(status === 'ERROR' ? { errorCode: provider.errorCode } : {}) }).data ?? null;
}

/** EventBridge routing is only a hint; GetJob is fetched with AWS credentials before this check. */
export function verifyMediaConvertEvent(rawEvent: unknown, provider: TrustedManagedJob,
  expected: ExpectedManagedJob): ManagedJobObservation | null {
  const event = object(rawEvent);
  const detail = object(event?.detail);
  if (!event || !detail || event.source !== 'aws.mediaconvert' ||
    event['detail-type'] !== 'MediaConvert Job State Change' ||
    event.account !== expected.awsAccountId || detail.accountId !== expected.awsAccountId ||
    event.region !== expected.awsRegion || detail.jobId !== expected.awsJobId ||
    detail.queue !== expected.queueArn || detail.status !== provider.status) return null;
  return verifyTrustedMediaConvertJob(provider, expected);
}
