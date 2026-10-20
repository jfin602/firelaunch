import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import {
  catalogInventorySchema, channelDeploymentSchema, channelSpecSchema, mediaUseEligible, projectApprovedManifest,
  mediaRenditionSetSchema, publicationApprovalSchema, publicationBindingsSchema, publishedManifestSchema,
  type CatalogInventory, type ChannelSpec, type PublicationBindings, type PublishedManifest
} from '@firelaunch/contracts';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import { RepositoryError } from './repository.js';
import type { S3MediaStorage } from './media-storage.js';
import type { ManagedArtworkDelivery, PreparedArtwork } from './managed-artwork.js';

const ids = {
  project: z.string().regex(/^ch_[a-f0-9]{32}$/),
  deployment: z.string().regex(/^dep_[a-f0-9]{32}$/),
  approval: z.string().regex(/^ap_[a-f0-9]{32}$/),
  release: z.string().regex(/^rel_[a-f0-9]{32}$/)
};
const revision = z.number().int().positive();
const approvalRequest = z.strictObject({
  projectId: ids.project, deploymentId: ids.deployment,
  revisions: z.strictObject({ channel: revision, catalog: z.number().int().nonnegative() }),
  expectedLiveReleaseId: ids.release.nullable(),
  bindings: publicationBindingsSchema.optional(),
  rollbackSourceReleaseId: ids.release.optional()
}).superRefine((value, ctx) => {
  if (value.rollbackSourceReleaseId ? value.bindings !== undefined : value.bindings === undefined)
    ctx.addIssue({ code: 'custom', message: 'Normal approval needs bindings; rollback uses historical bindings' });
});
export type PublicationApprovalRequest = z.infer<typeof approvalRequest>;
type ApprovalRow = {
  id: string; creator_account_id: string; project_id: string; deployment_id: string;
  channel_revision: number; catalog_revision: number; expected_live_release_id: string | null;
  rollback_source_release_id: string | null; channel_snapshot: unknown; bindings: unknown; approved_at: Date;
};
type ReleaseRow = { id: string; sequence: number; previous_release_id: string | null; rollback_source_release_id: string | null;
  manifest_bytes: string; sha256: string; published_at: Date };
type Locked = { owner: string; channel: ChannelSpec; channelRevision: number; catalogRevision: number;
  inventory: CatalogInventory; deployment: unknown; liveId: string | null; liveSequence: number };

const newId = (prefix: string) => `${prefix}_${randomUUID().replaceAll('-', '')}`;
const digest = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
export function canonicalBytes(value: unknown): string {
  const sort = (entry: unknown): unknown => Array.isArray(entry) ? entry.map(sort) :
    entry && typeof entry === 'object' ? Object.fromEntries(Object.entries(entry)
      .filter(([, part]) => part !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, part]) => [key, sort(part)])) : entry;
  return JSON.stringify(sort(value));
}
function conflict(message: string): never { throw new RepositoryError('CONFLICT', message); }
function failure(error: unknown): never {
  if (error instanceof RepositoryError || error instanceof z.ZodError) throw error;
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') conflict('Publication state changed');
  throw new RepositoryError('STORAGE_ERROR', 'Publication storage operation failed');
}

/** No HTTP route. The caller must supply a verified session principal. */
export class PublicationRepository {
  constructor(private readonly projects: HostedProjectRepository, private readonly mediaStorage?: S3MediaStorage,
    private readonly managedArtwork?: ManagedArtworkDelivery) {}

