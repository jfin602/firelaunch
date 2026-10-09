import { z } from 'zod';

export * from './creator.js';

export const SCHEMA_VERSION = 1 as const;
export const idSchema = z.string().regex(/^(ch|page|mod|item)_[a-f0-9]{32}$/, 'Invalid stable ID');
const channelIdSchema = idSchema.refine(value => value.startsWith('ch_'), 'Expected channel ID');
const pageIdSchema = idSchema.refine(value => value.startsWith('page_'), 'Expected page ID');
const moduleIdSchema = idSchema.refine(value => value.startsWith('mod_'), 'Expected module ID');
const itemIdSchema = idSchema.refine(value => value.startsWith('item_'), 'Expected content ID');
export const slugSchema = z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const titleSchema = z.string().trim().min(1).max(120);
const descriptionSchema = z.string().max(2000);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const httpUrlSchema = z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}, 'Expected an HTTP(S) URL without credentials');
const assetSchema = z.string().max(256).regex(/^assets\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/, 'Unsafe asset path');
export const artworkSchema = z.union([httpUrlSchema, assetSchema]);
const idList = z.array(itemIdSchema).max(100).refine(values => new Set(values).size === values.length, 'Duplicate IDs');
const pageIdList = z.array(pageIdSchema).max(30).refine(values => new Set(values).size === values.length, 'Duplicate IDs');

export const brandSchema = z.strictObject({
  primaryColor: colorSchema,
  backgroundColor: colorSchema,
  textColor: colorSchema,
  logo: artworkSchema.optional(),
  heroArtwork: artworkSchema.optional(),
  typography: z.enum(['sans', 'serif']).default('sans'),
  showTitle: z.boolean().default(true)
});
export const moduleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ id: moduleIdSchema, kind: z.literal('hero'), title: titleSchema.optional(), contentIds: z.array(itemIdSchema).max(1) }),
  z.strictObject({ id: moduleIdSchema, kind: z.literal('rail'), title: titleSchema, contentIds: idList }),
  z.strictObject({ id: moduleIdSchema, kind: z.literal('grid'), title: titleSchema, contentIds: idList }),
  z.strictObject({ id: moduleIdSchema, kind: z.literal('text'), title: titleSchema, body: descriptionSchema })
]);
export const pageSchema = z.strictObject({ id: pageIdSchema, title: titleSchema, modules: z.array(moduleSchema).max(30) });
export const contentSchema = z.strictObject({
  id: itemIdSchema, title: titleSchema, description: descriptionSchema,
  artwork: artworkSchema, mediaUrl: httpUrlSchema,
  durationSeconds: z.number().int().positive().max(86400).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  series: z.string().trim().min(1).max(80).optional()
});
export const playbackSchema = z.strictObject({ autoplayNext: z.boolean(), startMuted: z.boolean() });
export const channelSpecSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION), id: channelIdSchema, title: titleSchema, slug: slugSchema,
  brand: brandSchema, navigation: pageIdList.min(1), pages: z.array(pageSchema).min(1).max(30),
  content: z.array(contentSchema).max(500), playback: playbackSchema
}).superRefine((spec, context) => {
  const pageIds = spec.pages.map(page => page.id);
  const contentIds = spec.content.map(item => item.id);
  const moduleIds = spec.pages.flatMap(page => page.modules.map(module => module.id));
  for (const [label, ids] of [['pages', pageIds], ['content', contentIds], ['modules', moduleIds]] as const) {
    if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: `Duplicate ${label} IDs` });
  }
  for (const id of spec.navigation) {
    if (!pageIds.includes(id)) context.addIssue({ code: 'custom', message: `Unknown navigation page: ${id}` });
  }
  for (const page of spec.pages) for (const module of page.modules) {
    if (module.kind !== 'text') for (const id of module.contentIds) {
      if (!contentIds.includes(id)) context.addIssue({ code: 'custom', message: `Unknown content: ${id}` });
    }
  }
});
export type ChannelSpec = z.infer<typeof channelSpecSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Module = z.infer<typeof moduleSchema>;
export type ContentItem = z.infer<typeof contentSchema>;

export const projectSchema = z.strictObject({
  id: channelIdSchema, revision: z.number().int().positive(), createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(), spec: channelSpecSchema
}).refine(project => project.id === project.spec.id, 'Project ID must match ChannelSpec ID');
export type ChannelProject = z.infer<typeof projectSchema>;

export const createProjectSchema = z.strictObject({ title: titleSchema, slug: slugSchema.optional() });
export const updateProjectSchema = z.strictObject({ expectedRevision: z.number().int().positive(), spec: channelSpecSchema });
export const errorSchema = z.strictObject({ error: z.strictObject({ code: z.enum(['INVALID_INPUT', 'NOT_FOUND', 'CONFLICT', 'STORAGE_ERROR']), message: z.string() }) });
