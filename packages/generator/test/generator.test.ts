import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';
import { generateProject, writeGeneratedProject } from '../src/index.js';
import { televisionFromSpec } from '@firelaunch/tv';
import type { ChannelDeployment } from '@firelaunch/contracts';

test('deterministic tree contains true shared runtime, manifest and projected content', async () => {
  const spec = fixtureChannel();
  const first = await generateProject(spec);
  const second = await generateProject(spec);
  assert.deepEqual([...first.files], [...second.files]);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(JSON.parse(first.files.get('src/channel.json')!), televisionFromSpec(spec));
  assert.match(first.files.get('manifest.toml')!, /categories = \["com\.amazon\.category\.main"\]/);
  assert.match(first.files.get('manifest.toml')!, /runtime-module = "\/com\.amazon\.kepler\.runtime\.react_native_kepler_4@IReactNativeKepler_0"/);
  assert.match(first.files.get('manifest.toml')!, /\[os\.version\]\nmin = "1\.2"\ntarget = "1\.2"/);
  assert.equal(JSON.parse(first.files.get('package.json')!).dependencies['react-native'], '0.83.0');
  assert.equal(JSON.parse(first.files.get('package.json')!).devDependencies['@babel/plugin-transform-export-namespace-from'], undefined);
  assert.doesNotMatch(first.files.get('babel.config.js')!, /@babel\/plugin-transform-export-namespace-from/);
  assert.equal(JSON.parse(first.files.get('app.json')!).name, `com.firelaunch.channel.${spec.id}.main`);
  assert.match(first.files.get('src/tv-runtime.js')!, /function transition\(/);
  const generatedRuntime = await import(`data:text/javascript,${encodeURIComponent(first.files.get('src/tv-runtime.js')!)}`);
  const projected = JSON.parse(first.files.get('src/channel.json')!);
  assert.deepEqual(generatedRuntime.initialState(projected),
    { screen: 'page', pageId: spec.navigation[0], focusId: `nav:${spec.navigation[0]}` });
  assert.equal(generatedRuntime.transition(projected, generatedRuntime.initialState(projected), 'down').focusId,
    `item:${spec.navigation[0]}:${spec.pages[0]!.modules[0]!.id}:${spec.content[0]!.id}`);
  assert.match(first.files.get('src/App.js')!, /from '\.\/tv-runtime'/);
  assert.deepEqual(JSON.parse(first.files.get('firelaunch.json')!).unresolvedAssets, ['assets/ocean.jpg']);
  assert.notEqual((await generateProject({ ...spec, title: 'Another' })).fingerprint, first.fingerprint);
  const quoted = await generateProject({ ...spec, title: 'A "quoted" channel' });
  assert.match(quoted.files.get('manifest.toml')!, /title = "A \\"quoted\\" channel"/);
});

test('writes source once and never overwrites customized files', async () => {
  const destination = await mkdtemp(join(tmpdir(), 'firelaunch-vega-'));
  try {
    const project = await writeGeneratedProject(fixtureChannel(), destination);
    assert.equal(await readFile(join(destination, 'src/channel.json'), 'utf8'), project.files.get('src/channel.json'));
    await assert.rejects(writeGeneratedProject(fixtureChannel(), destination), /empty, non-symlink/);
    assert.equal(await readFile(join(destination, 'src/App.js'), 'utf8'), project.files.get('src/App.js'));
    await assert.rejects(writeGeneratedProject(fixtureChannel(), 'relative'), /absolute/);
  } finally { await rm(destination, { recursive: true, force: true }); }
});

test('rejects occupied destinations without writing any generated files', async () => {
  const destination = await mkdtemp(join(tmpdir(), 'firelaunch-vega-'));
  try {
    await writeFile(join(destination, 'custom.txt'), 'creator content');
    await assert.rejects(writeGeneratedProject(fixtureChannel(), destination), /empty, non-symlink/);
    assert.deepEqual(await readdir(destination), ['custom.txt']);
  } finally { await rm(destination, { recursive: true, force: true }); }
});

test('generated projection and bundled runtime keep informational and audio semantics', async () => {
  const spec = fixtureChannel();
  const book = { id: 'item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', title: 'Guide', description: 'A book', artwork: 'assets/ocean.jpg', presentation: 'information' as const };
  const audio = { ...spec.content[0]!, id: 'item_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', presentation: 'audio' as const };
  const module = { ...spec.pages[0]!.modules[0]!, kind: 'rail' as const, title: 'Browse', contentIds: [book.id, audio.id] };
  const mixed = { ...spec, content: [...spec.content, book, audio], pages: [{ ...spec.pages[0]!, modules: [module] }] };
  const generated = await generateProject(mixed);
  const projected = JSON.parse(generated.files.get('src/channel.json')!);
  assert.deepEqual(projected, televisionFromSpec(mixed));
  assert.equal(projected.pages[0].modules[0].items[0].mediaUrl, undefined);
  const runtime = await import(`data:text/javascript,${encodeURIComponent(generated.files.get('src/tv-runtime.js')!)}`);
  let state = runtime.transition(projected, runtime.initialState(projected), 'down');
  state = runtime.transition(projected, state, 'select');
  assert.equal(state.screen, 'detail');
  assert.deepEqual(runtime.transition(projected, state, 'select'), state);
  state = runtime.transition(projected, state, 'back');
  state = runtime.transition(projected, state, 'right');
  assert.equal(runtime.transition(projected, runtime.transition(projected, state, 'select'), 'select').screen, 'playback');
  assert.match(generated.files.get('src/App.js')!, /playerBackButton/);
  assert.match(generated.files.get('src/App.js')!, /Back to channel/);
});

test('bound deployments pin public identity while legacy generation remains static', async () => {
  const spec = fixtureChannel();
  const deployment: ChannelDeployment = { schemaVersion: 1, id: `dep_${'a'.repeat(32)}`,
    creatorAccountId: `cr_${'b'.repeat(32)}`, projectId: spec.id, channelId: spec.id,
    appName: 'Creator channel', packageId: 'com.creator.channel', releaseControl: 'creator',
    nativeReleaseApproval: 'pending_creator', manifestEndpoint: 'https://channels.example.org/',
    consoleEvidence: { state: 'none' } };
  const generated = await generateProject(spec, deployment);
  assert.deepEqual(JSON.parse(generated.files.get('src/release-config.json')!), {
    deploymentId: deployment.id, channelId: spec.id, packageId: deployment.packageId, origin: 'https://channels.example.org'
  });
  assert.equal(JSON.parse(generated.files.get('src/release-config.json')!).creatorAccountId, undefined);
  assert.equal(JSON.parse(generated.files.get('app.json')!).name, 'com.creator.channel.main');
  assert.equal(JSON.parse(generated.files.get('app.json')!).displayName, deployment.appName);
  assert.match(generated.files.get('manifest.toml')!, /title = "Creator channel"/);
  const unbound = await generateProject(spec);
  assert.equal(JSON.parse(unbound.files.get('app.json')!).displayName, spec.title);
  assert.match(unbound.files.get('manifest.toml')!, new RegExp(`title = "${spec.title}"`));
  assert.notEqual(generated.fingerprint, (await generateProject(spec, { ...deployment, appName: 'Renamed creator app' })).fingerprint);
  assert.match(generated.files.get('manifest.toml')!, /id = "com\.creator\.channel"/);
  const fallback = JSON.parse(generated.files.get('src/channel.json')!);
  assert.deepEqual(fallback.pages[0].modules[0].items, []);
  assert.deepEqual(fallback.pages[0].modules[0].body, 'Connect to load this channel.');
  assert.equal(generated.files.get('src/channel.json')!.includes(spec.content[0]!.mediaUrl!), false);
  assert.deepEqual(JSON.parse(generated.files.get('firelaunch.json')!).unresolvedAssets, []);
  assert.notEqual(generated.fingerprint, (await generateProject(spec)).fingerprint);
  assert.equal((await generateProject(spec)).files.has('src/release-config.json'), false);
  assert.equal(JSON.parse((await generateProject(spec)).files.get('package.json')!).dependencies['@react-native-async-storage/async-storage'], undefined);
  assert.match(generated.files.get('src/release-client.js')!, /AsyncStorage/);
  assert.equal(JSON.parse(generated.files.get('package.json')!).devDependencies['@babel/plugin-transform-export-namespace-from'], '7.29.7');
  assert.match(generated.files.get('babel.config.js')!, /@babel\/plugin-transform-export-namespace-from/);
  assert.equal(JSON.parse(generated.files.get('package.json')!).dependencies['@react-native-async-storage/async-storage'],
    'npm:@amazon-devices/react-native-async-storage__async-storage@2.1.9000000000');
  await assert.rejects(generateProject(spec, { ...deployment, manifestEndpoint: undefined }), /pinned HTTPS/);
  await assert.rejects(generateProject(spec, { ...deployment, manifestEndpoint: 'https://channels.example.org/elsewhere' }), /Invalid deployment resolver/);
  await assert.rejects(generateProject(spec, { ...deployment, manifestEndpoint: 'https://localhost./' }), /Unsafe deployment resolver/);
  await assert.rejects(generateProject(spec, { ...deployment, projectId: `ch_${'f'.repeat(32)}` }), /channel IDs must match/);
});
