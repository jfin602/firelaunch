import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaybackController } from '../../../templates/vega-channel/src/playback-controller.js';
import { generateProject } from '../src/index.js';
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';

test('adaptive HLS uses MSE, plays with sound, seeks, pauses and cleans up on Back', async () => {
  const calls: string[] = [];
  const listeners = new Map<string, () => void>();
  const video = {
    paused: true, muted: true, currentTime: 5, duration: 20,
    initialize: async () => { calls.push('initialize'); },
    deinitialize: async () => { calls.push('deinitialize'); },
    setSurfaceHandle: (handle: string) => calls.push(`surface:${handle}`),
    clearSurfaceHandle: (handle: string) => calls.push(`clear:${handle}`),
    addEventListener: (name: string, fn: () => void) => { listeners.set(name, fn); },
    removeEventListener: (name: string) => { listeners.delete(name); },
    play: async () => { video.paused = false; calls.push('play'); listeners.get('playing')?.(); },
    pause: () => { video.paused = true; calls.push('pause'); listeners.get('pause')?.(); }
  };
  const hlsListeners = new Map<string, () => void>();
  const hls = { Events: { ERROR: 'error', MANIFEST_LOADING: 'manifestLoading', MANIFEST_LOADED: 'manifestLoaded', MANIFEST_PARSED: 'manifestParsed' },
    on: (name: string, fn: () => void) => { hlsListeners.set(name, fn); },
    attachMedia: (instance: unknown) => { assert.equal(instance, video); calls.push('attach'); },
    loadSource: (url: string) => calls.push(`load:${url}`), destroy: async () => calls.push('destroy') };
  const states: string[] = [];
  const controller = createPlaybackController({ createVideo: () => video, createHls: () => hls,
    installPolyfills: () => calls.push('polyfills'), onState: ({ status }: { status: string }) => states.push(status) });
  await controller.start('surface-1', { mediaUrl: 'https://cdn.example.org/release/master.m3u8' }, false);
  assert.equal(video.muted, false);
  assert.deepEqual(calls, ['initialize', 'surface:surface-1', 'polyfills',
    'load:https://cdn.example.org/release/master.m3u8', 'attach']);
  hlsListeners.get('manifestParsed')?.();
  assert.equal(calls.at(-1), 'play');
  controller.seek(10);
  assert.equal(video.currentTime, 15);
  controller.seek(10);
  assert.equal(video.currentTime, 20);
  await controller.toggle();
  assert.equal(video.paused, true);
  await controller.toggle();
  assert.equal(video.paused, false);
  controller.toggleMute();
  assert.equal(video.muted, true);
  await controller.stop();
  assert.equal(calls.at(-3), 'destroy');
  assert.deepEqual(calls.slice(-2), ['clear:surface-1', 'deinitialize']);
  assert.equal(listeners.size, 0);
  assert.ok(states.includes('playing'));
  assert.ok(states.includes('paused'));
});

test('generated source carries patched HLS player and public artwork rendering', async () => {
  const generated = await generateProject(fixtureChannel());
  const app = generated.files.get('src/App.js')!;
  assert.match(app, /createHlsPlayer/);
  assert.match(app, /detailArtwork/);
  assert.match(app, /controls\.current\?\.seek/);
  assert.match(app, /dispatch\('back'\)/);
  assert.ok(generated.files.get('src/hlsjs/hls.mjs')!.length > 100_000);
  assert.match(generated.files.get('src/hlsjs/adapter.js')!, /enableWorker: false/);
  assert.match(generated.files.get('src/hlsjs/adapter.js')!, /fLoader: XhrLoader/);
  const dependencies = JSON.parse(generated.files.get('package.json')!).dependencies;
  assert.equal(dependencies['@xmldom/xmldom'], '0.8.15');
});

test('Back during initialization does not attach or play a stale surface', async () => {
  let finish!: () => void;
  const initialization = new Promise<void>(resolve => { finish = resolve; });
  const calls: string[] = [];
  const video = { initialize: () => initialization,
    deinitialize: async () => { calls.push('deinitialize'); },
    pause: () => { calls.push('pause'); },
    removeEventListener: () => {}, setSurfaceHandle: () => { calls.push('surface'); } };
  const controller = createPlaybackController({ createVideo: () => video, createHls: () => { throw new Error('stale player'); },
    installPolyfills: () => {}, onState: () => {} });
  const start = controller.start('old-surface', { mediaUrl: 'https://cdn.example.org/master.m3u8' }, false);
  await controller.stop();
  finish();
  await start;
  assert.equal(controller.isClosed(), true);
  assert.deepEqual(calls, ['deinitialize']);
});

test('late HLS manifest after Back cannot restart playback', async () => {
  let manifestParsed!: () => void;
  let plays = 0;
  const video = { initialize: async () => {}, deinitialize: async () => {},
    setSurfaceHandle: () => {}, clearSurfaceHandle: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, pause: () => {},
    play: async () => { plays++; } };
  const hls = { Events: { ERROR: 'error', MANIFEST_PARSED: 'manifestParsed' },
    on: (name: string, fn: () => void) => { if (name === 'manifestParsed') manifestParsed = fn; },
    attachMedia: () => {}, loadSource: () => {}, destroy: async () => {} };
  const controller = createPlaybackController({ createVideo: () => video, createHls: () => hls,
    installPolyfills: () => {}, onState: () => {} });
  await controller.start('surface', { mediaUrl: 'https://cdn.example.org/master.m3u8' }, false);
  await controller.stop();
  manifestParsed();
  assert.equal(plays, 0);
});
