import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@firelaunch/channel-engine';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { VideoReview } from '../src/VideoReview.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const id = (prefix: string, char: string) => `${prefix}_${char.repeat(32)}`;
const projectId = id('ch', 'a'), owner = id('cr', 'b'), itemId = id('ci', 'c'), assetId = id('ma', 'd'), artId = id('ma', 'e'), sourceId = id('src', 'f'), deploymentId = id('dep', '1');
const contentId = `item_${bytesToHex(sha256(new TextEncoder().encode(`catalog-content-v1\0${itemId}`))).slice(0, 32)}`;
const spec = starterChannel('Films', projectId, id('page', '2'));
const project = { id: projectId, revision: 3, spec: { ...spec, pages: [{ ...spec.pages[0]!, modules: [{ id: id('mod', '3'), kind: 'rail', title: 'Videos', contentIds: [contentId] }] }], content: [{ id: contentId, title: 'Film', description: '', artwork: 'https://cdn.example/film.png', mediaUrl: 'https://cdn.example/master.m3u8', presentation: 'video' }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any;
const item = { schemaVersion: 1, id: itemId, creatorAccountId: owner, projectId, kind: 'video', sourceRecord: { sourceId, externalId: { provider: 'creator', kind: 'upload_id', value: 'a'.repeat(64) }, observedAt: new Date().toISOString(), metadata: { title: 'Film' } }, externalIdentifiers: [], mediaAssetIds: [assetId, artId] } as any;
const source = { schemaVersion: 1, id: sourceId, creatorAccountId: owner, projectId, type: 'creator_upload', state: 'verified', permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted' } };
const rights = (use: string) => ({ status: 'cleared', basis: 'creator_asserted', permittedUse: use, assertedAt: new Date().toISOString() });
const video = { schemaVersion: 1, id: assetId, creatorAccountId: owner, projectId, catalogItemId: itemId, kind: 'video', location: { type: 'managed_hls' }, deliveryEligible: true, tvDisplayRights: rights('television_display'), tvPlaybackRights: rights('television_playback') };
const art = { schemaVersion: 1, id: artId, creatorAccountId: owner, projectId, catalogItemId: itemId, kind: 'artwork', location: { type: 'https', url: 'https://cdn.example/film.png' }, deliveryEligible: true, tvDisplayRights: rights('television_display') };
const inventory = { schemaVersion: 1, creatorAccountId: owner, projectId, revision: 5, sources: [source], items: [item], mediaAssets: [video, art], collections: [] } as any;
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

test('unverified, failed and revoked media cannot enter the guided publication control', async () => {
  const prior = globalThis.fetch;
  let state = 'failed';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const route = String(input);
    if (route.endsWith('/media-uploads')) return response({ uploadId: id('up', '1'), uploadState: state === 'unverified' ? 'completed' : 'verified', processing: { state } });
    if (route.endsWith('/deployment')) return response({ error: { message: 'Not found' } }, 404);
    throw new Error(route);
  }) as typeof fetch;
  try {
    const mounted = render(createElement(VideoReview, { page: 'publish', onNavigate: () => {}, project, item, inventory, refresh: async () => inventory, onProjectUpdate: () => {} }));
    await screen.findByText(/Processing failed/);
    assert.equal(screen.queryByRole('button', { name: 'Review live channel' }), null);
    assert.equal(screen.queryByRole('button', { name: 'Add to channel preview' }), null);
    mounted.unmount(); state = 'revoked';
    render(createElement(VideoReview, { page: 'publish', onNavigate: () => {}, project, item, inventory, refresh: async () => inventory, onProjectUpdate: () => {} }));
    await screen.findByText(/Video rights were revoked/);
    assert.equal(screen.queryByRole('button', { name: 'Review live channel' }), null);
  } finally { cleanup(); globalThis.fetch = prior; }
});

test('owned release summary distinguishes published video from later private draft changes', async () => {
  const prior = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const route = String(input);
    if (route.endsWith('/media-uploads')) return response({ uploadId: id('up', '1'), uploadState: 'verified', processing: { state: 'ready' } });
    if (route.endsWith('/deployment')) return response({ schemaVersion: 1, id: deploymentId, creatorAccountId: owner, projectId, channelId: projectId, appName: 'Films', packageId: 'com.creator.films', releaseControl: 'creator', nativeReleaseApproval: 'pending_creator', consoleEvidence: { state: 'none' } });
    if (route.endsWith('/current-summary')) return response({ releaseId: id('rel', '2'), sequence: 2, revisions: { channel: 2, catalog: 4 }, catalogItemIds: [itemId] });
    throw new Error(route);
  }) as typeof fetch;
  try {
    render(createElement(VideoReview, { page: 'publish', onNavigate: () => {}, project, item, inventory, refresh: async () => inventory, onProjectUpdate: () => {} }));
    await screen.findByText(/Published in live release #2 · newer private draft changes await approval/);
    await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Review live channel' })));
  } finally { cleanup(); globalThis.fetch = prior; }
});

test('READY owned video remains a private draft until its stable content is placed on a shelf and separately published', async () => {
  const prior = globalThis.fetch;
  const unplaced = { ...project, spec: { ...project.spec, pages: [{ ...project.spec.pages[0], modules: [] }] } };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const route = String(input);
    if (route.endsWith('/media-uploads')) return response({ uploadId: id('up', '1'), uploadState: 'verified', processing: { state: 'ready' } });
    if (route.endsWith('/deployment')) return response({ error: { message: 'Not found' } }, 404);
    throw new Error(route);
  }) as typeof fetch;
  try {
    const firstView = render(createElement(VideoReview, { page: 'channel', onNavigate: () => {}, project: unplaced, item, inventory,
      refresh: async () => inventory, onProjectUpdate: () => {} }));
    await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Add to channel preview' })));
    assert.match(screen.getByText(/When this video is ready/).textContent ?? '', /collection choice.*saved separately/);
    firstView.unmount();
    const shelved = render(createElement(VideoReview, { page: 'channel', onNavigate: () => {}, project, item, inventory,
      refresh: async () => inventory, onProjectUpdate: () => {} }));
    await screen.findByText('This video is in your private channel preview.');
    assert.equal(screen.queryByRole('button', { name: 'Add to channel preview' }), null);
    shelved.unmount();
    render(createElement(VideoReview, { page: 'publish', onNavigate: () => {}, project, item, inventory,
      refresh: async () => inventory, onProjectUpdate: () => {} }));
    await screen.findByText('Private draft · this video is not in the current live release.');
    assert.equal(item.id, itemId);
    assert.equal(project.spec.pages[0].modules[0].contentIds[0], contentId);
  } finally { cleanup(); globalThis.fetch = prior; }
});

