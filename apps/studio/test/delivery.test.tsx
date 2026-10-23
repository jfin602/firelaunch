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

test('Export Advanced Source edit, blocked build and local bundle remain truthful', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'vegalaunch-delivery-'));
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
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced Source' }));
    await waitFor(() => assert.equal((screen.getByRole('button', { name: 'Generate source' }) as HTMLButtonElement).disabled, false));
    fireEvent.click(screen.getByRole('button', { name: 'Generate source' }));
    await waitFor(() => assert.ok(screen.getByRole('button', { name: 'src/App.js' })));
    fireEvent.click(screen.getByRole('button', { name: 'src/App.js' }));
    const editor = await screen.findByLabelText('Generated source') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: `${editor.value}\n// creator-owned\n` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save text edit' }));
    await waitFor(() => assert.ok(screen.getByText(/Custom changes:/)));
    fireEvent.click(screen.getByRole('button', { name: 'Build & Download' }));
    await waitFor(() => assert.ok(screen.getAllByText(/No build has run/).length > 0));
    fireEvent.click(screen.getByRole('button', { name: 'Run Vega release build' }));
    await waitFor(() => assert.ok(screen.getByText(/VEGA_SDK_PATH not set/)));
    await waitFor(() => assert.ok(screen.getByText('Submission handoff')));
    assert.ok(screen.getByText(/Submit through your own Amazon account/));
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

