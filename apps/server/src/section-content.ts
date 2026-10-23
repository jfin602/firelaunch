import { applyMutation } from '@firelaunch/channel-engine';
import type { ChannelSpec, ContentItem } from '@firelaunch/contracts';
import { RepositoryError } from './repository.js';

/** Bind one catalog projection to one authored section without changing other placements. */
export function changeSectionContent(spec: ChannelSpec, pageId: string, moduleId: string,
  contentId: string, selected: boolean, baseline?: ContentItem): ChannelSpec {
  const page = spec.pages.find(value => value.id === pageId);
  const module = page?.modules.find(value => value.id === moduleId);
  if (!module || (module.kind !== 'hero' && module.kind !== 'rail' && module.kind !== 'grid'))
    throw new RepositoryError('NOT_FOUND', 'Section not found');
  if (module.contentIds.includes(contentId) === selected) return spec;
  let next = spec;
  if (selected) {
    if (!baseline || baseline.id !== contentId)
      throw new RepositoryError('CONFLICT', 'Catalog content is not ready');
    if (!next.content.some(value => value.id === contentId))
      next = applyMutation(next, { type: 'addContent', content: baseline });
  }
  return applyMutation(next, { type: 'updateModule', pageId,
    module: { ...module, contentIds: selected ? [...module.contentIds, contentId] :
      module.contentIds.filter(value => value !== contentId) } });
}
