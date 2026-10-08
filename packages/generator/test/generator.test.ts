import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';
import { generateProject, writeGeneratedProject } from '../src/index.js';
import { televisionFromSpec } from '@firelaunch/tv';

test('deterministic tree contains true shared runtime, manifest and projected content', async () => {
  const spec = fixtureChannel();
  const first = await generateProject(spec);
  const second = await generateProject(spec);
  assert.deepEqual([...first.files], [...second.files]);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(JSON.parse(first.files.get('src/channel.json')!), televisionFromSpec(spec));
  assert.match(first.files.get('manifest.toml')!, /categories = \["com\.amazon\.category\.main"\]/);
  assert.match(first.files.get('manifest.toml')!, /runtime-module = "\/com\.amazon\.kepler\.runtime\.react_native_kepler_4@IReactNativeKepler_0"/);
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
  assert.match(quoted.files.get('manifest.toml')!, /title = "FireLaunch A \\"quoted\\" channel"/);
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
