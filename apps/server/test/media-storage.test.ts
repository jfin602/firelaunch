import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { mediaStorageConfigFromEnv, S3MediaStorage, type MediaScope, type MediaStorageConfig } from '../src/media-storage.js';
import { MediaUploadService } from '../src/media-upload-service.js';
import { runOneMediaJob } from '../src/media-worker.js';
import type { MediaPipelineRepository } from '../src/media-pipeline-repository.js';
import type { MediaWorkerRepository, WorkerClaim } from '../src/media-worker-repository.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';
import { assertClientCompatible, projectApprovedManifest, type MediaRenditionSet } from '@firelaunch/contracts';
import { RepositoryError } from '../src/repository.js';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { canonicalBytes } from '../src/publication-repository.js';

const scope: MediaScope = { creatorAccountId: `cr_${'a'.repeat(32)}`, projectId: `ch_${'b'.repeat(32)}`,
  mediaAssetId: `ma_${'c'.repeat(32)}` };
const other: MediaScope = { ...scope, creatorAccountId: `cr_${'d'.repeat(32)}` };
const session = `up_${'e'.repeat(32)}`;
const set = `rs_${'f'.repeat(32)}`;
const config: MediaStorageConfig = { region: 'us-east-2', originalsBucket: 'firelaunch-originals-test',
  deliveryBucket: 'firelaunch-delivery-test', cloudFrontOrigin: 'https://media.example.org/',
  allowedCloudFrontHosts: ['media.example.org'] };
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
type ObjectRecord = { body: Buffer; type: string; encryption: string; checksumType: string; crc?: string; sha?: string; etag: string };
class FakeS3 {
  readonly objects = new Map<string, ObjectRecord>();
  readonly calls: { name: string; input: Record<string, unknown> }[] = [];
  readonly parts = new Map<number, Buffer>();
  failNext = '';
  async send(command: { constructor: { name: string }; input: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const name = command.constructor.name;
    const input = command.input;
    this.calls.push({ name, input });
    if (this.failNext === name) { this.failNext = ''; throw new Error('simulated S3 failure: secret-value'); }
    const key = String(input.Key);
    if (name === 'CreateMultipartUploadCommand') return { UploadId: 'opaque-s3-upload' };
    if (name === 'UploadPartCommand') {
      this.parts.set(Number(input.PartNumber), input.Body as Buffer);
      return { ETag: '"' + 'f'.repeat(32) + '"' };
    }
    if (name === 'CompleteMultipartUploadCommand') {
      if (this.objects.has(key)) throw Object.assign(new Error('exists'), { name: 'PreconditionFailed' });
      const body = Buffer.concat([...this.parts.values()]);
      this.objects.set(key, { body, type: 'video/mp4', encryption: 'AES256', checksumType: 'FULL_OBJECT',
        crc: 'aGVsbG8=', etag: '"original"' });
      return {};
    }
    if (name === 'AbortMultipartUploadCommand') { this.parts.clear(); return {}; }
    if (name === 'ListObjectsV2Command') {
      const keys = [...this.objects.keys()].filter(value => value.startsWith(String(input.Prefix)));
      return { Contents: keys.slice(0, Number(input.MaxKeys)).map(Key => ({ Key })), IsTruncated: keys.length > Number(input.MaxKeys) };
    }
    if (name === 'DeleteObjectCommand') { this.objects.delete(key); return {}; }
    if (name === 'PutObjectCommand') {
      if (this.objects.has(key)) throw Object.assign(new Error('exists'), { name: 'PreconditionFailed' });
      const body = input.Body as Buffer;
      this.objects.set(key, { body, type: String(input.ContentType), encryption: String(input.ServerSideEncryption),
        checksumType: 'FULL_OBJECT', sha: String(input.ChecksumSHA256), etag: '"staged"' });
      return {};
    }
    const object = this.objects.get(key);
    if (!object) throw Object.assign(new Error('missing'), { name: 'NotFound' });
    if (name === 'HeadObjectCommand') return { ContentLength: object.body.length, ContentType: object.type,
      ServerSideEncryption: object.encryption, ChecksumType: object.checksumType,
      ChecksumCRC64NVME: object.crc, ChecksumSHA256: object.sha, ETag: object.etag };
    if (name === 'GetObjectCommand') {
      if (input.IfMatch && input.IfMatch !== object.etag) throw new Error('object changed');
      return { Body: Readable.from([object.body]), ContentLength: object.body.length };
    }
    throw new Error(`unexpected ${name}`);
  }
}
const setup = () => { const originals = new FakeS3(); const delivery = new FakeS3();
  return { originals, delivery, storage: new S3MediaStorage(config, originals as unknown as S3Client, delivery as unknown as S3Client) }; };

test('media AWS configuration and CloudFront origin fail closed without echoing secrets', () => {
  assert.throws(() => mediaStorageConfigFromEnv({}), /invalid/);
  const env = { FIRELAUNCH_MEDIA_AWS_REGION: 'us-east-2', FIRELAUNCH_MEDIA_ORIGINALS_BUCKET: config.originalsBucket,
    FIRELAUNCH_MEDIA_DELIVERY_BUCKET: config.deliveryBucket, FIRELAUNCH_MEDIA_CLOUDFRONT_HOSTS: 'media.example.org',
    FIRELAUNCH_MEDIA_CLOUDFRONT_ORIGIN: config.cloudFrontOrigin, AWS_SECRET_ACCESS_KEY: 'secret-value' };
  assert.equal(mediaStorageConfigFromEnv(env).cloudFrontOrigin, config.cloudFrontOrigin);
  for (const origin of ['http://media.example.org/', 'https://evil.example.org/', 'https://media.example.org.evil.test/',
    'https://user:secret-value@media.example.org/', 'https://media.example.org/path', 'https://media.example.org/?sig=secret-value',
    'https://media.example.org:444/', 'https://127.0.0.1/']) {
    assert.throws(() => mediaStorageConfigFromEnv({ ...env, FIRELAUNCH_MEDIA_CLOUDFRONT_ORIGIN: origin }), error =>
      error instanceof Error && !error.message.includes('secret-value'));
  }
  assert.throws(() => mediaStorageConfigFromEnv({ ...env, FIRELAUNCH_MEDIA_DELIVERY_BUCKET: config.originalsBucket }), /invalid/);
  assert.throws(() => mediaStorageConfigFromEnv({ ...env, FIRELAUNCH_MEDIA_CLOUDFRONT_HOSTS: 'media.example.org,127.0.0.1' }), /invalid/);
});

test('scoped opaque keys reject foreign and path-like identities before S3 requests', () => {
  const { storage, originals, delivery } = setup();
  assert.equal(storage.originalKey(scope, session), `media/${'a'.repeat(32)}/${'b'.repeat(32)}/${'c'.repeat(32)}/original/${'e'.repeat(32)}.mp4`);
  assert.notEqual(storage.originalKey(other, session), storage.originalKey(scope, session));
  assert.match(storage.stagedKey(scope, set, 'master.m3u8'), /\/staged\/[a-f0-9]{32}\/master\.m3u8$/);
  assert.match(storage.deliveryKey(scope, set, '0'.repeat(64), 'segment_001.ts'), /\/delivery\/[a-f0-9]{32}\/0{64}\/segment_001\.ts$/);
  assert.throws(() => storage.originalKey({ ...scope, projectId: 'ch_../secret' }, session), /identity/);
  assert.throws(() => storage.stagedKey(scope, set, '../master.m3u8'), /name/);
  assert.throws(() => storage.deliveryKey(scope, set, 'nope', 'master.m3u8'), /version/);
  assert.equal(originals.calls.length + delivery.calls.length, 0);
});

test('multipart part presigning creates a short-lived scoped S3 PUT capability without network I/O', async () => {
  const client = new S3Client({ region: config.region, endpoint: 'https://s3.example.org', forcePathStyle: true,
    credentials: { accessKeyId: 'test-uploader', secretAccessKey: 'private-fixture-secret' } });
  try {
    const storage = new S3MediaStorage(config, client, client);
    const signed = await storage.signOriginalPart(scope, session, 'opaque-s3-upload', 1, 8 * 1024 * 1024);
    const url = new URL(signed.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 's3.example.org');
    assert.equal(url.searchParams.get('partNumber'), '1');
    assert.equal(url.searchParams.get('uploadId'), 'opaque-s3-upload');
    assert.equal(url.searchParams.get('X-Amz-Expires'), '300');
    assert.match(url.searchParams.get('X-Amz-SignedHeaders') ?? '', /content-length/);
    assert.equal(signed.url.includes('private-fixture-secret'), false);
    assert.equal(signed.expiresInSeconds, 300);
    assert.equal(signed.contentLength, 8 * 1024 * 1024);
    await assert.rejects(storage.signOriginalPart(scope, session, 'opaque-s3-upload', 1001, 1));
  } finally { client.destroy(); }
});

test('multipart create, part, complete, HeadObject and full SHA-256 verification', async () => {
  const { storage, originals } = setup();
  const body = Buffer.from('creator-owned-video-fixture');
  const started = await storage.createOriginal(scope, session);
  assert.equal(started.key, storage.originalKey(scope, session));
  assert.equal((originals.calls[0]!.input.ChecksumAlgorithm), 'CRC64NVME');
  const part = await storage.uploadOriginalPart(scope, session, started.uploadId, 1, body);
  await storage.completeOriginal(scope, session, started.uploadId, [part]);
  const verified = await storage.verifyOriginal(scope, session, { bytes: body.length, sha256: sha(body) });
  assert.deepEqual(verified, { key: started.key, bytes: body.length, sha256: sha(body) });
  assert.equal(originals.calls.some(call => call.name === 'CompleteMultipartUploadCommand' && call.input.IfNoneMatch === '*'), true);
  assert.equal(originals.calls.some(call => call.name === 'HeadObjectCommand' && call.input.ChecksumMode === 'ENABLED'), true);
  assert.equal(originals.calls.some(call => call.name === 'GetObjectCommand'), true);
  await assert.rejects(storage.verifyOriginal(other, session, { bytes: body.length, sha256: sha(body) }), /S3 request failed/);
  await assert.rejects(storage.verifyOriginal(scope, session, { bytes: body.length, sha256: '0'.repeat(64) }), /mismatch/);
  await assert.rejects(storage.verifyOriginal(scope, session, { bytes: body.length + 1, sha256: sha(body) }), /missing/);
  originals.objects.get(started.key)!.crc = undefined;
  await assert.rejects(storage.verifyOriginal(scope, session, { bytes: body.length, sha256: sha(body) }), /missing/);
});

test('multipart invalid input, S3 errors and abort do not report verified media', async () => {
  const { storage, originals } = setup();
  await assert.rejects(storage.uploadOriginalPart(scope, session, 'id', 0, Buffer.from('x')), /part/);
  await assert.rejects(storage.completeOriginal(scope, session, 'id', [{ partNumber: 2, etag: '"' + 'a'.repeat(32) + '"' }]), /completion/);
  originals.failNext = 'CreateMultipartUploadCommand';
  await assert.rejects(storage.createOriginal(scope, session), error => error instanceof Error &&
    error.message === 'Media storage: S3 request failed' && !error.message.includes('secret-value'));
  const started = await storage.createOriginal(scope, session);
  await storage.uploadOriginalPart(scope, session, started.uploadId, 1, Buffer.from('x'));
  await storage.abortOriginal(scope, session, started.uploadId);
  assert.equal(originals.parts.size, 0);
  assert.equal(originals.objects.size, 0);
  assert.equal(originals.calls.at(-1)?.name, 'AbortMultipartUploadCommand');
});

test('staged output and immutable publication are idempotent and URL is allowlisted HTTPS', async () => {
  const { storage, delivery } = setup();
  const body = Buffer.from('#EXTM3U\n');
  const expected = { bytes: body.length, sha256: sha(body) };
  const staged = await storage.putStaged(scope, set, 'master.m3u8', body, expected.sha256);
  const first = await storage.publishStaged(scope, set, '1'.repeat(64), 'master.m3u8', expected);
  const second = await storage.publishStaged(scope, set, '1'.repeat(64), 'master.m3u8', expected);
  assert.deepEqual(second, first);
  assert.equal(staged.key.includes('/staged/'), true);
  assert.match(first.url, /^https:\/\/media\.example\.org\/media\/.*\/delivery\/.*\/master\.m3u8$/);
  assert.equal(delivery.calls.filter(call => call.name === 'PutObjectCommand').every(call => call.input.IfNoneMatch === '*'), true);
  assert.equal(delivery.objects.get(first.object.key)?.type, 'application/vnd.apple.mpegurl');
  await assert.rejects(storage.putStaged(scope, set, 'master.m3u8', Buffer.from('different'), sha(Buffer.from('different'))), /mismatch/);
  await assert.rejects(storage.publishStaged(other, set, '1'.repeat(64), 'master.m3u8', expected), /S3 request failed/);
  await assert.rejects(storage.publishStaged(scope, set, '1'.repeat(64), 'master.m3u8', { ...expected, sha256: '0'.repeat(64) }), /mismatch/);
  delivery.objects.get(staged.key)!.body = Buffer.from('tampered');
  await assert.rejects(storage.publishStaged(scope, set, '2'.repeat(64), 'master.m3u8', expected), /mismatch/);
});

test('managed private HLS graph is bounded, hashed and normalized before approved publication', async () => {
  const { storage, delivery } = setup();
  const raw = `media/${'a'.repeat(32)}/${'b'.repeat(32)}/${'c'.repeat(32)}/staged/${'1'.repeat(32)}/`;
  const putRaw = (name: string, body: Buffer) => delivery.objects.set(`${raw}${name}`, {
    body, type: name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
    encryption: 'AES256', checksumType: 'FULL_OBJECT', etag: `"${sha(body)}"` });
  const segment = Buffer.alloc(188); segment[0] = 0x47;
  putRaw('source_480p000.ts', segment);
  putRaw('source_720p000.ts', segment);
  for (const height of [480, 720]) putRaw(`source_${height}p.m3u8`, Buffer.from(
    `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:6,\nsource_${height}p000.ts\n#EXT-X-ENDLIST\n`));
  putRaw('source.m3u8', Buffer.from('#EXTM3U\n#EXT-X-VERSION:3\n' +
    [480, 720].map(height => `#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=${height === 480 ? 854 : 1280}x${height},CODECS="avc1.4d401f,mp4a.40.2"\nsource_${height}p.m3u8\n`).join('')));
  const managed = await storage.verifyManagedHls(scope, raw, set, `job_${'9'.repeat(32)}`, `ci_${'8'.repeat(32)}`);
  assert.deepEqual(managed.variants.map(v => v.height), [480, 720]);
  assert.equal(delivery.objects.has(storage.deliveryKey(scope, set, managed.masterSha256, 'master.m3u8')), false);
  const published = await storage.publishVerifiedHls(scope, managed);
  assert.equal(published, storage.publishedMasterUrl(scope, managed));
  assert.equal(delivery.objects.get(storage.stagedKey(scope, set, 'master.m3u8'))?.body.toString('utf8').includes('source'), false);
  delivery.objects.delete(`${raw}source_720p000.ts`);
  await assert.rejects(storage.verifyManagedHls(scope, raw, `rs_${'e'.repeat(32)}`,
    `job_${'9'.repeat(32)}`, `ci_${'8'.repeat(32)}`), /invalid|missing/);
  await assert.rejects(storage.verifyManagedHls(other, raw, set,
    `job_${'9'.repeat(32)}`, `ci_${'8'.repeat(32)}`), /scope/);
});

test('complete READY graph promotes a stable master only after all staged segments verify', async () => {
  const { storage, delivery } = setup();
  const master = Buffer.from('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480\nv480.m3u8\n');
  const playlist = Buffer.from('#EXTM3U\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXTINF:6.0,\nv480-000.ts\n#EXT-X-ENDLIST\n');
  const segment = Buffer.from('synthetic segment');
  const rendition = { id: set, creatorAccountId: scope.creatorAccountId, projectId: scope.projectId,
    catalogItemId: `ci_${'1'.repeat(32)}`, mediaAssetId: scope.mediaAssetId,
    jobId: `job_${'2'.repeat(32)}`, profile: 'hls-avc-aac-v1' as const,
    masterKey: storage.stagedKey(scope, set, 'master.m3u8'), masterSha256: sha(master),
    variants: [{ height: 480 as const, playlistKey: storage.stagedKey(scope, set, 'v480.m3u8'),
      playlistSha256: sha(playlist), segmentsSha256: sha(Buffer.from(sha(segment))), segmentCount: 1 }],
    verifiedAt: '2026-10-12T00:00:00.000Z' };
  await storage.putStaged(scope, set, 'master.m3u8', master, sha(master));
  await storage.putStaged(scope, set, 'v480.m3u8', playlist, sha(playlist));
  const expected = storage.publishedMasterUrl(scope, rendition);
  assert.equal(expected.includes('/delivery/'), true);
  assert.equal(expected.includes('/staged/'), false);
  await assert.rejects(storage.publishVerifiedHls(scope, rendition), /S3 request failed/);
  assert.equal([...delivery.objects.keys()].some(key => key.includes('/delivery/')), false);
  await storage.putStaged(scope, set, 'v480-000.ts', segment, sha(segment));
  assert.equal(await storage.publishVerifiedHls(scope, rendition), expected);
  assert.equal(await storage.publishVerifiedHls(scope, rendition), expected);
  assert.equal(delivery.objects.get(storage.deliveryKey(scope, set, sha(master), 'v480-000.ts'))?.body.toString(),
    segment.toString());
  await assert.rejects(storage.publishVerifiedHls(other, rendition), /scope mismatch/);
  await assert.rejects(storage.publishVerifiedHls(scope, { ...rendition, revokedAt: '2026-10-12T01:00:00.000Z' }), /scope mismatch/);
  await assert.rejects(storage.publishVerifiedHls(scope, { ...rendition, variants: [{ ...rendition.variants[0]!, segmentCount: 2 }] }),
    /graph differs/);
  delivery.objects.get(storage.stagedKey(scope, set, 'v480-000.ts'))!.body = Buffer.from('changed');
  await assert.rejects(storage.publishVerifiedHls(scope, rendition), /checksum mismatch/);
  assert.equal(await storage.removePublishedAsset(scope), 3);
  assert.equal(delivery.objects.has(storage.deliveryKey(scope, set, sha(master), 'master.m3u8')), false);
  assert.equal(delivery.objects.has(storage.stagedKey(scope, set, 'master.m3u8')), true);
  assert.equal(await storage.removePublishedAsset(other), 0);
});

test('two-owner upload, verified worker graph and immutable public HLS converge offline', async context => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'firelaunch-convergence-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'owned.mp4');
  const encoded = spawnSync('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'testsrc2=size=854x480:rate=2', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=44100',
    '-t', '12', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '12',
    '-keyint_min', '12', '-sc_threshold', '0', '-c:a', 'aac', '-shortest', source], { timeout: 30_000 });
  assert.equal(encoded.status, 0, encoded.stderr?.toString());
  const body = await readFile(source);
  const { storage, originals, delivery } = setup();
  const principal: AuthenticatedPrincipal = { accountId: scope.creatorAccountId, issuer: 'test', subject: 'owner' };
  const foreign = { ...principal, accountId: other.creatorAccountId, subject: 'foreign' };
  const row = { id: session, state: 'initiated', version: 0, originalKey: storage.originalKey(scope, session),
    s3UploadId: null as string | null, expectedBytes: body.length, expectedSha256: sha(body),
    expiresAt: new Date(Date.now() + 60_000).toISOString(), claimedDurationSeconds: 12, partSize: 8 * 1024 * 1024,
    partCount: 1 };
  const owned = (actor: AuthenticatedPrincipal, projectId: string, assetId: string) => {
    if (actor.accountId !== principal.accountId || actor.subject !== principal.subject ||
      projectId !== scope.projectId || assetId !== scope.mediaAssetId)
      throw new RepositoryError('NOT_FOUND', 'Media asset not found');
  };
  const records = {
    createUpload: async (actor: AuthenticatedPrincipal, projectId: string, assetId: string) => {
      owned(actor, projectId, assetId); return { id: session, originalKey: row.originalKey, state: row.state };
    },
    upload: async (actor: AuthenticatedPrincipal, projectId: string, assetId: string, uploadId: string) => {
      owned(actor, projectId, assetId);
      if (uploadId !== session) throw new RepositoryError('NOT_FOUND', 'Upload not found');
      return { ...row };
    },
    attachS3Upload: async (actor: AuthenticatedPrincipal, projectId: string, assetId: string, _uploadId: string, s3Id: string) => {
      owned(actor, projectId, assetId); row.s3UploadId = s3Id; return true;
    },
    recordCompletedOriginal: async (actor: AuthenticatedPrincipal, projectId: string, assetId: string,
      _uploadId: string, version: number) => {
      owned(actor, projectId, assetId);
      if (row.version !== version) throw new RepositoryError('CONFLICT', 'Stale upload');
      row.state = 'completed'; row.version++;
    }
  };
  const service = new MediaUploadService(records as unknown as MediaPipelineRepository, storage);
  const request = { mediaAssetId: scope.mediaAssetId, idempotencyKey: 'convergence-upload-001',
    fileName: 'owned.mp4', contentType: 'video/mp4', expectedBytes: body.length,
    expectedSha256: sha(body), claimedDurationSeconds: 12 };
  await assert.rejects(service.start(foreign, scope.projectId, request), { code: 'NOT_FOUND' });
  await assert.rejects(service.start(principal, scope.projectId, { ...request, fileName: '../unsafe.mp4' }));
  assert.equal((await service.start(principal, scope.projectId, request)).state, 'initiated');
  const started = await service.start(principal, scope.projectId, request);
  assert.equal(started.id, session);
  assert.equal(originals.calls.filter(call => call.name === 'CreateMultipartUploadCommand').length, 1);
  const part = await storage.uploadOriginalPart(scope, session, row.s3UploadId!, 1, body);
  await assert.rejects(service.finalize(foreign, scope.projectId, session,
    { mediaAssetId: scope.mediaAssetId, parts: [part] }), { code: 'NOT_FOUND' });
  const finalized = await Promise.all([service.finalize(principal, scope.projectId, session,
    { mediaAssetId: scope.mediaAssetId, parts: [part] }), service.finalize(principal, scope.projectId, session,
    { mediaAssetId: scope.mediaAssetId, parts: [part] })]);
  assert.deepEqual(finalized.map(result => result.state), ['completed', 'completed']);
  assert.equal(row.version, 1);
  await assert.rejects(storage.verifyOriginal(other, session, { bytes: body.length, sha256: sha(body) }));
  await assert.rejects(storage.verifyOriginal(scope, session, { bytes: body.length, sha256: '0'.repeat(64) }));
  await storage.verifyOriginal(scope, session, { bytes: body.length, sha256: sha(body) });
  row.state = 'verified';
  const claim: WorkerClaim = { jobId: `job_${'2'.repeat(32)}`, token: 'f39b2e47-cd73-4e47-89a5-d3a16320297d',
    attempts: 1, scope, itemId: `ci_${'1'.repeat(32)}`, uploadId: session, bytes: body.length, sha256: sha(body) };
  let leased = true;
  let ready: MediaRenditionSet | undefined;
  const worker = { claim: async () => leased ? claim : null, renew: async () => leased,
    fail: async () => { leased = false; return true; },
    complete: async (_claim: WorkerClaim, rendition: MediaRenditionSet) => {
      if (!leased) return false;
      ready = rendition; leased = false; return true;
    } } as unknown as MediaWorkerRepository;
  assert.equal(await runOneMediaJob(worker, storage), 'ready');
  assert.ok(ready);
  assert.equal(await runOneMediaJob(worker, storage), 'idle');
  assert.deepEqual(ready.variants.map(variant => variant.height), [480]);
  const expected = storage.publishedMasterUrl(scope, ready);
  assert.match(expected, /^https:\/\/media\.example\.org\/media\/.+\/delivery\/.+\/master\.m3u8$/);
  await assert.rejects(storage.publishVerifiedHls(other, ready));
  const segmentKey = storage.stagedKey(scope, ready.id, 'v480-000.ts');
  const segment = delivery.objects.get(segmentKey)!;
  delivery.objects.delete(segmentKey);
  await assert.rejects(storage.publishVerifiedHls(scope, ready), /S3 request failed/);
  assert.equal([...delivery.objects.keys()].some(key => key.includes('/delivery/')), false);
  delivery.objects.set(segmentKey, segment);
  const playlistKey = storage.stagedKey(scope, ready.id, 'v480.m3u8');
  const playlist = delivery.objects.get(playlistKey)!;
  delivery.objects.set(playlistKey, { ...playlist, body: Buffer.from('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://secrets.example/key"\n') });
  await assert.rejects(storage.publishVerifiedHls(scope, ready), /checksum mismatch/);
  assert.equal([...delivery.objects.keys()].some(key => key.includes('/delivery/')), false);
  delivery.objects.set(playlistKey, playlist);
  assert.equal(await storage.publishVerifiedHls(scope, ready), expected);
  assert.equal(await storage.publishVerifiedHls(scope, ready), expected);
  assert.equal([...delivery.objects.keys()].filter(key => key.includes('/delivery/')).length,
    [...delivery.objects.keys()].filter(key => key.includes('/staged/')).length);
  assert.equal(expected.includes('original/') || expected.includes('staged/') || expected.includes('X-Amz-'), false);
  assert.equal(originals.objects.has(storage.originalKey(scope, session)), true);
  const timestamp = '2026-10-12T00:00:00.000Z';
  const sourceId = `src_${'3'.repeat(32)}`;
  const artworkId = `ma_${'4'.repeat(32)}`;
  const artworkUrl = 'https://media.example.org/approved-cover.jpg';
  const channel = fixtureChannel();
  const ownedChannel = { ...channel, id: scope.projectId,
    content: [{ ...channel.content[0]!, artwork: artworkUrl }] };
  const externalId = { provider: 'creator' as const, kind: 'feed_item_id' as const, value: 'owned-fixture' };
  const rights = (permittedUse: 'television_display' | 'television_playback') => ({ status: 'cleared' as const,
    basis: 'creator_asserted' as const, permittedUse, assertedAt: timestamp });
  const sourceRecord = { schemaVersion: 1 as const, id: sourceId, creatorAccountId: scope.creatorAccountId,
    projectId: scope.projectId, type: 'creator_json' as const, state: 'verified' as const,
    permission: { retrieval: 'creator_asserted' as const, tvDisplay: 'creator_asserted' as const,
      verificationEvidenceId: `ev_${'5'.repeat(32)}` } };
  const item = { schemaVersion: 1 as const, id: claim.itemId, creatorAccountId: scope.creatorAccountId,
    projectId: scope.projectId, kind: 'video' as const,
    sourceRecord: { sourceId, externalId, observedAt: timestamp, metadata: { title: 'Owned film' } },
    externalIdentifiers: [externalId], mediaAssetIds: [scope.mediaAssetId, artworkId] };
  const video = { schemaVersion: 1 as const, id: scope.mediaAssetId, creatorAccountId: scope.creatorAccountId,
    projectId: scope.projectId, catalogItemId: claim.itemId, kind: 'video' as const,
    location: { type: 'managed_hls' as const }, tvDisplayRights: rights('television_display'),
    tvPlaybackRights: rights('television_playback'), deliveryEligible: true };
  const artwork = { schemaVersion: 1 as const, id: artworkId, creatorAccountId: scope.creatorAccountId,
    projectId: scope.projectId, catalogItemId: claim.itemId, kind: 'artwork' as const,
    location: { type: 'https' as const, url: artworkUrl }, rights: rights('television_display'),
    deliveryEligible: true };
  const releaseInput = { approval: { state: 'approved', creatorAccountId: scope.creatorAccountId,
    projectId: scope.projectId, revisions: { channel: 1, catalog: 3 }, approvalId: `ap_${'6'.repeat(32)}`,
    approvedAt: timestamp }, deployment: { schemaVersion: 1, id: `dep_${'7'.repeat(32)}`,
      creatorAccountId: scope.creatorAccountId, projectId: scope.projectId, channelId: scope.projectId,
      appName: 'Owned channel', packageId: 'com.example.owned', releaseControl: 'creator',
      nativeReleaseApproval: 'creator_approved', consoleEvidence: { state: 'none' } }, channel: ownedChannel,
    inventory: { schemaVersion: 1, creatorAccountId: scope.creatorAccountId, projectId: scope.projectId,
      sources: [sourceRecord], items: [item], mediaAssets: [video, artwork], collections: [] },
    bindings: { content: [{ contentId: ownedChannel.content[0]!.id, catalogItemId: item.id,
      playbackAssetId: video.id, artworkAssetId: artwork.id }] },
    releaseId: `rel_${'8'.repeat(32)}`, releaseSequence: 1, publishedAt: timestamp,
    resolvedPlayback: new Map([[video.id, expected]]) };
  const manifest = projectApprovedManifest(releaseInput);
  assert.equal(assertClientCompatible(manifest, 1).channel.content[0]?.mediaUrl, expected);
  const bytes = canonicalBytes(manifest);
  assert.doesNotMatch(bytes, /creatorAccountId|verificationEvidenceId|original|staged|X-Amz-|private|transcript/);
  assert.throws(() => projectApprovedManifest({ ...releaseInput,
    inventory: { ...releaseInput.inventory, mediaAssets: [{ ...video, creatorAccountId: foreign.accountId }, artwork] } }));
  assert.throws(() => projectApprovedManifest({ ...releaseInput,
    inventory: { ...releaseInput.inventory, mediaAssets: [{ ...video,
      tvPlaybackRights: { ...rights('television_playback'), status: 'revoked' as const } }, artwork] } }));
  assert.throws(() => projectApprovedManifest({ ...releaseInput,
    approval: { ...releaseInput.approval, state: 'draft' } }));
  assert.throws(() => projectApprovedManifest({ ...releaseInput,
    resolvedPlayback: new Map([[video.id, 'https://media.example.org/private/master.m3u8?token=secret']]) }));
  assert.throws(() => assertClientCompatible(manifest, 2));
  assert.equal(canonicalBytes(manifest), bytes);
});

