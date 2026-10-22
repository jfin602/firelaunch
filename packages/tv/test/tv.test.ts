import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';
import { accentTextColor, televisionFromSpec, focusRows, heroSelector, heroSpotlight, initialState, transition, itemFocusId, navFocusId } from '../src/index.js';

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

test('a book audiobook uses the player and Back returns to its own detail', () => {
  const spec = fixtureChannel();
  const book = { id: 'item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'Guide', description: 'A book',
    artwork: 'assets/ocean.jpg', presentation: 'information' as const, audiobook: { mediaUrl: 'https://media.example/guide.mp3' } };
  const module = { ...spec.pages[0]!.modules[0]!, kind: 'rail' as const, title: 'Books', contentIds: [book.id] };
  const tv = televisionFromSpec({ ...spec, content: [book], pages: [{ ...spec.pages[0]!, modules: [module] }] });
  let state = transition(tv, transition(tv, initialState(tv), 'down'), 'select');
  assert.equal(state.screen, 'detail');
  state = transition(tv, state, 'select');
  assert.equal(state.screen, 'playback');
  state = transition(tv, state, 'back');
  assert.equal(state.screen, 'detail');
  assert.equal(state.itemId, book.id);
});

test('adjacent Hero and first row share one focused spotlight and preserve Select/Back', () => {
  const spec = fixtureChannel(), base = spec.content[0]!, page = spec.pages[0]!;
  const second = { ...base, id: `item_${'b'.repeat(32)}`, title: 'Second' };
  const rail = { id: `mod_${'b'.repeat(32)}`, kind: 'rail' as const, title: 'Browse', contentIds: [base.id, second.id] };
  const tv = televisionFromSpec({ ...spec, content: [base, second], pages: [{ ...page, modules: [page.modules[0]!, rail] }] });
  const projected = tv.pages[0]!;
  assert.equal(heroSelector(projected)?.selector.id, rail.id);
  assert.equal(heroSpotlight(projected, initialState(tv))?.id, base.id);
  assert.equal(focusRows(tv, page.id).length, 2, 'Hero has no duplicate focus row');
  let state = transition(tv, initialState(tv), 'down');
  assert.equal(state.focusId, itemFocusId(page.id, rail.id, base.id));
  state = transition(tv, state, 'right');
  assert.equal(state.screen, 'page');
  assert.equal(state.focusId, itemFocusId(page.id, rail.id, second.id));
  assert.equal(heroSpotlight(projected, state)?.id, second.id);
  state = transition(tv, state, 'up');
  assert.equal(heroSpotlight(projected, state)?.id, second.id, 'nav focus retains transient spotlight');
  state = transition(tv, state, 'down');
  state = transition(tv, state, 'select');
  assert.equal(state.screen, 'detail');
  assert.equal(state.itemId, second.id);
  assert.equal(heroSpotlight(projected, state)?.id, second.id);
  state = transition(tv, state, 'back');
  assert.equal(state.focusId, itemFocusId(page.id, rail.id, second.id));
  assert.equal(heroSpotlight(projected, state)?.id, second.id);
});

test('Hero selector falls back safely for empty, lone and unrelated sections', () => {
  const spec = fixtureChannel(), page = spec.pages[0]!, hero = page.modules[0]!;
  const empty = televisionFromSpec(spec).pages[0]!;
  assert.equal(heroSelector(empty), undefined);
  assert.equal(heroSpotlight(empty, { screen: 'page', pageId: empty.id, focusId: navFocusId(empty.id) }), undefined);
  const rail = { id: `mod_${'c'.repeat(32)}`, kind: 'rail' as const, title: 'Browse', contentIds: [spec.content[0]!.id] };
  const tv = televisionFromSpec({ ...spec, pages: [{ ...page, modules: [{ ...hero, contentIds: [] }, rail] }] });
  assert.equal(heroSpotlight(tv.pages[0]!, initialState(tv))?.id, spec.content[0]!.id);
  const separated = televisionFromSpec({ ...spec, pages: [{ ...page, modules: [hero,
    { id: `mod_${'d'.repeat(32)}`, kind: 'text', title: 'Story', body: 'Story' }, rail] }] });
  assert.equal(heroSelector(separated.pages[0]!)?.selector.id, rail.id);
  assert.equal(focusRows(separated, page.id).length, 2);
  assert.equal(transition(separated, initialState(separated), 'down').focusId,
    itemFocusId(page.id, rail.id, spec.content[0]!.id));
  assert.equal(accentTextColor('#ff6a00'), '#101812');
  assert.equal(accentTextColor('#1c2840'), '#FFFFFF');
});
