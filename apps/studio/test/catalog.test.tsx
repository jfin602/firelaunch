import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { Catalog } from '../src/Catalog.js';
import { getSession, previewCatalogImport, approveCatalogImport, uploadPrivateMedia, writeCatalog } from '../src/api.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const projectId = `ch_${'a'.repeat(32)}`;
const owner = `cr_${'b'.repeat(32)}`;
const sourceId = `src_${'c'.repeat(32)}`;
const itemId = `ci_${'d'.repeat(32)}`;
const base = () => ({ schemaVersion: 1, creatorAccountId: owner, projectId, revision: 0, sources: [] as any[], items: [] as any[], collections: [] as any[], mediaAssets: [] as any[] });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('catalog-first Studio reviews import, preserves draft books and lets creator curate', async () => {
  const previous = globalThis.fetch;
  const inventory = base();
  const calls: { url: string; body?: any; method: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET'; const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    if (url === `/api/projects/${projectId}/catalog` && method === 'GET') return json(inventory);
    if (url.endsWith('/sources') && method === 'POST') {
      const record = { ...body.record, id: sourceId, creatorAccountId: owner, projectId };
      inventory.sources.push(record); inventory.revision++; return json({ revision: inventory.revision, record }, 201);
    }
    if (url.endsWith('/imports/preview')) return json({ sourceId, format: 'csv', revision: inventory.revision, fingerprint: 'f'.repeat(64), rows: [{ line: 2, externalId: 'book-1', kind: 'book', metadata: { title: 'First Book' }, action: 'create' }], issues: [] });
    if (url.endsWith('/imports/approve')) {
      inventory.items.push({ schemaVersion: 1, id: itemId, creatorAccountId: owner, projectId, kind: 'book', sourceRecord: { sourceId, externalId: { provider: 'creator', kind: 'feed_item_id', value: 'book-1' }, observedAt: new Date().toISOString(), metadata: { title: 'First Book' } }, externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'book-1' }], mediaAssetIds: [] });
      inventory.revision++; return json({ revision: inventory.revision, created: 1, updated: 0, unchanged: 0 });
    }
    if (url.endsWith(`/items/${itemId}`) && method === 'PUT') {
      const record = { ...body.record, id: itemId, creatorAccountId: owner, projectId };
      inventory.items[0] = record; inventory.revision++; return json({ revision: inventory.revision, record });
    }
    if (url.endsWith('/collections') && method === 'POST') {
      const record = { ...body.record, id: `col_${'e'.repeat(32)}`, creatorAccountId: owner, projectId };
      inventory.collections.push(record); inventory.revision++; return json({ revision: inventory.revision, record }, 201);
    }
    throw new Error(`Unexpected ${method} ${url}`);
  }) as typeof fetch;
  try {
    render(createElement(Catalog, { projectId, accountId: owner, hosted: true }));
    await screen.findByRole('heading', { name: 'Build your channel library.' });
    fireEvent.click(await screen.findByText('Import or enter other catalog content'));
    fireEvent.change(await screen.findByRole('combobox', { name: 'Creator type' }), { target: { value: 'writing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
    await waitFor(() => assert.equal(inventory.sources.length, 1));
    assert.equal(inventory.sources[0].type, 'creator_csv');
    const file = Object.assign(new dom.window.File(['externalId,kind,title\nbook-1,book,First Book'], 'books.csv', { type: 'text/csv' }), { text: async () => 'externalId,kind,title\nbook-1,book,First Book' });
    fireEvent.change(screen.getByLabelText(/CATALOG FILE/), { target: { files: [file] } });
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Preview import' }) as HTMLButtonElement).disabled, false));
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    await screen.findByText(/Line 2: create · book · First Book/);
    fireEvent.click(screen.getByRole('button', { name: 'Approve snapshot' }));
    await waitFor(() => assert.equal(inventory.items.length, 1));
    assert.equal(inventory.items[0].mediaAssetIds.length, 0);
    fireEvent.change(screen.getByRole('combobox', { name: 'Select catalog item' }), { target: { value: itemId } });
    fireEvent.click(screen.getByText('Edit selected item metadata'));
    fireEvent.change(screen.getByLabelText('CREATOR TITLE OVERRIDE'), { target: { value: 'My Edition' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save override' }));
    await waitFor(() => assert.equal(inventory.items[0].creatorOverrides?.title, 'My Edition'));
    assert.equal(inventory.items[0].sourceRecord.metadata.title, 'First Book');
    fireEvent.click(screen.getByText('Manage collections (optional)'));
    fireEvent.change(screen.getByLabelText('COLLECTION NAME'), { target: { value: 'Bookshelf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Collection' }));
    await waitFor(() => assert.equal(inventory.collections.length, 1));
    assert.deepEqual(inventory.collections[0].itemIds, [itemId]);
    assert.equal(inventory.collections[0].kind, 'bookshelf');
    assert.ok(calls.some(call => call.url.endsWith('/imports/approve') && call.body.fingerprint === 'f'.repeat(64) && call.body.expectedRevision === 1));
  } finally { cleanup(); globalThis.fetch = previous; }
});

test('catalog API sends session CSRF and preview receipt; server errors remain visible', async () => {
  const previous = globalThis.fetch;
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url === '/api/auth/session') return json({ accountId: owner, email: 'owner@example.com', csrfToken: 'csrf', expiresAt: '2099-01-01T00:00:00Z' });
    if (url.endsWith('/imports/feed-preview')) return json({ sourceId, format: 'feed', revision: 3, fingerprint: 'a'.repeat(64), content: '[]', rows: [], issues: [] });
    if (url.endsWith('/imports/feed-approve')) return json({ revision: 3, created: 0, updated: 0, unchanged: 0 });
    if (url.endsWith('/sources')) return json({ error: { message: 'Catalog revision changed' } }, 409);
    throw new Error(url);
  }) as typeof fetch;
  try {
    await getSession();
    const preview = await previewCatalogImport(projectId, sourceId, 'feed');
    await approveCatalogImport(projectId, preview, preview.content!);
    await assert.rejects(writeCatalog(projectId, 'sources', 3, { schemaVersion: 1 }), /Catalog revision changed/);
    assert.ok(calls.slice(1).every(call => (call.init?.headers as Record<string, string>)['x-csrf-token'] === 'csrf'));
    assert.deepEqual(JSON.parse(String(calls[2]!.init?.body)), { sourceId, content: '[]', expectedRevision: 3, fingerprint: 'a'.repeat(64) });
  } finally { globalThis.fetch = previous; }
});

test('private media upload stays scoped and rejects oversized input before a request', async () => {
  const previous = globalThis.fetch;
  const calls: { url: string; body: any }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return json({ id: `ma_${'e'.repeat(32)}`, contentType: 'image/png' }, 201);
  }) as typeof fetch;
  try {
    const png = new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], 'cover.png', { type: 'image/png' });
    const uploaded = await uploadPrivateMedia(projectId, png);
    assert.match(uploaded.id, /^ma_/);
    assert.equal(calls[0]?.url, `/api/projects/${projectId}/private-objects`);
    assert.deepEqual(Object.keys(calls[0]!.body).sort(), ['contentBase64', 'contentType', 'kind']);
    await assert.rejects(uploadPrivateMedia(projectId, new File([new Uint8Array(1_000_001)], 'huge.png', { type: 'image/png' })), /under 1 MB/);
    assert.equal(calls.length, 1);
  } finally { globalThis.fetch = previous; }
});

