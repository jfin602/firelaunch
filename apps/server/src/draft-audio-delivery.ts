import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { catalogItemSchema, catalogSourceSchema, channelSpecSchema, mediaAssetSchema,
  sourceUseEligible, type CatalogItem, type CatalogSource, type MediaAsset } from '@vegalaunch/contracts';
import type { PrivateObjectStore } from './private-objects.js';
import { RepositoryError } from './repository.js';

const ids = { project: /^ch_[a-f0-9]{32}$/, item: /^ci_[a-f0-9]{32}$/, asset: /^ma_[a-f0-9]{32}$/ };
const unavailable = () => new RepositoryError('NOT_FOUND', 'Channel audio unavailable');
const contentId = (id: string) => `item_${createHash('sha256').update('catalog-content-v1\0').update(id).digest('hex').slice(0, 32)}`;
type Kind = 'audio' | 'cover';
type ObjectRow = { object_key: string; content_type: string; byte_size: number; sha256: string; asset_record: unknown;
  item_record: unknown; source_record: unknown; spec: unknown; revoked_at: Date | null };

/** Draft delivery is available only while the exact asset is in the current channel. */
export class DraftAudioDelivery {
  readonly origin: string;
  constructor(private readonly pool: Pool, private readonly store: PrivateObjectStore, origin: string) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash)
      throw new Error('Draft audio requires a trusted HTTPS Studio origin');
    this.origin = origin;
  }

  url(projectId: string, itemId: string, assetId: string, kind: Kind): string {
    if (!ids.project.test(projectId) || !ids.item.test(itemId) || !ids.asset.test(assetId)) throw unavailable();
    return `${this.origin}/api/draft-audio/${projectId}/${itemId}/${assetId}/${kind}`;
  }

  async candidate(owner: string, projectId: string, item: CatalogItem, source: CatalogSource,
    asset: MediaAsset, kind: Kind): Promise<string | undefined> {
    if (item.kind !== 'audio' || asset.kind !== (kind === 'audio' ? 'audio' : 'artwork') ||
      asset.location.type !== 'private_object' || asset.catalogItemId !== item.id ||
      !item.mediaAssetIds.includes(asset.id) || !sourceUseEligible(source, asset,
        kind === 'audio' ? 'television_playback' : 'television_display')) return undefined;
    const row = await this.pool.query<{ content_type: string; byte_size: number; revoked_at: Date | null }>(`
      SELECT p.content_type, p.byte_size, l.revoked_at FROM private_objects p
      LEFT JOIN media_asset_lifecycle l ON l.asset_id = $3 AND l.project_id = p.project_id
        AND l.creator_account_id = p.creator_account_id
      WHERE p.id = $4 AND p.project_id = $2 AND p.creator_account_id = $1 AND p.kind = 'media'`,
    [owner, projectId, asset.id, asset.location.objectId]);
    const object = row.rows[0];
    if (!object || object.revoked_at || object.byte_size < 1 ||
      (kind === 'audio' ? object.content_type !== 'audio/mpeg' || object.byte_size > 320_000_000 :
        !['image/png', 'image/jpeg'].includes(object.content_type) || object.byte_size > 1_000_000)) return undefined;
    return this.url(projectId, item.id, asset.id, kind);
  }

  async read(projectId: string, itemId: string, assetId: string, kind: Kind, start = 0, requestedEnd?: number): Promise<{
    content: Buffer; contentType: string; start: number; end: number; size: number
  }> {
    const expected = this.url(projectId, itemId, assetId, kind);
    const result = await this.pool.query<ObjectRow>(`
      SELECT p.object_key, p.content_type, p.byte_size, p.sha256, a.record AS asset_record,
        i.record AS item_record, s.record AS source_record, c.spec, l.revoked_at
      FROM channel_projects c
      JOIN catalog_items i ON i.id = $2 AND i.project_id = c.id AND i.creator_account_id = c.creator_account_id
      JOIN catalog_item_approvals ca ON ca.item_id = i.id AND ca.project_id = i.project_id
        AND ca.creator_account_id = i.creator_account_id
      JOIN catalog_sources s ON s.id = i.source_id AND s.project_id = i.project_id
        AND s.creator_account_id = i.creator_account_id
      JOIN catalog_media_assets a ON a.id = $3 AND a.item_id = i.id AND a.project_id = i.project_id
        AND a.creator_account_id = i.creator_account_id
      JOIN private_objects p ON p.id = a.record->'location'->>'objectId' AND p.project_id = a.project_id
        AND p.creator_account_id = a.creator_account_id AND p.kind = 'media'
      LEFT JOIN media_asset_lifecycle l ON l.asset_id = a.id AND l.project_id = a.project_id
        AND l.creator_account_id = a.creator_account_id
      WHERE c.id = $1`, [projectId, itemId, assetId]);
    const row = result.rows[0];
    const item = catalogItemSchema.safeParse(row?.item_record);
    const source = catalogSourceSchema.safeParse(row?.source_record);
    const asset = mediaAssetSchema.safeParse(row?.asset_record);
    const spec = channelSpecSchema.safeParse(row?.spec);
    if (!row || row.revoked_at || !item.success || !source.success || !asset.success || !spec.success ||
      item.data.kind !== 'audio' || !item.data.mediaAssetIds.includes(assetId) ||
      asset.data.location.type !== 'private_object' || asset.data.id !== assetId ||
      asset.data.kind !== (kind === 'audio' ? 'audio' : 'artwork') ||
      asset.data.catalogItemId !== itemId || source.data.id !== item.data.sourceRecord.sourceId ||
      !sourceUseEligible(source.data, asset.data, kind === 'audio' ? 'television_playback' : 'television_display') ||
      !/^private\/[a-f0-9]{64}$/.test(row.object_key) || row.byte_size < 1 ||
      (kind === 'audio' ? row.content_type !== 'audio/mpeg' || row.byte_size > 320_000_000 :
        !['image/png', 'image/jpeg'].includes(row.content_type) || row.byte_size > 1_000_000)) throw unavailable();
    const included = spec.data.content.find(value => value.id === contentId(itemId) && value.presentation === 'audio');
    if (!included || (kind === 'audio' ? included.mediaUrl !== expected : included.artwork !== expected)) throw unavailable();
    if (!Number.isSafeInteger(start) || start < 0 || start >= row.byte_size ||
      (requestedEnd !== undefined && (!Number.isSafeInteger(requestedEnd) || requestedEnd < start))) throw unavailable();
    const end = Math.min(row.byte_size - 1, start + 2_000_000 - 1, requestedEnd ?? Number.MAX_SAFE_INTEGER);
    try {
      const content = kind === 'audio' ? await this.store.getRange(row.object_key, start, end) : await this.store.get(row.object_key);
      if (content.length !== (kind === 'audio' ? end - start + 1 : row.byte_size)) throw unavailable();
      if (kind === 'cover' && (createHash('sha256').update(content).digest('hex') !== row.sha256 ||
        (row.content_type === 'image/png' ? !(content.length >= 45 &&
          content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
          content.subarray(-8, -4).toString('ascii') === 'IEND') :
          !(content.length >= 12 && content[0] === 0xff && content[1] === 0xd8 &&
            content.subarray(-2).equals(Buffer.from([0xff, 0xd9])))))) throw unavailable();
      return { content, contentType: row.content_type, start, end, size: row.byte_size };
    } catch { throw unavailable(); }
  }
}
