import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChannelSpec } from '@vegalaunch/contracts';
import { selectedDraftChannel } from '../src/hosted-workspace.js';
import { assertExportableMedia } from '../src/hosted-media-policy.js';

test('draft snapshot excludes content removed from every section while preserving selected content', () => {
  const spec = {
    brand: { logo: 'assets/logo.png', heroArtwork: 'assets/hero.png' },
    content: [
      { id: 'video', artwork: 'assets/catalog-placeholder.png', mediaUrl: 'https://video.example.org/master.m3u8' },
      { id: 'audio', artwork: 'https://studio.example.org/api/draft-audio/cover',
        mediaUrl: 'https://studio.example.org/api/draft-audio/audio' }
    ],
    pages: [{ modules: [{ kind: 'rail', contentIds: ['video'] }] }]
  } as unknown as ChannelSpec;
  assert.throws(() => assertExportableMedia(spec), { code: 'INVALID_INPUT' });
  const selected = selectedDraftChannel(spec);
  assert.deepEqual(selected.content.map(item => item.id), ['video']);
  assert.doesNotThrow(() => assertExportableMedia(selected));
  assert.equal(spec.content.length, 2, 'saved draft is unchanged');
  assert.throws(() => selectedDraftChannel({ ...spec,
    pages: [{ modules: [{ kind: 'rail', contentIds: ['missing'] }] }] } as ChannelSpec), { code: 'CONFLICT' });
});
