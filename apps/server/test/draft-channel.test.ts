import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { ChannelSpec } from '@vegalaunch/contracts';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { CatalogRepository } from '../src/catalog-repository.js';
import type { CatalogProjectionService } from '../src/catalog-projection.js';
import { HostedWorkspaceService, selectedDraftChannel } from '../src/hosted-workspace.js';
import { assertExportableMedia } from '../src/hosted-media-policy.js';
import type { HostedProjectRepository } from '../src/hosted-repository.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';
import type { PrivateObjectService } from '../src/private-objects.js';

test('draft snapshot excludes content removed from every section while preserving selected content', () => {
  const spec = {
    brand: { logo: 'assets/logo.png', heroArtwork: 'assets/hero.png' },
    content: [
      { id: 'video', artwork: 'assets/catalog-placeholder.png', mediaUrl: 'https://video.example.org/master.m3u8' },
      { id: 'audio', artwork: 'https://studio.example.org/api/draft-audio/cover',
        mediaUrl: 'https://studio.example.org/api/draft-audio/audio' }
    ],
    pages: [{ modules: [{ kind: 'rail', contentIds: ['video'] }] }]
  } as unknown as ChannelSpec;
  assert.throws(() => assertExportableMedia(spec), { code: 'INVALID_INPUT' });
  const selected = selectedDraftChannel(spec);
  assert.deepEqual(selected.content.map(item => item.id), ['video']);
  assert.doesNotThrow(() => assertExportableMedia(selected));
  assert.equal(spec.content.length, 2, 'saved draft is unchanged');
  assert.throws(() => selectedDraftChannel({ ...spec,
    pages: [{ modules: [{ kind: 'rail', contentIds: ['missing'] }] }] } as ChannelSpec), { code: 'CONFLICT' });
});

test('owned draft snapshot builds without publication and omits unresolved selected video', async t => {
  const itemIds = [`ci_${'1'.repeat(32)}`, `ci_${'2'.repeat(32)}`];
  const contentIds = itemIds.map(id => `item_${createHash('sha256').update(`catalog-content-v1\0${id}`).digest('hex').slice(0, 32)}`);
  const original = fixtureChannel();
  const unsafe = 'https://studio.example/api/preview?token=private';
  const items = [
    { ...original.content[0]!, id: contentIds[0]!, title: 'Private upload', mediaUrl: unsafe },
    { ...original.content[0]!, id: contentIds[1]!, title: 'Public film', mediaUrl: 'https://media.example/film.mp4' }
  ];
  const spec = { ...original, content: items, pages: original.pages.map(page => ({ ...page,
    modules: [...page.modules.map(module => module.kind === 'hero' ? { ...module, contentIds: [contentIds[0]!] } : module),
      { id: `mod_${'5'.repeat(32)}`, kind: 'rail' as const, title: 'Films', contentIds }] })) };
  const owner = { accountId: `cr_${'a'.repeat(32)}` } as AuthenticatedPrincipal;
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');
  const imageHash = createHash('sha256').update(image).digest('hex');
  const artId = `ma_${'b'.repeat(32)}`;
  const sourceId = `src_${'c'.repeat(32)}`;
  const claim = { status: 'cleared', permittedUse: 'television_display', basis: 'creator_asserted',
    attestationVersion: 'channel-media-v1', assertedAt: '2026-10-23T00:00:00.000Z' };
  const project = { id: spec.id, spec, revision: 2 };
  const deployment = { schemaVersion: 1, id: `dep_${'a'.repeat(32)}`, creatorAccountId: owner.accountId,
    projectId: spec.id, channelId: spec.id, appName: spec.title, packageId: `com.vegalaunch.channel.${spec.id}`,
    releaseControl: 'creator', nativeReleaseApproval: 'pending_creator', consoleEvidence: { state: 'none' } };
  const repository = { async read(principal: AuthenticatedPrincipal, id: string) {
    assert.equal(principal.accountId, owner.accountId); assert.equal(id, spec.id); return project;
  }, async readDeployment() { return deployment; }, async source() { return null; } } as unknown as HostedProjectRepository;
  t.mock.method(CatalogRepository.prototype, 'read', async () => ({ revision: 1,
    items: itemIds.map((id, index) => ({ id, kind: 'video', mediaAssetIds: index === 0 ? [artId] : [],
      sourceRecord: { sourceId } })),
    mediaAssets: [{ id: artId, kind: 'artwork', catalogItemId: itemIds[0],
      creatorAccountId: owner.accountId, projectId: spec.id, location: { type: 'private_object', objectId: artId },
      tvDisplayRights: claim, deliveryEligible: false }],
    sources: [{ id: sourceId, creatorAccountId: owner.accountId, projectId: spec.id,
      type: 'creator_upload', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } }] }));
  const projection = { async project() { return { bindings: [
    { contentId: contentIds[0], baseline: null, blockedReason: 'playback_rights_or_delivery_missing' },
    { contentId: contentIds[1], baseline: items[1] }
  ] }; } } as unknown as CatalogProjectionService;
  const privateObjects = { async readArtwork() { return { content: image, contentType: 'image/png', sha256: imageHash }; }
  } as unknown as Pick<PrivateObjectService, 'readArtwork'>;
  const workspace = new HostedWorkspaceService(repository, undefined, projection, privateObjects);
  const first = await workspace.draftBuildInput(owner, spec.id);
  const again = await workspace.draftBuildInput(owner, spec.id);
  assert.equal(first.mode, 'draft');
  assert.equal(first.fingerprint, again.fingerprint);
  assert.equal(first.manifestEndpoint, '');
  assert.equal(first.files['src/release-config.json'], undefined);
  assert.match(first.files['manifest.toml']!, /com\.amazon\.category\.main/);
  const channel = JSON.parse(first.files['src/channel.json']!);
  const exported = channel.pages[0].modules[1].items;
  assert.equal(exported.length, 2);
  assert.equal(exported[0].mediaUrl, undefined);
  assert.equal(exported[1].mediaUrl, items[1]!.mediaUrl);
  assert.equal(exported[0].artwork, `assets/draft-artwork/${imageHash}.png`);
  assert.equal(first.binaryFileSha256?.[`assets/draft-artwork/${imageHash}.png`], imageHash);
  assert.equal(JSON.stringify(first).includes(unsafe), false);
  assert.ok(first.warnings?.some(warning => warning.contentId === contentIds[0] && warning.field === 'playback'));
});
