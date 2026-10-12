import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import {
  AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand,
  GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, UploadPartCommand
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

/** Storage primitives only. Auth, rights, upload quotas and release approval belong to the caller. */
export type MediaScope = Readonly<{ creatorAccountId: string; projectId: string; mediaAssetId: string }>;
export type MediaStorageConfig = Readonly<{
  region: string; originalsBucket: string; deliveryBucket: string;
  cloudFrontOrigin: string; allowedCloudFrontHosts: readonly string[];
}>;
export type StoredObject = Readonly<{ key: string; bytes: number; sha256: string }>;

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
    raw.originalsBucket === raw.deliveryBucket || !raw.allowedCloudFrontHosts.length ||
    !raw.allowedCloudFrontHosts.every(validHost) || new Set(raw.allowedCloudFrontHosts).size !== raw.allowedCloudFrontHosts.length)
    reject('invalid region, buckets or CloudFront host allowlist');
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

export class S3MediaStorage {
  private readonly config: MediaStorageConfig;
  constructor(config: MediaStorageConfig, private readonly originals: S3Client, private readonly delivery: S3Client) {
    this.config = validateMediaStorageConfig(config);
  }

  private async request<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch { return reject('S3 request failed'); }
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
    await this.request(() => this.originals.send(new AbortMultipartUploadCommand({ Bucket: this.config.originalsBucket,
      Key: this.originalKey(scope, sessionId), UploadId: s3UploadId })));
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
    const head = await this.request(() => this.delivery.send(new HeadObjectCommand({ Bucket: this.config.deliveryBucket,
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
      await this.delivery.send(new PutObjectCommand({ Bucket: this.config.deliveryBucket, Key: key, Body: body,
        ContentType: contentType(name), ContentLength: body.length, ServerSideEncryption: 'AES256',
        ChecksumSHA256: checksum(sha256), IfNoneMatch: '*', CacheControl: 'public, max-age=60' }));
    } catch (error) { if (!failure(error)) reject('S3 request failed'); }
    await this.verifyOutput(key, { bytes: body.length, sha256 }, name);
  }

  async putStaged(scope: MediaScope, setId: string, name: string, body: Buffer, sha256: string): Promise<StoredObject> {
    const key = this.stagedKey(scope, setId, name);
    await this.putImmutable(key, name, body, sha256);
    return { key, bytes: body.length, sha256 };
  }

  /** Storage copy only; the caller must enforce owner, READY state and reviewed rights before calling. */
  async publishStaged(scope: MediaScope, setId: string, versionSha256: string, name: string,
    expected: { bytes: number; sha256: string }): Promise<{ object: StoredObject; url: string }> {
    const sourceKey = this.stagedKey(scope, setId, name);
    const key = this.deliveryKey(scope, setId, versionSha256, name);
    if (!Number.isInteger(expected.bytes) || expected.bytes < 1 || expected.bytes > maxOutputBytes || !hex64.test(expected.sha256))
      reject('invalid rendition expectation');
    const etag = await this.verifyOutput(sourceKey, expected, name);
    const source = await this.request(() => this.delivery.send(new GetObjectCommand({ Bucket: this.config.deliveryBucket, Key: sourceKey, IfMatch: etag })));
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
      url: new URL(key, this.config.cloudFrontOrigin).toString() };
  }
}

export function mediaStorageFromEnv(env: NodeJS.ProcessEnv, clients?: { originals: S3Client; delivery: S3Client }): S3MediaStorage {
  const config = mediaStorageConfigFromEnv(env);
  const originals = clients?.originals ?? new S3Client({ region: config.region });
  const delivery = clients?.delivery ?? new S3Client({ region: config.region });
  return new S3MediaStorage(config, originals, delivery);
}
