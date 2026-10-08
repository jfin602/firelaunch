import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { createApi } from '../../server/src/api.js';
import { ProjectRepository } from '../../server/src/repository.js';
import App from '../src/App.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1:4173/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');

test('Studio creates a sample channel, saves Design/Content edits and reloads persistent project', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'firelaunch-studio-'));
  const server = createApi(new ProjectRepository(directory));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => nativeFetch(new URL(String(input), `http://127.0.0.1:${address.port}`), init)) as typeof fetch;
  try {
    render(createElement(App));
    fireEvent.change(await screen.findByPlaceholderText('e.g. Wild Earth'), { target: { value: 'My Channel' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    fireEvent.click(screen.getByRole('button', { name: /Create channel/ }));
    await waitFor(() => assert.ok(screen.getAllByRole('button', { name: 'Open Field Notes' }).length), { timeout: 5000 });
    await waitFor(() => assert.ok(screen.getByText('REV 5 · LOCAL')), { timeout: 5000 });
    const projectId = new URLSearchParams(window.location.search).get('project');
    assert.match(projectId ?? '', /^ch_[a-f0-9]{32}$/);
    fireEvent.click(screen.getByRole('button', { name: /Design/ }));
    fireEvent.change(screen.getByLabelText(/PRIMARY/), { target: { value: '#aabbcc' } });
    fireEvent.click(screen.getByRole('button', { name: /Save brand/ }));
    await waitFor(() => assert.ok(screen.getByText('REV 6 · LOCAL')));
    fireEvent.click(screen.getByRole('button', { name: /Content/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Field Notes' }));
    fireEvent.change(screen.getByLabelText('DESCRIPTION'), { target: { value: 'Edited in Studio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save film' }));
    await waitFor(() => assert.ok(screen.getByText('REV 7 · LOCAL')));
    cleanup();
    render(createElement(App));
    await waitFor(() => assert.ok(screen.getAllByRole('button', { name: 'Open Field Notes' }).length));
    const response = await nativeFetch(`http://127.0.0.1:${address.port}/api/projects/${projectId}`);
    const saved = await response.json();
    assert.equal(saved.revision, 7);
    assert.equal(saved.spec.brand.primaryColor, '#aabbcc');
    assert.equal(saved.spec.content[0].description, 'Edited in Studio');
  } finally {
    cleanup(); globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