  private async locked(client: PoolClient, principal: AuthenticatedPrincipal, projectId: string, deploymentId: string): Promise<Locked> {
    if (!principal?.accountId || !principal.issuer || !principal.subject) throw new RepositoryError('NOT_FOUND', 'Project not found');
    const identity = await client.query(`SELECT 1 FROM provider_identities WHERE creator_account_id = $1 AND issuer = $2 AND subject = $3`,
      [principal.accountId, principal.issuer, principal.subject]);
    if (!identity.rowCount) throw new RepositoryError('NOT_FOUND', 'Project not found');
    // Catalog mutations take the owner lock first. Keep the same order for publication.
    const owned = await client.query(`SELECT 1 FROM channel_ownerships WHERE project_id = $1 AND creator_account_id = $2 FOR UPDATE`,
      [projectId, principal.accountId]);
    if (!owned.rowCount) throw new RepositoryError('NOT_FOUND', 'Project not found');
    const catalog = await client.query<{ revision: number }>(`SELECT revision FROM catalog_revisions
      WHERE project_id = $1 AND creator_account_id = $2 FOR UPDATE`, [projectId, principal.accountId]);
    const channel = await client.query<{ revision: number; spec: unknown }>(`SELECT revision, spec FROM channel_projects
      WHERE id = $1 AND creator_account_id = $2 FOR UPDATE`, [projectId, principal.accountId]);
    const deployment = await client.query<{ deployment: unknown }>(`SELECT deployment FROM channel_deployments
      WHERE id = $1 AND project_id = $2 AND creator_account_id = $3 FOR UPDATE`, [deploymentId, projectId, principal.accountId]);
    if (!deployment.rows[0] || !channel.rows[0]) throw new RepositoryError('NOT_FOUND', 'Deployment not found');
    const live = await client.query<{ release_id: string; sequence: number }>(`SELECT release_id, sequence FROM publication_live_pointers
      WHERE deployment_id = $1 AND project_id = $2 AND creator_account_id = $3 FOR UPDATE`, [deploymentId, projectId, principal.accountId]);
    const sources = await client.query<{ record: unknown }>('SELECT record FROM catalog_sources WHERE project_id = $1 AND creator_account_id = $2 ORDER BY id', [projectId, principal.accountId]);
    const items = await client.query<{ record: unknown }>('SELECT record FROM catalog_items WHERE project_id = $1 AND creator_account_id = $2 ORDER BY id', [projectId, principal.accountId]);
    const assets = await client.query<{ record: unknown }>('SELECT record FROM catalog_media_assets WHERE project_id = $1 AND creator_account_id = $2 ORDER BY id', [projectId, principal.accountId]);
    const collections = await client.query<{ record: unknown }>('SELECT record FROM catalog_collections WHERE project_id = $1 AND creator_account_id = $2 ORDER BY id', [projectId, principal.accountId]);
    return {
      owner: principal.accountId, channel: channelSpecSchema.parse(channel.rows[0].spec), channelRevision: channel.rows[0].revision,
      catalogRevision: catalog.rows[0]?.revision ?? 0, deployment: channelDeploymentSchema.parse(deployment.rows[0].deployment),
      liveId: live.rows[0]?.release_id ?? null, liveSequence: live.rows[0]?.sequence ?? 0,
      inventory: catalogInventorySchema.parse({ schemaVersion: 1, creatorAccountId: principal.accountId, projectId,
        sources: sources.rows.map(row => row.record), items: items.rows.map(row => row.record),
        mediaAssets: assets.rows.map(row => row.record), collections: collections.rows.map(row => row.record) })
    };
  }

  private async requireReviewedItems(client: PoolClient, state: Locked, projectId: string, bindings: PublicationBindings): Promise<void> {
    const selected = [...new Set(bindings.content.map(value => value.catalogItemId))];
    if (!selected.length) conflict('Select approved catalog content before publication');
    const rows = await client.query<{ item_id: string }>(`SELECT item_id FROM catalog_item_approvals
      WHERE project_id = $1 AND creator_account_id = $2 AND item_id = ANY($3::text[])`, [projectId, state.owner, selected]);
    if (rows.rowCount !== selected.length) conflict('Catalog selection is not creator-reviewed');
  }

