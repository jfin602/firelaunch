import { z } from 'zod';
import type { Pool } from 'pg';
import type { MediaScope } from './media-storage.js';

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-f0-9]{32}$`));

/** One durable reservation per asset and at most ten operator attempts per rolling day. */
export async function reserveRevokedMediaInvalidation(pool: Pool, projectId: string, assetId: string):
  Promise<{ auditId: string; scope: MediaScope }> {
  id('ch').parse(projectId); id('ma').parse(assetId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [482922]);
    const owned = await client.query<{ creator_account_id: string }>(`SELECT a.creator_account_id
      FROM catalog_media_assets a JOIN media_asset_lifecycle l ON l.asset_id=a.id
        AND l.project_id=a.project_id AND l.creator_account_id=a.creator_account_id
      WHERE a.id=$1 AND a.project_id=$2 AND l.revoked_at IS NOT NULL`, [assetId, projectId]);
    const owner = owned.rows[0]?.creator_account_id;
    if (!owner) throw new Error('Revoked owned media asset required');
    const active = await client.query(`SELECT 1 FROM publication_live_pointers p
      JOIN publication_releases r ON r.id=p.release_id AND r.creator_account_id=p.creator_account_id
      WHERE p.creator_account_id=$1 AND p.project_id=$2 AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.manifest_bytes::jsonb->'bindings'->'content') binding
        WHERE binding->>'playbackAssetId'=$3) LIMIT 1`, [owner, projectId, assetId]);
    if (active.rowCount) throw new Error('Active release still references revoked media asset');
    const recent = await client.query<{ total: string; asset: string }>(`SELECT count(*)::text AS total,
      count(*) FILTER (WHERE details->>'assetId'=$1 AND outcome IN ('started','success'))::text AS asset FROM operational_audit_events
      WHERE event_type='media_invalidation' AND occurred_at > now()-interval '24 hours'`, [assetId]);
    if (Number(recent.rows[0]?.total) >= 10 || Number(recent.rows[0]?.asset) >= 1)
      throw new Error('Media invalidation rate limit reached');
    const inserted = await client.query<{ id: string }>(`INSERT INTO operational_audit_events(event_type,outcome,details)
      VALUES ('media_invalidation','started',$1::jsonb) RETURNING id::text`,
    [JSON.stringify({ projectId, assetId })]);
    await client.query('COMMIT');
    return { auditId: inserted.rows[0]!.id, scope: { creatorAccountId: owner, projectId, mediaAssetId: assetId } };
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
}

export async function finishMediaInvalidation(pool: Pool, auditId: string, succeeded: boolean): Promise<void> {
  if (!/^\d+$/.test(auditId)) throw new Error('Invalid audit identity');
  await pool.query(`UPDATE operational_audit_events SET outcome=$2 WHERE id=$1 AND event_type='media_invalidation'
    AND outcome='started'`, [auditId, succeeded ? 'success' : 'failure']);
}

/** Recheck immediately before S3 deletion; a reservation alone is not an enduring cleanup grant. */
export async function assertRevokedMediaCleanup(pool: Pool, scope: MediaScope): Promise<void> {
  const result = await pool.query(`SELECT 1 FROM catalog_media_assets a
    JOIN media_asset_lifecycle l ON l.asset_id=a.id AND l.project_id=a.project_id
      AND l.creator_account_id=a.creator_account_id
    WHERE a.id=$1 AND a.project_id=$2 AND a.creator_account_id=$3 AND l.revoked_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM publication_live_pointers p
        JOIN publication_releases r ON r.id=p.release_id AND r.creator_account_id=p.creator_account_id
        WHERE p.creator_account_id=a.creator_account_id AND p.project_id=a.project_id AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(r.manifest_bytes::jsonb->'bindings'->'content') binding
          WHERE binding->>'playbackAssetId'=a.id)) LIMIT 1`,
  [scope.mediaAssetId, scope.projectId, scope.creatorAccountId]);
  if (!result.rowCount) throw new Error('Revoked owned asset without active release required for cleanup');
}
