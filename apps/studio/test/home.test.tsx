import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@firelaunch/channel-engine';
import type { ChannelProject } from '@firelaunch/contracts';
import App from '../src/App.js';
import { clearVideoTransfers, startVideoTransfer, videoTransfer } from '../src/video-transfer.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const owner = `cr_${'a'.repeat(32)}`;
const firstId = `ch_${'b'.repeat(32)}`;
const secondId = `ch_${'c'.repeat(32)}`;
const sourceId = `src_${'d'.repeat(32)}`;
const itemId = `ci_${'e'.repeat(32)}`;
const makeProject = (id: string, title: string): ChannelProject => ({ id, spec: starterChannel(title, id), revision: 1,
  createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' });
const first = makeProject(firstId, 'First films');
const second = makeProject(secondId, 'Second films');
const session = { accountId: owner, email: 'owner@example.com', csrfToken: 'csrf', expiresAt: '2099-01-01T00:00:00.000Z' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const empty = (projectId: string) => ({ schemaVersion: 1, creatorAccountId: owner, projectId, revision: 1, sources: [], items: [], collections: [], mediaAssets: [] });
const film = (projectId: string) => ({ schemaVersion: 1, id: itemId, creatorAccountId: owner, projectId, kind: 'video',
  sourceRecord: { sourceId, externalId: { provider: 'creator', kind: 'feed_item_id', value: 'film-1' }, observedAt: '2026-10-10T00:00:00.000Z', metadata: { title: 'Source Film', artworkUrl: 'https://art.example/blue.jpg' } },
  externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'film-1' }],
  creatorOverrides: { title: 'Director Cut', artworkUrl: 'https://art.example/violet.jpg', editedAt: '2026-10-10T00:00:00.000Z' }, mediaAssetIds: [] });
const source = { schemaVersion: 1, id: sourceId, creatorAccountId: owner, projectId: firstId, type: 'creator_csv', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } };

function setup(projects: ChannelProject[], catalog: (id: string) => Promise<Response> | Response) {
  const previous = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async input => {
    const url = String(input); requests.push(url);
    if (url === '/api/auth/session') return json(session);
    if (url === '/api/projects') return json(projects);
    if (url === `/api/projects/${secondId}`) return json(second);
    if (url.endsWith('/catalog')) return catalog(url.split('/')[3]!);
    throw new Error(`Unexpected request ${url}`);
  }) as typeof fetch;
  return { requests, restore: () => { cleanup(); globalThis.fetch = previous; dom.window.history.replaceState(null, '', '/'); } };
}

test('empty account keeps clear onboarding; one project opens real Home and navigation', async () => {
  const none = setup([], () => json(empty(firstId)));
  try { render(createElement(App)); await screen.findByPlaceholderText('e.g. Wild Earth'); assert.equal(screen.getByRole('button', { name: 'Home' }).hasAttribute('disabled'), true); }
  finally { none.restore(); }
  const one = setup([first], () => json(empty(firstId)));
  try {
    render(createElement(App));
    await screen.findByRole('heading', { name: 'Your channels' });
    assert.equal(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-current'), 'page');
    await screen.findByText(/No catalog items yet/);
    assert.ok(screen.getByRole('button', { name: /First films.*Current channel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'TV Preview' }));
    assert.ok(screen.getByRole('region', { name: 'Interactive TV Preview' }));
    assert.equal(screen.getByRole('button', { name: 'Pages & Layout' }).getAttribute('aria-pressed'), 'true');
    fireEvent.click(screen.getByRole('navigation', { name: 'Studio surfaces' }).querySelector('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Edit channel' }));
    assert.equal(screen.getByRole('button', { name: 'Appearance' }).getAttribute('aria-pressed'), 'true');
    fireEvent.click(screen.getByRole('navigation', { name: 'Studio surfaces' }).querySelector('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Add Video' }));
    await screen.findByRole('dialog', { name: 'Add Video' });
    fireEvent.click(screen.getByRole('button', { name: 'Close video workspace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to Library →' }));
    assert.equal(screen.getByRole('button', { name: 'Library' }).getAttribute('aria-current'), 'page');
    fireEvent.click(screen.getByRole('navigation', { name: 'Studio surfaces' }).querySelector('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'New channel' }));
    assert.ok(screen.getByPlaceholderText('e.g. Wild Earth'));
  } finally { one.restore(); }
});

test('many projects and creator artwork are scoped; broken artwork falls back', async () => {
  const mock = setup([first, second], id => json(id === firstId ? { ...empty(firstId), sources: [source], items: [film(firstId)] } : empty(secondId)));
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: 'Open Director Cut video' });
    assert.equal((document.querySelector('.home-art img') as HTMLImageElement).src, 'https://art.example/violet.jpg');
    assert.ok(screen.getByText('Playback rights unknown'));
    assert.ok(screen.getByText('No upload yet · open to add an MP4'));
    assert.ok(screen.getByText('Open video →'));
    fireEvent.error(document.querySelector('.home-art img')!);
    assert.ok(screen.getByLabelText('Artwork unavailable'));
    assert.equal(document.querySelector('.home-art img'), null);
    assert.equal(screen.getAllByRole('button', { name: /films.*draft/ }).length, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Open Director Cut video' }));
    await screen.findByRole('dialog', { name: 'Director Cut' });
    assert.ok(mock.requests.every(url => !url.includes('/private-objects')));
  } finally { mock.restore(); }
});

