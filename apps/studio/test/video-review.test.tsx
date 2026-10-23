import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@vegalaunch/channel-engine';
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


test('private READY video offers one Publish action without a live release wizard', async () => {
  const prior = globalThis.fetch;
  const privateProject = { ...project, spec: { ...project.spec, content: [], pages: [{ ...project.spec.pages[0], modules: [] }] } };
  const requests: { path: string; body?: any }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/media-uploads')) return response({ uploadId: id('up', '1'), uploadState: 'verified', processing: { state: 'ready' } });
    if (path.endsWith('/video-inclusion')) {
      requests.push({ path, body: JSON.parse(String(init?.body)) });
      return response({ ...privateProject, revision: 4, spec: project.spec });
    }
    throw new Error(path);
  }) as typeof fetch;
  try {
    let updated = 0;
    render(createElement(VideoReview, { page: 'publish', onNavigate: () => {}, project: privateProject, item, inventory,
      refresh: async () => inventory, onProjectUpdate: () => { updated++; } }));
    await waitFor(() => assert.equal(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled'), false));
    assert.ok(screen.getByText('Private'));
    assert.equal(screen.queryByText(/Private video drafts/), null);
    assert.equal(screen.queryByRole('button', { name: 'Review live channel' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => assert.equal(updated, 1));
    assert.deepEqual(requests[0]?.body, { expectedRevision: 3, expectedCatalogRevision: 5, itemId, action: 'publish' });
  } finally { cleanup(); globalThis.fetch = prior; }
});

test('included video offers Remove without deleting its Library record', async () => {
  const prior = globalThis.fetch;
  const requests: any[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith('/media-uploads')) return response({ uploadId: id('up', '1'), uploadState: 'verified', processing: { state: 'ready' } });
    if (path.endsWith('/video-inclusion')) { requests.push(JSON.parse(String(init?.body))); return response({ ...project, revision: 4 }); }
    throw new Error(path);
  }) as typeof fetch;
  try {
    let updated = 0;
    render(createElement(VideoReview, { page: 'publish', onNavigate: () => {}, project, item, inventory,
      refresh: async () => inventory, onProjectUpdate: () => { updated++; } }));
    assert.ok(screen.getByText('In Channel'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from Channel' }));
    await waitFor(() => assert.equal(updated, 1));
    assert.equal(requests[0]?.action, 'remove');
    assert.equal(requests[0]?.itemId, itemId);
  } finally { cleanup(); globalThis.fetch = prior; }
});

test('unready and revoked private videos cannot Publish', async () => {
  const prior = globalThis.fetch;
  const privateProject = { ...project, spec: { ...project.spec, content: [], pages: [{ ...project.spec.pages[0], modules: [] }] } };
  let state = 'failed';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/media-uploads')) return response({ uploadId: id('up', '1'), uploadState: 'verified', processing: { state } });
    throw new Error(String(input));
  }) as typeof fetch;
  try {
    const first = render(createElement(VideoReview, { page: 'publish', onNavigate: () => {}, project: privateProject, item, inventory,
      refresh: async () => inventory, onProjectUpdate: () => {} }));
    await screen.findByText(/Processing failed/);
    assert.equal(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled'), true);
    first.unmount(); state = 'revoked';
    render(createElement(VideoReview, { page: 'publish', onNavigate: () => {}, project: privateProject, item, inventory,
      refresh: async () => inventory, onProjectUpdate: () => {} }));
    await screen.findByText(/Video rights were revoked/);
    assert.equal(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled'), true);
  } finally { cleanup(); globalThis.fetch = prior; }
});
