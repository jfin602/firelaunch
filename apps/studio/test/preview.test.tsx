import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { televisionFromSpec, heroSpotlight, initialState, itemFocusId, navFocusId } from '@firelaunch/tv';
import { Preview, PreviewArtwork, adequateHeroArtwork, catalogContentId, ownerBookPreviewContent } from '../src/Preview.js';
import type { CatalogSnapshot } from '../src/api.js';
import { keyboardCommand, navigate, reconcile } from '../src/preview-state.js';
import { studioVideoSource } from '../src/VideoPlayer.js';
import { createHash } from 'node:crypto';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'pause', { value: () => {} });
Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'load', { value: () => {} });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');

test('paired Hero uses one focusable row and updates copy without starting playback', () => {
  const spec = fixtureChannel(), first = spec.content[0]!, page = spec.pages[0]!;
  const audio = { ...first, id: `item_${'a'.repeat(32)}`, title: 'Soundscape', description: 'A recording',
    artwork: 'assets/album.jpg', presentation: 'audio' as const, author: 'The Artist', category: 'Music' };
  const book = { id: `item_${'b'.repeat(32)}`, title: 'Field Guide', description: 'A book to explore',
    artwork: 'assets/book.jpg', presentation: 'information' as const, author: 'A. Writer',
    publicationDate: '2025-04-02', series: 'Nature Library' };
  const rail = { id: `mod_${'c'.repeat(32)}`, kind: 'rail' as const, title: 'Browse', contentIds: [first.id, audio.id, book.id] };
  const later = { id: `mod_${'d'.repeat(32)}`, kind: 'rail' as const, title: 'More', contentIds: [book.id] };
  spec.content = [first, audio, book]; spec.pages[0] = { ...page, modules: [page.modules[0]!, rail, later] };
  try {
    const view = render(createElement(Preview, { spec }));
    const feature = view.container.querySelector('.tv-feature')!;
    assert.equal(view.container.querySelectorAll('.tv-feature').length, 1);
    assert.equal(view.container.querySelectorAll('.tv-hero').length, 0, 'old giant Hero card is absent');
    assert.equal(feature.querySelectorAll('.tv-card').length, 3);
    assert.equal(view.container.querySelectorAll('.tv-module.tv-rail').length, 1, 'later authored row remains');
    assert.match(feature.querySelector('.tv-feature-copy')?.textContent ?? '', /Oceans.*Watch/s);
    const content = view.container.querySelector<HTMLElement>('.tv-content')!;
    fireEvent.click(screen.getByRole('button', { name: 'Down' }));
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    assert.match(feature.querySelector('.tv-feature-copy')?.textContent ?? '', /Soundscape.*A recording.*The Artist.*Music.*Listen/s);
    assert.ok(feature.querySelector('.tv-audio-card.focused'));
    assert.equal(content.scrollTop, 0, 'focus on the first selector stays in the initial viewport');
    assert.equal(view.container.querySelector('video, audio'), null);
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    assert.match(feature.querySelector('.tv-feature-copy')?.textContent ?? '', /Field Guide.*A book to explore.*A. Writer.*2025.*Nature Library.*Explore/s);
    assert.doesNotMatch(feature.querySelector('.tv-feature-copy')?.textContent ?? '', /Play/);
    assert.ok(feature.querySelector('.tv-book-card.focused'));
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    assert.equal(view.container.querySelector('.tv-detail-copy h2')?.textContent, 'Field Guide');
    assert.equal(view.container.querySelector('video, audio'), null);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    assert.ok(view.container.querySelector('.tv-book-card.focused'));
    assert.equal(view.container.querySelector('.tv-feature-copy h2')?.textContent, 'Field Guide');
  } finally { cleanup(); }
});

