import { createHash } from 'node:crypto';
import { z } from 'zod';
import { contentSchema, mediaRenditionSetSchema, mediaUseEligible, type CatalogItem, type ContentItem, type MediaAsset } from '@firelaunch/contracts';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import { CatalogRepository } from './catalog-repository.js';
import { RepositoryError } from './repository.js';
import { publicMediaUrl } from './hosted-media-policy.js';
import type { S3MediaStorage } from './media-storage.js';

const selectionSchema = z.strictObject({
  expectedProjectRevision: z.number().int().positive(),
  expectedCatalogRevision: z.number().int().nonnegative(),
  itemIds: z.array(z.string().regex(/^ci_[a-f0-9]{32}$/)).max(500).refine(unique),
  collectionIds: z.array(z.string().regex(/^col_[a-f0-9]{32}$/)).max(100).refine(unique)
}).refine(value => value.itemIds.length + value.collectionIds.length > 0, 'Select catalog content');
export type CatalogSelection = z.infer<typeof selectionSchema>;

function unique(values: string[]): boolean { return new Set(values).size === values.length; }
function stableContentId(itemId: string): string {
  return `item_${createHash('sha256').update('catalog-content-v1\0').update(itemId).digest('hex').slice(0, 32)}`;
}

// Query strings and fragments can carry private, expiring download capabilities. Only a
// stable, public HTTPS media location can enter an exportable ChannelSpec.
function assetPublicMediaUrl(asset: MediaAsset): string | undefined {
  if (asset.location.type !== 'https') return undefined;
  return publicMediaUrl(asset.location.url) ? new URL(asset.location.url).toString() : undefined;
}

function eligibleAsset(item: CatalogItem, assets: Map<string, MediaAsset>, kind: MediaAsset['kind'],
  use: 'television_display' | 'television_playback'): string | undefined {
  for (const id of item.mediaAssetIds) {
    const asset = assets.get(id);
    if (asset?.kind === kind && asset.catalogItemId === item.id && asset.deliveryEligible && mediaUseEligible(asset, use)) {
      const url = assetPublicMediaUrl(asset);
      if (url) return url;
    }
  }
  return undefined;
}

export type CatalogBinding = Readonly<{
  catalogItemId: string;
  contentId: string;
  collectionIds: string[];
  // Only allowlisted presentation values are retained. Future composition compares this
  // baseline with the current ChannelSpec before replacing any creator-touched field.
  baseline: ContentItem | null;
  blockedReason?: 'source_revoked' | 'unsupported_kind' | 'playback_rights_or_delivery_missing';
}>;

export type CatalogProjection = Readonly<{
  projectRevision: number;
  catalogRevision: number;
  bindings: CatalogBinding[];
  collections: { id: string; kind: string; title: string; contentIds: string[] }[];
}>;

/**
 * Internal, read-only generation input. Import approval is evidenced by a persisted item
 * (import previews are never read here), selection by the explicit IDs, and permission
 * separately by the linked asset's cleared TV use claim. This service grants no media
 * access and does not persist a ChannelSpec or alter source-owned catalog metadata.
 */
export class CatalogProjectionService {
  private readonly catalog: CatalogRepository;
  constructor(private readonly projects: HostedProjectRepository, catalog?: CatalogRepository,
    private readonly mediaStorage?: S3MediaStorage) {
    this.catalog = catalog ?? new CatalogRepository(projects);
  }

