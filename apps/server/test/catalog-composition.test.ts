import assert from 'node:assert/strict';
import test from 'node:test';
import { starterChannel } from '@firelaunch/channel-engine';
import { isPlayableContent, type ContentItem } from '@firelaunch/contracts';
import { initialState, itemFocusId, projectTelevision, transition } from '@firelaunch/tv';
import { composeCatalogDraft } from '../src/catalog-composition.js';
import type { CatalogProjection } from '../src/catalog-projection.js';

const id = (kind: string, digit: string) => `${kind}_${digit.repeat(32)}`;
const channel = starterChannel('Creator channel', id('ch', 'a'), id('page', 'a'));
const film: ContentItem = { id: id('item', '1'), title: 'Feature Film', description: 'A film', artwork: 'assets/catalog-placeholder.png', presentation: 'video', mediaUrl: 'https://media.example/film.mp4' };
const episode: ContentItem = { id: id('item', '2'), title: 'Episode', description: 'A series episode', artwork: 'assets/catalog-placeholder.png', presentation: 'video', mediaUrl: 'https://media.example/episode.mp4' };
const track: ContentItem = { id: id('item', '3'), title: 'Album track', description: 'A track', artwork: 'assets/catalog-placeholder.png', presentation: 'audio', mediaUrl: 'https://media.example/track.mp3' };
const book: ContentItem = { id: id('item', '4'), title: 'A Book', description: 'A novel', artwork: 'assets/catalog-placeholder.png', presentation: 'information' };
const reading: ContentItem = { id: id('item', '5'), title: 'Author reading', description: 'A reading', artwork: 'assets/catalog-placeholder.png', presentation: 'audio', mediaUrl: 'https://media.example/reading.mp3' };
function projection(items: ContentItem[], blocked: string[] = []): CatalogProjection {
  return { projectRevision: 1, catalogRevision: 2,
    bindings: [...items.map((item, index) => ({ catalogItemId: id('ci', String(index + 1)), contentId: item.id, collectionIds: [], baseline: item })),
      ...blocked.map((contentId, index) => ({ catalogItemId: id('ci', String(index + 8)), contentId, collectionIds: [], baseline: null,
        blockedReason: 'playback_rights_or_delivery_missing' as const }))],
    collections: [
      { id: id('col', '1'), kind: 'series', title: 'Series One', contentIds: [episode.id] },
      { id: id('col', '5'), kind: 'featured', title: 'Cleared trailer', contentIds: [episode.id] },
      { id: id('col', '2'), kind: 'album', title: 'Album One', contentIds: [track.id] },
      { id: id('col', '3'), kind: 'playlist', title: 'Favorites', contentIds: [track.id] },
      { id: id('col', '4'), kind: 'bookshelf', title: 'Novels', contentIds: [book.id] }
    ] };
}

function openFirstItem(spec: ReturnType<typeof starterChannel>, pageIndex: number, itemId: string) {
  const tv = projectTelevision(spec);
  const page = tv.pages[pageIndex]!;
  const module = page.modules.find(candidate => candidate.kind !== 'hero' && candidate.items.some(item => item.id === itemId))!;
  assert.ok(module, 'item needs a selectable rail or grid on this page');
  const state = { screen: 'page' as const, pageId: page.id, focusId: itemFocusId(page.id, module.id, itemId) };
  const detail = transition(tv, state, 'select');
  assert.equal(detail.screen, 'detail');
  assert.deepEqual(transition(tv, detail, 'back'), state);
  return transition(tv, detail, 'select');
}

test('three creator drafts have distinct topology and coherent TV focus/playback', () => {
  const video = composeCatalogDraft('video', channel, projection([film, episode])).spec;
  assert.deepEqual(video.pages.map(page => page.title), ['Featured', 'Series']);
  assert.ok(video.pages[0]!.modules.some(module => module.kind === 'hero'));
  assert.ok(video.pages[1]!.modules.some(module => module.kind === 'grid'));
  assert.ok(video.pages[1]!.modules.some(module => module.kind === 'rail' && module.title === 'Series One'));
  assert.ok(video.pages[0]!.modules.some(module => module.kind === 'rail' && module.title === 'Cleared trailer'));
  assert.equal(openFirstItem(video, 0, film.id).screen, 'playback');
  assert.equal(initialState(projectTelevision(video)).focusId, `nav:${video.navigation[0]}`);

  const audio = composeCatalogDraft('audio', channel, projection([track])).spec;
  assert.deepEqual(audio.pages.map(page => page.title), ['Listen', 'Albums & playlists']);
  assert.ok(audio.pages[1]!.modules.some(module => module.kind === 'rail' && module.title === 'Album One'));
  assert.ok(audio.pages[1]!.modules.some(module => module.kind === 'rail' && module.title === 'Favorites'));
  assert.equal(openFirstItem(audio, 0, track.id).screen, 'playback');

  const writing = composeCatalogDraft('writing', channel, projection([book, reading])).spec;
  assert.deepEqual(writing.pages.map(page => page.title), ['Author', 'Bookshelf']);
  assert.ok(writing.pages[0]!.modules.some(module => module.kind === 'text'));
  assert.ok(writing.pages[1]!.modules.some(module => module.kind === 'rail' && module.title === 'Novels'));
  assert.equal(isPlayableContent(writing.content.find(item => item.id === book.id)!), false);
  assert.equal(openFirstItem(writing, 1, book.id).screen, 'detail');
  assert.equal(openFirstItem(writing, 0, reading.id).screen, 'playback');
});

