import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@firelaunch/channel-engine';
import type { ChannelProject } from '@firelaunch/contracts';
import { LivePublication } from '../src/LivePublication.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const projectId = id('ch', 'a'), owner = id('cr', 'b'), itemId = id('ci', 'c'), assetId = id('ma', 'd'), contentId = id('item', 'e'), deploymentId = id('dep', 'f');
const spec = starterChannel('Author channel', projectId, id('page', '1'));
const project: ChannelProject = { id: projectId, revision: 2, spec: { ...spec, content: [{ id: contentId, title: 'A Book', description: 'Read about it', artwork: 'https://cdn.example/book.png', presentation: 'information' }] }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const deployment = { schemaVersion: 1, id: deploymentId, creatorAccountId: owner, projectId, channelId: projectId, appName: 'Author channel', packageId: 'com.example.author', releaseControl: 'creator', nativeReleaseApproval: 'pending_creator', consoleEvidence: { state: 'none' } };
const item = { schemaVersion: 1, id: itemId, creatorAccountId: owner, projectId, kind: 'book', sourceRecord: { sourceId: id('src', '1'), externalId: { provider: 'creator', kind: 'feed_item_id', value: 'book' }, observedAt: new Date().toISOString(), metadata: { title: 'A Book' } }, externalIdentifiers: [{ provider: 'creator', kind: 'feed_item_id', value: 'book' }], mediaAssetIds: [assetId] };
const asset = { schemaVersion: 1, id: assetId, creatorAccountId: owner, projectId, catalogItemId: itemId, kind: 'artwork', location: { type: 'https', url: 'https://cdn.example/book.png' }, deliveryEligible: true, tvDisplayRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt: new Date().toISOString() }, tvPlaybackRights: { status: 'unknown', basis: 'none', permittedUse: 'none' } };
const catalog = { schemaVersion: 1, creatorAccountId: owner, projectId, revision: 4, sources: [{ schemaVersion: 1, id: id('src', '1'), creatorAccountId: owner, projectId, type: 'creator_csv', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } }], items: [item], mediaAssets: [asset], collections: [] };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

