import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMutation, starterChannel } from '@vegalaunch/channel-engine';
import type { ContentItem } from '@vegalaunch/contracts';
import { changeSectionContent } from '../src/section-content.js';

const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const video: ContentItem = { id: id('item', '1'), title: 'Film', description: '', artwork: 'assets/film.png',
  presentation: 'video', mediaUrl: 'https://media.example/film.m3u8' };
const audio: ContentItem = { id: id('item', '2'), title: 'Track', description: '', artwork: 'assets/track.png',
  presentation: 'audio', mediaUrl: 'https://media.example/track.mp3' };
const book: ContentItem = { id: id('item', '3'), title: 'Book', description: 'Synopsis', artwork: 'assets/book.png',
  presentation: 'information', author: 'Author' };
const audiobook: ContentItem = { ...book, id: id('item', '4'), title: 'Spoken Book',
  audiobook: { mediaUrl: 'https://media.example/spoken.mp3' } };

test('mixed selections bind once to the chosen Hero, Row, Grid and extra Row in saved order', () => {
  let spec = starterChannel('Mixed', id('ch', 'a'), id('page', 'b'));
  const home = spec.pages[0]!;
  const hero = home.modules[0]!.id, row = home.modules[1]!.id;
  const grid = id('mod', 'c'), extra = id('mod', 'd');
  spec = applyMutation(spec, { type: 'addModule', pageId: home.id, module: { id: grid, kind: 'grid', title: 'All', contentIds: [] } });
  spec = applyMutation(spec, { type: 'addModule', pageId: home.id, module: { id: extra, kind: 'rail', title: 'More', contentIds: [] } });
  const otherPage = id('page', 'e');
  spec = applyMutation(spec, { type: 'addPage', page: { id: otherPage, title: 'Elsewhere', modules: [
    { id: id('mod', 'f'), kind: 'grid', title: 'Untouched', contentIds: [] }] } });
  for (const item of [video, audio, book, audiobook]) {
    spec = changeSectionContent(spec, home.id, row, item.id, true, item);
    spec = changeSectionContent(spec, home.id, grid, item.id, true, item);
    spec = changeSectionContent(spec, home.id, extra, item.id, true, item);
  }
  spec = changeSectionContent(spec, home.id, hero, book.id, true, book);
  const read = (moduleId: string) => spec.pages[0]!.modules.find(module => module.id === moduleId)!;
  assert.deepEqual([row, grid, extra].map(moduleId => 'contentIds' in read(moduleId) ? read(moduleId).contentIds : []),
    Array.from({ length: 3 }, () => [video.id, audio.id, book.id, audiobook.id]));
  assert.deepEqual(spec.content.map(item => item.id), [video.id, audio.id, book.id, audiobook.id]);
  assert.equal(spec.content.find(item => item.id === book.id)?.mediaUrl, undefined);
  assert.equal(spec.content.find(item => item.id === audiobook.id)?.audiobook?.mediaUrl,
    'https://media.example/spoken.mp3');
  assert.equal(changeSectionContent(spec, home.id, row, video.id, true, video), spec, 'repeat is idempotent');
  spec = changeSectionContent(spec, home.id, row, book.id, false);
  assert.deepEqual('contentIds' in read(row) ? read(row).contentIds : [], [video.id, audio.id, audiobook.id]);
  assert.ok('contentIds' in read(grid) && read(grid).contentIds.includes(book.id));
  assert.ok('contentIds' in read(hero) && read(hero).contentIds.includes(book.id));
  assert.equal(spec.content.length, 4, 'section removal retains catalog binding and other references');
  assert.deepEqual((spec.pages.find(page => page.id === otherPage)?.modules[0] as { contentIds: string[] }).contentIds, []);
  assert.throws(() => changeSectionContent(spec, home.id, hero, audio.id, true, audio));
  assert.throws(() => changeSectionContent(spec, home.id, row, id('item', '9'), true), { code: 'CONFLICT' });
});
