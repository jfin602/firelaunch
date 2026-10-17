import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import type { ChannelProject } from '@firelaunch/contracts';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import App from '../src/App.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');

const firstSpec = fixtureChannel();
const first: ChannelProject = { id: firstSpec.id, spec: firstSpec, revision: 3, createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' };
const second: ChannelProject = { ...first, id: `ch_${'b'.repeat(32)}`, spec: { ...firstSpec, id: `ch_${'b'.repeat(32)}`, title: 'Second channel' }, revision: 5 };
const session = { accountId: `cr_${'a'.repeat(32)}`, email: 'owner@example.com', csrfToken: 'csrf', expiresAt: '2099-01-01T00:00:00.000Z' };

function mockApi(projects: ChannelProject[]) {
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const data = url === '/api/auth/session' ? session : url === '/api/projects' ? projects
      : url === `/api/projects/${second.id}` ? second : null;
    return new Response(JSON.stringify(data), { status: data === null ? 404 : 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return () => { cleanup(); globalThis.fetch = previous; dom.window.history.replaceState(null, '', '/'); };
}

test('empty hosted account keeps onboarding, status and real navigation visible', async () => {
  const restore = mockApi([]);
  try {
    render(createElement(App));
    await screen.findByPlaceholderText('e.g. Wild Earth');
    assert.ok(screen.getByRole('navigation', { name: 'Studio surfaces' }));
    assert.equal(screen.getByRole('button', { name: 'Catalog' }).hasAttribute('disabled'), true);
    assert.ok(screen.getByRole('button', { name: 'Sign out' }));
    assert.ok(screen.getByRole('heading', { level: 1, name: 'Your next channel' }));
  } finally { restore(); }
});

test('shell preserves project switch, selected surfaces, inspector and Preview keyboard boundaries', async () => {
  const restore = mockApi([first, second]);
  try {
    render(createElement(App));
    await screen.findByRole('heading', { name: first.spec.title, level: 1 });
    assert.equal(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-current'), 'page');
    for (const invented of ['Templates', 'Analytics', 'Community']) assert.equal(screen.queryByRole('button', { name: invented }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
    assert.ok(screen.getByRole('region', { name: 'Interactive TV Preview' }));
    assert.equal(screen.getByRole('button', { name: 'Catalog' }).getAttribute('aria-current'), 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Design' }));
    assert.equal(screen.getByRole('button', { name: 'Design' }).getAttribute('aria-current'), 'page');
    assert.ok(screen.getByRole('complementary', { name: 'Design controls' }));
    const color = screen.getByLabelText(/PRIMARY/);
    const focused = document.querySelector('.tv-screen .focused')?.getAttribute('data-tv-focus');
    fireEvent.keyDown(color, { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Design' }), { key: 'Enter' });
    assert.equal(document.querySelector('.tv-screen .focused')?.getAttribute('data-tv-focus'), focused);
    fireEvent.click(screen.getByRole('button', { name: '＋ New channel' }));
    assert.ok(screen.getByRole('heading', { level: 1, name: 'Your next channel' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch project' }), { target: { value: second.id } });
    await screen.findByRole('heading', { name: 'Second channel', level: 1 });
    assert.equal(screen.getByRole('button', { name: 'Design' }).getAttribute('aria-current'), 'page');
    assert.ok(screen.getByRole('complementary', { name: 'Design controls' }));
    assert.equal(dom.window.location.search, `?project=${second.id}`);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => assert.equal(screen.getByRole('button', { name: 'Publish' }).getAttribute('aria-current'), 'page'));
    assert.ok(screen.getByRole('complementary', { name: 'Publish controls' }));
  } finally { restore(); }
});

test('responsive shell declares edge-to-edge canvas and inline tablet inspector', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const shell = css.split('/* P2 shell:')[1];
  assert.ok(shell);
  assert.match(shell, /\.app-shell\s*\{[^}]*width:\s*100%/s);
  assert.match(shell, /min-height:\s*100dvh/);
  assert.match(shell, /@media \(max-width: 1180px\)/);
  assert.match(shell, /\.workspace\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(shell, /@media \(max-width: 900px\)/);
  assert.match(shell, /\.sidebar-project \.project-select\s*\{\s*display:\s*block/);
  assert.match(shell, /\.sidebar-nav\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media \(max-width: 600px\)\s*\{\s*\.sidebar\s*\{\s*position:\s*relative/s);
  assert.match(css, /\.sidebar-nav\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.remote button\s*\{\s*min-width:\s*44px;\s*min-height:\s*44px/s);
});