  private async managedVideoUrl(owner: string, projectId: string, item: CatalogItem,
    assets: Map<string, MediaAsset>): Promise<string | undefined> {
    if (!this.mediaStorage) return undefined;
    for (const id of item.mediaAssetIds) {
      const asset = assets.get(id);
      if (!asset || asset.kind !== 'video' || asset.location.type !== 'managed_hls' ||
        asset.catalogItemId !== item.id || !asset.deliveryEligible ||
        !mediaUseEligible(asset, 'television_display') || !mediaUseEligible(asset, 'television_playback')) continue;
      const result = await this.projects.pool.query<{ id: string; job_id: string; creator_account_id: string;
        project_id: string; item_id: string; asset_id: string; profile: 'hls-avc-aac-v1';
        master_key: string; master_sha256: string; variants: unknown; verified_at: Date;
        revoked_at: Date | null; state: string; rendition_set_id: string | null }>(`
        SELECT r.*, j.state, j.rendition_set_id FROM media_processing_jobs j
        JOIN media_upload_sessions u ON u.id = j.upload_session_id AND u.creator_account_id = j.creator_account_id
          AND u.project_id = j.project_id AND u.asset_id = j.asset_id AND u.state = 'verified'
        LEFT JOIN media_rendition_sets r ON r.id = j.rendition_set_id AND r.creator_account_id = j.creator_account_id
          AND r.project_id = j.project_id AND r.asset_id = j.asset_id AND r.item_id = j.item_id
        LEFT JOIN media_asset_lifecycle l ON l.asset_id = j.asset_id AND l.creator_account_id = j.creator_account_id
          AND l.project_id = j.project_id
        WHERE j.creator_account_id = $1 AND j.project_id = $2 AND j.item_id = $3 AND j.asset_id = $4
          AND l.revoked_at IS NULL
        ORDER BY j.created_at DESC, j.id DESC LIMIT 1`, [owner, projectId, item.id, id]);
      const row = result.rows[0];
      if (!row || row.state !== 'ready' || !row.id || row.revoked_at || row.rendition_set_id !== row.id) continue;
      try {
        const set = mediaRenditionSetSchema.parse({ id: row.id, jobId: row.job_id,
          creatorAccountId: row.creator_account_id, projectId: row.project_id, catalogItemId: row.item_id,
          mediaAssetId: row.asset_id, profile: row.profile, masterKey: row.master_key,
          masterSha256: row.master_sha256, variants: row.variants, verifiedAt: row.verified_at.toISOString() });
        return this.mediaStorage.publishedMasterUrl({ creatorAccountId: owner, projectId, mediaAssetId: id }, set);
      } catch { return undefined; }
    }
    return undefined;
  }

