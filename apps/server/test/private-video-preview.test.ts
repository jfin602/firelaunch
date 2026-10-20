import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { PrivateVideoPreview } from '../src/private-video-preview.js';

const id = (prefix: string, letter: string) => `${prefix}_${letter.repeat(32)}`;
const owner = { accountId: id('cr', 'a') };
const foreign = { accountId: id('cr', 'b') };
const projectId = id('ch', 'c'), itemId = id('ci', 'd'), assetId = id('ma', 'e');
const contentId = `item_${createHash('sha256').update('catalog-content-v1\0').update(itemId).digest('hex').slice(0, 32)}`;
const url = `https://media.example.org/media/${'a'.repeat(32)}/${'c'.repeat(32)}/${'e'.repeat(32)}/delivery/${'f'.repeat(32)}/${'1'.repeat(64)}/master.m3u8`;
const claim = (permittedUse: string) => ({ status: 'cleared', permittedUse });
const asset = { id: assetId, catalogItemId: itemId, kind: 'video', location: { type: 'managed_hls' },
  deliveryEligible: true, tvDisplayRights: claim('television_display'), tvPlaybackRights: claim('television_playback') };
const source = { id: id('src', '9'), state: 'verified', permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted' } };
const row = { id: id('rs', 'f'), job_id: id('job', '8'), creator_account_id: owner.accountId,
  project_id: projectId, item_id: itemId, asset_id: assetId, profile: 'hls-avc-aac-v1',
  master_key: `media/${'a'.repeat(32)}/${'c'.repeat(32)}/${'e'.repeat(32)}/staged/${'f'.repeat(32)}/master.m3u8`,
  master_sha256: '1'.repeat(64), variants: [480, 720].map(height => ({ height,
    playlistKey: `media/${'a'.repeat(32)}/${'c'.repeat(32)}/${'e'.repeat(32)}/staged/${'f'.repeat(32)}/v${height}.m3u8`,
    playlistSha256: '2'.repeat(64), segmentsSha256: '3'.repeat(64), segmentCount: 2 })),
  verified_at: new Date(), revoked_at: null, state: 'ready', rendition_set_id: id('rs', 'f') };

function fixture() {
  let currentUrl = url;
  let currentSource = source;
  let currentAsset = asset;
  let currentRow: typeof row | undefined = row;
  const reads: string[] = [];
  const projects = { read: async (principal: typeof owner, target: string) => {
    if (principal.accountId !== owner.accountId || target !== projectId) throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
    return { spec: { content: [{ id: contentId, presentation: 'video', mediaUrl: currentUrl }] } };
  }, pool: { query: async (_sql: string, params: string[]) => {
    assert.deepEqual(params, [owner.accountId, projectId, itemId, assetId]);
    return { rows: currentRow ? [currentRow] : [] };
  } } };
  const catalog = { read: async () => ({ items: [{ id: itemId, kind: 'video', sourceRecord: { sourceId: source.id },
    mediaAssetIds: [assetId] }], sources: [currentSource], mediaAssets: [currentAsset] }) };
  const storage = { publishedMasterUrl: () => url,
    readStagedPreviewObject: async (_scope: unknown, _setId: string, name: string) => {
      reads.push(name); return Buffer.from(name);
    } };
  const preview = new PrivateVideoPreview(projects as never, catalog as never, storage as never);
  return { preview, reads, setUrl: (value: string) => { currentUrl = value; },
    revokeSource: () => { currentSource = { ...source, permission: { ...source.permission, tvDisplay: 'revoked' } }; },
    revokeAsset: () => { currentAsset = { ...asset, tvPlaybackRights: { status: 'revoked', permittedUse: 'television_playback' } }; },
    revokeJob: () => { currentRow = { ...row, state: 'revoked' }; } };
}

test('owned READY private HLS serves only its master, variants and bounded segments', async () => {
  const { preview, reads } = fixture();
  for (const name of ['master.m3u8', 'v480.m3u8', 'v720-000.ts', 'v720-001.ts']) {
    const result = await preview.read(owner as never, projectId, contentId, name);
    assert.equal(result.body.toString(), name);
    assert.equal(result.contentType, name.endsWith('.ts') ? 'video/mp2t' : 'application/vnd.apple.mpegurl');
  }
  for (const name of ['v720-002.ts', 'v720-00.ts', 'v1080.m3u8', 'other.ts', '../original.mp4'])
    await assert.rejects(preview.read(owner as never, projectId, contentId, name), { code: 'NOT_FOUND' });
  assert.deepEqual(reads, ['master.m3u8', 'v480.m3u8', 'v720-000.ts', 'v720-001.ts']);
});

test('preview denies foreign, revoked, unpublished binding changes and stale READY state', async () => {
  const fixtureState = fixture();
  const read = (principal = owner) => fixtureState.preview.read(principal as never, projectId, contentId, 'master.m3u8');
  await assert.rejects(read(foreign), { code: 'NOT_FOUND' });
  fixtureState.setUrl('https://media.example.org/other.m3u8');
  await assert.rejects(read(), { code: 'NOT_FOUND' });
  fixtureState.setUrl(url);
  fixtureState.revokeSource();
  await assert.rejects(read(), { code: 'NOT_FOUND' });
  const second = fixture(); second.revokeAsset();
  await assert.rejects(second.preview.read(owner as never, projectId, contentId, 'master.m3u8'), { code: 'NOT_FOUND' });
  const third = fixture(); third.revokeJob();
  await assert.rejects(third.preview.read(owner as never, projectId, contentId, 'master.m3u8'), { code: 'NOT_FOUND' });
});
