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
    assert.ok(screen.getByRole('heading', { level: 1, name: /Stories belong/ }));
    assert.equal(document.querySelector('.topbar'), null);
  } finally { restore(); }
});

test('single channel form keeps its name on failure and blocks repeated pending submits', async () => {
  const previous = globalThis.fetch;
  let attempts = 0;
  let finish: ((response: Response) => void) | undefined;
  const created = { ...first, id: `ch_${'c'.repeat(32)}`, spec: { ...first.spec, id: `ch_${'c'.repeat(32)}`, title: 'My new channel' }, revision: 1 };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/session') return Response.json(session);
    if (url === '/api/projects' && init?.method === 'POST') {
      attempts++;
      assert.equal((init.headers as Record<string, string>)['x-csrf-token'], 'csrf');
      if (attempts === 1) return Response.json({ error: { message: 'Storage is temporarily unavailable' } }, { status: 503 });
      return new Promise<Response>(resolve => { finish = resolve; });
    }
    if (url === '/api/projects') return Response.json([first]);
    return Response.json(null, { status: 404 });
  }) as typeof fetch;
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` });
    fireEvent.click(screen.getByRole('button', { name: 'New channel' }));
    const input = screen.getByLabelText('CHANNEL NAME') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My new channel' } });
    assert.equal(screen.queryByText('02 First look'), null);
    fireEvent.click(screen.getByRole('button', { name: /Create Channel/ }));
    assert.match((await screen.findByRole('alert')).textContent ?? '', /Storage is temporarily unavailable/);
    assert.equal(input.value, 'My new channel');
    const button = screen.getByRole('button', { name: /Create Channel/ });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.submit(input.closest('form')!);
    assert.equal(attempts, 2);
    assert.equal((screen.getByRole('button', { name: 'Creating…' }) as HTMLButtonElement).disabled, true);
    finish!(Response.json(created, { status: 201 }));
    await screen.findByRole('button', { name: `Switch workspace, current channel My new channel` });
    assert.equal(window.location.search, `?project=${created.id}`);
    assert.equal(screen.getByRole('button', { name: 'Pages & Layout' }).getAttribute('aria-pressed'), 'true');
  } finally { cleanup(); globalThis.fetch = previous; dom.window.history.replaceState(null, '', '/'); }
});

test('every Studio destination starts without a topbar and the card owns workspace actions', async () => {
  const restore = mockApi([first, second]);
  try {
    render(createElement(App));
    const card = await screen.findByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` });
    assert.match(card.textContent ?? '', /REV 3 · PRIVATE/);
    assert.match(card.textContent ?? '', /SAVED PRIVATELY/);
    assert.equal(document.querySelector('.topbar'), null);
    assert.equal(document.querySelector('.project-select'), null);
    for (const destination of ['Home', 'Library', 'Channel', 'Publish', 'Export']) {
      fireEvent.click(screen.getByRole('button', { name: destination }));
      assert.equal(document.querySelector('.topbar'), null);
      assert.equal(document.querySelector('.studio-main')?.firstElementChild?.classList.contains('topbar'), false);
    }
    fireEvent.click(screen.getByRole('button', { name: 'New channel' }));
    assert.ok(screen.getByPlaceholderText('e.g. Wild Earth'));
    assert.equal(document.querySelector('.topbar'), null);
  } finally { restore(); }
});

