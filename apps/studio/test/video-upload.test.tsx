import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { getSession } from '../src/api.js';
import { extractVideoThumbnail, titleFromFilename, validateVideoFile, readVideoDuration } from '../src/video-upload.js';
import { NewVideoUpload, videoProcessingMessage } from '../src/VideoUpload.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const id = (prefix: string, char: string) => `${prefix}_${char.repeat(32)}`;
const projectId = id('ch', 'a'), assetId = id('ma', 'b'), itemId = id('ci', 'c'), owner = id('cr', 'd'), uploadId = id('up', 'e');
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

function mockDuration(seconds = 12) {
  const priorCreate = URL.createObjectURL, priorRevoke = URL.revokeObjectURL;
  const priorLoad = dom.window.HTMLMediaElement.prototype.load;
  const priorDuration = Object.getOwnPropertyDescriptor(dom.window.HTMLMediaElement.prototype, 'duration');
  URL.createObjectURL = () => 'blob:https://studio.example/video'; URL.revokeObjectURL = () => {};
  dom.window.HTMLMediaElement.prototype.load = () => {};
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'duration', { configurable: true, get: () => seconds });
  const priorSrc = Object.getOwnPropertyDescriptor(dom.window.HTMLMediaElement.prototype, 'src');
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'src', { configurable: true, set() { queueMicrotask(() => this.dispatchEvent(new dom.window.Event('loadedmetadata'))); } });
  return () => { URL.createObjectURL = priorCreate; URL.revokeObjectURL = priorRevoke;
    dom.window.HTMLMediaElement.prototype.load = priorLoad;
    if (priorDuration) Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'duration', priorDuration);
    if (priorSrc) Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'src', priorSrc); };
}

const validFile = () => { const file = new File(['x'], 'my-film.mp4', { type: 'video/mp4' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([120]).buffer }); return file; };

test('file constraints and automatic duration keep the existing upload limits', async () => {
  assert.throws(() => validateVideoFile(new File(['x'], 'a.mov', { type: 'video/quicktime' })), /MP4/);
  assert.throws(() => validateVideoFile(new File(['x'], '../bad.mp4', { type: 'video/mp4' })), /MP4/);
  const huge = validFile(); Object.defineProperty(huge, 'size', { value: 250_000_001 });
  assert.throws(() => validateVideoFile(huge), /250 MB/);
  const restore = mockDuration(1801);
  try { await assert.rejects(readVideoDuration(validFile()), /30 minutes/); }
  finally { restore(); }
  assert.equal(titleFromFilename('My_film-final.mp4'), 'My film final');
});

test('supported browser frame extraction yields a bounded private JPEG draft thumbnail', async () => {
  const priorCreate = URL.createObjectURL, priorRevoke = URL.revokeObjectURL;
  const media = dom.window.HTMLMediaElement.prototype, videoProto = dom.window.HTMLVideoElement.prototype, canvas = dom.window.HTMLCanvasElement.prototype;
  const priorLoad = media.load, priorContext = canvas.getContext, priorBlob = canvas.toBlob;
  const keys = ['src', 'currentTime', 'duration'] as const;
  const descriptors = keys.map(key => Object.getOwnPropertyDescriptor(media, key));
  const widthDescriptor = Object.getOwnPropertyDescriptor(videoProto, 'videoWidth');
  const heightDescriptor = Object.getOwnPropertyDescriptor(videoProto, 'videoHeight');
  URL.createObjectURL = () => 'blob:https://studio.example/thumbnail'; URL.revokeObjectURL = () => {};
  media.load = () => {};
  Object.defineProperty(media, 'duration', { configurable: true, get: () => 12 });
  Object.defineProperty(videoProto, 'videoWidth', { configurable: true, get: () => 1920 });
  Object.defineProperty(videoProto, 'videoHeight', { configurable: true, get: () => 1080 });
  Object.defineProperty(media, 'src', { configurable: true, set() { queueMicrotask(() => this.dispatchEvent(new dom.window.Event('loadeddata'))); } });
  Object.defineProperty(media, 'currentTime', { configurable: true, set() { queueMicrotask(() => this.dispatchEvent(new dom.window.Event('seeked'))); } });
  canvas.getContext = (() => ({ drawImage() {} })) as unknown as typeof canvas.getContext;
  canvas.toBlob = callback => callback(new Blob(['jpeg'], { type: 'image/jpeg' }));
  try {
    const frame = await extractVideoThumbnail(validFile());
    assert.equal(frame?.type, 'image/jpeg');
    assert.equal(frame?.name, 'video-thumbnail.jpg');
    assert.ok(frame && frame.size <= 1_000_000);
  } finally {
    URL.createObjectURL = priorCreate; URL.revokeObjectURL = priorRevoke; media.load = priorLoad;
    canvas.getContext = priorContext; canvas.toBlob = priorBlob;
    keys.forEach((key, index) => { if (descriptors[index]) Object.defineProperty(media, key, descriptors[index]); else delete (media as unknown as Record<string, unknown>)[key]; });
    if (widthDescriptor) Object.defineProperty(videoProto, 'videoWidth', widthDescriptor);
    if (heightDescriptor) Object.defineProperty(videoProto, 'videoHeight', heightDescriptor);
  }
});

