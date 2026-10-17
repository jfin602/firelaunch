import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@firelaunch/channel-engine';
import type { ChannelProject } from '@firelaunch/contracts';
import App from '../src/App.js';

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
    fireEvent.click(screen.getByRole('navigation', { name: 'Studio surfaces' }).querySelector('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Open Catalog / Add Video' }));
    await screen.findByRole('heading', { name: 'Build your channel library.' });
    fireEvent.click(screen.getByRole('navigation', { name: 'Studio surfaces' }).querySelector('button')!);
    fireEvent.click(document.querySelector('.home-hero .button-row button:last-child')!);
    assert.ok(screen.getByPlaceholderText('e.g. Wild Earth'));
  } finally { one.restore(); }
});

test('many projects and creator artwork are scoped; broken artwork falls back', async () => {
  const mock = setup([first, second], id => json(id === firstId ? { ...empty(firstId), sources: [source], items: [film(firstId)] } : empty(secondId)));
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: 'Open Director Cut in Catalog' });
    assert.equal((document.querySelector('.home-art img') as HTMLImageElement).src, 'https://art.example/violet.jpg');
    assert.ok(screen.getByText('Playback rights unknown'));
    assert.ok(screen.getByText('No playable upload · private draft'));
    fireEvent.error(document.querySelector('.home-art img')!);
    assert.ok(screen.getByLabelText('Artwork unavailable'));
    assert.equal(document.querySelector('.home-art img'), null);
    assert.equal(screen.getAllByRole('button', { name: /films.*draft/ }).length, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Open Director Cut in Catalog' }));
    await screen.findByRole('heading', { name: 'Build your channel library.' });
    assert.ok(mock.requests.every(url => !url.includes('/private-objects')));
  } finally { mock.restore(); }
});

test('private object and signed artwork URLs stay out of Home image elements', async () => {
  const signed = { ...film(firstId), creatorOverrides: { ...film(firstId).creatorOverrides, artworkUrl: 'https://bucket.s3.amazonaws.com/private.jpg?token=secret' } };
  const mock = setup([first], () => json({ ...empty(firstId), sources: [source], items: [signed] }));
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: 'Open Director Cut in Catalog' });
    assert.equal(document.querySelector('.home-art img'), null);
    assert.ok(screen.getByLabelText('Artwork unavailable'));
    assert.ok(mock.requests.every(url => !url.includes('secret')));
  } finally { mock.restore(); }
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
