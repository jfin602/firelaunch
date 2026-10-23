import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isIP } from 'node:net';
import { ZodError, z } from 'zod';
import { applyMutation, mutationSchema } from '@vegalaunch/channel-engine';
import { channelDeploymentSchema, createProjectSchema, publicationBindingsSchema, sourceUseEligible, updateProjectSchema } from '@vegalaunch/contracts';
import { agentRequestSchema, BedrockProvider, ChannelAgent, MockProvider, OpenAIProvider, providerStatus, type AgentProvider } from '@vegalaunch/agent';
import { ProjectRepository, RepositoryError } from './repository.js';
import { WorkspaceService } from './workspace.js';
import { HostedWorkspaceService } from './hosted-workspace.js';
import type { ServerMode } from './auth/config.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import { MAX_PRIVATE_AUDIO_BYTES, type PrivateObjectService } from './private-objects.js';
import { audit } from './operations.js';
import { CatalogRepository, catalogKinds, type CatalogKind } from './catalog-repository.js';
import { CatalogProjectionService } from './catalog-projection.js';
import { changeSectionContent } from './section-content.js';
import { agentCatalogGrounding } from './agent-grounding.js';
import { PublicationRepository } from './publication-repository.js';
import { PublicReleaseResolver, publicArtworkRoute, publicReleaseRoute } from './public-resolver.js';
import type { ManagedArtworkDelivery } from './managed-artwork.js';
import type { MediaUploadService } from './media-upload-service.js';
import type { S3MediaStorage } from './media-storage.js';
import { PrivateVideoPreview } from './private-video-preview.js';
import { VideoSubtitles } from './video-subtitles.js';
import { NativeBuildQueue } from './native-build-queue.js';
import { nativeExportForOwner } from './native-export-delivery.js';
import type { DraftAudioDelivery } from './draft-audio-delivery.js';
import type { ReleaseBuildInput } from './release-build.js';

const mutationRequestSchema = z.strictObject({ expectedRevision: z.number().int().positive(), mutation: mutationSchema });
const saveSourceSchema = z.strictObject({ path: z.string().max(240), content: z.string().max(256_000), expectedHash: z.string().regex(/^[a-f0-9]{64}$/) });
const privatePutSchema = z.strictObject({ kind: z.enum(['media', 'evidence']), contentType: z.string().max(100), contentBase64: z.string().min(1).max(1_000_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/) });
const subtitleUploadSchema = z.strictObject({ itemId: z.string().regex(/^ci_[a-f0-9]{32}$/), videoAssetId: z.string().regex(/^ma_[a-f0-9]{32}$/),
  language: z.string().min(2).max(35), contentBase64: z.string().min(1).max(350_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  expectedVersion: z.number().int().nonnegative(), replaceTrackId: z.string().regex(/^st_[a-f0-9]{32}$/).optional() });
const MAX_BODY_BYTES = 1_000_000;
const catalogWriteSchema = z.strictObject({ expectedRevision: z.number().int().nonnegative(), record: z.record(z.string(), z.unknown()) });
const catalogDeleteSchema = z.strictObject({ expectedRevision: z.number().int().nonnegative() });
const filePreviewSchema = z.strictObject({ sourceId: z.string().regex(/^src_[a-f0-9]{32}$/), format: z.enum(['csv', 'json']), content: z.string().max(512_000) });
const fileApproveSchema = filePreviewSchema.extend({ expectedRevision: z.number().int().nonnegative(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) });
const feedPreviewSchema = z.strictObject({ sourceId: z.string().regex(/^src_[a-f0-9]{32}$/) });
const feedApproveSchema = feedPreviewSchema.extend({ content: z.string().max(512_000), expectedRevision: z.number().int().nonnegative(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) });
const mediaInclusionSchema = z.strictObject({ expectedRevision: z.number().int().positive(),
  expectedCatalogRevision: z.number().int().nonnegative(), itemId: z.string().regex(/^ci_[a-f0-9]{32}$/),
  action: z.enum(['publish', 'remove']) });
const sectionContentSchema = z.strictObject({ expectedRevision: z.number().int().positive(),
  expectedCatalogRevision: z.number().int().nonnegative(), pageId: z.string().regex(/^page_[a-f0-9]{32}$/),
  moduleId: z.string().regex(/^mod_[a-f0-9]{32}$/), itemId: z.string().regex(/^ci_[a-f0-9]{32}$/).optional(),
  contentId: z.string().regex(/^item_[a-f0-9]{32}$/), selected: z.boolean() })
  .refine(value => !value.selected || !!value.itemId, 'Catalog item is required for selection');
const releaseIdSchema = z.string().regex(/^rel_[a-f0-9]{32}$/);
const publicationSnapshotSchema = z.strictObject({
  revisions: z.strictObject({ channel: z.number().int().positive(), catalog: z.number().int().nonnegative() }),
  expectedLiveReleaseId: releaseIdSchema.nullable(), bindings: publicationBindingsSchema
});
const rollbackReviewSchema = publicationSnapshotSchema.omit({ bindings: true }).extend({ rollbackSourceReleaseId: releaseIdSchema });
const publishApprovalSchema = z.strictObject({ approvalId: z.string().regex(/^ap_[a-f0-9]{32}$/) });
const createDeploymentSchema = z.strictObject({
  appName: channelDeploymentSchema.shape.appName,
  packageId: channelDeploymentSchema.shape.packageId,
  manifestEndpoint: channelDeploymentSchema.shape.manifestEndpoint.unwrap(),
  nativeReleaseApproval: z.literal('creator_approved')
}).refine(input => {
  try {
    const url = new URL(input.manifestEndpoint);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash &&
      !url.username && !url.password && (!url.port || url.port === '443') && !isIP(host) &&
      host.includes('.') && host !== 'localhost' && !host.endsWith('.localhost') &&
      !host.endsWith('.local') && !host.endsWith('.internal');
  } catch { return false; }
}, 'Deployment needs a dedicated, public HTTPS resolver origin');

async function body(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new ZodError([{ code: 'custom', path: [], message: 'Expected application/json' }]);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new ZodError([{ code: 'custom', path: [], message: 'Request body too large' }]);
    chunks.push(chunk);
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { throw new ZodError([{ code: 'custom', path: [], message: 'Invalid JSON' }]); }
}

export async function privateAudioBody(request: IncomingMessage): Promise<{ file: string; directory: string; bytes: number; sha256: string; head: Buffer; durationSeconds: number }> {
  if (request.headers['content-type']?.toLowerCase() !== 'audio/mpeg')
    throw new RepositoryError('INVALID_INPUT', 'Expected MP3 audio');
  const length = Number(request.headers['content-length']);
  if (!Number.isSafeInteger(length) || length < 1 || length > MAX_PRIVATE_AUDIO_BYTES)
    throw new RepositoryError('INVALID_INPUT', 'MP3 must be 1 byte to 320 MB');
  const directory = await mkdtemp(path.join(tmpdir(), 'vegalaunch-audio-'));
  const file = path.join(directory, 'upload.mp3');
  const handle = await open(file, 'wx', 0o600);
  const hash = createHash('sha256');
  let head = Buffer.alloc(0);
  let size = 0;
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_PRIVATE_AUDIO_BYTES || size > length)
        throw new RepositoryError('INVALID_INPUT', 'MP3 upload exceeds its declared size');
      hash.update(chunk);
      if (head.length < 16) head = Buffer.concat([head, chunk.subarray(0, 16 - head.length)]);
      await handle.writeFile(chunk);
    }
    if (size !== length) throw new RepositoryError('INVALID_INPUT', 'Incomplete MP3 upload');
    await handle.close();
    let durationSeconds = 0;
    try {
      const { stdout } = await promisify(execFile)('ffprobe', ['-v', 'error', '-show_entries',
        'format=duration,format_name:stream=codec_name,codec_type', '-of', 'json', file],
      { timeout: 30_000, maxBuffer: 4096 });
      const probed = JSON.parse(stdout) as { format?: { duration?: string; format_name?: string };
        streams?: { codec_name?: string; codec_type?: string }[] };
      if (!probed.format?.format_name?.split(',').includes('mp3') ||
        !probed.streams?.some(stream => stream.codec_type === 'audio' && stream.codec_name === 'mp3'))
        throw new Error('Not MP3 audio');
      durationSeconds = Number(probed.format.duration);
    } catch { throw new RepositoryError('INVALID_INPUT', 'MP3 duration could not be verified'); }
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 7200)
      throw new RepositoryError('INVALID_INPUT', 'MP3 must be playable and no longer than two hours');
    return { file, directory, bytes: size, sha256: hash.digest('hex'), head, durationSeconds };
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