test('Add Video has one unchecked rights confirmation, filename title, optional fields and default Videos category', () => {
  render(createElement(NewVideoUpload, { projectId, inventory: { revision: 0, sources: [], items: [], mediaAssets: [], collections: [] } as any,
    refresh: async () => { throw new Error('No request expected'); }, onCreated: () => {}, onClose: () => {} }));
  try {
    assert.equal(screen.getAllByRole('checkbox').length, 1);
    assert.equal((screen.getByRole('checkbox') as HTMLInputElement).checked, false);
    assert.equal((screen.getByLabelText('Category') as HTMLSelectElement).value, '');
    assert.equal(screen.getByRole('option', { name: 'Videos' }).textContent, 'Videos');
    fireEvent.change(screen.getByLabelText('Video file'), { target: { files: [validFile()] } });
    assert.equal((screen.getByLabelText('Title *') as HTMLInputElement).value, 'my film');
    assert.ok(screen.getByLabelText('Description (optional)'));
    assert.ok(screen.getByLabelText('Custom thumbnail (optional)'));
    assert.equal(screen.queryByLabelText(/Approximate duration/i), null);
  } finally { cleanup(); }
});

test('missing file, empty title and rights prevent catalog creation', async () => {
  let requests = 0;
  const priorFetch = globalThis.fetch;
  globalThis.fetch = (async () => { requests++; throw new Error('Unexpected request'); }) as typeof fetch;
  render(createElement(NewVideoUpload, { projectId, inventory: { revision: 0, sources: [], items: [], mediaAssets: [], collections: [] } as any,
    refresh: async () => { throw new Error('Unexpected refresh'); }, onCreated: () => {}, onClose: () => {} }));
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText('Choose an MP4 video.');
    fireEvent.change(screen.getByLabelText('Video file'), { target: { files: [validFile()] } });
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText('Enter a video title.');
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Film' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText(/Confirm your television display/);
    assert.equal(requests, 0);
  } finally { cleanup(); globalThis.fetch = priorFetch; }
});

