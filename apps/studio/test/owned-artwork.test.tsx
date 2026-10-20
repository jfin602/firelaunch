import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { OwnedArtwork, ownedArtworkObject } from '../src/OwnedArtwork.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const owner = `cr_${'a'.repeat(32)}`, foreign = `cr_${'b'.repeat(32)}`;
const project = `ch_${'c'.repeat(32)}`, otherProject = `ch_${'d'.repeat(32)}`;
const itemId = `ci_${'e'.repeat(32)}`, assetId = `ma_${'f'.repeat(32)}`, objectId = `ma_${'1'.repeat(32)}`;
const item = { id: itemId, creatorAccountId: owner, projectId: project, kind: 'video', mediaAssetIds: [assetId],
  sourceRecord: { metadata: { artworkUrl: 'https://art.example/legacy.jpg' } } } as any;
const asset = { id: assetId, creatorAccountId: owner, projectId: project, catalogItemId: itemId, kind: 'artwork',
  location: { type: 'private_object', objectId }, tvDisplayRights: { status: 'cleared' } } as any;
const fallback = createElement('span', { 'aria-label': 'Artwork unavailable' }, '▣');
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

test('owned saved art uses header capability, survives reload, and revokes blob URL on scope change', async () => {
  const previousFetch = globalThis.fetch, create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  const requests: string[] = [], revoked: string[] = [];
  URL.createObjectURL = () => 'blob:https://studio.example/owned-art';
  URL.revokeObjectURL = url => { revoked.push(url); };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    requests.push(`${init?.method ?? 'GET'} ${path}`);
    if (path.endsWith('/capability')) return json({ capability: 'short-lived-secret' });
    assert.equal(new Headers(init?.headers).get('x-private-capability'), 'short-lived-secret');
    return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'content-type': 'image/jpeg' } });
  }) as typeof fetch;
  try {
    const props = { item, assets: [asset], projectId: project, accountId: owner, className: 'art', fallback };
    const view = render(createElement(OwnedArtwork, props));
    await waitFor(() => assert.equal(view.container.querySelector('img')?.getAttribute('src'), 'blob:https://studio.example/owned-art'));
    assert.ok(requests.some(value => value === `POST /api/projects/${project}/private-objects/${objectId}/capability`));
    assert.ok(requests.some(value => value === `GET /api/projects/${project}/private-objects/${objectId}/content`));
    assert.doesNotMatch(document.body.innerHTML, /short-lived-secret|private-objects/);
    view.rerender(createElement(OwnedArtwork, { ...props, accountId: foreign }));
    await waitFor(() => assert.ok(revoked.includes('blob:https://studio.example/owned-art')));
    assert.ok(screen.getByLabelText('Artwork unavailable'));
    view.rerender(createElement(OwnedArtwork, { ...props, accountId: null, assets: [] }));
    assert.equal(view.container.querySelector('img'), null, 'session loss must hide legacy artwork as well');
    view.rerender(createElement(OwnedArtwork, { ...props, assets: [] }));
    assert.equal(view.container.querySelector('img')?.getAttribute('src'), 'https://art.example/legacy.jpg');
    fireEvent.error(view.container.querySelector('img')!);
    assert.ok(screen.getByLabelText('Artwork unavailable'));
    view.unmount();
  } finally { cleanup(); globalThis.fetch = previousFetch; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

test('art lookup rejects foreign, project-mismatched, unlinked and revoked records', () => {
  assert.equal(ownedArtworkObject(item, [asset], project, owner), objectId);
  assert.equal(ownedArtworkObject(item, [asset], project, foreign), null);
  assert.equal(ownedArtworkObject(item, [asset], otherProject, owner), null);
  assert.equal(ownedArtworkObject(item, [{ ...asset, catalogItemId: `ci_${'2'.repeat(32)}` }], project, owner), null);
  assert.equal(ownedArtworkObject(item, [{ ...asset, tvDisplayRights: { status: 'revoked' } }], project, owner), null);
});

test('local custom thumbnail takes priority without a private request', async () => {
  const previousFetch = globalThis.fetch, create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('Private request should not run'); }) as typeof fetch;
  URL.createObjectURL = () => 'blob:https://studio.example/custom'; URL.revokeObjectURL = () => {};
  try {
    const file = new File(['image'], 'custom.jpg', { type: 'image/jpeg' });
    const view = render(createElement(OwnedArtwork, { item, assets: [asset], projectId: project, accountId: owner, className: 'art', fallback, localFile: file }));
    await waitFor(() => assert.equal(view.container.querySelector('img')?.getAttribute('src'), 'blob:https://studio.example/custom'));
    assert.equal(calls, 0);
    view.rerender(createElement(OwnedArtwork, { item, assets: [asset], projectId: project, accountId: null, className: 'art', fallback, localFile: file }));
    await waitFor(() => assert.equal(view.container.querySelector('img'), null));
    view.rerender(createElement(OwnedArtwork, { item, assets: [asset], projectId: project, accountId: foreign, className: 'art', fallback, localFile: file }));
    await waitFor(() => assert.equal(view.container.querySelector('img'), null));
  } finally { cleanup(); globalThis.fetch = previousFetch; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

test('switching account aborts an in-flight capability and never paints its late image', async () => {
  const previousFetch = globalThis.fetch, create = URL.createObjectURL;
  let finish!: (value: Response) => void;
  let requestedSignal: AbortSignal | undefined;
  let created = 0;
  URL.createObjectURL = () => { created++; return 'blob:https://studio.example/late'; };
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestedSignal = init?.signal ?? undefined;
    return await new Promise<Response>(resolve => { finish = resolve; });
  }) as typeof fetch;
  try {
    const props = { item, assets: [asset], projectId: project, accountId: owner, className: 'art', fallback };
    const view = render(createElement(OwnedArtwork, props));
    await waitFor(() => assert.ok(requestedSignal));
    view.rerender(createElement(OwnedArtwork, { ...props, accountId: foreign }));
    assert.equal(requestedSignal?.aborted, true);
    finish(json({ capability: 'late-secret' }));
    await waitFor(() => assert.equal(view.container.querySelector('img'), null));
    assert.equal(created, 0);
  } finally { cleanup(); globalThis.fetch = previousFetch; URL.createObjectURL = create; }
});

