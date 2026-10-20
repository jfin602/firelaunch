import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertClientCompatible, channelSpecSchema, projectApprovedManifest, publicationStateSchema,
  publishedManifestSchema, type ChannelSpec
} from '../src/index.js';
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';

const hex = (digit: string) => digit.repeat(32);
const creatorAccountId = `cr_${hex('a')}`;
const sourceId = `src_${hex('b')}`;
const catalogItemId = `ci_${hex('c')}`;
const playbackId = `ma_${hex('d')}`;
const artworkId = `ma_${hex('e')}`;
const bookItemId = `ci_${hex('1')}`;
const bookArtworkId = `ma_${hex('2')}`;
const audioItemId = `ci_${hex('3')}`;
const audioPlaybackId = `ma_${hex('4')}`;
const audioArtworkId = `ma_${hex('5')}`;
const timestamp = '2026-10-09T00:00:00.000Z';
const playbackUrl = 'https://media.example.com/ocean.mp4';
const artworkUrl = 'https://media.example.com/ocean.jpg';
const bookArtworkUrl = 'https://media.example.com/book.jpg';
const audioPlaybackUrl = 'https://media.example.com/album.mp3';
const audioArtworkUrl = 'https://media.example.com/album.jpg';
const externalId = { provider: 'creator' as const, kind: 'feed_item_id' as const, value: 'ocean-1' };

const channel = (): ChannelSpec => {
  const spec = fixtureChannel();
  return channelSpecSchema.parse({ ...spec, content: [{ ...spec.content[0], artwork: artworkUrl, mediaUrl: playbackUrl }] });
};
const source = () => ({
  schemaVersion: 1, id: sourceId, creatorAccountId, projectId: channel().id,
  type: 'creator_https_feed', state: 'syncing', endpointUrl: 'https://creator.example.com/feed.json',
  permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted', verificationEvidenceId: `ev_${hex('a')}` }
});
const catalogItem = () => ({
  schemaVersion: 1, id: catalogItemId, creatorAccountId, projectId: channel().id, kind: 'video',
  sourceRecord: { sourceId, externalId, observedAt: timestamp, metadata: { title: 'Oceans' } },
  externalIdentifiers: [externalId], mediaAssetIds: [playbackId, artworkId]
});
const rights = (kind: 'television_playback' | 'television_display') => ({
  status: 'cleared', basis: 'creator_asserted', permittedUse: kind, assertedAt: timestamp
});
const media = () => [
  { schemaVersion: 1, id: playbackId, creatorAccountId, projectId: channel().id, catalogItemId,
    kind: 'video', location: { type: 'https', url: playbackUrl }, rights: rights('television_playback'), deliveryEligible: true },
  { schemaVersion: 1, id: artworkId, creatorAccountId, projectId: channel().id, catalogItemId,
    kind: 'artwork', location: { type: 'https', url: artworkUrl }, rights: rights('television_display'), deliveryEligible: true }
];
const inventory = () => ({
  schemaVersion: 1, creatorAccountId, projectId: channel().id,
  sources: [source()], items: [catalogItem()], mediaAssets: media(), collections: []
});
const deployment = () => ({
  schemaVersion: 1, id: `dep_${hex('a')}`, creatorAccountId, projectId: channel().id, channelId: channel().id,
  appName: 'Wild Earth', packageId: 'com.example.wildearth', releaseControl: 'creator',
  nativeReleaseApproval: 'creator_approved', consoleEvidence: { state: 'none' }
});
const approval = () => ({
  state: 'approved', creatorAccountId, projectId: channel().id,
  revisions: { channel: 3, catalog: 7 }, approvalId: `ap_${hex('b')}`, approvedAt: timestamp
});
const bindings = () => ({
  content: [{ contentId: channel().content[0].id, catalogItemId, playbackAssetId: playbackId, artworkAssetId: artworkId }]
});
const input = () => ({
  approval: approval(), deployment: deployment(), channel: channel(), inventory: inventory(), bindings: bindings(),
  releaseId: `rel_${hex('a')}`, releaseSequence: 1, publishedAt: timestamp
});