  private async resolvedPlayback(client: PoolClient, state: Locked, bindings: PublicationBindings,
    promote: boolean): Promise<ReadonlyMap<string, string>> {
    const urls = new Map<string, string>();
    for (const binding of bindings.content) {
      if (!binding.playbackAssetId) continue;
      const asset = state.inventory.mediaAssets.find(value => value.id === binding.playbackAssetId);
      if (!asset || asset.location.type === 'https') continue;
      if (asset.location.type !== 'managed_hls' || asset.kind !== 'video' || asset.catalogItemId !== binding.catalogItemId ||
        !mediaUseEligible(asset, 'television_display') || !mediaUseEligible(asset, 'television_playback') || !this.mediaStorage)
        conflict('Private playback has no eligible HLS publisher');
      const result = await client.query<{ id: string; job_id: string; creator_account_id: string; project_id: string;
        item_id: string; asset_id: string; profile: 'hls-avc-aac-v1'; master_key: string; master_sha256: string;
        variants: unknown; verified_at: Date; revoked_at: Date | null; state: string; rendition_set_id: string | null }>(`
        SELECT r.*, j.state, j.rendition_set_id FROM media_processing_jobs j
        JOIN media_upload_sessions u ON u.id = j.upload_session_id AND u.creator_account_id = j.creator_account_id
          AND u.project_id = j.project_id AND u.asset_id = j.asset_id AND u.state = 'verified'
        LEFT JOIN media_rendition_sets r ON r.id = j.rendition_set_id AND r.creator_account_id = j.creator_account_id
          AND r.project_id = j.project_id AND r.asset_id = j.asset_id AND r.item_id = j.item_id
        LEFT JOIN media_asset_lifecycle l ON l.asset_id = j.asset_id AND l.creator_account_id = j.creator_account_id
          AND l.project_id = j.project_id
        WHERE j.creator_account_id = $1 AND j.project_id = $2 AND j.item_id = $3 AND j.asset_id = $4
          AND l.revoked_at IS NULL
        ORDER BY j.created_at DESC, j.id DESC LIMIT 1 FOR UPDATE OF j`,
      [state.owner, state.channel.id, binding.catalogItemId, binding.playbackAssetId]);
      const row = result.rows[0];
      if (!row || row.state !== 'ready' || !row.id || row.revoked_at || row.rendition_set_id !== row.id)
        conflict('Playback rendition is missing, stale or revoked');
      const set = mediaRenditionSetSchema.parse({ id: row.id, jobId: row.job_id,
        creatorAccountId: row.creator_account_id, projectId: row.project_id, catalogItemId: row.item_id,
        mediaAssetId: row.asset_id, profile: row.profile, masterKey: row.master_key,
        masterSha256: row.master_sha256, variants: row.variants, verifiedAt: row.verified_at.toISOString() });
      if (set.creatorAccountId !== state.owner || set.projectId !== state.channel.id ||
        set.catalogItemId !== binding.catalogItemId || set.mediaAssetId !== binding.playbackAssetId)
        conflict('Playback rendition scope differs');
      const scope = { creatorAccountId: state.owner, projectId: state.channel.id, mediaAssetId: binding.playbackAssetId };
      const url = promote ? await this.mediaStorage.publishVerifiedHls(scope, set)
        : this.mediaStorage.publishedMasterUrl(scope, set);
      urls.set(binding.playbackAssetId, url);
    }
    return urls;
  }

  private async manifest(client: PoolClient, state: Locked, approvalId: string, approvedAt: string, channel: ChannelSpec,
    bindings: PublicationBindings, releaseId: string, publishedAt: string, promote = false): Promise<PublishedManifest> {
    const resolvedPlayback = await this.resolvedPlayback(client, state, bindings, false);
    try {
      const artworkCopies: PreparedArtwork[] = [];
      let artworkBytes = 0;
      for (const assetId of new Set(bindings.content.map(binding => binding.artworkAssetId))) {
        const asset = state.inventory.mediaAssets.find(value => value.id === assetId);
        if (!asset || asset.location.type !== 'private_object') continue;
        if (!this.managedArtwork || asset.kind !== 'artwork' || !asset.deliveryEligible ||
          !mediaUseEligible(asset, 'television_display')) conflict('Uploaded thumbnail is not approved for publication');
        const prepared = await this.managedArtwork.prepare(state.owner, state.channel.id, asset.location.objectId,
          channelDeploymentSchema.parse(state.deployment).id, releaseId, asset.id);
        artworkBytes += prepared.body.length;
        if (artworkBytes > 20_000_000) conflict('Managed artwork exceeds release limit');
        artworkCopies.push(prepared);
      }
      const resolvedArtwork = new Map(artworkCopies.map(value => [value.assetId, value.url] as const));
      const manifest = projectApprovedManifest({
        approval: publicationApprovalSchema.parse({ state: 'approved', creatorAccountId: state.owner,
          projectId: state.channel.id, revisions: { channel: state.channelRevision, catalog: state.catalogRevision },
          approvalId, approvedAt }),
        deployment: state.deployment, channel, inventory: state.inventory, bindings, resolvedPlayback, resolvedArtwork,
        releaseId, releaseSequence: state.liveSequence + 1,
        ...(state.liveId ? { previousReleaseId: state.liveId } : {}), publishedAt
      });
      if (promote) for (const artwork of artworkCopies) await this.managedArtwork!.publish(artwork);
      if (promote && resolvedPlayback.size) {
        const promoted = await this.resolvedPlayback(client, state, bindings, true);
        if (!isDeepStrictEqual([...promoted], [...resolvedPlayback])) conflict('Published HLS URL differs from reviewed rendition');
      }
      return manifest;
    } catch { conflict('Publication selection or current rights are ineligible'); }
  }

