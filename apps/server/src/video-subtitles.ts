import { randomUUID } from 'node:crypto';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import type { PrivateObjectService } from './private-objects.js';
import { RepositoryError } from './repository.js';

const idPattern = /^(?:ci|ma|st)_[a-f0-9]{32}$/;
const MAX_VTT_BYTES = 262144;

export function normalizeSubtitleLanguage(raw: string): string {
  if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(raw) || raw.length > 35) throw new RepositoryError('INVALID_INPUT', 'Invalid subtitle language');
  try { return new Intl.Locale(raw).toString(); }
  catch { throw new RepositoryError('INVALID_INPUT', 'Invalid subtitle language'); }
}

export function validateWebVtt(bytes: Buffer): string {
  if (!Buffer.isBuffer(bytes) || bytes.length < 15 || bytes.length > MAX_VTT_BYTES) throw new RepositoryError('INVALID_INPUT', 'Subtitle size is invalid');
  let value: string;
  try { value = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new RepositoryError('INVALID_INPUT', 'Subtitle must be UTF-8'); }
  if (value.charCodeAt(0) === 0xfeff || /\r|\0|[\u0001-\u0008\u000b\u000c\u000e-\u001f]/u.test(value) || !/^WEBVTT(?:[ \t][^\n]*)?\n\n/u.test(value))
    throw new RepositoryError('INVALID_INPUT', 'Invalid WebVTT header or text');
  if (/<|&|(?:https?:\/\/|www\.|\/\/)|(?:\.{2}\/)|(?:file:|data:|javascript:)/iu.test(value))
    throw new RepositoryError('INVALID_INPUT', 'Unsafe subtitle cue');
  const blocks = value.trimEnd().split(/\n\n+/u).slice(1);
  if (!blocks.length || blocks.length > 1000 || value.split('\n').some(line => line.length > 500)) throw new RepositoryError('INVALID_INPUT', 'Subtitle cue limit exceeded');
  const timestamp = '(?:\\d{2}:)?\\d{2}:\\d{2}\\.\\d{3}';
  const cueTime = new RegExp(`^(${timestamp}) --> (${timestamp})$`, 'u');
  const seconds = (time: string) => { const parts = time.split(':'); const last = Number(parts.pop()!); const minute = Number(parts.pop()!); const hour = Number(parts.pop() ?? 0); return minute > 59 || last >= 60 ? NaN : hour * 3600 + minute * 60 + last; };
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2 || lines.length > 10) throw new RepositoryError('INVALID_INPUT', 'Malformed subtitle cue');
    if (!cueTime.test(lines[0]!)) {
      if (lines.length < 3 || !/^[A-Za-z0-9_-]{1,80}$/u.test(lines.shift()!)) throw new RepositoryError('INVALID_INPUT', 'Malformed subtitle cue');
    }
    const match = cueTime.exec(lines[0]!);
    if (!match || !lines.slice(1).every(line => line.trim().length > 0 && !line.includes('>') && !/[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(line)) || !Number.isFinite(seconds(match[1]!)) || !Number.isFinite(seconds(match[2]!)) || seconds(match[2]!) <= seconds(match[1]!) || seconds(match[2]!) > 7200 || seconds(match[2]!) - seconds(match[1]!) > 600)
      throw new RepositoryError('INVALID_INPUT', 'Malformed subtitle timing or text');
  }
  return value;
}

type TrackRow = { id: string; item_id: string; video_asset_id: string; object_id: string; language: string; byte_size: number; sha256: string; version: number; state: string; created_at: Date };
const view = (row: TrackRow) => ({ id: row.id, itemId: row.item_id, videoAssetId: row.video_asset_id,
  objectId: row.object_id, language: row.language, format: 'text/vtt' as const, byteSize: row.byte_size,
  sha256: row.sha256, version: row.version, state: row.state, createdAt: row.created_at.toISOString() });

export class VideoSubtitles {
  constructor(private readonly projects: HostedProjectRepository, private readonly objects: PrivateObjectService) {}

  async list(principal: AuthenticatedPrincipal, projectId: string, itemId: string, videoAssetId: string) {
    await this.projects.read(principal, projectId);
    if (!idPattern.test(itemId) || !idPattern.test(videoAssetId)) throw new RepositoryError('NOT_FOUND', 'Video not found');
    const rows = await this.projects.pool.query<TrackRow>(`SELECT t.* FROM video_subtitle_tracks t
      JOIN catalog_items i ON i.id=t.item_id AND i.project_id=t.project_id AND i.creator_account_id=t.creator_account_id
      JOIN catalog_media_assets a ON a.id=t.video_asset_id AND a.item_id=t.item_id AND a.project_id=t.project_id AND a.creator_account_id=t.creator_account_id
      WHERE t.creator_account_id=$1 AND t.project_id=$2 AND t.item_id=$3 AND t.video_asset_id=$4 AND t.state='active' ORDER BY t.language`,
      [principal.accountId, projectId, itemId, videoAssetId]);
    return rows.rows.map(view);
  }

