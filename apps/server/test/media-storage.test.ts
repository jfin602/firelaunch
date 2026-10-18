import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import test from 'node:test';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { assertClientCompatible, projectApprovedManifest } from '@firelaunch/contracts';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { canonicalBytes } from '../src/publication-repository.js';
import { mediaStorageConfigFromEnv, mediaStorageFromEnv, publisherCredentialsFromEnv, publisherRoleConfigFromEnv, S3MediaStorage,
  type MediaScope, type MediaStorageConfig } from '../src/media-storage.js';

const scope: MediaScope = { creatorAccountId: `cr_${'a'.repeat(32)}`, projectId: `ch_${'b'.repeat(32)}`,
  mediaAssetId: `ma_${'c'.repeat(32)}` };
const other: MediaScope = { ...scope, creatorAccountId: `cr_${'d'.repeat(32)}` };
const session = `up_${'e'.repeat(32)}`;
const set = `rs_${'f'.repeat(32)}`;
const config: MediaStorageConfig = { region: 'us-east-2', originalsBucket: 'firelaunch-originals-test',
  deliveryBucket: 'firelaunch-delivery-test', cloudFrontOrigin: 'https://media.example.org/',
  allowedCloudFrontHosts: ['media.example.org'] };
const roleEnv = { FIRELAUNCH_MEDIA_AWS_REGION: config.region, FIRELAUNCH_MEDIA_ORIGINALS_BUCKET: config.originalsBucket,
  FIRELAUNCH_MEDIA_DELIVERY_BUCKET: config.deliveryBucket, FIRELAUNCH_MEDIA_CLOUDFRONT_HOSTS: 'media.example.org',
  FIRELAUNCH_MEDIA_CLOUDFRONT_ORIGIN: config.cloudFrontOrigin, FIRELAUNCH_MEDIACONVERT_ACCOUNT: '363242105231',
  FIRELAUNCH_MEDIA_PUBLISHER_ROLE_ARN: 'arn:aws:iam::363242105231:role/firelaunch/media-publisher' };
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
type ObjectRecord = { body: Buffer; type: string; encryption: string; checksumType: string; crc?: string; sha?: string; etag: string };
class FakeS3 {
  constructor(readonly objects = new Map<string, ObjectRecord>()) {}
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
  const publisher = new FakeS3(delivery.objects); const operator = new FakeS3(delivery.objects);
  return { originals, delivery, publisher, operator, storage: mediaStorageFromEnv(roleEnv, {
    originals: originals as unknown as S3Client, staging: delivery as unknown as S3Client,
    publisher: publisher as unknown as S3Client, operator: operator as unknown as S3Client }) }; };

test('media AWS configuration and CloudFront origin fail closed without echoing secrets', () => {
  assert.throws(() => mediaStorageConfigFromEnv({}), /invalid/);
  const env = { FIRELAUNCH_MEDIA_AWS_REGION: 'us-east-2', FIRELAUNCH_MEDIA_ORIGINALS_BUCKET: config.originalsBucket,
    FIRELAUNCH_MEDIA_DELIVERY_BUCKET: config.deliveryBucket, FIRELAUNCH_MEDIA_CLOUDFRONT_HOSTS: 'media.example.org',
    FIRELAUNCH_MEDIA_CLOUDFRONT_ORIGIN: config.cloudFrontOrigin, AWS_SECRET_ACCESS_KEY: 'secret-value' };
  assert.equal(mediaStorageConfigFromEnv(env).cloudFrontOrigin, config.cloudFrontOrigin);
  assert.equal(mediaStorageConfigFromEnv({ ...env, FIRELAUNCH_MEDIA_CLOUDFRONT_ORIGIN: '', FIRELAUNCH_MEDIA_CLOUDFRONT_HOSTS: '' }).cloudFrontOrigin, '');
  for (const origin of ['http://media.example.org/', 'https://evil.example.org/', 'https://media.example.org.evil.test/',
    'https://user:secret-value@media.example.org/', 'https://media.example.org/path', 'https://media.example.org/?sig=secret-value',
    'https://media.example.org:444/', 'https://127.0.0.1/']) {
    assert.throws(() => mediaStorageConfigFromEnv({ ...env, FIRELAUNCH_MEDIA_CLOUDFRONT_ORIGIN: origin }), error =>
      error instanceof Error && !error.message.includes('secret-value'));
  }
  assert.throws(() => mediaStorageConfigFromEnv({ ...env, FIRELAUNCH_MEDIA_DELIVERY_BUCKET: config.originalsBucket }), /invalid/);
  assert.throws(() => mediaStorageConfigFromEnv({ ...env, FIRELAUNCH_MEDIA_CLOUDFRONT_HOSTS: 'media.example.org,127.0.0.1' }), /invalid/);
});

