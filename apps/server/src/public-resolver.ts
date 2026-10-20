import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { catalogItemSchema, catalogSourceSchema, mediaAssetSchema, mediaUseEligible, publishedManifestSchema } from '@firelaunch/contracts';
import type { HostedProjectRepository } from './hosted-repository.js';
import { canonicalBytes } from './publication-repository.js';
import { RepositoryError } from './repository.js';
import type { ManagedArtworkDelivery } from './managed-artwork.js';

const MAX_MANIFEST_BYTES = 1_048_576;
const deploymentIdSchema = z.string().regex(/^dep_[a-f0-9]{32}$/);
const releaseIdSchema = z.string().regex(/^rel_[a-f0-9]{32}$/);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const publicPath = /^\/public\/v1\/deployments\/(dep_[a-f0-9]{32})\/(current|releases\/(rel_[a-f0-9]{32}))$/;
const artworkPath = /^\/api\/public-artwork\/(dep_[a-f0-9]{32})\/(rel_[a-f0-9]{32})\/(ma_[a-f0-9]{32})\/([a-f0-9]{64})\.(png|jpg)$/;
const cdnArtworkPath = /^\/media\/([a-f0-9]{32})\/([a-f0-9]{32})\/([a-f0-9]{32})\/delivery\/artwork\/(rel_[a-f0-9]{32})\/([a-f0-9]{64})\/poster\.(png|jpg)$/;
const notFound = () => new RepositoryError('NOT_FOUND', 'Route not found');

type StoredRelease = { id: string; sequence: number; sha256: string; manifest_bytes: string;
  creator_account_id: string; project_id: string };

export class PublicReleaseResolver {
  constructor(private readonly projects: HostedProjectRepository, private readonly artworkDelivery?: ManagedArtworkDelivery) {}

  async artwork(deploymentId: string, releaseId: string, assetId: string, sha256: string,
    ext: 'png' | 'jpg'): Promise<{ body: Buffer; contentType: 'image/png' | 'image/jpeg' }> {
    if (!this.artworkDelivery) throw notFound();
    const release = await this.release(deploymentId, releaseId);
    const parsed = publishedManifestSchema.safeParse(JSON.parse(release.manifest_bytes));
    if (!parsed.success) throw notFound();
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const expectedUrl = this.artworkDelivery.url(deploymentId, releaseId, assetId, sha256, contentType);
    if (!parsed.data.media.some(media => media.id === assetId && media.kind === 'artwork' && media.url === expectedUrl)) throw notFound();
    return { body: await this.artworkDelivery.read(deploymentId, releaseId, assetId, sha256, contentType), contentType };
  }

  async release(deploymentId: string, releaseId: string): Promise<StoredRelease> {
    deploymentIdSchema.parse(deploymentId);
    releaseIdSchema.parse(releaseId);
    const result = await this.projects.pool.query<StoredRelease>(`SELECT r.id, r.sequence, r.sha256, r.manifest_bytes, r.creator_account_id, r.project_id
      FROM publication_releases r
      JOIN channel_deployments d ON (d.id, d.project_id, d.creator_account_id) =
        (r.deployment_id, r.project_id, r.creator_account_id)
      JOIN publication_approvals a ON (a.id, a.deployment_id, a.project_id, a.creator_account_id) =
        (r.approval_id, r.deployment_id, r.project_id, r.creator_account_id)
      WHERE r.deployment_id = $1 AND r.id = $2`, [deploymentId, releaseId]);
    return this.verified(result.rows[0], deploymentId);
  }

  async current(deploymentId: string): Promise<StoredRelease> {
    deploymentIdSchema.parse(deploymentId);
    const result = await this.projects.pool.query<StoredRelease>(`SELECT r.id, r.sequence, r.sha256, r.manifest_bytes, r.creator_account_id, r.project_id
      FROM publication_live_pointers p
      JOIN publication_releases r ON (r.id, r.deployment_id, r.project_id, r.creator_account_id, r.sequence) =
        (p.release_id, p.deployment_id, p.project_id, p.creator_account_id, p.sequence)
      JOIN channel_deployments d ON (d.id, d.project_id, d.creator_account_id) =
        (p.deployment_id, p.project_id, p.creator_account_id)
      JOIN publication_approvals a ON (a.id, a.deployment_id, a.project_id, a.creator_account_id) =
        (r.approval_id, r.deployment_id, r.project_id, r.creator_account_id)
      WHERE p.deployment_id = $1`, [deploymentId]);
    return this.verified(result.rows[0], deploymentId);
  }

