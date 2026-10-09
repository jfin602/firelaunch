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
const timestamp = '2026-10-09T00:00:00.000Z';
const playbackUrl = 'https://media.example.com/ocean.mp4';
const artworkUrl = 'https://media.example.com/ocean.jpg';
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
