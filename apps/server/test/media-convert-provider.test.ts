import assert from 'node:assert/strict';
import test from 'node:test';
import type { MediaConvertClient } from '@aws-sdk/client-mediaconvert';
import { AwsMediaConvertProvider, fixedMediaConvertProfile, type MediaConvertConfig } from '../src/media-convert-provider.js';
import { verifyTrustedMediaConvertJob } from '../src/media-convert-event.js';

const account = '123456789012';
const region = 'us-east-2';
const config: MediaConvertConfig = { awsAccountId: account, awsRegion: region,
  queueArn: `arn:aws:mediaconvert:${region}:${account}:queues/VegaLaunch`,
  roleArn: `arn:aws:iam::${account}:role/VegaLaunchMediaConvert`,
  originalsBucket: 'originals.example', stagingBucket: 'staging.example' };
const prefix = `media/${'a'.repeat(32)}/${'b'.repeat(32)}/${'c'.repeat(32)}`;
const originalKey = `${prefix}/original/${'d'.repeat(32)}.mp4`;
const staging = `${prefix}/staged/${'e'.repeat(32)}/`;
const token = '11111111-1111-4111-8111-111111111111';

test('fixed profile and AWS adapter submit only correlated source, staging, role and settings', async () => {
  const profile = await fixedMediaConvertProfile();
  const calls: Array<{ constructor: { name: string }; input: Record<string, unknown> }> = [];
  const fake = { async send(command: typeof calls[number]) {
    calls.push(command);
    if (command.constructor.name === 'CreateJobCommand') return { Job: { Id: 'mc-123' } };
    if (command.constructor.name === 'ListJobsCommand') return { Jobs: [{ Id: 'mc-123', Status: 'COMPLETE',
      Queue: config.queueArn, Role: config.roleArn, Settings: calls[0]?.input.Settings,
      UserMetadata: calls[0]?.input.UserMetadata }] };
    return { Job: { Id: 'mc-123', Status: 'COMPLETE', Queue: config.queueArn, Role: config.roleArn,
      Settings: calls[0]?.input.Settings, UserMetadata: calls[0]?.input.UserMetadata,
      OutputGroupDetails: [{ OutputDetails: [{ DurationInMs: 6000, VideoDetails: { HeightInPx: 480 } },
        { DurationInMs: 6000, VideoDetails: { HeightInPx: 720 } }] }] } };
  } } as unknown as MediaConvertClient;
  const provider = new AwsMediaConvertProvider(config, profile, fake);
  const input = { intentToken: token, originalKey, outputStagingPrefix: staging,
    profileHash: profile.hash, uploadSessionId: `up_${'d'.repeat(32)}`, attempt: 1 };
  await assert.rejects(provider.submit({ ...input, originalKey: `${prefix}/delivery/x.mp4` }));
  await assert.rejects(provider.submit({ ...input, profileHash: '0'.repeat(64) }));
  assert.equal(calls.length, 0);
  const identity = await provider.submit(input);
  assert.deepEqual(await provider.findByIntent(input), identity);
  assert.deepEqual(identity, { awsAccountId: account, awsRegion: region, awsJobId: 'mc-123' });
  assert.equal(calls[0]?.input.Queue, config.queueArn);
  assert.equal(calls[0]?.input.Role, config.roleArn);
  assert.equal(calls[0]?.input.ClientRequestToken, token);
  const job = await provider.getJob(identity);
  const expected = { ...identity, queueArn: config.queueArn, mediaConvertRoleArn: config.roleArn,
    originalsBucket: config.originalsBucket, stagingBucket: config.stagingBucket,
    originalKey, outputStagingPrefix: staging, intentToken: token, profileHash: profile.hash };
  assert.equal(verifyTrustedMediaConvertJob(job, expected)?.status, 'COMPLETE');
  assert.equal(verifyTrustedMediaConvertJob({ ...job, outputHeights: [480, 1080] }, expected), null);
  assert.equal(verifyTrustedMediaConvertJob({ ...job, durationMs: 1_800_001 }, expected), null);
  assert.equal(verifyTrustedMediaConvertJob({ ...job, originalUri: 's3://foreign/clip.mp4' }, expected), null);
  assert.equal(verifyTrustedMediaConvertJob({ ...job, intentToken: 'forged' }, expected), null);
  await assert.rejects(provider.getJob({ ...identity, awsAccountId: '000000000000' }));
});
