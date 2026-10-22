import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMutation, migrateChannel, navigationPages, resolveContent, starterChannel } from '../src/index.js';
import { fixtureChannel } from './fixtures.js';
import { createPageFromTemplate } from '@firelaunch/contracts';

test('new channels start with the featured TV layout and creator-editable colors', () => {
  const spec = starterChannel('Wild Earth', fixtureChannel().id, fixtureChannel().pages[0]!.id);
  assert.equal(spec.slug, 'wild-earth');
  assert.equal(navigationPages(spec)[0]?.title, 'Featured');
  assert.deepEqual(spec.pages[0]?.modules.map(module => module.kind), ['hero', 'rail']);
  assert.equal(spec.pages[0]?.modules[1]?.title, 'Featured titles');
  assert.equal(spec.brand.primaryColor, '#FF6A00');
  assert.equal(spec.brand.backgroundColor, '#000000');
  assert.equal(spec.brand.textColor, '#FFFFFF');
  assert.deepEqual(spec.content, []);
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
  assert.deepEqual(migrateChannel({ ...spec, pages: [{ ...spec.pages[0], modules: [] }] }).pages[0]?.modules, []);
  assert.throws(() => migrateChannel({ ...spec, schemaVersion: 2 }), /Unsupported/);
  assert.throws(() => migrateChannel({ ...spec, schemaVersion: undefined }));
});

test('migration and validated mutations retain informational content without fabricated playback', () => {
  const spec = fixtureChannel();
  const book = { id: 'item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'Field Guide', description: 'A book', artwork: 'assets/ocean.jpg', presentation: 'information' };
  const next = applyMutation(spec, { type: 'addContent', content: book });
  assert.deepEqual(migrateChannel(next).content[1], book);
  assert.throws(() => applyMutation(next, { type: 'updateContent', content: { ...book, mediaUrl: 'https://example.org/fake.mp4' } }));
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

test('one addPage mutation persists and reopens its ordered starter modules', () => {
  const start = starterChannel('Films', 'ch_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'page_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  const page = createPageFromTemplate('page_cccccccccccccccccccccccccccccccc', 'Explore', 'rows');
  const saved = applyMutation(start, { type: 'addPage', page });
  const reopened = migrateChannel(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(reopened.pages[1], page);
  assert.deepEqual(reopened.navigation, [start.pages[0]!.id, page.id]);
  assert.deepEqual(reopened.pages[0], start.pages[0]);
});

test('removing content clears static image references without deleting text or changing focus content', () => {
  const start = fixtureChannel();
  const pageId = start.pages[0]!.id, contentId = start.content[0]!.id;
  const banner = { id: `mod_${'a'.repeat(32)}`, kind: 'image-banner' as const, title: 'Story', body: 'A story', imageContentId: contentId };
  const withImage = applyMutation(start, { type: 'addModule', pageId, module: banner });
  assert.deepEqual(resolveContent(withImage, pageId, banner.id), []);
  const removed = applyMutation(withImage, { type: 'removeContent', contentId });
  assert.equal(removed.pages[0]!.modules.at(-1)!.kind, 'image-banner');
  const cleaned = removed.pages[0]!.modules.at(-1)!;
  assert.equal(cleaned.kind === 'image-banner' ? cleaned.imageContentId : 'wrong kind', undefined);
  assert.deepEqual(migrateChannel(JSON.parse(JSON.stringify(removed))), removed);
});
