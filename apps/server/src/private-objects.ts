import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import { RepositoryError } from './repository.js';

export interface PrivateObjectStore {
  put(key: string, content: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const keySchema = z.string().regex(/^private\/[a-f0-9]{64}$/);
const objectIdSchema = z.string().regex(/^(ma|ev)_[a-f0-9]{32}$/);
const allowedTypes = {
  media: ['image/png', 'image/jpeg', 'video/mp4', 'audio/mpeg'],
  evidence: ['image/png', 'image/jpeg', 'application/pdf']
} as const;
const maximumBytes = 1_000_000;
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
  async get(key: string): Promise<Buffer> { return readFile(this.file(key)); }
  async delete(key: string): Promise<void> { await rm(this.file(key), { force: true }); }
}

export class S3PrivateObjectStore implements PrivateObjectStore {
  private readonly client: S3Client;
  constructor(private readonly bucket: string, options: { region: string; endpoint?: string; accessKeyId: string; secretAccessKey: string }) {
    if (!/^[a-z0-9][a-z0-9.-]{2,62}$/.test(bucket) || !options.region || !options.accessKeyId || !options.secretAccessKey) throw new Error('Private S3 configuration incomplete');
    if (options.endpoint) {
      const endpoint = new URL(options.endpoint);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Private S3 endpoint must be HTTPS');
    }
    this.client = new S3Client({ region: options.region, ...(options.endpoint ? { endpoint: options.endpoint } : {}), forcePathStyle: Boolean(options.endpoint),
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey } });
  }
  async put(key: string, content: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: keySchema.parse(key), Body: content,
      ContentType: contentType, ServerSideEncryption: 'AES256' }));
  }
  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: keySchema.parse(key) }));
    if (!result.Body) throw new Error('Private object body missing');
    return Buffer.from(await result.Body.transformToByteArray());
  }
  async delete(key: string): Promise<void> { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: keySchema.parse(key) })); }
}

export function privateObjectStoreFromEnv(env: NodeJS.ProcessEnv): PrivateObjectStore {
  if (env.FIRELAUNCH_OBJECT_STORE !== 's3') throw new Error('Hosted private S3 object storage is required');
  return new S3PrivateObjectStore(env.FIRELAUNCH_OBJECT_BUCKET ?? '', {
    region: env.FIRELAUNCH_OBJECT_REGION ?? '', ...(env.FIRELAUNCH_OBJECT_ENDPOINT ? { endpoint: env.FIRELAUNCH_OBJECT_ENDPOINT } : {}),
    accessKeyId: env.FIRELAUNCH_OBJECT_ACCESS_KEY_ID ?? '', secretAccessKey: env.FIRELAUNCH_OBJECT_SECRET_ACCESS_KEY ?? ''
  });
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

  async put(principal: AuthenticatedPrincipal, projectId: string, kind: 'media' | 'evidence', contentType: string, content: Buffer): Promise<PrivateObjectMetadata> {
    await this.repository.read(principal, projectId);
    if ((kind !== 'media' && kind !== 'evidence') || !allowedTypes[kind].includes(contentType as never) || !Buffer.isBuffer(content) || content.length < 1 || content.length > maximumBytes)
      throw new RepositoryError('INVALID_INPUT', 'Unsupported private object type or size');
    const id = `${kind === 'media' ? 'ma' : 'ev'}_${randomUUID().replaceAll('-', '')}`;
    const key = `private/${randomBytes(32).toString('hex')}`;
    try { await this.store.put(key, content, contentType); }
    catch {
      try { await this.store.delete(key); } catch { /* P6 reconciliation handles an unavailable object store. */ }
      throw new RepositoryError('STORAGE_ERROR', 'Private object write failed');
    }
    try {
      const result = await this.pool.query<ObjectRow>(`INSERT INTO private_objects
        (id, creator_account_id, project_id, kind, object_key, content_type, byte_size, sha256)
        SELECT $1, o.creator_account_id, o.project_id, $3, $4, $5, $6, $7
        FROM channel_ownerships o JOIN provider_identities i ON i.creator_account_id = o.creator_account_id
        WHERE o.project_id = $2 AND o.creator_account_id = $8 AND i.issuer = $9 AND i.subject = $10
        RETURNING *`, [id, projectId, kind, key, contentType, content.length, digest(content), principal.accountId, principal.issuer, principal.subject]);
      if (!result.rows[0]) throw missing();
      return publicMetadata(result.rows[0]);
    } catch {
      try { await this.store.delete(key); } catch { /* P6 operational reconciliation owns persistent cleanup. */ }
      throw new RepositoryError('STORAGE_ERROR', 'Private object metadata write failed');
    }
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
    if (!/^[a-zA-Z0-9_-]{43}$/.test(capability)) throw missing();
    const result = await this.pool.query(`SELECT 1 FROM private_object_capabilities WHERE token_hash = $1 AND object_id = $2
      AND creator_account_id = $3 AND purpose = 'download' AND revoked_at IS NULL AND expires_at > $4`,
      [digest(capability), objectId, principal.accountId, new Date(this.now()).toISOString()]);
    if (!result.rowCount) throw missing();
    try { return { metadata: publicMetadata(row), content: await this.store.get(row.object_key) }; }
    catch { throw new RepositoryError('STORAGE_ERROR', 'Private object read failed'); }
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
      await this.store.delete(row.object_key);
      await client.query('DELETE FROM private_objects WHERE id = $1 AND creator_account_id = $2', [objectId, principal.accountId]);
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK');
      throw new RepositoryError('STORAGE_ERROR', 'Private object delete failed');
    } finally { client.release(); }
  }
}
