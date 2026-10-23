import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@vegalaunch/channel-engine';
import { VideoWorkspace } from '../src/VideoWorkspace.js';

const dom = new JSDOM('<!doctype html><html><body><main class="app-shell"></main></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');
const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const accountId = id('cr', '1'), projectId = id('ch', '2');
const project = { id: projectId, revision: 1, spec: starterChannel('Films', projectId, id('page', '3')) } as any;
const inventory = { schemaVersion: 1, creatorAccountId: accountId, projectId, revision: 1,
  sources: [], items: [], mediaAssets: [], collections: [] };

test('video popup renders one selected page and restores its place after close and reopen', async () => {
  const previous = globalThis.fetch;
  window.sessionStorage.clear();
  globalThis.fetch = (async input => {
    if (String(input).endsWith('/catalog')) return new Response(JSON.stringify(inventory), { headers: { 'content-type': 'application/json' } });
    throw new Error(String(input));
  }) as typeof fetch;
  let closes = 0;
  const props = { selection: { accountId, projectId }, project, onIdentity: () => {}, onProjectUpdate: () => {}, onClose: () => { closes++; } };
  try {
    let mounted = render(createElement(VideoWorkspace, props));
    await screen.findByRole('region', { name: 'Add Video' });
    assert.ok(screen.getByLabelText('Video file'));
    assert.equal(screen.queryByLabelText('Title *'), null);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    assert.equal(screen.getByText('Page 2 of 4').textContent, 'Page 2 of 4');
    assert.ok(screen.getByLabelText('Title *'));
    assert.equal(screen.queryByLabelText('Video file'), null);
    assert.equal(screen.queryByLabelText(/source URL|public HTTPS artwork URL/i), null);
    fireEvent.click(screen.getByRole('button', { name: 'Close video workspace' }));
    assert.equal(closes, 1);
    mounted.unmount();
    mounted = render(createElement(VideoWorkspace, props));
    await screen.findByRole('region', { name: 'Video details' });
    assert.ok(screen.getByLabelText('Title *'));
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    assert.equal(screen.getByText('Page 3 of 4').textContent, 'Page 3 of 4');
    assert.equal(screen.queryByLabelText('Title *'), null);
    assert.ok(screen.getByText(/Upload a video first, then choose where it appears/));
    mounted.unmount();
    mounted = render(createElement(VideoWorkspace, props));
    await screen.findByRole('region', { name: 'Channel category' });
    assert.equal(screen.getByText('Page 3 of 4').textContent, 'Page 3 of 4');
    mounted.unmount();
  } finally { cleanup(); globalThis.fetch = previous; window.sessionStorage.clear(); }
});
