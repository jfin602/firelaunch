import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';
import { generateProject, writeGeneratedProject } from '../src/index.js';
import { televisionFromSpec } from '@vegalaunch/tv';
import type { ChannelDeployment } from '@vegalaunch/contracts';
import { parse } from '@babel/parser';

test('native hero stays bounded at HD and Full HD without a bottom gutter', async () => {
  const generated = await generateProject(fixtureChannel());
  const helper = generated.files.get('src/tv-layout.js')!;
  const { tvLayout, scrollTarget } = await import(`data:text/javascript,${encodeURIComponent(helper)}`);
  for (const [width, height] of [[640, 360], [960, 540]]) {
    const layout = tvLayout(width, height);
    assert.ok(layout.heroArtworkHeight <= height * 0.24);
    assert.ok(layout.heroWidth <= width - layout.horizontalInset * 2);
    assert.ok(Math.abs((layout.heroWidth - 16 * layout.scale) / layout.heroArtworkHeight - 16 / 9) < 0.01);
    const firstRowTop = layout.topInset + 70 * layout.scale + 43 * layout.scale +
      layout.heroArtworkHeight + 48 * layout.scale + 43 * layout.scale;
    assert.ok(firstRowTop + layout.cardArtworkHeight < height, `first content row visible at ${width}x${height}`);
  }
  assert.equal(scrollTarget({ y: 100, height: 180 }, 0, 400), 0);
  assert.equal(scrollTarget({ y: 500, height: 180 }, 0, 400), 292);
  const source = generated.files.get('src/App.js')!;
  assert.match(source, /useWindowDimensions/);
  assert.match(source, /showsVerticalScrollIndicator=\{false\}/);
  assert.doesNotMatch(source, /screen: \{ flex: 1, padding: 60 \}/);
});

