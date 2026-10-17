import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@firelaunch/channel-engine';
import { getSession, readVideoAssetStatus } from '../src/api.js';
import { validateVideoFile, uploadVideo } from '../src/video-upload.js';
import { LivePublication } from '../src/LivePublication.js';
import { NewVideoUpload, VideoUpload, videoProcessingMessage } from '../src/VideoUpload.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const id = (prefix: string, char: string) => `${prefix}_${char.repeat(32)}`;
const projectId = id('ch', 'a'), assetId = id('ma', 'b'), itemId = id('ci', 'c'), owner = id('cr', 'd'), uploadId = id('up', 'e');
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('MP4 type, filename and bounded size are checked before any request', () => {
  assert.throws(() => validateVideoFile(new File(['x'], 'a.mov', { type: 'video/quicktime' })), /MP4/);
  assert.throws(() => validateVideoFile(new File(['x'], '../bad.mp4', { type: 'video/mp4' })), /MP4/);
  const huge = new File(['x'], 'good.mp4', { type: 'video/mp4' });
  Object.defineProperty(huge, 'size', { value: 250_000_001 });
  assert.throws(() => validateVideoFile(huge), /250 MB/);
});

test('managed progress, failure, private ready state and legacy status have clear copy', () => {
  const base = { id: uploadId, state: 'verified', verification: 'sha256_verified', expectedBytes: 1,
    expiresAt: new Date().toISOString(), partSize: 1, partCount: 1 } as const;
  assert.match(videoProcessingMessage({ ...base, processing: { state: 'pending', failureCode: null } }), /private/);
  assert.match(videoProcessingMessage({ ...base, processing: { state: 'failed', failureCode: 'verification_failed' } }), /Retry processing/);
  assert.match(videoProcessingMessage({ ...base, processing: { state: 'ready', failureCode: null } }), /separate approval/);
  assert.match(videoProcessingMessage({ ...base, processing: { state: 'leased', failureCode: null } }), /Legacy/);
});

test('multipart failure aborts server session and retry creates a fresh session; CSRF stays on control calls', async () => {
  const previousFetch = globalThis.fetch;
  const previousXHR = globalThis.XMLHttpRequest;
  const calls: { url: string; method: string; csrf: string | undefined }[] = [];
  let starts = 0;
  class FakeXHR {
    status = 403; upload = { onprogress: (_event: ProgressEvent) => {} };
    onload = () => {}; onerror = () => {}; onabort = () => {};
    open(method: string, url: string) { assert.equal(method, 'PUT'); assert.match(url, /^https:\/\/s3\.example/); }
    set withCredentials(value: boolean) { assert.equal(value, false); }
    getResponseHeader() { return null; }
    send() { queueMicrotask(() => this.onload()); }
    abort() { this.onabort(); }
  }
  globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    calls.push({ url, method, csrf: new Headers(init?.headers).get('x-csrf-token') ?? undefined });
    if (url === '/api/auth/session') return json({ accountId: owner, email: 'creator@example.test', csrfToken: 'csrf-proof', expiresAt: new Date().toISOString() });
    if (url.endsWith('/media-uploads') && method === 'POST') { starts++; return json({ id: uploadId, state: 'initiated', partSize: 8_388_608, partCount: 1, expiresAt: new Date(Date.now() + 300000).toISOString() }, 201); }
    if (url.endsWith('/part')) return starts === 1 ? json({ error: { message: 'Upload session unavailable or expired' } }, 409)
      : json({ url: 'https://s3.example/part', contentLength: 1, expiresInSeconds: 300 });
    if (url.endsWith('/abort')) return json({ id: uploadId, state: 'aborted' });
    throw new Error(url);
  }) as typeof fetch;
  try {
    await getSession();
    const file = new File(['x'], 'video.mp4', { type: 'video/mp4' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([120]).buffer });
    await assert.rejects(uploadVideo(projectId, assetId, file, 1, new AbortController().signal, () => {}, () => {}), /expired/);
    await assert.rejects(uploadVideo(projectId, assetId, file, 1, new AbortController().signal, () => {}, () => {}), /part failed/);
    assert.equal(starts, 2);
    assert.equal(calls.filter(call => call.url.endsWith('/abort')).length, 2);
    assert.ok(calls.filter(call => call.method === 'POST').every(call => call.csrf === 'csrf-proof'));
  } finally { globalThis.fetch = previousFetch; globalThis.XMLHttpRequest = previousXHR; }
});

