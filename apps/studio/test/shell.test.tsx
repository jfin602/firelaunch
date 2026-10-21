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

test('appearance editor keeps unsaved changes guarded across dock tabs and projects', async () => {
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
    assert.ok(screen.getByRole('complementary', { name: 'Appearance editor' }));
    const title = screen.getByLabelText('DISPLAY NAME') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Unsaved name' } });
    window.confirm = () => false;
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Layout' }));
    assert.ok(screen.getByRole('complementary', { name: 'Appearance editor' }));
    window.confirm = () => true;
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Layout' }));
    assert.equal(screen.queryByRole('complementary', { name: 'Appearance editor' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch project' }), { target: { value: second.id } });
    await screen.findByRole('heading', { name: 'Second channel', level: 1 });
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
  assert.match(shell, /\.sidebar-project \.project-select\s*\{\s*display:\s*block/);
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
    await screen.findByRole('heading', { name: first.spec.title, level: 1 });
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch project' }), { target: { value: second.id } });
    await screen.findByRole('heading', { name: 'Second channel', level: 1 });
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
    await screen.findByRole('heading', { name: first.spec.title, level: 1 });
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
    await screen.findByRole('heading', { name: first.spec.title, level: 1 });
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
    await screen.findByRole('heading', { name: first.spec.title, level: 1 });
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
    await screen.findByRole('heading', { name: first.spec.title, level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    fireEvent.click(screen.getByRole('button', { name: 'View full screen' }));
    assert.ok(screen.getByRole('dialog', { name: 'Full-screen TV Preview' }));
    fireEvent.change(document.querySelector<HTMLSelectElement>('.project-select')!, { target: { value: second.id } });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(document.querySelector('.topbar h1')?.textContent, 'Second channel');
    assert.equal(document.querySelector('.preview-fullscreen'), null);
    await screen.findByRole('heading', { name: 'Second channel', level: 1 });
    assert.equal(document.querySelectorAll('.preview-wrap').length, 1);
  } finally {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: original });
    restore();
  }
});