test('approved private thumbnail resolves only through a release-scoped managed URL', () => {
  const base = input();
  const managedUrl = `https://studio.example.com/api/public-artwork/${base.deployment.id}/${base.releaseId}/${artworkId}/${'a'.repeat(64)}.jpg`;
  const selected = { ...base,
    channel: { ...base.channel, content: [{ ...base.channel.content[0]!, artwork: 'assets/catalog-placeholder.png' }] },
    inventory: { ...base.inventory, mediaAssets: [base.inventory.mediaAssets[0]!, {
      ...base.inventory.mediaAssets[1]!, location: { type: 'private_object' as const, objectId: `ma_${hex('9')}` }
    }] } };
  assert.throws(() => projectApprovedManifest(selected));
  const released = projectApprovedManifest({ ...selected, resolvedArtwork: new Map([[artworkId, managedUrl]]) });
  assert.equal(released.channel.content[0]?.artwork, managedUrl);
  assert.equal(released.media.find(asset => asset.id === artworkId)?.url, managedUrl);
  assert.doesNotMatch(JSON.stringify(released), /private_object|objectId|assets\/catalog-placeholder/);
  const nextReleaseId = `rel_${hex('f')}`;
  const nextUrl = managedUrl.replace(base.releaseId, nextReleaseId);
  const rollback = projectApprovedManifest({ ...selected, channel: released.channel,
    releaseId: nextReleaseId, releaseSequence: 2, previousReleaseId: base.releaseId,
    resolvedArtwork: new Map([[artworkId, nextUrl]]) });
  assert.equal(rollback.channel.content[0]?.artwork, nextUrl, 'rollback creates a new immutable artwork URL');
  assert.throws(() => projectApprovedManifest({ ...selected, inventory: { ...selected.inventory,
    mediaAssets: [selected.inventory.mediaAssets[0]!, { ...selected.inventory.mediaAssets[1]!, deliveryEligible: false }] },
  resolvedArtwork: new Map([[artworkId, managedUrl]]) }));
  assert.throws(() => projectApprovedManifest({ ...selected, channel: base.channel,
    resolvedArtwork: new Map([[artworkId, managedUrl]]) }));
});
const bookContent = () => ({ id: `item_${hex('1')}`, title: 'Field Guide', description: 'A book',
  artwork: bookArtworkUrl, presentation: 'information' as const });
const bookItem = () => ({ ...catalogItem(), id: bookItemId, kind: 'book' as const,
  sourceRecord: { ...catalogItem().sourceRecord, externalId: { ...externalId, value: 'book-1' } },
  externalIdentifiers: [{ ...externalId, value: 'book-1' }], mediaAssetIds: [bookArtworkId] });
const bookArtwork = () => ({ ...media()[1], id: bookArtworkId, catalogItemId: bookItemId,
  location: { type: 'https' as const, url: bookArtworkUrl } });
const bookBinding = () => ({ contentId: bookContent().id, catalogItemId: bookItemId, artworkAssetId: bookArtworkId });
const writingInput = () => {
  const base = input();
  const pages = base.channel.pages.map(page => ({ ...page, modules: page.modules.map(module =>
    module.kind === 'text' ? module : { ...module, contentIds: module.contentIds.map(id =>
      id === base.channel.content[0]?.id ? bookContent().id : id) }) }));
  return { ...base, channel: { ...base.channel, pages, content: [bookContent()] },
    inventory: { ...base.inventory, items: [bookItem()], mediaAssets: [bookArtwork()] },
    bindings: { content: [bookBinding()] } };
};
const audioContent = () => ({ id: `item_${hex('3')}`, title: 'Ocean Sounds', description: 'An album',
  artwork: audioArtworkUrl, presentation: 'audio' as const, mediaUrl: audioPlaybackUrl });
