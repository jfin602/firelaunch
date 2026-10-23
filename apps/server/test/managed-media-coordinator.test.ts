import assert from 'node:assert/strict';
import test from 'node:test';
import type { MediaPipelineRepository } from '../src/media-pipeline-repository.js';
import type { ManagedMediaJobRepository } from '../src/managed-media-job-repository.js';
import type { S3MediaStorage } from '../src/media-storage.js';
import type { AwsMediaConvertProvider, MediaConvertConfig, Profile } from '../src/media-convert-provider.js';
import { ManagedMediaCoordinator } from '../src/managed-media-coordinator.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';

const id = (prefix: string, char: string) => `${prefix}_${char.repeat(32)}`;
const owner: AuthenticatedPrincipal = { accountId: id('cr', 'a'), issuer: 'test', subject: 'owner', email: 'owner@example.org' };
const foreign: AuthenticatedPrincipal = { ...owner, accountId: id('cr', 'f'), subject: 'foreign' };
const project = id('ch', 'b'); const asset = id('ma', 'c'); const upload = id('up', 'd');
const job = id('job', 'e'); const item = id('ci', '9');
const original = `media/${'a'.repeat(32)}/${'b'.repeat(32)}/${'c'.repeat(32)}/original/${'d'.repeat(32)}.mp4`;
const staging = `media/${'a'.repeat(32)}/${'b'.repeat(32)}/${'c'.repeat(32)}/staged/${'1'.repeat(32)}/`;
const config: MediaConvertConfig = { awsAccountId: '123456789012', awsRegion: 'us-east-2',
  queueArn: 'arn:aws:mediaconvert:us-east-2:123456789012:queues/VegaLaunch',
  roleArn: 'arn:aws:iam::123456789012:role/VegaLaunchMediaConvert',
  originalsBucket: 'private-originals', stagingBucket: 'private-staging' };
const profile = { hash: '7'.repeat(64), settings: {} } as Profile;
const identity = { awsAccountId: config.awsAccountId, awsRegion: config.awsRegion, awsJobId: 'mc-123' };
const event = { source: 'aws.mediaconvert', 'detail-type': 'MediaConvert Job State Change',
  account: config.awsAccountId, region: config.awsRegion,
  detail: { accountId: config.awsAccountId, jobId: identity.awsJobId,
    queue: config.queueArn, status: 'COMPLETE' } };

test('verified upload alone admits one managed job; trusted completion waits for HLS then READY', async () => {
  let uploadState = 'completed'; let attemptState = 'intent'; let submitted = 0; let ready = 0; let verified = 0;
  const token = '11111111-1111-4111-8111-111111111111';
  const attempt = { intentToken: token, jobId: job, uploadSessionId: upload,
    creatorAccountId: owner.accountId, projectId: project, catalogItemId: item, mediaAssetId: asset,
    attempt: 1, profileHash: profile.hash, originalKey: original, originalSha256: 'a'.repeat(64),
    originalBytes: 42, outputStagingPrefix: staging, awsAccountId: config.awsAccountId,
    awsRegion: config.awsRegion, awsJobId: null as string | null, state: attemptState,
    version: 0, newIntent: true, reconcileAfter: new Date().toISOString(), checkedAt: null,
    cancelRequestedAt: null, cancelCheckedAt: null };
  const owned = (principal: AuthenticatedPrincipal) => {
    if (principal.accountId !== owner.accountId || principal.subject !== owner.subject) throw new Error('not found');
  };
  const pipeline = {
    async upload(principal: AuthenticatedPrincipal) { owned(principal); return { state: uploadState, version: 0,
      expectedBytes: 42, expectedSha256: 'a'.repeat(64) }; },
    async recordVerifiedOriginal(principal: AuthenticatedPrincipal) { owned(principal); uploadState = 'verified'; },
    async enqueue(principal: AuthenticatedPrincipal) { owned(principal); if (uploadState !== 'verified') throw new Error('unverified'); return job; },
    async jobVersion() { return 0; }
  } as unknown as MediaPipelineRepository;
  const jobs = {
    async reserve(principal: AuthenticatedPrincipal) { owned(principal); if (uploadState !== 'verified') throw new Error('unverified');
      const first = attempt.newIntent; attempt.newIntent = false; return { ...attempt, newIntent: first }; },
    async register() { attempt.awsJobId = identity.awsJobId; attempt.state = 'submitted'; return true; },
    async byProviderJob() { return attempt.awsJobId ? { ...attempt } : null; },
    async observe(_scope: unknown, _token: string, observation: { status: string }) {
      if (attempt.state === 'complete') return false;
      attempt.state = observation.status.toLowerCase(); return true;
    },
    async ready() { if (attempt.state !== 'complete' || ready) return false; ready++; return true; },
    async failVerification() { throw new Error('must not fail verified output'); },
    async due() { return [{ ...attempt }]; }, async cancellationsDue() { return []; },
    async checkpoint() { return true; }
  } as unknown as ManagedMediaJobRepository;
  const storage = {
    async verifyOriginal() { verified++; return { key: original, bytes: 42, sha256: 'a'.repeat(64) }; },
    async verifyManagedHls() { return { id: id('rs', '8'), creatorAccountId: owner.accountId,
      projectId: project, catalogItemId: item, mediaAssetId: asset, jobId: job,
      profile: 'hls-avc-aac-v1', masterKey: `${staging}master.m3u8`,
      masterSha256: 'b'.repeat(64), variants: [], verifiedAt: new Date().toISOString() }; }
  } as unknown as S3MediaStorage;
  const provider = {
    async submit() { submitted++; return identity; },
    async getJob() { return { id: identity.awsJobId, status: 'COMPLETE', queueArn: config.queueArn,
      roleArn: config.roleArn, originalUri: `s3://${config.originalsBucket}/${original}`,
      stagingUri: `s3://${config.stagingBucket}/${staging}`, intentToken: token,
      profileHash: profile.hash, outputHeights: [480, 720], durationMs: 6000, settingsMatch: true }; }
  } as unknown as AwsMediaConvertProvider;
  const coordinator = new ManagedMediaCoordinator(pipeline, jobs, storage, provider, config, profile);
  await assert.rejects(coordinator.admit(foreign, project, asset, upload));
  assert.equal(submitted, 0);
  await coordinator.admit(owner, project, asset, upload);
  assert.equal(verified, 1); assert.equal(submitted, 1); assert.equal(ready, 0);
  assert.equal(await coordinator.event({ ...event, account: '000000000000' }), false);
  assert.equal(await coordinator.event({ ...event, source: 'forged' }), false);
  assert.equal(ready, 0);
  assert.equal(await coordinator.event(event), true);
  assert.equal(ready, 1);
  assert.equal(await coordinator.event(event), false);
  assert.equal(ready, 1);
  await coordinator.reconcileDue();
  assert.equal(submitted, 1);
});
