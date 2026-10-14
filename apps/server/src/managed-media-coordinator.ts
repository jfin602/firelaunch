import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import { verifyMediaConvertEvent, verifyTrustedMediaConvertJob, type ExpectedManagedJob } from './media-convert-event.js';
import type { AwsMediaConvertProvider, MediaConvertConfig, Profile } from './media-convert-provider.js';
import type { ManagedMediaJobRepository, ManagedJobScope } from './managed-media-job-repository.js';
import type { MediaPipelineRepository } from './media-pipeline-repository.js';
import type { S3MediaStorage } from './media-storage.js';

type Attempt = Awaited<ReturnType<ManagedMediaJobRepository['due']>>[number];
const eventSchema = z.object({ account: z.string(), region: z.string(), detail: z.object({ jobId: z.string() }) });
const next = () => new Date(Date.now() + 5 * 60_000).toISOString();

/** Private control plane. EventBridge payloads are hints, not authority or creator input. */
export class ManagedMediaCoordinator {
  constructor(private readonly pipeline: MediaPipelineRepository,
    private readonly jobs: ManagedMediaJobRepository, private readonly storage: S3MediaStorage,
    private readonly provider: AwsMediaConvertProvider, private readonly config: MediaConvertConfig,
    private readonly profile: Profile) {}

  async admit(principal: AuthenticatedPrincipal, projectId: string, assetId: string, uploadId: string): Promise<void> {
    const scope = { creatorAccountId: principal.accountId, projectId, mediaAssetId: assetId };
    const upload = await this.pipeline.upload(principal, projectId, assetId, uploadId);
    if (upload.state === 'completed') {
      const verified = await this.storage.verifyOriginal(scope, uploadId,
        { bytes: upload.expectedBytes, sha256: upload.expectedSha256 });
      try {
        await this.pipeline.recordVerifiedOriginal(principal, projectId, assetId, uploadId,
          { bytes: verified.bytes, sha256: verified.sha256, expectedVersion: upload.version });
      } catch (error) {
        const latest = await this.pipeline.upload(principal, projectId, assetId, uploadId);
        if (latest.state !== 'verified') throw error;
      }
    } else if (upload.state !== 'verified') throw new Error('Only completed verified uploads can be encoded');
    const jobId = await this.pipeline.enqueue(principal, projectId, assetId, uploadId);
    const jobScope = { ...scope, jobId };
    const version = await this.pipeline.jobVersion(principal, projectId, assetId, jobId);
    const attempt = await this.jobs.reserve(principal, jobScope, { awsAccountId: this.config.awsAccountId,
      awsRegion: this.config.awsRegion, profileHash: this.profile.hash, expectedVersion: version });
    if (attempt.newIntent) {
      // The durable intent precedes CreateJob. A lost response must be reconciled by an operator;
      // MediaConvert's token is only guaranteed for one minute, so never submit it again here.
      const identity = await this.provider.submit(attempt);
      if (!await this.jobs.register(jobScope, attempt.intentToken, identity))
        throw new Error('MediaConvert registration lost the owned attempt');
    } else if (attempt.awsJobId) await this.reconcileAttempt(attempt);
  }

  private expected(attempt: Attempt): ExpectedManagedJob | null {
    if (!attempt.awsJobId || attempt.awsAccountId !== this.config.awsAccountId ||
      attempt.awsRegion !== this.config.awsRegion || attempt.profileHash !== this.profile.hash) return null;
    return { awsAccountId: attempt.awsAccountId, awsRegion: attempt.awsRegion,
      awsJobId: attempt.awsJobId, queueArn: this.config.queueArn,
      mediaConvertRoleArn: this.config.roleArn, originalsBucket: this.config.originalsBucket,
      stagingBucket: this.config.stagingBucket, originalKey: attempt.originalKey,
      outputStagingPrefix: attempt.outputStagingPrefix, intentToken: attempt.intentToken,
      profileHash: attempt.profileHash };
  }

  private scope(attempt: Attempt): ManagedJobScope {
    return { creatorAccountId: attempt.creatorAccountId, projectId: attempt.projectId,
      mediaAssetId: attempt.mediaAssetId, jobId: attempt.jobId };
  }