test('foreign status error is exposed without leaking a signed upload URL', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => json({ error: { message: 'Media asset not found' } }, 404)) as typeof fetch;
  try { await assert.rejects(readVideoAssetStatus(projectId, assetId), /Media asset not found/); }
  finally { globalThis.fetch = previous; }
});

test('video picker attaches to the selected item and reports completed but unverified processing without publishing', async () => {
  const previousFetch = globalThis.fetch, previousXHR = globalThis.XMLHttpRequest;
  const item = { id: itemId, kind: 'video', mediaAssetIds: [] } as any;
  const inventory = { revision: 1, mediaAssets: [] } as any;
  const calls: string[] = [];
  class GoodXHR {
    status = 200; upload = { onprogress: (_event: ProgressEvent) => {} };
    onload = () => {}; onerror = () => {}; onabort = () => {};
    open() {} set withCredentials(value: boolean) { assert.equal(value, false); }
    getResponseHeader() { return 'a'.repeat(32); }
    send() { queueMicrotask(() => this.onload()); }
    abort() { this.onabort(); }
  }
  globalThis.XMLHttpRequest = GoodXHR as unknown as typeof XMLHttpRequest;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); calls.push(url);
    if (url.endsWith('/media-assets')) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.record.catalogItemId, itemId);
      assert.equal(body.record.location.type, 'managed_hls');
      assert.equal(body.record.tvDisplayRights.status, 'cleared');
      return json({ revision: 2, record: { ...body.record, id: assetId } }, 201);
    }
    if (url.endsWith('/media-uploads') && init?.method === 'POST') return json({ id: uploadId, state: 'initiated', partSize: 8_388_608, partCount: 1, expiresAt: new Date(Date.now() + 300000).toISOString() }, 201);
    if (url.endsWith('/part')) return json({ url: 'https://s3.example/part', contentLength: 1, expiresInSeconds: 300 });
    if (url.endsWith('/finalize')) return json({ id: uploadId, state: 'completed', verification: 'pending_sha256', processing: null });
    if (url.endsWith('/media-uploads') && init?.method !== 'POST') return json({ uploadId, uploadState: 'completed', processing: null });
    if (url.endsWith(`/${uploadId}`)) return json({ id: uploadId, state: 'completed', verification: 'pending_sha256', processing: null });
    throw new Error(url);
  }) as typeof fetch;
  try {
    render(createElement(VideoUpload, { projectId, item, inventory, refresh: async () => inventory }));
    const file = new File(['x'], 'video.mp4', { type: 'video/mp4' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([120]).buffer });
    fireEvent.change(screen.getByLabelText(/VIDEO FILE/), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/APPROXIMATE DURATION/), { target: { value: '12' } });
    assert.equal((screen.getByRole('button', { name: 'Upload video master' }) as HTMLButtonElement).disabled, true);
    fireEvent.click(screen.getByLabelText(/I have television display rights/));
    fireEvent.click(screen.getByLabelText(/I have television playback rights/));
    fireEvent.click(screen.getByRole('button', { name: 'Upload video master' }));
    await screen.findByText(/awaiting source verification/);
    assert.match(screen.getByRole('status').textContent ?? '', /Unavailable for live publication/);
    assert.equal(calls.some(url => url.endsWith('/publish')), false);
  } finally { cleanup(); globalThis.fetch = previousFetch; globalThis.XMLHttpRequest = previousXHR; }
});