  private async historical(client: PoolClient, state: Locked, deploymentId: string, releaseId: string): Promise<PublishedManifest> {
    const result = await client.query<ReleaseRow>(`SELECT id, sequence, previous_release_id, rollback_source_release_id, manifest_bytes, sha256, published_at
      FROM publication_releases WHERE id = $1 AND deployment_id = $2 AND creator_account_id = $3`,
    [releaseId, deploymentId, state.owner]);
    const row = result.rows[0];
    if (!row) throw new RepositoryError('NOT_FOUND', 'Release not found');
    if (digest(row.manifest_bytes) !== row.sha256) throw new RepositoryError('STORAGE_ERROR', 'Release integrity failed');
    try {
      const manifest = publishedManifestSchema.parse(JSON.parse(row.manifest_bytes));
      if (manifest.releaseId !== row.id || manifest.releaseSequence !== row.sequence ||
        (manifest.previousReleaseId ?? null) !== row.previous_release_id || manifest.deployment.id !== deploymentId)
        throw new Error('Stored release differs from index');
      return manifest;
    } catch { throw new RepositoryError('STORAGE_ERROR', 'Invalid immutable release'); }
  }

  private async reviewedSelection(client: PoolClient, state: Locked, input: PublicationApprovalRequest): Promise<{ channel: ChannelSpec; bindings: PublicationBindings; rollback: boolean }> {
    if (state.channelRevision !== input.revisions.channel || state.catalogRevision !== input.revisions.catalog ||
      state.liveId !== input.expectedLiveReleaseId) conflict('Draft or live release changed; review again');
    if (state.catalogRevision === 0) conflict('No approved catalog media is ready for publication');
    const historical = input.rollbackSourceReleaseId ? await this.historical(client, state, input.deploymentId, input.rollbackSourceReleaseId) : null;
    if (historical && (historical.releaseId === state.liveId || historical.releaseSequence >= state.liveSequence))
      conflict('Rollback requires a prior release');
    const channel = historical?.channel ?? state.channel;
    const bindings = historical?.bindings ?? input.bindings!;
    await this.requireReviewedItems(client, state, input.projectId, bindings);
    await this.manifest(client, state, newId('ap'), new Date().toISOString(), channel, bindings, newId('rel'), new Date().toISOString());
    return { channel, bindings, rollback: !!historical };
  }

