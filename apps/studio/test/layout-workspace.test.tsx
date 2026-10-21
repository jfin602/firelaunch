import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { applyMutation } from '@firelaunch/channel-engine';
import type { ChannelProject } from '@firelaunch/contracts';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import App from '../src/App.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor, within } = await import('@testing-library/react');
const spec = fixtureChannel();
const secondPageId = `page_${'5'.repeat(32)}`;
spec.navigation.push(secondPageId);
spec.pages.push({ id: secondPageId, title: 'Explore', modules: [{ id: `mod_${'6'.repeat(32)}`, kind: 'grid', title: 'Films', contentIds: [] }] });
const first: ChannelProject = { id: spec.id, spec, revision: 1, createdAt: '2026-10-21T00:00:00Z', updatedAt: '2026-10-21T00:00:00Z' };
const second: ChannelProject = { ...first, id: `ch_${'b'.repeat(32)}`, spec: { ...fixtureChannel(), id: `ch_${'b'.repeat(32)}`, title: 'Other channel' } };
const session = { accountId: `cr_${'a'.repeat(32)}`, email: 'owner@example.com', csrfToken: 'csrf', expiresAt: '2099-01-01T00:00:00.000Z' };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('Pages & Layout selection, rename, guarded deletion and account-safe project switch', async () => {
  let current = first;
  const writes: string[] = [];
  const previous = globalThis.fetch;
  const originalConfirm = window.confirm;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/session') return json(session);
    if (url === '/api/projects') return json([current, second]);
    if (url === `/api/projects/${first.id}`) return json(current);
    if (url === `/api/projects/${second.id}`) return json(second);
    if (url === `/api/projects/${first.id}/mutations`) {
      const { mutation } = JSON.parse(String(init?.body));
      writes.push(mutation.type);
      current = { ...current, revision: current.revision + 1, spec: applyMutation(current.spec, mutation) };
      return json(current);
    }
    throw new Error(`Unexpected ${url}`);
  }) as typeof fetch;
  try {
    render(createElement(App));
    await screen.findByRole('heading', { name: 'Wild Earth', level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Layout' }));
    assert.equal(screen.queryByRole('complementary', { name: 'Layout inspector' }), null);
    const rail = screen.getByRole('navigation', { name: 'Channel pages' });
    assert.equal(within(rail).getByRole('button', { name: 'Home' }).getAttribute('aria-current'), 'page');
    const homeSection = screen.getByRole('region', { name: 'hero section 1' });
    assert.ok(within(homeSection).getByText('Oceans'));
    const editSection = within(homeSection).getByRole('button', { name: 'Edit section' });
    editSection.focus(); fireEvent.click(editSection);
    const inspector = screen.getByRole('complementary', { name: 'Layout inspector' });
    await waitFor(() => assert.equal(document.activeElement, within(inspector).getByRole('button', { name: 'Close layout inspector' })));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => assert.equal(screen.queryByRole('complementary', { name: 'Layout inspector' }), null));
    await waitFor(() => assert.equal(document.activeElement, editSection));
    fireEvent.click(within(rail).getByRole('button', { name: 'Explore' }));
    assert.ok(screen.getByText('Choose content for Films.'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit page' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'PAGE NAME' }), { target: { value: 'Home' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename page' }));
    assert.match(screen.getByRole('alert').textContent ?? '', /already exists/);
    assert.deepEqual(writes, []);
    fireEvent.change(screen.getByRole('textbox', { name: 'PAGE NAME' }), { target: { value: 'Discover' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename page' }));
    await waitFor(() => assert.ok(within(rail).getByRole('button', { name: 'Discover' })));
    window.confirm = () => false;
    fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
    assert.deepEqual(writes, ['updatePage']);
    window.confirm = () => true;
    fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
    await waitFor(() => assert.equal(current.spec.pages.length, 1));
    assert.ok(within(rail).getByRole('button', { name: 'Home' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit page' }));
    assert.equal((screen.getByRole('button', { name: 'Delete page' }) as HTMLButtonElement).disabled, true);
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch project' }), { target: { value: second.id } });
    await screen.findByRole('heading', { name: 'Other channel', level: 1 });
    assert.equal(screen.queryByRole('complementary', { name: 'Layout inspector' }), null);
    assert.equal(screen.queryByText('Discover'), null);
  } finally { cleanup(); globalThis.fetch = previous; window.confirm = originalConfirm; dom.window.history.replaceState(null, '', '/'); }
});

test('layout controls remain accessible in narrow flow', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /@media\(max-width:760px\).*\.layout-workspace.*display:block/s);
  assert.match(css, /\.layout-page-rail\{position:static;flex-direction:row;overflow:auto/s);
});