test('new video drop creates one private draft and retries the same item after upload failure', async () => {
  const previousFetch = globalThis.fetch, previousXHR = globalThis.XMLHttpRequest;
  const sourceId = id('src', 'f');
  const collectionId = id('col', '1');
  const inventory = { revision: 1, sources: [], items: [], mediaAssets: [], collections: [
    { id: collectionId, title: 'Films', itemIds: [], kind: 'series' }
  ] } as any;
  const counts = { source: 0, item: 0, asset: 0, upload: 0, collection: 0 };
  let failPart = true;
  class GoodXHR {
    status = 200; upload = { onprogress: (_event: ProgressEvent) => {} };
    onload = () => {}; onerror = () => {}; onabort = () => {};
    open() {} set withCredentials(value: boolean) { assert.equal(value, false); }
    getResponseHeader() { return 'a'.repeat(32); }
    send() { queueMicrotask(() => this.onload()); }
    abort() { this.onabort(); }
  }
  globalThis.XMLHttpRequest = GoodXHR as unknown as typeof XMLHttpRequest;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.endsWith('/catalog/sources')) { counts.source++; inventory.sources.push({ id: sourceId, ...body.record }); return json({ revision: ++inventory.revision, record: inventory.sources[0] }, 201); }
    if (url.endsWith('/catalog/items')) { counts.item++; assert.equal(body.record.sourceRecord.metadata.title, 'My film');
      inventory.items.push({ id: itemId, ...body.record }); return json({ revision: ++inventory.revision, record: inventory.items[0] }, 201); }
    if (url.endsWith(`/catalog/collections/${collectionId}`)) { counts.collection++; inventory.collections[0].itemIds = body.record.itemIds; return json({ revision: ++inventory.revision, record: inventory.collections[0] }); }
    if (url.endsWith('/catalog/media-assets')) { counts.asset++; assert.equal(body.record.deliveryEligible, true);
      inventory.mediaAssets.push({ id: assetId, ...body.record }); return json({ revision: ++inventory.revision, record: inventory.mediaAssets[0] }, 201); }
    if (url.endsWith('/media-uploads') && init?.method === 'POST') { counts.upload++; return json({ id: uploadId, state: 'initiated', partSize: 8_388_608, partCount: 1, expiresAt: new Date(Date.now() + 300000).toISOString() }, 201); }
    if (url.endsWith('/part')) return failPart ? json({ error: { message: 'Temporary upload error' } }, 503) : json({ url: 'https://s3.example/part', contentLength: 1, expiresInSeconds: 300 });
    if (url.endsWith('/abort')) return json({ id: uploadId, state: 'aborted' });
    if (url.endsWith('/finalize')) return json({ id: uploadId, state: 'completed', verification: 'pending_sha256', processing: null });
    throw new Error(url);
  }) as typeof fetch;
  try {
    const created: string[] = [];
    render(createElement(NewVideoUpload, { projectId, inventory, refresh: async () => inventory, onCreated: id => created.push(id), onClose: () => {} }));
    const file = new File(['x'], 'my-film.mp4', { type: 'video/mp4' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([120]).buffer });
    fireEvent.drop(screen.getByText('Drop an MP4 here'), { dataTransfer: { files: [file] } });
    fireEvent.change(screen.getByLabelText('TITLE *'), { target: { value: 'My film' } });
    fireEvent.change(screen.getByLabelText(/APPROXIMATE DURATION/), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('CATEGORY / COLLECTION'), { target: { value: collectionId } });
    fireEvent.click(screen.getByLabelText(/television display rights/));
    fireEvent.click(screen.getByLabelText(/television playback rights/));
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText('Temporary upload error');
    assert.deepEqual(created, [itemId]);
    assert.deepEqual(counts, { source: 1, item: 1, asset: 1, upload: 1, collection: 1 });
    failPart = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry upload' }));
    await screen.findByText(/awaiting source verification/);
    assert.deepEqual(counts, { source: 1, item: 1, asset: 1, upload: 2, collection: 1 });
  } finally { cleanup(); globalThis.fetch = previousFetch; globalThis.XMLHttpRequest = previousXHR; }
});

