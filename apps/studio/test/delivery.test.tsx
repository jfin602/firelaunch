import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { createApi } from '../../server/src/api.js';
import { ProjectRepository } from '../../server/src/repository.js';
import App from '../src/App.js';
import { Delivery } from '../src/Delivery.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1:4173/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');

test('Studio Code edit, blocked Build and Publish bundle remain truthful', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'firelaunch-delivery-'));
  const repository = new ProjectRepository(directory);
  const project = await repository.create({ title: 'Wild Earth' });
  const server = createApi(repository, undefined, { mode: 'local-legacy' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => nativeFetch(new URL(String(input), `http://127.0.0.1:${address.port}`), init)) as typeof fetch;
  try {
    render(createElement(App));
    await screen.findByText('REV 1 · LOCAL');
    fireEvent.click(screen.getByRole('button', { name: /Code/ }));
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Generate source' }) as HTMLButtonElement).disabled, false));
    fireEvent.click(screen.getByRole('button', { name: 'Generate source' }));
    await waitFor(() => assert.ok(screen.getByRole('button', { name: 'src/App.js' })));
    fireEvent.click(screen.getByRole('button', { name: 'src/App.js' }));
    const editor = await screen.findByLabelText('Generated source') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: `${editor.value}\n// creator-owned\n` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save text edit' }));
    await waitFor(() => assert.ok(screen.getByText(/Custom changes:/)));
    fireEvent.click(screen.getByRole('button', { name: /Build/ }));
    await waitFor(() => assert.ok(screen.getByText(/No build has run/)));
    fireEvent.click(screen.getByRole('button', { name: 'Run Vega release build' }));
    await waitFor(() => assert.ok(screen.getByText(/VEGA_SDK_PATH not set/)));
    fireEvent.click(screen.getByRole('button', { name: /Publish/ }));
    await waitFor(() => assert.ok(screen.getByText('Submission handoff')));
    assert.ok(screen.getByText(/No Amazon Developer Console action has occurred/));
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Create local submission bundle' }) as HTMLButtonElement).disabled, false));
    fireEvent.click(screen.getByRole('button', { name: 'Create local submission bundle' }));
    await waitFor(() => assert.ok(screen.getByText(/readiness, copy, assets, checklist; not submitted/)));
    const bundle = await import('node:fs/promises').then(fs => fs.readdir(path.join(directory, 'projects', project.id)));
    const folder = bundle.find(name => name.startsWith('submission-'));
    assert.ok(folder);
    assert.equal(JSON.parse(await readFile(path.join(directory, 'projects', project.id, folder, 'readiness.json'), 'utf8')).submitted, false);
  } finally {
    cleanup(); globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('hosted Build shows blocked native export, no download, and clears project-scoped status on switch', async () => {
  const nativeFetch = globalThis.fetch;
  const project = (id: string) => ({ id, revision: 1 }) as Parameters<typeof Delivery>[0]['project'];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/code')) return Response.json({ generated: true, files: [], changed: [], stale: false, path: null });
    if (url.endsWith('/build')) return Response.json({ status: 'blocked', reason: 'No isolated worker' });
    if (url.endsWith('/readiness')) return Response.json({ checks: [], copy: {}, assets: {}, submitted: false });
    if (url.endsWith('/export-app')) return url.includes('/ch_first/')
      ? Response.json({ status: 'failed', reason: 'Native build failed', job: { id: 'job_failed' }, downloadReady: false })
      : Response.json({ status: 'blocked', reason: 'No isolated worker for second', job: null, downloadReady: false });
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  try {
    const view = render(createElement(Delivery, { project: project('ch_first'), surface: 'Build', hosted: true }));
    await waitFor(() => assert.ok(screen.getByText(/Native build failed/)));
    assert.equal((screen.getByRole('button', { name: 'Request Vega build' }) as HTMLButtonElement).disabled, false);
    assert.equal((screen.getByRole('button', { name: 'Download Vega ZIP' }) as HTMLButtonElement).disabled, true);
    view.rerender(createElement(Delivery, { project: project('ch_second'), surface: 'Build', hosted: true }));
    await waitFor(() => assert.ok(screen.getByText(/No isolated worker for second/)));
    assert.equal(screen.queryByText(/Native build failed/), null);
    assert.equal((screen.getByRole('button', { name: 'Run Vega release build' }) as HTMLButtonElement).disabled, true);
  } finally { cleanup(); globalThis.fetch = nativeFetch; }
});
