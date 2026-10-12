import { z } from 'zod';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { MediaPipelineRepository } from './media-pipeline-repository.js';
import type { MediaScope, S3MediaStorage } from './media-storage.js';
import { RepositoryError } from './repository.js';

const assetId = z.string().regex(/^ma_[a-f0-9]{32}$/);
const sessionId = z.string().regex(/^up_[a-f0-9]{32}$/);
const etag = z.string().regex(/^"?[a-f0-9]{32}(?:-\d+)?"?$/);
const PART_BYTES = 8 * 1024 * 1024;
const MAX_BYTES = 5_000_000_000;
export const startVideoUploadSchema = z.strictObject({
  mediaAssetId: assetId, idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  fileName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,120}\.mp4$/i),
  contentType: z.literal('video/mp4'), expectedBytes: z.number().int().min(1).max(MAX_BYTES),
  expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
  claimedDurationSeconds: z.number().int().min(1).max(14400)
});
export const finishVideoUploadSchema = z.strictObject({
  mediaAssetId: assetId, parts: z.array(z.strictObject({
    partNumber: z.number().int().min(1).max(1000), etag
  })).min(1).max(1000)
});
export const uploadAssetSchema = z.strictObject({ mediaAssetId: assetId });
const unavailable = (message: string): never => { throw new RepositoryError('CONFLICT', message); };

/** Control plane only: browsers PUT parts to S3, and the separate worker hashes the completed source. */
export class MediaUploadService {
  constructor(private readonly records: MediaPipelineRepository, private readonly storage: S3MediaStorage) {}

  private scope(principal: AuthenticatedPrincipal, projectId: string, mediaAssetId: string): MediaScope {
    return { creatorAccountId: principal.accountId, projectId, mediaAssetId };
  }

  async start(principal: AuthenticatedPrincipal, projectId: string, raw: unknown) {
    const input = startVideoUploadSchema.parse(raw);
    const partCount = Math.ceil(input.expectedBytes / PART_BYTES);
    const created = await this.records.createUpload(principal, projectId, input.mediaAssetId, {
      idempotencyKey: input.idempotencyKey, expectedBytes: input.expectedBytes,
      expectedSha256: input.expectedSha256, claimedDurationSeconds: input.claimedDurationSeconds,
      partSize: PART_BYTES, partCount, expiresAt: new Date(Date.now() + 3_600_000).toISOString()
    });
    let current = await this.records.upload(principal, projectId, input.mediaAssetId, created.id);
    if (current.state === 'initiated' && !current.s3UploadId && Date.parse(current.expiresAt) > Date.now()) {
      const scope = this.scope(principal, projectId, input.mediaAssetId);
      const started = await this.storage.createOriginal(scope, current.id);
      try {
        if (started.key !== current.originalKey) unavailable('Storage key differs from owned upload session');
        if (!await this.records.attachS3Upload(principal, projectId, input.mediaAssetId, current.id, started.uploadId))
          await this.storage.abortOriginal(scope, current.id, started.uploadId);
      } catch (error) {
        await this.storage.abortOriginal(scope, current.id, started.uploadId).catch(() => undefined);
        throw error;
      }
      current = await this.records.upload(principal, projectId, input.mediaAssetId, current.id);
    }
    return this.publicStatus(current);
  }

  private publicStatus(current: Awaited<ReturnType<MediaPipelineRepository['upload']>>) {
    return { id: current.id, state: current.state, expectedBytes: current.expectedBytes,
      expectedSha256: current.expectedSha256, expiresAt: current.expiresAt,
      partSize: current.partSize, partCount: current.partCount,
      verification: current.state === 'verified' ? 'sha256_verified' :
        current.state === 'completed' ? 'pending_worker_sha256' : 'unverified' };
  }

  async status(principal: AuthenticatedPrincipal, projectId: string, uploadId: string, raw: unknown) {
    const { mediaAssetId } = uploadAssetSchema.parse(raw);
    sessionId.parse(uploadId);
    return this.publicStatus(await this.records.upload(principal, projectId, mediaAssetId, uploadId));
  }

