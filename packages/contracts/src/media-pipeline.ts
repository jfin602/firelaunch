import { z } from 'zod';

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-f0-9]{32}$`));
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const objectKey = z.string().min(1).max(512).regex(/^media\/[a-f0-9]{32}\/[a-f0-9]{32}\/[a-f0-9]{32}\/[a-z0-9/_-]+(?:\.[a-z0-9]+)?$/);
const bytes = z.number().int().positive().max(50_000_000_000);
const scope = { creatorAccountId: id('cr'), projectId: id('ch'), catalogItemId: id('ci'), mediaAssetId: id('ma') };

// These are private control-plane records. They never belong in ChannelSpec or a TV manifest.
export const mediaUploadSessionSchema = z.strictObject({
  id: id('up'), ...scope, state: z.enum(['initiated', 'verified', 'aborted', 'expired']),
  originalKey: objectKey, expectedBytes: bytes, expectedSha256: sha256,
  verifiedBytes: bytes.optional(), verifiedSha256: sha256.optional(),
  contentType: z.literal('video/mp4'), expiresAt: z.iso.datetime(), version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime()
}).superRefine((value, ctx) => {
  if (value.state === 'verified' && (value.verifiedBytes !== value.expectedBytes || value.verifiedSha256 !== value.expectedSha256))
    ctx.addIssue({ code: 'custom', message: 'Verified original must match trusted storage size and checksum' });
  if (value.state !== 'verified' && (value.verifiedBytes !== undefined || value.verifiedSha256 !== undefined))
    ctx.addIssue({ code: 'custom', message: 'Unverified upload cannot carry verified metadata' });
});
export type MediaUploadSession = z.infer<typeof mediaUploadSessionSchema>;

export const mediaRenditionSetSchema = z.strictObject({
  id: id('rs'), ...scope, jobId: id('job'), profile: z.literal('hls-avc-aac-v1'),
  masterKey: objectKey.refine(value => value.endsWith('.m3u8'), 'Master must be an HLS playlist'), masterSha256: sha256,
  variants: z.array(z.strictObject({ height: z.union([z.literal(480), z.literal(720), z.literal(1080)]),
    playlistKey: objectKey.refine(value => value.endsWith('.m3u8'), 'Variant must be an HLS playlist'),
    playlistSha256: sha256, segmentsSha256: sha256,
    segmentCount: z.number().int().positive().max(100000) })).min(1).max(3),
  verifiedAt: z.iso.datetime(), revokedAt: z.iso.datetime().optional()
}).refine(value => new Set(value.variants.map(v => v.height)).size === value.variants.length,
  'Rendition heights must be unique').refine(value =>
  new Set([value.masterKey, ...value.variants.map(v => v.playlistKey)]).size === value.variants.length + 1,
  'Rendition playlist keys must be unique');
export type MediaRenditionSet = z.infer<typeof mediaRenditionSetSchema>;

export const mediaProcessingJobSchema = z.strictObject({
  id: id('job'), ...scope, uploadSessionId: id('up'), profile: z.literal('hls-avc-aac-v1'),
  state: z.enum(['pending', 'leased', 'ready', 'failed', 'revoked']), version: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative().max(3), leaseToken: z.uuid().optional(),
  leaseUntil: z.iso.datetime().optional(), failureCode: z.enum(['probe_failed', 'encode_failed', 'verification_failed', 'worker_timeout']).optional(),
  renditionSetId: id('rs').optional()
}).superRefine((value, ctx) => {
  if ((value.leaseToken !== undefined || value.leaseUntil !== undefined) !== (value.state === 'leased') ||
    (value.state === 'leased' && (!value.leaseToken || !value.leaseUntil)))
    ctx.addIssue({ code: 'custom', message: 'Only leased jobs carry a complete lease' });
  if ((value.state === 'ready') !== (value.renditionSetId !== undefined))
    ctx.addIssue({ code: 'custom', message: 'Only ready jobs bind verified renditions' });
  if ((value.state === 'failed') !== (value.failureCode !== undefined))
    ctx.addIssue({ code: 'custom', message: 'Only failed jobs carry a failure code' });
});
export type MediaProcessingJob = z.infer<typeof mediaProcessingJobSchema>;
