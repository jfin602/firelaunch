import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { mediaRenditionSetSchema, type MediaRenditionSet } from '@vegalaunch/contracts';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import { RepositoryError } from './repository.js';

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-f0-9]{32}$`));
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const key = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);
const newId = (prefix: string) => `${prefix}_${randomUUID().replaceAll('-', '')}`;
const conflict = (message: string): never => { throw new RepositoryError('CONFLICT', message); };
const missing = (): never => { throw new RepositoryError('NOT_FOUND', 'Media asset not found'); };

/** Private storage state only. Callers must authenticate and apply CSRF at the HTTP edge. */
export class MediaPipelineRepository {
  constructor(private readonly projects: HostedProjectRepository) {}

  private async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.projects.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (error instanceof RepositoryError || error instanceof z.ZodError) throw error;
      throw new RepositoryError('STORAGE_ERROR', 'Media pipeline storage failed');
    } finally { client.release(); }
  }

  private async owned(client: PoolClient, principal: AuthenticatedPrincipal, projectId: string, assetId: string,
    allowRevoked = false) {
    id('ch').parse(projectId); id('ma').parse(assetId);
    if (!principal?.accountId || !principal.issuer || !principal.subject) missing();
    const identity = await client.query(`SELECT 1 FROM provider_identities
      WHERE creator_account_id = $1 AND issuer = $2 AND subject = $3`,
    [principal.accountId, principal.issuer, principal.subject]);
    if (!identity.rowCount) missing();
    // Same lock order as catalog mutations and publication.
    const owner = await client.query(`SELECT 1 FROM channel_ownerships
      WHERE project_id = $1 AND creator_account_id = $2 FOR UPDATE`, [projectId, principal.accountId]);
    if (!owner.rowCount) missing();
    const asset = await client.query<{ item_id: string; record: { kind?: string; rights?: { status?: string };
      tvDisplayRights?: { status?: string; assertedAt?: string; attestationVersion?: string };
      tvPlaybackRights?: { status?: string; assertedAt?: string; attestationVersion?: string } } }>(`SELECT item_id, record FROM catalog_media_assets
      WHERE id = $1 AND project_id = $2 AND creator_account_id = $3`, [assetId, projectId, principal.accountId]);
    const row = asset.rows[0];
    if (!row) throw new RepositoryError('NOT_FOUND', 'Media asset not found');
    if (row.record.kind !== 'video' || (!allowRevoked && (row.record.rights?.status === 'revoked' ||
      row.record.tvPlaybackRights?.status === 'revoked'))) missing();
    if (!allowRevoked) {
      const lifecycle = await client.query(`SELECT 1 FROM media_asset_lifecycle WHERE asset_id = $1
        AND project_id = $2 AND creator_account_id = $3 AND revoked_at IS NOT NULL`,
      [assetId, projectId, principal.accountId]);
      if (lifecycle.rowCount) missing();
    }
    return { owner: principal.accountId, itemId: row.item_id, rights: row.record };
  }

  async createUpload(principal: AuthenticatedPrincipal, projectId: string, assetId: string, request: {
    idempotencyKey: string; expectedBytes: number; expectedSha256: string; expiresAt: string;
    claimedDurationSeconds?: number; partSize?: number; partCount?: number
  }): Promise<{ id: string; originalKey: string; state: string }> {
    key.parse(request.idempotencyKey); hash.parse(request.expectedSha256);
    z.number().int().positive().max(50_000_000_000).parse(request.expectedBytes);
    z.iso.datetime().parse(request.expiresAt);
    if (new Date(request.expiresAt).getTime() <= Date.now() ||
      new Date(request.expiresAt).getTime() > Date.now() + 86_400_000) conflict('Upload expiry must be within 24 hours');
    return this.transaction(async client => {
      const { owner, itemId, rights } = await this.owned(client, principal, projectId, assetId);
      // Serialize the account-wide quota across projects.
      await client.query('SELECT 1 FROM creator_accounts WHERE id = $1 FOR UPDATE', [owner]);
      const existing = await client.query<{ id: string; original_key: string; state: string; expected_bytes: string;
        expected_sha256: string; expires_at: Date; claimed_duration_seconds: number | null;
        part_size: number | null; part_count: number | null }>(`SELECT * FROM media_upload_sessions WHERE creator_account_id = $1
          AND project_id = $2 AND asset_id = $3 AND idempotency_key = $4`,
      [owner, projectId, assetId, request.idempotencyKey]);
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (Number(row.expected_bytes) !== request.expectedBytes || row.expected_sha256 !== request.expectedSha256 ||
          (row.claimed_duration_seconds ?? undefined) !== request.claimedDurationSeconds ||
          (row.part_size ?? undefined) !== request.partSize || (row.part_count ?? undefined) !== request.partCount)
          conflict('Upload idempotency key reused with different input');
        return { id: row.id, originalKey: row.original_key, state: row.state };
      }
      const previous = await client.query<{ expected_sha256: string; created_at: Date }>(`
        SELECT expected_sha256, created_at FROM media_upload_sessions
        WHERE creator_account_id = $1 AND project_id = $2 AND asset_id = $3
        ORDER BY created_at DESC, id DESC LIMIT 1`, [owner, projectId, assetId]);
      if (previous.rows[0] && previous.rows[0].expected_sha256 !== request.expectedSha256) {
        const laterThanPrior = (claim: typeof rights.tvDisplayRights) => claim?.status === 'cleared' &&
          claim.attestationVersion === 'channel-media-v1' && !!claim.assertedAt &&
          Date.parse(claim.assertedAt) > previous.rows[0]!.created_at.getTime();
        if (!laterThanPrior(rights.tvDisplayRights) || !laterThanPrior(rights.tvPlaybackRights))
          conflict('Confirm rights for the replacement video before uploading');
      }
      if (request.partCount !== undefined) {
        const usage = await client.query<{ active: string; bytes: string }>(`SELECT count(*) AS active,
          COALESCE(sum(expected_bytes),0) AS bytes FROM media_upload_sessions
          WHERE creator_account_id = $1 AND ((state = 'initiated' AND expires_at > now()) OR
            state IN ('aborting','expiring'))`, [owner]);
        if (Number(usage.rows[0]?.active) >= 3 || Number(usage.rows[0]?.bytes) + request.expectedBytes > 10_000_000_000)
          conflict('Concurrent upload quota exceeded');
      }
      const uploadId = newId('up');
      const originalKey = `media/${owner.slice(3)}/${projectId.slice(3)}/${assetId.slice(3)}/original/${uploadId.slice(3)}.mp4`;
      await client.query(`INSERT INTO media_upload_sessions(id, creator_account_id, project_id, item_id, asset_id,
        idempotency_key, original_key, expected_bytes, expected_sha256, content_type, expires_at,
        claimed_duration_seconds, part_size, part_count)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'video/mp4',$10,$11,$12,$13)`,
      [uploadId, owner, projectId, itemId, assetId, request.idempotencyKey, originalKey,
        request.expectedBytes, request.expectedSha256, request.expiresAt,
        request.claimedDurationSeconds ?? null, request.partSize ?? null, request.partCount ?? null]);
      return { id: uploadId, originalKey, state: 'initiated' };
    });
  }

  async upload(principal: AuthenticatedPrincipal, projectId: string, assetId: string, uploadId: string) {
    id('up').parse(uploadId);
    return this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId);
      const result = await client.query<{ id: string; state: string; version: number; original_key: string;
        s3_upload_id: string | null; expected_bytes: string; expected_sha256: string; expires_at: Date;
        claimed_duration_seconds: number | null; part_size: number | null; part_count: number | null }>(
        `SELECT id,state,version,original_key,s3_upload_id,expected_bytes,expected_sha256,expires_at,
          claimed_duration_seconds,part_size,part_count FROM media_upload_sessions
          WHERE id = $1 AND project_id = $2 AND creator_account_id = $3 AND asset_id = $4`,
        [uploadId, projectId, owner, assetId]);
      const row = result.rows[0];
      if (!row) return missing();
      return { id: row.id, state: row.state, version: row.version, originalKey: row.original_key,
        s3UploadId: row.s3_upload_id, expectedBytes: Number(row.expected_bytes), expectedSha256: row.expected_sha256,
        expiresAt: row.expires_at.toISOString(), claimedDurationSeconds: row.claimed_duration_seconds,
        partSize: row.part_size, partCount: row.part_count };
    });
  }

  async processingStatus(principal: AuthenticatedPrincipal, projectId: string, assetId: string, uploadId: string) {
    id('up').parse(uploadId);
    return this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId, true);
      const result = await client.query<{ state: 'pending' | 'leased' | 'ready' | 'failed' | 'revoked'; failure_code: string | null }>(
        `SELECT state, failure_code FROM media_processing_jobs WHERE upload_session_id = $1
          AND project_id = $2 AND creator_account_id = $3 AND asset_id = $4`,
        [uploadId, projectId, owner, assetId]);
      return result.rows[0] ? { state: result.rows[0].state, failureCode: result.rows[0].failure_code } : null;
    });
  }

  async latestAssetStatus(principal: AuthenticatedPrincipal, projectId: string, assetId: string) {
    return this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId, true);
      const result = await client.query<{ id: string; state: string; job_state: string | null; failure_code: string | null }>(
        `SELECT u.id, u.state, j.state AS job_state, j.failure_code FROM media_upload_sessions u
          LEFT JOIN media_processing_jobs j ON j.upload_session_id = u.id AND j.creator_account_id = u.creator_account_id
            AND j.project_id = u.project_id AND j.asset_id = u.asset_id
          WHERE u.project_id = $1 AND u.creator_account_id = $2 AND u.asset_id = $3
          ORDER BY u.created_at DESC, u.id DESC LIMIT 1`, [projectId, owner, assetId]);
      const row = result.rows[0];
      return row ? { uploadId: row.id, uploadState: row.state, processing: row.job_state
        ? { state: row.job_state, failureCode: row.failure_code } : null } : null;
    });
  }

  async attachS3Upload(principal: AuthenticatedPrincipal, projectId: string, assetId: string,
    uploadId: string, s3UploadId: string): Promise<boolean> {
    if (!s3UploadId || s3UploadId.length > 512) conflict('Invalid storage upload ID');
    return this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId);
      const result = await client.query(`UPDATE media_upload_sessions SET s3_upload_id = $5
        WHERE id = $1 AND project_id = $2 AND creator_account_id = $3 AND asset_id = $4
          AND state = 'initiated' AND expires_at > now() AND s3_upload_id IS NULL`,
      [uploadId, projectId, owner, assetId, s3UploadId]);
      return !!result.rowCount;
    });
  }

  async recordCompletedOriginal(principal: AuthenticatedPrincipal, projectId: string, assetId: string,
    uploadId: string, expectedVersion: number): Promise<void> {
    await this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId);
      const result = await client.query(`UPDATE media_upload_sessions SET state = 'completed', version = version + 1
        WHERE id = $1 AND project_id = $2 AND creator_account_id = $3 AND asset_id = $4
          AND state = 'initiated' AND version = $5 AND expires_at > now() AND s3_upload_id IS NOT NULL`,
      [uploadId, projectId, owner, assetId, expectedVersion]);
      if (!result.rowCount) conflict('Upload stale or expired');
    });
  }

  async beginAbort(principal: AuthenticatedPrincipal, projectId: string, assetId: string,
    uploadId: string, expectedVersion: number): Promise<void> {
    await this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId);
      const result = await client.query(`UPDATE media_upload_sessions SET state = 'aborting', version = version + 1
        WHERE id = $1 AND project_id = $2 AND creator_account_id = $3 AND asset_id = $4
          AND version = $5 AND state = 'initiated'`, [uploadId, projectId, owner, assetId, expectedVersion]);
      if (!result.rowCount) conflict('Upload close stale or unavailable');
    });
  }

  /** Internal bounded maintenance; never accepts caller-provided scope or object key. */
  async pendingCleanup(limit = 25): Promise<Array<{ id: string; creatorAccountId: string; projectId: string;
    assetId: string; s3UploadId: string | null; version: number; state: 'aborting' | 'expiring' }>> {
    const result = await this.projects.pool.query<{ id: string; creator_account_id: string; project_id: string;
      asset_id: string; s3_upload_id: string | null; version: number; state: 'aborting' | 'expiring' }>(
      `UPDATE media_upload_sessions SET state = 'expiring', version = version + 1
       WHERE state = 'initiated' AND expires_at <= now() AND
         id IN (SELECT id FROM media_upload_sessions WHERE state = 'initiated' AND expires_at <= now()
         ORDER BY expires_at,id LIMIT $1)
       RETURNING id,creator_account_id,project_id,asset_id,s3_upload_id,version,state`,
      [Math.min(Math.max(limit, 1), 100)]);
    const pending = await this.projects.pool.query<typeof result.rows[number]>(
      `SELECT id,creator_account_id,project_id,asset_id,s3_upload_id,version,state
       FROM media_upload_sessions WHERE state IN ('aborting','expiring') ORDER BY created_at,id LIMIT $1`,
      [Math.min(Math.max(limit, 1), 100)]);
    return [...new Map([...result.rows, ...pending.rows].map(row => [row.id, {
      id: row.id, creatorAccountId: row.creator_account_id, projectId: row.project_id,
      assetId: row.asset_id, s3UploadId: row.s3_upload_id, version: row.version, state: row.state
    }])).values()];
  }

  async finishCleanup(uploadId: string, version: number, state: 'aborted' | 'expired'): Promise<boolean> {
    const result = await this.projects.pool.query(`UPDATE media_upload_sessions SET state = $3, version = version + 1
      WHERE id = $1 AND version = $2 AND state = $4`,
      [uploadId, version, state, state === 'aborted' ? 'aborting' : 'expiring']);
    return !!result.rowCount;
  }

  // Trusted storage adapter must HEAD/hash the completed original before calling this.
  async recordVerifiedOriginal(principal: AuthenticatedPrincipal, projectId: string, assetId: string,
    uploadId: string, trusted: { bytes: number; sha256: string; expectedVersion: number }): Promise<void> {
    id('up').parse(uploadId); hash.parse(trusted.sha256);
    z.number().int().positive().max(50_000_000_000).parse(trusted.bytes);
    z.number().int().nonnegative().parse(trusted.expectedVersion);
    await this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId);
      const moved = await client.query(`UPDATE media_upload_sessions SET state = 'verified',
        verified_bytes = $5, verified_sha256 = $6, version = version + 1
        WHERE id = $1 AND project_id = $2 AND creator_account_id = $3 AND asset_id = $4
          AND version = $7 AND (state = 'completed' OR
            (state = 'initiated' AND s3_upload_id IS NULL AND expires_at > now()))
          AND expected_bytes = $5 AND expected_sha256 = $6`,
      [uploadId, projectId, owner, assetId, trusted.bytes, trusted.sha256, trusted.expectedVersion]);
      if (!moved.rowCount) conflict('Upload stale, expired or checksum mismatch');
    });
  }

  async closeUpload(principal: AuthenticatedPrincipal, projectId: string, assetId: string,
    uploadId: string, expectedVersion: number, state: 'aborted' | 'expired'): Promise<void> {
    id('up').parse(uploadId); z.number().int().nonnegative().parse(expectedVersion);
    await this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId);
      const moved = await client.query(`UPDATE media_upload_sessions SET state = $6, version = version + 1
        WHERE id = $1 AND project_id = $2 AND creator_account_id = $3 AND asset_id = $4
          AND version = $5 AND state = 'initiated' AND ($6 <> 'expired' OR expires_at <= now())`,
      [uploadId, projectId, owner, assetId, expectedVersion, state]);
      if (!moved.rowCount) conflict('Upload close stale or unavailable');
    });
  }

  async enqueue(principal: AuthenticatedPrincipal, projectId: string, assetId: string, uploadId: string): Promise<string> {
    id('up').parse(uploadId);
    return this.transaction(async client => {
      const { owner, itemId } = await this.owned(client, principal, projectId, assetId);
      const upload = await client.query(`SELECT 1 FROM media_upload_sessions WHERE id = $1 AND project_id = $2
        AND creator_account_id = $3 AND asset_id = $4 AND state = 'verified' FOR UPDATE`,
      [uploadId, projectId, owner, assetId]);
      if (!upload.rowCount) conflict('Only verified originals can be queued');
      const jobId = newId('job');
      const inserted = await client.query<{ id: string }>(`INSERT INTO media_processing_jobs(id, upload_session_id,
        creator_account_id, project_id, item_id, asset_id, profile)
        VALUES ($1,$2,$3,$4,$5,$6,'hls-avc-aac-v1') ON CONFLICT (upload_session_id) DO NOTHING RETURNING id`,
      [jobId, uploadId, owner, projectId, itemId, assetId]);
      if (inserted.rows[0]) return inserted.rows[0].id;
      const prior = await client.query<{ id: string }>(`SELECT id FROM media_processing_jobs WHERE upload_session_id = $1
        AND project_id = $2 AND creator_account_id = $3 AND asset_id = $4`, [uploadId, projectId, owner, assetId]);
      return prior.rows[0]?.id ?? conflict('Job enqueue conflict');
    });
  }

  async jobVersion(principal: AuthenticatedPrincipal, projectId: string, assetId: string, jobId: string): Promise<number> {
    id('job').parse(jobId);
    return this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId);
      const result = await client.query<{ version: number }>(`SELECT version FROM media_processing_jobs
        WHERE id=$1 AND project_id=$2 AND creator_account_id=$3 AND asset_id=$4`,
      [jobId, projectId, owner, assetId]);
      return result.rows[0]?.version ?? missing();
    });
  }

  async lease(principal: AuthenticatedPrincipal, projectId: string, assetId: string, jobId: string,
    expectedVersion: number, leaseUntil: string): Promise<{ token: string; version: number; attempts: number }> {
    id('job').parse(jobId); z.number().int().nonnegative().parse(expectedVersion); z.iso.datetime().parse(leaseUntil);
    if (new Date(leaseUntil).getTime() <= Date.now() ||
      new Date(leaseUntil).getTime() > Date.now() + 900_000) conflict('Lease must be within 15 minutes');
    return this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId);
      const token = randomUUID();
      const result = await client.query<{ version: number; attempts: number }>(`UPDATE media_processing_jobs
        SET state = 'leased', lease_token = $6, lease_until = $7, attempts = attempts + 1, version = version + 1
        WHERE id = $1 AND project_id = $2 AND creator_account_id = $3 AND asset_id = $4 AND version = $5
          AND attempts < 3 AND (state = 'pending' OR (state = 'leased' AND lease_until < now()))
          AND NOT EXISTS (SELECT 1 FROM managed_media_job_attempts m WHERE m.processing_job_id=media_processing_jobs.id)
        RETURNING version, attempts`, [jobId, projectId, owner, assetId, expectedVersion, token, leaseUntil]);
      const row = result.rows[0];
      if (!row) throw new RepositoryError('CONFLICT', 'Job lease stale or unavailable');
      return { token, version: row.version, attempts: row.attempts };
    });
  }

  async complete(principal: AuthenticatedPrincipal, projectId: string, assetId: string, jobId: string,
    token: string, expectedVersion: number, rendition: MediaRenditionSet): Promise<void> {
    id('job').parse(jobId); z.uuid().parse(token); z.number().int().nonnegative().parse(expectedVersion);
    const set = mediaRenditionSetSchema.parse(rendition);
    await this.transaction(async client => {
      const { owner, itemId } = await this.owned(client, principal, projectId, assetId);
      if (set.creatorAccountId !== owner || set.projectId !== projectId || set.catalogItemId !== itemId ||
        set.mediaAssetId !== assetId || set.jobId !== jobId || set.revokedAt) missing();
      const prefix = `media/${owner.slice(3)}/${projectId.slice(3)}/${assetId.slice(3)}/`;
      if (![set.masterKey, ...set.variants.map(v => v.playlistKey)].every(value => value.startsWith(prefix)))
        throw new RepositoryError('INVALID_INPUT', 'Rendition key outside owned prefix');
      const job = await client.query(`SELECT 1 FROM media_processing_jobs WHERE id = $1 AND project_id = $2
        AND creator_account_id = $3 AND asset_id = $4 AND state = 'leased' AND lease_token = $5
        AND version = $6 AND lease_until > now() FOR UPDATE`,
      [jobId, projectId, owner, assetId, token, expectedVersion]);
      if (!job.rowCount) conflict('Job lease stale or expired');
      await client.query(`INSERT INTO media_rendition_sets(id, job_id, creator_account_id, project_id, item_id,
        asset_id, profile, master_key, master_sha256, variants, verified_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
      [set.id, jobId, owner, projectId, itemId, assetId, set.profile, set.masterKey,
        set.masterSha256, JSON.stringify(set.variants), set.verifiedAt]);
      await client.query(`UPDATE media_processing_jobs SET state = 'ready', rendition_set_id = $2,
        lease_token = NULL, lease_until = NULL, version = version + 1 WHERE id = $1`, [jobId, set.id]);
    });
  }

  async fail(principal: AuthenticatedPrincipal, projectId: string, assetId: string, jobId: string,
    token: string, expectedVersion: number, failureCode: 'probe_failed' | 'encode_failed' | 'verification_failed' | 'worker_timeout'): Promise<void> {
    id('job').parse(jobId); z.uuid().parse(token);
    await this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId);
      const result = await client.query(`UPDATE media_processing_jobs SET state = 'failed', failure_code = $7,
        lease_token = NULL, lease_until = NULL, version = version + 1 WHERE id = $1 AND project_id = $2
        AND creator_account_id = $3 AND asset_id = $4 AND lease_token = $5 AND version = $6
        AND state = 'leased' AND lease_until > now()`,
      [jobId, projectId, owner, assetId, token, expectedVersion, failureCode]);
      if (!result.rowCount) conflict('Job lease stale or expired');
    });
  }

  async retry(principal: AuthenticatedPrincipal, projectId: string, assetId: string, jobId: string,
    expectedVersion: number): Promise<void> {
    id('job').parse(jobId);
    await this.transaction(async client => {
      const { owner } = await this.owned(client, principal, projectId, assetId);
      const result = await client.query(`UPDATE media_processing_jobs SET state = 'pending', failure_code = NULL,
        version = version + 1 WHERE id = $1 AND project_id = $2 AND creator_account_id = $3
        AND asset_id = $4 AND version = $5 AND state = 'failed' AND attempts < 3`,
      [jobId, projectId, owner, assetId, expectedVersion]);
      if (!result.rowCount) conflict('Job retry stale or exhausted');
    });
  }

  async revoke(principal: AuthenticatedPrincipal, projectId: string, assetId: string): Promise<void> {
    await this.transaction(async client => {
      const { owner, itemId } = await this.owned(client, principal, projectId, assetId, true);
      await client.query(`INSERT INTO media_asset_lifecycle(asset_id, item_id, project_id, creator_account_id, revoked_at)
        VALUES ($1,$2,$3,$4,now()) ON CONFLICT (asset_id) DO UPDATE SET revoked_at =
          COALESCE(media_asset_lifecycle.revoked_at, EXCLUDED.revoked_at)`,
      [assetId, itemId, projectId, owner]);
      await client.query(`UPDATE media_upload_sessions SET state = 'aborted', version = version + 1
        WHERE project_id = $1 AND creator_account_id = $2 AND asset_id = $3 AND state = 'initiated'`,
      [projectId, owner, assetId]);
      await client.query(`UPDATE media_processing_jobs SET state = 'revoked', lease_token = NULL,
        lease_until = NULL, failure_code = NULL, rendition_set_id = NULL, version = version + 1
        WHERE project_id = $1 AND creator_account_id = $2 AND asset_id = $3 AND state <> 'revoked'`,
      [projectId, owner, assetId]);
      await client.query(`UPDATE managed_media_job_attempts SET cancel_requested_at = COALESCE(cancel_requested_at, now()),
        version = version + 1 WHERE project_id = $1 AND creator_account_id = $2 AND asset_id = $3
        AND cancel_requested_at IS NULL AND state IN ('intent','submitted','progressing','complete')`,
      [projectId, owner, assetId]);
      await client.query(`UPDATE media_rendition_sets SET revoked_at = now() WHERE project_id = $1
        AND creator_account_id = $2 AND asset_id = $3 AND revoked_at IS NULL`, [projectId, owner, assetId]);
    });
  }
}