test('generated native feature uses shared selection and fits a first selector at TV sizes', async () => {
  const original = fixtureChannel();
  const second = { ...original.content[0]!, id: `item_${'5'.repeat(32)}`, title: 'Second',
    artwork: 'https://example.org/second.jpg', presentation: 'audio' as const };
  const selector = { id: `mod_${'6'.repeat(32)}`, kind: 'rail' as const, title: 'Browse',
    contentIds: [original.content[0]!.id, second.id] };
  const lower = { id: `mod_${'7'.repeat(32)}`, kind: 'rail' as const, title: 'More',
    contentIds: [original.content[0]!.id] };
  const other = { id: `page_${'8'.repeat(32)}`, title: 'Other',
    modules: [{ ...lower, id: `mod_${'9'.repeat(32)}` }] };
  const spec = { ...original, content: [...original.content, second],
    navigation: [...original.navigation, other.id],
    pages: [{ ...original.pages[0]!, modules: [...original.pages[0]!.modules, selector, lower] }, other] };
  const generated = await generateProject(spec);
  const { tvLayout, featureArtworkFrame, featureScrollTarget } = await import(
    `data:text/javascript,${encodeURIComponent(generated.files.get('src/tv-layout.js')!)}`);
  for (const [width, height] of [[1280, 720], [1920, 1080], [960, 540]]) {
    const layout = tvLayout(width, height);
    assert.ok(layout.topInset + layout.headerHeight + layout.featureHeight +
      layout.selectorHeight + 32 * layout.scale <= height, `${width}x${height} first row fits`);
    for (const [presentation, ratio] of [['video', 16 / 9], ['audio', 1], ['information', 2 / 3]] as const) {
      const frame = featureArtworkFrame(layout, presentation);
      assert.ok(frame.width <= layout.contentWidth * 0.42);
      assert.ok(frame.height <= layout.featureHeight);
      assert.ok(frame.width / frame.height <= ratio + 0.001);
    }
  }
  assert.equal(featureScrollTarget({ y: 490, height: 160 }, 90, 520, true), 0);
  assert.equal(featureScrollTarget({ y: 900, height: 160 }, 0, 520, false), 552);
  const runtime = await import(`data:text/javascript,${encodeURIComponent(generated.files.get('src/tv-runtime.js')!)}`);
  const projected = JSON.parse(generated.files.get('src/channel.json')!);
  const page = projected.pages[0];
  assert.equal(runtime.heroSelector(page).selector.id, selector.id);
  let state = runtime.initialState(projected);
  assert.equal(runtime.heroSpotlight(page, state).id, original.content[0]!.id);
  state = runtime.transition(projected, state, 'down');
  assert.equal(state.focusId, runtime.heroActionFocusId(page.id));
  state = runtime.transition(projected, state, 'down');
  state = runtime.transition(projected, state, 'right');
  assert.equal(state.screen, 'page');
  assert.equal(runtime.heroSpotlight(page, state).id, second.id);
  const detail = runtime.transition(projected, state, 'select');
  assert.equal(detail.screen, 'detail');
  assert.equal(runtime.transition(projected, detail, 'back').focusId, state.focusId);
  assert.equal(runtime.transition(projected, state, 'down').focusId,
    `item:${page.id}:${lower.id}:${original.content[0]!.id}`);
  const otherNav = runtime.transition(projected, runtime.initialState(projected), 'right');
  assert.equal(runtime.transition(projected, otherNav, 'select').pageId, other.id);
  assert.equal(runtime.heroSelector(projected.pages[1]), undefined);
  const source = generated.files.get('src/App.js')!;
  assert.doesNotThrow(() => parse(source, { sourceType: 'module', plugins: ['jsx'] }));
  assert.match(source, /heroSelector\(page\)/);
  assert.match(source, /heroSpotlight\(page, state\)/);
  assert.match(source, /actionFocused=\{state\.focusId === heroActionFocusId\(page\.id\)\}/);
  assert.match(source, /<HeroBackdrop source=\{shownHero\.artwork\}[\s\S]*?backgroundColor=\{brand\.backgroundColor\}/);
  assert.match(source, /<PendingHero key=\{selectedHeroKey\}[\s\S]*?onReady=\{ready =>/);
  assert.match(source, /Image\.prefetch\(url\)/);
  assert.ok(generated.files.get('src/hero-image-queue.js')?.includes('class HeroImageQueue'));
  assert.doesNotMatch(source, /featureSelector && \{ backgroundColor: brand\.backgroundColor \}/);
  assert.match(source, /heroBackdropImage: \{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '10%' \}/);
  assert.match(source, /module === heroPair\?\.selector \? null/);
  assert.match(source, /resizeMode="cover"/);
  assert.match(source, /resizeMode="contain"/);
  assert.match(source, /featureScrollTarget\(/);
  assert.match(source, /ScrollView horizontal ref=\{rowRef\}/);
  assert.match(source, /module\.kind === 'grid' && !featureSelector/);
  assert.match(source, /height=\{featureSelector \? layout\.cardArtworkHeight/);
  assert.match(source, /numberOfLines=\{featureSelector \? 1 : undefined\}/);
  const grid = await generateProject({ ...spec, pages: [{ ...spec.pages[0]!,
    modules: [spec.pages[0]!.modules[0]!, { ...selector, kind: 'grid' }, lower] }, other] });
  const gridRuntime = await import(`data:text/javascript,${encodeURIComponent(grid.files.get('src/tv-runtime.js')!)}`);
  assert.equal(gridRuntime.heroSelector(JSON.parse(grid.files.get('src/channel.json')!).pages[0]).selector.kind, 'grid');
});

test('native audio artwork remains centered and preserves portrait book covers', async () => {
  const generated = await generateProject(fixtureChannel());
  const helper = generated.files.get('src/tv-layout.js')!;
  const { audioArtworkFrame } = await import(`data:text/javascript,${encodeURIComponent(helper)}`);
  for (const [width, height] of [[640, 360], [960, 540], [1920, 1080]]) {
    for (const portrait of [false, true]) {
      const frame = audioArtworkFrame(width, height, portrait);
      const stageHeight = height - frame.top - frame.bottom;
      assert.ok(frame.width <= width * 0.55);
      assert.ok(frame.height < stageHeight);
      assert.ok(Math.abs(frame.width / frame.height - (portrait ? 2 / 3 : 1)) < 0.001);
      const artworkTop = frame.top + (stageHeight - frame.height) / 2;
      assert.ok(artworkTop >= frame.top && artworkTop + frame.height <= height - frame.bottom);
    }
  }
  const source = generated.files.get('src/App.js')!;
  assert.match(source, /audioArtworkStage/);
  assert.match(source, /resizeMode="contain"/);
  assert.doesNotMatch(source, /marginTop: 220/);
});

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
  assert.equal(JSON.parse(first.files.get('app.json')!).name, `com.vegalaunch.channel.${spec.id}.main`);
  assert.equal(JSON.parse(first.files.get('package.json')!).name, `vegalaunch-${spec.slug}`);
  assert.ok(first.files.has('vegalaunch.json'));
  assert.match(first.files.get('src/tv-runtime.js')!, /function transition\(/);
  const generatedRuntime = await import(`data:text/javascript,${encodeURIComponent(first.files.get('src/tv-runtime.js')!)}`);
  const projected = JSON.parse(first.files.get('src/channel.json')!);
  assert.deepEqual(generatedRuntime.initialState(projected),
    { screen: 'page', pageId: spec.navigation[0], focusId: `nav:${spec.navigation[0]}` });
  assert.equal(generatedRuntime.transition(projected, generatedRuntime.initialState(projected), 'down').focusId,
    `item:${spec.navigation[0]}:${spec.pages[0]!.modules[0]!.id}:${spec.content[0]!.id}`);
  assert.match(first.files.get('src/App.js')!, /from '\.\/tv-runtime'/);
  assert.deepEqual(JSON.parse(first.files.get('vegalaunch.json')!).unresolvedAssets, ['assets/ocean.jpg']);
  assert.notEqual((await generateProject({ ...spec, title: 'Another' })).fingerprint, first.fingerprint);
  const quoted = await generateProject({ ...spec, title: 'A "quoted" channel' });
  assert.match(quoted.files.get('manifest.toml')!, /title = "A \\"quoted\\" channel"/);
});

test('native source and shared projection retain ordered static sections and focus only content', async () => {
  const old = fixtureChannel();
  const hero = { ...old.pages[0]!.modules[0]!, crop: 'contain' as const, alignment: 'center' as const };
  const banner = { id: `mod_${'a'.repeat(32)}`, kind: 'image-banner' as const,
    title: 'Welcome', body: 'A story', imageContentId: old.content[0]!.id,
    crop: 'contain' as const, background: 'surface' as const };
  const mixed = { id: `mod_${'b'.repeat(32)}`, kind: 'image-text' as const,
    title: 'About', body: 'Details', imageSide: 'right' as const, spacing: 'compact' as const };
  const spec = { ...old, pages: [{ ...old.pages[0]!, modules: [banner, hero, mixed] }] };
  const generated = await generateProject(spec);
  const projected = JSON.parse(generated.files.get('src/channel.json')!);
  assert.deepEqual(projected.pages[0].modules.map((module: { kind: string }) => module.kind),
    ['image-banner', 'hero', 'image-text']);
  assert.deepEqual(projected, televisionFromSpec(spec));
  assert.equal(projected.pages[0].modules[0].image.artwork, old.content[0]!.artwork);
  assert.deepEqual(projected.pages[0].modules[0].items, []);
  const runtime = await import(`data:text/javascript,${encodeURIComponent(generated.files.get('src/tv-runtime.js')!)}`);
  assert.equal(runtime.transition(projected, runtime.initialState(projected), 'down').focusId,
    `item:${old.pages[0]!.id}:${hero.id}:${old.content[0]!.id}`);
  const source = generated.files.get('src/App.js')!;
  assert.doesNotThrow(() => parse(source, { sourceType: 'module', plugins: ['jsx'] }));
  assert.match(source, /module\.kind === 'image-banner' \|\| module\.kind === 'image-text'/);
  assert.match(source, /module\.imageSide === 'right'/);
  assert.match(source, /module\.kind === 'hero' \|\| module\.crop === 'contain'/);
  assert.match(source, /Unsupported TV section/);
});

test('writes source once and never overwrites customized files', async () => {
  const destination = await mkdtemp(join(tmpdir(), 'vegalaunch-vega-'));
  try {
    const project = await writeGeneratedProject(fixtureChannel(), destination);
    assert.equal(await readFile(join(destination, 'src/channel.json'), 'utf8'), project.files.get('src/channel.json'));
    await assert.rejects(writeGeneratedProject(fixtureChannel(), destination), /empty, non-symlink/);
    assert.equal(await readFile(join(destination, 'src/App.js'), 'utf8'), project.files.get('src/App.js'));
    await assert.rejects(writeGeneratedProject(fixtureChannel(), 'relative'), /absolute/);
  } finally { await rm(destination, { recursive: true, force: true }); }
});

test('rejects occupied destinations without writing any generated files', async () => {
  const destination = await mkdtemp(join(tmpdir(), 'vegalaunch-vega-'));
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
  assert.deepEqual(JSON.parse(generated.files.get('vegalaunch.json')!).unresolvedAssets, []);
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