  async project(principal: AuthenticatedPrincipal, projectId: string, rawSelection: unknown): Promise<CatalogProjection> {
    const selection = selectionSchema.parse(rawSelection);
    // Both repository reads verify the complete authenticated principal against the
    // owner identity. No owner or catalog record is accepted from the caller.
    const project = await this.projects.read(principal, projectId);
    const inventory = await this.catalog.read(principal, projectId);
    if (project.revision !== selection.expectedProjectRevision || inventory.revision !== selection.expectedCatalogRevision) {
      throw new RepositoryError('CONFLICT', 'Project or catalog revision changed');
    }
    const items = new Map(inventory.items.map(item => [item.id, item]));
    const collections = new Map(inventory.collections.map(collection => [collection.id, collection]));
    for (const id of selection.itemIds) if (!items.has(id)) throw new RepositoryError('NOT_FOUND', 'Catalog item not found');
    for (const id of selection.collectionIds) if (!collections.has(id)) throw new RepositoryError('NOT_FOUND', 'Collection not found');

    const selected = new Set(selection.itemIds);
    for (const id of selection.collectionIds) for (const itemId of collections.get(id)!.itemIds) selected.add(itemId);
    if (selected.size > 500) throw new RepositoryError('INVALID_INPUT', 'Selection exceeds ChannelSpec content limit');
    const approvalRows = await this.projects.pool.query<{ item_id: string }>(`SELECT item_id FROM catalog_item_approvals
      WHERE project_id = $1 AND creator_account_id = $2 AND item_id = ANY($3::text[])`,
    [projectId, principal.accountId, [...selected]]);
    const approved = new Set(approvalRows.rows.map(row => row.item_id));
    for (const id of selected) if (!approved.has(id)) throw new RepositoryError('NOT_FOUND', 'Approved catalog item not found');
    const assets = new Map(inventory.mediaAssets.map(asset => [asset.id, asset]));
    const sources = new Map(inventory.sources.map(source => [source.id, source]));
    const bindings: CatalogBinding[] = [];
    for (const id of selected) {
      const item = items.get(id)!;
      const contentId = stableContentId(id);
      const collectionIds = selection.collectionIds.filter(collectionId => collections.get(collectionId)!.itemIds.includes(id));
      const source = sources.get(item.sourceRecord.sourceId)!;
      let blockedReason: CatalogBinding['blockedReason'];
      if (source.permission.retrieval === 'revoked' || source.permission.tvDisplay === 'revoked') blockedReason = 'source_revoked';
      else if (item.kind === 'listing') blockedReason = 'unsupported_kind';
      const presentation = item.kind === 'book' ? 'information' : item.kind;
      const managedThumbnail = item.kind === 'video' && item.mediaAssetIds.some(assetId => {
        const asset = assets.get(assetId);
        return asset?.kind === 'artwork' && asset.location.type === 'private_object' &&
          asset.catalogItemId === item.id && asset.deliveryEligible && mediaUseEligible(asset, 'television_display');
      });
      // The private thumbnail resolves only during explicit publication. A draft keeps
      // the safe placeholder, even when an older external artwork URL also exists.
      const artwork = managedThumbnail ? 'assets/catalog-placeholder.png' :
        eligibleAsset(item, assets, 'artwork', 'television_display') ?? 'assets/catalog-placeholder.png';
      const mediaUrl = item.kind === 'video' || item.kind === 'audio'
        ? eligibleAsset(item, assets, item.kind, 'television_playback') ??
          (item.kind === 'video' ? await this.managedVideoUrl(principal.accountId, projectId, item, assets) : undefined)
        : undefined;
      if (!blockedReason && item.kind !== 'book' && !mediaUrl) blockedReason = 'playback_rights_or_delivery_missing';
      const title = (item.creatorOverrides?.title ?? item.sourceRecord.metadata.title).trim().slice(0, 120).trim();
      const description = (item.creatorOverrides?.description ?? item.sourceRecord.metadata.description ?? '').slice(0, 2000);
      const metadata = { ...item.sourceRecord.metadata, ...item.creatorOverrides };
      const audiobook = item.kind === 'book' && item.audiobook ? assets.get(item.audiobook.audioAssetId) : undefined;
      const audiobookUrl = audiobook?.kind === 'audio' && audiobook.catalogItemId === item.id &&
        audiobook.deliveryEligible && mediaUseEligible(audiobook, 'television_playback')
        ? assetPublicMediaUrl(audiobook) : undefined;
      const baseline = blockedReason ? null : contentSchema.parse({ id: contentId, title, description, artwork,
        presentation, ...(mediaUrl ? { mediaUrl } : {}),
        ...(item.kind === 'book' && metadata.author ? { author: metadata.author } : {}),
        ...(item.kind === 'book' && metadata.series ? { series: metadata.series.slice(0, 80) } : {}),
        ...(item.kind === 'book' && metadata.narrator ? { narrator: metadata.narrator } : {}),
        ...(item.kind === 'book' && metadata.publicationDate ? { publicationDate: metadata.publicationDate } : {}),
        ...(audiobookUrl ? { audiobook: { mediaUrl: audiobookUrl } } : {}) });
      bindings.push({ catalogItemId: id, contentId, collectionIds, baseline, ...(blockedReason ? { blockedReason } : {}) });
    }
    // Reject snapshots made stale while resolving candidates. The eventual spec write
    // still uses HostedProjectRepository.update's revision compare-and-swap.
    const [latestProject, latestCatalog] = await Promise.all([
      this.projects.read(principal, projectId), this.catalog.read(principal, projectId)
    ]);
    if (latestProject.revision !== project.revision || latestCatalog.revision !== inventory.revision) {
      throw new RepositoryError('CONFLICT', 'Project or catalog revision changed');
    }
    return { projectRevision: project.revision, catalogRevision: inventory.revision, bindings,
      collections: selection.collectionIds.map(id => {
        const collection = collections.get(id)!;
        return { id, kind: collection.kind, title: collection.title.slice(0, 120).trim(),
          contentIds: collection.itemIds.map(stableContentId) };
      }) };
  }
}