test('Home reports saved audio rights and a book audiobook from their own assets', async () => {
  const audioId = `ci_${'1'.repeat(32)}`, bookId = `ci_${'2'.repeat(32)}`;
  const trackId = `ma_${'3'.repeat(32)}`, audiobookId = `ma_${'4'.repeat(32)}`, coverId = `ma_${'5'.repeat(32)}`;
  const { creatorOverrides: _overrides, ...base } = film(firstId);
  const item = (id: string, kind: 'audio' | 'book', title: string, mediaAssetIds: string[]) => ({ ...base,
    id, kind, mediaAssetIds, sourceRecord: { ...base.sourceRecord,
      externalId: { ...base.sourceRecord.externalId, value: id }, metadata: { title } },
    externalIdentifiers: [{ ...base.sourceRecord.externalId, value: id }] });
  const rights = (use: 'television_display' | 'television_playback') => ({ status: 'cleared', basis: 'creator_asserted',
    permittedUse: use, assertedAt: '2026-10-20T00:00:00.000Z' });
  const unknown = { status: 'unknown', basis: 'none', permittedUse: 'none' };
  const asset = (id: string, catalogItemId: string, kind: 'audio' | 'artwork') => ({ schemaVersion: 1, id,
    creatorAccountId: owner, projectId: firstId, catalogItemId, kind,
    location: { type: 'https', url: `https://art.example/${id}.jpg` }, deliveryEligible: false,
    tvDisplayRights: kind === 'artwork' ? rights('television_display') : unknown,
    tvPlaybackRights: kind === 'audio' ? rights('television_playback') : unknown });
  const mock = setup([first], () => json({ ...empty(firstId), sources: [source],
    items: [item(audioId, 'audio', 'Private Track', [trackId]),
      { ...item(bookId, 'book', 'Private Book', [audiobookId, coverId]), audiobook: { audioAssetId: audiobookId } }],
    mediaAssets: [asset(trackId, audioId, 'audio'), asset(audiobookId, bookId, 'audio'), asset(coverId, bookId, 'artwork')] }));
  try {
    render(createElement(App));
    const audioCard = await screen.findByRole('button', { name: 'Open Private Track in Library' });
    const bookCard = screen.getByRole('button', { name: 'Open Private Book in Library' });
    assert.match(audioCard.textContent ?? '', /Playback rights asserted/);
    assert.match(bookCard.textContent ?? '', /Book · audiobook attached/);
    assert.match(bookCard.textContent ?? '', /Cover display rights asserted · playback rights asserted/);
  } finally { mock.restore(); }
});

test('video workspace opens directly from Home and Library, traps focus, and restores its opener', async () => {
  const mock = setup([first], () => json({ ...empty(firstId), sources: [source], items: [film(firstId)] }));
  try {
    render(createElement(App));
    const card = await screen.findByRole('button', { name: 'Open Director Cut video' });
    card.focus();
    fireEvent.click(card);
    const dialog = await screen.findByRole('dialog', { name: 'Director Cut' });
    const close = screen.getByRole('button', { name: 'Close video workspace' });
    assert.equal(document.activeElement, close);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    assert.ok(dialog.contains(screen.getByRole('button', { name: 'Save details' })));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    assert.ok(dialog.contains(document.activeElement));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
    assert.equal(document.activeElement, card);
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Select Director Cut · video' }));
    await screen.findByRole('dialog', { name: 'Director Cut' });
    fireEvent.click(screen.getByRole('button', { name: 'Close video workspace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Video' }));
    await screen.findByRole('dialog', { name: 'Add Video' });
  } finally { mock.restore(); }
});

