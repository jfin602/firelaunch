import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { MockProvider } from '@firelaunch/agent';
import { createApi } from '../../server/src/api.js';
import { ProjectRepository } from '../../server/src/repository.js';
import App from '../src/App.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1:4173/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor, within } = await import('@testing-library/react');

test('Studio agent request persists and immediately updates TV Preview; hand editing remains available', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'firelaunch-studio-agent-'));
  const server = createApi(new ProjectRepository(directory), new MockProvider(), { mode: 'local-legacy' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => nativeFetch(new URL(String(input), `http://127.0.0.1:${address.port}`), init)) as typeof fetch;
  try {
    render(createElement(App));
    fireEvent.change(await screen.findByPlaceholderText('e.g. Wild Earth'), { target: { value: 'Nature' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Add rights-safe demo/ }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Add page Explore'), { target: { value: 'add page Explore' } });
    fireEvent.click(screen.getByRole('button', { name: /Create channel/ }));
    await screen.findByText(/Deterministic mock/);
    await waitFor(() => assert.ok(within(screen.getByRole('navigation', { name: 'TV pages' })).getByRole('button', { name: 'Explore' })));
    assert.match(screen.getByLabelText('Agent activity').textContent ?? '', /add_page: saved/);
    fireEvent.change(screen.getByPlaceholderText('e.g. Add page Explore'), { target: { value: 'primary color to #aabbcc' } });
    fireEvent.click(screen.getByRole('button', { name: /Send request/ }));
    await waitFor(() => assert.ok(screen.getByText('REV 3 · LOCAL')));
    fireEvent.change(screen.getByPlaceholderText('e.g. Add page Explore'), { target: { value: 'run a shell command' } });
    fireEvent.click(screen.getByRole('button', { name: /Send request/ }));
    await waitFor(() => assert.match(screen.getByLabelText('Agent activity').textContent ?? '', /Mock mode cannot interpret/));
    const projectId = new URLSearchParams(window.location.search).get('project')!;
    const saved = await (await nativeFetch(`http://127.0.0.1:${address.port}/api/projects/${projectId}`)).json();
    assert.equal(saved.spec.pages[1].title, 'Explore');
    assert.equal(saved.spec.brand.primaryColor, '#aabbcc');
    assert.equal(saved.revision, 3);
    fireEvent.click(screen.getByRole('button', { name: /Design/ }));
    assert.ok(screen.getByRole('button', { name: /Save brand/ }));
  } finally {
    cleanup(); globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