test('delivery write errors remain private and never create an approved object', async () => {
  const { storage, delivery } = setup();
  const body = Buffer.from('#EXTM3U\n');
  delivery.failNext = 'PutObjectCommand';
  await assert.rejects(storage.putStaged(scope, set, 'master.m3u8', body, sha(body)), error =>
    error instanceof Error && error.message === 'Media storage: S3 request failed' && !error.message.includes('secret-value'));
  assert.equal(delivery.objects.size, 0);
});

test('operator cleanup refuses oversized delivery prefixes before deleting anything', async () => {
  const { storage, delivery } = setup();
  const prefix = storage.deliveryKey(scope, set, 'a'.repeat(64), 'v480-000.ts').replace('v480-000.ts', '');
  for (let index = 0; index < 1001; index++) delivery.objects.set(`${prefix}segment_${index}.ts`, {
    body: Buffer.from('x'), type: 'video/mp2t', encryption: 'AES256', checksumType: 'FULL_OBJECT',
    etag: '"x"' });
  await assert.rejects(storage.removePublishedAsset(scope), /1000-object/);
  assert.equal(delivery.calls.some(call => call.name === 'DeleteObjectCommand'), false);
});

test('worker download binds owned S3 original to full SHA-256 and deletes corrupt staging', async t => {
  const { storage, originals } = setup();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'firelaunch-storage-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const body = Buffer.from('owned original bytes');
  const key = storage.originalKey(scope, session);
  originals.objects.set(key, { body, type: 'video/mp4', encryption: 'AES256', checksumType: 'FULL_OBJECT',
    crc: 'aGVsbG8=', etag: '"original"' });
  const good = path.join(dir, 'good.mp4');
  await storage.downloadOriginal(scope, session, { bytes: body.length, sha256: sha(body) }, good);
  assert.deepEqual(await readFile(good), body);
  await assert.rejects(storage.downloadOriginal(other, session, { bytes: body.length, sha256: sha(body) },
    path.join(dir, 'foreign.mp4')), /S3 request failed/);
  const bad = path.join(dir, 'bad.mp4');
  await assert.rejects(storage.downloadOriginal(scope, session, { bytes: body.length, sha256: '0'.repeat(64) },bad),
    /integrity/);
  await assert.rejects(readFile(bad), /ENOENT/);
  await assert.rejects(storage.downloadOriginal(scope, session, { bytes: 2_000_000_001, sha256: sha(body) },
    path.join(dir, 'oversized.mp4')), /limit/);
});
