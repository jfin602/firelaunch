import { createHash } from 'node:crypto';
import type { CatalogInventory, ChannelSpec } from '@vegalaunch/contracts';

type Selection = { itemIds: string[]; collectionIds: string[] };

/** Restore Generate checkboxes without undoing a later per-video Remove. */
export function selectionAfterVideoRemoval(selection: Selection, baseline: ChannelSpec,
  current: ChannelSpec, inventory: CatalogInventory): Selection {
  const prior = new Set(baseline.content.filter(item => item.presentation === 'video').map(item => item.id));
  const included = new Set(current.content.map(item => item.id));
  const removed = new Set(inventory.items.filter(item => item.kind === 'video' &&
    prior.has(`item_${createHash('sha256').update('catalog-content-v1\0').update(item.id).digest('hex').slice(0, 32)}`) &&
    !included.has(`item_${createHash('sha256').update('catalog-content-v1\0').update(item.id).digest('hex').slice(0, 32)}`))
    .map(item => item.id));
  if (!removed.size) return selection;
  const itemIds = new Set(selection.itemIds.filter(id => !removed.has(id)));
  const collectionIds = selection.collectionIds.filter(id => {
    const collection = inventory.collections.find(value => value.id === id);
    if (!collection || !collection.itemIds.some(itemId => removed.has(itemId))) return true;
    for (const itemId of collection.itemIds) if (!removed.has(itemId)) itemIds.add(itemId);
    return false;
  });
  return { itemIds: [...itemIds], collectionIds };
}
