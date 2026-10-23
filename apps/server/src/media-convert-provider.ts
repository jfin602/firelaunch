import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { CancelJobCommand, CreateJobCommand, GetJobCommand, ListJobsCommand, MediaConvertClient,
  type Job, type JobSettings } from '@aws-sdk/client-mediaconvert';
import { z } from 'zod';
import type { ManagedJobIdentity, ManagedMediaProvider } from '@vegalaunch/contracts';
import type { TrustedManagedJob } from './media-convert-event.js';

const configSchema = z.strictObject({
  awsAccountId: z.string().regex(/^\d{12}$/), awsRegion: z.string().regex(/^[a-z]{2}(?:-gov)?-[a-z]+-[1-9]\d?$/),
  queueArn: z.string().regex(/^arn:aws:mediaconvert:[a-z0-9-]+:\d{12}:queues\/[A-Za-z0-9_-]+$/),
  roleArn: z.string().regex(/^arn:aws:iam::\d{12}:role\/[A-Za-z0-9_+=,.@\/-]+$/),
  originalsBucket: z.string().regex(/^[a-z0-9][a-z0-9.-]{2,62}$/),
  stagingBucket: z.string().regex(/^[a-z0-9][a-z0-9.-]{2,62}$/)
});
export type MediaConvertConfig = z.infer<typeof configSchema>;
export function mediaConvertConfigFromEnv(env: NodeJS.ProcessEnv): MediaConvertConfig {
  const config = configSchema.parse({ awsAccountId: env.VEGALAUNCH_MEDIACONVERT_ACCOUNT,
    awsRegion: env.VEGALAUNCH_MEDIA_AWS_REGION, queueArn: env.VEGALAUNCH_MEDIACONVERT_QUEUE_ARN,
    roleArn: env.VEGALAUNCH_MEDIACONVERT_ROLE_ARN,
    originalsBucket: env.VEGALAUNCH_MEDIA_ORIGINALS_BUCKET,
    stagingBucket: env.VEGALAUNCH_MEDIA_DELIVERY_BUCKET });
  if (!config.queueArn.includes(`:${config.awsRegion}:${config.awsAccountId}:`) ||
    !config.roleArn.includes(`::${config.awsAccountId}:`) ||
    config.originalsBucket === config.stagingBucket) throw new Error('MediaConvert account, Region or buckets differ');
  return config;
}

export type Profile = Readonly<{ settings: JobSettings; hash: string }>;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}
/** The checked-in profile is the sole settings authority. The file is packaged alongside the service. */
export async function fixedMediaConvertProfile(): Promise<Profile> {
  const bytes = await readFile(new URL('../../../infra/aws-media/hls-avc-aac-v1.settings.json', import.meta.url));
  const settings = JSON.parse(bytes.toString('utf8')) as JobSettings;
  const outputs = settings.OutputGroups?.[0]?.Outputs;
  if (settings.OutputGroups?.length !== 1 || settings.Inputs?.length !== 1 || outputs?.length !== 2 ||
    outputs[0]?.VideoDescription?.Height !== 480 || outputs[1]?.VideoDescription?.Height !== 720 ||
    settings.Inputs[0]?.FileInput !== 'REPLACE_WITH_VERIFIED_ORIGINAL_S3_URI' ||
    settings.OutputGroups[0]?.OutputGroupSettings?.HlsGroupSettings?.Destination !==
      'REPLACE_WITH_RESERVED_PRIVATE_STAGING_S3_URI') throw new Error('MediaConvert fixed profile changed');
  return { settings, hash: createHash('sha256').update(bytes).digest('hex') };
}

export type ManagedSubmit = Readonly<{ intentToken: string; originalKey: string;
  outputStagingPrefix: string; profileHash: string; uploadSessionId: string; attempt: number }>;

export class AwsMediaConvertProvider implements ManagedMediaProvider {
  constructor(readonly config: MediaConvertConfig, private readonly profile: Profile,
    private readonly client = new MediaConvertClient({ region: config.awsRegion })) {}

  async submit(input: ManagedSubmit): Promise<ManagedJobIdentity> {
    if (input.profileHash !== this.profile.hash || !/^[a-f0-9-]{36}$/.test(input.intentToken) ||
      !/^media\/[a-f0-9]{32}\/[a-f0-9]{32}\/[a-f0-9]{32}\/original\/[a-f0-9]{32}\.mp4$/.test(input.originalKey) ||
      !/^media\/[a-f0-9]{32}\/[a-f0-9]{32}\/[a-f0-9]{32}\/staged\/[a-f0-9]{32}\/$/.test(input.outputStagingPrefix) ||
      input.originalKey.split('/').slice(0, 4).join('/') !== input.outputStagingPrefix.split('/').slice(0, 4).join('/') ||
      input.attempt < 1 || input.attempt > 3) throw new Error('MediaConvert submit intent invalid');
    const settings = structuredClone(this.profile.settings);
    settings.Inputs![0]!.FileInput = `s3://${this.config.originalsBucket}/${input.originalKey}`;
    settings.OutputGroups![0]!.OutputGroupSettings!.HlsGroupSettings!.Destination =
      `s3://${this.config.stagingBucket}/${input.outputStagingPrefix}`;
    const response = await this.client.send(new CreateJobCommand({
      ClientRequestToken: input.intentToken, Queue: this.config.queueArn, Role: this.config.roleArn,
      Settings: settings, UserMetadata: { vegalaunchIntent: input.intentToken,
        vegalaunchProfile: this.profile.hash } }));
    if (!response.Job?.Id) throw new Error('MediaConvert submit did not return a job ID');
    return { awsAccountId: this.config.awsAccountId, awsRegion: this.config.awsRegion,
      awsJobId: response.Job.Id };
  }

