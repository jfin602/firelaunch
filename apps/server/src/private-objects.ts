import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rm, copyFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import { RepositoryError } from './repository.js';
import { audit, cleanOrphans } from './operations.js';
import { localHostedHttp } from './local-hosted.js';

export interface PrivateObjectStore {
  put(key: string, content: Buffer, contentType: string): Promise<void>;
  putFile(key: string, file: string, bytes: number, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  getRange(key: string, start: number, end: number): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const keySchema = z.string().regex(/^private\/[a-f0-9]{64}$/);
const objectIdSchema = z.string().regex(/^(ma|ev)_[a-f0-9]{32}$/);
const allowedTypes = {
  media: ['image/png', 'image/jpeg', 'video/mp4', 'audio/mpeg', 'text/vtt'],
  evidence: ['image/png', 'image/jpeg', 'application/pdf']
} as const;
const maximumBytes = 1_000_000;
export const MAX_PRIVATE_AUDIO_BYTES = 320_000_000;
const maximumAccountBytes = 2_000_000_000;
const maximumAccountObjects = 1000;
function matchesContentType(contentType: string, content: Buffer): boolean {
  if (contentType === 'image/png') return content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === 'image/jpeg') return content.length >= 4 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  if (contentType === 'application/pdf') return content.subarray(0, 5).toString('ascii') === '%PDF-';
  if (contentType === 'video/mp4') return content.length >= 12 && content.readUInt32BE(0) >= 8 && content.subarray(4, 8).toString('ascii') === 'ftyp';
  if (contentType === 'audio/mpeg') return content.subarray(0, 3).toString('ascii') === 'ID3' ||
    (content.length >= 4 && content[0] === 0xff && (content[1]! & 0xe0) === 0xe0 && (content[1]! & 0x06) !== 0);
  if (contentType === 'text/vtt') return content.subarray(0, 6).toString('ascii') === 'WEBVTT';
  return false;
}
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const missing = () => new RepositoryError('NOT_FOUND', 'Private object not found');

/** Test-only isolated backend. Never select this for hosted production. */
export class IsolatedObjectStore implements PrivateObjectStore {
  constructor(private readonly root: string) {
    if (process.env.NODE_ENV !== 'test') throw new Error('Isolated object storage is test-only');
  }
  private file(key: string): string { return path.join(this.root, keySchema.parse(key)); }
  async put(key: string, content: Buffer): Promise<void> {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const handle = await open(file, 'wx', 0o600);
    try { await handle.writeFile(content); } finally { await handle.close(); }
  }
  async putFile(key: string, source: string): Promise<void> {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await copyFile(source, file);
  }
  async get(key: string): Promise<Buffer> { return readFile(this.file(key)); }
  async getRange(key: string, start: number, end: number): Promise<Buffer> {
    const file = await open(this.file(key), 'r');
    try {
      const result = Buffer.alloc(end - start + 1);
      const { bytesRead } = await file.read(result, 0, result.length, start);
      if (bytesRead !== result.length) throw new Error('Short private object range');
      return result;
    } finally { await file.close(); }
  }
  async delete(key: string): Promise<void> { await rm(this.file(key), { force: true }); }
}

export class S3PrivateObjectStore implements PrivateObjectStore {
  private readonly client: S3Client;
  constructor(private readonly bucket: string, options: PrivateS3Options) {
    if (!/^[a-z0-9][a-z0-9.-]{2,62}$/.test(bucket) || !options.region) throw new Error('Private S3 configuration incomplete');
    if (options.auth === 'aws-profile' && (options.endpoint || !options.profile)) throw new Error('Private AWS profile requires native S3 and a named profile');
    if (options.auth !== 'aws-profile' && (!options.accessKeyId || !options.secretAccessKey)) throw new Error('Private S3 configuration incomplete');
    if (options.endpoint) {
      const endpoint = new URL(options.endpoint);
      if ((endpoint.protocol !== 'https:' && !(options.allowLocalHttp && process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1'].includes(endpoint.hostname) && endpoint.protocol === 'http:' && endpoint.pathname === '/')) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Private S3 endpoint must be HTTPS');
    }
    this.client = new S3Client({ region: options.region, ...(options.endpoint ? { endpoint: options.endpoint } : {}), forcePathStyle: Boolean(options.endpoint),
      credentials: options.auth === 'aws-profile' ? fromIni({ profile: options.profile }) :
        { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey } });
  }
  async put(key: string, content: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: keySchema.parse(key), Body: content,
      ContentType: contentType, ServerSideEncryption: 'AES256', IfNoneMatch: '*' }));
  }
  async putFile(key: string, file: string, bytes: number, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: keySchema.parse(key),
      Body: createReadStream(file), ContentLength: bytes, ContentType: contentType,
      ServerSideEncryption: 'AES256', IfNoneMatch: '*' }));
  }
  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: keySchema.parse(key) }));
    if (!result.Body) throw new Error('Private object body missing');
    return Buffer.from(await result.Body.transformToByteArray());
  }
  async getRange(key: string, start: number, end: number): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket,
      Key: keySchema.parse(key), Range: `bytes=${start}-${end}` }));
    if (!result.Body) throw new Error('Private object range missing');
    const bytes = Buffer.from(await result.Body.transformToByteArray());
    if (bytes.length !== end - start + 1) throw new Error('Short private object range');
    return bytes;
  }
  async delete(key: string): Promise<void> { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: keySchema.parse(key) })); }
}

