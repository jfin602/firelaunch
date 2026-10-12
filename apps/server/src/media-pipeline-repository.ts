import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { mediaRenditionSetSchema, type MediaRenditionSet } from '@firelaunch/contracts';
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
      tvPlaybackRights?: { status?: string } } }>(`SELECT item_id, record FROM catalog_media_assets
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
    return { owner: principal.accountId, itemId: row.item_id };
  }

  async createUpload(principal: AuthenticatedPrincipal, projectId: string, assetId: string, request: {
    idempotencyKey: string; expectedBytes: number; expectedSha256: string; expiresAt: string
  }): Promise<{ id: string; originalKey: string; state: string }> {
    key.parse(request.idempotencyKey); hash.parse(request.expectedSha256);
    z.number().int().positive().max(50_000_000_000).parse(request.expectedBytes);
    z.iso.datetime().parse(request.expiresAt);
    if (new Date(request.expiresAt).getTime() <= Date.now() ||
      new Date(request.expiresAt).getTime() > Date.now() + 86_400_000) conflict('Upload expiry must be within 24 hours');
    return this.transaction(async client => {
      const { owner, itemId } = await this.owned(client, principal, projectId, assetId);
      const existing = await client.query<{ id: string; original_key: string; state: string; expected_bytes: string;
        expected_sha256: string; expires_at: Date }>(`SELECT * FROM media_upload_sessions WHERE creator_account_id = $1
          AND project_id = $2 AND asset_id = $3 AND idempotency_key = $4`,
      [owner, projectId, assetId, request.idempotencyKey]);
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (Number(row.expected_bytes) !== request.expectedBytes || row.expected_sha256 !== request.expectedSha256 ||
          row.expires_at.toISOString() !== request.expiresAt) conflict('Upload idempotency key reused with different input');
        return { id: row.id, originalKey: row.original_key, state: row.state };
      }
      const uploadId = newId('up');
      const originalKey = `media/${owner.slice(3)}/${projectId.slice(3)}/${assetId.slice(3)}/original/${uploadId.slice(3)}.mp4`;
      await client.query(`INSERT INTO media_upload_sessions(id, creator_account_id, project_id, item_id, asset_id,
        idempotency_key, original_key, expected_bytes, expected_sha256, content_type, expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'video/mp4',$10)`,
      [uploadId, owner, projectId, itemId, assetId, request.idempotencyKey, originalKey,
        request.expectedBytes, request.expectedSha256, request.expiresAt]);
      return { id: uploadId, originalKey, state: 'initiated' };
    });
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
          AND state = 'initiated' AND version = $7 AND expires_at > now()
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
      await client.query(`UPDATE media_rendition_sets SET revoked_at = now() WHERE project_id = $1
        AND creator_account_id = $2 AND asset_id = $3 AND revoked_at IS NULL`, [projectId, owner, assetId]);
    });
  }
}
