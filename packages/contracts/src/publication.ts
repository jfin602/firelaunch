import { z } from 'zod';
import { channelSpecSchema, contentPresentation, SCHEMA_VERSION, type ChannelSpec } from './index.js';
import { catalogInventorySchema, mediaUseEligible, type CatalogInventory, type MediaAsset } from './catalog.js';
import { channelDeploymentSchema } from './creator.js';

export const PUBLISHED_MANIFEST_SCHEMA_VERSION = 1 as const;
export const TV_CLIENT_SCHEMA_VERSION = 1 as const;
const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-f0-9]{32}$`));
const revisionSchema = z.number().int().positive();
const publicUrlSchema = z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol === 'https:' && !!host && !url.username && !url.password && !url.search && !url.hash
      && !host.startsWith('[') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)
      && host !== 'localhost' && !host.endsWith('.localhost') && !host.endsWith('.local')
      && !host.endsWith('.internal') && !host.endsWith('.amazonaws.com') && !host.endsWith('.amazonaws.com.cn')
      && (!url.port || url.port === '443') && !url.pathname.split('/').some(part =>
        ['staged', 'original', 'private-objects'].includes(decodeURIComponent(part).toLowerCase()));
  } catch { return false; }
}, 'Expected a public, stable HTTPS URL without credentials, query or fragment');

const revisionPairSchema = z.strictObject({ channel: revisionSchema, catalog: revisionSchema });
export const publicationDraftSchema = z.strictObject({
  state: z.literal('draft'), creatorAccountId: id('cr'), projectId: id('ch'), revisions: revisionPairSchema
});
export const publicationApprovalSchema = z.strictObject({
  state: z.literal('approved'), creatorAccountId: id('cr'), projectId: id('ch'),
  revisions: revisionPairSchema, approvalId: id('ap'), approvedAt: z.iso.datetime()
});
export const publicationStateSchema = z.discriminatedUnion('state', [publicationDraftSchema, publicationApprovalSchema]);
export type PublicationDraft = z.infer<typeof publicationDraftSchema>;
export type PublicationApproval = z.infer<typeof publicationApprovalSchema>;

// ChannelSpec v1 requires content artwork. An informational item omits playback,
// but still needs a separately display-cleared artwork binding. A text-only
// release needs an explicit future ChannelSpec/TV rendering contract.
const mediaBindingSchema = z.strictObject({
  contentId: id('item'), catalogItemId: id('ci'), playbackAssetId: id('ma').optional(), artworkAssetId: id('ma')
});
export const publicationBindingsSchema = z.strictObject({
  content: z.array(mediaBindingSchema).max(500),
  logoAssetId: id('ma').optional(), heroArtworkAssetId: id('ma').optional()
});
export type PublicationBindings = z.infer<typeof publicationBindingsSchema>;

const publicMediaSchema = z.strictObject({
  id: id('ma'), kind: z.enum(['video', 'audio', 'artwork']), url: publicUrlSchema
});
const managedArtworkPath = /^\/api\/public-artwork\/(dep_[a-f0-9]{32})\/(rel_[a-f0-9]{32})\/(ma_[a-f0-9]{32})\/([a-f0-9]{64})\.(png|jpg)$/;
function sameManagedArtwork(previous: string, next: string): boolean {
  try {
    const oldUrl = new URL(previous), newUrl = new URL(next);
    const oldPath = managedArtworkPath.exec(oldUrl.pathname), newPath = managedArtworkPath.exec(newUrl.pathname);
    return !!oldPath && !!newPath && oldUrl.origin === newUrl.origin && !oldUrl.search && !oldUrl.hash &&
      [1, 3, 4, 5].every(index => oldPath[index] === newPath[index]);
  } catch { return false; }
}
const publicDeploymentSchema = z.strictObject({
  id: id('dep'), projectId: id('ch'), channelId: id('ch'), packageId: z.string().min(5).max(255)
    .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/)
}).refine(value => value.projectId === value.channelId, 'Deployment project and channel must match');

// This is the public TV wire shape. It contains no account, source, rights evidence,
// approval actor, raw payload or draft state. Schema parsing checks its own references;
// projectApprovedManifest checks rights against the private inventory before release.
export const publishedManifestSchema = z.strictObject({
  schemaVersion: z.literal(PUBLISHED_MANIFEST_SCHEMA_VERSION),
  releaseId: id('rel'), releaseSequence: revisionSchema, previousReleaseId: id('rel').optional(),
  publishedAt: z.iso.datetime(), deployment: publicDeploymentSchema,
  approvedContentRevision: revisionPairSchema,
  approvalId: id('ap'),
  clientCompatibility: z.strictObject({
    minSchemaVersion: z.literal(TV_CLIENT_SCHEMA_VERSION),
    maxSchemaVersion: z.literal(TV_CLIENT_SCHEMA_VERSION),
    channelSchemaVersion: z.literal(1)
  }),
  channel: z.lazy(() => channelSpecSchema),
  media: z.array(publicMediaSchema).max(1002),
  bindings: publicationBindingsSchema
}).superRefine((manifest, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (manifest.releaseId === manifest.previousReleaseId) issue('Release cannot point to itself');
  if (manifest.releaseSequence === 1 && manifest.previousReleaseId) issue('First release cannot have a predecessor');
  if (manifest.releaseSequence > 1 && !manifest.previousReleaseId) issue('Later release needs a predecessor');
  if (manifest.channel.id !== manifest.deployment.channelId) issue('Channel differs from deployment');
  const media = new Map(manifest.media.map(asset => [asset.id, asset]));
  if (media.size !== manifest.media.length) issue('Duplicate media IDs');
  const bindings = new Map(manifest.bindings.content.map(binding => [binding.contentId, binding]));
  if (bindings.size !== manifest.bindings.content.length || bindings.size !== manifest.channel.content.length) issue('Content bindings must be one-to-one');
  if (new Set(manifest.bindings.content.map(binding => binding.catalogItemId)).size !== manifest.bindings.content.length) issue('Catalog selections must be one-to-one');
  const used = new Set<string>();
  const requireAsset = (id: string | undefined, kind: 'video' | 'audio' | 'artwork', url: string | undefined) => {
    if (!id || !url) { issue('Missing required media binding'); return; }
    const asset = media.get(id);
    if (!asset || asset.url !== url || asset.kind !== kind) {
      issue('Media binding differs from public channel reference');
    }
    used.add(id);
  };
  for (const content of manifest.channel.content) {
    const binding = bindings.get(content.id);
    if (!binding) { issue('Content has no media binding'); continue; }
    const presentation = contentPresentation(content);
    if (presentation === 'information') {
      if (binding.playbackAssetId !== undefined) issue('Informational content cannot bind playback');
    } else requireAsset(binding.playbackAssetId, presentation, content.mediaUrl);
    requireAsset(binding.artworkAssetId, 'artwork', content.artwork);
  }
  requireOptionalArtwork(manifest.channel.brand.logo, manifest.bindings.logoAssetId, requireAsset, issue);
  requireOptionalArtwork(manifest.channel.brand.heroArtwork, manifest.bindings.heroArtworkAssetId, requireAsset, issue);
  if (used.size !== media.size) issue('Manifest includes unused media');
});
export type PublishedManifest = z.infer<typeof publishedManifestSchema>;

function requireOptionalArtwork(
  url: string | undefined, id: string | undefined,
  requireAsset: (id: string | undefined, kind: 'video' | 'audio' | 'artwork', url: string | undefined) => void,
  issue: (message: string) => void
): void {
  if (url === undefined && id === undefined) return;
  if (!url || !id) { issue('Brand artwork needs a media binding'); return; }
  requireAsset(id, 'artwork', url);
}

export function assertClientCompatible(manifestInput: unknown, clientSchemaVersion: number): PublishedManifest {
  const manifest = publishedManifestSchema.parse(manifestInput);
  if (!Number.isInteger(clientSchemaVersion) || clientSchemaVersion < manifest.clientCompatibility.minSchemaVersion ||
    clientSchemaVersion > manifest.clientCompatibility.maxSchemaVersion) throw new Error('Incompatible TV client schema');
  return manifest;
}

export function projectApprovedManifest(input: {
  approval: unknown; deployment: unknown; channel: unknown; inventory: unknown; bindings: unknown;
  releaseId: string; releaseSequence: number; previousReleaseId?: string; publishedAt: string;
  resolvedPlayback?: ReadonlyMap<string, string>;
  resolvedArtwork?: ReadonlyMap<string, string>;
}): PublishedManifest {
  const approval = publicationApprovalSchema.parse(input.approval);
  const deployment = channelDeploymentSchema.parse(input.deployment);
  const channel: ChannelSpec = channelSpecSchema.parse(input.channel);
  const inventory: CatalogInventory = catalogInventorySchema.parse(input.inventory);
  const bindings = publicationBindingsSchema.parse(input.bindings);
  if (approval.creatorAccountId !== deployment.creatorAccountId || approval.creatorAccountId !== inventory.creatorAccountId ||
    approval.projectId !== deployment.projectId || approval.projectId !== inventory.projectId || channel.id !== approval.projectId) {
    throw new Error('Publication scope differs');
  }
  const assetById = new Map(inventory.mediaAssets.map(asset => [asset.id, asset]));
  const itemById = new Map(inventory.items.map(item => [item.id, item]));
  const sourceById = new Map(inventory.sources.map(source => [source.id, source]));
  const publicMedia = new Map<string, z.infer<typeof publicMediaSchema>>();
  const addAsset = (id: string, kind: 'video' | 'audio' | 'artwork', expectedUrl: string, itemId?: string) => {
    const asset: MediaAsset | undefined = assetById.get(id);
    const resolved = kind === 'artwork' ? input.resolvedArtwork?.get(id) : input.resolvedPlayback?.get(id);
    if (!asset || !asset.deliveryEligible || !mediaUseEligible(asset, kind === 'artwork' ? 'television_display' : 'television_playback') ||
      asset.kind !== kind ||
      (itemId && asset.catalogItemId !== itemId) || (resolved
        ? expectedUrl !== resolved || (kind === 'video' ? asset.location.type !== 'managed_hls' :
          kind === 'artwork' ? asset.location.type !== 'private_object' : true)
        : asset.location.type !== 'https' || asset.location.url !== expectedUrl)) {
      throw new Error('Invalid, unlicensed or unpublished media reference');
    }
    const item = itemById.get(asset.catalogItemId);
    const source = item && sourceById.get(item.sourceRecord.sourceId);
    if (!item || !source || source.state === 'discovered' ||
      ['unknown', 'revoked'].includes(source.permission.retrieval) ||
      ['unknown', 'revoked'].includes(source.permission.tvDisplay)) {
      throw new Error('Media source lacks TV display authorization');
    }
    publicMedia.set(id, { id, kind: asset.kind, url: publicUrlSchema.parse(expectedUrl) });
  };
  if (bindings.content.length !== channel.content.length ||
    new Set(bindings.content.map(binding => binding.contentId)).size !== bindings.content.length ||
    new Set(bindings.content.map(binding => binding.catalogItemId)).size !== bindings.content.length) {
    throw new Error('Content and catalog selections must be one-to-one');
  }
  const resolvedChannel = { ...channel, content: channel.content.map(content => {
    const binding = bindings.content.find(value => value.contentId === content.id);
    const url = binding?.playbackAssetId && input.resolvedPlayback?.get(binding.playbackAssetId);
    const artwork = binding?.artworkAssetId && input.resolvedArtwork?.get(binding.artworkAssetId);
    if (artwork && content.artwork !== 'assets/catalog-placeholder.png' && !sameManagedArtwork(content.artwork, artwork))
      throw new Error('Managed artwork differs from the channel draft');
    return { ...content, ...(url ? { mediaUrl: url } : {}), ...(artwork ? { artwork } : {}) };
  }) };
  for (const binding of bindings.content) {
    const content = resolvedChannel.content.find(value => value.id === binding.contentId);
    const item = itemById.get(binding.catalogItemId);
    if (!content || !item || !item.mediaAssetIds.includes(binding.artworkAssetId)) throw new Error('Content binding differs from catalog');
    const source = sourceById.get(item.sourceRecord.sourceId);
    if (!source || source.state === 'discovered' ||
      ['unknown', 'revoked'].includes(source.permission.retrieval) ||
      ['unknown', 'revoked'].includes(source.permission.tvDisplay)) throw new Error('Content source lacks TV display authorization');
    const presentation = contentPresentation(content);
    if ((presentation === 'information' && item.kind !== 'book') ||
      (presentation !== 'information' && presentation !== item.kind)) throw new Error('Content presentation differs from catalog');
    if (presentation === 'information') {
      if (binding.playbackAssetId !== undefined) throw new Error('Informational content cannot bind playback');
    } else {
      if (!binding.playbackAssetId || !item.mediaAssetIds.includes(binding.playbackAssetId) || !content.mediaUrl) {
        throw new Error('Content has no publishable playback media');
      }
      addAsset(binding.playbackAssetId, presentation, content.mediaUrl, item.id);
    }
    addAsset(binding.artworkAssetId, 'artwork', content.artwork, item.id);
  }
  if (channel.brand.logo && bindings.logoAssetId) addAsset(bindings.logoAssetId, 'artwork', channel.brand.logo);
  if (channel.brand.heroArtwork && bindings.heroArtworkAssetId) addAsset(bindings.heroArtworkAssetId, 'artwork', channel.brand.heroArtwork);
  return publishedManifestSchema.parse({
    schemaVersion: PUBLISHED_MANIFEST_SCHEMA_VERSION,
    releaseId: input.releaseId, releaseSequence: input.releaseSequence,
    previousReleaseId: input.previousReleaseId, publishedAt: input.publishedAt,
    deployment: { id: deployment.id, projectId: deployment.projectId, channelId: deployment.channelId, packageId: deployment.packageId },
    approvedContentRevision: approval.revisions, approvalId: approval.approvalId,
    clientCompatibility: { minSchemaVersion: TV_CLIENT_SCHEMA_VERSION, maxSchemaVersion: TV_CLIENT_SCHEMA_VERSION, channelSchemaVersion: SCHEMA_VERSION },
    channel: resolvedChannel, media: [...publicMedia.values()], bindings
  });
}
