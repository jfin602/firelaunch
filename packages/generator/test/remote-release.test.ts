import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';
import { generateProject } from '../src/index.js';
import { publishedManifestSchema } from '@vegalaunch/contracts';
import { canonicalBytes } from '../../../apps/server/src/publication-repository.js';

const id = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const digest = (bytes: string) => createHash('sha256').update(bytes).digest('hex');

test('generated client verifies releases and retains last-known-good across failures and restart', async () => {
  const original = fixtureChannel();
  const generated = await generateProject(original, { schemaVersion: 1, id: id('dep', 'a'),
    creatorAccountId: id('cr', 'b'), projectId: original.id, channelId: original.id,
    appName: 'Creator channel', packageId: 'com.creator.channel', releaseControl: 'creator',
    nativeReleaseApproval: 'pending_creator', manifestEndpoint: 'https://resolver.example.org/',
    consoleEvidence: { state: 'none' } });
  const directory = await mkdtemp(join(process.cwd(), 'node_modules', '.vegalaunch-release-test-'));
  try {
    await mkdir(join(directory, 'src'));
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    for (const name of ['src/remote-release.js', 'src/sha256.js', 'src/tv-runtime.js'])
      await writeFile(join(directory, name), generated.files.get(name)!);
    const { sha256 } = await import(pathToFileURL(join(directory, 'src/sha256.js')).href);
    assert.equal(sha256(''), digest(''));
    assert.equal(sha256('A 🌊 channel'), digest('A 🌊 channel'));
    const { createChannelLoader, verifyRelease } = await import(pathToFileURL(join(directory, 'src/remote-release.js')).href);
    const baseChannel = { ...original, content: original.content.map(item => ({ ...item,
      artwork: 'https://media.example.org/cover.jpg' })) };
    const config = { deploymentId: id('dep', 'a'), channelId: original.id,
      packageId: 'com.creator.channel', origin: 'https://resolver.example.org' };
    const release = (sequence: number, name: string, previousReleaseId?: string) => {
      const releaseId = id('rel', String(sequence));
      const manifest = {
        schemaVersion: 1, releaseId, releaseSequence: sequence,
        ...(previousReleaseId ? { previousReleaseId } : {}), publishedAt: '2026-10-11T00:00:00.000Z',
        deployment: { id: config.deploymentId, projectId: original.id, channelId: original.id,
          packageId: config.packageId },
        approvedContentRevision: { channel: sequence, catalog: 1 }, approvalId: id('ap', 'e'),
        clientCompatibility: { minSchemaVersion: 1, maxSchemaVersion: 1, channelSchemaVersion: 1 },
        channel: { ...baseChannel, title: name },
        media: [{ id: id('ma', '1'), kind: 'video', url: original.content[0]!.mediaUrl },
          { id: id('ma', '2'), kind: 'artwork', url: baseChannel.content[0]!.artwork }],
        bindings: { content: [{ contentId: original.content[0]!.id, catalogItemId: id('ci', '3'),
          playbackAssetId: id('ma', '1'), artworkAssetId: id('ma', '2') }] }
      };
      assert.doesNotThrow(() => publishedManifestSchema.parse(manifest));
      const bytes = canonicalBytes(manifest);
      return { pointer: { deploymentId: config.deploymentId, releaseId, releaseSequence: sequence,
        sha256: digest(bytes) }, bytes, manifest };
    };
    const first = release(1, 'First');
    const bookId = id('item', 'a');
    const bookArtId = id('ma', 'a'), bookAudioId = id('ma', 'b');
    const bookArt = 'https://media.example.org/book-cover.jpg';
    const bookAudio = 'https://media.example.org/releases/book-audio.mp3';
    const book = { id: bookId, title: 'Field Guide', description: 'An original book',
      artwork: bookArt, presentation: 'information', author: 'A. Writer',
      audiobook: { mediaUrl: bookAudio } };
    const audioId = id('item', 'b'), audioArtId = id('ma', 'c'), audioMediaId = id('ma', 'd');
    const audioArt = 'https://media.example.org/album-cover.jpg';
    const audioUrl = 'https://media.example.org/releases/album-track.mp3';
    const audio = { id: audioId, title: 'Album Track', description: 'Original recording',
      artwork: audioArt, presentation: 'audio', mediaUrl: audioUrl };
    const mixedManifest = { ...first.manifest,
      clientCompatibility: { minSchemaVersion: 2, maxSchemaVersion: 2, channelSchemaVersion: 1 },
      channel: { ...first.manifest.channel,
        content: [...first.manifest.channel.content, book, audio],
        pages: first.manifest.channel.pages.map(page => ({ ...page, modules: [...page.modules,
          { id: id('mod', 'a'), kind: 'rail', title: 'Bookshelf and albums', contentIds: [bookId, audioId] }] })) },
      media: [...first.manifest.media, { id: bookArtId, kind: 'artwork', url: bookArt },
        { id: bookAudioId, kind: 'audio', url: bookAudio },
        { id: audioArtId, kind: 'artwork', url: audioArt }, { id: audioMediaId, kind: 'audio', url: audioUrl }],
      bindings: { content: [...first.manifest.bindings.content,
        { contentId: bookId, catalogItemId: id('ci', 'a'), artworkAssetId: bookArtId, audiobookAssetId: bookAudioId },
        { contentId: audioId, catalogItemId: id('ci', 'b'), artworkAssetId: audioArtId, playbackAssetId: audioMediaId }] } };
    const mixedBytes = canonicalBytes(mixedManifest);
    const mixedPointer = { ...first.pointer, sha256: digest(mixedBytes) };
    assert.equal(verifyRelease(mixedPointer, mixedBytes, config).channel.pages[0].modules
      .some((module: { items: { id: string }[] }) => module.items.some(item => item.id === bookId)), true);
    assert.equal(verifyRelease(mixedPointer, mixedBytes, config).channel.pages[0].modules
      .some((module: { items: { id: string }[] }) => module.items.some(item => item.id === audioId)), true);
    for (const altered of [
      { ...mixedManifest, clientCompatibility: first.manifest.clientCompatibility },
      { ...mixedManifest, bindings: first.manifest.bindings },
      { ...mixedManifest, channel: { ...mixedManifest.channel,
        content: [...first.manifest.channel.content, { ...book, audiobook: { mediaUrl: `${bookAudio}?token=private` } }] } }
    ]) {
      const bytes = canonicalBytes(altered);
      assert.throws(() => verifyRelease({ ...mixedPointer, sha256: digest(bytes) }, bytes, config));
    }
    const staticChannel = { ...first.manifest.channel, pages: first.manifest.channel.pages.map(page => ({
      ...page, modules: [...page.modules, { id: id('mod', '9'), kind: 'image-text', title: 'About', body: 'A note',
        imageContentId: original.content[0]!.id, imageSide: 'right', crop: 'contain', spacing: 'compact' }]
    })) };
    const staticManifest = { ...first.manifest, channel: staticChannel };
    const staticBytes = canonicalBytes(staticManifest);
    const staticPointer = { ...first.pointer, sha256: digest(staticBytes) };
    const staticVerified = verifyRelease(staticPointer, staticBytes, config);
    assert.equal(staticVerified.channel.pages[0].modules.at(-1)?.kind, 'image-text');
    assert.deepEqual(staticVerified.channel.pages[0].modules.at(-1)?.items, []);
    const unknownManifest = { ...staticManifest, channel: { ...staticChannel, pages: staticChannel.pages.map(page => ({
      ...page, modules: [...page.modules.slice(0, -1), { id: id('mod', '9'), kind: 'unknown', title: 'Unsupported' }]
    })) } };
    const unknownBytes = canonicalBytes(unknownManifest);
    assert.throws(() => verifyRelease({ ...first.pointer, sha256: digest(unknownBytes) }, unknownBytes, config));
    const second = release(2, 'Second', first.pointer.releaseId);
    const rollback = release(3, 'First', second.pointer.releaseId);
    let delivered = first;
    let error: Error | undefined;
    const requests: string[] = [];
    const get = async (url: string, limit: number) => {
      requests.push(url);
      if (error) throw error;
      const bytes = url.endsWith('/current') ? JSON.stringify(delivered.pointer) : delivered.bytes;
      if (Buffer.byteLength(bytes) > limit) throw new Error('Too large');
      return bytes;
    };
    const cache = new Map<string, string>();
    const storage = { getItem: async (key: string) => cache.get(key) ?? null,
      setItem: async (key: string, value: string) => { cache.set(key, value); } };
    const seen: { title: string; screen: string }[] = [];
    const loader = createChannelLoader(config, JSON.parse(generated.files.get('src/channel.json')!), {
      get, storage, onChannel: (channel: { title: string }, state: { screen: string }) =>
        seen.push({ title: channel.title, screen: state.screen }) });
    assert.deepEqual(seen, [], 'App starts with bundled projection before the first fetch');
    assert.equal(await loader.start(), true);
    assert.deepEqual(seen, [{ title: 'First', screen: 'page' }]);
    assert.equal(await loader.refresh(), false);
    assert.equal(requests.length, 3, 'unchanged pointer does not redownload the release');
    delivered = second;
    assert.equal(await loader.refresh(), true);
    assert.deepEqual(seen.at(-1), { title: 'Second', screen: 'page' });
    error = new Error('offline');
    const restarted: string[] = [];
    const offline = createChannelLoader(config, JSON.parse(generated.files.get('src/channel.json')!), { get, storage,
      onChannel: (channel: { title: string }) => restarted.push(channel.title) });
    assert.equal(await offline.start(), false);
    assert.deepEqual(restarted, ['Second']);
    error = undefined;
    const variants: [string, typeof second['pointer'], string][] = [
      ['bad digest', { ...rollback.pointer, sha256: '0'.repeat(64) }, rollback.bytes],
      ['wrong deployment', { ...rollback.pointer, deploymentId: id('dep', 'b') }, rollback.bytes],
      ['old sequence', first.pointer, first.bytes],
      ['wrong package', rollback.pointer, canonicalBytes({ ...rollback.manifest,
        deployment: { ...rollback.manifest.deployment, packageId: 'com.other.channel' } })],
      ['schema', rollback.pointer, canonicalBytes({ ...rollback.manifest, schemaVersion: 2 })],
      ['unknown field', rollback.pointer, canonicalBytes({ ...rollback.manifest, unapproved: true })],
      ['private media', rollback.pointer, canonicalBytes({ ...rollback.manifest,
        channel: { ...rollback.manifest.channel, content: rollback.manifest.channel.content.map(item => ({ ...item,
          artwork: 'https://resolver.example.org/api/private-objects/key' })) } })],
      ['S3 original', rollback.pointer, canonicalBytes({ ...rollback.manifest,
        channel: { ...rollback.manifest.channel, content: rollback.manifest.channel.content.map(item => ({ ...item,
          mediaUrl: 'https://bucket.s3.amazonaws.com/original/master.m3u8' })) },
        media: rollback.manifest.media.map(asset => asset.kind === 'video'
          ? { ...asset, url: 'https://bucket.s3.amazonaws.com/original/master.m3u8' } : asset) })],
      ['oversize', rollback.pointer, 'x'.repeat(1_048_577)]
    ];
    for (const [name, pointer, bytes] of variants) {
      const invalid = { pointer: { ...pointer, sha256: name === 'bad digest' ? pointer.sha256 : digest(bytes) }, bytes };
      delivered = invalid as typeof delivered;
      assert.equal(await offline.refresh(), false, name);
      assert.deepEqual(restarted, ['Second'], name);
    }
    for (const reason of ['timeout', '404', '500']) {
      error = new Error(reason);
      assert.equal(await offline.refresh(), false);
      assert.deepEqual(restarted, ['Second']);
    }
    error = undefined;
    delivered = rollback;
    assert.equal(await offline.refresh(), true, 'authorized rollback advances sequence');
    assert.deepEqual(restarted, ['Second', 'First']);
    assert.deepEqual(verifyRelease(rollback.pointer, rollback.bytes, config).channel.title, 'First');
    assert.equal(cache.size, 1, 'one scoped atomic LKG value');
    const storageFailure: string[] = [];
    const unavailableStorage = { getItem: async () => { throw new Error('storage unavailable'); },
      setItem: async () => { throw new Error('storage unavailable'); } };
    delivered = first;
    assert.equal(await createChannelLoader(config, JSON.parse(generated.files.get('src/channel.json')!), {
      get, storage: unavailableStorage,
      onChannel: (channel: { title: string }) => storageFailure.push(channel.title)
    }).start(), true, 'a storage fault does not prevent a verified release from rendering');
    assert.deepEqual(storageFailure, ['First']);
    cache.set([...cache.keys()][0]!, '{broken');
    error = new Error('offline');
    const corrupt: string[] = [];
    await createChannelLoader(config, JSON.parse(generated.files.get('src/channel.json')!), { get, storage,
      onChannel: (channel: { title: string }) => corrupt.push(channel.title) }).start();
    assert.deepEqual(corrupt, [], 'corrupted cache falls back to bundled channel');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