test('Studio file preview belongs to its source and rejects a later oversized file', async () => {
  const previous = globalThis.fetch;
  const otherSourceId = `src_${'e'.repeat(32)}`;
  const inventory = base();
  inventory.sources = [sourceId, otherSourceId].map(id => ({ schemaVersion: 1, id, creatorAccountId: owner, projectId,
    type: 'creator_csv', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } }));
  globalThis.fetch = (async input => {
    assert.equal(String(input), `/api/projects/${projectId}/catalog`);
    return json(inventory);
  }) as typeof fetch;
  try {
    render(createElement(Catalog, { projectId, accountId: owner, hosted: true }));
    const sourceSelect = await screen.findByRole('combobox', { name: 'Select source' });
    fireEvent.change(sourceSelect, { target: { value: sourceId } });
    const valid = Object.assign(new dom.window.File(['externalId,kind,title\na,audio,Episode'], 'audio.csv', { type: 'text/csv' }),
      { text: async () => 'externalId,kind,title\na,audio,Episode' });
    fireEvent.change(screen.getByLabelText(/CATALOG FILE/), { target: { files: [valid] } });
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Preview import' }) as HTMLButtonElement).disabled, false));
    fireEvent.change(sourceSelect, { target: { value: otherSourceId } });
    assert.equal((screen.getByRole('button', { name: 'Preview import' }) as HTMLButtonElement).disabled, true);
    fireEvent.change(screen.getByLabelText(/CATALOG FILE/), { target: { files: [valid] } });
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Preview import' }) as HTMLButtonElement).disabled, false));
    const oversized = new dom.window.File([new Uint8Array(512_001)], 'large.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText(/CATALOG FILE/), { target: { files: [oversized] } });
    assert.equal((screen.getByRole('button', { name: 'Preview import' }) as HTMLButtonElement).disabled, true);
    assert.match(screen.getByRole('alert').textContent ?? '', /exceeds 512 KB/);
  } finally { cleanup(); globalThis.fetch = previous; }
});