  private async verified(row: StoredRelease | undefined, deploymentId: string): Promise<StoredRelease> {
    if (!row || typeof row.manifest_bytes !== 'string' || Buffer.byteLength(row.manifest_bytes) > MAX_MANIFEST_BYTES ||
      Buffer.byteLength(row.manifest_bytes) === 0 || !digestSchema.safeParse(row.sha256).success ||
      createHash('sha256').update(row.manifest_bytes).digest('hex') !== row.sha256) throw notFound();
    let decoded: unknown;
    try { decoded = JSON.parse(row.manifest_bytes); } catch { throw notFound(); }
    const manifest = publishedManifestSchema.safeParse(decoded);
    if (!manifest.success || canonicalBytes(manifest.data) !== row.manifest_bytes ||
      manifest.data.deployment.id !== deploymentId || manifest.data.releaseId !== row.id ||
      manifest.data.releaseSequence !== row.sequence) throw notFound();
    const bound = manifest.data.bindings.content;
    const ids = [...new Set([...manifest.data.media.map(asset => asset.id)])];
    const assets = await this.projects.pool.query<{ id: string; record: unknown; item_record: unknown; source_record: unknown;
      revoked_at: Date | null }>(`SELECT a.id, a.record, i.record AS item_record, s.record AS source_record, l.revoked_at
      FROM catalog_media_assets a
      JOIN catalog_items i ON i.id = a.item_id AND i.project_id = a.project_id AND i.creator_account_id = a.creator_account_id
      JOIN catalog_sources s ON s.id = i.record->'sourceRecord'->>'sourceId' AND s.project_id = i.project_id
        AND s.creator_account_id = i.creator_account_id
      LEFT JOIN media_asset_lifecycle l ON l.asset_id = a.id AND l.project_id = a.project_id
        AND l.creator_account_id = a.creator_account_id
      WHERE a.creator_account_id = $1 AND a.project_id = $2 AND a.id = ANY($3::text[])`,
    [row.creator_account_id, row.project_id, ids]);
    if (assets.rows.length !== ids.length) throw notFound();
    const current = new Map(assets.rows.map(asset => [asset.id, asset]));
    const managedArtworkIds = manifest.data.media.flatMap(media => {
      if (media.kind !== 'artwork') return [];
      const record = current.get(media.id);
      const parsed = mediaAssetSchema.safeParse(record?.record);
      if (!parsed.success) throw notFound();
      if (parsed.data.location.type !== 'private_object') return [];
      return [parsed.data.location.objectId];
    });
    const privateArtwork = managedArtworkIds.length ? await this.projects.pool.query<{
      id: string; sha256: string; content_type: string
    }>(`SELECT id, sha256, content_type FROM private_objects
      WHERE id = ANY($1::text[]) AND creator_account_id = $2 AND project_id = $3 AND kind = 'media'`,
    [managedArtworkIds, row.creator_account_id, row.project_id]) : { rows: [] };
    const artworkObjects = new Map(privateArtwork.rows.map(object => [object.id, object]));
    for (const media of manifest.data.media) {
      const record = current.get(media.id);
      const parsed = mediaAssetSchema.safeParse(record?.record);
      const item = catalogItemSchema.safeParse(record?.item_record);
      const source = catalogSourceSchema.safeParse(record?.source_record);
      if (!record || record.revoked_at || !parsed.success || !item.success || !source.success ||
        parsed.data.kind !== media.kind ||
        parsed.data.creatorAccountId !== row.creator_account_id || parsed.data.projectId !== row.project_id ||
        !parsed.data.deliveryEligible || !mediaUseEligible(parsed.data,
          media.kind === 'artwork' ? 'television_display' : 'television_playback') ||
        (media.kind === 'video' && parsed.data.location.type === 'managed_hls' &&
          !mediaUseEligible(parsed.data, 'television_display')) ||
        item.data.id !== parsed.data.catalogItemId || item.data.creatorAccountId !== row.creator_account_id ||
        item.data.projectId !== row.project_id || !item.data.mediaAssetIds.includes(media.id) ||
        source.data.id !== item.data.sourceRecord.sourceId || source.data.creatorAccountId !== row.creator_account_id ||
        source.data.projectId !== row.project_id || source.data.state === 'discovered' ||
        ['unknown', 'revoked'].includes(source.data.permission.retrieval) ||
        ['unknown', 'revoked'].includes(source.data.permission.tvDisplay) ||
        (media.kind === 'artwork' && parsed.data.location.type === 'private_object' &&
          !media.url.includes('/api/public-artwork/') && !media.url.includes('/delivery/artwork/'))) throw notFound();
      if (media.kind === 'artwork' && parsed.data.location.type === 'private_object' &&
        media.url.includes('/api/public-artwork/')) {
        const url = new URL(media.url);
        const match = artworkPath.exec(url.pathname);
        const object = parsed.data.location.type === 'private_object' ? artworkObjects.get(parsed.data.location.objectId) : undefined;
        if (!this.artworkDelivery || !match || parsed.data.location.type !== 'private_object' ||
          !object || object.sha256 !== match[4] || object.content_type !== (match[5] === 'png' ? 'image/png' : 'image/jpeg') ||
          match[1] !== deploymentId || match[2] !== row.id || match[3] !== media.id ||
          media.url !== this.artworkDelivery.url(match[1]!, match[2]!, match[3]!, match[4]!,
            match[5] === 'png' ? 'image/png' : 'image/jpeg')) throw notFound();
      }
      if (media.kind === 'artwork' && parsed.data.location.type === 'private_object' &&
        media.url.includes('/delivery/artwork/')) {
        const url = new URL(media.url);
        const match = cdnArtworkPath.exec(url.pathname);
        const object = parsed.data.location.type === 'private_object' ? artworkObjects.get(parsed.data.location.objectId) : undefined;
        const contentType = match?.[6] === 'png' ? 'image/png' : 'image/jpeg';
        if (!this.artworkDelivery || !match || !object || object.sha256 !== match[5] ||
          object.content_type !== contentType || match[1] !== row.creator_account_id.slice(3) ||
          match[2] !== row.project_id.slice(3) || match[3] !== media.id.slice(3) ||
          match[4] !== row.id || media.url !== this.artworkDelivery.deliveryUrl(row.creator_account_id,
            row.project_id, row.id, media.id, match[5]!, contentType)) throw notFound();
      }
    }
    if (bound.some(binding => !current.has(binding.artworkAssetId) ||
      binding.playbackAssetId && !current.has(binding.playbackAssetId))) throw notFound();
    return row;
  }
}