export type PrivateS3Options = { region: string; endpoint?: string; allowLocalHttp?: boolean } & (
  { auth?: 'static'; accessKeyId: string; secretAccessKey: string } |
  { auth: 'aws-profile'; profile: string }
);

export function privateS3OptionsFromEnv(env: NodeJS.ProcessEnv): PrivateS3Options {
  const region = env.FIRELAUNCH_OBJECT_REGION ?? '';
  const endpoint = env.FIRELAUNCH_OBJECT_ENDPOINT;
  const auth = env.FIRELAUNCH_OBJECT_AUTH;
  if (auth === 'aws-profile') {
    if (endpoint || !env.AWS_PROFILE) throw new Error('Private AWS profile requires native S3 and a named profile');
    return { region, auth, profile: env.AWS_PROFILE };
  }
  if (auth && auth !== 'static') throw new Error('Unsupported private object authentication');
  return { region, ...(endpoint ? { endpoint, allowLocalHttp: localHostedHttp(new URL(endpoint), env) } : {}),
    accessKeyId: env.FIRELAUNCH_OBJECT_ACCESS_KEY_ID ?? '', secretAccessKey: env.FIRELAUNCH_OBJECT_SECRET_ACCESS_KEY ?? '' };
}

export function privateObjectStoreFromEnv(env: NodeJS.ProcessEnv): PrivateObjectStore {
  if (env.FIRELAUNCH_OBJECT_STORE !== 's3') throw new Error('Hosted private S3 object storage is required');
  return new S3PrivateObjectStore(env.FIRELAUNCH_OBJECT_BUCKET ?? '', privateS3OptionsFromEnv(env));
}

export type PrivateObjectMetadata = Readonly<{
  id: string; projectId: string; kind: 'media' | 'evidence'; contentType: string;
  byteSize: number; sha256: string; createdAt: string;
}>;

type ObjectRow = { id: string; project_id: string; kind: 'media' | 'evidence'; object_key: string;
  content_type: string; byte_size: number; sha256: string; created_at: Date };
const publicMetadata = (row: ObjectRow): PrivateObjectMetadata => ({ id: row.id, projectId: row.project_id,
  kind: row.kind, contentType: row.content_type, byteSize: row.byte_size, sha256: row.sha256, createdAt: row.created_at.toISOString() });

export class PrivateObjectService {
  constructor(private readonly repository: HostedProjectRepository, private readonly store: PrivateObjectStore,
    private readonly now: () => number = Date.now) {}
  private get pool(): Pool { return this.repository.pool; }

