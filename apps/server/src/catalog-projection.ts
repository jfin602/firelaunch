import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { contentSchema, mediaUseEligible, type CatalogItem, type ContentItem, type MediaAsset } from '@firelaunch/contracts';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import { CatalogRepository } from './catalog-repository.js';
import { RepositoryError } from './repository.js';

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
function publicMediaUrl(asset: MediaAsset): string | undefined {
  if (asset.location.type !== 'https') return undefined;
  const url = new URL(asset.location.url);
  if (url.search || url.hash || url.username || url.password || url.protocol !== 'https:') return undefined;
  const host = url.hostname.toLowerCase();
  if (isIP(host) || host.startsWith('[') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
    (url.port && url.port !== '443')) return undefined;
  return url.toString();
}

function eligibleAsset(item: CatalogItem, assets: Map<string, MediaAsset>, kind: MediaAsset['kind'],
  use: 'television_display' | 'television_playback'): string | undefined {
  for (const id of item.mediaAssetIds) {
    const asset = assets.get(id);
    if (asset?.kind === kind && asset.catalogItemId === item.id && asset.deliveryEligible && mediaUseEligible(asset, use)) {
      const url = publicMediaUrl(asset);
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
  constructor(private readonly projects: HostedProjectRepository, catalog?: CatalogRepository) {
    this.catalog = catalog ?? new CatalogRepository(projects);
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
      const artwork = eligibleAsset(item, assets, 'artwork', 'television_display') ?? 'assets/catalog-placeholder.png';
      const mediaUrl = item.kind === 'video' || item.kind === 'audio'
        ? eligibleAsset(item, assets, item.kind, 'television_playback') : undefined;
      if (!blockedReason && item.kind !== 'book' && !mediaUrl) blockedReason = 'playback_rights_or_delivery_missing';
      const title = (item.creatorOverrides?.title ?? item.sourceRecord.metadata.title).trim().slice(0, 120).trim();
      const description = (item.creatorOverrides?.description ?? item.sourceRecord.metadata.description ?? '').slice(0, 2000);
      const baseline = blockedReason ? null : contentSchema.parse({ id: contentId, title, description, artwork,
        presentation, ...(mediaUrl ? { mediaUrl } : {}) });
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