test('publisher role must be a same-account IAM role when publication is configured', () => {
  const env = roleEnv;
  assert.equal(publisherRoleConfigFromEnv(env).accountId, '363242105231');
  for (const roleArn of ['', 'arn:aws:iam::000000000000:role/firelaunch/media-publisher',
    'arn:aws:iam::363242105231:user/media-publisher', 'arn:aws:iam::363242105231:role/../publisher',
    'arn:aws:iam::363242105231:role/publisher*']) {
    assert.throws(() => publisherRoleConfigFromEnv({ ...env, FIRELAUNCH_MEDIA_PUBLISHER_ROLE_ARN: roleArn }), /publisher role/);
  }
  assert.throws(() => publisherRoleConfigFromEnv({ ...env, FIRELAUNCH_MEDIACONVERT_ACCOUNT: '' }), /publisher role/);
  assert.ok(mediaStorageFromEnv({ ...env, FIRELAUNCH_MEDIA_PUBLISHER_ROLE_ARN: '' }));
});

test('STS publisher credentials refresh without falling back to control credentials', async () => {
  const assumed: string[] = [];
  let fail = false;
  const requestHandler = { handle: async (request: { body: string }) => {
    assert.match(String(request.body), /RoleArn=arn%3Aaws%3Aiam%3A%3A363242105231%3Arole%2Ffirelaunch%2Fmedia-publisher/);
    if (fail) throw new Error('simulated STS denial: private-detail');
    const accessKeyId = `ASIAFAKE${assumed.length + 1}`;
    assumed.push(accessKeyId);
    const xml = `<AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><AssumeRoleResult><Credentials>` +
      `<AccessKeyId>${accessKeyId}</AccessKeyId><SecretAccessKey>fake-secret</SecretAccessKey>` +
      `<SessionToken>fake-session</SessionToken><Expiration>${new Date(Date.now() + 3_600_000).toISOString()}</Expiration>` +
      `</Credentials></AssumeRoleResult></AssumeRoleResponse>`;
    return { response: { statusCode: 200, headers: {}, body: Readable.from([Buffer.from(xml)]) } };
  } };
  const provider = publisherCredentialsFromEnv(roleEnv, {
    masterCredentials: { accessKeyId: 'CONTROLFAKE', secretAccessKey: 'control-secret' },
    clientConfig: { requestHandler: requestHandler as never }
  });
  const first = await provider();
  const refreshed = await provider();
  assert.deepEqual(assumed, ['ASIAFAKE1', 'ASIAFAKE2']);
  assert.notEqual(first.accessKeyId, refreshed.accessKeyId);
  assert.notEqual(refreshed.accessKeyId, 'CONTROLFAKE');
  fail = true;
  await assert.rejects(provider(), /simulated STS denial/);
});