const audioItem = () => ({ ...catalogItem(), id: audioItemId, kind: 'audio' as const,
  sourceRecord: { ...catalogItem().sourceRecord, externalId: { ...externalId, value: 'audio-1' } },
  externalIdentifiers: [{ ...externalId, value: 'audio-1' }], mediaAssetIds: [audioPlaybackId, audioArtworkId] });
const audioMedia = () => [
  { ...media()[0], id: audioPlaybackId, catalogItemId: audioItemId, kind: 'audio' as const,
    location: { type: 'https' as const, url: audioPlaybackUrl } },
  { ...media()[1], id: audioArtworkId, catalogItemId: audioItemId,
    location: { type: 'https' as const, url: audioArtworkUrl } }
];

test('approved writing-only release has detail artwork and no playback reference', () => {
  const manifest = projectApprovedManifest(writingInput());
  assert.equal(assertClientCompatible(manifest, 1).channel.content[0]?.presentation, 'information');
  assert.equal(manifest.channel.content[0]?.mediaUrl, undefined);
  assert.equal(manifest.bindings.content[0]?.playbackAssetId, undefined);
  assert.deepEqual(manifest.media.map(asset => asset.id), [bookArtworkId]);
  assert.equal(JSON.stringify(manifest).includes('playbackAssetId'), false);
});

test('mixed video, audio and informational content retains type-specific bindings', () => {
  const base = input();
  const mixed = { ...base,
    channel: { ...base.channel, content: [...base.channel.content, audioContent(), bookContent()] },
    inventory: { ...base.inventory, items: [...base.inventory.items, audioItem(), bookItem()],
      mediaAssets: [...base.inventory.mediaAssets, ...audioMedia(), bookArtwork()] },
    bindings: { content: [...base.bindings.content,
      { contentId: audioContent().id, catalogItemId: audioItemId, playbackAssetId: audioPlaybackId, artworkAssetId: audioArtworkId },
      bookBinding()] } };
  const manifest = projectApprovedManifest(mixed);
  assert.equal(manifest.media.length, 5);
  assert.equal(assertClientCompatible(manifest, 1).channel.content.length, 3);
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, bindings: { content: [
    manifest.bindings.content[0], { ...manifest.bindings.content[1], playbackAssetId: playbackId }, manifest.bindings.content[2]
  ] } }).success, false);
  assert.throws(() => projectApprovedManifest({ ...mixed, bindings: { content: [mixed.bindings.content[0],
    { ...mixed.bindings.content[1], catalogItemId }, mixed.bindings.content[2]] } }), /one-to-one/);
});

test('writing publication rejects unapproved, revoked, foreign and unsafe display media', () => {
  const base = writingInput();
  assert.throws(() => projectApprovedManifest({ ...base, approval: { ...base.approval, state: 'draft' } }));
  assert.throws(() => projectApprovedManifest({ ...base, inventory: { ...base.inventory,
    sources: [{ ...source(), state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } }] } }),
  /source lacks TV display/);
  assert.throws(() => projectApprovedManifest({ ...base, inventory: { ...base.inventory,
    mediaAssets: [{ ...bookArtwork(), rights: { status: 'revoked', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt: timestamp }, deliveryEligible: false }] } }));
  assert.throws(() => projectApprovedManifest({ ...base, inventory: { ...base.inventory,
    mediaAssets: [{ ...bookArtwork(), rights: undefined,
      tvDisplayRights: { status: 'unknown', basis: 'none', permittedUse: 'none' },
      tvPlaybackRights: rights('television_playback'), deliveryEligible: false }] } }));
  assert.throws(() => projectApprovedManifest({ ...base, inventory: { ...base.inventory,
    mediaAssets: [{ ...bookArtwork(), location: { type: 'upload', key: 'media/private/cover.jpg' } }] } }));
  assert.throws(() => projectApprovedManifest({ ...base, inventory: { ...base.inventory,
    mediaAssets: [{ ...bookArtwork(), creatorAccountId: `cr_${hex('f')}` }] } }));
  assert.throws(() => projectApprovedManifest({ ...base, inventory: { ...base.inventory,
    items: [{ ...bookItem(), kind: 'listing' }] } }), /presentation differs/);
  assert.throws(() => projectApprovedManifest({ ...base, bindings: { content: [{ ...bookBinding(), playbackAssetId: playbackId }] } }),
  /cannot bind playback/);
  assert.throws(() => projectApprovedManifest({ ...base, channel: { ...base.channel,
    content: [{ ...bookContent(), artwork: 'https://media.example.com/book.jpg?token=private' }] } }));
  assert.throws(() => projectApprovedManifest({ ...base, channel: { ...base.channel,
    content: [{ ...bookContent(), artwork: 'assets/catalog-placeholder.png' }] } }));
  const manifest = projectApprovedManifest(base);
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, bindings: { content: [{ ...bookBinding(), playbackAssetId: playbackId }] } }).success, false);
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, media: [{ ...manifest.media[0], url: 'https://media.example.com/book.jpg?token=private' }] }).success, false);
});

