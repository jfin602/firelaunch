import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMutation } from '@firelaunch/channel-engine';
import { projectSchema, type ChannelSpec } from '@firelaunch/contracts';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { sampleMutations } from '../src/sample.js';
import { televisionFromSpec, focusRows, transition, initialState } from '@firelaunch/tv';

test('sample creates valid hero/rail/grid and playable detail via canonical mutations', () => {
  const fixture = fixtureChannel();
  const spec: ChannelSpec = { ...fixture, pages: [{ ...fixture.pages[0]!, modules: [] }], content: [] };
  const project = projectSchema.parse({ id: spec.id, revision: 1, spec, createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z' });
  const mutations = sampleMutations(project, 'item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', ['mod_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'mod_cccccccccccccccccccccccccccccccc', 'mod_dddddddddddddddddddddddddddddddd']);
  const next = mutations.reduce((current, mutation) => applyMutation(current, mutation), spec);
  const tv = televisionFromSpec(next);
  assert.deepEqual(tv.pages[0]!.modules.map(module => module.kind), ['hero', 'rail', 'grid']);
  assert.equal(focusRows(tv, tv.pages[0]!.id).length, 4);
  const detail = transition(tv, transition(tv, initialState(tv), 'down'), 'select');
  assert.equal(detail.screen, 'detail');
  assert.equal(transition(tv, detail, 'select').screen, 'playback');
});