  private normalize(job: Job | undefined): TrustedManagedJob {
    if (!job?.Id || !job.Status) throw new Error('MediaConvert job missing identity or state');
    const heights = job.OutputGroupDetails?.flatMap(group => group.OutputDetails?.map(output =>
      output.VideoDetails?.HeightInPx ?? 0) ?? []).sort((a, b) => a - b);
    const durations = job.OutputGroupDetails?.flatMap(group => group.OutputDetails?.map(output =>
      output.DurationInMs ?? 0) ?? []);
    const originalUri = job.Settings?.Inputs?.[0]?.FileInput ?? '';
    const stagingUri = job.Settings?.OutputGroups?.[0]?.OutputGroupSettings?.HlsGroupSettings?.Destination ?? '';
    const expectedSettings = structuredClone(this.profile.settings);
    expectedSettings.Inputs![0]!.FileInput = originalUri;
    expectedSettings.OutputGroups![0]!.OutputGroupSettings!.HlsGroupSettings!.Destination = stagingUri;
    return { id: job.Id, status: job.Status, queueArn: job.Queue ?? '', roleArn: job.Role ?? '',
      originalUri, stagingUri, settingsMatch: canonical(job.Settings) === canonical(expectedSettings),
      intentToken: job.UserMetadata?.vegalaunchIntent ?? '',
      profileHash: job.UserMetadata?.vegalaunchProfile ?? '',
      ...(job.ErrorCode !== undefined ? { errorCode: String(job.ErrorCode) } : {}),
      ...(heights?.length ? { outputHeights: heights } : {}),
      ...(durations?.length ? { durationMs: Math.max(...durations) } : {}) };
  }

  async getJob(identity: ManagedJobIdentity): Promise<TrustedManagedJob> {
    if (identity.awsAccountId !== this.config.awsAccountId || identity.awsRegion !== this.config.awsRegion)
      throw new Error('MediaConvert job account or Region differs');
    return this.normalize((await this.client.send(new GetJobCommand({ Id: identity.awsJobId }))).Job);
  }

  /** Recover a lost CreateJob response without resubmitting beyond the one-minute token window. */
  async findByIntent(input: ManagedSubmit): Promise<ManagedJobIdentity | null> {
    if (input.profileHash !== this.profile.hash) return null;
    const matches: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const result = await this.client.send(new ListJobsCommand({ MaxResults: 20,
        Order: 'DESCENDING', ...(cursor ? { NextToken: cursor } : {}) }));
      for (const raw of result.Jobs ?? []) {
        if (raw.UserMetadata?.vegalaunchIntent !== input.intentToken) continue;
        const job = this.normalize(raw);
        if (job.queueArn !== this.config.queueArn || job.roleArn !== this.config.roleArn ||
          job.settingsMatch !== true ||
          job.profileHash !== this.profile.hash ||
          job.originalUri !== `s3://${this.config.originalsBucket}/${input.originalKey}` ||
          job.stagingUri !== `s3://${this.config.stagingBucket}/${input.outputStagingPrefix}`)
          throw new Error('MediaConvert recovered intent differs from reservation');
        matches.push(job.id);
      }
      cursor = result.NextToken;
      if (!cursor) break;
    }
    if (matches.length > 1) throw new Error('MediaConvert duplicate jobs require operator review');
    return matches[0] ? { awsAccountId: this.config.awsAccountId, awsRegion: this.config.awsRegion,
      awsJobId: matches[0] } : null;
  }

  async status(identity: ManagedJobIdentity) {
    const job = await this.getJob(identity);
    return { ...identity, status: job.status as 'SUBMITTED' | 'PROGRESSING' | 'COMPLETE' | 'ERROR' | 'CANCELED',
      ...(job.status === 'ERROR' ? { errorCode: job.errorCode ?? 'unknown' } : {}) };
  }

  async cancel(identity: ManagedJobIdentity): Promise<void> {
    if (identity.awsAccountId !== this.config.awsAccountId || identity.awsRegion !== this.config.awsRegion)
      throw new Error('MediaConvert job account or Region differs');
    await this.client.send(new CancelJobCommand({ Id: identity.awsJobId }));
  }
}
