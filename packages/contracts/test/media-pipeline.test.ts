import assert from 'node:assert/strict';
import test from 'node:test';
import { mediaAssetSchema, mediaProcessingJobSchema, mediaRenditionSetSchema, mediaUploadSessionSchema } from '../src/index.js';

const a = (prefix: string, digit: string) => `${prefix}_${digit.repeat(32)}`;
const scope = { creatorAccountId: a('cr', 'a'), projectId: a('ch', 'b'), catalogItemId: a('ci', 'c'), mediaAssetId: a('ma', 'd') };
const now = '2026-10-12T00:00:00.000Z';
const originalKey = `media/${'a'.repeat(32)}/${'b'.repeat(32)}/${'d'.repeat(32)}/original/${'e'.repeat(32)}.mp4`;

test('additive private media contracts preserve legacy MediaAsset and require verified state', () => {
  const asset = { schemaVersion: 1, id: scope.mediaAssetId, creatorAccountId: scope.creatorAccountId,
    projectId: scope.projectId, catalogItemId: scope.catalogItemId, kind: 'video',
    location: { type: 'https', url: 'https://media.example.com/video.mp4' },
    rights: { status: 'unknown', basis: 'none', permittedUse: 'none' }, deliveryEligible: false };
  assert.equal(mediaAssetSchema.parse(asset).id, asset.id);
  const upload = { id: a('up', 'e'), ...scope, state: 'initiated', originalKey, expectedBytes: 42,
    expectedSha256: 'f'.repeat(64), contentType: 'video/mp4', expiresAt: now, version: 0, createdAt: now };
  assert.equal(mediaUploadSessionSchema.parse(upload).state, 'initiated');
  assert.equal(mediaUploadSessionSchema.safeParse({ ...upload, state: 'verified' }).success, false);
  assert.equal(mediaUploadSessionSchema.safeParse({ ...upload, originalKey: '../private/key' }).success, false);
  assert.equal(mediaUploadSessionSchema.safeParse({ ...upload, verifiedBytes: 42 }).success, false);
  assert.equal(mediaUploadSessionSchema.parse({ ...upload, state: 'verified', verifiedBytes: 42,
    verifiedSha256: 'f'.repeat(64) }).state, 'verified');
  const job = { id: a('job', '1'), ...scope, uploadSessionId: upload.id, profile: 'hls-avc-aac-v1',
    state: 'pending', version: 0, attempts: 0 };
  assert.equal(mediaProcessingJobSchema.parse(job).state, 'pending');
  assert.equal(mediaProcessingJobSchema.safeParse({ ...job, state: 'ready' }).success, false);
  assert.equal(mediaProcessingJobSchema.safeParse({ ...job, state: 'leased', leaseUntil: now }).success, false);
  const rendition = { id: a('rs', '2'), ...scope, jobId: job.id, profile: 'hls-avc-aac-v1',
    masterKey: originalKey.replace('/original/', '/delivery/').replace('.mp4', '.m3u8'),
    masterSha256: '3'.repeat(64), variants: [{ height: 480,
      playlistKey: originalKey.replace('/original/', '/delivery/').replace('.mp4', '-480.m3u8'),
      playlistSha256: '4'.repeat(64), segmentsSha256: '5'.repeat(64), segmentCount: 1 }], verifiedAt: now };
  assert.equal(mediaRenditionSetSchema.parse(rendition).variants.length, 1);
  assert.equal(mediaRenditionSetSchema.safeParse({ ...rendition, variants: [rendition.variants[0], rendition.variants[0]] }).success, false);
});