test('hosted Export opens the app popup and clears project-scoped status on switch', async () => {
  const nativeFetch = globalThis.fetch;
  const project = (id: string) => ({ id, revision: 1, spec: { title: id } }) as Parameters<typeof Delivery>[0]['project'];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/code')) return Response.json({ generated: true, files: [], changed: [], stale: false, path: null });
    if (url.endsWith('/build')) return Response.json({ status: 'blocked', reason: 'No isolated worker' });
    if (url.endsWith('/readiness')) return Response.json({ checks: [], copy: {}, assets: {}, submitted: false });
    if (url.endsWith('/deployment')) return new Response('{}', { status: 404 });
    if (url.endsWith('/export-app')) return url.includes('/ch_first/')
      ? Response.json({ status: 'failed', reason: 'Native build failed', job: { id: 'job_failed' }, downloadReady: false })
      : Response.json({ status: 'blocked', reason: 'No isolated worker for second', job: null, downloadReady: false });
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  try {
    const view = render(createElement(Delivery, { project: project('ch_first'), surface: 'Build', hosted: true }));
    await waitFor(() => assert.ok(screen.getByText(/job job_failed/)));
    fireEvent.click(screen.getByRole('button', { name: 'Build & Download' }));
    assert.ok(await screen.findByRole('dialog', { name: 'Build & Download' }));
    await waitFor(() => assert.ok(screen.getByText(/The build failed/)));
    assert.equal(screen.queryByRole('button', { name: 'Download ZIP' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Close app export' }));
    view.rerender(createElement(Delivery, { project: project('ch_second'), surface: 'Build', hosted: true }));
    await waitFor(() => assert.match(screen.getByRole('status').textContent ?? '', /No isolated worker for second/));
    assert.equal(screen.queryByText(/job job_failed/), null);
    assert.equal(screen.queryByRole('button', { name: 'Run Vega release build' }), null);
  } finally { cleanup(); globalThis.fetch = nativeFetch; }
});

test('one Export click submits once, reopening only reads, and terminal retry is explicit', async () => {
  const nativeFetch = globalThis.fetch;
  const projectId = `ch_${'1'.repeat(32)}`;
  const deploymentId = `dep_${'2'.repeat(32)}`;
  const project = { id: projectId, revision: 3, spec: { title: 'Films' } } as Parameters<typeof Delivery>[0]['project'];
  let state: 'blocked' | 'queued' | 'failed' | 'ready' = 'blocked';
  let posts = 0;
  let approved = true;
  let stale = false;
  const receipt = () => ({ status: state, job: state === 'blocked' ? null : { id: `job_${'3'.repeat(32)}` },
    downloadReady: state === 'ready', reason: state === 'failed' ? 'Native build failed' : undefined });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/code')) return Response.json({ generated: false, files: [], changed: [], stale: false, path: null });
    if (url.endsWith('/build')) return Response.json({ status: 'blocked', reason: 'Hosted local build disabled' });
    if (url.endsWith('/readiness')) return Response.json({ checks: [], copy: {}, assets: {}, submitted: false });
    if (url.endsWith('/deployment')) return Response.json({ schemaVersion: 1, id: deploymentId,
      creatorAccountId: `cr_${'4'.repeat(32)}`, projectId, channelId: projectId, appName: 'Films',
      packageId: 'com.creator.films', releaseControl: 'creator', nativeReleaseApproval: 'creator_approved',
      manifestEndpoint: 'https://films.example.test/', consoleEvidence: { state: 'none' } });
    if (url.endsWith('/current-summary')) return Response.json({ releaseId: `rel_${'5'.repeat(32)}`, sequence: 1,
      revisions: { channel: 3, catalog: 0 }, catalogItemIds: [] });
    if (url.endsWith('/export-app')) {
      if (init?.method === 'POST') {
        posts++;
        if (!approved) return Response.json({ error: { message: 'Deployment not found' } }, { status: 404 });
        state = 'queued'; stale = false;
      }
      if (stale) return Response.json({ error: { message: 'Build input changed' } }, { status: 409 });
      return Response.json(receipt());
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  try {
    render(createElement(Delivery, { project, surface: 'Build', hosted: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Build & Download' }));
    assert.ok(await screen.findByRole('dialog', { name: 'Build & Download' }));
    await waitFor(() => assert.ok(screen.getByText(/Your build is in the queue/)));
    assert.equal(posts, 1);
    assert.equal(screen.queryByRole('button', { name: 'Build App' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Close app export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Build & Download' }));
    assert.ok(await screen.findByRole('dialog', { name: 'Build & Download' }));
    assert.equal(posts, 1, 'reopening queued work cannot submit');
    fireEvent.click(screen.getByRole('button', { name: 'Close app export' }));
    state = 'failed';
    fireEvent.click(screen.getByRole('button', { name: 'Build & Download' }));
    assert.ok(await screen.findByRole('dialog', { name: 'Build & Download' }));
    await waitFor(() => assert.equal(posts, 2, 'the next Build & Download click retries failed work'));
    fireEvent.click(screen.getByRole('button', { name: 'Close app export' }));
    state = 'ready';
    fireEvent.click(screen.getByRole('button', { name: 'Build & Download' }));
    assert.ok(await screen.findByText(/Your build is in the queue/));
    assert.equal(screen.queryByText(/Hosted local build disabled/), null, 'hosted Export cannot show the legacy local-build block beside a ready ZIP');
    assert.equal(screen.queryByRole('button', { name: 'Run Vega release build' }), null);
    assert.equal(posts, 3, 'Build & Download starts a fresh job after a ready ZIP');
    fireEvent.click(screen.getByRole('button', { name: 'Close app export' }));
    stale = true;
    fireEvent.click(screen.getByRole('button', { name: 'Build & Download' }));
    assert.ok(await screen.findByRole('dialog', { name: 'Build & Download' }));
    assert.equal(posts, 4, 'stale ready receipt starts a newly checked build from the click');
    fireEvent.click(screen.getByRole('button', { name: 'Close app export' }));
    state = 'blocked'; approved = false;
    fireEvent.click(screen.getByRole('button', { name: 'Build & Download' }));
    assert.ok(await screen.findByText(/Deployment not found/i));
    assert.equal(posts, 5);
  } finally { cleanup(); globalThis.fetch = nativeFetch; }
});