test('Hero art contains each shape and falls back for small or failed images', () => {
  for (const [width, height, expected] of [[320, 180, true], [200, 200, true], [180, 270, true],
    [100, 100, false], [0, 0, false]] as const) assert.equal(adequateHeroArtwork(width, height), expected);
  const spec = fixtureChannel(), page = spec.pages[0]!;
  spec.pages[0] = { ...page, modules: [page.modules[0]!,
    { id: `mod_${'c'.repeat(32)}`, kind: 'rail', title: 'Browse', contentIds: [spec.content[0]!.id] }] };
  try {
    const view = render(createElement(Preview, { spec }));
    const art = view.container.querySelector('.tv-feature-art')!;
    const image = art.querySelector('img')!;
    Object.defineProperties(image, { naturalWidth: { value: 100 }, naturalHeight: { value: 100 } });
    fireEvent.load(image);
    assert.ok(art.querySelector('[aria-label="Artwork unavailable"]'));
    assert.equal(art.querySelector('img'), null);
  } finally { cleanup(); }
  try {
    const view = render(createElement(Preview, { spec }));
    const art = view.container.querySelector<HTMLElement>('.tv-feature-art')!;
    const image = art.querySelector('img')!;
    Object.defineProperties(image, { naturalWidth: { value: 800 }, naturalHeight: { value: 1200 } });
    fireEvent.load(image);
    assert.ok(art.classList.contains('has-art'));
    assert.match(art.style.backgroundImage, /ocean\.jpg/);
    fireEvent.error(image);
    assert.ok(art.querySelector('[aria-label="Artwork unavailable"]'));
    assert.equal(art.style.backgroundImage, '');
  } finally { cleanup(); }
});

test('Hero and first selector fit HD and FHD stages without vertical reveal scrolling', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.tv-feature\{height:87cqh;max-height:calc\(100% - 1px\)/);
  assert.match(css, /\.tv-feature-display\{[^}]*height:45cqh/);
  assert.match(css, /\.tv-feature-selector \.tv-items\{[^}]*overflow-x:auto;overflow-y:hidden/);
  assert.match(css, /\.tv-feature-art img\{[^}]*object-fit:contain/);
  for (const height of [720, 1080]) {
    assert.ok((.13 + .87) * height <= height);
    assert.ok(.45 * height + (.87 - .45) * height <= .87 * height);
  }
});

test('paired selector rejects revoked artwork while Rows and Grid keep their existing rendering', () => {
  const spec = fixtureChannel(), content = spec.content[0]!;
  const itemId = `ci_${'b'.repeat(32)}`, owner = `cr_${'a'.repeat(32)}`;
  const inventory = { projectId: spec.id, creatorAccountId: owner,
    items: [{ id: itemId, projectId: spec.id, creatorAccountId: owner,
      mediaAssetIds: [`ma_${'c'.repeat(32)}`] }],
    mediaAssets: [{ id: `ma_${'c'.repeat(32)}`, projectId: spec.id, creatorAccountId: owner,
      catalogItemId: itemId, kind: 'artwork', tvDisplayRights: { status: 'revoked' } }] } as unknown as CatalogSnapshot;
  try {
    const view = render(createElement(PreviewArtwork, { contentId: catalogContentId(itemId), source: content.artwork,
      inventory, projectId: spec.id, accountId: owner, requireCleared: true }));
    assert.equal(view.container.querySelector('img'), null);
    assert.ok(view.container.querySelector('[aria-label="Artwork unavailable"]'));
  } finally { cleanup(); }
  spec.pages[0] = { ...spec.pages[0]!, modules: [{ id: `mod_${'c'.repeat(32)}`, kind: 'grid', title: 'Films', contentIds: [content.id] }] };
  try {
    const view = render(createElement(Preview, { spec }));
    assert.equal(view.container.querySelector('.tv-feature'), null);
    assert.equal(view.container.querySelectorAll('.tv-grid .tv-card').length, 1);
  } finally { cleanup(); }
  spec.pages[0] = { ...spec.pages[0]!, modules: [
    { id: `mod_${'d'.repeat(32)}`, kind: 'rail', title: 'First', contentIds: [content.id] },
    { id: `mod_${'e'.repeat(32)}`, kind: 'rail', title: 'Second', contentIds: [content.id] }
  ] };
  try {
    const view = render(createElement(Preview, { spec }));
    assert.equal(view.container.querySelector('.tv-feature'), null);
    assert.equal(view.container.querySelectorAll('.tv-module.tv-rail').length, 2);
  } finally { cleanup(); }
});

