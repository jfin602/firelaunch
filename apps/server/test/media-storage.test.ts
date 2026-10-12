import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { mediaStorageConfigFromEnv, S3MediaStorage, type MediaScope, type MediaStorageConfig } from '../src/media-storage.js';

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

test('delivery write errors remain private and never create an approved object', async () => {
  const { storage, delivery } = setup();
  const body = Buffer.from('#EXTM3U\n');
  delivery.failNext = 'PutObjectCommand';
  await assert.rejects(storage.putStaged(scope, set, 'master.m3u8', body, sha(body)), error =>
    error instanceof Error && error.message === 'Media storage: S3 request failed' && !error.message.includes('secret-value'));
  assert.equal(delivery.objects.size, 0);
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