  async part(principal: AuthenticatedPrincipal, projectId: string, uploadId: string, raw: unknown) {
    const { mediaAssetId, partNumber } = z.strictObject({ mediaAssetId: assetId,
      partNumber: z.number().int().min(1).max(1000) }).parse(raw);
    const current = await this.records.upload(principal, projectId, mediaAssetId, sessionId.parse(uploadId));
    if (current.state !== 'initiated' || Date.parse(current.expiresAt) <= Date.now() ||
      !current.s3UploadId || !current.partCount || partNumber > current.partCount)
      unavailable('Upload session unavailable or expired');
    const signed = await this.storage.signOriginalPart(this.scope(principal, projectId, mediaAssetId),
      uploadId, current.s3UploadId!, partNumber,
      Math.min(PART_BYTES, current.expectedBytes - (partNumber - 1) * PART_BYTES));
    return { partNumber, ...signed };
  }

  async finalize(principal: AuthenticatedPrincipal, projectId: string, uploadId: string, raw: unknown) {
    const input = finishVideoUploadSchema.parse(raw);
    const current = await this.records.upload(principal, projectId, input.mediaAssetId, sessionId.parse(uploadId));
    if (current.state === 'completed' || current.state === 'verified') return this.publicStatus(current);
    if (current.state !== 'initiated' || Date.parse(current.expiresAt) <= Date.now() ||
      !current.s3UploadId || !current.partCount || input.parts.length !== current.partCount ||
      input.parts.some((part, index) => part.partNumber !== index + 1))
      unavailable('Upload session unavailable, incomplete or expired');
    const scope = this.scope(principal, projectId, input.mediaAssetId);
    // A previous Complete may have reached S3 before its response failed. In that case HEAD
    // must still verify this session's server-generated key and claimed size before transition.
    try { await this.storage.completeOriginal(scope, uploadId, current.s3UploadId!, input.parts); }
    catch (error) {
      await this.storage.headOriginal(scope, uploadId, current.expectedBytes).catch(() => { throw error; });
    }
    await this.storage.headOriginal(scope, uploadId, current.expectedBytes);
    await this.records.recordCompletedOriginal(principal, projectId, input.mediaAssetId, uploadId, current.version);
    return this.publicStatus(await this.records.upload(principal, projectId, input.mediaAssetId, uploadId));
  }

  async abort(principal: AuthenticatedPrincipal, projectId: string, uploadId: string, raw: unknown) {
    const { mediaAssetId } = uploadAssetSchema.parse(raw);
    let current = await this.records.upload(principal, projectId, mediaAssetId, sessionId.parse(uploadId));
    if (current.state === 'aborted') return this.publicStatus(current);
    if (current.state === 'initiated') {
      await this.records.beginAbort(principal, projectId, mediaAssetId, uploadId, current.version);
      current = await this.records.upload(principal, projectId, mediaAssetId, uploadId);
    }
    if (current.state !== 'aborting') unavailable('Only initiated uploads can be aborted');
    if (current.s3UploadId) {
      const scope = this.scope(principal, projectId, mediaAssetId);
      await this.storage.abortOriginal(scope, uploadId, current.s3UploadId);
      await this.storage.deleteOrphanOriginal(scope, uploadId);
    }
    await this.records.finishCleanup(uploadId, current.version, 'aborted');
    return this.publicStatus(await this.records.upload(principal, projectId, mediaAssetId, uploadId));
  }

  async cleanupExpired(): Promise<number> {
    let cleaned = 0;
    for (const row of await this.records.pendingCleanup()) {
      try {
        if (row.s3UploadId) {
          const scope = { creatorAccountId: row.creatorAccountId, projectId: row.projectId, mediaAssetId: row.assetId };
          await this.storage.abortOriginal(scope, row.id, row.s3UploadId);
          await this.storage.deleteOrphanOriginal(scope, row.id);
        }
        if (await this.records.finishCleanup(row.id, row.version,
          row.state === 'aborting' ? 'aborted' : 'expired')) cleaned++;
      } catch { /* keep the row for a later retry; never claim S3 cleanup succeeded */ }
    }
    return cleaned;
  }
}
