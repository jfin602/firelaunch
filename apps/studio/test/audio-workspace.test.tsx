import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { useState } from 'react';
import { AudioWorkspace } from '../src/AudioWorkspace.js';

const dom = new JSDOM('<!doctype html><html><body><main class="app-shell"></main></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const owner = id('cr', '1'), projectId = id('ch', '2'), sourceId = id('src', '3'), itemId = id('ci', '4');
const assetId = id('ma', '5'), objectId = id('ma', '6');
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('Add Audio saves one private item, independent rights, and reopens with true status', async () => {
  const priorFetch = globalThis.fetch;
  const inventory: any = { schemaVersion: 1, creatorAccountId: owner, projectId, revision: 0,
    sources: [], items: [], mediaAssets: [], collections: [] };
  let continueUpload: (() => void) | undefined;
  const uploadGate = new Promise<void>(resolve => { continueUpload = resolve; });
  const writes: { url: string; method: string; body?: any }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    writes.push({ url, method, body });
    if (url.endsWith('/catalog') && method === 'GET') return json(inventory);
    if (url.endsWith('/catalog/sources') && method === 'POST') {
      const record = { ...body.record, id: sourceId, projectId, creatorAccountId: owner };
      inventory.sources.push(record); inventory.revision++; return json({ record, revision: inventory.revision }, 201);
    }
    if (url.endsWith('/catalog/items') && method === 'POST') {
      const record = { ...body.record, id: itemId, projectId, creatorAccountId: owner };
      inventory.items.push(record); inventory.revision++; return json({ record, revision: inventory.revision }, 201);
    }
    if (url.endsWith('/private-objects/audio') && method === 'POST') {
      await uploadGate;
      return json({ id: objectId, contentType: 'audio/mpeg', byteSize: 2048, sha256: 'a'.repeat(64), durationSeconds: 12 }, 201);
    }
    if (url.endsWith('/catalog/media-assets') && method === 'POST') {
      const record = { ...body.record, id: assetId, projectId, creatorAccountId: owner };
      inventory.mediaAssets.push(record); inventory.items[0].mediaAssetIds.push(assetId);
      inventory.revision++; return json({ record, revision: inventory.revision }, 201);
    }
    throw new Error(`Unexpected ${method} ${url}`);
  }) as typeof fetch;
  function Wrapper() {
    const [selected, setSelected] = useState<string | undefined>();
    return <AudioWorkspace projectId={projectId} accountId={owner} {...(selected ? { itemId: selected } : {})}
      onIdentity={setSelected} onClose={() => {}}/>;
  }
  try {
    const view = render(<Wrapper/>);
    await screen.findByRole('dialog', { name: 'Add Audio' });
    await screen.findByLabelText('TITLE');
    fireEvent.change(screen.getByLabelText('TITLE'), { target: { value: 'Night Drive' } });
    fireEvent.change(screen.getByLabelText('ARTIST OR CREATOR'), { target: { value: 'The Owner' } });
    const mp3 = new File([new Uint8Array(2048)], 'drive.mp3', { type: 'audio/mpeg' });
    fireEvent.change(screen.getByLabelText(/MP3 FILE/), { target: { files: [mp3] } });
    fireEvent.click(screen.getByLabelText(/independent TV playback rights/));
    fireEvent.click(screen.getByRole('button', { name: 'Save audio draft' }));
    await waitFor(() => assert.equal(inventory.items.length, 1));
    await screen.findByRole('dialog', { name: 'Night Drive' });
    assert.equal((screen.getByLabelText(/independent TV playback rights/) as HTMLInputElement).checked, true,
      'creating the item must not clear the rights selection while its MP3 uploads');
    continueUpload?.();
    await waitFor(() => assert.match(document.body.textContent ?? '', /MP3: uploaded privately/));
    assert.equal(inventory.items.length, 1);
    assert.equal(inventory.mediaAssets.length, 1);
    assert.equal(inventory.items[0].sourceRecord.metadata.artist, 'The Owner');
    assert.equal(inventory.mediaAssets[0].tvDisplayRights.status, 'unknown');
    assert.equal(inventory.mediaAssets[0].tvPlaybackRights.status, 'cleared');
    assert.equal(inventory.mediaAssets[0].deliveryEligible, false);
    assert.ok(!writes.some(value => value.url.includes('/publication/')));
    view.unmount();
    render(<AudioWorkspace projectId={projectId} accountId={owner} itemId={itemId} onIdentity={() => {}} onClose={() => {}}/>);
    await screen.findByRole('dialog', { name: 'Night Drive' });
    assert.match(screen.getByText(/MP3: uploaded privately/).textContent ?? '', /Delivery: blocked · Live: no/);
  } finally { cleanup(); globalThis.fetch = priorFetch; }
});
