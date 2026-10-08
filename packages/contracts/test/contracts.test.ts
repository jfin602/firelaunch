import assert from 'node:assert/strict';
import test from 'node:test';
import { channelSpecSchema, projectSchema, SCHEMA_VERSION } from '../src/index.js';
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';

test('strict versioned ChannelSpec accepts starter fixture', () => {
  const spec = fixtureChannel();
  assert.equal(channelSpecSchema.parse(spec).schemaVersion, SCHEMA_VERSION);
  assert.equal(projectSchema.parse({ id: spec.id, revision: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', spec }).spec.id, spec.id);
});

test('rejects extra fields, unknown references, duplicates and unsafe URLs', () => {
  const spec = fixtureChannel();
  assert.equal(channelSpecSchema.safeParse({ ...spec, script: 'evil' }).success, false);
  assert.equal(channelSpecSchema.safeParse({ ...spec, navigation: ['page_ffffffffffffffffffffffffffffffff'] }).success, false);
  assert.equal(channelSpecSchema.safeParse({ ...spec, pages: [spec.pages[0], spec.pages[0]] }).success, false);
  assert.equal(channelSpecSchema.safeParse({ ...spec, content: [{ ...spec.content[0], mediaUrl: 'file:///etc/passwd' }] }).success, false);
  assert.equal(channelSpecSchema.safeParse({ ...spec, brand: { ...spec.brand, logo: 'assets/../secret.png' } }).success, false);
});
