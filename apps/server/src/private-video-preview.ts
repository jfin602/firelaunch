import { createHash } from 'node:crypto';
import { mediaRenditionSetSchema, mediaUseEligible } from '@firelaunch/contracts';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import { CatalogRepository } from './catalog-repository.js';
import { RepositoryError } from './repository.js';
import type { S3MediaStorage } from './media-storage.js';

const contentId = /^item_[a-f0-9]{32}$/;
const projectId = /^ch_[a-f0-9]{32}$/;
const notFound = () => new RepositoryError('NOT_FOUND', 'Preview video unavailable');
const stableContentId = (itemId: string) => `item_${createHash('sha256')
  .update('catalog-content-v1\0').update(itemId).digest('hex').slice(0, 32)}`;

type ReadyRow = { id: string; job_id: string; creator_account_id: string; project_id: string;
  item_id: string; asset_id: string; profile: string; master_key: string; master_sha256: string;
  variants: unknown; verified_at: Date; revoked_at: Date | null; state: string;
  rendition_set_id: string | null };

/** Every playlist and segment request rechecks session ownership, current rights and lifecycle. */
export class PrivateVideoPreview {
  constructor(private readonly projects: HostedProjectRepository, private readonly catalog: CatalogRepository,
    private readonly storage: S3MediaStorage) {}

  async read(principal: AuthenticatedPrincipal, rawProjectId: string, rawContentId: string,
    name: string): Promise<{ body: Buffer; contentType: string }> {
    if (!projectId.test(rawProjectId) || !contentId.test(rawContentId)) throw notFound();
    const project = await this.projects.read(principal, rawProjectId);
    const content = project.spec.content.find(item => item.id === rawContentId && item.presentation === 'video');
    if (!content?.mediaUrl) throw notFound();
    const inventory = await this.catalog.read(principal, rawProjectId);
    const item = inventory.items.find(value => stableContentId(value.id) === rawContentId && value.kind === 'video');
    const source = item && inventory.sources.find(value => value.id === item.sourceRecord.sourceId);
    if (!item || !source || source.state === 'discovered' ||
      !['creator_asserted', 'provider_authorized'].includes(source.permission.retrieval) ||
      !['creator_asserted', 'provider_authorized'].includes(source.permission.tvDisplay)) throw notFound();
    for (const assetId of item.mediaAssetIds) {
      const asset = inventory.mediaAssets.find(value => value.id === assetId && value.catalogItemId === item.id);
      if (!asset || asset.kind !== 'video' || asset.location.type !== 'managed_hls' || !asset.deliveryEligible ||
        !mediaUseEligible(asset, 'television_display') || !mediaUseEligible(asset, 'television_playback')) continue;
      const result = await this.projects.pool.query<ReadyRow>(`
        SELECT r.*, j.state, j.rendition_set_id FROM media_processing_jobs j
        JOIN media_upload_sessions u ON u.id = j.upload_session_id AND u.creator_account_id = j.creator_account_id
          AND u.project_id = j.project_id AND u.asset_id = j.asset_id AND u.state = 'verified'
        LEFT JOIN media_rendition_sets r ON r.id = j.rendition_set_id AND r.creator_account_id = j.creator_account_id
          AND r.project_id = j.project_id AND r.asset_id = j.asset_id AND r.item_id = j.item_id
        LEFT JOIN media_asset_lifecycle l ON l.asset_id = j.asset_id AND l.creator_account_id = j.creator_account_id
          AND l.project_id = j.project_id
        WHERE j.creator_account_id = $1 AND j.project_id = $2 AND j.item_id = $3 AND j.asset_id = $4
          AND l.revoked_at IS NULL
        ORDER BY j.created_at DESC, j.id DESC LIMIT 1`,
      [principal.accountId, rawProjectId, item.id, assetId]);
      const row = result.rows[0];
      if (!row || row.state !== 'ready' || !row.id || row.revoked_at || row.rendition_set_id !== row.id) continue;
      try {
        const set = mediaRenditionSetSchema.parse({ id: row.id, jobId: row.job_id,
          creatorAccountId: row.creator_account_id, projectId: row.project_id, catalogItemId: row.item_id,
          mediaAssetId: row.asset_id, profile: row.profile, masterKey: row.master_key,
          masterSha256: row.master_sha256, variants: row.variants,
          verifiedAt: row.verified_at.toISOString() });
        const scope = { creatorAccountId: principal.accountId, projectId: rawProjectId, mediaAssetId: assetId };
        if (content.mediaUrl !== this.storage.publishedMasterUrl(scope, set)) continue;
        let expectedSha256: string | undefined;
        if (name === 'master.m3u8') expectedSha256 = set.masterSha256;
        else {
          const variant = set.variants.find(value => name === `v${value.height}.m3u8`);
          if (variant) expectedSha256 = variant.playlistSha256;
          else if (!set.variants.some(value => {
            const match = new RegExp(`^v${value.height}-([0-9]+)\\.ts$`).exec(name);
            return !!match && Number(match[1]) < value.segmentCount &&
              name === `v${value.height}-${String(Number(match[1])).padStart(3, '0')}.ts`;
          })) throw notFound();
        }
        const body = await this.storage.readStagedPreviewObject(scope, set.id, name, expectedSha256);
        return { body, contentType: name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t' };
      } catch (error) {
        if (error instanceof RepositoryError) throw error;
        throw notFound();
      }
    }
    throw notFound();
  }
}
