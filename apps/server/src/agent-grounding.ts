import { applyMutation } from '@firelaunch/channel-engine';
import { AgentToolError, type CatalogGrounding } from '@firelaunch/agent';
import type { ChannelSpec } from '@firelaunch/contracts';
import type { CatalogProjection } from './catalog-projection.js';

// The projection has already checked the authenticated owner, explicit selection,
// import approval and separate TV display/playback rights. Never pass its source
// records, private object locations or evidence to a model.
export function agentCatalogGrounding(projection: CatalogProjection): CatalogGrounding {
  const bindings = projection.bindings;
  return {
    inspect(offset) {
      return JSON.stringify({ offset, total: bindings.length, items: bindings.slice(offset, offset + 10).map(binding => ({
        catalogItemId: binding.catalogItemId, contentId: binding.contentId,
        title: binding.baseline?.title.slice(0, 120), description: binding.baseline?.description.slice(0, 240),
        presentation: binding.baseline?.presentation, playable: !!binding.baseline?.mediaUrl,
        eligible: !!binding.baseline, blockedReason: binding.blockedReason
      })) });
    },
    add(spec, catalogItemId) {
      const binding = bindings.find(item => item.catalogItemId === catalogItemId);
      if (!binding?.baseline) throw new AgentToolError('Catalog item is not selected and eligible');
      if (spec.content.some(item => item.id === binding.contentId)) throw new AgentToolError('Catalog content already exists');
      return applyMutation(spec, { type: 'addContent', content: binding.baseline });
    },
    authorize(before: ChannelSpec, after: ChannelSpec) {
      for (const field of ['logo', 'heroArtwork'] as const) {
        if (after.brand[field] !== before.brand[field] && after.brand[field]?.match(/^https?:/i)) throw new AgentToolError('New brand media requires creator review');
      }
      for (const item of after.content) {
        const previous = before.content.find(value => value.id === item.id);
        const baseline = bindings.find(value => value.contentId === item.id)?.baseline;
        if (!previous) {
          if (!baseline || JSON.stringify(item) !== JSON.stringify(baseline)) throw new AgentToolError('New content must be selected, approved catalog content');
        } else if (item.artwork !== previous.artwork || item.mediaUrl !== previous.mediaUrl || item.presentation !== previous.presentation) {
          throw new AgentToolError('Media changes require creator review');
        }
      }
    }
  };
}