test('library cards keep artwork provenance, rights truth and image fallback', async () => {
  const previous = globalThis.fetch;
  const inventory = base();
  const videoId = `ci_${'e'.repeat(32)}`;
  const identifier = (value: string) => ({ provider: 'creator', kind: 'feed_item_id', value });
  const common = { schemaVersion: 1, creatorAccountId: owner, projectId };
  const sourceRecord = (value: string, title: string, artworkUrl: string) => ({ sourceId, externalId: identifier(value), observedAt: new Date().toISOString(), metadata: { title, artworkUrl } });
  inventory.sources = [{ ...common, id: sourceId, type: 'creator_upload', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } }];
  inventory.items = [
    { ...common, id: itemId, kind: 'video', creatorOverrides: { title: 'Creator cut', artworkUrl: 'https://art.example/creator.jpg', editedAt: new Date().toISOString() }, sourceRecord: sourceRecord('film-1', 'Source cut', 'https://art.example/source.jpg'), externalIdentifiers: [identifier('film-1')], mediaAssetIds: [`ma_${'f'.repeat(32)}`, `ma_${'6'.repeat(32)}`, `ma_${'7'.repeat(32)}`] },
    { ...common, id: videoId, kind: 'video', sourceRecord: sourceRecord('film-2', 'Private film', 'https://bucket.s3.amazonaws.com/private.jpg'), externalIdentifiers: [identifier('film-2')], mediaAssetIds: [`ma_${'9'.repeat(32)}`] }
  ];
  inventory.collections = [{ schemaVersion: 1, creatorAccountId: owner, projectId, id: `col_${'f'.repeat(32)}`, title: 'Films', kind: 'series', itemIds: [itemId] }];
  inventory.mediaAssets = [
    { schemaVersion: 1, creatorAccountId: owner, projectId, id: `ma_${'f'.repeat(32)}`, catalogItemId: itemId, kind: 'video', location: { type: 'managed_hls' }, deliveryEligible: false, tvDisplayRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt: new Date().toISOString() }, tvPlaybackRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_playback', assertedAt: new Date().toISOString() } },
    { schemaVersion: 1, creatorAccountId: owner, projectId, id: `ma_${'6'.repeat(32)}`, catalogItemId: itemId, kind: 'artwork', location: { type: 'https', url: 'https://art.example/old.jpg' }, deliveryEligible: true, tvDisplayRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt: new Date().toISOString() }, tvPlaybackRights: { status: 'unknown', basis: 'none', permittedUse: 'none' } },
    { schemaVersion: 1, creatorAccountId: owner, projectId, id: `ma_${'7'.repeat(32)}`, catalogItemId: itemId, kind: 'artwork', location: { type: 'private_object', objectId: `ma_${'5'.repeat(32)}` }, deliveryEligible: false, tvDisplayRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt: new Date().toISOString() }, tvPlaybackRights: { status: 'unknown', basis: 'none', permittedUse: 'none' } },
    { schemaVersion: 1, creatorAccountId: owner, projectId, id: `ma_${'9'.repeat(32)}`, catalogItemId: videoId, kind: 'artwork', location: { type: 'private_object', objectId: `ma_${'8'.repeat(32)}` }, deliveryEligible: false, tvDisplayRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt: new Date().toISOString() }, tvPlaybackRights: { status: 'unknown', basis: 'none', permittedUse: 'none' } }
  ];
  globalThis.fetch = (async input => {
    if (String(input) === `/api/projects/${projectId}/catalog`) return json(inventory);
    return json({ uploadId: null, uploadState: null, processingAvailable: false, processing: null });
  }) as typeof fetch;
  try {
    render(createElement(Catalog, { projectId, accountId: owner, hosted: true }));
    const creator = await screen.findByRole('button', { name: 'Select Creator cut · video' });
    assert.equal(creator.querySelector('img')?.getAttribute('src'), 'https://art.example/creator.jpg');
    assert.match(creator.textContent ?? '', /Private artwork saved · publication review required/);
    assert.match(creator.textContent ?? '', /video · Films/);
    assert.match(creator.textContent ?? '', /TV display cleared · playback cleared/);
    const privateFilm = screen.getByRole('button', { name: 'Select Private film · video' });
    assert.equal(privateFilm.querySelector('img'), null, 'private S3 artwork is never fetched');
    assert.match(privateFilm.textContent ?? '', /Private artwork saved · publication review required/);
    fireEvent.error(creator.querySelector('img')!);
    assert.equal(creator.querySelector('img'), null);
    assert.ok(creator.querySelector('[aria-label="Artwork unavailable"]'));
  } finally { cleanup(); globalThis.fetch = previous; }
});