test('replacing the linked thumbnail paints the new private image and revokes the old blob', async () => {
  const previousFetch = globalThis.fetch, create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  const nextAssetId = `ma_${'2'.repeat(32)}`, nextObjectId = `ma_${'3'.repeat(32)}`;
  const requested: string[] = [], revoked: string[] = [];
  let created = 0;
  URL.createObjectURL = () => `blob:https://studio.example/art-${++created}`;
  URL.revokeObjectURL = url => { revoked.push(url); };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    requested.push(path);
    if (path.endsWith('/capability')) return json({ capability: 'header-only' });
    assert.equal(new Headers(init?.headers).get('x-private-capability'), 'header-only');
    return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'content-type': 'image/jpeg' } });
  }) as typeof fetch;
  try {
    const props = { item, assets: [asset], projectId: project, accountId: owner, className: 'art', fallback };
    const view = render(createElement(OwnedArtwork, props));
    await waitFor(() => assert.equal(view.container.querySelector('img')?.getAttribute('src'), 'blob:https://studio.example/art-1'));
    view.rerender(createElement(OwnedArtwork, { ...props, item: { ...item, mediaAssetIds: [assetId, nextAssetId] },
      assets: [asset, { ...asset, id: nextAssetId, location: { type: 'private_object', objectId: nextObjectId } }] }));
    await waitFor(() => assert.equal(view.container.querySelector('img')?.getAttribute('src'), 'blob:https://studio.example/art-2'));
    assert.deepEqual(revoked, ['blob:https://studio.example/art-1']);
    assert.equal(view.container.querySelectorAll('img').length, 1);
    assert.ok(requested.some(path => path.includes(nextObjectId)));
    assert.doesNotMatch(view.container.innerHTML, /header-only|private-objects/);
    view.unmount();
    assert.ok(revoked.includes('blob:https://studio.example/art-2'));
  } finally { cleanup(); globalThis.fetch = previousFetch; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});
