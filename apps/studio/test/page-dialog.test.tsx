import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { applyMutation, starterChannel } from '@firelaunch/channel-engine';
import type { ChannelProject } from '@firelaunch/contracts';
import App from '../src/App.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor, within } = await import('@testing-library/react');
const id = `ch_${'a'.repeat(32)}`;
const session = { accountId: `cr_${'b'.repeat(32)}`, email: 'owner@example.com', csrfToken: 'csrf', expiresAt: '2099-01-01T00:00:00.000Z' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('new-page dialog keeps input on conflict, retries once, saves composition and restores focus', async () => {
  let current: ChannelProject = { id, spec: starterChannel('Films', id), revision: 1,
    createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z' };
  const oldHome = structuredClone(current.spec.pages[0]);
  let writes = 0;
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/session') return json(session);
    if (url === '/api/projects') return json([current]);
    if (url === `/api/projects/${id}`) return json(current);
    if (url === `/api/projects/${id}/mutations`) {
      writes++;
      if (writes === 1) return json({ error: { code: 'CONFLICT', message: 'Changed elsewhere' } }, 409);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.expectedRevision, current.revision);
      assert.equal(body.mutation.type, 'addPage');
      current = { ...current, revision: current.revision + 1, spec: applyMutation(current.spec, body.mutation) };
      return json(current);
    }
    throw new Error(`Unexpected request ${url}`);
  }) as typeof fetch;
  try {
    render(createElement(App));
    await screen.findByRole('heading', { name: 'Films', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Layout' }));
    const opener = screen.getByRole('button', { name: 'New page' });
    opener.focus(); fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Create a page' });
    const name = screen.getByRole('textbox', { name: 'Page name' }) as HTMLInputElement;
    assert.ok(document.activeElement === name);
    assert.equal((screen.getByRole('radio', { name: /Rows/ }) as HTMLInputElement).checked, true);
    fireEvent.change(name, { target: { value: 'Home' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    assert.match(screen.getByRole('alert').textContent ?? '', /already exists/);
    assert.equal(writes, 0);
    fireEvent.change(name, { target: { value: 'Explore' } });
    fireEvent.click(screen.getByRole('radio', { name: /Grid/ }));
    const submit = screen.getByRole('button', { name: 'Create page' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => assert.equal(writes, 1));
    assert.equal(name.value, 'Explore');
    assert.ok(dialog.isConnected);
    assert.match(screen.getByText(/Project changed elsewhere/).textContent ?? '', /changed elsewhere/i);
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    await waitFor(() => assert.equal(writes, 2));
    await waitFor(() => assert.ok(!screen.queryByRole('dialog', { name: 'Create a page' })));
    assert.deepEqual(current.spec.pages[0], oldHome);
    assert.deepEqual(current.spec.pages[1]?.modules.map(module => module.kind), ['grid']);
    assert.equal(current.spec.pages[1]?.modules[0]?.kind === 'grid' && current.spec.pages[1].modules[0].contentIds.length, 0);
    await waitFor(() => assert.ok(document.activeElement === within(screen.getByRole('navigation', { name: 'Channel pages' })).getByRole('button', { name: 'Explore' })));
    fireEvent.click(opener);
    fireEvent.change(screen.getByRole('textbox', { name: 'Page name' }), { target: { value: 'Canceled' } });
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Create a page' }), { key: 'Escape' });
    await waitFor(() => assert.ok(document.activeElement === opener));
    assert.equal(current.spec.pages.length, 2);
    fireEvent.click(opener);
    assert.equal((screen.getByRole('textbox', { name: 'Page name' }) as HTMLInputElement).value, '');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    assert.equal(writes, 2);
  } finally { cleanup(); globalThis.fetch = previous; dom.window.history.replaceState(null, '', '/'); }
});