function respond(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(value));
}

function nativeExportJobStatus(job: NonNullable<Awaited<ReturnType<NativeBuildQueue['status']>>>,
  verified?: Awaited<ReturnType<typeof nativeExportForOwner>>,
  warnings: readonly import('./hosted-media-policy.js').DraftMediaWarning[] = []) {
  return { status: job.state,
    warnings: verified?.warnings ?? warnings,
    reason: job.state === 'failed' ? 'Native build failed; operator review is required' : undefined,
    job: { id: job.id, attempt: job.attempt, errorCode: job.errorCode, expiresAt: job.expiresAt,
      createdAt: job.createdAt,
      completedAt: job.completedAt, artifactBytes: verified?.bytes ?? null,
      packageId: verified?.packageId ?? null, deploymentId: verified?.deploymentId ?? null,
      release: verified?.release ?? null },
    downloadReady: !!verified };
}

export function createApi(repository: ProjectRepository, selectedProvider?: AgentProvider, mode?: ServerMode, hostedRepository?: HostedProjectRepository, privateObjects?: PrivateObjectService, mediaUploads?: MediaUploadService, mediaPublisher?: S3MediaStorage, managedArtwork?: ManagedArtworkDelivery, draftAudio?: DraftAudioDelivery) {
  const status = selectedProvider ? selectedProvider.name === 'mock' ? providerStatus({ VEGALAUNCH_AGENT_PROVIDER: 'mock' }) : { provider: selectedProvider.name, configured: true, message: `${selectedProvider.name} injected for this server; this status does not verify provider availability or request success.` } : providerStatus(process.env);
  const agent = status.configured ? new ChannelAgent(selectedProvider ?? (status.provider === 'mock' ? new MockProvider() : status.provider === 'bedrock' ? new BedrockProvider(process.env.BEDROCK_MODEL_ID!) : new OpenAIProvider(process.env.OPENAI_MODEL!, process.env.OPENAI_API_KEY!))) : null;
  const workspace = mode?.mode === 'local-legacy' ? new WorkspaceService(repository) : null;
  const nativeBuildQueue = mode?.mode === 'hosted' && hostedRepository ? new NativeBuildQueue(hostedRepository.pool) : null;
  const catalog = hostedRepository ? new CatalogRepository(hostedRepository) : null;
  const projection = hostedRepository && catalog ? new CatalogProjectionService(hostedRepository, catalog, mediaPublisher) : null;
  const hostedWorkspace = hostedRepository ? new HostedWorkspaceService(hostedRepository, undefined,
    projection ?? undefined, privateObjects) : null;
  const publication = hostedRepository ? new PublicationRepository(hostedRepository, mediaPublisher, managedArtwork) : null;
  const publicResolver = mode?.mode === 'hosted' && hostedRepository ? new PublicReleaseResolver(hostedRepository, managedArtwork) : null;
  const assertNativeRights = async (input: ReleaseBuildInput) => {
    if (input.mode === 'draft') return;
    if (!publicResolver) throw new RepositoryError('CONFLICT', 'Public release resolver unavailable');
    const current = await publicResolver.current(input.deploymentId);
    if (current.id !== input.publishedRelease.releaseId || current.sequence !== input.publishedRelease.sequence ||
      current.creator_account_id !== input.creatorAccountId || current.project_id !== input.projectId)
      throw new RepositoryError('CONFLICT', 'Published release or delivery rights changed');
  };
  const privatePreview = hostedRepository && catalog && mediaPublisher
    ? new PrivateVideoPreview(hostedRepository, catalog, mediaPublisher) : null;
  const subtitles = hostedRepository && privateObjects ? new VideoSubtitles(hostedRepository, privateObjects) : null;
  return createServer(async (request, response) => {
    try {
      if (request.url?.startsWith('/api/public-artwork/') || request.url === '/api/public-artwork') {
        if (!publicResolver) throw new RepositoryError('NOT_FOUND', 'Route not found');
        await publicArtworkRoute(request, response, publicResolver); return;
      }
      if (request.url?.startsWith('/api/draft-audio/') || request.url === '/api/draft-audio') {
        if (!draftAudio || request.method !== 'GET') throw new RepositoryError('NOT_FOUND', 'Route not found');
        const session = mode?.mode === 'hosted' ? mode.auth.session(request) : null;
        if (!session || !hostedRepository) { respond(response, 401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }); return; }
        const url = new URL(request.url, 'http://localhost');
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length !== 6 || parts[0] !== 'api' || parts[1] !== 'draft-audio' || url.search ||
          (parts[5] !== 'audio' && parts[5] !== 'cover')) throw new RepositoryError('NOT_FOUND', 'Route not found');
        const range = request.headers.range;
        const match = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
        if (range && !match) throw new RepositoryError('INVALID_INPUT', 'Unsupported audio range');
        const kind = parts[5] as 'audio' | 'cover';
        if (kind === 'cover' && range) throw new RepositoryError('INVALID_INPUT', 'Artwork range unavailable');
        await hostedRepository.read(session.principal, parts[2]!);
        const part = await draftAudio.read(parts[2]!, parts[3]!, parts[4]!, kind,
          match ? Number(match[1]) : 0, match?.[2] ? Number(match[2]) : undefined);
        response.writeHead(kind === 'audio' ? 206 : 200, { 'content-type': part.contentType,
          'content-length': part.content.length,
          ...(kind === 'audio' ? { 'content-range': `bytes ${part.start}-${part.end}/${part.size}`,
            'accept-ranges': 'bytes' } : {}), 'cache-control': 'no-store',
          'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'same-origin' });
        response.end(part.content); return;
      }
      if (request.url?.startsWith('/public/') || request.url === '/public') {
        if (!publicResolver) throw new RepositoryError('NOT_FOUND', 'Route not found');
        await publicReleaseRoute(request, response, publicResolver);
        return;
      }
      const url = new URL(request.url ?? '', 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments[0] === 'api' && segments[1] === 'auth' && mode?.mode === 'hosted') {
        const auth = mode.auth;
        if (segments.length === 3 && segments[2] === 'login' && request.method === 'GET') { auth.begin(request, response); return; }
        if (segments.length === 3 && segments[2] === 'callback' && request.method === 'GET') { await auth.callback(request, response, url); return; }
        if (segments.length === 3 && segments[2] === 'session' && request.method === 'GET') {
          const session = auth.session(request);
          if (!session) { respond(response, 401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }); return; }
          respond(response, 200, { accountId: session.principal.accountId, email: session.principal.email, csrfToken: session.csrf, expiresAt: new Date(session.expiresAt).toISOString() }); return;
        }
        if (segments.length === 3 && segments[2] === 'logout' && request.method === 'POST') { auth.logout(request, response); return; }
      }
      if (segments[0] === 'api' && segments[1] === 'projects' && mode?.mode === 'hosted') {
        const session = mode.auth.session(request);
        if (!session) { await audit(hostedRepository?.pool, 'auth_denied', 'denied'); respond(response, 401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }); return; }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? '') && !mode.auth.authorizedMutation(request, session)) { await audit(hostedRepository?.pool, 'auth_denied', 'denied', session.principal.accountId); respond(response, 403, { error: { code: 'CSRF', message: 'Invalid request origin or CSRF token' } }); return; }
        if (hostedRepository && hostedWorkspace) {
          const principal = session.principal;
          if (segments[3] === 'export-app' && !url.search) {
            const projectId = segments[2]!;
            if (segments.length === 4 && request.method === 'GET') {
              await hostedRepository.read(principal, projectId);
              const job = await nativeBuildQueue!.latestStatus(principal.accountId, projectId);
              let warnings: readonly import('./hosted-media-policy.js').DraftMediaWarning[] = [];
              if (job && (job.state === 'queued' || job.state === 'running')) {
                if (job.buildKind === 'draft') {
                  const current = await hostedWorkspace.draftBuildInput(principal, projectId);
                  if (current.fingerprint !== job.inputFingerprint)
                    throw new RepositoryError('CONFLICT', 'Build input changed');
                  warnings = current.warnings ?? [];
                } else await hostedWorkspace.assertReleaseBuildInputCurrent(principal, projectId, job.inputFingerprint);
              }
              const verified = job?.state === 'ready' ? await nativeExportForOwner(nativeBuildQueue!, hostedWorkspace,
                principal, projectId, job.id, process.env.VEGALAUNCH_BUILD_ARTIFACT_ROOT ?? '', assertNativeRights) : undefined;
              respond(response, 200, job ? nativeExportJobStatus(job, verified, warnings) : { status: 'blocked', reason: 'No native build has been submitted for this project',
                job: null, downloadReady: false }); return;
            }
            if (segments.length === 4 && request.method === 'POST') {
              await hostedRepository.read(principal, projectId);
              const requestBody = z.strictObject({ mode: z.literal('draft').optional() }).parse(await body(request));
              if (requestBody.mode === 'draft') await hostedRepository.ensureDraftDeployment(principal, projectId);
              const input = requestBody.mode === 'draft' ? await hostedWorkspace.draftBuildInput(principal, projectId) :
                await hostedWorkspace.releaseBuildInput(principal, projectId);
              await assertNativeRights(input);
              const jobId = await nativeBuildQueue!.enqueue(input, requestBody.mode === 'draft');
              const job = await nativeBuildQueue!.status(principal.accountId, projectId, jobId);
              if (!job) throw new RepositoryError('STORAGE_ERROR', 'Build job receipt unavailable');
              const verified = job.state === 'ready' ? await nativeExportForOwner(nativeBuildQueue!, hostedWorkspace,
                principal, projectId, job.id, process.env.VEGALAUNCH_BUILD_ARTIFACT_ROOT ?? '', assertNativeRights) : undefined;
              respond(response, job.state === 'ready' ? 200 : 202, nativeExportJobStatus(job, verified, input.warnings)); return;
            }
            if (segments.length === 6 && segments[5] === 'download' && request.method === 'GET') {
              await hostedRepository.read(principal, projectId);
              const exported = await nativeExportForOwner(nativeBuildQueue!, hostedWorkspace, principal,
                projectId, segments[4]!, process.env.VEGALAUNCH_BUILD_ARTIFACT_ROOT ?? '', assertNativeRights);
              response.writeHead(200, { 'content-type': 'application/zip',
                'content-length': exported.zip.length, 'content-disposition': `attachment; filename="${exported.packageId}_vega_release.zip"`,
                'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
                'x-artifact-sha256': exported.zipSha256 });
              response.end(exported.zip); return;
            }
            await hostedRepository.read(principal, projectId);
            throw new RepositoryError('NOT_FOUND', 'Native export not found');
          }
          if (segments[3] === 'preview-hls') {
            if (!privatePreview || url.search || segments.length !== 6 ||
              !['GET', 'HEAD'].includes(request.method ?? '')) throw new RepositoryError('NOT_FOUND', 'Route not found');
            const { body: videoBody, contentType } = await privatePreview.read(principal, segments[2]!, segments[4]!, segments[5]!);
            response.writeHead(200, { 'content-type': contentType, 'content-length': videoBody.length,
              'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
              'cross-origin-resource-policy': 'same-origin' });
            response.end(request.method === 'HEAD' ? undefined : videoBody); return;
          }
          if (segments[3] === 'media-uploads') {
            if (!mediaUploads) { respond(response, 503, { error: { code: 'STORAGE_ERROR', message: 'Managed media upload or processing unavailable' } }); return; }
            if (url.search) { respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }); return; }
            const projectId = segments[2]!;
            if (segments.length === 4 && request.method === 'GET') {
              respond(response, 200, await mediaUploads.assetStatus(principal, projectId,
                { mediaAssetId: request.headers['x-media-asset-id'] })); return;
            }
            if (segments.length === 4 && request.method === 'POST') {
              respond(response, 201, await mediaUploads.start(principal, projectId, await body(request))); return;
            }
            if (segments.length === 5 && segments[4] === 'revoke' && request.method === 'POST') {
              respond(response, 200, await mediaUploads.revoke(principal, projectId, await body(request))); return;
            }
            const uploadId = segments[4]!;
            if (segments.length === 5 && request.method === 'GET') {
              // The asset ID is carried in a header so status never accepts query keys or raw S3 locations.
              respond(response, 200, await mediaUploads.status(principal, projectId, uploadId,
                { mediaAssetId: request.headers['x-media-asset-id'] })); return;
            }
            if (segments.length === 6 && request.method === 'POST') {
              if (segments[5] === 'part') { respond(response, 200, await mediaUploads.part(principal, projectId, uploadId, await body(request))); return; }
              if (segments[5] === 'finalize') { respond(response, 200, await mediaUploads.finalize(principal, projectId, uploadId, await body(request))); return; }
              if (segments[5] === 'retry') { respond(response, 200, await mediaUploads.retryProcessing(principal, projectId, uploadId, await body(request))); return; }
              if (segments[5] === 'abort') { respond(response, 200, await mediaUploads.abort(principal, projectId, uploadId, await body(request))); return; }
            }
            respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }); return;
          }
          if (segments[3] === 'video-subtitles' && subtitles) {
            if (url.search) throw new RepositoryError('NOT_FOUND', 'Route not found');
            const projectId = segments[2]!;
            if (segments.length === 4 && request.method === 'POST') {
              respond(response, 201, await subtitles.upload(principal, projectId, subtitleUploadSchema.parse(await body(request)))); return;
            }
            if (segments.length === 6 && request.method === 'GET') {
              respond(response, 200, { tracks: await subtitles.list(principal, projectId, segments[4]!, segments[5]!) }); return;
            }
            if (segments.length === 5 && request.method === 'DELETE') {
              const input = z.strictObject({ expectedVersion: z.number().int().positive() }).parse(await body(request));
              respond(response, 200, await subtitles.remove(principal, projectId, segments[4]!, input.expectedVersion)); return;
            }
            throw new RepositoryError('NOT_FOUND', 'Route not found');
          }
          if (segments[3] === 'publication' && publication) {
            if (url.search || segments.length !== 6) { respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }); return; }
            const projectId = segments[2]!;
            const deploymentId = segments[4]!;
            const action = segments[5];
            if (action === 'status' && request.method === 'GET') { respond(response, 200, await publication.status(principal, projectId, deploymentId)); return; }
            if (action === 'current-summary' && request.method === 'GET') { respond(response, 200, await publication.currentSummary(principal, projectId, deploymentId)); return; }
            if (action === 'history' && request.method === 'GET') { respond(response, 200, await publication.history(principal, projectId, deploymentId)); return; }
            if (action === 'readiness' && request.method === 'POST') {
              const input = publicationSnapshotSchema.parse(await body(request));
              respond(response, 200, await publication.readiness(principal, { projectId, deploymentId, ...input })); return;
            }
            if (action === 'approve' && request.method === 'POST') {
              const input = publicationSnapshotSchema.parse(await body(request));
              respond(response, 201, await publication.approve(principal, { projectId, deploymentId, ...input })); return;
            }
            if (action === 'rollback' && request.method === 'POST') {
              const input = rollbackReviewSchema.parse(await body(request));
              respond(response, 201, { ...await publication.approve(principal, { projectId, deploymentId, ...input }),
                publicationRequired: true }); return;
            }
            if (action === 'publish' && request.method === 'POST') {
              const input = publishApprovalSchema.parse(await body(request));
              const result = await publication.publish(principal, projectId, deploymentId, input.approvalId);
              respond(response, 200, { releaseId: result.manifest.releaseId, sequence: result.manifest.releaseSequence,
                sha256: result.sha256, liveReleaseId: result.manifest.releaseId, nativeSubmission: 'separate' }); return;
            }
            respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }); return;
          }
          if (segments.length >= 4 && segments[3] === 'catalog' && catalog) {
            const projectId = segments[2]!;
            if (url.search || segments.length > 7) { respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }); return; }
            if (segments.length === 7 && segments[4] === 'media-assets' && segments[6] === 'rights-events' && request.method === 'GET') {
              respond(response, 200, { events: await catalog.rightsEvents(principal, projectId, segments[5]!) }); return;
            }
            if (segments.length === 4 && request.method === 'GET') { respond(response, 200, await catalog.read(principal, projectId)); return; }
            if (segments.length === 6 && segments[4] === 'imports' && request.method === 'POST') {
              await hostedRepository.read(principal, projectId);
              if (segments[5] === 'feed-preview') {
                const input = feedPreviewSchema.parse(await body(request));
                respond(response, 200, await catalog.previewFeed(principal, projectId, input.sourceId)); return;
              }
              if (segments[5] === 'feed-approve') {
                const input = feedApproveSchema.parse(await body(request));
                respond(response, 200, await catalog.approveImport(principal, projectId, input.sourceId, 'feed', input.content, input.expectedRevision, input.fingerprint)); return;
              }
              if (segments[5] === 'preview') {
                const input = filePreviewSchema.parse(await body(request));
                respond(response, 200, await catalog.previewImport(principal, projectId, input.sourceId, input.format, input.content)); return;
              }
              if (segments[5] === 'approve') {
                const input = fileApproveSchema.parse(await body(request));
                respond(response, 200, await catalog.approveImport(principal, projectId, input.sourceId, input.format, input.content, input.expectedRevision, input.fingerprint)); return;
              }
            }
            const kind = segments[4];
            if (kind && catalogKinds.includes(kind as CatalogKind)) {
              const typedKind = kind as CatalogKind;
              if (segments.length === 5 && request.method === 'GET') {
                const snapshot = await catalog.read(principal, projectId);
                const field = { sources: 'sources', items: 'items', 'media-assets': 'mediaAssets', collections: 'collections' }[typedKind] as keyof typeof snapshot;
                respond(response, 200, { revision: snapshot.revision, records: snapshot[field] }); return;
              }
              if (segments.length === 6 && request.method === 'GET') {
                const snapshot = await catalog.read(principal, projectId);
                const field = { sources: 'sources', items: 'items', 'media-assets': 'mediaAssets', collections: 'collections' }[typedKind] as 'sources' | 'items' | 'mediaAssets' | 'collections';
                const record = snapshot[field].find(value => value.id === segments[5]);
                if (!record) throw new RepositoryError('NOT_FOUND', 'Catalog record not found');
                respond(response, 200, { revision: snapshot.revision, record }); return;
              }
              if (segments.length === 5 && request.method === 'POST') {
                await hostedRepository.read(principal, projectId);
                const input = catalogWriteSchema.parse(await body(request));
                respond(response, 201, await catalog.mutate(principal, projectId, typedKind, 'POST', input.expectedRevision, input.record)); return;
              }
              if (segments.length === 6 && request.method === 'PUT') {
                await hostedRepository.read(principal, projectId);
                const input = catalogWriteSchema.parse(await body(request));
                respond(response, 200, await catalog.mutate(principal, projectId, typedKind, 'PUT', input.expectedRevision, input.record, segments[5])); return;
              }
              if (segments.length === 6 && request.method === 'DELETE') {
                await hostedRepository.read(principal, projectId);
                const input = catalogDeleteSchema.parse(await body(request));
                respond(response, 200, await catalog.mutate(principal, projectId, typedKind, 'DELETE', input.expectedRevision, undefined, segments[5])); return;
              }
            }
            respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }); return;
          }
          if (segments.length >= 4 && segments[3] === 'private-objects') {
            if (!privateObjects) { respond(response, 503, { error: { code: 'STORAGE_ERROR', message: 'Private storage unavailable' } }); return; }
            const projectId = segments[2]!;
            if (segments.length === 5 && segments[4] === 'audio' && !url.search && request.method === 'POST') {
              await hostedRepository.read(principal, projectId);
              const uploaded = await privateAudioBody(request);
              try {
                const { directory: _directory, durationSeconds: _duration, ...source } = uploaded;
                respond(response, 201, { ...await privateObjects.put(principal, projectId, 'media', 'audio/mpeg', source, true),
                  durationSeconds: uploaded.durationSeconds }); return;
              } finally { await rm(uploaded.directory, { recursive: true, force: true }); }
            }
            if (segments.length === 4 && !url.search && request.method === 'POST') {
              await hostedRepository.read(principal, projectId);
              const input = privatePutSchema.parse(await body(request));
              if (input.contentType === 'text/vtt') throw new RepositoryError('INVALID_INPUT', 'Use the subtitle track endpoint');
              respond(response, 201, await privateObjects.put(principal, projectId, input.kind, input.contentType, Buffer.from(input.contentBase64, 'base64'))); return;
            }
            if (segments.length === 5 && !url.search) {
              const objectId = segments[4]!;
              if (request.method === 'GET') { respond(response, 200, await privateObjects.metadata(principal, projectId, objectId)); return; }
              if (request.method === 'DELETE') { await privateObjects.delete(principal, projectId, objectId); respond(response, 200, { deleted: true }); return; }
            }
            if (segments.length === 6 && !url.search) {
              const objectId = segments[4]!;
              if (segments[5] === 'audio' && request.method === 'GET') {
                const range = request.headers.range;
                const match = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
                if (range && !match) throw new RepositoryError('INVALID_INPUT', 'Unsupported audio range');
                const start = match ? Number(match[1]) : 0;
                const end = match?.[2] ? Number(match[2]) : undefined;
                const part = await privateObjects.readAudioRange(principal, projectId, objectId, start, end);
                response.writeHead(206, { 'content-type': 'audio/mpeg', 'content-length': part.content.length,
                  'content-range': `bytes ${part.start}-${part.end}/${part.metadata.byteSize}`,
                  'accept-ranges': 'bytes', 'cache-control': 'private, no-store',
                  'x-content-type-options': 'nosniff', 'cross-origin-resource-policy': 'same-origin' });
                response.end(part.content); return;
              }
              if (segments[5] === 'capability' && request.method === 'POST') {
                z.strictObject({}).parse(await body(request));
                respond(response, 200, await privateObjects.issueDownload(principal, projectId, objectId)); return;
              }
              if (segments[5] === 'capability' && request.method === 'DELETE') { await privateObjects.revoke(principal, projectId, objectId); respond(response, 200, { revoked: true }); return; }
              if (segments[5] === 'content' && request.method === 'GET') {
                const downloaded = await privateObjects.download(principal, projectId, objectId, String(request.headers['x-private-capability'] ?? ''));
                response.writeHead(200, { 'content-type': downloaded.metadata.contentType, 'content-length': downloaded.content.length,
                  'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-disposition': 'attachment' });
                response.end(downloaded.content); return;
              }
            }
            respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }); return;
          }
          if (segments.length === 2 && !url.search && request.method === 'POST') { respond(response, 201, await hostedRepository.create(principal, await body(request))); return; }
          if (segments.length === 2 && !url.search && request.method === 'GET') { respond(response, 200, await hostedRepository.list(principal)); return; }
          if (segments.length === 3 && !url.search && request.method === 'GET') { respond(response, 200, await hostedRepository.read(principal, segments[2]!)); return; }
          if (segments.length === 4 && !url.search && segments[3] === 'deployment' && request.method === 'GET') {
            respond(response, 200, await hostedRepository.readDeployment(principal, segments[2]!)); return;
          }
          if (segments.length === 4 && !url.search && segments[3] === 'deployment' && request.method === 'POST') {
            const projectId = segments[2]!;
            const input = createDeploymentSchema.parse(await body(request));
            if (new URL(input.manifestEndpoint).origin === mode.auth.publicOrigin)
              throw new RepositoryError('INVALID_INPUT', 'TV resolver origin must differ from private Studio origin');
            respond(response, 201, await hostedRepository.createDeployment(principal, {
              schemaVersion: 1, id: `dep_${randomUUID().replaceAll('-', '')}`,
              creatorAccountId: principal.accountId, projectId, channelId: projectId,
              ...input, releaseControl: 'creator', consoleEvidence: { state: 'none' }
            })); return;
          }
          if (segments.length === 3 && !url.search && request.method === 'PUT') {
            await hostedRepository.read(principal, segments[2]!);
            const input = updateProjectSchema.parse(await body(request));
            respond(response, 200, await hostedRepository.update(principal, segments[2]!, input.expectedRevision, input.spec)); return;
          }
          if (segments.length === 4 && !url.search && segments[3] === 'mutations' && request.method === 'POST') {
            const current = await hostedRepository.read(principal, segments[2]!);
            const input = mutationRequestSchema.parse(await body(request));
            if (current.revision !== input.expectedRevision) throw new RepositoryError('CONFLICT', 'Project revision changed');
            respond(response, 200, await hostedRepository.update(principal, current.id, input.expectedRevision, applyMutation(current.spec, input.mutation))); return;
          }
          if (segments.length === 4 && !url.search && segments[3] === 'section-content' && projection && catalog && request.method === 'GET') {
            const id = segments[2]!;
            const [current, inventory] = await Promise.all([hostedRepository.read(principal, id), catalog.read(principal, id)]);
            const items = inventory.items.filter(item => item.kind === 'video' || item.kind === 'audio' || item.kind === 'book');
            const approvals = await hostedRepository.pool.query<{ item_id: string }>(`SELECT item_id FROM catalog_item_approvals
              WHERE project_id = $1 AND creator_account_id = $2 AND item_id = ANY($3::text[])`,
            [id, principal.accountId, items.map(item => item.id)]);
            const approved = new Set(approvals.rows.map(row => row.item_id));
            const selected = items.filter(item => approved.has(item.id)).slice(0, 500);
            const projected = selected.length ? await projection.project(principal, id, {
              expectedProjectRevision: current.revision, expectedCatalogRevision: inventory.revision,
              itemIds: selected.map(item => item.id), collectionIds: [] }) : null;
            const bindings = new Map(projected?.bindings.map(binding => [binding.catalogItemId, binding]));
            respond(response, 200, { projectRevision: current.revision, catalogRevision: inventory.revision,
              items: items.map(item => {
                const binding = bindings.get(item.id);
                const metadata = { ...item.sourceRecord.metadata, ...item.creatorOverrides };
                const reason = !approved.has(item.id) ? 'Catalog item needs approval' :
                  !binding ? 'Channel content limit reached' : binding.blockedReason === 'source_revoked' ? 'Source permission revoked' :
                  binding.blockedReason ? item.kind === 'audio' ? 'MP3 needs cleared public device delivery' : 'Playback rights or delivery unavailable' : undefined;
                return { itemId: item.id, contentId: binding?.contentId ?? `item_${createHash('sha256').update('catalog-content-v1\0').update(item.id).digest('hex').slice(0, 32)}`,
                  kind: item.kind, title: metadata.title, byline: item.kind === 'book' ? metadata.author : item.kind === 'audio' ? metadata.artist : undefined,
                  ...(reason ? { reason } : {}), ...(item.kind === 'book' && item.audiobook ? { audiobook: true } : {}) };
              }) }); return;
          }
          if (segments.length === 4 && !url.search && segments[3] === 'section-content' && projection && catalog && request.method === 'POST') {
            const id = segments[2]!;
            const input = sectionContentSchema.parse(await body(request));
            const [current, inventory] = await Promise.all([hostedRepository.read(principal, id), catalog.read(principal, id)]);
            if (current.revision !== input.expectedRevision || inventory.revision !== input.expectedCatalogRevision)
              throw new RepositoryError('CONFLICT', 'Channel or Library changed; review and retry');
            const item = input.selected ? inventory.items.find(value => value.id === input.itemId &&
              (value.kind === 'video' || value.kind === 'audio' || value.kind === 'book')) : undefined;
            if (input.selected && !item) throw new RepositoryError('NOT_FOUND', 'Catalog item not found');
            const contentId = item ? `item_${createHash('sha256').update('catalog-content-v1\0').update(item.id).digest('hex').slice(0, 32)}` : input.contentId;
            if (contentId !== input.contentId) throw new RepositoryError('INVALID_INPUT', 'Catalog content ID mismatch');
            const module = current.spec.pages.find(value => value.id === input.pageId)?.modules.find(value => value.id === input.moduleId);
            if (!module || (module.kind !== 'hero' && module.kind !== 'rail' && module.kind !== 'grid'))
              throw new RepositoryError('NOT_FOUND', 'Section not found');
            if (module.contentIds.includes(contentId) === input.selected) { respond(response, 200, current); return; }
            let baseline;
            if (input.selected) {
              const selected = await projection.project(principal, id, { expectedProjectRevision: current.revision,
                expectedCatalogRevision: inventory.revision, itemIds: [item!.id], collectionIds: [] });
              const binding = selected.bindings[0];
              if (!binding?.baseline || binding.contentId !== contentId)
                throw new RepositoryError('CONFLICT', 'Content needs cleared rights and public device delivery');
              baseline = binding.baseline;
            }
            const spec = changeSectionContent(current.spec, input.pageId, input.moduleId, contentId, input.selected, baseline);
            respond(response, 200, await hostedRepository.updateWithCatalogRevision(principal, id, current.revision,
              input.expectedCatalogRevision, spec)); return;
          }
          if (segments.length === 4 && !url.search && ['video-inclusion', 'media-inclusion'].includes(segments[3]!) && projection && catalog && request.method === 'POST') {
            const id = segments[2]!;
            const input = mediaInclusionSchema.parse(await body(request));
            const [current, inventory] = await Promise.all([hostedRepository.read(principal, id), catalog.read(principal, id)]);
            if (current.revision !== input.expectedRevision || inventory.revision !== input.expectedCatalogRevision)
              throw new RepositoryError('CONFLICT', 'Project or catalog changed; reopen this video');
            const item = inventory.items.find(value => value.id === input.itemId &&
              (segments[3] === 'media-inclusion' ? ['video', 'audio', 'book'].includes(value.kind) : value.kind === 'video'));
            if (!item) throw new RepositoryError('NOT_FOUND', 'Media item not found in this channel');
            const contentId = `item_${createHash('sha256').update('catalog-content-v1\0').update(item.id).digest('hex').slice(0, 32)}`;
            let spec = current.spec;
            if (input.action === 'remove') {
              if (spec.content.some(value => value.id === contentId)) spec = applyMutation(spec, { type: 'removeContent', contentId });
            } else {
              const source = inventory.sources.find(value => value.id === item.sourceRecord.sourceId);
              if (!source || source.permission.retrieval === 'revoked' || source.permission.tvDisplay === 'revoked')
                throw new RepositoryError('CONFLICT', 'Media source permission is unavailable');
              if (item.kind === 'video') {
                const playable = inventory.mediaAssets.find(value => item.mediaAssetIds.includes(value.id) &&
                  value.catalogItemId === item.id && value.kind === 'video' && value.location.type === 'managed_hls' &&
                  value.deliveryEligible && sourceUseEligible(source, value, 'television_playback'));
                if (!playable) throw new RepositoryError('CONFLICT', 'Video source or playback permission is unavailable');
              }
              const selected = await projection.project(principal, id, { expectedProjectRevision: current.revision,
                expectedCatalogRevision: inventory.revision, itemIds: [item.id], collectionIds: [] });
              const binding = selected.bindings[0];
              if (!binding?.baseline || binding.baseline.presentation !== (item.kind === 'book' ? 'information' : item.kind))
                throw new RepositoryError('CONFLICT', `${item.kind} is not ready with cleared rights and delivery`);
              if (!spec.content.some(value => value.id === contentId)) spec = applyMutation(spec, { type: 'addContent', content: binding.baseline });
              const placed = spec.pages.some(page => page.modules.some(module =>
                (module.kind === 'hero' || module.kind === 'rail' || module.kind === 'grid') && module.contentIds.includes(contentId)));
              if (!placed) {
                const home = spec.pages.find(page => page.id === spec.navigation[0]);
                if (!home) throw new RepositoryError('CONFLICT', 'Channel has no home page');
                const shelfTitles = new Set(inventory.collections.filter(collection => collection.itemIds.includes(item.id))
                  .map(collection => collection.title));
                const shelf = spec.pages.flatMap(page => page.modules.filter(module =>
                  (module.kind === 'rail' || module.kind === 'grid') && module.contentIds.length < 100 &&
                  shelfTitles.has(module.title)).map(module => ({ page, module })))[0];
                const targetPage = shelf?.page ?? home;
                const defaultTitle = item.kind === 'book' ? 'Books' : item.kind === 'audio' ? 'Audio' : 'Videos';
                const rail = shelf?.module ?? home.modules.find(module => module.kind === 'rail' && module.contentIds.length < 100 &&
                  (item.kind === 'video' || module.title === defaultTitle));
                if (rail && (rail.kind === 'rail' || rail.kind === 'grid')) spec = applyMutation(spec, { type: 'updateModule', pageId: targetPage.id,
                  module: { ...rail, contentIds: [...rail.contentIds, contentId] } });
                else spec = applyMutation(spec, { type: 'addModule', pageId: home.id,
                  module: { id: `mod_${createHash('sha256').update(`media-inclusion-v1\0${id}\0${item.kind}`).digest('hex').slice(0, 32)}`,
                    kind: 'rail', title: defaultTitle, contentIds: [contentId] } });
              }
            }
            respond(response, 200, spec === current.spec ? current : await hostedRepository.update(principal, id, current.revision, spec)); return;
          }
          if (segments.length === 4 && !url.search) {
            const id = segments[2]!;
            const action = segments[3];
            if (action === 'agent-status' && request.method === 'GET') { await hostedRepository.read(principal, id); respond(response, 200, status); return; }
            if (action === 'agent' && request.method === 'POST') {
              const current = await hostedRepository.read(principal, id);
              const input = agentRequestSchema.parse(await body(request));
              if (current.revision !== input.expectedRevision) throw new RepositoryError('CONFLICT', 'Project revision changed');
              if (!agent) { respond(response, 503, { error: { code: 'PROVIDER_UNAVAILABLE', message: status.message } }); return; }
              if (agent.provider.name !== 'mock' && !input.catalogSelection) { respond(response, 400, { error: { code: 'INVALID_INPUT', message: 'Explicit approved catalog selection is required for live agent requests' } }); return; }
              const groundingSnapshot = input.catalogSelection && projection ? agentCatalogGrounding(await projection.project(principal, current.id, {
                expectedProjectRevision: current.revision, ...input.catalogSelection
              })) : undefined;
              const grounding = groundingSnapshot && input.catalogSelection && projection ? {
                ...groundingSnapshot,
                authorize: async (before: typeof current.spec, after: typeof current.spec, revision: number) => {
                  const latest = await projection.project(principal, current.id, { expectedProjectRevision: revision, ...input.catalogSelection! });
                  agentCatalogGrounding(latest).authorize(before, after, revision);
                }
              } : groundingSnapshot;
              respond(response, 200, await agent.run(current, input.message, (spec, revision) => hostedRepository.update(principal, current.id, revision, spec), grounding)); return;
            }
            if (action === 'code' && request.method === 'GET') { respond(response, 200, await hostedWorkspace.overview(principal, id)); return; }
            if (action === 'code' && request.method === 'POST') { await hostedRepository.read(principal, id); z.strictObject({}).parse(await body(request)); respond(response, 200, await hostedWorkspace.generate(principal, id)); return; }
            if (action === 'build' && request.method === 'GET') { respond(response, 200, await hostedWorkspace.buildStatus(principal, id)); return; }
            if (action === 'build' && request.method === 'POST') { await hostedRepository.read(principal, id); z.strictObject({}).parse(await body(request)); respond(response, 200, await hostedWorkspace.build(principal, id)); return; }
            if (action === 'readiness' && request.method === 'GET') { respond(response, 200, await hostedWorkspace.readiness(principal, id)); return; }
            if (action === 'bundle' && request.method === 'POST') { await hostedRepository.read(principal, id); z.strictObject({}).parse(await body(request)); respond(response, 200, await hostedWorkspace.bundle(principal, id)); return; }
          }
          if (segments.length === 5 && segments[3] === 'code' && segments[4] === 'export' && !url.search && request.method === 'GET') {
            respond(response, 200, await hostedWorkspace.exportSource(principal, segments[2]!)); return;
          }
          if (segments.length === 5 && segments[3] === 'code' && segments[4] === 'file') {
            const id = segments[2]!;
            await hostedRepository.read(principal, id);
            if (request.method === 'GET') {
              const name = url.searchParams.get('path');
              if (url.searchParams.size !== 1 || !name) throw new ZodError([{ code: 'custom', path: [], message: 'Expected path' }]);
              respond(response, 200, await hostedWorkspace.read(principal, id, name)); return;
            }
            if (request.method === 'POST' && !url.search) {
              const input = saveSourceSchema.parse(await body(request));
              respond(response, 200, await hostedWorkspace.save(principal, id, input.path, input.content, input.expectedHash)); return;
            }
          }
          respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }); return;
        }
        respond(response, 503, { error: { code: 'HOSTED_STORAGE_UNAVAILABLE', message: 'Hosted project storage is not configured' } }); return;
      }
      if (mode?.mode !== 'local-legacy') { respond(response, 401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }); return; }
      if (!workspace) { respond(response, 503, { error: { code: 'STORAGE_ERROR', message: 'Local workspace unavailable' } }); return; }
      if ((url.search && !(segments.length === 5 && segments[3] === 'code' && segments[4] === 'file' && request.method === 'GET')) || segments[0] !== 'api' || segments[1] !== 'projects') {
        respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } }); return;
      }
      if (segments.length === 2 && request.method === 'POST') {
        respond(response, 201, await repository.create(createProjectSchema.parse(await body(request)))); return;
      }
      if (segments.length === 2 && request.method === 'GET') {
        respond(response, 200, await repository.list()); return;
      }
      if (segments.length === 3 && request.method === 'GET') {
        respond(response, 200, await repository.read(segments[2]!)); return;
      }
      if (segments.length === 4 && ['code', 'build', 'readiness', 'bundle'].includes(segments[3]!)) {
        const id = segments[2]!;
        const action = segments[3];
        if (action === 'code' && request.method === 'GET') { respond(response, 200, await workspace.overview(id)); return; }
        if (action === 'code' && request.method === 'POST') { z.strictObject({}).parse(await body(request)); respond(response, 200, await workspace.generate(id)); return; }
        if (action === 'build' && request.method === 'GET') { respond(response, 200, await workspace.buildStatus(id)); return; }
        if (action === 'build' && request.method === 'POST') { z.strictObject({}).parse(await body(request)); respond(response, 200, await workspace.build(id)); return; }
        if (action === 'readiness' && request.method === 'GET') { respond(response, 200, await workspace.readiness(id)); return; }
        if (action === 'bundle' && request.method === 'POST') { z.strictObject({}).parse(await body(request)); respond(response, 201, await workspace.bundle(id)); return; }
      }
      if (segments.length === 5 && segments[3] === 'code' && segments[4] === 'file') {
        if (request.method === 'POST') {
          const input = saveSourceSchema.parse(await body(request));
          respond(response, 200, await workspace.save(segments[2]!, input.path, input.content, input.expectedHash)); return;
        }
        if (request.method === 'GET') {
          const name = url.searchParams.get('path');
          if (url.searchParams.size !== 1 || !name) throw new ZodError([{ code: 'custom', path: [], message: 'Expected path' }]);
          respond(response, 200, await workspace.read(segments[2]!, name)); return;
        }
      }
      if (segments.length === 4 && segments[3] === 'agent-status' && request.method === 'GET') {
        await repository.read(segments[2]!);
        respond(response, 200, status); return;
      }
      if (segments.length === 4 && segments[3] === 'agent' && request.method === 'POST') {
        const input = agentRequestSchema.parse(await body(request));
        const current = await repository.read(segments[2]!);
        if (current.revision !== input.expectedRevision) throw new RepositoryError('CONFLICT', 'Project revision changed');
        if (!agent) { respond(response, 503, { error: { code: 'PROVIDER_UNAVAILABLE', message: status.message } }); return; }
        respond(response, 200, await agent.run(current, input.message, (spec, revision) => repository.update(current.id, revision, spec))); return;
      }
      if (segments.length === 3 && request.method === 'PUT') {
        const input = updateProjectSchema.parse(await body(request));
        respond(response, 200, await repository.update(segments[2]!, input.expectedRevision, input.spec)); return;
      }
      if (segments.length === 4 && segments[3] === 'mutations' && request.method === 'POST') {
        const input = mutationRequestSchema.parse(await body(request));
        const current = await repository.read(segments[2]!);
        if (current.revision !== input.expectedRevision) throw new RepositoryError('CONFLICT', 'Project revision changed');
        const spec = applyMutation(current.spec, input.mutation);
        respond(response, 200, await repository.update(current.id, input.expectedRevision, spec)); return;
      }
      respond(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
    } catch (error) {
      if (error instanceof ZodError) respond(response, 400, { error: { code: 'INVALID_INPUT', message: error.issues.map(issue => issue.message).join('; ').slice(0, 500) } });
      else if (error instanceof RepositoryError) respond(response, error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : error.code === 'INVALID_INPUT' ? 400 : 500, { error: { code: error.code, message: mode?.mode === 'hosted' && error.code === 'STORAGE_ERROR' ? 'Storage operation failed' : error.message } });
      else if (error instanceof Error && (error as NodeJS.ErrnoException).code) respond(response, 500, { error: { code: 'STORAGE_ERROR', message: 'Storage operation failed' } });
      else if (error instanceof Error) respond(response, mode?.mode === 'hosted' ? 500 : 400, { error: { code: mode?.mode === 'hosted' ? 'INTERNAL_ERROR' : 'INVALID_INPUT', message: mode?.mode === 'hosted' ? 'Request failed' : error.message.slice(0, 500) } });
      else respond(response, 500, { error: { code: 'STORAGE_ERROR', message: 'Internal error' } });
    }
  });
}