  async put(principal: AuthenticatedPrincipal, projectId: string, kind: 'media' | 'evidence', contentType: string,
    content: Buffer | { file: string; bytes: number; sha256: string; head: Buffer }, privateAudio = false): Promise<PrivateObjectMetadata> {
    await this.repository.read(principal, projectId);
    const bytes = Buffer.isBuffer(content) ? content.length : content.bytes;
    const head = Buffer.isBuffer(content) ? content : content.head;
    const sha256 = Buffer.isBuffer(content) ? digest(content) : content.sha256;
    if ((kind !== 'media' && kind !== 'evidence') || !allowedTypes[kind].includes(contentType as never) ||
      bytes < 1 || bytes > (privateAudio ? MAX_PRIVATE_AUDIO_BYTES : maximumBytes) ||
      (privateAudio && (kind !== 'media' || contentType !== 'audio/mpeg' || Buffer.isBuffer(content))) ||
      (!privateAudio && !Buffer.isBuffer(content)) || !/^[a-f0-9]{64}$/.test(sha256) || !matchesContentType(contentType, head))
      throw new RepositoryError('INVALID_INPUT', 'Unsupported private object type or size');
    const id = `${kind === 'media' ? 'ma' : 'ev'}_${randomUUID().replaceAll('-', '')}`;
    const key = `private/${randomBytes(32).toString('hex')}`;
    try {
      if (Buffer.isBuffer(content)) await this.store.put(key, content, contentType);
      else await this.store.putFile(key, content.file, bytes, contentType);
    }
    catch {
      try { await this.store.delete(key); } catch { await this.queueOrphan(key); }
      await audit(this.pool, 'storage_failed', 'failure', principal.accountId);
      throw new RepositoryError('STORAGE_ERROR', 'Private object write failed');
    }
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      // Serialize uploads per account so parallel requests cannot evade the quota.
      const account = await client.query(`SELECT 1 FROM creator_accounts a JOIN provider_identities i ON i.creator_account_id = a.id
        WHERE a.id = $1 AND i.issuer = $2 AND i.subject = $3 FOR UPDATE OF a`,
      [principal.accountId, principal.issuer, principal.subject]);
      if (!account.rowCount) throw missing();
      const usage = await client.query<{ object_count: string; total_bytes: string }>(`SELECT count(*)::text AS object_count,
        COALESCE(sum(byte_size), 0)::text AS total_bytes FROM private_objects WHERE creator_account_id = $1`, [principal.accountId]);
      if (Number(usage.rows[0]!.object_count) >= maximumAccountObjects || Number(usage.rows[0]!.total_bytes) + bytes > maximumAccountBytes)
        throw new RepositoryError('INVALID_INPUT', 'Private storage quota exceeded');
      const result = await client.query<ObjectRow>(`INSERT INTO private_objects
        (id, creator_account_id, project_id, kind, object_key, content_type, byte_size, sha256)
        SELECT $1, o.creator_account_id, o.project_id, $3, $4, $5, $6, $7
        FROM channel_ownerships o JOIN provider_identities i ON i.creator_account_id = o.creator_account_id
        WHERE o.project_id = $2 AND o.creator_account_id = $8 AND i.issuer = $9 AND i.subject = $10
        RETURNING *`, [id, projectId, kind, key, contentType, bytes, sha256, principal.accountId, principal.issuer, principal.subject]);
      if (!result.rows[0]) throw missing();
      await client.query('COMMIT');
      return publicMetadata(result.rows[0]);
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => undefined);
      try { await this.store.delete(key); } catch { await this.queueOrphan(key); }
      if (error instanceof RepositoryError && error.code === 'INVALID_INPUT') throw error;
      await audit(this.pool, 'storage_failed', 'failure', principal.accountId);
      throw new RepositoryError('STORAGE_ERROR', 'Private object metadata write failed');
    } finally { client?.release(); }
  }

  private async owned(principal: AuthenticatedPrincipal, projectId: string, objectId: string): Promise<ObjectRow> {
    if (!objectIdSchema.safeParse(objectId).success) throw missing();
    await this.repository.read(principal, projectId);
    const result = await this.pool.query<ObjectRow>(`SELECT p.* FROM private_objects p
      JOIN provider_identities i ON i.creator_account_id = p.creator_account_id
      WHERE p.id = $1 AND p.project_id = $2 AND p.creator_account_id = $3 AND i.issuer = $4 AND i.subject = $5`,
      [objectId, projectId, principal.accountId, principal.issuer, principal.subject]);
    if (!result.rows[0]) throw missing();
    return result.rows[0];
  }

  async metadata(principal: AuthenticatedPrincipal, projectId: string, objectId: string): Promise<PrivateObjectMetadata> {
    return publicMetadata(await this.owned(principal, projectId, objectId));
  }

  async issueDownload(principal: AuthenticatedPrincipal, projectId: string, objectId: string): Promise<{ capability: string; expiresAt: string }> {
    await this.owned(principal, projectId, objectId);
    const capability = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now() + 60_000).toISOString();
    const result = await this.pool.query(`INSERT INTO private_object_capabilities(token_hash, object_id, creator_account_id, purpose, expires_at)
      SELECT $1, p.id, p.creator_account_id, 'download', $4 FROM private_objects p
      JOIN provider_identities i ON i.creator_account_id = p.creator_account_id
      WHERE p.id = $2 AND p.project_id = $3 AND p.creator_account_id = $5 AND i.issuer = $6 AND i.subject = $7`,
      [digest(capability), objectId, projectId, expiresAt, principal.accountId, principal.issuer, principal.subject]);
    if (!result.rowCount) throw missing();
    return { capability, expiresAt };
  }

  async download(principal: AuthenticatedPrincipal, projectId: string, objectId: string, capability: string): Promise<{ metadata: PrivateObjectMetadata; content: Buffer }> {
    const row = await this.owned(principal, projectId, objectId);
    if (row.content_type === 'audio/mpeg' && row.byte_size > maximumBytes)
      throw new RepositoryError('INVALID_INPUT', 'Large private audio uses owner-only range playback');
    if (!/^[a-zA-Z0-9_-]{43}$/.test(capability)) throw missing();
    const result = await this.pool.query(`SELECT 1 FROM private_object_capabilities WHERE token_hash = $1 AND object_id = $2
      AND creator_account_id = $3 AND purpose = 'download' AND revoked_at IS NULL AND expires_at > $4`,
      [digest(capability), objectId, principal.accountId, new Date(this.now()).toISOString()]);
    if (!result.rowCount) throw missing();
    try { return { metadata: publicMetadata(row), content: await this.store.get(row.object_key) }; }
    catch { await audit(this.pool, 'storage_failed', 'failure', principal.accountId); throw new RepositoryError('STORAGE_ERROR', 'Private object read failed'); }
  }

  async readAudioRange(principal: AuthenticatedPrincipal, projectId: string, objectId: string, start: number, requestedEnd?: number): Promise<{
    metadata: PrivateObjectMetadata; start: number; end: number; content: Buffer
  }> {
    const row = await this.owned(principal, projectId, objectId);
    if (row.kind !== 'media' || row.content_type !== 'audio/mpeg' || !Number.isSafeInteger(start) || start < 0 || start >= row.byte_size)
      throw missing();
    const attached = await this.pool.query(`SELECT 1 FROM catalog_media_assets a
      WHERE a.project_id = $1 AND a.creator_account_id = $2 AND a.record->>'kind' = 'audio'
        AND a.record->'location'->>'type' = 'private_object'
        AND a.record->'location'->>'objectId' = $3
        AND COALESCE(a.record->'tvPlaybackRights'->>'status', 'unknown') <> 'revoked'`,
    [projectId, principal.accountId, objectId]);
    if (!attached.rowCount) throw missing();
    if (requestedEnd !== undefined && (!Number.isSafeInteger(requestedEnd) || requestedEnd < start)) throw missing();
    const end = Math.min(row.byte_size - 1, start + 2_000_000 - 1, requestedEnd ?? Number.MAX_SAFE_INTEGER);
    try { return { metadata: publicMetadata(row), start, end, content: await this.store.getRange(row.object_key, start, end) }; }
    catch { await audit(this.pool, 'storage_failed', 'failure', principal.accountId); throw new RepositoryError('STORAGE_ERROR', 'Private audio read failed'); }
  }

  async revoke(principal: AuthenticatedPrincipal, projectId: string, objectId: string): Promise<void> {
    await this.owned(principal, projectId, objectId);
    await this.pool.query(`UPDATE private_object_capabilities SET revoked_at = now() WHERE object_id = $1 AND creator_account_id = $2`, [objectId, principal.accountId]);
  }

  async delete(principal: AuthenticatedPrincipal, projectId: string, objectId: string): Promise<void> {
    const row = await this.owned(principal, projectId, objectId);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query('SELECT 1 FROM private_objects WHERE id = $1 AND creator_account_id = $2 FOR UPDATE', [objectId, principal.accountId]);
      if (!locked.rowCount) throw missing();
      const subtitle = await client.query('SELECT 1 FROM video_subtitle_tracks WHERE object_id = $1 AND project_id = $2 AND creator_account_id = $3', [objectId, projectId, principal.accountId]);
      if (subtitle.rowCount) throw new RepositoryError('CONFLICT', 'Subtitle history retains this private object');
      await client.query('INSERT INTO private_object_garbage(object_key) VALUES ($1) ON CONFLICT DO NOTHING', [row.object_key]);
      await client.query('DELETE FROM private_objects WHERE id = $1 AND creator_account_id = $2', [objectId, principal.accountId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof RepositoryError) throw error;
      await audit(this.pool, 'storage_failed', 'failure', principal.accountId);
      throw new RepositoryError('STORAGE_ERROR', 'Private object delete failed');
    } finally { client.release(); }
    await cleanOrphans(this.pool, this.store);
  }

  private async queueOrphan(key: string): Promise<void> {
    await this.pool.query('INSERT INTO private_object_garbage(object_key) VALUES ($1) ON CONFLICT DO NOTHING', [key]).catch(() => undefined);
  }
}