  /** A side-effect-free eligibility check. Approval still rechecks under its own lock. */
  async readiness(principal: AuthenticatedPrincipal, raw: unknown): Promise<{ ready: true; revisions: { channel: number; catalog: number }; liveReleaseId: string | null; rollback: boolean }> {
    const input = approvalRequest.parse(raw);
    const client = await this.projects.pool.connect();
    try {
      await client.query('BEGIN');
      const state = await this.locked(client, principal, input.projectId, input.deploymentId);
      const selected = await this.reviewedSelection(client, state, input);
      await client.query('ROLLBACK');
      return { ready: true, revisions: { channel: state.channelRevision, catalog: state.catalogRevision },
        liveReleaseId: state.liveId, rollback: selected.rollback };
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); return failure(error); }
    finally { client.release(); }
  }

  async status(principal: AuthenticatedPrincipal, projectId: string, deploymentId: string): Promise<{ revisions: { channel: number; catalog: number }; liveReleaseId: string | null; liveSequence: number; approvalRequired: true; nativeSubmission: 'separate' }> {
    ids.project.parse(projectId); ids.deployment.parse(deploymentId);
    const client = await this.projects.pool.connect();
    try {
      await client.query('BEGIN');
      const state = await this.locked(client, principal, projectId, deploymentId);
      await client.query('ROLLBACK');
      return { revisions: { channel: state.channelRevision, catalog: state.catalogRevision }, liveReleaseId: state.liveId,
        liveSequence: state.liveSequence, approvalRequired: true, nativeSubmission: 'separate' };
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); return failure(error); }
    finally { client.release(); }
  }

  async currentSummary(principal: AuthenticatedPrincipal, projectId: string, deploymentId: string) {
    ids.project.parse(projectId); ids.deployment.parse(deploymentId);
    const client = await this.projects.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const identity = await client.query('SELECT 1 FROM provider_identities WHERE creator_account_id = $1 AND issuer = $2 AND subject = $3',
        [principal.accountId, principal.issuer, principal.subject]);
      const deployment = await client.query('SELECT 1 FROM channel_deployments WHERE id = $1 AND project_id = $2 AND creator_account_id = $3',
        [deploymentId, projectId, principal.accountId]);
      if (!identity.rowCount || !deployment.rowCount) throw new RepositoryError('NOT_FOUND', 'Deployment not found');
      const result = await client.query<{ manifest_bytes: string; sha256: string }>(`SELECT r.manifest_bytes, r.sha256 FROM publication_live_pointers p
        JOIN publication_releases r ON r.id = p.release_id AND r.deployment_id = p.deployment_id
          AND r.project_id = p.project_id AND r.creator_account_id = p.creator_account_id
        WHERE p.deployment_id = $1 AND p.project_id = $2 AND p.creator_account_id = $3`,
      [deploymentId, projectId, principal.accountId]);
      if (result.rows[0] && digest(result.rows[0].manifest_bytes) !== result.rows[0].sha256)
        throw new RepositoryError('STORAGE_ERROR', 'Release integrity failed');
      const manifest = result.rows[0] ? publishedManifestSchema.parse(JSON.parse(result.rows[0].manifest_bytes)) : null;
      await client.query('COMMIT');
      return manifest ? { releaseId: manifest.releaseId, sequence: manifest.releaseSequence,
        revisions: manifest.approvedContentRevision,
        catalogItemIds: manifest.bindings.content.map(binding => binding.catalogItemId) } : null;
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); return failure(error); }
    finally { client.release(); }
  }

  async approve(principal: AuthenticatedPrincipal, raw: unknown): Promise<{ approvalId: string; approvedAt: string }> {
    const input = approvalRequest.parse(raw);
    const client = await this.projects.pool.connect();
    try {
      await client.query('BEGIN');
      const state = await this.locked(client, principal, input.projectId, input.deploymentId);
      const { channel, bindings, rollback } = await this.reviewedSelection(client, state, input);
      const approvalId = newId('ap');
      const approvedAt = new Date().toISOString();
      await client.query(`INSERT INTO publication_approvals(id, creator_account_id, project_id, deployment_id,
        channel_revision, catalog_revision, expected_live_release_id, rollback_source_release_id, channel_snapshot, bindings, approved_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [approvalId, state.owner, input.projectId, input.deploymentId, state.channelRevision, state.catalogRevision,
        state.liveId, input.rollbackSourceReleaseId ?? null, JSON.stringify(channel), JSON.stringify(bindings), approvedAt]);
      await client.query(`INSERT INTO publication_audit_events(creator_account_id, project_id, deployment_id, approval_id, action)
        VALUES ($1,$2,$3,$4,$5)`, [state.owner, input.projectId, input.deploymentId, approvalId,
        rollback ? 'rollback_approved' : 'approved']);
      await client.query('COMMIT');
      return { approvalId, approvedAt };
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); return failure(error); }
    finally { client.release(); }
  }

  async publish(principal: AuthenticatedPrincipal, projectId: string, deploymentId: string, approvalId: string): Promise<{ manifest: PublishedManifest; bytes: string; sha256: string }> {
    ids.project.parse(projectId); ids.deployment.parse(deploymentId); ids.approval.parse(approvalId);
    const client = await this.projects.pool.connect();
    try {
      await client.query('BEGIN');
      const state = await this.locked(client, principal, projectId, deploymentId);
      const approval = await client.query<ApprovalRow>(`SELECT * FROM publication_approvals
        WHERE id = $1 AND project_id = $2 AND deployment_id = $3 AND creator_account_id = $4`,
      [approvalId, projectId, deploymentId, state.owner]);
      const row = approval.rows[0];
      if (!row) throw new RepositoryError('NOT_FOUND', 'Approval not found');
      const existing = await client.query<ReleaseRow>(`SELECT id, sequence, previous_release_id, rollback_source_release_id, manifest_bytes, sha256, published_at
        FROM publication_releases WHERE approval_id = $1 AND creator_account_id = $2`, [approvalId, state.owner]);
      if (existing.rows[0]) {
        const manifest = await this.historical(client, state, deploymentId, existing.rows[0].id);
        await client.query('COMMIT');
        return { manifest, bytes: existing.rows[0].manifest_bytes, sha256: existing.rows[0].sha256 };
      }
      if (row.channel_revision !== state.channelRevision || row.catalog_revision !== state.catalogRevision ||
        row.expected_live_release_id !== state.liveId) conflict('Approval is stale; review the current draft and live release');
      const channel = channelSpecSchema.parse(row.channel_snapshot);
      const bindings = publicationBindingsSchema.parse(row.bindings);
      if (!row.rollback_source_release_id && !isDeepStrictEqual(channel, state.channel)) conflict('Approved channel changed');
      if (row.rollback_source_release_id) {
        const source = await this.historical(client, state, deploymentId, row.rollback_source_release_id);
        if (!isDeepStrictEqual(source.channel, channel) || !isDeepStrictEqual(source.bindings, bindings)) conflict('Rollback snapshot changed');
      }
      await this.requireReviewedItems(client, state, projectId, bindings);
      const releaseId = newId('rel');
      const publishedAt = new Date().toISOString();
      const manifest = await this.manifest(client, state, approvalId, row.approved_at.toISOString(), channel, bindings, releaseId, publishedAt, true);
      const bytes = canonicalBytes(manifest);
      if (Buffer.byteLength(bytes) > 1_048_576) conflict('Manifest exceeds release size limit');
      const sha256 = digest(bytes);
      await client.query(`INSERT INTO publication_releases(id, creator_account_id, project_id, deployment_id, approval_id,
        sequence, previous_release_id, rollback_source_release_id, manifest_bytes, sha256, published_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [releaseId, state.owner, projectId, deploymentId, approvalId, manifest.releaseSequence,
        state.liveId, row.rollback_source_release_id, bytes, sha256, publishedAt]);
      if (state.liveId) {
        const moved = await client.query(`UPDATE publication_live_pointers SET release_id = $4, sequence = $5, activated_at = now()
          WHERE deployment_id = $1 AND creator_account_id = $2 AND project_id = $3 AND release_id = $6 AND sequence = $7`,
        [deploymentId, state.owner, projectId, releaseId, manifest.releaseSequence, state.liveId, state.liveSequence]);
        if (moved.rowCount !== 1) conflict('Live pointer changed');
      } else {
        const moved = await client.query(`INSERT INTO publication_live_pointers(deployment_id, creator_account_id, project_id, release_id, sequence)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [deploymentId, state.owner, projectId, releaseId, manifest.releaseSequence]);
        if (moved.rowCount !== 1) conflict('Live pointer changed');
      }
      await client.query(`INSERT INTO publication_audit_events(creator_account_id, project_id, deployment_id, approval_id, release_id, action)
        VALUES ($1,$2,$3,$4,$5,$6)`, [state.owner, projectId, deploymentId, approvalId, releaseId,
        row.rollback_source_release_id ? 'rollback_published' : 'published']);
      await client.query('COMMIT');
      return { manifest, bytes, sha256 };
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); return failure(error); }
    finally { client.release(); }
  }

  async history(principal: AuthenticatedPrincipal, projectId: string, deploymentId: string): Promise<{ liveReleaseId: string | null; releases: { id: string; sequence: number; sha256: string; publishedAt: string; previousReleaseId: string | null; rollbackSourceReleaseId: string | null }[] }> {
    ids.project.parse(projectId); ids.deployment.parse(deploymentId);
    const client = await this.projects.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const identity = await client.query(`SELECT 1 FROM provider_identities WHERE creator_account_id = $1 AND issuer = $2 AND subject = $3`,
        [principal.accountId, principal.issuer, principal.subject]);
      const deployment = await client.query(`SELECT 1 FROM channel_deployments WHERE id = $1 AND project_id = $2 AND creator_account_id = $3`,
        [deploymentId, projectId, principal.accountId]);
      if (!identity.rowCount || !deployment.rowCount) throw new RepositoryError('NOT_FOUND', 'Deployment not found');
      const live = await client.query<{ release_id: string }>('SELECT release_id FROM publication_live_pointers WHERE deployment_id = $1 AND creator_account_id = $2', [deploymentId, principal.accountId]);
      const rows = await client.query<ReleaseRow>(`SELECT id, sequence, previous_release_id, rollback_source_release_id, sha256, manifest_bytes, published_at
        FROM publication_releases WHERE deployment_id = $1 AND creator_account_id = $2 ORDER BY sequence DESC`, [deploymentId, principal.accountId]);
      await client.query('COMMIT');
      return { liveReleaseId: live.rows[0]?.release_id ?? null, releases: rows.rows.map(row => ({ id: row.id, sequence: row.sequence,
        sha256: row.sha256, publishedAt: row.published_at.toISOString(), previousReleaseId: row.previous_release_id,
        rollbackSourceReleaseId: row.rollback_source_release_id })) };
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); return failure(error); }
    finally { client.release(); }
  }
}
