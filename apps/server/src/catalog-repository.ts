import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import {
  catalogInventorySchema, catalogSourceSchema, catalogItemSchema, mediaAssetSchema, collectionSchema,
  type CatalogInventory, type CatalogSource, type CatalogItem, type MediaAsset, type Collection
} from '@firelaunch/contracts';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import { RepositoryError } from './repository.js';

export const catalogKinds = ['sources', 'items', 'media-assets', 'collections'] as const;
export type CatalogKind = typeof catalogKinds[number];
type RecordType = CatalogSource | CatalogItem | MediaAsset | Collection;
type Snapshot = CatalogInventory & { revision: number };
const projectId = z.string().regex(/^ch_[a-f0-9]{32}$/);
const revisionSchema = z.number().int().nonnegative();
const identifiers: Record<CatalogKind, string> = { sources: 'src', items: 'ci', 'media-assets': 'ma', collections: 'col' };
const schemas = { sources: catalogSourceSchema, items: catalogItemSchema, 'media-assets': mediaAssetSchema, collections: collectionSchema };
const fields = { sources: 'sources', items: 'items', 'media-assets': 'mediaAssets', collections: 'collections' } as const;

function invalid(message: string): never { throw new RepositoryError('INVALID_INPUT', message); }
function parseRecord(kind: CatalogKind, raw: unknown, owner: string, project: string, id: string): RecordType {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid('Expected catalog record');
  const value = raw as Record<string, unknown>;
  if ('id' in value || 'creatorAccountId' in value || 'projectId' in value) return invalid('Catalog identity is server-owned');
  if (kind === 'media-assets' && (value.location as { type?: unknown } | undefined)?.type === 'upload') return invalid('Private upload linkage is unavailable');
  return schemas[kind].parse({ ...value, id, creatorAccountId: owner, projectId: project }) as RecordType;
}
function externalKey(value: CatalogItem['externalIdentifiers'][number]): string {
  return `${value.provider}:${value.marketplace ?? ''}:${value.kind}:${value.value}`;
}
function databaseError(error: unknown): never {
  if (error instanceof RepositoryError || error instanceof z.ZodError) throw error;
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === '23505') throw new RepositoryError('CONFLICT', 'Catalog identity already exists');
    if (error.code === '23503' || error.code === '23514') throw new RepositoryError('INVALID_INPUT', 'Invalid catalog reference');
  }
  throw new RepositoryError('STORAGE_ERROR', 'Catalog storage operation failed');
}

export class CatalogRepository {
  constructor(private readonly projects: HostedProjectRepository) {}

  private async load(client: PoolClient, owner: string, project: string, revision: number): Promise<Snapshot> {
    const sources = await client.query<{ record: unknown }>('SELECT record FROM catalog_sources WHERE project_id = $1 AND creator_account_id = $2 ORDER BY id', [project, owner]);
    const items = await client.query<{ record: unknown }>('SELECT record FROM catalog_items WHERE project_id = $1 AND creator_account_id = $2 ORDER BY id', [project, owner]);
    const mediaAssets = await client.query<{ record: unknown }>('SELECT record FROM catalog_media_assets WHERE project_id = $1 AND creator_account_id = $2 ORDER BY id', [project, owner]);
    const collections = await client.query<{ record: unknown }>('SELECT record FROM catalog_collections WHERE project_id = $1 AND creator_account_id = $2 ORDER BY id', [project, owner]);
    try {
      return { ...catalogInventorySchema.parse({ schemaVersion: 1, creatorAccountId: owner, projectId: project,
        sources: sources.rows.map(row => row.record), items: items.rows.map(row => row.record),
        mediaAssets: mediaAssets.rows.map(row => row.record), collections: collections.rows.map(row => row.record) }), revision };
    } catch { throw new RepositoryError('STORAGE_ERROR', 'Invalid catalog record'); }
  }