test('approved release projects a public, compatible, versioned manifest', () => {
  const manifest = projectApprovedManifest(input());
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.approvedContentRevision, { channel: 3, catalog: 7 });
  assert.equal(manifest.deployment.packageId, 'com.example.wildearth');
  assert.equal(manifest.media.length, 2);
  assert.equal(assertClientCompatible(manifest, 1).releaseId, manifest.releaseId);
  assert.equal(JSON.stringify(manifest).includes('creatorAccountId'), false);
  assert.equal(JSON.stringify(manifest).includes('endpointUrl'), false);
  assert.equal(JSON.stringify(manifest).includes('verificationEvidenceId'), false);
  assert.equal(JSON.stringify(manifest).includes('approvalId'), true);
  assert.equal(channelSpecSchema.parse(fixtureChannel()).schemaVersion, 1);
});

test('private video binds only a resolved stable HLS URL into v1, never its original identity', () => {
  const base = input();
  const url = `https://media.example.org/media/${hex('a')}/${hex('b')}/${hex('d')}/delivery/${hex('f')}/${'1'.repeat(64)}/master.m3u8`;
  const privateVideo = { ...media()[0], location: { type: 'managed_hls' },
    rights: undefined, tvDisplayRights: rights('television_display'), tvPlaybackRights: rights('television_playback') };
  const selected = { ...base, inventory: { ...base.inventory, mediaAssets: [privateVideo, media()[1]] } };
  assert.throws(() => projectApprovedManifest(selected));
  const manifest = projectApprovedManifest({ ...selected, resolvedPlayback: new Map([[playbackId, url]]) });
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.channel.content[0]?.mediaUrl, url);
  assert.equal(manifest.media.find(asset => asset.id === playbackId)?.url, url);
  assert.doesNotMatch(JSON.stringify(manifest), /managed_hls|private_object|objectId|original|staged|creatorAccountId/);
  for (const unsafe of ['https://bucket.s3.amazonaws.com/video.m3u8', 'https://media.example.org/video.m3u8?X-Amz-Signature=x',
    'https://media.example.org/media/staged/secret/master.m3u8', 'https://media.example.org/media/original/file.mp4',
    'https://127.0.0.1/video.m3u8', 'https://media.example.org:444/video.m3u8'])
    assert.throws(() => projectApprovedManifest({ ...selected, resolvedPlayback: new Map([[playbackId, unsafe]]) }));
  assert.throws(() => projectApprovedManifest({ ...selected, inventory: { ...selected.inventory,
    mediaAssets: [{ ...privateVideo, tvDisplayRights: { status: 'revoked', basis: 'creator_asserted',
      permittedUse: 'television_display', assertedAt: timestamp }, deliveryEligible: false }, media()[1]] },
  resolvedPlayback: new Map([[playbackId, url]]) }));
});

