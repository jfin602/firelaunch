import assert from 'node:assert/strict';
import test from 'node:test';
import { starterChannel } from '@vegalaunch/channel-engine';
import { assertEditableDraftMedia, assertExportableMedia, prepareDraftMedia, publicMediaUrl } from '../src/hosted-media-policy.js';
import { HostedWorkspaceService } from '../src/hosted-workspace.js';
import type { HostedProjectRepository } from '../src/hosted-repository.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';

test('hosted media references accept only stable public HTTPS or bundled artwork', () => {
  const spec = starterChannel('Creator channel');
  const content = { id: `item_${'a'.repeat(32)}`, title: 'Film', description: '',
    artwork: 'assets/catalog-placeholder.png', presentation: 'video' as const,
    mediaUrl: 'https://media.example/film.mp4' };
  assert.doesNotThrow(() => assertExportableMedia({ ...spec, content: [content] }));
  for (const mediaUrl of [
    'http://media.example/film.mp4', 'https://127.0.0.1/film.mp4', 'https://[::1]/film.mp4',
    'https://localhost./film.mp4', 'https://media.internal/film.mp4',
    'https://media.example/film.mp4?token=private', 'https://media.example/film.mp4#private',
    'https://bucket.s3.us-east-2.amazonaws.com/original.mp4',
    'https://media.example/media/staged/secret/master.m3u8',
    'https://studio.example/api/projects/channel/private-objects/object/content',
    'https://studio.example/api/%70rivate-objects/object/content',
    'https://studio.example/api/draft-audio/ch_a/ci_b/ma_c/audio'
  ]) {
    assert.equal(publicMediaUrl(mediaUrl), false, mediaUrl);
    assert.throws(() => assertExportableMedia({ ...spec, content: [{ ...content, mediaUrl }] }), { code: 'INVALID_INPUT' });
  }
  assert.throws(() => assertExportableMedia({ ...spec, brand: { ...spec.brand, logo: 'http://localhost/logo.png' } }), { code: 'INVALID_INPUT' });
  assert.throws(() => assertExportableMedia({ ...spec, content: [{ ...content, presentation: 'information',
    mediaUrl: undefined, audiobook: { mediaUrl: 'https://studio.example/api/draft-audio/ch_a/ci_b/ma_c/audio' } }] }), { code: 'INVALID_INPUT' });
  assert.equal(publicMediaUrl('https://media.example/film.mp4'), true);
});

test('only an unchanged legacy audiobook URL can remain in an edited draft', () => {
  const spec = starterChannel('Legacy book');
  const legacy = 'https://studio.example/api/draft-audio/ch_a/ci_b/ma_c/audio';
  const book = { id: `item_${'b'.repeat(32)}`, title: 'Book', description: '', artwork: 'assets/book.png',
    presentation: 'information' as const, audiobook: { mediaUrl: legacy } };
  const previous = { ...spec, content: [book] };
  assert.doesNotThrow(() => assertEditableDraftMedia({ ...previous, name: 'Edited' }, previous));
  assert.throws(() => assertEditableDraftMedia(previous, spec), { code: 'INVALID_INPUT' });
  assert.throws(() => assertEditableDraftMedia({ ...previous, content: [{ ...book,
    audiobook: { mediaUrl: `${legacy}?token=new` } }] }, previous), { code: 'INVALID_INPUT' });
  assert.throws(() => assertExportableMedia(previous), { code: 'INVALID_INPUT' });
  const audio = { ...book, presentation: 'audio' as const, mediaUrl: legacy,
    artwork: legacy.replace('/audio', '/cover'), audiobook: undefined };
  const priorAudio = { ...spec, content: [audio] };
  assert.doesNotThrow(() => assertEditableDraftMedia(priorAudio, priorAudio));
  assert.throws(() => assertEditableDraftMedia(priorAudio, spec), { code: 'INVALID_INPUT' });
  assert.throws(() => assertExportableMedia(priorAudio), { code: 'INVALID_INPUT' });
});

test('legacy unsafe hosted media cannot enter generated source or export', async () => {
  const spec = starterChannel('Legacy channel');
  const unsafe = { ...spec, brand: { ...spec.brand, heroArtwork: 'http://localhost/private-cover.png' } };
  let sourceReads = 0;
  const repository = { async read() { return { id: spec.id, revision: 1, spec: unsafe }; },
    async source() { sourceReads++; return { files: {}, baseline: {}, fingerprint: '', specRevision: 1 }; } } as unknown as HostedProjectRepository;
  const principal = {} as AuthenticatedPrincipal;
  const workspace = new HostedWorkspaceService(repository);
  await assert.rejects(workspace.generate(principal, spec.id), { code: 'INVALID_INPUT' });
  await assert.rejects(workspace.exportSource(principal, spec.id), { code: 'INVALID_INPUT' });
  assert.equal(sourceReads, 0, 'unsafe legacy spec is rejected before source is read or generated');
});

test('private draft packages retain content without exporting private media capabilities', () => {
  const spec = starterChannel('Private media');
  const video = { id: `item_${'1'.repeat(32)}`, title: 'Uploaded film', description: 'Creator film',
    artwork: 'https://studio.example/api/private-objects/cover', presentation: 'video' as const,
    mediaUrl: 'https://studio.example/api/preview?token=secret' };
  const hosted = { id: `item_${'2'.repeat(32)}`, title: 'Public film', description: '',
    artwork: 'https://media.example/film.jpg', presentation: 'video' as const,
    mediaUrl: 'https://media.example/film.m3u8' };
  const book = { id: `item_${'3'.repeat(32)}`, title: 'Audio book', description: '',
    artwork: 'assets/catalog-placeholder.png', presentation: 'information' as const,
    audiobook: { mediaUrl: 'https://studio.example/api/draft-audio/audio' } };
  const draft = { ...spec, brand: { ...spec.brand, logo: 'https://studio.example/api/private-objects/logo' },
    content: [video, hosted, book] };
  const bindings = [
    { contentId: video.id, baseline: null, blockedReason: 'playback_rights_or_delivery_missing' as const },
    { contentId: hosted.id, baseline: hosted },
    { contentId: book.id, baseline: { ...book, audiobook: undefined } }
  ] as Parameters<typeof prepareDraftMedia>[1];
  const result = prepareDraftMedia(draft, bindings);
  assert.equal(result.spec.content.length, 3);
  assert.equal(result.spec.content[0]?.presentation, 'information');
  assert.equal(result.spec.content[0]?.mediaUrl, undefined);
  assert.equal(result.spec.content[0]?.artwork, 'assets/catalog-placeholder.png');
  assert.equal(result.spec.content[1]?.mediaUrl, hosted.mediaUrl);
  assert.equal(result.spec.content[2]?.audiobook, undefined);
  assert.equal(result.spec.brand.logo, undefined);
  assert.ok(result.warnings.some(warning => warning.contentId === video.id && warning.field === 'playback'));
  assert.ok(result.warnings.some(warning => warning.contentId === book.id && warning.field === 'audiobook'));
  assert.equal(JSON.stringify(result).includes('token=secret'), false);
  assert.equal(JSON.stringify(result).includes('private-objects'), false);
  assert.throws(() => prepareDraftMedia(draft, bindings.slice(1)), { code: 'CONFLICT' });
  assert.throws(() => prepareDraftMedia(draft, [{ ...bindings[0]!, blockedReason: 'source_revoked' }, ...bindings.slice(1)]),
    { code: 'CONFLICT' });
});