  async read(principal: AuthenticatedPrincipal, rawProjectId: string): Promise<Snapshot> {
    const project = projectId.safeParse(rawProjectId);
    if (!project.success) throw new RepositoryError('NOT_FOUND', 'Project not found');
    await this.projects.read(principal, project.data);
    const client = await this.projects.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const owner = principal.accountId;
      const owned = await client.query('SELECT 1 FROM channel_ownerships WHERE project_id = $1 AND creator_account_id = $2', [project.data, owner]);
      if (!owned.rowCount) throw new RepositoryError('NOT_FOUND', 'Project not found');
      const row = await client.query<{ revision: number }>('SELECT revision FROM catalog_revisions WHERE project_id = $1 AND creator_account_id = $2', [project.data, owner]);
      const snapshot = await this.load(client, owner, project.data, row.rows[0]?.revision ?? 0);
      await client.query('COMMIT');
      return snapshot;
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); return databaseError(error); }
    finally { client.release(); }
  }

  async mutate(principal: AuthenticatedPrincipal, rawProjectId: string, kind: CatalogKind, method: 'POST' | 'PUT' | 'DELETE', expectedRevision: number, raw?: unknown, rawId?: string): Promise<{ revision: number; record?: RecordType; deleted?: true }> {
    const project = projectId.safeParse(rawProjectId);
    if (!project.success) throw new RepositoryError('NOT_FOUND', 'Project not found');
    revisionSchema.parse(expectedRevision);
    if (rawId && !new RegExp(`^${identifiers[kind]}_[a-f0-9]{32}$`).test(rawId)) throw new RepositoryError('NOT_FOUND', 'Catalog record not found');
    await this.projects.read(principal, project.data);
    const client = await this.projects.pool.connect();
    try {
      await client.query('BEGIN');
      const owner = principal.accountId;
      // The owner row is locked before any catalog read. This also serializes project deletion.
      const owned = await client.query('SELECT 1 FROM channel_ownerships WHERE project_id = $1 AND creator_account_id = $2 FOR UPDATE', [project.data, owner]);
      if (!owned.rowCount) throw new RepositoryError('NOT_FOUND', 'Project not found');
      await client.query('INSERT INTO catalog_revisions(project_id, creator_account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [project.data, owner]);
      const row = await client.query<{ revision: number }>('SELECT revision FROM catalog_revisions WHERE project_id = $1 AND creator_account_id = $2 FOR UPDATE', [project.data, owner]);
      const current = row.rows[0]!.revision;
      if (current !== expectedRevision) throw new RepositoryError('CONFLICT', 'Catalog revision changed');
      const snapshot = await this.load(client, owner, project.data, current);
      const list = snapshot[fields[kind]] as RecordType[];
      const index = rawId ? list.findIndex(record => record.id === rawId) : -1;
      if (method !== 'POST' && index < 0) throw new RepositoryError('NOT_FOUND', 'Catalog record not found');
      const id = method === 'POST' ? `${identifiers[kind]}_${randomUUID().replaceAll('-', '')}` : rawId!;
      let record: RecordType | undefined;
      if (method === 'DELETE') {
        list.splice(index, 1);
        if (kind === 'media-assets') {
          for (const item of snapshot.items) item.mediaAssetIds = item.mediaAssetIds.filter(value => value !== id);
        }
      } else {
        record = parseRecord(kind, raw, owner, project.data, id);
        if (kind === 'items' && index >= 0) {
          const old = snapshot.items[index]!;
          const next = record as CatalogItem;
          if (old.sourceRecord.sourceId !== next.sourceRecord.sourceId || externalKey(old.sourceRecord.externalId) !== externalKey(next.sourceRecord.externalId)) invalid('Source identity cannot change');
          if (JSON.stringify(old.mediaAssetIds) !== JSON.stringify(next.mediaAssetIds)) invalid('Media links are server-owned');
        }
        if (kind === 'items' && method === 'POST' && (record as CatalogItem).mediaAssetIds.length) invalid('Media links are server-owned');
        if (kind === 'media-assets') {
          const asset = record as MediaAsset;
          const old = index >= 0 ? snapshot.mediaAssets[index] : undefined;
          if (old && old.catalogItemId !== asset.catalogItemId) invalid('Media item cannot change');
          if (method === 'POST') {
            const item = snapshot.items.find(value => value.id === asset.catalogItemId);
            if (!item) invalid('Catalog item not found');
            item.mediaAssetIds.push(id);
          }
        }
        if (method === 'POST') list.push(record);
        else list[index] = record;
      }
      const { revision: _revision, ...inventory } = snapshot;
      if (!catalogInventorySchema.safeParse(inventory).success) invalid('Invalid catalog references or identity');
      await this.replace(client, owner, project.data, snapshot);
      await client.query('UPDATE catalog_revisions SET revision = revision + 1 WHERE project_id = $1 AND creator_account_id = $2', [project.data, owner]);
      await client.query('COMMIT');
      return { revision: current + 1, ...(record ? { record } : { deleted: true as const }) };
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); return databaseError(error); }
    finally { client.release(); }
  }

  private async replace(client: PoolClient, owner: string, project: string, snapshot: Snapshot): Promise<void> {
    await client.query('DELETE FROM catalog_collection_items WHERE project_id = $1 AND creator_account_id = $2', [project, owner]);
    await client.query('DELETE FROM catalog_collections WHERE project_id = $1 AND creator_account_id = $2', [project, owner]);
    await client.query('DELETE FROM catalog_media_assets WHERE project_id = $1 AND creator_account_id = $2', [project, owner]);
    await client.query('DELETE FROM catalog_item_identifiers WHERE project_id = $1 AND creator_account_id = $2', [project, owner]);
    await client.query('DELETE FROM catalog_items WHERE project_id = $1 AND creator_account_id = $2', [project, owner]);
    await client.query('DELETE FROM catalog_sources WHERE project_id = $1 AND creator_account_id = $2', [project, owner]);
    for (const source of snapshot.sources) await client.query('INSERT INTO catalog_sources(id, project_id, creator_account_id, record) VALUES ($1,$2,$3,$4::jsonb)', [source.id, project, owner, JSON.stringify(source)]);
    for (const item of snapshot.items) {
      await client.query('INSERT INTO catalog_items(id, project_id, creator_account_id, source_id, record) VALUES ($1,$2,$3,$4,$5::jsonb)', [item.id, project, owner, item.sourceRecord.sourceId, JSON.stringify(item)]);
      for (const identifier of item.externalIdentifiers) await client.query('INSERT INTO catalog_item_identifiers(source_id, project_id, creator_account_id, item_id, provider, marketplace, kind, value) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [item.sourceRecord.sourceId, project, owner, item.id, identifier.provider, identifier.marketplace ?? '', identifier.kind, identifier.value]);
    }
    for (const asset of snapshot.mediaAssets) await client.query('INSERT INTO catalog_media_assets(id, project_id, creator_account_id, item_id, record) VALUES ($1,$2,$3,$4,$5::jsonb)', [asset.id, project, owner, asset.catalogItemId, JSON.stringify(asset)]);
    for (const collection of snapshot.collections) {
      await client.query('INSERT INTO catalog_collections(id, project_id, creator_account_id, record) VALUES ($1,$2,$3,$4::jsonb)', [collection.id, project, owner, JSON.stringify(collection)]);
      for (const [position, itemId] of collection.itemIds.entries()) await client.query('INSERT INTO catalog_collection_items(collection_id, project_id, creator_account_id, item_id, position) VALUES ($1,$2,$3,$4,$5)', [collection.id, project, owner, itemId, position]);
    }
  }
}
