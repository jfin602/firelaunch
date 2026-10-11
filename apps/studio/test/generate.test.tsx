import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@firelaunch/channel-engine';
import type { ChannelProject } from '@firelaunch/contracts';
import { Catalog } from '../src/Catalog.js';
import { Preview } from '../src/Preview.js';
import { AgentPanel } from '../src/AgentPanel.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const projectId = id('ch', 'a'), owner = id('cr', 'b'), itemId = id('ci', 'c'), sourceId = id('src', 'd');
const spec = starterChannel('Author channel', projectId, id('page', 'e'));
const project = { id: projectId, revision: 1, spec, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const book = { schemaVersion: 1, id: itemId, creatorAccountId: owner, projectId, kind: 'book', sourceRecord: {
  sourceId, externalId: { provider: 'creator', kind: 'feed_item_id', value: 'book-1' }, observedAt: new Date().toISOString(), metadata: { title: 'First Book' }
}, externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'book-1' }], mediaAssetIds: [] };
const inventory = { schemaVersion: 1, creatorAccountId: owner, projectId, revision: 2, sources: [{ schemaVersion: 1, id: sourceId, creatorAccountId: owner, projectId, type: 'creator_csv', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } }], items: [book], collections: [], mediaAssets: [] };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

test('writing selection generates a persisted draft and opens book detail without Play', async () => {
  const previous = globalThis.fetch;
  const calls: unknown[] = [];
  const contentId = id('item', 'f'), pageId = id('page', '1'), moduleId = id('mod', '2');
  const generated: ChannelProject = { ...project, revision: 2, spec: { ...spec, navigation: [pageId], content: [{ id: contentId, title: 'First Book', description: 'A book', artwork: 'assets/catalog-placeholder.png', presentation: 'information' }],
    pages: [{ id: pageId, title: 'Bookshelf', modules: [{ id: moduleId, kind: 'rail', title: 'Books', contentIds: [contentId] }] }] } };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/catalog') && !init?.method) return response(inventory);
    if (String(input).endsWith('/catalog-draft') && !init?.method) return response(null);
    if (String(input).endsWith('/catalog-draft')) { calls.push(JSON.parse(String(init?.body))); return response({ project: generated, changes: { added: 1, updated: 0, removed: 0, pages: ['Bookshelf'], notices: [] } }); }
    throw new Error(String(input));
  }) as typeof fetch;
  try {
    let saved: typeof generated | undefined;
    render(createElement(Catalog, { project, hosted: true, onGenerated: next => { saved = next as typeof generated; } }));
    fireEvent.change(await screen.findByRole('combobox', { name: 'Creator type' }), { target: { value: 'writing' } });
    fireEvent.click(screen.getByLabelText('First Book · book'));
    fireEvent.click(screen.getByRole('button', { name: 'Generate writing draft →' }));
    await screen.findByText(/Draft saved at revision 2/);
    assert.deepEqual(calls[0], { creatorType: 'writing', expectedRevision: 1, expectedCatalogRevision: 2, itemIds: [itemId], collectionIds: [] });
    assert.ok(screen.getByText(/1 added · 0 updated · 0 removed/));
    cleanup();
    assert.ok(saved);
    render(createElement(Preview, { spec: saved.spec }));
    fireEvent.click(screen.getByRole('button', { name: 'Down' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    assert.ok(screen.getByText('ABOUT THIS TITLE · FEATURE'));
    assert.equal(screen.queryByRole('button', { name: /Play film|Play audio/ }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    assert.ok(screen.getByRole('button', { name: 'Open First Book' }));
  } finally { cleanup(); globalThis.fetch = previous; }
});

test('video generation reports missing eligible media and does not submit', async () => {
  const previous = globalThis.fetch;
  let posted = false;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method) posted = true;
    if (String(_input).endsWith('/catalog-draft')) return response(null);
    return response({ ...inventory, items: [{ ...book, kind: 'video' }] });
  }) as typeof fetch;
  try {
    render(createElement(Catalog, { project, hosted: true }));
    await screen.findByRole('combobox', { name: 'Creator type' });
    fireEvent.click(screen.getByLabelText('First Book · video'));
    assert.ok(screen.getByText(/lack eligible playback media or rights/));
    assert.equal((screen.getByRole('button', { name: 'Generate video draft →' }) as HTMLButtonElement).disabled, true);
    assert.equal(posted, false);
  } finally { cleanup(); globalThis.fetch = previous; }
});

test('generation conflict reloads the latest project and offers a reviewable retry', async () => {
  const previous = globalThis.fetch;
  const fresh = { ...project, revision: 2 };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/catalog-draft')) return init?.method ? response({ error: { message: 'Project revision changed' } }, 409) : response(null);
    if (String(input).endsWith('/catalog')) return response(inventory);
    if (!init?.method) return response(fresh);
    throw new Error(String(input));
  }) as typeof fetch;
  try {
    let updated = 0;
    render(createElement(Catalog, { project, hosted: true, onGenerated: next => { updated = next.revision; } }));
    fireEvent.change(await screen.findByRole('combobox', { name: 'Creator type' }), { target: { value: 'writing' } });
    fireEvent.click(screen.getByLabelText('First Book · book'));
    fireEvent.click(screen.getByRole('button', { name: 'Generate writing draft →' }));
    await waitFor(() => assert.equal(updated, 2));
    assert.ok(await screen.findByRole('alert'));
    assert.match(screen.getByRole('alert').textContent ?? '', /changed in another tab/);
  } finally { cleanup(); globalThis.fetch = previous; }
});

test('revisited catalog restores creator type and selected items', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => String(input).endsWith('/catalog-draft')
    ? response({ creatorType: 'writing', selection: { expectedCatalogRevision: 2, itemIds: [itemId], collectionIds: [] } }) : response(inventory)) as typeof fetch;
  try {
    render(createElement(Catalog, { project, hosted: true }));
    await waitFor(() => assert.equal((screen.getByRole('combobox', { name: 'Creator type' }) as HTMLSelectElement).value, 'writing'));
    assert.equal((screen.getByLabelText('First Book · book') as HTMLInputElement).checked, true);
    assert.equal((screen.getByRole('button', { name: 'Generate writing draft →' }) as HTMLButtonElement).disabled, false);
  } finally { cleanup(); globalThis.fetch = previous; }
});

test('optional refinement stays disabled when provider is unavailable', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => response({ error: { message: 'Provider unavailable' } }, 503)) as typeof fetch;
  try {
    render(createElement(AgentPanel, { project, onUpdate: () => undefined, events: [], onEvents: () => undefined }));
    await screen.findByText('Provider status unavailable');
    fireEvent.change(screen.getByPlaceholderText('e.g. Add page Explore'), { target: { value: 'Change title' } });
    assert.equal((screen.getByRole('button', { name: 'Send request →' }) as HTMLButtonElement).disabled, true);
  } finally { cleanup(); globalThis.fetch = previous; }
});
