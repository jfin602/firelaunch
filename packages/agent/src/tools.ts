import { z } from 'zod';
import { applyMutation, newId, type ChannelMutation } from '@vegalaunch/channel-engine';
import { brandSchema, contentSchema, contentShapeSchema, idSchema, moduleSchema, type ChannelSpec } from '@vegalaunch/contracts';
import type { CatalogGrounding } from './index.js';

const title = z.string().trim().min(1).max(120);
const pageId = idSchema.refine(value => value.startsWith('page_'));
const moduleId = idSchema.refine(value => value.startsWith('mod_'));
const contentId = idSchema.refine(value => value.startsWith('item_'));
const ids = (schema: typeof pageId, max: number) => z.array(schema).max(max);

type Tool = { description: string; schema: z.ZodType; mutation: (spec: ChannelSpec, raw: never) => ChannelMutation };
function tool<S extends z.ZodType>(description: string, schema: S, mutation: (spec: ChannelSpec, input: z.infer<S>) => ChannelMutation): Tool {
  return { description, schema, mutation: mutation as Tool['mutation'] };
}

const moduleInput = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('hero'), title: title.optional(), contentIds: z.array(contentId).max(1) }),
  z.strictObject({ kind: z.literal('rail'), title, contentIds: z.array(contentId).max(100) }),
  z.strictObject({ kind: z.literal('grid'), title, contentIds: z.array(contentId).max(100) }),
  z.strictObject({ kind: z.literal('text'), title, body: z.string().max(2000) })
]);
const contentFields = z.strictObject(contentShapeSchema.shape).omit({ id: true });
const brandChanges = brandSchema.partial().refine(value => Object.keys(value).length > 0, 'No brand changes');
const contentChanges = contentFields.partial().refine(value => Object.keys(value).length > 0, 'No content changes');

export const toolDefinitions: Record<string, Tool> = {
  set_brand: tool('Change only the specified brand fields.', z.strictObject({ changes: brandChanges }), (spec, { changes }) => ({ type: 'setBrand', brand: brandSchema.parse({ ...spec.brand, ...changes }) })),
  add_page: tool('Add a navigation page. The server allocates its ID.', z.strictObject({ title }), (_spec, { title: name }) => ({ type: 'addPage', page: { id: newId('page'), title: name, modules: [] } })),
  update_page: tool('Rename a page by ID.', z.strictObject({ pageId, title }), (_spec, input) => ({ type: 'updatePage', ...input })),
  remove_page: tool('Remove a page by ID; the last page cannot be removed.', z.strictObject({ pageId }), (_spec, input) => ({ type: 'removePage', ...input })),
  reorder_pages: tool('Set the full navigation order using every existing page ID exactly once.', z.strictObject({ pageIds: ids(pageId, 30) }), (_spec, input) => ({ type: 'reorderNavigation', ...input })),
  add_module: tool('Add a TV module to an existing page. Content IDs must exist.', z.strictObject({ pageId, module: moduleInput }), (_spec, { pageId: page, module }) => ({ type: 'addModule', pageId: page, module: { ...module, id: newId('mod') } })),
  update_module: tool('Replace a module with a validated module of the same ID on its page.', z.strictObject({ pageId, module: moduleSchema }), (_spec, input) => ({ type: 'updateModule', ...input })),
  reorder_module_content: tool('Reorder existing content references within one hero, rail or grid, preserving exactly the same IDs.', z.strictObject({ pageId, moduleId, contentIds: z.array(contentId).max(100) }), (spec, { pageId: page, moduleId: id, contentIds }) => {
    const module = spec.pages.find(item => item.id === page)?.modules.find(item => item.id === id);
    if (!module || (module.kind !== 'hero' && module.kind !== 'rail' && module.kind !== 'grid')) throw new Error('Unknown content module');
    if (contentIds.length !== module.contentIds.length || new Set(contentIds).size !== contentIds.length || contentIds.some(item => !module.contentIds.includes(item))) throw new Error('Content order must contain exactly the same IDs');
    return { type: 'updateModule', pageId: page, module: { ...module, contentIds } };
  }),
  remove_module: tool('Remove a module from a page.', z.strictObject({ pageId, moduleId }), (_spec, input) => ({ type: 'removeModule', ...input })),
  reorder_modules: tool('Set the complete module order on one page using each existing module ID exactly once.', z.strictObject({ pageId, moduleIds: ids(moduleId, 30) }), (_spec, input) => ({ type: 'reorderModules', ...input })),
  add_content: tool('Add video, audio or informational content with safe artwork; playable content requires an HTTP(S) media URL.', z.strictObject({ content: contentFields }), (_spec, { content }) => ({ type: 'addContent', content: { ...content, id: newId('item') } })),
  update_content: tool('Change only specified fields on an existing content item.', z.strictObject({ contentId, changes: contentChanges }), (spec, { contentId: id, changes }) => {
    const current = spec.content.find(item => item.id === id);
    if (!current) throw new Error('Unknown content');
    return { type: 'updateContent', content: contentSchema.parse({ ...current, ...changes }) };
  }),
  remove_content: tool('Remove content and its references in all modules.', z.strictObject({ contentId }), (_spec, input) => ({ type: 'removeContent', ...input }))
};