test('private video draft links one item and asset; failed part retries without duplicate records or publication', async () => {
  const restoreDuration = mockDuration();
  const previousFetch = globalThis.fetch, previousXHR = globalThis.XMLHttpRequest;
  const sourceId = id('src', 'f'), collectionId = id('col', '1'), videosId = id('col', '2');
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
    if (url === '/api/auth/session') return json({ accountId: owner, email: 'creator@example.test', csrfToken: 'csrf-proof', expiresAt: new Date().toISOString() });
    if (url.endsWith('/catalog/sources')) { counts.source++; inventory.sources.push({ id: sourceId, ...body.record }); return json({ revision: ++inventory.revision, record: inventory.sources[0] }, 201); }
    if (url.endsWith('/catalog/items')) { counts.item++; assert.equal(body.record.sourceRecord.metadata.description, 'A short description.');
      inventory.items.push({ id: itemId, ...body.record, mediaAssetIds: [] }); return json({ revision: ++inventory.revision, record: inventory.items[0] }, 201); }
    if (url.endsWith('/catalog/collections') && init?.method === 'POST') { counts.collection++;
      assert.equal(body.record.title, 'Videos'); assert.equal(body.record.kind, 'series');
      const record = { id: videosId, ...body.record }; inventory.collections.push(record);
      return json({ revision: ++inventory.revision, record }, 201); }
    if (url.endsWith(`/catalog/collections/${collectionId}`)) { counts.collection++; inventory.collections[0].itemIds = body.record.itemIds;
      return json({ revision: ++inventory.revision, record: inventory.collections[0] }); }
    if (url.endsWith(`/catalog/collections/${videosId}`)) { counts.collection++; inventory.collections[1].itemIds = body.record.itemIds;
      return json({ revision: ++inventory.revision, record: inventory.collections[1] }); }
    if (url.endsWith('/catalog/media-assets')) { counts.asset++; assert.equal(body.record.tvDisplayRights.status, 'cleared'); assert.equal(body.record.tvPlaybackRights.status, 'cleared');
      inventory.mediaAssets.push({ id: assetId, ...body.record }); return json({ revision: ++inventory.revision, record: inventory.mediaAssets[0] }, 201); }
    if (url.endsWith('/media-uploads') && init?.method === 'POST') { counts.upload++; assert.equal(body.claimedDurationSeconds, 12);
      assert.equal(new Headers(init.headers).get('x-csrf-token'), 'csrf-proof');
      return json({ id: uploadId, state: 'initiated', partSize: 8_388_608, partCount: 1, expiresAt: new Date(Date.now() + 300000).toISOString() }, 201); }
    if (url.endsWith('/part')) return failPart ? json({ error: { message: 'Temporary upload error' } }, 503) : json({ url: 'https://s3.example/part', contentLength: 1, expiresInSeconds: 300 });
    if (url.endsWith('/abort')) return json({ id: uploadId, state: 'aborted' });
    if (url.endsWith('/finalize')) return json({ id: uploadId, state: 'completed', verification: 'pending_sha256', processingAvailable: false, processing: null });
    if (url.endsWith('/media-uploads')) return json({ uploadId, uploadState: 'completed', processingAvailable: false, processing: null });
    if (url.endsWith(`/${uploadId}`)) return json({ id: uploadId, state: 'completed', processingAvailable: false, processing: null });
    throw new Error(url);
  }) as typeof fetch;
  try {
    await getSession();
    const created: string[] = [];
    render(createElement(NewVideoUpload, { projectId, inventory, refresh: async () => inventory, onCreated: id => created.push(id), onClose: () => {} }));
    fireEvent.change(screen.getByLabelText('Video file'), { target: { files: [validFile()] } });
    fireEvent.change(screen.getByLabelText('Description (optional)'), { target: { value: 'A short description.' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText('Temporary upload error');
    assert.deepEqual(created, [itemId]);
    assert.deepEqual(counts, { source: 1, item: 1, asset: 1, upload: 1, collection: 1 });
    assert.deepEqual(inventory.collections[1].itemIds, [itemId], 'default channel placement survives upload failure');
    failPart = false;
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText(/processing is unavailable here/);
    assert.deepEqual(counts, { source: 1, item: 1, asset: 1, upload: 2, collection: 1 });
    assert.deepEqual(inventory.collections[0].itemIds, []);
    cleanup();
    render(createElement(NewVideoUpload, { projectId, inventory, refresh: async () => inventory, onCreated: id => created.push(id), onClose: () => {} }));
    fireEvent.change(screen.getByLabelText('Video file'), { target: { files: [validFile()] } });
    fireEvent.change(screen.getByLabelText('Description (optional)'), { target: { value: 'A short description.' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: collectionId } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText(/processing is unavailable here/);
    assert.deepEqual(counts, { source: 1, item: 1, asset: 1, upload: 3, collection: 3 });
    assert.deepEqual(inventory.collections[0].itemIds, [itemId]);
    assert.deepEqual(inventory.collections[1].itemIds, [], 'a chosen category replaces the default placement');
    assert.deepEqual(created, [itemId]);
    cleanup();
    render(createElement(NewVideoUpload, { projectId, inventory, refresh: async () => inventory, onCreated: id => created.push(id), onClose: () => {} }));
    fireEvent.change(screen.getByLabelText('Video file'), { target: { files: [validFile()] } });
    fireEvent.change(screen.getByLabelText('Description (optional)'), { target: { value: 'A short description.' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Upload Video' }));
    await screen.findByText(/processing is unavailable here/);
    assert.equal(counts.collection, 3, 'repeat upload preserves the existing custom placement');
    assert.deepEqual(inventory.collections[0].itemIds, [itemId]);
    assert.deepEqual(inventory.collections[1].itemIds, []);
  } finally { cleanup(); restoreDuration(); globalThis.fetch = previousFetch; globalThis.XMLHttpRequest = previousXHR; }
});

test('processing-disabled upload remains private and cannot be labeled ready or published', () => {
  const base = { id: uploadId, state: 'verified', verification: 'sha256_verified', expectedBytes: 1,
    expiresAt: new Date().toISOString(), partSize: 1, partCount: 1 } as const;
  assert.match(videoProcessingMessage({ ...base, processingAvailable: false, processing: null }), /cannot be played or published/);
  assert.match(videoProcessingMessage({ ...base, processing: { state: 'failed', failureCode: 'encode_failed' } }), /Needs attention/);
  assert.match(videoProcessingMessage({ ...base, processing: { state: 'ready', failureCode: null } }), /separate creator approval/);
});

test('later thumbnail replacement stays private, owner-scoped and keeps its artwork asset ID', async () => {
  const oldObject = id('ma', '7'), newObject = id('ma', '8'), artworkId = id('ma', '9');
  const item = { id: itemId, kind: 'video', sourceRecord: { metadata: { title: 'Film' } } } as any;
  const inventory = { revision: 4, sources: [], items: [item], collections: [], mediaAssets: [
    { id: artworkId, catalogItemId: itemId, kind: 'artwork', location: { type: 'private_object', objectId: oldObject },
      schemaVersion: 1, tvDisplayRights: { status: 'cleared' }, tvPlaybackRights: { status: 'unknown' }, deliveryEligible: false }
  ] } as any;
  const previous = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); requests.push(`${init?.method ?? 'GET'} ${url}`);
    if (url === '/api/auth/session') return json({ accountId: owner, email: 'creator@example.test', csrfToken: 'csrf-proof', expiresAt: new Date().toISOString() });
    if (url.endsWith('/private-objects') && init?.method === 'POST') return json({ id: newObject, contentType: 'image/png' }, 201);
    if (url.endsWith(`/media-assets/${artworkId}`) && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body));
      assert.equal(body.record.location.objectId, newObject);
      assert.equal(body.record.deliveryEligible, false);
      assert.equal(body.record.tvDisplayRights.permittedUse, 'television_display');
      assert.equal(body.record.tvPlaybackRights.status, 'unknown');
      assert.equal(new Headers(init.headers).get('x-csrf-token'), 'csrf-proof');
      inventory.mediaAssets[0] = { id: artworkId, ...body.record }; inventory.revision++;
      return json({ revision: inventory.revision, record: inventory.mediaAssets[0] });
    }
    if (url.endsWith(`/private-objects/${oldObject}`) && init?.method === 'DELETE') return json({ deleted: true });
    throw new Error(url);
  }) as typeof fetch;
  try {
    await getSession();
    render(createElement(NewVideoUpload, { projectId, inventory, refresh: async () => inventory,
      existingItem: item, onCreated: () => {}, onClose: () => {} }));
    const thumbnail = new File(['png'], 'cover.png', { type: 'image/png' });
    Object.defineProperty(thumbnail, 'arrayBuffer', { value: async () => new Uint8Array([137, 80, 78, 71]).buffer });
    fireEvent.change(screen.getByLabelText('Custom thumbnail (optional)'), { target: { files: [thumbnail] } });
    assert.equal((screen.getByRole('button', { name: 'Save thumbnail only' }) as HTMLButtonElement).disabled, true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save thumbnail only' }));
    await waitFor(() => assert.ok(requests.some(value => value === `DELETE /api/projects/${projectId}/private-objects/${oldObject}`)));
    assert.equal(inventory.mediaAssets[0].id, artworkId);
    assert.ok(requests.some(value => value === `DELETE /api/projects/${projectId}/private-objects/${oldObject}`));
    assert.equal(requests.some(value => value.includes('media-uploads')), false);
  } finally { cleanup(); globalThis.fetch = previous; }
});
