import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  brandSchema, channelSpecSchema, contentSchema, idSchema, moduleSchema, pageSchema,
  SCHEMA_VERSION, slugSchema,
  type ChannelSpec, type Page, type ContentItem
} from '@firelaunch/contracts';

export function newId(kind: 'ch' | 'page' | 'mod' | 'item'): string {
  return `${kind}_${randomUUID().replaceAll('-', '')}`;
}

export function slugify(title: string): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64).replace(/-$/, '');
  return slugSchema.parse(slug);
}

export function starterChannel(title: string, id = newId('ch'), pageId = newId('page')): ChannelSpec {
  return channelSpecSchema.parse({
    schemaVersion: SCHEMA_VERSION, id, title, slug: slugify(title),
    brand: { primaryColor: '#49BDA5', backgroundColor: '#101820', textColor: '#FFFFFF' },
    navigation: [pageId], pages: [{ id: pageId, title: 'Home', modules: [] }],
    content: [], playback: { autoplayNext: false, startMuted: false }
  });
}

export function migrateChannel(raw: unknown): ChannelSpec {
  if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw)) throw new Error('ChannelSpec schemaVersion is required');
  const envelope = z.object({ schemaVersion: z.number().int() }).parse(raw);
  if (envelope.schemaVersion !== SCHEMA_VERSION) throw new Error(`Unsupported ChannelSpec version: ${envelope.schemaVersion}`);
  return channelSpecSchema.parse(raw);
}

export const mutationSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('setBrand'), brand: brandSchema }),
  z.strictObject({ type: z.literal('setPlayback'), playback: z.strictObject({ autoplayNext: z.boolean(), startMuted: z.boolean() }) }),
  z.strictObject({ type: z.literal('setIdentity'), title: z.string().trim().min(1).max(120), slug: slugSchema }),
  z.strictObject({ type: z.literal('addPage'), page: pageSchema }),
  z.strictObject({ type: z.literal('updatePage'), pageId: idSchema, title: z.string().trim().min(1).max(120) }),
  z.strictObject({ type: z.literal('removePage'), pageId: idSchema }),
  z.strictObject({ type: z.literal('reorderNavigation'), pageIds: z.array(idSchema).max(30) }),
  z.strictObject({ type: z.literal('addModule'), pageId: idSchema, module: moduleSchema }),
  z.strictObject({ type: z.literal('updateModule'), pageId: idSchema, module: moduleSchema }),
  z.strictObject({ type: z.literal('removeModule'), pageId: idSchema, moduleId: idSchema }),
  z.strictObject({ type: z.literal('reorderModules'), pageId: idSchema, moduleIds: z.array(idSchema).max(30) }),
  z.strictObject({ type: z.literal('addContent'), content: contentSchema }),
  z.strictObject({ type: z.literal('updateContent'), content: contentSchema }),
  z.strictObject({ type: z.literal('removeContent'), contentId: idSchema })
]);
export type ChannelMutation = z.infer<typeof mutationSchema>;

function sameMembers(current: string[], next: string[]): boolean {
  return current.length === next.length && new Set(next).size === next.length && next.every(id => current.includes(id));
}

function requirePage(spec: ChannelSpec, id: string): Page {
  const page = spec.pages.find(candidate => candidate.id === id);
  if (!page) throw new Error(`Unknown page: ${id}`);
  return page;
}

export function applyMutation(input: ChannelSpec, rawMutation: unknown): ChannelSpec {
  const spec = channelSpecSchema.parse(input);
  const mutation = mutationSchema.parse(rawMutation);
  let next: ChannelSpec;
  switch (mutation.type) {
    case 'setBrand': next = { ...spec, brand: mutation.brand }; break;
    case 'setPlayback': next = { ...spec, playback: mutation.playback }; break;
    case 'setIdentity': next = { ...spec, title: mutation.title, slug: mutation.slug }; break;
    case 'addPage':
      next = { ...spec, pages: [...spec.pages, mutation.page], navigation: [...spec.navigation, mutation.page.id] }; break;
    case 'updatePage':
      requirePage(spec, mutation.pageId);
      next = { ...spec, pages: spec.pages.map(page => page.id === mutation.pageId ? { ...page, title: mutation.title } : page) }; break;
    case 'removePage':
      requirePage(spec, mutation.pageId);
      if (spec.pages.length === 1) throw new Error('Cannot remove the last page');
      next = { ...spec, pages: spec.pages.filter(page => page.id !== mutation.pageId), navigation: spec.navigation.filter(id => id !== mutation.pageId) }; break;
    case 'reorderNavigation':
      if (!sameMembers(spec.navigation, mutation.pageIds)) throw new Error('Navigation must contain the same page IDs');
      next = { ...spec, navigation: mutation.pageIds }; break;
    case 'addModule':
    case 'updateModule':
    case 'removeModule':
    case 'reorderModules': {
      const page = requirePage(spec, mutation.pageId);
      let modules = page.modules;
      if (mutation.type === 'addModule') modules = [...modules, mutation.module];
      if (mutation.type === 'updateModule') {
        if (!modules.some(item => item.id === mutation.module.id)) throw new Error('Unknown module');
        modules = modules.map(item => item.id === mutation.module.id ? mutation.module : item);
      }
      if (mutation.type === 'removeModule') {
        if (!modules.some(item => item.id === mutation.moduleId)) throw new Error('Unknown module');
        modules = modules.filter(item => item.id !== mutation.moduleId);
      }
      if (mutation.type === 'reorderModules') {
        if (!sameMembers(modules.map(item => item.id), mutation.moduleIds)) throw new Error('Module order must contain the same IDs');
        modules = mutation.moduleIds.map(id => modules.find(item => item.id === id)!);
      }
      next = { ...spec, pages: spec.pages.map(item => item.id === page.id ? { ...page, modules } : item) }; break;
    }
    case 'addContent': next = { ...spec, content: [...spec.content, mutation.content] }; break;
    case 'updateContent':
      if (!spec.content.some(item => item.id === mutation.content.id)) throw new Error('Unknown content');
      next = { ...spec, content: spec.content.map(item => item.id === mutation.content.id ? mutation.content : item) }; break;
    case 'removeContent':
      if (!spec.content.some(item => item.id === mutation.contentId)) throw new Error('Unknown content');
      next = { ...spec, content: spec.content.filter(item => item.id !== mutation.contentId), pages: spec.pages.map(page => ({
        ...page, modules: page.modules.map(module => module.kind === 'text' ? module : {
          ...module, contentIds: module.contentIds.filter(id => id !== mutation.contentId)
        })
      })) }; break;
  }
  return channelSpecSchema.parse(next);
}

export function navigationPages(spec: ChannelSpec): Page[] {
  const valid = channelSpecSchema.parse(spec);
  return valid.navigation.map(id => requirePage(valid, id));
}

export function resolveContent(spec: ChannelSpec, pageId: string, moduleId: string): ContentItem[] {
  const valid = channelSpecSchema.parse(spec);
  const module = requirePage(valid, pageId).modules.find(item => item.id === moduleId);
  if (!module) throw new Error(`Unknown module: ${moduleId}`);
  return module.kind === 'text' ? [] : module.contentIds.map(id => valid.content.find(item => item.id === id)!);
}