test('S3 client refreshes near-expiry publisher credentials through STS', async () => {
  let stsCalls = 0;
  const authorizations: string[] = [];
  const provider = publisherCredentialsFromEnv(roleEnv, {
    masterCredentials: { accessKeyId: 'CONTROLFAKE', secretAccessKey: 'control-secret' },
    clientConfig: { requestHandler: { handle: async () => {
      const index = ++stsCalls;
      const expiration = new Date(Date.now() + (index === 1 ? 60_000 : 3_600_000)).toISOString();
      const xml = `<AssumeRoleResponse><AssumeRoleResult><Credentials><AccessKeyId>ASIAFAKE${index}</AccessKeyId>` +
        `<SecretAccessKey>fake-secret</SecretAccessKey><SessionToken>fake-session</SessionToken>` +
        `<Expiration>${expiration}</Expiration></Credentials></AssumeRoleResult></AssumeRoleResponse>`;
      return { response: { statusCode: 200, headers: {}, body: Readable.from([Buffer.from(xml)]) } };
    } } as never }
  });
  const client = new S3Client({ region: config.region, endpoint: 'https://s3.example.org', forcePathStyle: true,
    credentials: provider, requestHandler: { handle: async (request: { headers: Record<string, string> }) => {
      authorizations.push(request.headers.authorization ?? '');
      return { response: { statusCode: 200, headers: { etag: '"fixture"', 'content-length': '1' } } };
    } } as never });
  try {
    await client.send(new HeadObjectCommand({ Bucket: config.deliveryBucket, Key: 'media/fixture/delivery/master.m3u8' }));
    await client.send(new HeadObjectCommand({ Bucket: config.deliveryBucket, Key: 'media/fixture/delivery/master.m3u8' }));
    assert.equal(stsCalls, 2);
    assert.equal(authorizations.length, 2);
    assert.equal(authorizations.every(value => value.includes('ASIAFAKE2') && !value.includes('CONTROLFAKE')), true);
  } finally { client.destroy(); }
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
    const storage = new S3MediaStorage(config, client, client, client);
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
  const { storage, originals, delivery, publisher } = setup();
  const body = Buffer.from('#EXTM3U\n');
  const expected = { bytes: body.length, sha256: sha(body) };
  const staged = await storage.putStaged(scope, set, 'master.m3u8', body, expected.sha256);
  const first = await storage.publishStaged(scope, set, '1'.repeat(64), 'master.m3u8', expected);
  const second = await storage.publishStaged(scope, set, '1'.repeat(64), 'master.m3u8', expected);
  assert.deepEqual(second, first);
  assert.equal(staged.key.includes('/staged/'), true);
  assert.match(first.url, /^https:\/\/media\.example\.org\/media\/.*\/delivery\/.*\/master\.m3u8$/);
  assert.equal(originals.calls.length, 0);
  assert.equal(delivery.calls.every(call => String(call.input.Key).includes('/staged/')), true);
  assert.equal(publisher.calls.length > 0, true);
  assert.equal(publisher.calls.every(call => String(call.input.Key).includes('/delivery/')), true);
  assert.equal(publisher.calls.filter(call => call.name === 'PutObjectCommand').every(call => call.input.IfNoneMatch === '*'), true);
  assert.equal(delivery.objects.get(first.object.key)?.type, 'application/vnd.apple.mpegurl');
  await assert.rejects(storage.putStaged(scope, set, 'master.m3u8', Buffer.from('different'), sha(Buffer.from('different'))), /mismatch/);
  await assert.rejects(storage.publishStaged(other, set, '1'.repeat(64), 'master.m3u8', expected), /S3 request failed/);
  await assert.rejects(storage.publishStaged(scope, set, '1'.repeat(64), 'master.m3u8', { ...expected, sha256: '0'.repeat(64) }), /mismatch/);
  delivery.objects.get(staged.key)!.body = Buffer.from('tampered');
  await assert.rejects(storage.publishStaged(scope, set, '2'.repeat(64), 'master.m3u8', expected), /mismatch/);
});

test('missing or failing publisher client cannot use control credentials for publication', async () => {
  const { storage, originals, delivery, publisher } = setup();
  const body = Buffer.from('#EXTM3U\n');
  await storage.putStaged(scope, set, 'master.m3u8', body, sha(body));
  publisher.failNext = 'PutObjectCommand';
  await assert.rejects(storage.publishStaged(scope, set, '1'.repeat(64), 'master.m3u8',
    { bytes: body.length, sha256: sha(body) }), /S3 request failed/);
  assert.equal([...delivery.objects.keys()].some(key => key.includes('/delivery/')), false);
  assert.equal(originals.calls.length, 0);
  assert.equal(delivery.calls.some(call => String(call.input.Key).includes('/delivery/')), false);
  const noPublisher = new S3MediaStorage(config, originals as unknown as S3Client, delivery as unknown as S3Client);
  await assert.rejects(noPublisher.publishStaged(scope, set, '1'.repeat(64), 'master.m3u8',
    { bytes: body.length, sha256: sha(body) }), /CloudFront publication unavailable/);
});

