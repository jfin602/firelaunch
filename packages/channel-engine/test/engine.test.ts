import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMutation, migrateChannel, navigationPages, resolveContent, starterChannel } from '../src/index.js';
import { fixtureChannel } from './fixtures.js';

test('starter has a navigable home and stable supplied IDs', () => {
  const spec = starterChannel('Wild Earth', fixtureChannel().id, fixtureChannel().pages[0]!.id);
  assert.equal(spec.slug, 'wild-earth');
  assert.equal(navigationPages(spec)[0]?.title, 'Home');
});

test('pure mutations validate references, remove content references and preserve input', () => {
  const spec = fixtureChannel();
  const next = applyMutation(spec, { type: 'removeContent', contentId: spec.content[0]!.id });
  assert.equal(next.pages[0]?.modules[0]?.kind === 'hero' && next.pages[0].modules[0].contentIds.length, 0);
  assert.equal(spec.content.length, 1);
  assert.equal(resolveContent(spec, spec.pages[0]!.id, spec.pages[0]!.modules[0]!.id)[0]?.title, 'Oceans');
  assert.throws(() => applyMutation(spec, { type: 'addModule', pageId: spec.pages[0]!.id, module: { id: 'mod_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', kind: 'rail', title: 'Broken', contentIds: ['item_ffffffffffffffffffffffffffffffff'] } }));
  assert.throws(() => applyMutation(spec, { type: 'removePage', pageId: spec.pages[0]!.id }));
  assert.throws(() => applyMutation(spec, { type: 'reorderNavigation', pageIds: [] }));
});

test('migration seam accepts current version, rejects missing and future versions', () => {
  const spec = fixtureChannel();
  assert.deepEqual(migrateChannel(spec), spec);
  assert.throws(() => migrateChannel({ ...spec, schemaVersion: 2 }), /Unsupported/);
  assert.throws(() => migrateChannel({ ...spec, schemaVersion: undefined }));
});

test('page, module and navigation edits use stable IDs and complete permutations', () => {
  const start = fixtureChannel();
  const page = { id: 'page_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'Films', modules: [] };
  const added = applyMutation(start, { type: 'addPage', page });
  const reordered = applyMutation(added, { type: 'reorderNavigation', pageIds: [page.id, start.pages[0]!.id] });
  assert.deepEqual(navigationPages(reordered).map(item => item.title), ['Films', 'Home']);
  assert.throws(() => applyMutation(added, { type: 'addPage', page }));
  assert.throws(() => applyMutation(added, { type: 'reorderNavigation', pageIds: [page.id, page.id] }));
  const withModule = applyMutation(reordered, { type: 'addModule', pageId: page.id, module: { id: 'mod_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', kind: 'text', title: 'About', body: 'Our films' } });
  assert.equal(withModule.pages[1]?.modules[0]?.kind, 'text');
  assert.equal(resolveContent(withModule, page.id, 'mod_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb').length, 0);
  assert.equal(applyMutation(withModule, { type: 'removePage', pageId: page.id }).pages.length, 1);
});
