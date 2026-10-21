import assert from 'node:assert/strict';
import test from 'node:test';
import { channelSpecSchema, contentPresentation, contentSchema, createPageFromTemplate, isPlayableContent, projectSchema, SCHEMA_VERSION } from '../src/index.js';

test('page templates validate, keep stable unique IDs, and contain no assumed content rights', () => {
  const id = `page_${'a'.repeat(32)}`;
  for (const [choice, kinds] of [['hero', ['hero', 'rail']], ['grid', ['grid']], ['rows', ['rail', 'rail']]] as const) {
    const page = createPageFromTemplate(id, 'Films', choice);
    assert.deepEqual(page.modules.map(module => module.kind), kinds);
    assert.deepEqual(createPageFromTemplate(id, 'Films', choice), page);
    assert.equal(new Set(page.modules.map(module => module.id)).size, page.modules.length);
    assert.ok(page.modules.every(module => module.kind !== 'text' && module.contentIds.length === 0));
  }
  assert.throws(() => createPageFromTemplate('bad', 'Films', 'rows'));
  assert.throws(() => createPageFromTemplate(id, '', 'rows'));
});
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';

test('strict versioned ChannelSpec accepts starter fixture', () => {
  const spec = fixtureChannel();
  assert.equal(channelSpecSchema.parse(spec).schemaVersion, SCHEMA_VERSION);
  assert.equal(projectSchema.parse({ id: spec.id, revision: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', spec }).spec.id, spec.id);
});

test('legacy video migrates unchanged and explicit audio/information validate by media role', () => {
  const legacy = fixtureChannel();
  assert.deepEqual(channelSpecSchema.parse(legacy), legacy);
  assert.equal(contentPresentation(legacy.content[0]!), 'video');
  assert.equal(isPlayableContent(legacy.content[0]!), true);
  const video = { ...legacy.content[0], presentation: 'video' };
  const audio = { ...legacy.content[0], presentation: 'audio' };
  const book = { id: legacy.content[0]!.id, title: 'Field Guide', description: 'A book', artwork: 'assets/ocean.jpg', presentation: 'information' };
  for (const item of [video, audio, book]) assert.equal(contentSchema.safeParse(item).success, true);
  assert.equal(isPlayableContent(contentSchema.parse(book)), false);
  assert.equal(contentSchema.safeParse({ ...book, mediaUrl: 'https://example.org/fake.mp4' }).success, false);
  assert.equal(contentSchema.safeParse({ ...book, durationSeconds: 10 }).success, false);
  assert.equal(contentSchema.safeParse({ ...audio, mediaUrl: undefined }).success, false);
  assert.equal(contentSchema.safeParse({ ...video, mediaUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(contentSchema.safeParse({ ...legacy.content[0], mediaUrl: undefined }).success, false);
  assert.equal(contentSchema.safeParse({ ...book, presentation: 'unknown' }).success, false);
});

test('rejects extra fields, unknown references, duplicates and unsafe URLs', () => {
  const spec = fixtureChannel();
  assert.equal(channelSpecSchema.safeParse({ ...spec, script: 'evil' }).success, false);
  assert.equal(channelSpecSchema.safeParse({ ...spec, navigation: ['page_ffffffffffffffffffffffffffffffff'] }).success, false);
  assert.equal(channelSpecSchema.safeParse({ ...spec, pages: [spec.pages[0], spec.pages[0]] }).success, false);
  assert.equal(channelSpecSchema.safeParse({ ...spec, content: [{ ...spec.content[0], mediaUrl: 'file:///etc/passwd' }] }).success, false);
  assert.equal(channelSpecSchema.safeParse({ ...spec, brand: { ...spec.brand, logo: 'assets/../secret.png' } }).success, false);
});
