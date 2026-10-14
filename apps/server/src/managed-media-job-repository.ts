import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { managedJobIdentitySchema, managedJobObservationSchema, mediaRenditionSetSchema,
  type ManagedJobObservation } from '@firelaunch/contracts';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import { RepositoryError } from './repository.js';

const ids = z.strictObject({ creatorAccountId: z.string().regex(/^cr_[a-f0-9]{32}$/),
  projectId: z.string().regex(/^ch_[a-f0-9]{32}$/), mediaAssetId: z.string().regex(/^ma_[a-f0-9]{32}$/),
  jobId: z.string().regex(/^job_[a-f0-9]{32}$/) });
export type ManagedJobScope = z.infer<typeof ids>;
const admission = managedJobIdentitySchema.pick({ awsAccountId: true, awsRegion: true }).extend({
  profileHash: z.string().regex(/^[a-f0-9]{64}$/), expectedVersion: z.number().int().nonnegative()
});
const stale = (): never => { throw new RepositoryError('CONFLICT', 'Managed job stale or unavailable'); };
type AttemptRow = { intent_token: string; processing_job_id: string; upload_session_id: string;
  creator_account_id: string; project_id: string; item_id: string; asset_id: string; attempt: number;
  profile_hash: string; original_key: string; original_sha256: string; original_bytes: string;
  output_staging_prefix: string; aws_account_id: string; aws_region: string; aws_job_id: string | null;
  state: string; version: number; reconcile_after: Date; checked_at: Date | null;
  cancel_requested_at: Date | null; cancel_checked_at: Date | null };

function intent(row: AttemptRow, newIntent = false) {
  return { intentToken: row.intent_token, jobId: row.processing_job_id, uploadSessionId: row.upload_session_id,
    creatorAccountId: row.creator_account_id, projectId: row.project_id, catalogItemId: row.item_id,
    mediaAssetId: row.asset_id,
    attempt: row.attempt, profileHash: row.profile_hash, originalKey: row.original_key,
    originalSha256: row.original_sha256, originalBytes: Number(row.original_bytes),
    outputStagingPrefix: row.output_staging_prefix, awsAccountId: row.aws_account_id,
    awsRegion: row.aws_region, awsJobId: row.aws_job_id, state: row.state, version: row.version,
    reconcileAfter: row.reconcile_after.toISOString(), checkedAt: row.checked_at?.toISOString() ?? null,
    cancelRequestedAt: row.cancel_requested_at?.toISOString() ?? null,
    cancelCheckedAt: row.cancel_checked_at?.toISOString() ?? null, newIntent };
}

/** Internal control-plane seam. Only authenticated admission and verified provider adapters may call it. */
export class ManagedMediaJobRepository {
  constructor(private readonly pool: Pool) {}