test('video workspace blocks Escape and close while a video action is pending', async () => {
  const item = film(firstId);
  const inventory = { ...empty(firstId), sources: [source], items: [item], collections: [{ schemaVersion: 1, id: `col_${'f'.repeat(32)}`, creatorAccountId: owner, projectId: firstId, kind: 'series', title: 'Videos', itemIds: [itemId] }] };
  const mock = setup([first], () => json(inventory));
  const baselineFetch = globalThis.fetch;
  let release!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { release = resolve; });
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith(`/catalog/items/${itemId}`) && init?.method === 'PUT'
    ? pending : baselineFetch(input, init)) as typeof fetch;
  try {
    render(createElement(App));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Director Cut video' }));
    const dialog = await screen.findByRole('dialog', { name: 'Director Cut' });
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Close video workspace' }) as HTMLButtonElement).disabled, true));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    assert.ok(screen.getByRole('dialog', { name: 'Director Cut' }));
    release(json({ revision: 2, record: item }));
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Close video workspace' }) as HTMLButtonElement).disabled, false));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
  } finally { mock.restore(); }
});

test('closing the video popup keeps an active upload, reopening shows Stop', async () => {
  const mock = setup([first], () => json({ ...empty(firstId), sources: [source], items: [film(firstId)] }));
  const previousFetch = globalThis.fetch, previousXHR = globalThis.XMLHttpRequest;
  const assetId = `ma_${'f'.repeat(32)}`, uploadId = `up_${'a'.repeat(32)}`;
  let sent = false;
  class WaitingXHR {
    status = 200; upload = { onprogress: (_event: ProgressEvent) => {} };
    onload = () => {}; onerror = () => {}; onabort = () => {};
    open() {} set withCredentials(_value: boolean) {}
    send() { sent = true; }
    abort() { this.onabort(); }
    getResponseHeader() { return 'a'.repeat(32); }
  }
  globalThis.XMLHttpRequest = WaitingXHR as unknown as typeof XMLHttpRequest;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/media-uploads') && init?.method === 'POST')
      return json({ id: uploadId, state: 'initiated', partSize: 8_388_608, partCount: 1, expiresAt: new Date(Date.now() + 100000).toISOString() }, 201);
    if (url.endsWith('/part')) return json({ url: 'https://s3.example/part', contentLength: 1, expiresInSeconds: 300 });
    if (url.endsWith('/abort')) return json({ id: uploadId, state: 'aborted' });
    return previousFetch(input, init);
  }) as typeof fetch;
  try {
    render(createElement(App));
    const card = await screen.findByRole('button', { name: 'Open Director Cut video' });
    const file = new File(['x'], 'one.mp4', { type: 'video/mp4' });
    const transfer = startVideoTransfer({ accountId: owner, projectId: firstId, itemId, assetId,
      file, durationSeconds: 12, sha256: 'a'.repeat(64) });
    await waitFor(() => assert.equal(sent, true));
    const exitDuringUpload = new dom.window.Event('beforeunload', { cancelable: true });
    dom.window.dispatchEvent(exitDuringUpload);
    assert.equal(exitDuringUpload.defaultPrevented, true, 'browser exit warns while the file is still in this tab');
    fireEvent.click(card);
    await screen.findByRole('dialog', { name: 'Director Cut' });
    fireEvent.click(screen.getByRole('button', { name: 'Close video workspace' }));
    await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
    assert.equal(videoTransfer(owner, firstId, itemId)?.state, 'uploading');
    assert.ok(screen.getByText(/Keep this tab open/));
    fireEvent.click(screen.getByRole('button', { name: 'Open video' }));
    await screen.findByRole('dialog', { name: 'Director Cut' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Stop upload' })[0]!);
    await assert.rejects(transfer, /Upload canceled/);
    assert.equal(videoTransfer(owner, firstId, itemId)?.state, 'stopped');
    const exitAfterStop = new dom.window.Event('beforeunload', { cancelable: true });
    dom.window.dispatchEvent(exitAfterStop);
    assert.equal(exitAfterStop.defaultPrevented, false);
  } finally { clearVideoTransfers(owner); globalThis.fetch = previousFetch; globalThis.XMLHttpRequest = previousXHR; mock.restore(); }
});

test('session loss clears the selected video and its private workspace', async () => {
  const mock = setup([first], () => json({ ...empty(firstId), sources: [source], items: [film(firstId)] }));
  try {
    render(createElement(App));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Director Cut video' }));
    await screen.findByRole('dialog', { name: 'Director Cut' });
    fireEvent(dom.window as unknown as Window, new dom.window.Event('firelaunch-session-expired'));
    await screen.findByRole('link', { name: 'Sign in with Google' });
    assert.equal(screen.queryByRole('dialog'), null);
    assert.equal(screen.queryByText('Director Cut'), null);
  } finally { mock.restore(); }
});

test('private object and signed artwork URLs stay out of Home image elements', async () => {
  const signed = { ...film(firstId), creatorOverrides: { ...film(firstId).creatorOverrides, artworkUrl: 'https://bucket.s3.amazonaws.com/private.jpg?token=secret' } };
  const mock = setup([first], () => json({ ...empty(firstId), sources: [source], items: [signed] }));
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: 'Open Director Cut video' });
    assert.equal(document.querySelector('.home-art img'), null);
    assert.ok(screen.getByLabelText('Artwork unavailable'));
    assert.ok(mock.requests.every(url => !url.includes('secret')));
  } finally { mock.restore(); }
});

