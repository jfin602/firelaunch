import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMutation, starterChannel } from '@firelaunch/channel-engine';
import { projectSchema } from '@firelaunch/contracts';
import { newFilmMediaUrl, sampleMutations, SAMPLE_MEDIA } from '../src/sample.js';
import { televisionFromSpec, focusRows, transition, initialState } from '@firelaunch/tv';

test('sample fills the starter Hero and row without adding sections or changing starter IDs', () => {
  assert.equal(newFilmMediaUrl(true), '');
  assert.equal(newFilmMediaUrl(false), SAMPLE_MEDIA);
  const spec = starterChannel('Films', 'ch_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'page_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  const project = projectSchema.parse({ id: spec.id, revision: 1, spec, createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z' });
  const mutations = sampleMutations(project, ['item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'item_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'item_cccccccccccccccccccccccccccccccc']);
  const next = mutations.reduce((current, mutation) => applyMutation(current, mutation), spec);
  const tv = televisionFromSpec(next);
  assert.deepEqual(tv.pages[0]!.modules.map(module => module.kind), ['hero', 'rail']);
  assert.deepEqual(next.pages[0]!.modules.map(module => module.id), spec.pages[0]!.modules.map(module => module.id));
  assert.deepEqual(next.pages[0]!.modules.flatMap(module => module.kind === 'hero' || module.kind === 'rail' ? module.contentIds : []), [
    'item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'item_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'item_cccccccccccccccccccccccccccccccc'
  ]);
  assert.deepEqual(spec.content, []);
  assert.equal(focusRows(tv, tv.pages[0]!.id).length, 2);
  const detail = transition(tv, transition(tv, initialState(tv), 'down'), 'select');
  assert.equal(detail.screen, 'detail');
  assert.equal(transition(tv, detail, 'select').screen, 'playback');
  assert.throws(() => sampleMutations({ ...project, spec: next }, ['item_dddddddddddddddddddddddddddddddd', 'item_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'item_ffffffffffffffffffffffffffffffff']), /untouched starter/);
});