  private async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (error instanceof RepositoryError || error instanceof z.ZodError) throw error;
      throw new RepositoryError('STORAGE_ERROR', 'Managed media job storage failed');
    } finally { client.release(); }
  }

  /** Reserve once before any AWS call. An unresolved intent must be reconciled, never blindly resubmitted. */
  async reserve(principal: AuthenticatedPrincipal, rawScope: unknown, rawAdmission: unknown) {
    const scope = ids.parse(rawScope);
    const input = admission.parse(rawAdmission);
    if (!principal || principal.accountId !== scope.creatorAccountId || !principal.issuer || !principal.subject)
      throw new RepositoryError('NOT_FOUND', 'Media job not found');
    return this.transaction(async client => {
      const identity = await client.query(`SELECT 1 FROM provider_identities WHERE creator_account_id=$1
        AND issuer=$2 AND subject=$3`, [scope.creatorAccountId, principal.issuer, principal.subject]);
      if (!identity.rowCount) throw new RepositoryError('NOT_FOUND', 'Media job not found');
      const owner = await client.query(`SELECT 1 FROM channel_ownerships WHERE project_id=$1 AND creator_account_id=$2 FOR UPDATE`,
        [scope.projectId, scope.creatorAccountId]);
      if (!owner.rowCount) throw new RepositoryError('NOT_FOUND', 'Media job not found');
      // Serialize paid admissions for all projects belonging to this creator.
      await client.query('SELECT 1 FROM creator_accounts WHERE id=$1 FOR UPDATE', [scope.creatorAccountId]);
      const result = await client.query<{ version: number; attempts: number; state: string; failure_code: string | null; upload_session_id: string;
        item_id: string; original_key: string; verified_sha256: string; verified_bytes: string }>(`SELECT j.version,j.attempts,j.state,j.failure_code,
          j.upload_session_id,j.item_id,u.original_key,u.verified_sha256,u.verified_bytes
        FROM media_processing_jobs j JOIN media_upload_sessions u ON u.id=j.upload_session_id
          AND u.creator_account_id=j.creator_account_id AND u.project_id=j.project_id AND u.asset_id=j.asset_id
        JOIN catalog_media_assets a ON a.id=j.asset_id AND a.project_id=j.project_id
          AND a.creator_account_id=j.creator_account_id
        LEFT JOIN media_asset_lifecycle l ON l.asset_id=j.asset_id
        WHERE j.id=$1 AND j.creator_account_id=$2 AND j.project_id=$3 AND j.asset_id=$4
          AND u.state='verified' AND l.revoked_at IS NULL AND a.record->>'kind'='video'
          AND a.record->>'deliveryEligible'='true'
          AND ((a.record->'rights'->>'status'='cleared' AND
            a.record->'rights'->>'permittedUse'='television_playback') OR
            (a.record->'tvPlaybackRights'->>'status'='cleared' AND
            a.record->'tvPlaybackRights'->>'permittedUse'='television_playback'))
        FOR UPDATE OF j`, [scope.jobId, scope.creatorAccountId, scope.projectId, scope.mediaAssetId]);
      const job = result.rows[0];
      if (!job) return stale();
      const prior = await client.query<AttemptRow>(`SELECT * FROM managed_media_job_attempts
        WHERE processing_job_id=$1 ORDER BY attempt DESC LIMIT 1`, [scope.jobId]);
      const last = prior.rows[0];
      if (last && !['error','canceled'].includes(last.state) &&
        !(last.state === 'complete' && job.state === 'failed' && job.failure_code === 'verification_failed')) {
        if (job.state !== 'pending' || job.attempts !== last.attempt) return stale();
        if (last.aws_account_id !== input.awsAccountId || last.aws_region !== input.awsRegion ||
          last.profile_hash !== input.profileHash) return stale();
        return intent(last);
      }
      if (job.version !== input.expectedVersion || !['pending','failed'].includes(job.state) || job.attempts >= 3 ||
        (last && last.attempt !== job.attempts)) return stale();
      const quota = await client.query<{ active: string; seconds: string }>(`SELECT
        (SELECT count(*) FROM managed_media_job_attempts m JOIN media_processing_jobs j
          ON j.id=m.processing_job_id AND j.attempts=m.attempt
          WHERE m.creator_account_id=$1 AND j.state='pending' AND m.state IN ('intent','submitted','progressing','complete')) AS active,
        (SELECT COALESCE(sum(u.claimed_duration_seconds),0) FROM managed_media_job_attempts m
          JOIN media_upload_sessions u ON u.id=m.upload_session_id
          WHERE m.creator_account_id=$1 AND m.created_at >= now()-interval '24 hours') AS seconds`,
      [scope.creatorAccountId]);
      const duration = await client.query<{ claimed_duration_seconds: number | null }>(
        'SELECT claimed_duration_seconds FROM media_upload_sessions WHERE id=$1', [job.upload_session_id]);
      const claimed = duration.rows[0]?.claimed_duration_seconds;
      if (!claimed || claimed > 1800 || Number(quota.rows[0]?.active) >= 2 ||
        Number(quota.rows[0]?.seconds) + claimed > 7200) return stale();
      const token = randomUUID();
      const prefix = `media/${scope.creatorAccountId.slice(3)}/${scope.projectId.slice(3)}/${scope.mediaAssetId.slice(3)}/staged/${token.replaceAll('-', '')}/`;
      const inserted = await client.query<AttemptRow>(`INSERT INTO managed_media_job_attempts (
        intent_token,processing_job_id,upload_session_id,creator_account_id,project_id,item_id,asset_id,
        attempt,profile_hash,original_key,original_sha256,original_bytes,output_staging_prefix,
        aws_account_id,aws_region) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [token, scope.jobId, job.upload_session_id, scope.creatorAccountId, scope.projectId, job.item_id,
        scope.mediaAssetId, job.attempts + 1, input.profileHash, job.original_key, job.verified_sha256,
        job.verified_bytes, prefix, input.awsAccountId, input.awsRegion]);
      await client.query(`UPDATE media_processing_jobs SET state='pending',failure_code=NULL,
        attempts=attempts+1,version=version+1 WHERE id=$1 AND version=$2`, [scope.jobId, job.version]);
      return intent(inserted.rows[0]!, true);
    });
  }

  /** Called only with identity returned by a trusted submit adapter, never raw event data. */
  async register(rawScope: unknown, intentToken: string, rawIdentity: unknown): Promise<boolean> {
    const scope = ids.parse(rawScope); z.uuid().parse(intentToken);
    const identity = managedJobIdentitySchema.parse(rawIdentity);
    return this.transaction(async client => {
      const row = await this.lockCurrent(client, scope, intentToken, true);
      if (!row || row.aws_account_id !== identity.awsAccountId ||
        row.aws_region !== identity.awsRegion) return false;
      if (row.aws_job_id) return row.aws_job_id === identity.awsJobId;
      const duplicate = await client.query(`SELECT 1 FROM managed_media_job_attempts WHERE aws_account_id=$1
        AND aws_region=$2 AND aws_job_id=$3`, [identity.awsAccountId, identity.awsRegion, identity.awsJobId]);
      if (duplicate.rowCount) return false;
      const result = await client.query(`UPDATE managed_media_job_attempts SET aws_job_id=$2,
        state='submitted',observed_status='SUBMITTED',version=version+1 WHERE intent_token=$1
        AND state='intent' AND aws_job_id IS NULL`, [intentToken, identity.awsJobId]);
      return !!result.rowCount;
    });
  }

  /** Event/poll adapter has already verified AWS source, account and region. Status never marks media READY. */
  async observe(rawScope: unknown, intentToken: string, rawObservation: unknown): Promise<boolean> {
    const scope = ids.parse(rawScope); z.uuid().parse(intentToken);
    const observation: ManagedJobObservation = managedJobObservationSchema.parse(rawObservation);
    return this.transaction(async client => {
      const row = await this.lockCurrent(client, scope, intentToken);
      if (!row || row.cancel_requested_at || row.aws_job_id !== observation.awsJobId ||
        row.aws_account_id !== observation.awsAccountId || row.aws_region !== observation.awsRegion) return false;
      const states = { SUBMITTED: 'submitted', PROGRESSING: 'progressing', COMPLETE: 'complete',
        ERROR: 'error', CANCELED: 'canceled' } as const;
      const state = states[observation.status];
      const rank = { intent: 0, submitted: 1, progressing: 2, complete: 3, error: 3, canceled: 3 };
      if (rank[state] <= rank[row.state as keyof typeof rank] || rank[row.state as keyof typeof rank] === 3) return false;
      await client.query(`UPDATE managed_media_job_attempts SET state=$2,observed_status=$3,
        observed_error_code=$4,checked_at=now(),reconcile_after=now()+interval '5 minutes',version=version+1
        WHERE intent_token=$1 AND version=$5`, [intentToken, state, observation.status,
        observation.errorCode ?? null, row.version]);
      if (state === 'error' || state === 'canceled') {
        await client.query(`UPDATE media_processing_jobs SET state='failed',failure_code='encode_failed',
          version=version+1 WHERE id=$1 AND creator_account_id=$2 AND project_id=$3 AND asset_id=$4
          AND state='pending' AND attempts=$5`, [scope.jobId, scope.creatorAccountId, scope.projectId,
          scope.mediaAssetId, row.attempt]);
      }
      return true;
    });
  }

  /** Polling checkpoint uses CAS. The worker can revisit lost submit responses by intent token. */
  async checkpoint(rawScope: unknown, intentToken: string, expectedVersion: number, nextAt: string): Promise<boolean> {
    const scope = ids.parse(rawScope); z.uuid().parse(intentToken);
    z.number().int().nonnegative().parse(expectedVersion); z.iso.datetime().parse(nextAt);
    if (new Date(nextAt).getTime() < Date.now() || new Date(nextAt).getTime() > Date.now() + 86_400_000)
      return stale();
    const result = await this.pool.query(`UPDATE managed_media_job_attempts m SET checked_at=now(),
      reconcile_after=$7,version=m.version+1 FROM media_processing_jobs j
      WHERE m.intent_token=$1 AND m.processing_job_id=$2 AND m.creator_account_id=$3
        AND m.project_id=$4 AND m.asset_id=$5 AND m.version=$6 AND m.cancel_requested_at IS NULL
        AND m.state IN ('intent','submitted','progressing','complete') AND j.id=m.processing_job_id
        AND j.state='pending' AND j.attempts=m.attempt`, [intentToken, scope.jobId, scope.creatorAccountId,
      scope.projectId, scope.mediaAssetId, expectedVersion, nextAt]);
    return !!result.rowCount;
  }

  async due(limit = 25) {
    const bounded = z.number().int().min(1).max(100).parse(limit);
    const rows = await this.pool.query<AttemptRow>(`SELECT m.* FROM managed_media_job_attempts m
      JOIN media_processing_jobs j ON j.id=m.processing_job_id AND j.creator_account_id=m.creator_account_id
        AND j.project_id=m.project_id AND j.asset_id=m.asset_id
      LEFT JOIN media_asset_lifecycle l ON l.asset_id=m.asset_id
      WHERE m.reconcile_after<=now() AND m.cancel_requested_at IS NULL
        AND m.state IN ('intent','submitted','progressing','complete') AND j.state='pending'
        AND j.attempts=m.attempt AND l.revoked_at IS NULL
      ORDER BY m.reconcile_after,m.intent_token LIMIT $1`, [bounded]);
    return rows.rows.map(row => intent(row));
  }

  /** Event IDs are only lookup hints; callers still authenticate GetJob and compare every binding. */
  async byProviderJob(account: string, region: string, jobId: string) {
    const identity = managedJobIdentitySchema.parse({ awsAccountId: account, awsRegion: region, awsJobId: jobId });
    const result = await this.pool.query<AttemptRow>(`SELECT * FROM managed_media_job_attempts
      WHERE aws_account_id=$1 AND aws_region=$2 AND aws_job_id=$3`,
    [identity.awsAccountId, identity.awsRegion, identity.awsJobId]);
    return result.rows[0] ? intent(result.rows[0]) : null;
  }

  async ready(rawScope: unknown, intentToken: string, rawSet: unknown): Promise<boolean> {
    const scope = ids.parse(rawScope); z.uuid().parse(intentToken);
    const set = mediaRenditionSetSchema.parse(rawSet);
    return this.transaction(async client => {
      const row = await this.lockCurrent(client, scope, intentToken);
      if (!row || row.state !== 'complete' || !row.aws_job_id || row.cancel_requested_at ||
        set.creatorAccountId !== scope.creatorAccountId || set.projectId !== scope.projectId ||
        set.catalogItemId !== row.item_id || set.mediaAssetId !== scope.mediaAssetId ||
        set.jobId !== scope.jobId || set.revokedAt) return false;
      const prefix = `media/${scope.creatorAccountId.slice(3)}/${scope.projectId.slice(3)}/${scope.mediaAssetId.slice(3)}/staged/${set.id.slice(3)}/`;
      if (set.masterKey !== `${prefix}master.m3u8` || set.variants.some(v =>
        v.playlistKey !== `${prefix}v${v.height}.m3u8`)) return false;
      const verified = await client.query(`SELECT 1 FROM media_upload_sessions u
        JOIN catalog_media_assets a ON a.id=u.asset_id AND a.creator_account_id=u.creator_account_id
        LEFT JOIN media_asset_lifecycle l ON l.asset_id=u.asset_id
        WHERE u.id=$1 AND u.creator_account_id=$2 AND u.project_id=$3 AND u.asset_id=$4
          AND u.state='verified' AND u.verified_sha256=$5 AND u.verified_bytes=$6
          AND l.revoked_at IS NULL AND a.record->>'kind'='video'
          AND a.record->>'deliveryEligible'='true'
          AND ((a.record->'rights'->>'status'='cleared' AND
            a.record->'rights'->>'permittedUse'='television_playback') OR
            (a.record->'tvPlaybackRights'->>'status'='cleared' AND
            a.record->'tvPlaybackRights'->>'permittedUse'='television_playback'))`,
      [row.upload_session_id, scope.creatorAccountId, scope.projectId, scope.mediaAssetId,
        row.original_sha256, row.original_bytes]);
      if (!verified.rowCount) return false;
      await client.query(`INSERT INTO media_rendition_sets(id,job_id,creator_account_id,project_id,item_id,
        asset_id,profile,master_key,master_sha256,variants,verified_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
      [set.id, scope.jobId, scope.creatorAccountId, scope.projectId, row.item_id, scope.mediaAssetId,
        set.profile, set.masterKey, set.masterSha256, JSON.stringify(set.variants), set.verifiedAt]);
      const updated = await client.query(`UPDATE media_processing_jobs SET state='ready',rendition_set_id=$2,
        version=version+1 WHERE id=$1 AND creator_account_id=$3 AND project_id=$4 AND asset_id=$5
        AND state='pending' AND attempts=$6`, [scope.jobId, set.id, scope.creatorAccountId,
        scope.projectId, scope.mediaAssetId, row.attempt]);
      if (!updated.rowCount) return stale();
      return true;
    });
  }

  async failVerification(rawScope: unknown, intentToken: string): Promise<boolean> {
    const scope = ids.parse(rawScope); z.uuid().parse(intentToken);
    return this.transaction(async client => {
      const row = await this.lockCurrent(client, scope, intentToken);
      if (!row || row.state !== 'complete' || row.cancel_requested_at) return false;
      const updated = await client.query(`UPDATE media_processing_jobs SET state='failed',
        failure_code='verification_failed',version=version+1 WHERE id=$1 AND creator_account_id=$2
        AND project_id=$3 AND asset_id=$4 AND attempts=$5 AND state='pending'`,
      [scope.jobId, scope.creatorAccountId, scope.projectId, scope.mediaAssetId, row.attempt]);
      return !!updated.rowCount;
    });
  }

  /** Revocation is locally final. These identities are for best-effort provider cancellation only. */
  async cancellationsDue(limit = 25) {
    const bounded = z.number().int().min(1).max(100).parse(limit);
    const rows = await this.pool.query<AttemptRow>(`SELECT * FROM managed_media_job_attempts
      WHERE cancel_requested_at IS NOT NULL AND cancel_checked_at IS NULL AND aws_job_id IS NOT NULL
        AND state IN ('submitted','progressing','complete')
      ORDER BY cancel_requested_at,intent_token LIMIT $1`, [bounded]);
    return rows.rows.map(row => intent(row));
  }

  async cancellationChecked(rawScope: unknown, intentToken: string, expectedVersion: number): Promise<boolean> {
    const scope = ids.parse(rawScope); z.uuid().parse(intentToken);
    z.number().int().nonnegative().parse(expectedVersion);
    const result = await this.pool.query(`UPDATE managed_media_job_attempts SET cancel_checked_at=now(),
      version=version+1 WHERE intent_token=$1 AND processing_job_id=$2 AND creator_account_id=$3
      AND project_id=$4 AND asset_id=$5 AND version=$6 AND cancel_requested_at IS NOT NULL
      AND cancel_checked_at IS NULL AND aws_job_id IS NOT NULL`, [intentToken, scope.jobId,
      scope.creatorAccountId, scope.projectId, scope.mediaAssetId, expectedVersion]);
    return !!result.rowCount;
  }

  private async lockCurrent(client: PoolClient, scope: ManagedJobScope, token: string,
    allowRevoked = false): Promise<AttemptRow | null> {
    const job = await client.query(`SELECT 1 FROM media_processing_jobs WHERE id=$1 AND creator_account_id=$2
      AND project_id=$3 AND asset_id=$4 AND state ${allowRevoked ? "IN ('pending','revoked')" : "= 'pending'"} FOR UPDATE`,
    [scope.jobId, scope.creatorAccountId, scope.projectId, scope.mediaAssetId]);
    if (!job.rowCount) return null;
    const row = await client.query<AttemptRow>(`SELECT m.* FROM managed_media_job_attempts m
      JOIN media_processing_jobs j ON j.id=m.processing_job_id AND j.attempts=m.attempt
      LEFT JOIN media_asset_lifecycle l ON l.asset_id=m.asset_id
      WHERE m.intent_token=$1 AND m.processing_job_id=$2 AND m.creator_account_id=$3
        AND m.project_id=$4 AND m.asset_id=$5 AND ($6::boolean OR l.revoked_at IS NULL) FOR UPDATE OF m`,
    [token, scope.jobId, scope.creatorAccountId, scope.projectId, scope.mediaAssetId, allowRevoked]);
    return row.rows[0] ?? null;
  }
}