  private async finish(attempt: Attempt): Promise<void> {
    const id = `rs_${createHash('sha256').update(attempt.intentToken).digest('hex').slice(0, 32)}`;
    let set: Awaited<ReturnType<S3MediaStorage['verifyManagedHls']>>;
    try {
      set = await this.storage.verifyManagedHls(this.scope(attempt),
        attempt.outputStagingPrefix, id, attempt.jobId, attempt.catalogItemId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Media storage: S3 request failed') throw error;
      await this.jobs.failVerification(this.scope(attempt), attempt.intentToken);
      return;
    }
    await this.jobs.ready(this.scope(attempt), attempt.intentToken, set);
  }

  /** An event cannot name an owner or advance state without a registered job and authenticated GetJob. */
  async event(raw: unknown): Promise<boolean> {
    const hint = eventSchema.safeParse(raw);
    if (!hint.success || hint.data.account !== this.config.awsAccountId ||
      hint.data.region !== this.config.awsRegion) return false;
    const attempt = await this.jobs.byProviderJob(hint.data.account, hint.data.region, hint.data.detail.jobId);
    if (!attempt) return false;
    const expected = this.expected(attempt);
    if (!expected) return false;
    const trusted = await this.provider.getJob({ awsAccountId: attempt.awsAccountId,
      awsRegion: attempt.awsRegion, awsJobId: attempt.awsJobId! });
    const observation = verifyMediaConvertEvent(raw, trusted, expected);
    if (!observation) return false;
    const accepted = await this.jobs.observe(this.scope(attempt), attempt.intentToken, observation);
    if (observation.status === 'COMPLETE') {
      const current = await this.jobs.byProviderJob(attempt.awsAccountId, attempt.awsRegion, attempt.awsJobId!);
      if (current?.state === 'complete') await this.finish(current);
    }
    return accepted;
  }

  async reconcileAttempt(attempt: Attempt): Promise<void> {
    const expected = this.expected(attempt);
    if (!expected) {
      if (attempt.state === 'intent' && !attempt.awsJobId) {
        const recovered = await this.provider.findByIntent(attempt);
        if (recovered && await this.jobs.register(this.scope(attempt), attempt.intentToken, recovered)) {
          const current = await this.jobs.byProviderJob(recovered.awsAccountId, recovered.awsRegion,
            recovered.awsJobId);
          if (current) await this.reconcileAttempt(current);
          return;
        }
      }
      // An unresolved CreateJob response is never blindly resubmitted after token expiry.
      await this.jobs.checkpoint(this.scope(attempt), attempt.intentToken, attempt.version, next());
      return;
    }
    const trusted = await this.provider.getJob({ awsAccountId: attempt.awsAccountId,
      awsRegion: attempt.awsRegion, awsJobId: attempt.awsJobId! });
    const observation = verifyTrustedMediaConvertJob(trusted, expected);
    if (!observation) throw new Error('MediaConvert GetJob differs from reserved intent');
    await this.jobs.observe(this.scope(attempt), attempt.intentToken, observation);
    const current = await this.jobs.byProviderJob(attempt.awsAccountId, attempt.awsRegion, attempt.awsJobId!);
    if (observation.status === 'COMPLETE' && current?.state === 'complete') await this.finish(current);
    else if (current && ['intent','submitted','progressing'].includes(current.state))
      await this.jobs.checkpoint(this.scope(current), current.intentToken, current.version, next());
  }

  async reconcileDue(): Promise<void> {
    for (const attempt of await this.jobs.due()) {
      try { await this.reconcileAttempt(attempt); } catch { /* retain durable attempt for next poll */ }
    }
    for (const attempt of await this.jobs.cancellationsDue()) {
      if (!attempt.awsJobId) continue;
      try {
        await this.provider.cancel({ awsAccountId: attempt.awsAccountId,
          awsRegion: attempt.awsRegion, awsJobId: attempt.awsJobId });
        await this.jobs.cancellationChecked(this.scope(attempt), attempt.intentToken, attempt.version);
      } catch { /* cancellation remains due; local revocation already denies playback */ }
    }
  }
}
