import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PrivateObjectStore } from './private-objects.js';
import { catalogItemSchema, catalogSourceSchema, mediaAssetSchema, mediaUseEligible } from '@firelaunch/contracts';
import type { S3MediaStorage } from './media-storage.js';
import { RepositoryError } from './repository.js';

const scopedId = /^(?:cr|ch|dep|rel|ma)_[a-f0-9]{32}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const maxImageBytes = 1_000_000;
const hash = (body: Buffer | string) => createHash('sha256').update(body).digest('hex');
const unavailable = () => new RepositoryError('NOT_FOUND', 'Artwork unavailable');

export type PreparedArtwork = Readonly<{ assetId: string; url: string; body: Buffer; contentType: 'image/png' | 'image/jpeg'; sha256: string;
  owner: string; projectId: string; releaseId: string }>;

/** Immutable, release-scoped copies of creator-owned private thumbnails. */
export class ManagedArtworkDelivery {
  private readonly origin: string;
  constructor(private readonly pool: Pool, private readonly store: PrivateObjectStore, origin: string,
    private readonly mediaStorage?: S3MediaStorage) {
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

  deliveryUrl(owner: string, projectId: string, releaseId: string, assetId: string, sha256: string,
    contentType: 'image/png' | 'image/jpeg'): string {
    if (!this.mediaStorage) throw unavailable();
    return this.mediaStorage.publishedArtworkUrl({ creatorAccountId: owner, projectId, mediaAssetId: assetId },
      releaseId, sha256, contentType);
  }

  private verify(body: Buffer, contentType: 'image/png' | 'image/jpeg', sha256: string): void {
    if (body.length < 12 || body.length > maxImageBytes || hash(body) !== sha256 ||
      (contentType === 'image/png' && !(body.length >= 45 &&
        body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        body.readUInt32BE(8) === 13 && body.subarray(12, 16).toString('ascii') === 'IHDR' &&
        body.readUInt32BE(16) > 0 && body.readUInt32BE(20) > 0 &&
        body.subarray(-12, -8).equals(Buffer.alloc(4)) && body.subarray(-8, -4).toString('ascii') === 'IEND')) ||
      (contentType === 'image/jpeg' && !(body.length >= 12 && body[0] === 0xff && body[1] === 0xd8 &&
        body[2] === 0xff && body.subarray(-2).equals(Buffer.from([0xff, 0xd9]))))) throw unavailable();
  }

  async prepare(owner: string, projectId: string, itemId: string, objectId: string, deploymentId: string, releaseId: string,
    assetId: string, client?: PoolClient): Promise<PreparedArtwork> {
    if (!this.mediaStorage || !/^ci_[a-f0-9]{32}$/.test(itemId) ||
      ![owner, projectId, objectId, deploymentId, releaseId, assetId].every(value => scopedId.test(value))) throw unavailable();
    const result = await (client ?? this.pool).query<{ object_key: string; content_type: string; byte_size: number; sha256: string;
      asset_record: unknown; item_record: unknown; source_record: unknown; revoked_at: Date | null }>(`
      SELECT p.object_key, p.content_type, p.byte_size, p.sha256, a.record AS asset_record,
        i.record AS item_record, s.record AS source_record, l.revoked_at
      FROM private_objects p
      JOIN catalog_media_assets a ON a.id = $4 AND a.item_id = $5 AND a.project_id = p.project_id
        AND a.creator_account_id = p.creator_account_id
      JOIN catalog_items i ON i.id = a.item_id AND i.project_id = a.project_id AND i.creator_account_id = a.creator_account_id
      JOIN catalog_item_approvals ca ON ca.item_id = i.id AND ca.project_id = i.project_id
        AND ca.creator_account_id = i.creator_account_id
      JOIN catalog_sources s ON s.id = i.record->'sourceRecord'->>'sourceId' AND s.project_id = i.project_id
        AND s.creator_account_id = i.creator_account_id
      LEFT JOIN media_asset_lifecycle l ON l.asset_id = a.id AND l.project_id = a.project_id
        AND l.creator_account_id = a.creator_account_id
      WHERE p.id = $1 AND p.project_id = $2 AND p.creator_account_id = $3 AND p.kind = 'media'
      FOR SHARE OF p, a, i, s, ca`,
    [objectId, projectId, owner, assetId, itemId]);
    const row = result.rows[0];
    const asset = mediaAssetSchema.safeParse(row?.asset_record);
    const item = catalogItemSchema.safeParse(row?.item_record);
    const source = catalogSourceSchema.safeParse(row?.source_record);
    if (!row || row.revoked_at || !asset.success || !item.success || !source.success ||
      asset.data.id !== assetId || asset.data.creatorAccountId !== owner || asset.data.projectId !== projectId ||
      asset.data.catalogItemId !== itemId || asset.data.kind !== 'artwork' ||
      asset.data.location.type !== 'private_object' || asset.data.location.objectId !== objectId ||
      !asset.data.deliveryEligible || !mediaUseEligible(asset.data, 'television_display') ||
      item.data.id !== itemId || item.data.creatorAccountId !== owner || item.data.projectId !== projectId ||
      !item.data.mediaAssetIds.includes(assetId) || item.data.sourceRecord.sourceId !== source.data.id ||
      source.data.creatorAccountId !== owner || source.data.projectId !== projectId || source.data.state === 'discovered' ||
      ['unknown', 'revoked'].includes(source.data.permission.retrieval) ||
      ['unknown', 'revoked'].includes(source.data.permission.tvDisplay) ||
      !/^private\/[a-f0-9]{64}$/.test(row.object_key) ||
      !['image/png', 'image/jpeg'].includes(row.content_type) || !digestPattern.test(row.sha256) ||
      row.byte_size < 1 || row.byte_size > maxImageBytes) throw unavailable();
    let body: Buffer;
    try { body = await this.store.get(row.object_key); } catch { throw unavailable(); }
    const contentType = row.content_type as 'image/png' | 'image/jpeg';
    this.verify(body, contentType, row.sha256);
    if (body.length !== row.byte_size) throw unavailable();
    const scope = { creatorAccountId: owner, projectId, mediaAssetId: assetId };
    return { assetId, owner, projectId, releaseId,
      url: this.mediaStorage.publishedArtworkUrl(scope, releaseId, row.sha256, contentType),
      body, contentType, sha256: row.sha256 };
  }

  async publish(artwork: PreparedArtwork): Promise<void> {
    if (!this.mediaStorage) throw unavailable();
    const url = await this.mediaStorage.publishVerifiedArtwork({ creatorAccountId: artwork.owner,
      projectId: artwork.projectId, mediaAssetId: artwork.assetId }, artwork.releaseId,
    artwork.body, artwork.sha256, artwork.contentType);
    if (url !== artwork.url) throw unavailable();
  }

  async read(deploymentId: string, releaseId: string, assetId: string, sha256: string,
    contentType: 'image/png' | 'image/jpeg'): Promise<Buffer> {
    let body: Buffer;
    try { body = await this.store.get(this.key(deploymentId, releaseId, assetId, sha256)); } catch { throw unavailable(); }
    this.verify(body, contentType, sha256);
    return body;
  }
}
