import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { starterChannel } from '@firelaunch/channel-engine';
import type { CatalogInventory } from '@firelaunch/contracts';
import { selectionAfterVideoRemoval } from '../src/catalog-inclusion-selection.js';

const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const first = id('ci', '1'), second = id('ci', '2'), collection = id('col', '3');
const contentId = (itemId: string) => `item_${createHash('sha256').update('catalog-content-v1\0').update(itemId).digest('hex').slice(0, 32)}`;
const base = starterChannel('Test', id('ch', 'a'), id('page', 'b'));
const content = (itemId: string) => ({ id: contentId(itemId), title: itemId, description: '',
  presentation: 'video' as const, artwork: 'assets/catalog-placeholder.png', mediaUrl: 'https://media.example/video.mp4' });
const baseline = { ...base, content: [content(first), content(second)] };
const current = { ...base, content: [content(second)] };
const inventory = { items: [{ id: first, kind: 'video' }, { id: second, kind: 'video' }],
  collections: [{ id: collection, itemIds: [first, second] }] } as CatalogInventory;

test('restored catalog checkboxes omit removed video and preserve remaining collection members', () => {
  assert.deepEqual(selectionAfterVideoRemoval({ itemIds: [first], collectionIds: [collection] }, baseline,
    current, inventory), { itemIds: [second], collectionIds: [] });
  assert.deepEqual(selectionAfterVideoRemoval({ itemIds: [first], collectionIds: [collection] }, baseline,
    baseline, inventory), { itemIds: [first], collectionIds: [collection] });
});