export async function publicArtworkRoute(request: IncomingMessage, response: ServerResponse,
  resolver: PublicReleaseResolver): Promise<void> {
  const match = artworkPath.exec(request.url ?? '');
  if (request.method !== 'GET' || !match || request.headers['content-length'] !== undefined ||
    request.headers['transfer-encoding'] !== undefined || request.headers.range !== undefined ||
    (request.headers['if-none-match'] !== undefined &&
      (typeof request.headers['if-none-match'] !== 'string' || request.headers['if-none-match'].length > 128))) throw notFound();
  const { body, contentType } = await resolver.artwork(match[1]!, match[2]!, match[3]!, match[4]!, match[5] as 'png' | 'jpg');
  const etag = `"${match[4]}"`;
  const headers = { 'content-type': contentType, 'cache-control': 'public, max-age=0, must-revalidate',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', etag };
  if (request.headers['if-none-match'] === etag) { response.writeHead(304, headers); response.end(); return; }
  response.writeHead(200, { ...headers, 'content-length': body.length }); response.end(body);
}

export async function publicReleaseRoute(request: IncomingMessage, response: ServerResponse, resolver: PublicReleaseResolver): Promise<void> {
  const match = publicPath.exec(request.url ?? '');
  if (request.method !== 'GET' || !match || request.headers['content-length'] !== undefined ||
    request.headers['transfer-encoding'] !== undefined || request.headers.range !== undefined ||
    (request.headers['if-none-match'] !== undefined &&
      (typeof request.headers['if-none-match'] !== 'string' || request.headers['if-none-match'].length > 128))) throw notFound();
  const deploymentId = match[1]!;
  const release = match[3]
    ? await resolver.release(deploymentId, match[3])
    : await resolver.current(deploymentId);
  const current = !match[3];
  const bytes = current ? JSON.stringify({ deploymentId, releaseId: release.id,
    releaseSequence: release.sequence, sha256: release.sha256 }) : release.manifest_bytes;
  const etag = `"${createHash('sha256').update(bytes).digest('hex')}"`;
  const headers = { 'content-type': 'application/json; charset=utf-8',
    // Bytes are immutable, but rights can be revoked after publication.
    'cache-control': current ? 'public, max-age=0, must-revalidate' : 'public, max-age=60, immutable',
    'x-content-type-options': 'nosniff', etag };
  if (request.headers['if-none-match'] === etag) { response.writeHead(304, headers); response.end(); return; }
  response.writeHead(200, { ...headers, 'content-length': Buffer.byteLength(bytes) });
  response.end(bytes);
}
