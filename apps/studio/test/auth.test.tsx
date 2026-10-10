import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { starterChannel } from '@firelaunch/channel-engine';
import type { ChannelProject } from '@firelaunch/contracts';
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
    assert.equal((await screen.findByRole('heading', { name: 'First owner channel', level: 1 })).textContent, 'First owner channel');
    assert.equal(dom.window.location.search, `?project=${firstId}`);
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch project' }), { target: { value: secondId } });
    await screen.findByRole('heading', { name: 'Second owner channel', level: 1 });
    assert.ok(requests.includes(`/api/projects/${secondId}`));
    account = 'cr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    fireEvent(dom.window as unknown as Window, new dom.window.Event('focus'));
    await screen.findByRole('link', { name: 'Sign in with Google' });
    assert.equal(screen.queryByRole('combobox', { name: 'Switch project' }), null);
    assert.equal(dom.window.location.search, '');
  } finally { cleanup(); globalThis.fetch = previous; dom.window.history.replaceState(null, '', '/'); }
});
