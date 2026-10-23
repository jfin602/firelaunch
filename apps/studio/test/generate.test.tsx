import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@firelaunch/channel-engine';
import { Catalog } from '../src/Catalog.js';
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

test('Library uses one per-item Publish action and has no Generate flow', async () => {
  const previous = globalThis.fetch;
  const calls: unknown[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/catalog') && !init?.method) return response(inventory);
    if (String(input).endsWith('/media-inclusion') && init?.method === 'POST') {
      calls.push(JSON.parse(String(init.body)));
      return response({ ...project, revision: 2 });
    }
    throw new Error(String(input));
  }) as typeof fetch;
  try {
    let nextRevision = 0;
    render(createElement(Catalog, { project, hosted: true, accountId: owner, onProjectUpdate: next => { nextRevision = next.revision; } }));
    await screen.findByRole('button', { name: 'Select First Book · book' });
    assert.equal(screen.queryByText(/Generate Channel Draft/i), null);
    assert.equal(screen.queryByRole('button', { name: /Generate .* draft/ }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Publish First Book · book' }));
    await waitFor(() => assert.equal(nextRevision, 2));
    assert.deepEqual(calls[0], { expectedRevision: 1, expectedCatalogRevision: 2, itemId, action: 'publish' });
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