test('new video requires title, duration and rights before creating catalog records', async () => {
  const previous = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => { requests++; throw new Error('Unexpected request'); }) as typeof fetch;
  try {
    render(createElement(NewVideoUpload, { projectId, inventory: { revision: 0, sources: [], items: [], mediaAssets: [], collections: [] } as any,
      refresh: async () => { throw new Error('Unexpected refresh'); }, onCreated: () => {}, onClose: () => {} }));
    const file = new File(['x'], 'film.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('Choose video file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText('Enter a video title.');
    fireEvent.change(screen.getByLabelText('TITLE *'), { target: { value: 'Film' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText(/Enter a duration/);
    fireEvent.change(screen.getByLabelText(/APPROXIMATE DURATION/), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText(/Confirm both television/);
    assert.equal(requests, 0);
  } finally { cleanup(); globalThis.fetch = previous; }
});

test('failed video offers an explicit CSRF-bound processing retry without another upload', async () => {
  const previous = globalThis.fetch;
  const item = { id: itemId, kind: 'video', mediaAssetIds: [assetId] } as any;
  const inventory = { revision: 1, mediaAssets: [{ id: assetId, catalogItemId: itemId,
    kind: 'video', location: { type: 'managed_hls' } }] } as any;
  let retries = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/session') return json({ accountId: owner, email: 'creator@example.test',
      csrfToken: 'csrf-proof', expiresAt: new Date().toISOString() });
    if (url.endsWith('/retry')) {
      assert.equal(new Headers(init?.headers).get('x-csrf-token'), 'csrf-proof');
      assert.deepEqual(JSON.parse(String(init?.body)), { mediaAssetId: assetId });
      retries++;
      return json({ id: uploadId, state: 'verified', verification: 'sha256_verified',
        processing: { state: 'pending', failureCode: null } });
    }
    if (url.endsWith('/media-uploads')) return json({ uploadId, uploadState: 'verified',
      processing: { state: 'failed', failureCode: 'encode_failed' } });
    if (url.endsWith(`/${uploadId}`)) return json({ id: uploadId, state: 'verified',
      verification: 'sha256_verified', processing: { state: 'failed', failureCode: 'encode_failed' } });
    throw new Error(url);
  }) as typeof fetch;
  try {
    await getSession();
    render(createElement(VideoUpload, { projectId, item, inventory, refresh: async () => inventory }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry processing' }));
    await screen.findByText(/queued or running/);
    assert.equal(retries, 1);
  } finally { cleanup(); globalThis.fetch = previous; }
});

test('managed HLS remains unavailable for publication while processing, then requires explicit approval', async () => {
  const previous = globalThis.fetch;
  let processing: 'pending' | 'ready' = 'pending';
  const contentId = id('item', 'f');
  const spec = starterChannel('Film', projectId, id('page', '1'));
  const project = { id: projectId, revision: 2, spec: { ...spec, content: [{ id: contentId, title: 'Film', description: '', artwork: 'https://cdn.example/art.png', mediaUrl: 'https://cdn.example/master.m3u8' }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const rights = (use: string) => ({ status: 'cleared', basis: 'creator_asserted', permittedUse: use, assertedAt: new Date().toISOString() });
  const artId = id('ma', '9');
  const item = { schemaVersion: 1, id: itemId, creatorAccountId: owner, projectId, kind: 'video', sourceRecord: { sourceId: id('src', '8'), externalId: { provider: 'creator', kind: 'feed_item_id', value: 'film' }, observedAt: new Date().toISOString(), metadata: { title: 'Film' } }, externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'film' }], mediaAssetIds: [artId, assetId] };
  const base = { schemaVersion: 1, creatorAccountId: owner, projectId, catalogItemId: itemId, tvDisplayRights: rights('television_display'), tvPlaybackRights: rights('television_playback'), deliveryEligible: true };
  const catalog = { schemaVersion: 1, creatorAccountId: owner, projectId, revision: 4, sources: [{ schemaVersion: 1, id: id('src', '8'), creatorAccountId: owner, projectId, type: 'creator_upload', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } }], collections: [], items: [item], mediaAssets: [{ ...base, id: artId, kind: 'artwork', location: { type: 'https', url: 'https://cdn.example/art.png' } }, { ...base, id: assetId, kind: 'video', location: { type: 'managed_hls' } }] };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/deployment')) return json({ schemaVersion: 1, id: id('dep', '7'), creatorAccountId: owner, projectId, channelId: projectId, appName: 'Film', packageId: 'com.example.film', releaseControl: 'creator', nativeReleaseApproval: 'pending_creator', consoleEvidence: { state: 'none' } });
    if (url.endsWith('/catalog')) return json(catalog);
    if (url.endsWith('/media-uploads')) return json({ uploadId, uploadState: 'verified', processing: { state: processing, failureCode: null } });
    if (url.endsWith('/status')) return json({ revisions: { channel: 2, catalog: 4 }, liveReleaseId: null, liveSequence: 0, approvalRequired: true, nativeSubmission: 'separate' });
    if (url.endsWith('/history')) return json({ liveReleaseId: null, releases: [] });
    throw new Error(url);
  }) as typeof fetch;
  try {
    render(createElement(LivePublication, { project, hosted: true }));
    await screen.findByText('No live releases yet.');
    fireEvent.change(screen.getByLabelText('Reviewed catalog item'), { target: { value: itemId } });
    assert.equal(screen.queryByRole('option', { name: assetId }), null);
    assert.equal((screen.getByRole('button', { name: 'Approve draft for live review' }) as HTMLButtonElement).disabled, true);
    processing = 'ready';
    fireEvent.click(screen.getByRole('button', { name: 'Refresh live state and rights' }));
    await waitFor(() => assert.ok(screen.getByRole('option', { name: assetId })));
    assert.equal((screen.getByRole('button', { name: 'Approve draft for live review' }) as HTMLButtonElement).disabled, true);
  } finally { cleanup(); globalThis.fetch = previous; }
});
