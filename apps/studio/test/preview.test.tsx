import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { televisionFromSpec, initialState, itemFocusId, navFocusId } from '@firelaunch/tv';
import { Preview } from '../src/Preview.js';
import { keyboardCommand, navigate, reconcile } from '../src/preview-state.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');

test('pure commands retain P2 focus/detail/playback/back and reconcile removed content', () => {
  const spec = fixtureChannel();
  const tv = televisionFromSpec(spec);
  let state = initialState(tv);
  assert.equal(state.focusId, navFocusId(spec.pages[0]!.id));
  for (const command of ['down', 'select', 'select', 'back', 'back'] as const) state = navigate(tv, state, command);
  assert.equal(state.screen, 'page');
  assert.equal(state.focusId, itemFocusId(spec.pages[0]!.id, spec.pages[0]!.modules[0]!.id, spec.content[0]!.id));
  const empty = televisionFromSpec({ ...spec, pages: [{ ...spec.pages[0]!, modules: [] }], content: [] });
  assert.deepEqual(reconcile(empty, state), initialState(empty));
  assert.equal(keyboardCommand({ key: 'Escape' }), 'back');
  assert.equal(keyboardCommand({ key: 'ArrowLeft' }), 'left');
  assert.equal(keyboardCommand({ key: 'a' }), null);
});

test('virtual remote and keyboard select the same P2 transitions in TV Preview', () => {
  const spec = fixtureChannel();
  const view = render(createElement(Preview, { spec }));
  assert.ok(view.container.querySelector('.tv-nav-button.focused'));
  const editor = document.createElement('input');
  view.container.append(editor);
  fireEvent.keyDown(editor, { key: 'ArrowDown' });
  assert.ok(view.container.querySelector('.tv-nav-button.focused'));
  fireEvent.click(screen.getByRole('button', { name: 'Down' }));
  assert.ok(view.container.querySelector('.tv-card.focused'));
  fireEvent.keyDown(window, { key: 'Enter' });
  assert.ok(screen.getByRole('button', { name: /Play film/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  assert.ok(view.container.querySelector('video'));
  fireEvent.keyDown(window, { key: 'Escape' });
  assert.ok(screen.getByRole('button', { name: /Play film/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  assert.ok(view.container.querySelector('.tv-card.focused'));
  cleanup();
});

test('Preview offers book detail and audio controls without a fake film player', () => {
  const spec = fixtureChannel();
  const book = { id: 'item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'Field Guide', description: 'A book', artwork: 'assets/ocean.jpg', presentation: 'information' as const };
  const audio = { ...spec.content[0]!, id: 'item_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', title: 'Field Recording', presentation: 'audio' as const };
  const module = { ...spec.pages[0]!.modules[0]!, kind: 'rail' as const, title: 'Browse', contentIds: [book.id, audio.id] };
  const mixed = { ...spec, content: [...spec.content, book, audio], pages: [{ ...spec.pages[0]!, modules: [module] }] };
  const view = render(createElement(Preview, { spec: mixed }));
  fireEvent.click(screen.getByRole('button', { name: 'Down' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  assert.ok(screen.getByText('ABOUT THIS TITLE · FEATURE'));
  assert.equal(screen.queryByRole('button', { name: /Play film|Play audio/ }), null);
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  assert.equal(view.container.querySelector('video, audio'), null);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  assert.ok(view.container.querySelector('.tv-card.focused'));
  fireEvent.click(screen.getByRole('button', { name: 'Right' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  assert.ok(screen.getByRole('button', { name: /Play audio/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  assert.ok(view.container.querySelector('audio'));
  assert.equal(view.container.querySelector('video'), null);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  assert.ok(screen.getByRole('button', { name: /Play audio/ }));
  const tv = televisionFromSpec(mixed);
  let playback = navigate(tv, initialState(tv), 'down');
  playback = navigate(tv, playback, 'right');
  playback = navigate(tv, navigate(tv, playback, 'select'), 'select');
  const changed = televisionFromSpec({ ...mixed, content: mixed.content.map(item => item.id === audio.id
    ? { id: audio.id, title: audio.title, description: audio.description, artwork: audio.artwork, presentation: 'information' as const }
    : item) });
  assert.equal(reconcile(changed, playback).screen, 'detail');
  cleanup();
});

test('Studio theme seam leaves creator TV colors and directional focus independent', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const theme = css.split('/* Desert Heat Studio chrome.')[1];
  assert.ok(theme);
  assert.match(theme, /--fl-canyon-image: url\('\/studio-canyon\.svg'\)/);
  assert.match(theme, /prefers-reduced-data: reduce/);
  assert.doesNotMatch(theme, /\.tv-screen\s*\{|--tv-(?:accent|bg|text)\s*:/);
  assert.match(readFileSync(new URL('../public/studio-canyon.svg', import.meta.url), 'utf8'), /<svg\b/);

  const spec = fixtureChannel();
  spec.brand = { ...spec.brand, primaryColor: '#398ae8', backgroundColor: '#102746', textColor: '#f1e8d1' };
  const view = render(createElement(Preview, { spec }));
  const frame = view.container.querySelector<HTMLElement>('.tv-frame')!;
  assert.equal(frame.style.getPropertyValue('--tv-accent'), '#398ae8');
  assert.equal(frame.style.getPropertyValue('--tv-bg'), '#102746');
  assert.equal(frame.style.getPropertyValue('--tv-text'), '#f1e8d1');
  assert.ok(view.container.querySelector('.tv-nav-button.focused'));
  fireEvent.click(screen.getByRole('button', { name: 'Down' }));
  assert.ok(view.container.querySelector('.tv-card.focused'));
  fireEvent.keyDown(window, { key: 'Enter' });
  assert.ok(screen.getByRole('button', { name: /Play film/ }));
  cleanup();
});
