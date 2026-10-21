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

function mockApi(projects: ChannelProject[], local = false) {
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const data = url === '/api/auth/session' ? (local ? null : session) : url === '/api/projects' ? projects
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
    assert.equal(screen.getByRole('button', { name: 'Library' }).hasAttribute('disabled'), true);
    assert.ok(screen.getByRole('button', { name: 'Sign out' }));
    assert.ok(screen.getByRole('heading', { level: 1, name: 'Your next channel' }));
  } finally { restore(); }
});

test('contextual appearance inspector dismisses safely and restores focus across projects', async () => {
  const restore = mockApi([first, second]);
  const originalConfirm = window.confirm;
  try {
    render(createElement(App));
    await screen.findByRole('heading', { name: first.spec.title, level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    assert.equal(screen.queryByRole('complementary', { name: /inspector/i }), null);
    assert.equal(document.querySelector('.workspace')?.classList.contains('has-inspector'), false);
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    assert.equal(screen.queryByRole('complementary', { name: /inspector/i }), null);
    const opener = screen.getByRole('button', { name: 'Edit appearance' });
    opener.focus(); fireEvent.click(opener);
    assert.ok(screen.getByRole('complementary', { name: 'Appearance inspector' }));
    const title = screen.getByLabelText('DISPLAY NAME') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Unsaved name' } });
    window.confirm = () => false;
    fireEvent.click(screen.getByRole('button', { name: 'Close appearance inspector' }));
    assert.ok(screen.getByRole('complementary', { name: 'Appearance inspector' }));
    window.confirm = () => true;
    fireEvent.keyDown(title, { key: 'Escape' });
    await waitFor(() => assert.equal(screen.queryByRole('complementary', { name: 'Appearance inspector' }), null));
    await waitFor(() => assert.equal(document.activeElement, opener));
    fireEvent.click(opener);
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch project' }), { target: { value: second.id } });
    await screen.findByRole('heading', { name: 'Second channel', level: 1 });
    assert.equal(screen.queryByRole('complementary', { name: 'Appearance inspector' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'TV Preview' }));
    assert.ok(screen.getByRole('region', { name: 'Interactive TV Preview' }));
    assert.equal(screen.getByRole('button', { name: 'Close TV Preview' }).getAttribute('aria-expanded'), 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    assert.equal(document.querySelector('.workspace')?.classList.contains('has-inspector'), false);
    assert.equal(screen.queryByRole('complementary', { name: /inspector/i }), null);
  } finally { window.confirm = originalConfirm; restore(); }
});

test('responsive shell declares edge-to-edge canvas and inline tablet inspector', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const shell = css.split('/* P2 shell:')[1];
  assert.ok(shell);
  assert.match(shell, /\.app-shell\s*\{[^}]*width:\s*100%/s);
  assert.match(shell, /min-height:\s*100dvh/);
  assert.match(shell, /@media \(max-width: 1180px\)/);
  assert.match(css, /\.workspace\.has-inspector\s*\{[^}]*grid-template-columns/s);
  assert.match(shell, /@media \(max-width: 900px\)/);
  assert.match(shell, /\.sidebar-project \.project-select\s*\{\s*display:\s*block/);
  assert.match(shell, /\.sidebar-nav\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media \(max-width: 600px\)\s*\{\s*\.sidebar\s*\{\s*position:\s*relative/s);
  assert.match(css, /\.sidebar-nav\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.remote button\s*\{\s*min-width:\s*44px;\s*min-height:\s*44px/s);
});

test('local project switch keeps the creator in Studio', async () => {
  const restore = mockApi([first, second], true);
  try {
    render(createElement(App));
    await screen.findByRole('heading', { name: first.spec.title, level: 1 });
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch project' }), { target: { value: second.id } });
    await screen.findByRole('heading', { name: 'Second channel', level: 1 });
    assert.equal(screen.queryByRole('heading', { name: 'Sign in to FireLaunch' }), null);
    assert.equal(dom.window.location.search, `?project=${second.id}`);
  } finally { restore(); }
});