test('Home and reopened video popup show the saved owned image before encoding', async () => {
  const artworkId = `ma_${'f'.repeat(32)}`, objectId = `ma_${'1'.repeat(32)}`;
  const owned = { ...film(firstId), mediaAssetIds: [artworkId] };
  const media = { schemaVersion: 1, id: artworkId, creatorAccountId: owner, projectId: firstId, catalogItemId: itemId,
    kind: 'artwork', location: { type: 'private_object', objectId }, deliveryEligible: false,
    tvDisplayRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt: '2026-10-20T00:00:00.000Z' },
    tvPlaybackRights: { status: 'unknown', basis: 'none', permittedUse: 'none' } };
  const mock = setup([first], () => json({ ...empty(firstId), sources: [source], items: [owned], mediaAssets: [media] }));
  const previousFetch = globalThis.fetch, create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:https://studio.example/saved'; URL.revokeObjectURL = () => {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith(`/${objectId}/capability`)) return json({ capability: 'private-token' });
    if (path.endsWith(`/${objectId}/content`)) {
      assert.equal(new Headers(init?.headers).get('x-private-capability'), 'private-token');
      return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'content-type': 'image/jpeg' } });
    }
    return previousFetch(input, init);
  }) as typeof fetch;
  try {
    render(createElement(App));
    const card = await screen.findByRole('button', { name: 'Open Director Cut video' });
    await waitFor(() => assert.equal(card.querySelector('.home-art img')?.getAttribute('src'), 'blob:https://studio.example/saved'));
    fireEvent.click(card);
    fireEvent.click((await screen.findByRole('dialog')).querySelector('.video-workspace-page-buttons button')!);
    await waitFor(() => assert.equal(screen.getByRole('dialog').querySelector('.video-thumbnail-art img')?.getAttribute('src'), 'blob:https://studio.example/saved'));
    assert.equal(screen.getByRole('dialog').querySelectorAll('img').length, 1, 'one saved poster in the video popup');
    assert.doesNotMatch(document.body.innerHTML, /private-token|private-objects/);
  } finally { mock.restore(); URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

test('fast project switch ignores stale catalog response and shows only selected project', async () => {
  let resolveFirst!: (value: Response) => void;
  const pendingFirst = new Promise<Response>(resolve => { resolveFirst = resolve; });
  const mock = setup([first, second], id => id === firstId ? pendingFirst : json(empty(secondId)));
  try {
    render(createElement(App));
    await screen.findByRole('heading', { name: 'Your channels' });
    fireEvent.click(screen.getByRole('button', { name: /Second films.*Private draft/ }));
    await screen.findByText(/No catalog items yet/);
    resolveFirst(json({ ...empty(firstId), sources: [source], items: [film(firstId)] }));
    await waitFor(() => assert.equal(screen.queryByText('Director Cut'), null));
    assert.equal(mock.requests.filter(url => url.endsWith('/catalog')).length, 2);
    assert.equal(dom.window.location.search, `?project=${secondId}`);
  } finally { mock.restore(); }
});

test('catalog failure offers retry and mismatched owner inventory is never rendered', async () => {
  let calls = 0;
  const mock = setup([first], () => { calls++; return json(calls === 1 ? { error: { message: 'Unavailable' } } : { ...empty(firstId), creatorAccountId: `cr_${'f'.repeat(32)}`, sources: [source], items: [film(firstId)] }, calls === 1 ? 503 : 200); });
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: 'Retry library' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry library' }));
    await waitFor(() => assert.equal(calls, 2));
    assert.ok(screen.getByText('Could not load this channel’s library.'));
    assert.equal(screen.queryByText('Director Cut'), null);
  } finally { mock.restore(); }
});

test('session expiry removes Home and late library data cannot return', async () => {
  let resolveCatalog!: (value: Response) => void;
  const pending = new Promise<Response>(resolve => { resolveCatalog = resolve; });
  const mock = setup([first], () => pending);
  try {
    render(createElement(App));
    await screen.findByRole('heading', { name: 'Your channels' });
    fireEvent(dom.window as unknown as Window, new dom.window.Event('firelaunch-session-expired'));
    await screen.findByRole('link', { name: 'Sign in with Google' });
    resolveCatalog(json({ ...empty(firstId), sources: [source], items: [film(firstId)] }));
    await waitFor(() => assert.equal(screen.queryByText('Director Cut'), null));
    assert.equal(screen.queryByRole('button', { name: 'Home' }), null);
  } finally { mock.restore(); }
});
