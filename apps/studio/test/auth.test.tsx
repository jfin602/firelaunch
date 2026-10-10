import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import App from '../src/App.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, render, screen } = await import('@testing-library/react');

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