test('book audiobook uses Listen to Audiobook in the hero without starting audio', () => {
  const spec = fixtureChannel(), book = { id: `item_${'b'.repeat(32)}`, title: 'Field Guide',
    description: 'A book', artwork: 'assets/book.jpg', presentation: 'information' as const,
    audiobook: { mediaUrl: 'https://example.org/book.mp3' } };
  spec.content.push(book);
  spec.pages[0]!.modules.push({ id: `mod_${'c'.repeat(32)}`, kind: 'rail', title: 'Browse', contentIds: [book.id] });
  try {
    const view = render(createElement(Preview, { spec }));
    fireEvent.click(screen.getByRole('button', { name: 'Down' }));
    assert.match(view.container.querySelector('.tv-feature-copy')?.textContent ?? '', /Field Guide.*Listen to Audiobook/s);
    assert.equal(view.container.querySelector('audio, video'), null);
  } finally { cleanup(); }
});

test('preview state follows row focus, keeps detail/Back, and clears stale selection', () => {
  const spec = fixtureChannel(), page = spec.pages[0]!, first = spec.content[0]!;
  const other = { ...first, id: `item_${'b'.repeat(32)}`, title: 'Next title' };
  const rail = { id: `mod_${'b'.repeat(32)}`, kind: 'rail' as const, title: 'Browse', contentIds: [first.id, other.id] };
  const tv = televisionFromSpec({ ...spec, content: [first, other], pages: [{ ...page, modules: [page.modules[0]!, rail] }] });
  const projected = tv.pages[0]!;
  let state = initialState(tv);
  for (const key of ['ArrowDown', 'ArrowRight'] as const) state = navigate(tv, state, keyboardCommand({ key })!);
  assert.equal(heroSpotlight(projected, state)?.id, other.id);
  assert.equal(state.screen, 'page');
  state = navigate(tv, state, keyboardCommand({ key: 'Enter' })!);
  assert.equal(state.screen, 'detail');
  assert.equal(state.itemId, other.id);
  state = navigate(tv, state, keyboardCommand({ key: 'Backspace' })!);
  assert.equal(state.focusId, itemFocusId(page.id, rail.id, other.id));
  const changed = televisionFromSpec({ ...spec, pages: [{ ...page, modules: [page.modules[0]!, { ...rail, contentIds: [first.id] }] }] });
  state = reconcile(changed, state);
  assert.equal(state.screen, 'page');
  assert.equal(state.focusId, navFocusId(page.id));
  assert.equal(heroSpotlight(changed.pages[0]!, state)?.id, first.id);
  const secondPage = { ...page, id: `page_${'c'.repeat(32)}`, title: 'Other', modules: [] };
  const switched = televisionFromSpec({ ...spec, pages: [page, secondPage], navigation: [page.id, secondPage.id] });
  assert.equal(heroSpotlight(switched.pages[1]!, reconcile(switched,
    { screen: 'page', pageId: secondPage.id, focusId: navFocusId(secondPage.id), selectedHeroItemId: other.id })), undefined);
});

test('Preview renders ordered static artwork and copy without selectable TV cards', () => {
  const spec = fixtureChannel(), original = spec.pages[0]!;
  spec.pages[0] = { ...original, modules: [
    { id: `mod_${'a'.repeat(32)}`, kind: 'image-banner', title: 'Studio story', body: 'A quiet introduction', imageContentId: spec.content[0]!.id, crop: 'contain' },
    { id: `mod_${'b'.repeat(32)}`, kind: 'image-text', title: 'More', body: 'The next chapter', imageSide: 'right' },
    ...original.modules
  ] };
  try {
    const view = render(createElement(Preview, { spec }));
    assert.ok(view.container.querySelector('.tv-static-contain .tv-static-art img'));
    assert.match(view.container.querySelector('.tv-content')?.textContent ?? '', /Studio story.*A quiet introduction.*More.*The next chapter.*Oceans/s);
    assert.equal(view.container.querySelectorAll('.tv-static [data-tv-focus]').length, 0);
  } finally { cleanup(); }
});

