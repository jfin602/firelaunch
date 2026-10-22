import assert from 'node:assert/strict';
import test from 'node:test';
import { HeroImageQueue, heroArtworkGroups } from '../src/hero-image-queue.js';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('hero artwork priorities follow current card, right, left, row, then page', async () => {
  const groups = heroArtworkGroups('c', ['a', 'b', 'c', 'd', 'e'], ['next', 'a']);
  assert.deepEqual(groups, [['c'], ['d', 'b'], ['a', 'e'], ['next']]);
  const started: string[] = [], finish = new Map<string, (ok: boolean) => void>();
  const queue = new HeroImageQueue(url => { started.push(url); return new Promise(resolve => finish.set(url, resolve)); }, 2, 4);
  queue.schedule(groups);
  await tick();
  assert.deepEqual(started, ['c', 'd']);
  queue.schedule(heroArtworkGroups('e', ['a', 'b', 'c', 'd', 'e'], ['next']));
  finish.get('c')!(true);
  await tick();
  assert.equal(started[2], 'e', 'new focus outranks the old row');
  for (const url of ['d', 'e', 'b', 'a', 'next']) { finish.get(url)?.(true); await tick(); }
  assert.ok(queue.ready('e'));
  assert.equal(started.filter(url => url === 'c').length, 1);
});

test('deduplicates foreground/backdrop, caches success, and bounds failed retries', async () => {
  const calls: string[] = [];
  const queue = new HeroImageQueue(async url => { calls.push(url); return url !== 'bad'; }, 2, 4);
  const [first, second] = await Promise.all([queue.request('wide', 0), queue.request('wide', 0)]);
  assert.equal(first, true); assert.equal(second, true);
  assert.equal(await queue.request('wide', 0), true);
  assert.deepEqual(calls, ['wide']);
  assert.equal(await queue.request('bad', 0), false);
  assert.equal(await queue.request('bad', 0), false);
  assert.equal(calls.filter(url => url === 'bad').length, 1);
  queue.clear();
  assert.equal(await queue.request('wide', 0), true);
  assert.equal(calls.filter(url => url === 'wide').length, 2, 'new scope reloads artwork');
});
