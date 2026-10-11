import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { publishedManifestSchema } from '@firelaunch/contracts';
import type { HostedProjectRepository } from './hosted-repository.js';
import { canonicalBytes } from './publication-repository.js';
import { RepositoryError } from './repository.js';

const MAX_MANIFEST_BYTES = 1_048_576;
const deploymentIdSchema = z.string().regex(/^dep_[a-f0-9]{32}$/);
const releaseIdSchema = z.string().regex(/^rel_[a-f0-9]{32}$/);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const publicPath = /^\/public\/v1\/deployments\/(dep_[a-f0-9]{32})\/(current|releases\/(rel_[a-f0-9]{32}))$/;
const notFound = () => new RepositoryError('NOT_FOUND', 'Route not found');

type StoredRelease = { id: string; sequence: number; sha256: string; manifest_bytes: string };

export class PublicReleaseResolver {
  constructor(private readonly projects: HostedProjectRepository) {}

  async release(deploymentId: string, releaseId: string): Promise<StoredRelease> {
    deploymentIdSchema.parse(deploymentId);
    releaseIdSchema.parse(releaseId);
    const result = await this.projects.pool.query<StoredRelease>(`SELECT r.id, r.sequence, r.sha256, r.manifest_bytes
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
    const result = await this.projects.pool.query<StoredRelease>(`SELECT r.id, r.sequence, r.sha256, r.manifest_bytes
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

  private verified(row: StoredRelease | undefined, deploymentId: string): StoredRelease {
    if (!row || typeof row.manifest_bytes !== 'string' || Buffer.byteLength(row.manifest_bytes) > MAX_MANIFEST_BYTES ||
      Buffer.byteLength(row.manifest_bytes) === 0 || !digestSchema.safeParse(row.sha256).success ||
      createHash('sha256').update(row.manifest_bytes).digest('hex') !== row.sha256) throw notFound();
    let decoded: unknown;
    try { decoded = JSON.parse(row.manifest_bytes); } catch { throw notFound(); }
    const manifest = publishedManifestSchema.safeParse(decoded);
    if (!manifest.success || canonicalBytes(manifest.data) !== row.manifest_bytes ||
      manifest.data.deployment.id !== deploymentId || manifest.data.releaseId !== row.id ||
      manifest.data.releaseSequence !== row.sequence) throw notFound();
    return row;
  }
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
    'cache-control': current ? 'public, max-age=0, must-revalidate' : 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff', etag };
  if (request.headers['if-none-match'] === etag) { response.writeHead(304, headers); response.end(); return; }
  response.writeHead(200, { ...headers, 'content-length': Buffer.byteLength(bytes) });
  response.end(bytes);
}