test('draft state and incompatible clients cannot publish or activate', () => {
  const draft = { state: 'draft', creatorAccountId, projectId: channel().id, revisions: { channel: 3, catalog: 7 } };
  assert.equal(publicationStateSchema.parse(draft).state, 'draft');
  assert.throws(() => projectApprovedManifest({ ...input(), approval: draft }));
  assert.equal(publicationStateSchema.safeParse({ ...draft, approvalId: `ap_${hex('b')}` }).success, false);
  const manifest = projectApprovedManifest(input());
  assert.throws(() => assertClientCompatible(manifest, 2), /Incompatible/);
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, schemaVersion: 2 }).success, false);
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, clientCompatibility: { ...manifest.clientCompatibility, minSchemaVersion: 2 } }).success, false);
});

test('public parser rejects secrets, private records, executable fields and unsafe URLs', () => {
  const manifest = projectApprovedManifest(input());
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, accessToken: 'secret' }).success, false);
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, creatorAccount: { email: 'private@example.com' } }).success, false);
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, script: 'eval(1)' }).success, false);
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, state: 'draft' }).success, false);
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, media: [{ ...manifest.media[0], authToken: 'secret' }, manifest.media[1]] }).success, false);
  assert.equal(publishedManifestSchema.safeParse({ ...manifest, channel: { ...manifest.channel, script: 'evil' } }).success, false);
  for (const url of ['http://media.example.com/ocean.mp4', 'https://user:pass@media.example.com/ocean.mp4',
    'https://media.example.com/ocean.mp4?token=secret', 'https://localhost/ocean.mp4', 'file:///secret']) {
    const altered = { ...manifest, media: [{ ...manifest.media[0], url }, manifest.media[1]],
      channel: { ...manifest.channel, content: [{ ...manifest.channel.content[0], mediaUrl: url }] } };
    assert.equal(publishedManifestSchema.safeParse(altered).success, false, url);
  }
});

test('media must be licensed, deliverable, bound to approved content and authorized source', () => {
  const base = input();
  const badAsset = { ...media()[0], rights: { status: 'unknown', basis: 'none', permittedUse: 'none' }, deliveryEligible: false };
  assert.throws(() => projectApprovedManifest({ ...base, inventory: { ...base.inventory, mediaAssets: [badAsset, media()[1]] } }));
  const revoked = { ...source(), state: 'discovered', permission: { retrieval: 'revoked', tvDisplay: 'revoked' } };
  assert.throws(() => projectApprovedManifest({ ...base, inventory: { ...base.inventory, sources: [revoked] } }));
  assert.throws(() => projectApprovedManifest({ ...base, bindings: { content: [{ ...bindings().content[0], playbackAssetId: `ma_${hex('f')}` }] } }));
  assert.throws(() => projectApprovedManifest({ ...base, channel: { ...base.channel, content: [{ ...base.channel.content[0], artwork: 'assets/local.jpg' }] } }));
  assert.throws(() => projectApprovedManifest({ ...base, inventory: { ...base.inventory, creatorAccountId: `cr_${hex('f')}` } }));
});

test('release lineage and media references are structurally consistent', () => {
  const first = projectApprovedManifest(input());
  const second = projectApprovedManifest({ ...input(), releaseId: `rel_${hex('b')}`, releaseSequence: 2, previousReleaseId: first.releaseId });
  assert.equal(second.previousReleaseId, first.releaseId);
  assert.equal(publishedManifestSchema.safeParse({ ...first, previousReleaseId: first.releaseId }).success, false);
  assert.equal(publishedManifestSchema.safeParse({ ...second, previousReleaseId: undefined }).success, false);
  assert.equal(publishedManifestSchema.safeParse({ ...first, media: first.media.slice(1) }).success, false);
  assert.equal(publishedManifestSchema.safeParse({ ...first, bindings: { ...first.bindings, content: [] } }).success, false);
});
