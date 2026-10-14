import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { mediaRenditionSetSchema, type MediaRenditionSet } from '@firelaunch/contracts';
import type { MediaScope } from './media-storage.js';

export type WorkerClaim = Readonly<{ jobId: string; token: string; attempts: number; scope: MediaScope;
  itemId: string; uploadId: string; bytes: number; sha256: string }>;

/** Internal worker credentials only. No route accepts these methods or a caller-supplied scope. */
export class MediaWorkerRepository {
  constructor(private readonly pool: Pool) {}

  async claim(): Promise<WorkerClaim | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE media_processing_jobs SET state='failed', failure_code='worker_timeout',
        lease_token=NULL, lease_until=NULL, version=version+1
        WHERE state='leased' AND lease_until < now() AND attempts >= 3
          AND NOT EXISTS (SELECT 1 FROM managed_media_job_attempts m WHERE m.processing_job_id=media_processing_jobs.id)`);
      const token = randomUUID();
      const result = await client.query<{ id: string; creator_account_id: string; project_id: string;
        item_id: string; asset_id: string; upload_session_id: string; attempts: number;
        verified_bytes: string; verified_sha256: string }>(`WITH candidate AS (
          SELECT j.id FROM media_processing_jobs j
          JOIN media_upload_sessions u ON u.id=j.upload_session_id AND u.creator_account_id=j.creator_account_id
            AND u.project_id=j.project_id AND u.asset_id=j.asset_id
          JOIN catalog_media_assets a ON a.id=j.asset_id AND a.project_id=j.project_id
            AND a.creator_account_id=j.creator_account_id
          LEFT JOIN media_asset_lifecycle l ON l.asset_id=j.asset_id
          WHERE (j.state IN ('pending','failed') OR (j.state='leased' AND j.lease_until < now())) AND j.attempts < 3
            AND NOT EXISTS (SELECT 1 FROM managed_media_job_attempts m WHERE m.processing_job_id=j.id)
            AND u.state='verified' AND l.revoked_at IS NULL
            AND a.record->>'kind'='video'
            AND COALESCE(a.record->'rights'->>'status','') <> 'revoked'
            AND COALESCE(a.record->'tvPlaybackRights'->>'status','') <> 'revoked'
          ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED
        ), leased AS (
          UPDATE media_processing_jobs j SET state='leased', failure_code=NULL, lease_token=$1,
            lease_until=now()+interval '5 minutes', attempts=j.attempts+1, version=j.version+1
          FROM candidate WHERE j.id=candidate.id
          RETURNING j.id,j.creator_account_id,j.project_id,j.item_id,j.asset_id,j.upload_session_id,j.attempts
        ) SELECT leased.*,u.verified_bytes,u.verified_sha256 FROM leased
          JOIN media_upload_sessions u ON u.id=leased.upload_session_id`, [token]);
      await client.query('COMMIT');
      const row = result.rows[0];
      if (!row) return null;
      return { jobId: row.id, token, attempts: row.attempts, itemId: row.item_id,
        scope: { creatorAccountId: row.creator_account_id, projectId: row.project_id, mediaAssetId: row.asset_id },
        uploadId: row.upload_session_id, bytes: Number(row.verified_bytes), sha256: row.verified_sha256 };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async renew(claim: WorkerClaim): Promise<boolean> {
    const result = await this.pool.query(`UPDATE media_processing_jobs SET lease_until=now()+interval '5 minutes',
      version=version+1 WHERE id=$1 AND creator_account_id=$2 AND project_id=$3 AND asset_id=$4
      AND state='leased' AND lease_token=$5 AND lease_until > now()`,
    [claim.jobId, claim.scope.creatorAccountId, claim.scope.projectId, claim.scope.mediaAssetId, claim.token]);
    return !!result.rowCount;
  }

  async fail(claim: WorkerClaim, code: 'probe_failed' | 'encode_failed' | 'verification_failed' | 'worker_timeout'): Promise<boolean> {
    const result = await this.pool.query(`UPDATE media_processing_jobs SET state='failed', failure_code=$6,
      lease_token=NULL, lease_until=NULL, version=version+1
      WHERE id=$1 AND creator_account_id=$2 AND project_id=$3 AND asset_id=$4
      AND state='leased' AND lease_token=$5 AND lease_until > now()`,
    [claim.jobId, claim.scope.creatorAccountId, claim.scope.projectId, claim.scope.mediaAssetId, claim.token, code]);
    return !!result.rowCount;
  }

  async complete(claim: WorkerClaim, rendition: MediaRenditionSet): Promise<boolean> {
    const set = mediaRenditionSetSchema.parse(rendition);
    const prefix = `media/${claim.scope.creatorAccountId.slice(3)}/${claim.scope.projectId.slice(3)}/${claim.scope.mediaAssetId.slice(3)}/staged/${set.id.slice(3)}/`;
    if (set.jobId !== claim.jobId || set.creatorAccountId !== claim.scope.creatorAccountId ||
      set.projectId !== claim.scope.projectId || set.catalogItemId !== claim.itemId ||
      set.mediaAssetId !== claim.scope.mediaAssetId || set.revokedAt ||
      ![set.masterKey, ...set.variants.map(v => v.playlistKey)].every(key => key.startsWith(prefix)))
      throw new Error('Worker rendition scope mismatch');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const job = await client.query(`SELECT 1 FROM media_processing_jobs j
        JOIN media_upload_sessions u ON u.id=j.upload_session_id AND u.state='verified'
        JOIN catalog_media_assets a ON a.id=j.asset_id AND a.project_id=j.project_id
          AND a.creator_account_id=j.creator_account_id
        LEFT JOIN media_asset_lifecycle l ON l.asset_id=j.asset_id
        WHERE j.id=$1 AND j.creator_account_id=$2 AND j.project_id=$3 AND j.asset_id=$4
          AND j.state='leased' AND j.lease_token=$5 AND j.lease_until>now()
          AND l.revoked_at IS NULL AND COALESCE(a.record->'rights'->>'status','') <> 'revoked'
          AND COALESCE(a.record->'tvPlaybackRights'->>'status','') <> 'revoked' FOR UPDATE OF j`,
      [claim.jobId, claim.scope.creatorAccountId, claim.scope.projectId, claim.scope.mediaAssetId, claim.token]);
      if (!job.rowCount) { await client.query('ROLLBACK'); return false; }
      await client.query(`INSERT INTO media_rendition_sets(id,job_id,creator_account_id,project_id,item_id,asset_id,
        profile,master_key,master_sha256,variants,verified_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
      [set.id,set.jobId,set.creatorAccountId,set.projectId,set.catalogItemId,set.mediaAssetId,set.profile,
        set.masterKey,set.masterSha256,JSON.stringify(set.variants),set.verifiedAt]);
      await client.query(`UPDATE media_processing_jobs SET state='ready', rendition_set_id=$2,
        lease_token=NULL,lease_until=NULL,version=version+1 WHERE id=$1`, [claim.jobId,set.id]);
      await client.query('COMMIT');
      return true;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
