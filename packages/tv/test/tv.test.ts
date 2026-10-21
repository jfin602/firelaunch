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

test('static sections project image and copy in order without adding D-pad targets', () => {
  const spec = fixtureChannel(), page = spec.pages[0]!;
  const image = { id: `mod_${'a'.repeat(32)}`, kind: 'image-text' as const, title: 'Our story', body: 'Hello', imageContentId: spec.content[0]!.id, imageSide: 'right' as const };
  const tv = televisionFromSpec({ ...spec, pages: [{ ...page, modules: [image, ...page.modules] }] });
  assert.deepEqual(tv.pages[0]!.modules.map(module => module.kind), ['image-text', 'hero']);
  assert.equal(tv.pages[0]!.modules[0]!.image?.artwork, spec.content[0]!.artwork);
  assert.equal(tv.pages[0]!.modules[0]!.body, 'Hello');
  assert.deepEqual(tv.pages[0]!.modules[0]!.items, []);
  assert.equal(focusRows(tv, page.id).length, 2);
});

test('informational detail cannot play and Back returns to its card; audio can play', () => {
  const spec = fixtureChannel();
  const book = { id: 'item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'Guide', description: 'Read about this guide', artwork: 'assets/ocean.jpg', presentation: 'information' as const };
  const audio = { ...spec.content[0]!, id: 'item_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', title: 'Listening Guide', presentation: 'audio' as const };
  const module = { ...spec.pages[0]!.modules[0]!, kind: 'rail' as const, title: 'Browse', contentIds: [book.id, audio.id, spec.content[0]!.id] };
  const tv = televisionFromSpec({ ...spec, content: [...spec.content, book, audio], pages: [{ ...spec.pages[0]!, modules: [module] }] });
  const page = tv.pages[0]!;
  let state = transition(tv, initialState(tv), 'down');
  const bookFocus = itemFocusId(page.id, module.id, book.id);
  assert.equal(state.focusId, bookFocus);
  state = transition(tv, state, 'select');
  assert.equal(state.screen, 'detail');
  assert.equal(state.focusId, `detail:${book.id}`);
  assert.deepEqual(transition(tv, state, 'select'), state);
  state = transition(tv, state, 'back');
  assert.equal(state.focusId, bookFocus);
  state = transition(tv, state, 'right');
  const audioFocus = state.focusId;
  state = transition(tv, transition(tv, state, 'select'), 'select');
  assert.equal(state.screen, 'playback');
  state = transition(tv, transition(tv, state, 'back'), 'back');
  assert.equal(state.focusId, audioFocus);
  state = transition(tv, state, 'right');
  assert.equal(transition(tv, transition(tv, state, 'select'), 'select').screen, 'playback');
});
