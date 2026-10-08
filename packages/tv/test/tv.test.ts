import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';
import { televisionFromSpec, focusRows, initialState, transition, itemFocusId, navFocusId } from '../src/index.js';

test('projects ordered navigation and resolves modules/content without mutation', () => {
  const spec = fixtureChannel();
  const second = { ...spec.pages[0]!, id: 'page_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'More', modules: [] };
  const tv = televisionFromSpec({ ...spec, pages: [...spec.pages, second], navigation: [second.id, spec.pages[0]!.id] });
  assert.deepEqual(tv.pages.map(page => page.title), ['More', 'Home']);
  assert.equal(tv.pages[1]!.modules[0]!.items[0]!.title, 'Oceans');
  assert.deepEqual(focusRows(tv, second.id), [[navFocusId(second.id), navFocusId(spec.pages[0]!.id)]]);
  assert.throws(() => televisionFromSpec({ ...spec, navigation: [second.id] }));
});

test('D-pad transitions page, detail, playback and back with stable focus', () => {
  const tv = televisionFromSpec(fixtureChannel());
  const page = tv.pages[0]!;
  let state = initialState(tv);
  assert.equal(state.focusId, navFocusId(page.id));
  state = transition(tv, state, 'down');
  const cardId = itemFocusId(page.id, page.modules[0]!.id, page.modules[0]!.items[0]!.id);
  assert.equal(state.focusId, cardId);
  assert.deepEqual(transition(tv, state, 'left'), state);
  state = transition(tv, state, 'select');
  assert.equal(state.screen, 'detail');
  state = transition(tv, state, 'select');
  assert.equal(state.screen, 'playback');
  state = transition(tv, state, 'back');
  assert.equal(state.screen, 'detail');
  state = transition(tv, state, 'back');
  assert.deepEqual(state, { screen: 'page', pageId: page.id, focusId: cardId });
  assert.equal(transition(tv, state, 'back').focusId, navFocusId(page.id));
});

test('empty pages and bounded directional transitions never lose focus', () => {
  const spec = fixtureChannel();
  const tv = televisionFromSpec({ ...spec, pages: [{ ...spec.pages[0]!, modules: [] }] });
  let state = initialState(tv);
  for (const command of ['down', 'up', 'left', 'right', 'back', 'select'] as const) {
    state = transition(tv, state, command);
    assert.equal(state.focusId, navFocusId(tv.pages[0]!.id));
  }
});
