import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@vegalaunch/channel-engine';
import type { ChannelProject } from '@vegalaunch/contracts';
import App from '../src/App.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');

test('hosted Studio denies project UI and offers sign-in after missing session', async () => {
  const previous = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }), { status: 401, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    render(createElement(App));
    const signIn = await screen.findByRole('link', { name: 'Sign in with Google' });
    assert.ok(screen.getByRole('heading', { name: 'Sign in to VegaLaunch' }));
    assert.equal(screen.getByRole('heading', { name: 'Sign in to VegaLaunch' }).querySelector('img')?.getAttribute('src'), '/vegalaunch-wordmark.png');
    assert.equal(screen.queryByText(/session expired/i), null);
    assert.equal(document.body.textContent?.includes('FireLaunch'), false);
    assert.equal(signIn.getAttribute('href'), '/api/auth/login');
    assert.deepEqual(requests, ['/api/auth/session']);
    assert.equal(screen.queryByRole('button', { name: /New channel/ }), null);
  } finally { cleanup(); globalThis.fetch = previous; }
});

test('hosted Studio selects only listed projects, verifies switch and clears on account change', async () => {
  const previous = globalThis.fetch;
  const firstId = `ch_${'a'.repeat(32)}`;
  const secondId = `ch_${'b'.repeat(32)}`;
  const make = (id: string, title: string): ChannelProject => ({ id, spec: starterChannel(title, id), revision: 1,
    createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' });
  const first = make(firstId, 'First owner channel');
  const second = make(secondId, 'Second owner channel');
  const requests: string[] = [];
  let account = 'cr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  dom.window.history.replaceState(null, '', `/?project=ch_${'f'.repeat(32)}`);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    const data = url === '/api/auth/session' ? { accountId: account, email: 'owner@example.com', csrfToken: 'csrf', expiresAt: '2099-01-01T00:00:00.000Z' }
      : url === '/api/projects' ? [first, second] : url === `/api/projects/${secondId}` ? second : null;
    return new Response(JSON.stringify(data), { status: data === null ? 404 : 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    render(createElement(App));
    assert.match((await screen.findByRole('button', { name: 'Switch workspace, current channel First owner channel' })).textContent ?? '', /First owner channel/);
    assert.equal(dom.window.location.search, `?project=${firstId}`);
    fireEvent.click(screen.getByRole('button', { name: /Switch workspace, current channel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Second owner channel' }));
    await screen.findByRole('button', { name: `Switch workspace, current channel Second owner channel` });
    assert.ok(requests.includes(`/api/projects/${secondId}`));
    account = 'cr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    fireEvent(dom.window as unknown as Window, new dom.window.Event('focus'));
    await screen.findByRole('link', { name: 'Sign in with Google' });
    assert.ok(screen.getByText('Your session expired. Sign in again to continue.'));
    assert.equal(screen.queryByRole('button', { name: /Switch workspace, current channel/ }), null);
    assert.equal(dom.window.location.search, '');
  } finally { cleanup(); globalThis.fetch = previous; dom.window.history.replaceState(null, '', '/'); }
});

test('explicit sign-out returns to a neutral welcome', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/auth/session') return Response.json({ accountId: `cr_${'a'.repeat(32)}`, email: 'owner@example.com', csrfToken: 'csrf', expiresAt: '2099-01-01T00:00:00.000Z' });
    if (String(input) === '/api/auth/logout' && init?.method === 'POST') return new Response(null, { status: 204 });
    if (String(input) === '/api/projects') return Response.json([]);
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  try {
    render(createElement(App));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await screen.findByRole('link', { name: 'Sign in with Google' });
    assert.equal(screen.queryByText(/session expired/i), null);
  } finally { cleanup(); globalThis.fetch = previous; }
});
