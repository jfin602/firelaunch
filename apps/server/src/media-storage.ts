import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import {
  AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand,
  DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, UploadPartCommand
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fromTemporaryCredentials, type FromTemporaryCredentialsOptions } from '@aws-sdk/credential-providers';
import { mediaRenditionSetSchema, type MediaRenditionSet } from '@firelaunch/contracts';

/** Storage primitives only. Auth, rights, upload quotas and release approval belong to the caller. */
export type MediaScope = Readonly<{ creatorAccountId: string; projectId: string; mediaAssetId: string }>;
export type MediaStorageConfig = Readonly<{
  region: string; originalsBucket: string; deliveryBucket: string;
  cloudFrontOrigin: string; allowedCloudFrontHosts: readonly string[];
}>;
export type StoredObject = Readonly<{ key: string; bytes: number; sha256: string }>;
export type PublisherRoleConfig = Readonly<{ accountId: string; roleArn: string }>;

const hex64 = /^[a-f0-9]{64}$/;
const bucketName = /^(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const regionName = /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/;
const fileName = /^[a-z0-9][a-z0-9_-]{0,80}\.(?:m3u8|ts|m4s|mp4)$/;
const maxOutputBytes = 64 * 1024 * 1024;
const maxOriginalBytes = 50_000_000_000;
const reject = (reason: string): never => { throw new Error(`Media storage: ${reason}`); };
const digest = (body: Buffer) => createHash('sha256').update(body).digest('hex');
const checksum = (sha256: string) => Buffer.from(sha256, 'hex').toString('base64');
const opaque = (value: string, prefix: string) => {
  if (!new RegExp(`^${prefix}_[a-f0-9]{32}$`).test(value)) reject('invalid scoped identity');
  return value.slice(prefix.length + 1);
};
const scopePath = (scope: MediaScope) => `media/${opaque(scope.creatorAccountId, 'cr')}/${opaque(scope.projectId, 'ch')}/${opaque(scope.mediaAssetId, 'ma')}`;
const outputName = (value: string) => fileName.test(value) ? value : reject('invalid output name');
const renditionId = (value: string) => opaque(value, 'rs');
const uploadId = (value: string) => opaque(value, 'up');
const contentType = (name: string) => name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl'
  : name.endsWith('.ts') ? 'video/mp2t' : 'video/mp4';
const failure = (error: unknown) => error instanceof Error && (error.name === 'PreconditionFailed' || error.name === 'ConditionalRequestConflict');

function validHost(value: string): boolean {
  return value.length <= 253 && value.includes('.') && !isIP(value) && !value.endsWith('.local') &&
    !value.endsWith('.internal') && !value.endsWith('.amazonaws.com') &&
    value.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

export function validateMediaStorageConfig(raw: MediaStorageConfig): MediaStorageConfig {
  if (!regionName.test(raw.region) || !bucketName.test(raw.originalsBucket) || !bucketName.test(raw.deliveryBucket) ||
    [raw.originalsBucket, raw.deliveryBucket].some(value => value.includes('..') || value.includes('.-') || value.includes('-.')) ||
    raw.originalsBucket === raw.deliveryBucket ||
    !raw.allowedCloudFrontHosts.every(validHost) || new Set(raw.allowedCloudFrontHosts).size !== raw.allowedCloudFrontHosts.length)
    reject('invalid region, buckets or CloudFront host allowlist');
  // A private-originals upload does not need an active CDN origin. Public
  // delivery methods still reject this upload-only configuration.
  if (!raw.cloudFrontOrigin && !raw.allowedCloudFrontHosts.length)
    return { ...raw, allowedCloudFrontHosts: [] };
  if (!raw.allowedCloudFrontHosts.length) reject('invalid CloudFront HTTPS origin');
  let url: URL;
  try { url = new URL(raw.cloudFrontOrigin); } catch { return reject('invalid CloudFront HTTPS origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash ||
    !raw.allowedCloudFrontHosts.includes(url.hostname) || !validHost(url.hostname) ||
    url.origin + '/' !== raw.cloudFrontOrigin)
    reject('invalid CloudFront HTTPS origin');
  return { ...raw, allowedCloudFrontHosts: [...raw.allowedCloudFrontHosts] };
}

export function mediaStorageConfigFromEnv(env: NodeJS.ProcessEnv): MediaStorageConfig {
  return validateMediaStorageConfig({
    region: env.FIRELAUNCH_MEDIA_AWS_REGION ?? '', originalsBucket: env.FIRELAUNCH_MEDIA_ORIGINALS_BUCKET ?? '',
    deliveryBucket: env.FIRELAUNCH_MEDIA_DELIVERY_BUCKET ?? '',
    cloudFrontOrigin: env.FIRELAUNCH_MEDIA_CLOUDFRONT_ORIGIN ?? '',
    allowedCloudFrontHosts: (env.FIRELAUNCH_MEDIA_CLOUDFRONT_HOSTS ?? '').split(',').map(value => value.trim()).filter(Boolean)
  });
}

export function publisherRoleConfigFromEnv(env: NodeJS.ProcessEnv): PublisherRoleConfig {
  const accountId = env.FIRELAUNCH_MEDIACONVERT_ACCOUNT ?? '';
  const roleArn = env.FIRELAUNCH_MEDIA_PUBLISHER_ROLE_ARN ?? '';
  const match = /^arn:aws:iam::([0-9]{12}):role\/(?:[A-Za-z0-9+=,.@_-]+\/)*[A-Za-z0-9+=,.@_-]+$/.exec(roleArn);
  if (!/^[0-9]{12}$/.test(accountId) || !match || match[1] !== accountId ||
    roleArn.slice(roleArn.indexOf(':role/') + 6).split('/').some(segment => segment === '.' || segment === '..'))
    reject('missing or invalid same-account publisher role');
  return { accountId, roleArn };
}

export function publisherCredentialsFromEnv(env: NodeJS.ProcessEnv,
  options: Pick<FromTemporaryCredentialsOptions, 'masterCredentials' | 'clientConfig'> = {}) {
  const role = publisherRoleConfigFromEnv(env);
  const region = mediaStorageConfigFromEnv(env).region;
  return fromTemporaryCredentials({
    params: { RoleArn: role.roleArn, RoleSessionName: 'firelaunch-media-publisher', DurationSeconds: 3600 },
    ...options, clientConfig: { ...options.clientConfig, region }
  });
}

export class S3MediaStorage {
  private readonly config: MediaStorageConfig;
  constructor(config: MediaStorageConfig, private readonly originals: S3Client, private readonly staging: S3Client,
    private readonly publisher?: S3Client, private readonly operator?: S3Client) {
    this.config = validateMediaStorageConfig(config);
  }

  private async request<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch { return reject('S3 request failed'); }
  }

  private deliveryOrigin(): string {
    if (!this.config.cloudFrontOrigin || !this.publisher) reject('CloudFront publication unavailable');
    return this.config.cloudFrontOrigin;
  }

  originalKey(scope: MediaScope, sessionId: string): string {
    return `${scopePath(scope)}/original/${uploadId(sessionId)}.mp4`;
  }
  stagedKey(scope: MediaScope, setId: string, name: string): string {
    return `${scopePath(scope)}/staged/${renditionId(setId)}/${outputName(name)}`;
  }
  deliveryKey(scope: MediaScope, setId: string, versionSha256: string, name: string): string {
    if (!hex64.test(versionSha256)) reject('invalid rendition version');
    return `${scopePath(scope)}/delivery/${renditionId(setId)}/${versionSha256}/${outputName(name)}`;
  }

  publishedMasterUrl(scope: MediaScope, input: MediaRenditionSet): string {
    const set = mediaRenditionSetSchema.parse(input);
    if (set.revokedAt || set.creatorAccountId !== scope.creatorAccountId ||
      set.projectId !== scope.projectId || set.mediaAssetId !== scope.mediaAssetId ||
      set.masterKey !== this.stagedKey(scope, set.id, 'master.m3u8') ||
      set.variants.some(v => v.playlistKey !== this.stagedKey(scope, set.id, `v${v.height}.m3u8`)))
      reject('rendition identity or staging scope mismatch');
    return new URL(this.deliveryKey(scope, set.id, set.masterSha256, 'master.m3u8'), this.deliveryOrigin()).toString();
  }

  async createOriginal(scope: MediaScope, sessionId: string): Promise<{ key: string; uploadId: string }> {
    const key = this.originalKey(scope, sessionId);
    const result = await this.request(() => this.originals.send(new CreateMultipartUploadCommand({
      Bucket: this.config.originalsBucket, Key: key, ContentType: 'video/mp4',
      ServerSideEncryption: 'AES256', ChecksumAlgorithm: 'CRC64NVME'
    })));
    if (!result.UploadId) reject('S3 did not return multipart upload ID');
    return { key, uploadId: result.UploadId! };
  }

  async uploadOriginalPart(scope: MediaScope, sessionId: string, s3UploadId: string,
    partNumber: number, body: Buffer): Promise<{ partNumber: number; etag: string }> {
    if (!s3UploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000 ||
      !Buffer.isBuffer(body) || body.length < 1 || body.length > 5_000_000_000) reject('invalid multipart part');
    const result = await this.request(() => this.originals.send(new UploadPartCommand({ Bucket: this.config.originalsBucket,
      Key: this.originalKey(scope, sessionId), UploadId: s3UploadId, PartNumber: partNumber, Body: body })));
    if (!result.ETag) reject('S3 did not return part ETag');
    return { partNumber, etag: result.ETag! };
  }

  async signOriginalPart(scope: MediaScope, sessionId: string, s3UploadId: string,
    partNumber: number, contentLength: number): Promise<{ url: string; expiresInSeconds: number; contentLength: number }> {
    if (!s3UploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 1000)
      reject('invalid multipart part');
    if (!Number.isInteger(contentLength) || contentLength < 1 || contentLength > 8 * 1024 * 1024)
      reject('invalid multipart part length');
    const expiresInSeconds = 300;
    const url = await this.request(() => getSignedUrl(this.originals, new UploadPartCommand({
      Bucket: this.config.originalsBucket, Key: this.originalKey(scope, sessionId),
      UploadId: s3UploadId, PartNumber: partNumber, ContentLength: contentLength
    }), { expiresIn: expiresInSeconds }));
    return { url, expiresInSeconds, contentLength };
  }

  async headOriginal(scope: MediaScope, sessionId: string, expectedBytes: number): Promise<void> {
    const head = await this.request(() => this.originals.send(new HeadObjectCommand({
      Bucket: this.config.originalsBucket, Key: this.originalKey(scope, sessionId), ChecksumMode: 'ENABLED'
    })));
    if (head.ContentLength !== expectedBytes || head.ContentType !== 'video/mp4' ||
      head.ServerSideEncryption !== 'AES256' || head.ChecksumType !== 'FULL_OBJECT' ||
      !head.ChecksumCRC64NVME || !head.ETag)
      reject('completed original size, type, encryption or checksum missing');
  }

  async completeOriginal(scope: MediaScope, sessionId: string, s3UploadId: string,
    parts: readonly { partNumber: number; etag: string }[]): Promise<void> {
    if (!s3UploadId || !parts.length || parts.length > 10000 ||
      parts.some((part, index) => part.partNumber !== index + 1 || !/^"?[a-f0-9]{32}(?:-\d+)?"?$/.test(part.etag)))
      reject('invalid multipart completion');
    const key = this.originalKey(scope, sessionId);
    await this.request(() => this.originals.send(new CompleteMultipartUploadCommand({ Bucket: this.config.originalsBucket,
      Key: key, UploadId: s3UploadId, IfNoneMatch: '*',
      MultipartUpload: { Parts: parts.map(part => ({ PartNumber: part.partNumber, ETag: part.etag })) } })));
  }

  async abortOriginal(scope: MediaScope, sessionId: string, s3UploadId: string): Promise<void> {
    if (!s3UploadId) reject('missing multipart upload ID');
    try {
      await this.originals.send(new AbortMultipartUploadCommand({ Bucket: this.config.originalsBucket,
        Key: this.originalKey(scope, sessionId), UploadId: s3UploadId }));
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchUpload') return;
      reject('S3 request failed');
    }
  }

  /** Removes a completed object left behind when S3 completion succeeded but DB finalization did not. */
  async deleteOrphanOriginal(scope: MediaScope, sessionId: string): Promise<void> {
    await this.request(() => this.originals.send(new DeleteObjectCommand({
      Bucket: this.config.originalsBucket, Key: this.originalKey(scope, sessionId)
    })));
  }

  /** Run on a capacity-controlled worker: S3 multipart ETags and composite SHA-256 are not full-object SHA-256. */
  async verifyOriginal(scope: MediaScope, sessionId: string, expected: { bytes: number; sha256: string }): Promise<StoredObject> {
    if (!Number.isSafeInteger(expected.bytes) || expected.bytes < 1 || expected.bytes > maxOriginalBytes || !hex64.test(expected.sha256))
      reject('invalid original expectation');
    const key = this.originalKey(scope, sessionId);
    const head = await this.request(() => this.originals.send(new HeadObjectCommand({ Bucket: this.config.originalsBucket,
      Key: key, ChecksumMode: 'ENABLED' })));
    if (head.ContentLength !== expected.bytes || head.ContentType !== 'video/mp4' ||
      head.ServerSideEncryption !== 'AES256' || head.ChecksumType !== 'FULL_OBJECT' || !head.ChecksumCRC64NVME || !head.ETag)
      reject('original S3 size, type, encryption or checksum missing');
    const object = await this.request(() => this.originals.send(new GetObjectCommand({ Bucket: this.config.originalsBucket, Key: key, IfMatch: head.ETag })));
    if (!object.Body || object.ContentLength !== expected.bytes) reject('original S3 read differs from HEAD');
    const hash = createHash('sha256');
    let bytes = 0;
    try {
      for await (const chunk of object.Body as Readable) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += data.length;
        if (bytes > expected.bytes) reject('original exceeds expected size');
        hash.update(data);
      }
    } catch { reject('original S3 read failed or exceeded expected size'); }
    const sha256 = hash.digest('hex');
    if (bytes !== expected.bytes || sha256 !== expected.sha256) reject('original checksum or size mismatch');
    return { key, bytes, sha256 };
  }

  private async verifyOutput(key: string, expected: { bytes: number; sha256: string }, name: string): Promise<string> {
    const client = key.includes('/delivery/') ? this.requirePublisher() : this.staging;
    const head = await this.request(() => client.send(new HeadObjectCommand({ Bucket: this.config.deliveryBucket,
      Key: key, ChecksumMode: 'ENABLED' })));
    if (head.ContentLength !== expected.bytes || head.ContentType !== contentType(name) ||
      head.ServerSideEncryption !== 'AES256' || head.ChecksumType !== 'FULL_OBJECT' ||
      head.ChecksumSHA256 !== checksum(expected.sha256) || !head.ETag) reject('rendition object metadata or checksum mismatch');
    return head.ETag!;
  }

  private async putImmutable(key: string, name: string, body: Buffer, sha256: string): Promise<void> {
    if (!Buffer.isBuffer(body) || body.length < 1 || body.length > maxOutputBytes || !hex64.test(sha256) || digest(body) !== sha256)
      reject('rendition body checksum or size mismatch');
    try {
      const client = key.includes('/delivery/') ? this.requirePublisher() : this.staging;
      await client.send(new PutObjectCommand({ Bucket: this.config.deliveryBucket, Key: key, Body: body,
        ContentType: contentType(name), ContentLength: body.length, ServerSideEncryption: 'AES256',
        ChecksumSHA256: checksum(sha256), IfNoneMatch: '*',
        CacheControl: key.includes('/staged/') ? 'private, no-store' : 'public, max-age=60' }));
    } catch (error) { if (!failure(error)) reject('S3 request failed'); }
    await this.verifyOutput(key, { bytes: body.length, sha256 }, name);
  }

  async putStaged(scope: MediaScope, setId: string, name: string, body: Buffer, sha256: string): Promise<StoredObject> {
    const key = this.stagedKey(scope, setId, name);
    await this.putImmutable(key, name, body, sha256);
    return { key, bytes: body.length, sha256 };
  }

  /** Read only the correlated MediaConvert private prefix; normalize its bounded HLS graph into immutable v1 files. */
  async verifyManagedHls(scope: MediaScope, rawPrefix: string, setId: string, jobId: string,
    catalogItemId: string): Promise<MediaRenditionSet> {
    const ownedPrefix = `${scopePath(scope)}/staged/`;
    if (!new RegExp(`^${ownedPrefix}[a-f0-9]{32}/$`).test(rawPrefix) ||
      rawPrefix === `${ownedPrefix}${renditionId(setId)}/`) reject('managed output prefix differs from reserved scope');
    const listed = await this.request(() => this.staging.send(new ListObjectsV2Command({
      Bucket: this.config.deliveryBucket, Prefix: rawPrefix, MaxKeys: 1000 })));
    if (listed.IsTruncated || !listed.Contents?.length || listed.Contents.length > 600) reject('managed HLS graph missing or too large');
    const keys = listed.Contents!.map(value => value.Key);
    if (keys.some(value => !value || !value.startsWith(rawPrefix) ||
      !fileName.test(value.slice(rawPrefix.length)))) reject('managed HLS path invalid');
    const names = new Set(keys.map(value => value!.slice(rawPrefix.length)));
    if (names.size !== keys.length) reject('managed HLS duplicate output');
    const read = async (name: string): Promise<Buffer> => {
      if (!names.has(name)) reject('managed HLS object missing');
      const key = `${rawPrefix}${outputName(name)}`;
      const head = await this.request(() => this.staging.send(new HeadObjectCommand({
        Bucket: this.config.deliveryBucket, Key: key })));
      if (!head.ETag || !head.ContentLength || head.ContentLength > maxOutputBytes ||
        head.ContentType !== contentType(name) || head.ServerSideEncryption !== 'AES256')
        reject('managed HLS object metadata invalid');
      const expectedLength = head.ContentLength!;
      const object = await this.request(() => this.staging.send(new GetObjectCommand({
        Bucket: this.config.deliveryBucket, Key: key, IfMatch: head.ETag })));
      if (!object.Body || object.ContentLength !== expectedLength) reject('managed HLS object changed');
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of object.Body as Readable) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += data.length;
        if (bytes > expectedLength || bytes > maxOutputBytes) reject('managed HLS object too large');
        chunks.push(data);
      }
      if (bytes !== expectedLength) reject('managed HLS object length changed');
      const after = await this.request(() => this.staging.send(new HeadObjectCommand({
        Bucket: this.config.deliveryBucket, Key: key })));
      if (after.ETag !== head.ETag || after.ContentLength !== expectedLength) reject('managed HLS object mutated');
      return Buffer.concat(chunks);
    };
    const playlists = [...names].filter(name => name.endsWith('.m3u8'));
    if (playlists.length !== 3) reject('managed HLS playlist count differs');
    const bodies = await Promise.all(playlists.map(async name => [name, (await read(name)).toString('utf8')] as const));
    const masters = bodies.filter(([, body]) => body.includes('#EXT-X-STREAM-INF:'));
    if (masters.length !== 1) reject('managed HLS master missing');
    const masterLines = masters[0]![1].replaceAll('\r\n', '\n').trim().split('\n');
    if (masterLines[0] !== '#EXTM3U' || masterLines.some(line =>
      line.includes('://') || line.includes('..') || line.startsWith('#EXT-X-KEY') || line.startsWith('#EXT-X-MEDIA:')))
      reject('managed HLS master unsafe');
    const streams: Array<{ height: 480 | 720; bandwidth: number; name: string }> = [];
    for (let index = 1; index < masterLines.length; index++) {
      const line = masterLines[index]!;
      if (!line.startsWith('#EXT-X-STREAM-INF:')) {
        if (!/^#EXT-X-VERSION:[3-6]$/.test(line) && line !== '#EXT-X-INDEPENDENT-SEGMENTS')
          reject('managed HLS master directive unsupported');
        continue;
      }
      const attributes = line.slice('#EXT-X-STREAM-INF:'.length);
      const bandwidth = /(?:^|,)BANDWIDTH=([1-9]\d*)/.exec(attributes)?.[1];
      const height = /(?:^|,)RESOLUTION=\d+x(480|720)(?:,|$)/.exec(attributes)?.[1];
      const codec = /(?:^|,)CODECS="([^"]+)"/.exec(attributes)?.[1];
      const name = masterLines[++index];
      if (!bandwidth || !height || !codec?.includes('avc1') || !codec.includes('mp4a') ||
        !name || !names.has(name) || !name.endsWith('.m3u8')) reject('managed HLS profile differs');
      streams.push({ height: Number(height) as 480 | 720, bandwidth: Number(bandwidth), name: name! });
    }
    if (streams.length !== 2 || new Set(streams.map(v => v.height)).size !== 2 ||
      streams.some(v => v.bandwidth > 5_000_000)) reject('managed HLS fixed profile differs');
    const canonical = ['#EXTM3U', '#EXT-X-VERSION:3'];
    const variants: MediaRenditionSet['variants'] = [];
    const referenced = new Set([masters[0]![0]]);
    for (const stream of streams.sort((a, b) => a.height - b.height)) {
      referenced.add(stream.name);
      const body = bodies.find(([name]) => name === stream.name)?.[1];
      if (!body) reject('managed HLS variant missing');
      const lines = body!.replaceAll('\r\n', '\n').trim().split('\n');
      if (lines[0] !== '#EXTM3U' || lines.at(-1) !== '#EXT-X-ENDLIST' ||
        lines.some(line => line.includes('://') || line.includes('..') || line.startsWith('#EXT-X-KEY') ||
          line.startsWith('#EXT-X-MAP') || line.startsWith('#EXT-X-BYTERANGE'))) reject('managed HLS variant unsafe');
      const pairs: Array<{ duration: string; name: string }> = [];
      for (let i = 1; i < lines.length - 1; i++) {
        const line = lines[i]!;
        if (line.startsWith('#EXTINF:')) {
          const duration = /^#EXTINF:([0-9]+(?:\.[0-9]+)?),?$/.exec(line)?.[1];
          const name = lines[++i];
          if (!duration || !name || !name.endsWith('.ts') || !names.has(name))
            reject('managed HLS segment reference invalid');
          pairs.push({ duration: duration!, name: name! });
        } else if (!(/^#EXT-X-VERSION:[3-6]$/.test(line) || line === '#EXT-X-INDEPENDENT-SEGMENTS' ||
          line === '#EXT-X-PLAYLIST-TYPE:VOD' || /^#EXT-X-TARGETDURATION:[1-9]\d*$/.test(line) ||
          /^#EXT-X-MEDIA-SEQUENCE:0$/.test(line))) reject('managed HLS variant directive unsupported');
      }
      if (!pairs.length || pairs.length > 250 || pairs.reduce((sum, pair) => sum + Number(pair.duration), 0) > 1800)
        reject('managed HLS segment limit exceeded');
      const hashes: string[] = [];
      const targetDuration = Math.ceil(Math.max(...pairs.map(pair => Number(pair.duration))));
      if (targetDuration < 1 || targetDuration > 10) reject('managed HLS segment duration differs');
      const rendered = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-INDEPENDENT-SEGMENTS',
        '#EXT-X-PLAYLIST-TYPE:VOD', `#EXT-X-TARGETDURATION:${targetDuration}`, '#EXT-X-MEDIA-SEQUENCE:0'];
      for (const [index, pair] of pairs.entries()) {
        if (referenced.has(pair.name)) reject('managed HLS segment repeated');
        referenced.add(pair.name);
        const segment = await read(pair.name);
        if (segment.length < 188 || segment.length % 188 !== 0 || segment[0] !== 0x47)
          reject('managed HLS MPEG-TS segment invalid');
        const name = `v${stream.height}-${String(index).padStart(3, '0')}.ts`;
        const hash = digest(segment); hashes.push(hash);
        await this.putStaged(scope, setId, name, segment, hash);
        rendered.push(`#EXTINF:${pair.duration},`, name);
      }
      rendered.push('#EXT-X-ENDLIST');
      const playlist = Buffer.from(`${rendered.join('\n')}\n`);
      const name = `v${stream.height}.m3u8`;
      const object = await this.putStaged(scope, setId, name, playlist, digest(playlist));
      variants.push({ height: stream.height, playlistKey: object.key, playlistSha256: object.sha256,
        segmentsSha256: digest(Buffer.from(hashes.join(''))), segmentCount: pairs.length });
      canonical.push(`#EXT-X-STREAM-INF:BANDWIDTH=${stream.bandwidth},RESOLUTION=${stream.height === 480 ? 854 : 1280}x${stream.height}`, name);
    }
    if (referenced.size !== names.size) reject('managed HLS contains unexpected objects');
    const master = Buffer.from(`${canonical.join('\n')}\n`);
    const object = await this.putStaged(scope, setId, 'master.m3u8', master, digest(master));
    return mediaRenditionSetSchema.parse({ id: setId, creatorAccountId: scope.creatorAccountId,
      projectId: scope.projectId, catalogItemId, mediaAssetId: scope.mediaAssetId, jobId,
      profile: 'hls-avc-aac-v1', masterKey: object.key, masterSha256: object.sha256,
      variants, verifiedAt: new Date().toISOString() });
  }

  /** Storage copy only; the caller must enforce owner, READY state and reviewed rights before calling. */
  async publishStaged(scope: MediaScope, setId: string, versionSha256: string, name: string,
    expected: { bytes: number; sha256: string }): Promise<{ object: StoredObject; url: string }> {
    const origin = this.deliveryOrigin();
    const sourceKey = this.stagedKey(scope, setId, name);
    const key = this.deliveryKey(scope, setId, versionSha256, name);
    if (!Number.isInteger(expected.bytes) || expected.bytes < 1 || expected.bytes > maxOutputBytes || !hex64.test(expected.sha256))
      reject('invalid rendition expectation');
    const etag = await this.verifyOutput(sourceKey, expected, name);
    const source = await this.request(() => this.staging.send(new GetObjectCommand({ Bucket: this.config.deliveryBucket, Key: sourceKey, IfMatch: etag })));
    if (!source.Body || source.ContentLength !== expected.bytes) reject('staged rendition changed');
    const chunks: Buffer[] = [];
    let bytes = 0;
    try {
      for await (const chunk of source.Body as Readable) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += data.length;
        if (bytes > expected.bytes) reject('staged rendition exceeds expected size');
        chunks.push(data);
      }
    } catch { reject('staged rendition read failed or exceeded expected size'); }
    if (bytes !== expected.bytes) reject('staged rendition size mismatch');
    const body = Buffer.concat(chunks);
    await this.putImmutable(key, name, body, expected.sha256);
    return { object: { key, bytes: expected.bytes, sha256: expected.sha256 },
      url: new URL(key, origin).toString() };
  }

  /** Verify every staged HLS object before copying any of it to the CDN-readable prefix. */
  async publishVerifiedHls(scope: MediaScope, input: MediaRenditionSet): Promise<string> {
    const set = mediaRenditionSetSchema.parse(input);
    if (set.revokedAt || set.creatorAccountId !== scope.creatorAccountId || set.projectId !== scope.projectId ||
      set.mediaAssetId !== scope.mediaAssetId ||
      set.masterKey !== this.stagedKey(scope, set.id, 'master.m3u8') ||
      set.variants.some(v => v.playlistKey !== this.stagedKey(scope, set.id, `v${v.height}.m3u8`)))
      reject('rendition identity or staging scope mismatch');
    const read = async (name: string): Promise<StoredObject & { body: Buffer }> => {
      const key = this.stagedKey(scope, set.id, name);
      const head = await this.request(() => this.staging.send(new HeadObjectCommand({
        Bucket: this.config.deliveryBucket, Key: key, ChecksumMode: 'ENABLED' })));
      const length = head.ContentLength;
      if (!length || length > maxOutputBytes || !head.ETag ||
        head.ContentType !== contentType(name) || head.ServerSideEncryption !== 'AES256' ||
        head.ChecksumType !== 'FULL_OBJECT' || !head.ChecksumSHA256) return reject('staged HLS metadata incomplete');
      const expectedBytes: number = length;
      const object = await this.request(() => this.staging.send(new GetObjectCommand({
        Bucket: this.config.deliveryBucket, Key: key, IfMatch: head.ETag })));
      if (!object.Body || object.ContentLength !== expectedBytes) reject('staged HLS object changed');
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of object.Body as Readable) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += data.length;
        if (bytes > maxOutputBytes || bytes > expectedBytes) reject('staged HLS object too large');
        chunks.push(data);
      }
      const body = Buffer.concat(chunks); const sha256 = digest(body);
      if (bytes !== expectedBytes || checksum(sha256) !== head.ChecksumSHA256)
        reject('staged HLS checksum mismatch');
      return { key, bytes, sha256, body };
    };
    const files = new Map<string, StoredObject>();
    const master = await read('master.m3u8');
    if (master.sha256 !== set.masterSha256) reject('master playlist changed');
    const masterLines = master.body.toString('utf8').trimEnd().split('\n');
    if (masterLines[0] !== '#EXTM3U' || masterLines[1] !== '#EXT-X-VERSION:3' ||
      masterLines.length !== 2 + 2 * set.variants.length ||
      set.variants.some((v, i) => !new RegExp(`^#EXT-X-STREAM-INF:BANDWIDTH=[1-9]\\d*,RESOLUTION=[1-9]\\d*x${v.height}$`).test(masterLines[2 + 2 * i] ?? '') ||
        masterLines[3 + 2 * i] !== `v${v.height}.m3u8`)) reject('master playlist graph differs');
    files.set('master.m3u8', master);
    for (const variant of set.variants) {
      const name = `v${variant.height}.m3u8`;
      const playlist = await read(name);
      if (playlist.sha256 !== variant.playlistSha256) reject('variant playlist changed');
      const body = playlist.body.toString('utf8');
      if (!body.startsWith('#EXTM3U\n') || !body.includes('#EXT-X-ENDLIST') ||
        !body.includes('#EXT-X-INDEPENDENT-SEGMENTS') || body.includes('://') || body.includes('#EXT-X-KEY'))
        reject('invalid variant playlist');
      if (body.split('\n').some(line => line.startsWith('#') && !(
        line === '#EXTM3U' || line === '#EXT-X-VERSION:3' || line === '#EXT-X-VERSION:6' ||
        line === '#EXT-X-INDEPENDENT-SEGMENTS' ||
        line === '#EXT-X-PLAYLIST-TYPE:VOD' || line === '#EXT-X-ENDLIST' ||
        /^#EXT-X-TARGETDURATION:[1-9]\d*$/.test(line) || /^#EXT-X-MEDIA-SEQUENCE:\d+$/.test(line) ||
        /^#EXTINF:(?:[0-9]+(?:\.[0-9]+)?),?$/.test(line)))) reject('unsupported variant playlist directive');
      const references = body.split('\n').filter(line => line && !line.startsWith('#'));
      if (references.length !== variant.segmentCount || variant.segmentCount > 250 ||
        references.some((line, index) => line !== `v${variant.height}-${String(index).padStart(3, '0')}.ts`))
        reject('variant segment graph differs');
      files.set(name, playlist);
      const hashes: string[] = [];
      for (const segment of references) {
        const object = await read(segment);
        files.set(segment, object);
        hashes.push(object.sha256);
      }
      if (digest(Buffer.from(hashes.join(''))) !== variant.segmentsSha256) reject('segment graph changed');
    }
    for (const [name, object] of files) await this.publishStaged(scope, set.id, set.masterSha256, name, object);
    return this.publishedMasterUrl(scope, set);
  }

  /** Operator-only cleanup after a recorded revocation; never accepts a caller-supplied prefix. */
  async removePublishedAsset(scope: MediaScope): Promise<number> {
    if (!this.operator) reject('operator credentials required for delivery cleanup');
    const prefix = `${scopePath(scope)}/delivery/`;
    const listed = await this.request(() => this.operator!.send(new ListObjectsV2Command({
      Bucket: this.config.deliveryBucket, Prefix: prefix, MaxKeys: 1000 })));
    if (listed.IsTruncated || (listed.Contents?.length ?? 0) > 1000) reject('delivery cleanup exceeds 1000-object operator limit');
    const keys = listed.Contents?.map(object => object.Key) ?? [];
    if (keys.some(key => !key || !key.startsWith(prefix) || !/^media\/[a-f0-9]{32}\/[a-f0-9]{32}\/[a-f0-9]{32}\/delivery\/[a-f0-9]{32}\/[a-f0-9]{64}\/[a-z0-9_-]+\.(?:m3u8|ts|m4s|mp4)$/.test(key)))
      reject('delivery cleanup found an unsafe key');
    for (const key of keys) await this.request(() => this.operator!.send(new DeleteObjectCommand({
      Bucket: this.config.deliveryBucket, Key: key! })));
    return keys.length;
  }

  private requirePublisher(): S3Client {
    if (!this.publisher) reject('publisher credentials required for delivery publication');
    return this.publisher!;
  }
}

export function mediaStorageFromEnv(env: NodeJS.ProcessEnv,
  clients?: { originals: S3Client; staging: S3Client; publisher?: S3Client; operator?: S3Client }): S3MediaStorage {
  const config = mediaStorageConfigFromEnv(env);
  if (env.FIRELAUNCH_MEDIA_PUBLISHER_ROLE_ARN) publisherRoleConfigFromEnv(env);
  const originals = clients?.originals ?? new S3Client({ region: config.region });
  const staging = clients?.staging ?? new S3Client({ region: config.region });
  const publisher = env.FIRELAUNCH_MEDIA_PUBLISHER_ROLE_ARN
    ? clients?.publisher ?? new S3Client({ region: config.region, credentials: publisherCredentialsFromEnv(env) })
    : undefined;
  return new S3MediaStorage(config, originals, staging, publisher, clients?.operator);
}

/** The standalone revocation command uses its separately selected operator profile. */
export function mediaStorageForOperatorFromEnv(env: NodeJS.ProcessEnv, operator: S3Client): S3MediaStorage {
  const config = mediaStorageConfigFromEnv(env);
  return new S3MediaStorage(config, new S3Client({ region: config.region }), new S3Client({ region: config.region }),
    undefined, operator);
}