test('STS AssumeRole failure blocks publication before a delivery S3 request', async () => {
  const originals = new FakeS3(); const staging = new FakeS3();
  const body = Buffer.from('#EXTM3U\n');
  let stsCalls = 0; let deliveryRequests = 0;
  const credentials = publisherCredentialsFromEnv(roleEnv, {
    masterCredentials: { accessKeyId: 'CONTROLFAKE', secretAccessKey: 'control-secret' },
    clientConfig: { requestHandler: { handle: async () => { stsCalls++; throw new Error('STS denied'); } } as never }
  });
  const publisher = new S3Client({ region: config.region, endpoint: 'https://s3.example.org',
    credentials, requestHandler: { handle: async () => { deliveryRequests++; throw new Error('unexpected S3 delivery'); } } as never });
  try {
    const storage = new S3MediaStorage(config, originals as unknown as S3Client, staging as unknown as S3Client, publisher);
    await storage.putStaged(scope, set, 'master.m3u8', body, sha(body));
    await assert.rejects(storage.publishStaged(scope, set, '1'.repeat(64), 'master.m3u8',
      { bytes: body.length, sha256: sha(body) }), /S3 request failed/);
    assert.equal(stsCalls > 0, true);
    assert.equal(deliveryRequests, 0);
    assert.equal(staging.calls.some(call => String(call.input.Key).includes('/delivery/')), false);
  } finally { publisher.destroy(); }
});

test('managed private HLS graph is bounded, hashed and normalized before approved publication', async () => {
  const { storage, delivery } = setup();
  const raw = `media/${'a'.repeat(32)}/${'b'.repeat(32)}/${'c'.repeat(32)}/staged/${'1'.repeat(32)}/`;
  const putRaw = (name: string, body: Buffer) => delivery.objects.set(`${raw}${name}`, {
    body, type: name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T',
    encryption: 'AES256', checksumType: 'FULL_OBJECT', etag: `"${sha(body)}"` });
  const segment = Buffer.alloc(188); segment[0] = 0x47;
  putRaw('source_480p000.ts', segment);
  putRaw('source_720p000.ts', segment);
  for (const height of [480, 720]) putRaw(`source_${height}p.m3u8`, Buffer.from(
    `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:1\n#EXTINF:6,\nsource_${height}p000.ts\n#EXT-X-ENDLIST\n`));
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
  const { storage, delivery, publisher, operator } = setup();
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
  assert.equal(new URL(expected).pathname.slice(1), storage.deliveryKey(scope, set, sha(master), 'master.m3u8'));
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
  assert.equal(operator.calls.some(call => call.name === 'DeleteObjectCommand'), true);
  assert.equal(publisher.calls.some(call => call.name === 'DeleteObjectCommand' || call.name === 'ListObjectsV2Command'), false);
  assert.equal(delivery.objects.has(storage.deliveryKey(scope, set, sha(master), 'master.m3u8')), false);
  assert.equal(delivery.objects.has(storage.stagedKey(scope, set, 'master.m3u8')), true);
  assert.equal(await storage.removePublishedAsset(other), 0);
});

test('approved managed HLS keeps public manifest v1 and rejects private or revoked media', () => {
  const expected = `https://media.example.org/media/${'a'.repeat(32)}/${'b'.repeat(32)}/${'c'.repeat(32)}/delivery/${'f'.repeat(32)}/${'1'.repeat(64)}/master.m3u8`;
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
  const item = { schemaVersion: 1 as const, id: `ci_${'1'.repeat(32)}`, creatorAccountId: scope.creatorAccountId,
    projectId: scope.projectId, kind: 'video' as const,
    sourceRecord: { sourceId, externalId, observedAt: timestamp, metadata: { title: 'Owned film' } },
    externalIdentifiers: [externalId], mediaAssetIds: [scope.mediaAssetId, artworkId] };
  const video = { schemaVersion: 1 as const, id: scope.mediaAssetId, creatorAccountId: scope.creatorAccountId,
    projectId: scope.projectId, catalogItemId: `ci_${'1'.repeat(32)}`, kind: 'video' as const,
    location: { type: 'managed_hls' as const }, tvDisplayRights: rights('television_display'),
    tvPlaybackRights: rights('television_playback'), deliveryEligible: true };
  const artwork = { schemaVersion: 1 as const, id: artworkId, creatorAccountId: scope.creatorAccountId,
    projectId: scope.projectId, catalogItemId: `ci_${'1'.repeat(32)}`, kind: 'artwork' as const,
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
    inventory: { ...releaseInput.inventory, mediaAssets: [{ ...video, creatorAccountId: other.creatorAccountId }, artwork] } }));
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
