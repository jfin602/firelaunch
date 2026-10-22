import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { useState } from 'react';
import { BookWorkspace } from '../src/BookWorkspace.js';

const dom = new JSDOM('<!doctype html><html><body><main class="app-shell"></main></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const owner = id('cr', '1'), projectId = id('ch', '2'), sourceId = id('src', '3'), bookId = id('ci', '4');
const assetId = id('ma', '5'), objectId = id('ma', '6'), bookshelfId = id('col', '7');
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('book saves and reopens without Play, then attaches one MP3 to the same book', async () => {
  const previousFetch = globalThis.fetch;
  const inventory: any = { schemaVersion: 1, creatorAccountId: owner, projectId, revision: 0,
    sources: [], items: [], mediaAssets: [], collections: [] };
  const writes: { url: string; method: string; record?: any }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    writes.push({ url, method, record: body?.record });
    if (url.endsWith('/catalog') && method === 'GET') return json(inventory);
    if (url.endsWith('/catalog/sources') && method === 'POST') {
      const record = { ...body.record, id: sourceId, creatorAccountId: owner, projectId };
      inventory.sources.push(record); inventory.revision++; return json({ record, revision: inventory.revision }, 201);
    }
    if (url.endsWith('/catalog/items') && method === 'POST') {
      const record = { ...body.record, id: bookId, creatorAccountId: owner, projectId };
      inventory.items.push(record); inventory.revision++; return json({ record, revision: inventory.revision }, 201);
    }
    if (url.endsWith(`/catalog/items/${bookId}`) && method === 'PUT') {
      const record = { ...body.record, id: bookId, creatorAccountId: owner, projectId };
      inventory.items[0] = record; inventory.revision++; return json({ record, revision: inventory.revision });
    }
    if (url.endsWith('/catalog/collections') && method === 'POST') {
      const record = { ...body.record, id: bookshelfId, creatorAccountId: owner, projectId };
      inventory.collections.push(record); inventory.revision++; return json({ record, revision: inventory.revision }, 201);
    }
    if (url.endsWith('/private-objects/audio') && method === 'POST')
      return json({ id: objectId, contentType: 'audio/mpeg', byteSize: 2048, sha256: 'a'.repeat(64) }, 201);
    if (url.endsWith('/catalog/media-assets') && method === 'POST') {
      const record = { ...body.record, id: assetId, creatorAccountId: owner, projectId };
      inventory.mediaAssets.push(record); inventory.items[0].mediaAssetIds.push(assetId);
      inventory.revision++; return json({ record, revision: inventory.revision }, 201);
    }
    if (url.endsWith(`/catalog/media-assets/${assetId}`) && method === 'DELETE') {
      inventory.mediaAssets = []; inventory.items[0].mediaAssetIds = [];
      inventory.revision++; return json({ deleted: true, revision: inventory.revision });
    }
    if (url.endsWith(`/private-objects/${objectId}`) && method === 'DELETE') return json({ deleted: true });
    throw new Error(`Unexpected ${method} ${url}`);
  }) as typeof fetch;
  function Wrapper() {
    const [selected, setSelected] = useState<string>();
    return <BookWorkspace projectId={projectId} accountId={owner} {...(selected ? { itemId: selected } : {})}
      onIdentity={setSelected} onClose={() => {}}/>;
  }
  try {
    const view = render(<Wrapper/>);
    await screen.findByRole('dialog', { name: 'Add Book' });
    await screen.findByLabelText('TITLE');
    fireEvent.change(screen.getByLabelText('TITLE'), { target: { value: 'Desert Stories' } });
    fireEvent.change(screen.getByLabelText('AUTHOR'), { target: { value: 'A. Writer' } });
    fireEvent.change(screen.getByLabelText('SYNOPSIS'), { target: { value: 'A journey across the desert.' } });
    fireEvent.change(screen.getByLabelText('NEW BOOKSHELF'), { target: { value: 'Original Books' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save book draft' }));
    await waitFor(() => assert.equal(inventory.collections.length, 1));
    assert.equal(inventory.items.length, 1);
    assert.equal(inventory.items[0].kind, 'book');
    assert.deepEqual(inventory.items[0].mediaAssetIds, []);
    assert.equal(inventory.collections[0].itemIds[0], bookId);
    assert.ok(!screen.queryByRole('button', { name: /Listen to Audiobook/ }));
    view.unmount();
    render(<BookWorkspace projectId={projectId} accountId={owner} itemId={bookId} onIdentity={() => {}} onClose={() => {}}/>);
    await screen.findByRole('dialog', { name: 'Desert Stories' });
    assert.equal((screen.getByLabelText('BOOKSHELF') as HTMLSelectElement).value, bookshelfId);
    fireEvent.click(screen.getByLabelText('Attach audiobook MP3'));
    fireEvent.change(screen.getByLabelText('NARRATOR'), { target: { value: 'A. Narrator' } });
    fireEvent.change(screen.getByLabelText(/AUDIOBOOK MP3/), { target: { files: [new File([new Uint8Array(2048)], 'story.mp3', { type: 'audio/mpeg' })] } });
    fireEvent.click(screen.getByLabelText(/independent TV playback rights/));
    fireEvent.click(screen.getByRole('button', { name: 'Save book draft' }));
    await waitFor(() => {
      assert.equal(screen.queryByRole('alert')?.textContent ?? '', '', `book save error; writes: ${writes.map(value => `${value.method} ${value.url}`).join(', ')}`);
      assert.equal(inventory.items[0].audiobook?.audioAssetId, assetId);
    });
    assert.equal(inventory.items.length, 1);
    assert.equal(inventory.mediaAssets[0].catalogItemId, bookId);
    assert.equal(inventory.mediaAssets[0].tvPlaybackRights.status, 'cleared');
    assert.equal(inventory.mediaAssets[0].deliveryEligible, false);
    assert.ok(!writes.some(value => value.record?.kind === 'audio' && value.url.endsWith('/catalog/items')));
    await screen.findByRole('button', { name: 'Remove audiobook' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove audiobook' }));
    await waitFor(() => assert.equal(inventory.items[0].audiobook, undefined));
    assert.equal(inventory.items[0].id, bookId);
    assert.equal(inventory.collections[0].itemIds[0], bookId);
    assert.equal(inventory.mediaAssets.length, 0);
  } finally { cleanup(); globalThis.fetch = previousFetch; }
});