test('private preview reuses confirmed asset rights without source or artwork reapproval', async () => {
  const prior = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const route = String(input);
    if (route.endsWith('/media-uploads')) return response({ uploadId: id('up', '1'), uploadState: 'verified', processing: { state: 'ready' } });
    if (route.endsWith('/deployment')) return response({ error: { message: 'Not found' } }, 404);
    throw new Error(route);
  }) as typeof fetch;
  try {
    render(createElement(VideoReview, { page: 'channel', onNavigate: () => {}, project: { ...project, spec: { ...project.spec, content: [] } }, item,
      inventory: { ...inventory, sources: [{ ...source, state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } }], mediaAssets: [video] },
      refresh: async () => inventory, onProjectUpdate: () => {} }));
    await screen.findByRole('button', { name: 'Add to channel preview' });
    assert.equal(screen.queryByText(/Confirm source permission on Publish/), null);
    assert.equal(screen.queryByText(/Approve your uploaded thumbnail on Publish/), null);
    assert.equal(screen.queryByRole('button', { name: 'Review live channel' }), null);
  } finally { cleanup(); globalThis.fetch = prior; }
});

test('stale channel revision blocks generation without writing a new draft', async () => {
  const prior = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const route = String(input);
    if (route.endsWith('/media-uploads')) return response({ uploadId: id('up', '1'), uploadState: 'verified', processing: { state: 'ready' } });
    if (route.endsWith('/deployment')) return response({ error: { message: 'Not found' } }, 404);
    if (route.endsWith('/catalog-draft') && init?.method !== 'POST') return response(null);
    if (route.endsWith('/catalog-draft') && init?.method === 'POST') { writes++; throw new Error('Unexpected draft write'); }
    if (route.endsWith('/catalog')) return response(inventory);
    if (route.endsWith(`/${projectId}`)) return response({ ...project, revision: 4 });
    throw new Error(route);
  }) as typeof fetch;
  try {
    render(createElement(VideoReview, { page: 'channel', onNavigate: () => {}, project: { ...project, spec: { ...project.spec, content: [] } }, item, inventory,
      refresh: async () => inventory, onProjectUpdate: () => {} }));
    await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Add to channel preview' })));
    fireEvent.click(screen.getByRole('button', { name: 'Add to channel preview' }));
    await screen.findByText(/Catalog or channel changed elsewhere/);
    assert.equal(writes, 0);
  } finally { cleanup(); globalThis.fetch = prior; }
});