export const toolSchemas = [
  { name: 'inspect_channel', description: 'Inspect a bounded page/module/content window and IDs; use offsets to see more.', inputSchema: z.toJSONSchema(z.strictObject({ pageOffset: z.number().int().min(0).max(29).optional(), moduleOffset: z.number().int().min(0).max(29).optional(), contentOffset: z.number().int().min(0).max(499).optional() })) },
  { name: 'inspect_catalog', description: 'Inspect up to ten selected, approved catalog items. Offset only; creator and project are server-owned.', inputSchema: z.toJSONSchema(z.strictObject({ offset: z.number().int().min(0).max(490).optional() })) },
  { name: 'add_catalog_content', description: 'Add an approved rights-safe selected catalog item to the channel using its stable content ID.', inputSchema: z.toJSONSchema(z.strictObject({ catalogItemId: z.string().regex(/^ci_[a-f0-9]{32}$/) })) },
  ...Object.entries(toolDefinitions).map(([name, definition]) => ({ name, description: definition.description, inputSchema: z.toJSONSchema(definition.schema) }))
];

export class AgentToolError extends Error {}

export function executeTool(spec: ChannelSpec, name: string, input: unknown, grounding?: CatalogGrounding): { spec: ChannelSpec; changed: boolean; output: string } {
  if (name === 'inspect_catalog') {
    const parsed = z.strictObject({ offset: z.number().int().min(0).max(490).optional() }).safeParse(input);
    if (!parsed.success || !grounding) throw new AgentToolError('Catalog inspection unavailable or invalid arguments');
    return { spec, changed: false, output: grounding.inspect(parsed.data.offset ?? 0) };
  }
  if (name === 'add_catalog_content') {
    const parsed = z.strictObject({ catalogItemId: z.string().regex(/^ci_[a-f0-9]{32}$/) }).safeParse(input);
    if (!parsed.success || !grounding) throw new AgentToolError('Catalog content unavailable or invalid arguments');
    try {
      const next = grounding.add(spec, parsed.data.catalogItemId);
      return { spec: next, changed: true, output: JSON.stringify({ applied: name, contentId: next.content.at(-1)?.id }) };
    } catch (error) { throw new AgentToolError(error instanceof Error ? error.message.slice(0, 300) : 'Invalid catalog content'); }
  }
  if (name === 'inspect_channel') {
    const parsed = z.strictObject({ pageOffset: z.number().int().min(0).max(29).optional(), moduleOffset: z.number().int().min(0).max(29).optional(), contentOffset: z.number().int().min(0).max(499).optional() }).safeParse(input);
    if (!parsed.success) throw new AgentToolError('Invalid inspect_channel arguments');
    const pageOffset = parsed.data.pageOffset ?? 0;
    const moduleOffset = parsed.data.moduleOffset ?? 0;
    const contentOffset = parsed.data.contentOffset ?? 0;
    return { spec, changed: false, output: JSON.stringify({ title: spec.title, brand: spec.brand, pageOffset, moduleOffset, totalPages: spec.pages.length, pages: spec.pages.slice(pageOffset, pageOffset + 5).map(page => ({ id: page.id, title: page.title, moduleCount: page.modules.length, modules: page.modules.slice(moduleOffset, moduleOffset + 5).map(module => ({ id: module.id, kind: module.kind, title: module.title, body: 'body' in module ? module.body.slice(0, 120) : undefined, imageContentId: 'imageContentId' in module ? module.imageContentId : undefined, contentIds: module.kind === 'hero' || module.kind === 'rail' || module.kind === 'grid' ? module.contentIds.slice(0, 5) : undefined })) })), navigation: spec.navigation, contentOffset, totalContent: spec.content.length, content: spec.content.slice(contentOffset, contentOffset + 10).map(item => ({ id: item.id, title: item.title, description: item.description.slice(0, 120) })) }) };
  }
  const definition = toolDefinitions[name];
  if (!definition) throw new AgentToolError(`Unsupported tool: ${name.slice(0, 80)}`);
  const parsed = definition.schema.safeParse(input);
  if (!parsed.success) throw new AgentToolError(`Invalid ${name} arguments: ${parsed.error.issues.map(issue => issue.message).join('; ').slice(0, 300)}`);
  try {
    const mutation = definition.mutation(spec, parsed.data as never);
    const next = applyMutation(spec, mutation);
    return { spec: next, changed: true, output: JSON.stringify({ applied: name, mutation }) };
  } catch (error) {
    throw new AgentToolError(error instanceof Error ? error.message.slice(0, 300) : 'Invalid mutation');
  }
}