test('empty and missing-media drafts give honest status; revoked selected media is excluded', () => {
  const blockedId = id('item', '9');
  const empty = composeCatalogDraft('video', channel, projection([], [blockedId]));
  assert.equal(empty.spec.content.length, 0);
  assert.ok(empty.spec.pages[0]!.modules.some(module => module.kind === 'text' && module.body.includes('No licensed video')));
  assert.ok(empty.notices.some(message => message.includes(blockedId)));
  const first = composeCatalogDraft('video', channel, projection([film]));
  const revoked = composeCatalogDraft('video', first.spec, projection([], [film.id]), first.baseline);
  assert.ok(!revoked.spec.content.some(item => item.id === film.id));
  assert.ok(!JSON.stringify(revoked.spec.pages).includes(film.id));
});

test('repeat generation is stable and preserves creator brand, text, module and navigation edits', () => {
  const source = projection([film, episode]);
  const first = composeCatalogDraft('video', channel, source);
  const repeat = composeCatalogDraft('video', first.spec, source, first.baseline);
  assert.deepEqual(repeat.spec, first.spec);
  const edited = structuredClone(first.spec);
  edited.brand.primaryColor = '#123456';
  edited.navigation.reverse();
  edited.content[0]!.title = 'Creator film title';
  edited.pages[0]!.title = 'My films';
  const intro = edited.pages[0]!.modules.find(module => module.kind === 'text')!;
  if (intro.kind !== 'text') throw new Error('Expected text module');
  intro.body = 'Creator introduction';
  edited.pages[0]!.modules.reverse();
  const rail = edited.pages[0]!.modules.find(module => module.kind === 'rail' && module.title === 'Films and episodes')!;
  if (rail.kind !== 'rail') throw new Error('Expected film rail');
  rail.contentIds.reverse();
  const changedSource = projection([{ ...film, description: 'Updated source description' }, episode]);
  const regenerated = composeCatalogDraft('video', edited, changedSource, first.baseline);
  assert.equal(regenerated.spec.brand.primaryColor, '#123456');
  assert.deepEqual(regenerated.spec.navigation, edited.navigation);
  assert.equal(regenerated.spec.pages[0]!.title, 'My films');
  assert.deepEqual(regenerated.spec.pages[0]!.modules.map(m => m.id), edited.pages[0]!.modules.map(m => m.id));
  assert.equal((regenerated.spec.pages[0]!.modules.find(m => m.id === intro.id) as typeof intro).body, 'Creator introduction');
  assert.deepEqual((regenerated.spec.pages[0]!.modules.find(m => m.id === rail.id) as typeof rail).contentIds, rail.contentIds);
  assert.equal(regenerated.spec.content[0]!.title, 'Creator film title');
  assert.equal(regenerated.spec.content[0]!.description, 'Updated source description');
  assert.throws(() => composeCatalogDraft('video', first.spec, source, { ...first.baseline, id: id('ch', 'b') }));
});

test('regeneration keeps authored static sections and clears revoked image links', () => {
  const source = projection([film, episode]);
  const first = composeCatalogDraft('video', channel, source);
  const edited = structuredClone(first.spec);
  const banner = { id: id('mod', '9'), kind: 'image-banner' as const, title: 'About us', body: 'Our note', imageContentId: film.id };
  edited.pages[0]!.modules.push(banner);
  const retained = composeCatalogDraft('video', edited, source, first.baseline).spec;
  assert.deepEqual(retained.pages[0]!.modules.at(-1), banner);
  const revoked = composeCatalogDraft('video', edited, projection([episode], [film.id]), first.baseline).spec;
  const cleaned = revoked.pages[0]!.modules.find(module => module.id === banner.id);
  assert.equal(cleaned?.kind, 'image-banner');
  assert.equal(cleaned?.kind === 'image-banner' ? cleaned.imageContentId : 'unexpected', undefined);
  assert.equal(cleaned?.kind === 'image-banner' ? cleaned.body : '', 'Our note');
});