test('hosted Preview projects saved private artwork visually without changing ChannelSpec', async () => {
  const previousFetch = globalThis.fetch, create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  const spec = fixtureChannel(), before = JSON.stringify(spec), owner = `cr_${'a'.repeat(32)}`;
  const itemId = `ci_${'b'.repeat(32)}`, assetId = `ma_${'c'.repeat(32)}`, objectId = `ma_${'d'.repeat(32)}`, sourceId = `src_${'e'.repeat(32)}`;
  const contentId = `item_${createHash('sha256').update('catalog-content-v1\0').update(itemId).digest('hex').slice(0, 32)}`;
  spec.content[0]!.id = contentId;
  const module = spec.pages[0]!.modules[0]!;
  if (module.kind !== 'hero' && module.kind !== 'rail' && module.kind !== 'grid') throw new Error('Expected artwork module');
  module.contentIds = [contentId];
  spec.pages[0]!.modules.push({ id: `mod_${'e'.repeat(32)}`, kind: 'image-banner', title: 'Private art', body: 'Draft only', imageContentId: contentId });
  const canonical = JSON.stringify(spec);
  const paths: string[] = [];
  URL.createObjectURL = () => 'blob:http://localhost/studio-art'; URL.revokeObjectURL = () => {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input); paths.push(path);
    if (path.endsWith('/catalog')) {
      const externalId = { provider: 'creator', kind: 'upload_id', value: 'film-1' };
      const unknown = { status: 'unknown', basis: 'none', permittedUse: 'none' };
      return new Response(JSON.stringify({ schemaVersion: 1, revision: 1, projectId: spec.id, creatorAccountId: owner,
        sources: [{ schemaVersion: 1, id: sourceId, creatorAccountId: owner, projectId: spec.id, type: 'creator_upload', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } }],
        items: [{ schemaVersion: 1, id: itemId, creatorAccountId: owner, projectId: spec.id, kind: 'video', sourceRecord: { sourceId, externalId, observedAt: '2026-10-20T00:00:00.000Z', metadata: { title: 'Oceans' } }, externalIdentifiers: [externalId], mediaAssetIds: [assetId] }],
        mediaAssets: [{ schemaVersion: 1, id: assetId, creatorAccountId: owner, projectId: spec.id, catalogItemId: itemId, kind: 'artwork', location: { type: 'private_object', objectId }, tvDisplayRights: unknown, tvPlaybackRights: unknown, deliveryEligible: false }], collections: [] }), { headers: { 'content-type': 'application/json' } });
    }
    if (path.endsWith('/capability')) return new Response(JSON.stringify({ capability: 'secret' }), { headers: { 'content-type': 'application/json' } });
    assert.equal(new Headers(init?.headers).get('x-private-capability'), 'secret');
    return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'content-type': 'image/jpeg' } });
  }) as typeof fetch;
  try {
    const view = render(createElement(Preview, { spec, hosted: true, accountId: owner }));
    await waitFor(() => assert.equal(view.container.querySelector('.tv-art img')?.getAttribute('src'), 'blob:http://localhost/studio-art'));
    assert.equal(view.container.querySelector('.tv-static-art img'), null, 'unapproved artwork stays out of the static TV section');
    assert.equal(JSON.stringify(spec), canonical);
    assert.notEqual(canonical, before);
    assert.doesNotMatch(JSON.stringify(spec), /blob:|secret|private-objects/);
    assert.equal(paths.filter(path => path.endsWith('/catalog')).length, 1);
    view.rerender(createElement(Preview, { spec: fixtureChannel(), hosted: true, accountId: owner }));
    await waitFor(() => assert.equal(view.container.querySelector('.studio-private-artwork img')?.getAttribute('src'), 'blob:http://localhost/studio-art'));
    assert.match(view.container.querySelector('.studio-private-artwork')?.textContent ?? '', /artwork preview only/);
  } finally { cleanup(); globalThis.fetch = previousFetch; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

test('owner book preview validates a same-origin private audiobook without saving its route', () => {
  const spec = fixtureChannel(), owner = `cr_${'a'.repeat(32)}`, bookId = `ci_${'b'.repeat(32)}`;
  const audioId = `ma_${'c'.repeat(32)}`, objectId = `ma_${'d'.repeat(32)}`;
  const contentId = catalogContentId(bookId);
  spec.content = [{ id: contentId, title: 'Field Guide', description: 'A book',
    artwork: 'assets/ocean.jpg', presentation: 'information' }, ...spec.content];
  const source = { schemaVersion: 1 as const, id: `src_${'e'.repeat(32)}`, creatorAccountId: owner,
    projectId: spec.id, type: 'creator_upload' as const, state: 'discovered' as const,
    permission: { retrieval: 'unknown' as const, tvDisplay: 'unknown' as const } };
  const identifier = { provider: 'creator' as const, kind: 'upload_id' as const, value: 'book-1' };
  const audio = { schemaVersion: 1 as const, id: audioId, creatorAccountId: owner, projectId: spec.id,
    catalogItemId: bookId, kind: 'audio' as const, location: { type: 'private_object' as const, objectId },
    tvDisplayRights: { status: 'unknown' as const, basis: 'none' as const, permittedUse: 'none' as const },
    tvPlaybackRights: { status: 'cleared' as const, basis: 'creator_asserted' as const,
      permittedUse: 'television_playback' as const, assertedAt: '2026-10-22T00:00:00.000Z' }, deliveryEligible: false };
  const inventory = { schemaVersion: 1 as const, revision: 1, projectId: spec.id, creatorAccountId: owner,
    sources: [source], items: [{ schemaVersion: 1 as const, id: bookId, creatorAccountId: owner,
      projectId: spec.id, kind: 'book' as const,
      sourceRecord: { sourceId: source.id, externalId: identifier, observedAt: '2026-10-22T00:00:00.000Z',
        metadata: { title: 'Field Guide', author: 'A. Writer', narrator: 'A. Narrator' } },
      externalIdentifiers: [identifier], mediaAssetIds: [audioId], audiobook: { audioAssetId: audioId } }],
    mediaAssets: [audio], collections: [] } as CatalogSnapshot;
  const before = JSON.stringify(spec);
  const preview = ownerBookPreviewContent(spec, inventory, owner, 'https://studio.example');
  assert.equal(preview[0]?.audiobook?.mediaUrl,
    `https://studio.example/api/projects/${spec.id}/private-objects/${objectId}/audio`);
  assert.doesNotThrow(() => televisionFromSpec({ ...spec, content: preview }));
  assert.equal(JSON.stringify(spec), before);
  assert.equal(ownerBookPreviewContent(spec, inventory, `cr_${'f'.repeat(32)}`, 'https://studio.example')[0]?.audiobook, undefined);
  inventory.mediaAssets[0]!.tvPlaybackRights = { status: 'revoked', basis: 'none', permittedUse: 'none' };
  assert.equal(ownerBookPreviewContent(spec, inventory, owner, 'https://studio.example')[0]?.audiobook, undefined);
});

test('editor and TV artwork show an honest fallback when the saved source is unavailable', () => {
  try {
    const view = render(createElement('div', {},
      createElement('div', { className: 'layout-tile' }, createElement(PreviewArtwork, { contentId: 'missing', source: 'assets/catalog-placeholder.png', inventory: null })),
      createElement('div', { className: 'tv-art' }, createElement(PreviewArtwork, { contentId: 'missing', source: 'assets/catalog-placeholder.png', inventory: null }))));
    const images = view.container.querySelectorAll('img');
    assert.equal(images.length, 2);
    for (const image of images) fireEvent.error(image);
    assert.equal(view.container.querySelectorAll('img').length, 0);
    assert.equal(view.container.querySelectorAll('[aria-label="Artwork unavailable"]').length, 2);
  } finally { cleanup(); }
});

test('Studio replaces only canonical managed HLS with its owner-scoped same-origin route', () => {
  const project = `ch_${'a'.repeat(32)}`, content = `item_${'b'.repeat(32)}`;
  const managed = `https://media.example.org/media/${'c'.repeat(32)}/${'a'.repeat(32)}/${'d'.repeat(32)}/delivery/${'e'.repeat(32)}/${'f'.repeat(64)}/master.m3u8`;
  assert.equal(studioVideoSource(managed, project, content), `/api/projects/${project}/preview-hls/${content}/master.m3u8`);
  assert.equal(studioVideoSource(managed), managed, 'exported and native playback URLs remain unchanged');
  for (const value of ['https://media.example.org/film.mp4', `${managed}?token=private`,
    'https://media.example.org/media/staged/master.m3u8'])
    assert.equal(studioVideoSource(value, project, content), value);
});

test('pure commands retain P2 focus/detail/playback/back and reconcile removed content', () => {
  const spec = fixtureChannel();
  const tv = televisionFromSpec(spec);
  let state = initialState(tv);
  assert.equal(state.focusId, navFocusId(spec.pages[0]!.id));
  for (const command of ['down', 'select', 'select', 'back', 'back'] as const) state = navigate(tv, state, command);
  assert.equal(state.screen, 'page');
  assert.equal(state.focusId, itemFocusId(spec.pages[0]!.id, spec.pages[0]!.modules[0]!.id, spec.content[0]!.id));
  const empty = televisionFromSpec({ ...spec, pages: [{ ...spec.pages[0]!, modules: [] }], content: [] });
  assert.deepEqual(reconcile(empty, state), initialState(empty));
  assert.equal(keyboardCommand({ key: 'Escape' }), 'back');
  assert.equal(keyboardCommand({ key: 'ArrowLeft' }), 'left');
  assert.equal(keyboardCommand({ key: 'a' }), null);
});

test('virtual remote and keyboard select the same P2 transitions in TV Preview', () => {
  const spec = fixtureChannel();
  const view = render(createElement(Preview, { spec }));
  assert.ok(view.container.querySelector('.tv-nav-button.focused'));
  const editor = document.createElement('input');
  view.container.append(editor);
  fireEvent.keyDown(editor, { key: 'ArrowDown' });
  assert.ok(view.container.querySelector('.tv-nav-button.focused'));
  fireEvent.click(screen.getByRole('button', { name: 'Down' }));
  assert.ok(view.container.querySelector('.tv-card.focused'));
  const frame = screen.getByLabelText('TV screen, use arrow keys, Enter and Escape');
  fireEvent.keyDown(frame, { key: 'Enter' });
  assert.ok(screen.getByRole('button', { name: /Play film/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  const video = view.container.querySelector('video')!;
  assert.ok(video.controls);
  assert.match(video.src, /ocean\.mp4$/);
  fireEvent.keyDown(video, { key: 'Escape' });
  assert.ok(screen.getByRole('button', { name: /Play film/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  assert.ok(view.container.querySelector('video'), 'reopening creates a fresh player');
  fireEvent.keyDown(frame, { key: 'Escape' });
  assert.ok(screen.getByRole('button', { name: /Play film/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  assert.ok(view.container.querySelector('.tv-card.focused'));
  cleanup();
});

test('Preview offers book detail and audio controls without a fake film player', () => {
  const spec = fixtureChannel();
  const book = { id: 'item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'Field Guide', description: 'A book', artwork: 'assets/ocean.jpg', presentation: 'information' as const };
  const audio = { ...spec.content[0]!, id: 'item_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', title: 'Field Recording', presentation: 'audio' as const };
  const module = { ...spec.pages[0]!.modules[0]!, kind: 'rail' as const, title: 'Browse', contentIds: [book.id, audio.id] };
  const mixed = { ...spec, content: [...spec.content, book, audio], pages: [{ ...spec.pages[0]!, modules: [module] }] };
  const view = render(createElement(Preview, { spec: mixed }));
  fireEvent.click(screen.getByRole('button', { name: 'Down' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  assert.ok(screen.getByText('ABOUT THIS TITLE · FEATURE'));
  assert.equal(screen.queryByRole('button', { name: /Play film|Play audio/ }), null);
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  assert.equal(view.container.querySelector('video, audio'), null);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  assert.ok(view.container.querySelector('.tv-card.focused'));
  fireEvent.click(screen.getByRole('button', { name: 'Right' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  assert.ok(screen.getByRole('button', { name: /Play audio/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  assert.ok(view.container.querySelector('audio'));
  assert.equal(view.container.querySelector('video'), null);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  assert.ok(screen.getByRole('button', { name: /Play audio/ }));
  const tv = televisionFromSpec(mixed);
  let playback = navigate(tv, initialState(tv), 'down');
  playback = navigate(tv, playback, 'right');
  playback = navigate(tv, navigate(tv, playback, 'select'), 'select');
  const changed = televisionFromSpec({ ...mixed, content: mixed.content.map(item => item.id === audio.id
    ? { id: audio.id, title: audio.title, description: audio.description, artwork: audio.artwork, presentation: 'information' as const }
    : item) });
  assert.equal(reconcile(changed, playback).screen, 'detail');
  cleanup();
});

test('book audiobook opens shared audio player and Back restores book detail', () => {
  const spec = fixtureChannel();
  const book = { id: 'item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'Field Guide', description: 'A book',
    artwork: 'assets/ocean.jpg', presentation: 'information' as const, author: 'A. Writer',
    narrator: 'A. Narrator', audiobook: { mediaUrl: 'https://media.example/field-guide.mp3' } };
  const module = { ...spec.pages[0]!.modules[0]!, kind: 'rail' as const, title: 'Books', contentIds: [book.id] };
  const view = render(createElement(Preview, { spec: { ...spec, content: [book], pages: [{ ...spec.pages[0]!, modules: [module] }] } }));
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Open Field Guide' }));
    assert.match(view.container.querySelector('.tv-detail-copy')?.textContent ?? '', /By A\. Writer/);
    const details = view.container.querySelector<HTMLElement>('.tv-detail-text')!;
    assert.equal(details.scrollTop, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Down' }));
    assert.equal(details.scrollTop, 40, 'remote Down scrolls long book metadata without losing its action');
    fireEvent.click(screen.getByRole('button', { name: /Listen to Audiobook/ }));
    assert.ok(view.container.querySelector('.audio-player audio'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    assert.ok(screen.getByRole('button', { name: /Listen to Audiobook/ }));
  } finally { cleanup(); }
});

test('Preview keyboard commands stay inside the TV frame and leave editor controls alone', () => {
  const view = render(createElement(Preview, { spec: fixtureChannel() }));
  const frame = screen.getByLabelText('TV screen, use arrow keys, Enter and Escape');
  const editor = document.createElement('textarea');
  document.body.append(editor);
  fireEvent.keyDown(editor, { key: 'ArrowDown' });
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  assert.ok(view.container.querySelector('.tv-nav-button.focused'));
  fireEvent.keyDown(frame, { key: 'ArrowDown' });
  assert.ok(view.container.querySelector('.tv-card.focused'));
  fireEvent.keyDown(editor, { key: 'Enter' });
  assert.equal(view.container.querySelector('.tv-detail'), null);
  editor.remove();
  cleanup();
});

test('Studio theme seam leaves creator TV colors and directional focus independent', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const theme = css.split('/* Desert Heat Studio chrome.')[1];
  assert.ok(theme);
  assert.match(theme, /--fl-canyon-image: url\('\/desert-canyon\.webp'\)/);
  assert.match(theme, /prefers-reduced-data: reduce/);
  assert.doesNotMatch(theme, /--tv-(?:accent|bg|text)\s*:/);
  const canyon = readFileSync(new URL('../public/desert-canyon.webp', import.meta.url));
  assert.equal(canyon.toString('ascii', 0, 4), 'RIFF');
  assert.equal(canyon.toString('ascii', 8, 12), 'WEBP');

  const spec = fixtureChannel();
  spec.brand = { ...spec.brand, primaryColor: '#398ae8', backgroundColor: '#102746', textColor: '#f1e8d1' };
  const view = render(createElement(Preview, { spec }));
  const frame = view.container.querySelector<HTMLElement>('.tv-frame')!;
  assert.equal(frame.style.getPropertyValue('--tv-accent'), '#398ae8');
  assert.equal(frame.style.getPropertyValue('--tv-bg'), '#102746');
  assert.equal(frame.style.getPropertyValue('--tv-text'), '#f1e8d1');
  assert.ok(view.container.querySelector('.tv-nav-button.focused'));
  fireEvent.click(screen.getByRole('button', { name: 'Down' }));
  assert.ok(view.container.querySelector('.tv-card.focused'));
  fireEvent.keyDown(frame, { key: 'Enter' });
  assert.ok(screen.getByRole('button', { name: /Play film/ }));
  cleanup();
});
