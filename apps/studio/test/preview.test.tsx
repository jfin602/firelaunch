import assert from 'node:assert/strict';
import test from 'node:test';
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