test('writing release requires explicit approval and confirmation; history reload and rollback create a new release', async () => {
  const previous = globalThis.fetch;
  const previousConfirm = window.confirm;
  const calls: string[] = [];
  const releases: { id: string; sequence: number; sha256: string; publishedAt: string; previousReleaseId: string | null; rollbackSourceReleaseId: string | null }[] = [];
  let approval = 0;
  let liveReleaseId: string | null = null;
  window.confirm = () => false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const route = String(input);
    if (route.endsWith('/deployment')) return response(deployment);
    if (route.endsWith('/catalog')) return response(catalog);
    if (route.endsWith('/status')) return response({ revisions: { channel: 2, catalog: 4 }, liveReleaseId, liveSequence: releases.length, approvalRequired: true, nativeSubmission: 'separate' });
    if (route.endsWith('/history')) return response({ liveReleaseId, releases: [...releases].reverse() });
    if (route.endsWith('/readiness')) { calls.push('readiness'); return response({ ready: true }); }
    if (route.endsWith('/approve') || route.endsWith('/rollback')) {
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.revisions, { channel: 2, catalog: 4 });
      if (route.endsWith('/approve')) assert.deepEqual(body.bindings.content, [{ contentId, catalogItemId: itemId, artworkAssetId: assetId }]);
      else assert.equal(body.rollbackSourceReleaseId, releases[0]?.id);
      calls.push(route.endsWith('/rollback') ? 'rollback' : 'approve'); approval++;
      return response({ approvalId: id('ap', String(approval)) }, 201);
    }
    if (route.endsWith('/publish')) {
      calls.push('publish');
      const releaseId = id('rel', String(releases.length + 1));
      releases.push({ id: releaseId, sequence: releases.length + 1, sha256: 'a'.repeat(64), publishedAt: new Date().toISOString(), previousReleaseId: liveReleaseId, rollbackSourceReleaseId: approval === 3 ? releases[0]!.id : null });
      liveReleaseId = releaseId;
      return response({ releaseId, sequence: releases.length });
    }
    throw new Error(route);
  }) as typeof fetch;
  try {
    const mounted = render(createElement(LivePublication, { project, hosted: true }));
    await screen.findByText('No live releases yet.');
    assert.deepEqual(calls, []);
    assert.equal((screen.getByRole('button', { name: 'Approve draft for live review' }) as HTMLButtonElement).disabled, true);
    fireEvent.change(screen.getByLabelText('Reviewed catalog item'), { target: { value: itemId } });
    fireEvent.change(screen.getByLabelText('TV display artwork'), { target: { value: assetId } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve draft for live review' }));
    await screen.findByRole('button', { name: 'Confirm publish approved draft' });
    assert.deepEqual(calls, ['readiness', 'approve']);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm publish approved draft' }));
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Confirm publish approved draft' }) as HTMLButtonElement).disabled, false));
    assert.equal(releases.length, 0);
    window.confirm = () => true;
    fireEvent.click(screen.getByRole('button', { name: 'Confirm publish approved draft' }));
    await screen.findByText(/Live release #1 published/);
    assert.equal(releases.length, 1);
    mounted.unmount();
    render(createElement(LivePublication, { project, hosted: true }));
    await screen.findByText(/#1 ·/);
    assert.ok(screen.getByText(/Live: release #1/));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh live state and rights' }));
    await screen.findByText(/Live: release #1/);
    // A second publication makes the first release eligible for rollback.
    fireEvent.change(screen.getByLabelText('Reviewed catalog item'), { target: { value: itemId } });
    fireEvent.change(screen.getByLabelText('TV display artwork'), { target: { value: assetId } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve draft for live review' }));
    await screen.findByRole('button', { name: 'Confirm publish approved draft' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm publish approved draft' }));
    await screen.findByText(/Live release #2 published/);
    fireEvent.click(screen.getByRole('button', { name: 'Approve rollback to #1' }));
    await screen.findByRole('button', { name: 'Confirm publish approved rollback' });
    assert.equal(releases.length, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm publish approved rollback' }));
    await screen.findByText(/Live release #3 published/);
    assert.equal(releases.length, 3);
    assert.equal(releases[2]?.rollbackSourceReleaseId, releases[0]?.id);
  } finally { cleanup(); globalThis.fetch = previous; window.confirm = previousConfirm; }
});

test('blocked readiness, stale revisions and publication errors never publish', async () => {
  const previous = globalThis.fetch;
  const previousConfirm = window.confirm;
  let catalogRevision = 4;
  let refusal = true;
  let publishes = 0;
  window.confirm = () => true;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const route = String(input);
    if (route.endsWith('/deployment')) return response(deployment);
    if (route.endsWith('/status')) return response({ revisions: { channel: 2, catalog: 4 }, liveReleaseId: null, liveSequence: 0, approvalRequired: true, nativeSubmission: 'separate' });
    if (route.endsWith('/history')) return response({ liveReleaseId: null, releases: [] });
    if (route.endsWith('/catalog')) return response({ ...catalog, revision: catalogRevision });
    if (route.endsWith('/readiness')) return refusal ? response({ error: { message: 'Display rights revoked' } }, 409) : response({ ready: true });
    if (route.endsWith('/approve')) return response({ approvalId: id('ap', '1') }, 201);
    if (route.endsWith('/publish')) { publishes++; return response({ error: { message: 'Release changed' } }, 409); }
    throw new Error(route);
  }) as typeof fetch;
  try {
    render(createElement(LivePublication, { project, hosted: true }));
    await screen.findByText('No live releases yet.');
    fireEvent.change(screen.getByLabelText('Reviewed catalog item'), { target: { value: itemId } });
    fireEvent.change(screen.getByLabelText('TV display artwork'), { target: { value: assetId } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve draft for live review' }));
    await screen.findByRole('alert');
    assert.ok(screen.getByText(/Display rights revoked/));
    assert.equal(publishes, 0);
    refusal = false;
    catalogRevision = 5;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh live state and rights' }));
    await screen.findByText(/Draft changed elsewhere/);
    assert.equal((screen.getByRole('button', { name: 'Approve draft for live review' }) as HTMLButtonElement).disabled, true);
    assert.equal(publishes, 0);
    catalogRevision = 4;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh live state and rights' }));
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Approve draft for live review' }) as HTMLButtonElement).disabled, false));
    fireEvent.click(screen.getByRole('button', { name: 'Approve draft for live review' }));
    await screen.findByRole('button', { name: 'Confirm publish approved draft' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm publish approved draft' }));
    await screen.findByText(/Release changed/);
    assert.equal(publishes, 1);
    assert.equal(screen.queryByRole('button', { name: 'Confirm publish approved draft' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh live state and rights' }));
    await screen.findByText('No live releases yet.');
  } finally { cleanup(); globalThis.fetch = previous; window.confirm = previousConfirm; }
});