  async upload(principal: AuthenticatedPrincipal, projectId: string, input: { itemId: string; videoAssetId: string; language: string; contentBase64: string; expectedVersion: number; replaceTrackId?: string | undefined }) {
    if (!idPattern.test(input.itemId) || !idPattern.test(input.videoAssetId) || (input.replaceTrackId && !idPattern.test(input.replaceTrackId))) throw new RepositoryError('INVALID_INPUT', 'Invalid video identity');
    const language = normalizeSubtitleLanguage(input.language);
    const bytes = Buffer.from(input.contentBase64, 'base64');
    validateWebVtt(bytes);
    await this.projects.read(principal, projectId);
    const object = await this.objects.put(principal, projectId, 'media', 'text/vtt', bytes);
    const client = await this.projects.pool.connect();
    try {
      await client.query('BEGIN');
      const owned = await client.query('SELECT 1 FROM channel_ownerships WHERE project_id=$1 AND creator_account_id=$2 FOR UPDATE', [projectId, principal.accountId]);
      if (!owned.rowCount) throw new RepositoryError('NOT_FOUND', 'Project not found');
      const parent = await client.query(`SELECT 1 FROM catalog_items i JOIN catalog_media_assets a ON a.item_id=i.id AND a.project_id=i.project_id AND a.creator_account_id=i.creator_account_id
        WHERE i.id=$1 AND a.id=$2 AND i.project_id=$3 AND i.creator_account_id=$4 AND i.record->>'kind'='video' AND a.record->>'kind'='video'`,
        [input.itemId, input.videoAssetId, projectId, principal.accountId]);
      if (!parent.rowCount) throw new RepositoryError('NOT_FOUND', 'Video not found');
      const active = await client.query<TrackRow>(`SELECT * FROM video_subtitle_tracks WHERE creator_account_id=$1 AND project_id=$2 AND item_id=$3 AND video_asset_id=$4 AND language=$5 AND state='active' FOR UPDATE`,
        [principal.accountId, projectId, input.itemId, input.videoAssetId, language]);
      const prior = active.rows[0];
      if (prior ? prior.id !== input.replaceTrackId || prior.version !== input.expectedVersion : input.expectedVersion !== 0 || input.replaceTrackId)
        throw new RepositoryError('CONFLICT', 'Subtitle revision changed or language already active');
      const id = `st_${randomUUID().replaceAll('-', '')}`;
      if (prior) await client.query("UPDATE video_subtitle_tracks SET state='replaced', replaced_by=$2 WHERE id=$1", [prior.id, id]);
      const result = await client.query<TrackRow>(`INSERT INTO video_subtitle_tracks(id,creator_account_id,project_id,item_id,video_asset_id,object_id,language,byte_size,sha256,version,state)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active') RETURNING *`, [id, principal.accountId, projectId, input.itemId, input.videoAssetId, object.id, language, object.byteSize, object.sha256, (prior?.version ?? 0) + 1]);
      await client.query('COMMIT');
      return view(result.rows[0]!);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      await this.objects.delete(principal, projectId, object.id).catch(() => undefined);
      if (error instanceof RepositoryError) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') throw new RepositoryError('CONFLICT', 'Subtitle language already active');
      throw new RepositoryError('STORAGE_ERROR', 'Subtitle write failed');
    } finally { client.release(); }
  }

  async remove(principal: AuthenticatedPrincipal, projectId: string, trackId: string, expectedVersion: number) {
    await this.projects.read(principal, projectId);
    if (!idPattern.test(trackId)) throw new RepositoryError('NOT_FOUND', 'Subtitle not found');
    const result = await this.projects.pool.query(`UPDATE video_subtitle_tracks SET state='removed', version=version+1 WHERE id=$1 AND project_id=$2 AND creator_account_id=$3 AND version=$4 AND state='active' RETURNING id`,
      [trackId, projectId, principal.accountId, expectedVersion]);
    if (!result.rowCount) throw new RepositoryError('CONFLICT', 'Subtitle revision changed or track unavailable');
    return { removed: true };
  }
}
