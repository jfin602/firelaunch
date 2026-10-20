import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { PrivateObjectStore } from './private-objects.js';
import { RepositoryError } from './repository.js';

const scopedId = /^(?:cr|ch|dep|rel|ma)_[a-f0-9]{32}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const maxImageBytes = 1_000_000;
const hash = (body: Buffer | string) => createHash('sha256').update(body).digest('hex');
const unavailable = () => new RepositoryError('NOT_FOUND', 'Artwork unavailable');

export type PreparedArtwork = Readonly<{ assetId: string; key: string; url: string; body: Buffer; contentType: 'image/png' | 'image/jpeg'; sha256: string }>;

/** Immutable, release-scoped copies of creator-owned private thumbnails. */
export class ManagedArtworkDelivery {
  private readonly origin: string;
  constructor(private readonly pool: Pool, private readonly store: PrivateObjectStore, origin: string) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash)
      throw new Error('Managed artwork requires a trusted HTTPS Studio origin');
    this.origin = origin;
  }

  private key(deploymentId: string, releaseId: string, assetId: string, sha256: string): string {
    if (![deploymentId, releaseId, assetId].every(value => scopedId.test(value)) || !digestPattern.test(sha256)) throw unavailable();
    return `private/${hash(`published-artwork-v1\0${deploymentId}\0${releaseId}\0${assetId}\0${sha256}`)}`;
  }

  url(deploymentId: string, releaseId: string, assetId: string, sha256: string, contentType: 'image/png' | 'image/jpeg'): string {
    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    this.key(deploymentId, releaseId, assetId, sha256);
    return `${this.origin}/api/public-artwork/${deploymentId}/${releaseId}/${assetId}/${sha256}.${ext}`;
  }

  private verify(body: Buffer, contentType: 'image/png' | 'image/jpeg', sha256: string): void {
    if (body.length < 1 || body.length > maxImageBytes || hash(body) !== sha256 ||
      (contentType === 'image/png' && !body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (contentType === 'image/jpeg' && !(body.length >= 4 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff))) throw unavailable();
  }

  async prepare(owner: string, projectId: string, objectId: string, deploymentId: string, releaseId: string,
    assetId: string): Promise<PreparedArtwork> {
    if (![owner, projectId, objectId, deploymentId, releaseId, assetId].every(value => scopedId.test(value))) throw unavailable();
    const result = await this.pool.query<{ object_key: string; content_type: string; byte_size: number; sha256: string }>(`
      SELECT object_key, content_type, byte_size, sha256 FROM private_objects
      WHERE id = $1 AND project_id = $2 AND creator_account_id = $3 AND kind = 'media'`, [objectId, projectId, owner]);
    const row = result.rows[0];
    if (!row || !['image/png', 'image/jpeg'].includes(row.content_type) || !digestPattern.test(row.sha256) ||
      row.byte_size < 1 || row.byte_size > maxImageBytes) throw unavailable();
    let body: Buffer;
    try { body = await this.store.get(row.object_key); } catch { throw unavailable(); }
    const contentType = row.content_type as 'image/png' | 'image/jpeg';
    this.verify(body, contentType, row.sha256);
    if (body.length !== row.byte_size) throw unavailable();
    return { assetId, key: this.key(deploymentId, releaseId, assetId, row.sha256),
      url: this.url(deploymentId, releaseId, assetId, row.sha256, contentType), body, contentType, sha256: row.sha256 };
  }

  async publish(artwork: PreparedArtwork): Promise<void> {
    try { await this.store.put(artwork.key, artwork.body, artwork.contentType); }
    catch {
      // An interrupted publication may already have written the exact immutable copy.
      let existing: Buffer;
      try { existing = await this.store.get(artwork.key); } catch { throw unavailable(); }
      this.verify(existing, artwork.contentType, artwork.sha256);
    }
  }

  async read(deploymentId: string, releaseId: string, assetId: string, sha256: string,
    contentType: 'image/png' | 'image/jpeg'): Promise<Buffer> {
    let body: Buffer;
    try { body = await this.store.get(this.key(deploymentId, releaseId, assetId, sha256)); } catch { throw unavailable(); }
    this.verify(body, contentType, sha256);
    return body;
  }
}
