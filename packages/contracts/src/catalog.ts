import { z } from 'zod';

export const CATALOG_SCHEMA_VERSION = 1 as const;

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-f0-9]{32}$`));
const creatorIdSchema = id('cr');
const projectIdSchema = id('ch');
const sourceIdSchema = id('src');
const catalogItemIdSchema = id('ci');
const mediaAssetIdSchema = id('ma');
const collectionIdSchema = id('col');
const evidenceIdSchema = id('ev');
const titleSchema = z.string().trim().min(1).max(160);
const descriptionSchema = z.string().max(4000);
const externalValueSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const unique = (values: string[]) => new Set(values).size === values.length;
const httpsUrlSchema = z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !!host && !url.username && !url.password && !url.hash
      && !host.startsWith('[') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)
      && host !== 'localhost' && !host.endsWith('.localhost') && !host.endsWith('.local');
  } catch { return false; }
}, 'Expected a public HTTPS URL without credentials or fragment');
const uploadKeySchema = z.string().max(256).regex(/^media\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/, 'Unsafe upload key');

// An external match is a namespaced clue, never evidence of retrieval or TV-use permission.
export const externalIdentifierSchema = z.strictObject({
  provider: z.enum(['amazon', 'creator']),
  marketplace: z.string().min(2).max(32).regex(/^[A-Z0-9-]+$/).optional(),
  kind: z.enum(['asin', 'sku', 'seller_id', 'author_id', 'feed_item_id', 'upload_id']),
  value: externalValueSchema
}).superRefine((identifier, context) => {
  const amazonKind = ['asin', 'sku', 'seller_id', 'author_id'].includes(identifier.kind);
  if (identifier.provider === 'amazon' && (!amazonKind || !identifier.marketplace)) {
    context.addIssue({ code: 'custom', message: 'Amazon identifiers need a marketplace and Amazon identifier kind' });
  }
  if (identifier.provider === 'creator' && (amazonKind || identifier.marketplace)) {
    context.addIssue({ code: 'custom', message: 'Creator identifiers cannot claim an Amazon namespace' });
  }
});
export type ExternalIdentifier = z.infer<typeof externalIdentifierSchema>;
const externalKey = (identifier: ExternalIdentifier) =>
  `${identifier.provider}:${identifier.marketplace ?? ''}:${identifier.kind}:${identifier.value}`;

export const sourcePermissionSchema = z.strictObject({
  // These are recorded assertions/evidence references. Parsing does not verify consent.
  retrieval: z.enum(['unknown', 'creator_asserted', 'provider_authorized', 'revoked']),
  tvDisplay: z.enum(['unknown', 'creator_asserted', 'provider_authorized', 'revoked']),
  verificationEvidenceId: evidenceIdSchema.optional()
});
export type SourcePermission = z.infer<typeof sourcePermissionSchema>;

export const catalogSourceSchema = z.strictObject({
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  id: sourceIdSchema,
  creatorAccountId: creatorIdSchema,
  projectId: projectIdSchema,
  type: z.enum(['creator_csv', 'creator_json', 'creator_https_feed', 'creator_upload',
    'amazon_seller', 'amazon_author', 'amazon_audible']),
  state: z.enum(['discovered', 'verified', 'syncing']),
  externalIdentity: externalIdentifierSchema.optional(),
  endpointUrl: httpsUrlSchema.optional(),
  permission: sourcePermissionSchema
}).superRefine((source, context) => {
  const amazon = source.type.startsWith('amazon_');
  if (amazon && source.externalIdentity?.provider !== 'amazon') {
    context.addIssue({ code: 'custom', message: 'Amazon source needs an Amazon identity' });
  }
  if (!amazon && source.externalIdentity?.provider === 'amazon') {
    context.addIssue({ code: 'custom', message: 'Creator source cannot claim an Amazon identity' });
  }
  if ((source.type === 'creator_https_feed') !== (source.endpointUrl !== undefined)) {
    context.addIssue({ code: 'custom', message: 'Only HTTPS feed sources require an endpoint' });
  }
  if (source.state === 'syncing' && ['creator_csv', 'creator_json', 'creator_upload'].includes(source.type)) {
    context.addIssue({ code: 'custom', message: 'Static creator files and uploads cannot claim ongoing sync' });
  }
  if (source.state !== 'discovered') {
    const allowed = amazon ? 'provider_authorized' : 'creator_asserted';
    if (!source.permission.verificationEvidenceId ||
      source.permission.retrieval !== allowed || source.permission.tvDisplay !== allowed) {
      context.addIssue({ code: 'custom', message: 'Verified sources need recorded identity and retrieval/TV-display permission' });
    }
  }
  if (source.state === 'discovered' && source.permission.verificationEvidenceId) {
    context.addIssue({ code: 'custom', message: 'Discovered source cannot claim verification evidence' });
  }
});
export type CatalogSource = z.infer<typeof catalogSourceSchema>;

export const catalogMetadataSchema = z.strictObject({
  title: titleSchema,
  description: descriptionSchema.optional(),
  artworkUrl: httpsUrlSchema.optional()
});
export type CatalogMetadata = z.infer<typeof catalogMetadataSchema>;

// Original source values are immutable input to later reconciliation; creator overrides live apart.
export const sourceRecordSchema = z.strictObject({
  sourceId: sourceIdSchema,
  externalId: externalIdentifierSchema,
  observedAt: z.iso.datetime(),
  metadata: catalogMetadataSchema
});
export type SourceRecord = z.infer<typeof sourceRecordSchema>;
export const creatorMetadataOverridesSchema = z.strictObject({
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  artworkUrl: httpsUrlSchema.optional(),
  editedAt: z.iso.datetime()
}).refine(value => value.title !== undefined || value.description !== undefined || value.artworkUrl !== undefined,
  'An override must contain an edited field');
export type CreatorMetadataOverrides = z.infer<typeof creatorMetadataOverridesSchema>;

export const catalogItemSchema = z.strictObject({
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  id: catalogItemIdSchema,
  creatorAccountId: creatorIdSchema,
  projectId: projectIdSchema,
  kind: z.enum(['video', 'audio', 'book', 'listing']),
  sourceRecord: sourceRecordSchema,
  externalIdentifiers: z.array(externalIdentifierSchema).max(20),
  creatorOverrides: creatorMetadataOverridesSchema.optional(),
  mediaAssetIds: z.array(mediaAssetIdSchema).max(100)
}).superRefine((item, context) => {
  const identifiers = item.externalIdentifiers.map(externalKey);
  if (!identifiers.includes(externalKey(item.sourceRecord.externalId))) {
    context.addIssue({ code: 'custom', message: 'Original source identifier must be retained' });
  }
  if (!unique(identifiers)) context.addIssue({ code: 'custom', message: 'Duplicate external identifiers' });
  if (!unique(item.mediaAssetIds)) context.addIssue({ code: 'custom', message: 'Duplicate media asset IDs' });
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const mediaRightsSchema = z.strictObject({
  status: z.enum(['unknown', 'cleared', 'revoked']),
  basis: z.enum(['none', 'creator_asserted', 'license_documented']),
  permittedUse: z.enum(['none', 'television_playback', 'television_display']),
  assertedAt: z.iso.datetime().optional(),
  evidenceId: evidenceIdSchema.optional()
}).superRefine((rights, context) => {
  if (rights.status === 'cleared' && (rights.basis === 'none' || rights.permittedUse === 'none' || !rights.assertedAt)) {
    context.addIssue({ code: 'custom', message: 'Cleared rights need a dated permission assertion' });
  }
  if (rights.basis === 'license_documented' && !rights.evidenceId) {
    context.addIssue({ code: 'custom', message: 'Documented license needs evidence' });
  }
  if (rights.status === 'unknown' && (rights.basis !== 'none' || rights.permittedUse !== 'none' || rights.assertedAt || rights.evidenceId)) {
    context.addIssue({ code: 'custom', message: 'Unknown rights cannot carry permission claims' });
  }
});
export type MediaRights = z.infer<typeof mediaRightsSchema>;

export const mediaAssetSchema = z.strictObject({
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  id: mediaAssetIdSchema,
  creatorAccountId: creatorIdSchema,
  projectId: projectIdSchema,
  catalogItemId: catalogItemIdSchema,
  kind: z.enum(['video', 'audio', 'artwork']),
  location: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('https'), url: httpsUrlSchema }),
    z.strictObject({ type: z.literal('upload'), key: uploadKeySchema })
  ]),
  rights: mediaRightsSchema,
  deliveryEligible: z.boolean()
}).superRefine((asset, context) => {
  if (asset.deliveryEligible && (asset.rights.status !== 'cleared' ||
    asset.rights.permittedUse !== (asset.kind === 'artwork' ? 'television_display' : 'television_playback'))) {
    context.addIssue({ code: 'custom', message: 'Deliverable media needs cleared, kind-specific TV rights' });
  }
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

export const collectionSchema = z.strictObject({
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  id: collectionIdSchema,
  creatorAccountId: creatorIdSchema,
  projectId: projectIdSchema,
  kind: z.enum(['series', 'bookshelf', 'featured', 'album', 'playlist', 'rail']),
  title: titleSchema,
  itemIds: z.array(catalogItemIdSchema).max(500).refine(unique, 'Duplicate collection item IDs')
});
export type Collection = z.infer<typeof collectionSchema>;

// Snapshot validation checks local references. Hosted P2 must enforce tenant authorization and
// cross-transaction uniqueness in storage; a parsed snapshot does not grant either permission.
export const catalogInventorySchema = z.strictObject({
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  creatorAccountId: creatorIdSchema,
  projectId: projectIdSchema,
  sources: z.array(catalogSourceSchema).max(100),
  items: z.array(catalogItemSchema).max(5000),
  mediaAssets: z.array(mediaAssetSchema).max(10000),
  collections: z.array(collectionSchema).max(500)
}).superRefine((inventory, context) => {
  const sourceIds = new Set(inventory.sources.map(source => source.id));
  const itemIds = new Set(inventory.items.map(item => item.id));
  const assetIds = new Set(inventory.mediaAssets.map(asset => asset.id));
  const itemById = new Map(inventory.items.map(item => [item.id, item]));
  for (const [label, values] of [
    ['source IDs', inventory.sources.map(source => source.id)],
    ['item IDs', inventory.items.map(item => item.id)],
    ['media asset IDs', inventory.mediaAssets.map(asset => asset.id)],
    ['collection IDs', inventory.collections.map(collection => collection.id)]
  ] as const) if (!unique(values)) context.addIssue({ code: 'custom', message: `Duplicate ${label}` });
  const inScope = (record: { creatorAccountId: string; projectId: string }) =>
    record.creatorAccountId === inventory.creatorAccountId && record.projectId === inventory.projectId;
  for (const source of inventory.sources) if (!inScope(source)) context.addIssue({ code: 'custom', message: 'Source outside inventory scope' });
  for (const item of inventory.items) {
    if (!inScope(item)) context.addIssue({ code: 'custom', message: 'Item outside inventory scope' });
    if (!sourceIds.has(item.sourceRecord.sourceId)) context.addIssue({ code: 'custom', message: 'Item references unknown source' });
    for (const assetId of item.mediaAssetIds) if (!assetIds.has(assetId)) {
      context.addIssue({ code: 'custom', message: 'Item references unknown media asset' });
    }
  }
  const sourceById = new Map(inventory.sources.map(source => [source.id, source]));
  const recordKeys = inventory.items.map(item => `${item.sourceRecord.sourceId}:${externalKey(item.sourceRecord.externalId)}`);
  if (!unique(recordKeys)) context.addIssue({ code: 'custom', message: 'Duplicate source record IDs' });
  const identifierKeys = inventory.items.flatMap(item => item.externalIdentifiers.map(identifier =>
    `${item.sourceRecord.sourceId}:${externalKey(identifier)}`));
  if (!unique(identifierKeys)) context.addIssue({ code: 'custom', message: 'Duplicate source-scoped external identifiers' });
  for (const item of inventory.items) {
    const source = sourceById.get(item.sourceRecord.sourceId);
    if (source && item.sourceRecord.externalId.provider !== (source.type.startsWith('amazon_') ? 'amazon' : 'creator')) {
      context.addIssue({ code: 'custom', message: 'Source record identifier provider does not match source' });
    }
  }
  for (const asset of inventory.mediaAssets) {
    if (!inScope(asset)) context.addIssue({ code: 'custom', message: 'Media asset outside inventory scope' });
    const item = itemById.get(asset.catalogItemId);
    if (!item || !item.mediaAssetIds.includes(asset.id)) context.addIssue({ code: 'custom', message: 'Media asset must be linked by its item' });
  }
  for (const collection of inventory.collections) {
    if (!inScope(collection)) context.addIssue({ code: 'custom', message: 'Collection outside inventory scope' });
    for (const itemId of collection.itemIds) if (!itemIds.has(itemId)) {
      context.addIssue({ code: 'custom', message: 'Collection references unknown item' });
    }
  }
});
export type CatalogInventory = z.infer<typeof catalogInventorySchema>;