test('appearance editor keeps unsaved changes guarded across dock tabs and projects', async () => {
  const restore = mockApi([first, second]);
  const originalConfirm = window.confirm;
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` });
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    assert.equal(screen.queryByRole('complementary', { name: /inspector/i }), null);
    assert.equal(document.querySelector('.workspace')?.classList.contains('has-inspector'), false);
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    assert.ok(screen.getByRole('complementary', { name: 'Appearance editor' }));
    const title = screen.getByLabelText('DISPLAY NAME') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Unsaved name' } });
    assert.match(screen.getByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` }).textContent ?? '', /UNSAVED EDITS/);
    window.confirm = () => false;
    fireEvent.click(screen.getByRole('button', { name: /Switch workspace, current channel/ }));
    fireEvent.click(screen.getByRole('button', { name: second.spec.title }));
    assert.ok(screen.getByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Layout' }));
    assert.ok(screen.getByRole('complementary', { name: 'Appearance editor' }));
    window.confirm = () => true;
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Layout' }));
    assert.equal(screen.queryByRole('complementary', { name: 'Appearance editor' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    fireEvent.click(screen.getByRole('button', { name: /Switch workspace, current channel/ }));
    fireEvent.click(screen.getByRole('button', { name: second.spec.title }));
    await screen.findByRole('button', { name: `Switch workspace, current channel Second channel` });
    assert.equal(screen.queryByRole('complementary', { name: 'Appearance inspector' }), null);
    assert.ok(screen.getByRole('region', { name: 'Interactive TV Preview' }));
    assert.equal(screen.queryByRole('button', { name: 'Close TV Preview' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    assert.equal(document.querySelector('.workspace')?.classList.contains('has-inspector'), false);
    assert.equal(screen.queryByRole('complementary', { name: 'Appearance editor' }), null);
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
  assert.match(shell, /\.project-switch-current\s*\{[^}]*min-height:\s*40px/s);
  assert.doesNotMatch(css, /calc\(100dvh - (?:82|95)px\)/);
  assert.match(shell, /\.sidebar-nav\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media \(max-width: 600px\)\s*\{\s*\.sidebar\s*\{\s*position:\s*relative/s);
  assert.match(css, /\.sidebar-nav\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.remote button\s*\{\s*min-width:\s*44px;\s*min-height:\s*44px/s);
  assert.match(css, /\.preview-fullscreen \.channel-dock\{[^}]*left:0;[^}]*height:100%;[^}]*transform:translateX\(-100%\)/s);
  assert.match(css, /\.preview-fullscreen\.dock-revealed \.channel-dock\{transform:translateX\(0\)/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.preview-fullscreen \.channel-dock,\.preview-fullscreen \.channel-dock-handle\{transition:none/);
});

test('local project switch keeps the creator in Studio', async () => {
  const restore = mockApi([first, second], true);
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` });
    fireEvent.click(screen.getByRole('button', { name: /Switch workspace, current channel/ }));
    fireEvent.click(screen.getByRole('button', { name: second.spec.title }));
    await screen.findByRole('button', { name: `Switch workspace, current channel Second channel` });
    assert.equal(screen.queryByRole('heading', { name: 'Sign in to FireLaunch' }), null);
    assert.equal(dom.window.location.search, `?project=${second.id}`);
  } finally { restore(); }
});

test('full-screen fallback retains the live Preview, TV playback and focus on exit', async () => {
  const restore = mockApi([first, second]);
  const original = HTMLElement.prototype.requestFullscreen;
  const originalPause = dom.window.HTMLMediaElement.prototype.pause;
  const originalLoad = dom.window.HTMLMediaElement.prototype.load;
  dom.window.HTMLMediaElement.prototype.pause = () => undefined;
  dom.window.HTMLMediaElement.prototype.load = () => undefined;
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: undefined });
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    const preview = screen.getByRole('region', { name: 'Interactive TV Preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Down' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    const player = preview.querySelector('video');
    assert.ok(player);
    const trigger = screen.getByRole('button', { name: 'View full screen' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Full-screen TV Preview' });
    assert.equal(dialog.querySelectorAll('.preview-wrap').length, 1);
    assert.equal(dialog.querySelectorAll('.remote-bar').length, 1);
    assert.equal(screen.queryByRole('button', { name: 'View full screen' }), null);
    assert.equal(dialog.querySelector('video'), player);
    assert.ok(dialog.contains(document.querySelector('.channel-dock')));
    assert.equal(document.querySelector<HTMLElement>('.channel-editor')?.hasAttribute('inert'), false);
    assert.equal(document.querySelector<HTMLElement>('.sidebar')?.inert, true);
    fireEvent.keyDown(player, { key: 'Backspace' });
    assert.equal(dialog.querySelector('video'), null);
    assert.ok(screen.getByRole('button', { name: /Play film/ }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Exit full screen' }), { key: 'Backspace' });
    assert.equal(screen.queryByRole('button', { name: /Play film/ }), null);
    assert.ok(dialog.classList.contains('preview-fullscreen'));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => assert.equal(screen.queryByRole('dialog', { name: 'Full-screen TV Preview' }), null));
    await waitFor(() => assert.equal(document.activeElement, trigger));
    assert.equal(document.querySelector<HTMLElement>('.channel-editor')?.hasAttribute('inert'), false);
    fireEvent.click(trigger);
    assert.ok(screen.getByRole('dialog', { name: 'Full-screen TV Preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }));
    await waitFor(() => assert.equal(screen.queryByRole('dialog', { name: 'Full-screen TV Preview' }), null));
  } finally {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: original });
    dom.window.HTMLMediaElement.prototype.pause = originalPause;
    dom.window.HTMLMediaElement.prototype.load = originalLoad;
    restore();
  }
});

test('Clean View hides Studio chrome and recovers by H, corner, editor shortcut and Escape', async () => {
  const restore = mockApi([first]);
  const original = HTMLElement.prototype.requestFullscreen;
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: undefined });
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    const preview = screen.getByRole('region', { name: 'Interactive TV Preview' });
    const editor = document.querySelector('.channel-editor');
    const trigger = screen.getByRole('button', { name: 'View full screen' });
    fireEvent.click(trigger);
    const root = screen.getByRole('dialog', { name: 'Full-screen TV Preview' });
    assert.ok(root.querySelector('.remote-bar'));
    assert.ok(root.querySelector('.fullscreen-controls'));
    fireEvent.click(screen.getByRole('button', { name: /Hide controls/ }));
    assert.ok(root.classList.contains('clean-view'));
    assert.equal(root.querySelector('.preview-heading')?.hasAttribute('hidden'), true);
    assert.equal(root.querySelector('.remote-bar')?.hasAttribute('hidden'), true);
    assert.equal(root.querySelector('.channel-dock')?.hasAttribute('inert'), true);
    assert.equal(screen.queryByRole('button', { name: 'Exit full screen' }), null);
    assert.equal(screen.queryByRole('button', { name: 'Up' }), null);
    assert.equal(screen.queryByRole('button', { name: /editing drawer/ }), null);
    assert.equal(preview, root.querySelector('.preview-wrap'));
    assert.equal(editor, root.querySelector('.channel-editor'));
    const tv = root.querySelector<HTMLElement>('.tv-frame')!;
    tv.focus();
    fireEvent.keyDown(tv, { key: 'Tab', shiftKey: true });
    assert.equal(document.activeElement, screen.getByRole('button', { name: /Show full-screen controls/ }));
    fireEvent.keyDown(root.querySelector<HTMLInputElement>('.channel-dock input')!, { key: 'h' });
    assert.ok(root.classList.contains('clean-view'));
    fireEvent.keyDown(tv, { key: 'h', ctrlKey: true });
    assert.ok(root.classList.contains('clean-view'));
    fireEvent.keyDown(tv, { key: 'h' });
    assert.equal(root.classList.contains('clean-view'), false);
    fireEvent.keyDown(tv, { key: 'h' });
    assert.ok(root.classList.contains('clean-view'));
    fireEvent.pointerEnter(screen.getByRole('button', { name: /Show full-screen controls/ }), { pointerType: 'mouse' });
    assert.equal(root.classList.contains('clean-view'), false);
    fireEvent.click(screen.getByRole('button', { name: /Hide controls/ }));
    fireEvent.click(screen.getByRole('button', { name: /Show full-screen controls/ }));
    assert.equal(root.classList.contains('clean-view'), false);
    fireEvent.click(screen.getByRole('button', { name: /Hide controls/ }));
    fireEvent.keyDown(root, { key: 'e', altKey: true });
    assert.equal(root.classList.contains('clean-view'), false);
    assert.ok(root.classList.contains('dock-revealed'));
    assert.equal(editor, root.querySelector('.channel-editor'));
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(document.activeElement, root.querySelector('.studio-subviews button'));
    fireEvent.click(screen.getByRole('button', { name: /Hide controls/ }));
    fireEvent.keyDown(root, { key: 'Escape' });
    await waitFor(() => assert.equal(root.classList.contains('preview-fullscreen'), false));
    assert.equal(root.classList.contains('clean-view'), false);
    await waitFor(() => assert.equal(document.activeElement, trigger));
  } finally {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: original });
    restore();
  }
});

test('fullscreen geometry and overlay placement override normal mode at every breakpoint', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const fullscreen = css.split('/* Fullscreen is a responsive TV canvas;')[1];
  assert.ok(fullscreen);
  assert.match(fullscreen, /body:has\(\.preview-fullscreen\)\{overflow:hidden\}/);
  assert.match(fullscreen, /\.channel-presentation.preview-fullscreen\{width:100vw\}/);
  assert.match(fullscreen, /\.preview-fullscreen \.channel-tv-stage \.tv-frame\{width:100%;height:100%;max-width:none;max-height:none;aspect-ratio:auto/);
  assert.match(fullscreen, /@media\(max-width:690px\)\{\.preview-fullscreen \.channel-tv-stage \.tv-frame\{width:100%;height:100%;max-height:none;aspect-ratio:auto\}\}/);
  assert.match(fullscreen, /@container \(max-width:700px\)/);
  assert.match(fullscreen, /\.preview-fullscreen:not\(\.clean-view\) \.tv-screen\{padding-top:76px\}/);
  assert.match(fullscreen, /\.preview-fullscreen \.tv-grid \.tv-items\{display:grid;grid-template-columns:repeat\(auto-fit/);
  assert.match(fullscreen, /\.preview-fullscreen \.channel-dock-handle\{border-color:#62686c;background:#2d3033/);
  assert.match(css, /\.preview-fullscreen \.channel-tv-stage \.remote-bar\{[^}]*left:auto;right:12px;bottom:12px/);
  assert.match(css, /\.preview-fullscreen \.channel-tv-stage \.preview-heading\{[^}]*top:12px;right:12px/);
  assert.match(css, /\.preview-fullscreen \.preview-heading\[hidden\],\.preview-fullscreen \.remote-bar\[hidden\]/);
});

test('native fullscreen success and rejection keep one Preview and return focus', async () => {
  const restore = mockApi([first]);
  const originalRequest = HTMLElement.prototype.requestFullscreen;
  const originalExit = document.exitFullscreen;
  let fullscreenElement: Element | null = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: function (this: HTMLElement) { fullscreenElement = this; document.dispatchEvent(new dom.window.Event('fullscreenchange')); return Promise.resolve(); } });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: () => { fullscreenElement = null; document.dispatchEvent(new dom.window.Event('fullscreenchange')); return Promise.resolve(); } });
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    const preview = screen.getByRole('region', { name: 'Interactive TV Preview' });
    const trigger = screen.getByRole('button', { name: 'View full screen' });
    fireEvent.click(trigger);
    await screen.findByRole('button', { name: 'Exit full screen' });
    assert.equal(document.querySelectorAll('.preview-wrap').length, 1);
    assert.equal(preview, document.querySelector('.preview-wrap'));
    assert.equal(document.fullscreenElement?.id, 'channel-fullscreen-root');
    assert.ok(document.fullscreenElement?.querySelector('.channel-dock'));
    fullscreenElement = null;
    fireEvent(document, new dom.window.Event('fullscreenchange'));
    await waitFor(() => assert.equal(screen.queryByRole('button', { name: 'Exit full screen' }), null));
    await waitFor(() => assert.equal(document.activeElement, trigger));
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: () => Promise.reject(new Error('denied')) });
    fireEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'Full-screen TV Preview' });
    assert.equal(document.querySelectorAll('.preview-wrap').length, 1);
  } finally {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: originalRequest });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: originalExit });
    Reflect.deleteProperty(document, 'fullscreenElement');
    restore();
  }
});

test('fullscreen left drawer reveals at the edge, stays open for focus and edits, and has touch and keyboard access', async () => {
  const restore = mockApi([first]);
  const original = HTMLElement.prototype.requestFullscreen;
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: undefined });
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    const preview = screen.getByRole('region', { name: 'Interactive TV Preview' });
    const editor = document.querySelector('.channel-editor');
    fireEvent.click(screen.getByRole('button', { name: 'View full screen' }));
    const root = document.getElementById('channel-fullscreen-root')!;
    Object.defineProperty(root, 'getBoundingClientRect', { configurable: true, value: () => ({ left: 0, bottom: 1000 }) });
    assert.equal(preview, root.querySelector('.preview-wrap'));
    assert.equal(editor, root.querySelector('.channel-editor'));
    assert.equal(root.classList.contains('dock-revealed'), false);
    const pointerAt = (x: number, y = 500) => fireEvent(root, Object.assign(new dom.window.Event('pointermove', { bubbles: true }), { clientX: x, clientY: y, pointerType: 'mouse' }));
    pointerAt(200, 990);
    assert.equal(root.classList.contains('dock-revealed'), false);
    pointerAt(25);
    assert.equal(root.classList.contains('dock-revealed'), true);
    const dock = root.querySelector<HTMLElement>('.channel-dock')!;
    const editorBody = dock.querySelector<HTMLElement>('.channel-dock-body')!;
    editorBody.scrollTop = 125;
    assert.equal(dock.hasAttribute('inert'), false);
    await waitFor(() => assert.equal(root.classList.contains('dock-revealed'), false), { timeout: 1700 });
    assert.equal(dock.hasAttribute('inert'), true);
    fireEvent.touchStart(root, { touches: [{ clientX: 200, clientY: 990 }] });
    assert.equal(root.classList.contains('dock-revealed'), false);
    fireEvent.touchStart(root, { touches: [{ clientX: 18, clientY: 500 }] });
    assert.equal(root.classList.contains('dock-revealed'), true);
    fireEvent.click(screen.getByRole('button', { name: 'Hide editing drawer (Alt+E)' }));
    assert.equal(root.classList.contains('dock-revealed'), false);
    fireEvent.click(screen.getByRole('button', { name: 'Show editing drawer (Alt+E)' }));
    assert.equal(root.classList.contains('dock-revealed'), true);
    const pages = dock.querySelector<HTMLButtonElement>('.studio-subviews button')!;
    pages.focus();
    await new Promise(resolve => setTimeout(resolve, 1300));
    assert.equal(root.classList.contains('dock-revealed'), true);
    fireEvent.click(dock.querySelector<HTMLButtonElement>('.layout-section button')!);
    assert.ok(dock.querySelector('.layout-inspector'));
    fireEvent.click(dock.querySelector<HTMLButtonElement>('[aria-label="Close layout inspector"]')!);
    fireEvent.click(dock.querySelector<HTMLButtonElement>('.layout-page-rail button:last-child')!);
    assert.ok(dock.querySelector('[role="dialog"]'));
    fireEvent.focusOut(dock, { relatedTarget: root.querySelector('.tv-frame') });
    await new Promise(resolve => setTimeout(resolve, 1300));
    assert.equal(root.classList.contains('dock-revealed'), true);
    fireEvent.click(dock.querySelector<HTMLButtonElement>('.page-dialog button[type="button"]')!);
    fireEvent.keyDown(root, { key: 'Escape' });
    await waitFor(() => assert.equal(root.classList.contains('preview-fullscreen'), false));
    assert.equal(editorBody.scrollTop, 125);
    fireEvent.click(screen.getByRole('button', { name: 'View full screen' }));
    const handle = screen.getByRole('button', { name: 'Show editing drawer (Alt+E)' });
    fireEvent.pointerEnter(handle, { pointerType: 'mouse' });
    assert.equal(root.classList.contains('dock-revealed'), true);
    fireEvent.click(handle);
    assert.equal(root.classList.contains('dock-revealed'), false);
    fireEvent.click(handle);
    assert.equal(root.classList.contains('dock-revealed'), true);
    assert.equal(handle.getAttribute('aria-controls'), 'channel-editor-drawer');
    fireEvent.keyDown(window, { key: 'e', altKey: true });
    assert.equal(document.activeElement, pages);
    fireEvent.click(dock.querySelectorAll<HTMLButtonElement>('.studio-subviews button')[1]!);
    const title = dock.querySelector<HTMLInputElement>('.channel-appearance input')!;
    fireEvent.change(title, { target: { value: 'Unsaved fullscreen title' } });
    root.querySelector<HTMLButtonElement>('.preview-exit')!.focus();
    await new Promise(resolve => setTimeout(resolve, 1300));
    assert.equal(root.classList.contains('dock-revealed'), true);
    fireEvent.keyDown(root, { key: 'Escape' });
    await waitFor(() => assert.equal(root.classList.contains('preview-fullscreen'), false));
    assert.equal(title.value, 'Unsaved fullscreen title');
    await waitFor(() => assert.equal(document.activeElement, screen.getByRole('button', { name: 'View full screen' })));
  } finally {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: original });
    restore();
  }
});

test('an external project switch closes fallback before showing the next channel', async () => {
  const restore = mockApi([first, second]);
  const original = HTMLElement.prototype.requestFullscreen;
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: undefined });
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel ${first.spec.title}` });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    fireEvent.click(screen.getByRole('button', { name: 'View full screen' }));
    assert.ok(screen.getByRole('dialog', { name: 'Full-screen TV Preview' }));
    fireEvent.click(screen.getByRole('button', { name: /Switch workspace, current channel/ }));
    fireEvent.click(screen.getByRole('button', { name: second.spec.title }));
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(document.querySelector('.topbar'), null);
    assert.equal(document.querySelector('.project-select'), null);
    assert.equal(document.querySelector('.preview-fullscreen'), null);
    await screen.findByRole('button', { name: `Switch workspace, current channel Second channel` });
    assert.equal(document.querySelectorAll('.preview-wrap').length, 1);
  } finally {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: original });
    restore();
  }
});
