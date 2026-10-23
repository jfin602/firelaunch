import { channelDeploymentSchema, projectSchema, type ChannelProject, type PublicationBindings } from '@firelaunch/contracts';
import type { ChannelMutation } from '@firelaunch/channel-engine';
import type { AgentResponse } from '@firelaunch/agent';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export type StudioSession = { accountId: string; email: string; csrfToken: string; expiresAt: string };
let csrfToken: string | null = null;

export async function getSession(): Promise<StudioSession | null> {
  const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
  if (response.status === 404) return null; // Explicit local legacy server.
  if (response.status === 401) { csrfToken = null; window.dispatchEvent(new window.Event('firelaunch-session-expired')); throw new ApiError('Sign in required', 401); }
  if (!response.ok) throw new ApiError('Session unavailable', response.status);
  const session = await response.json() as StudioSession;
  csrfToken = session.csrfToken;
  return session;
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: csrfToken ? { 'x-csrf-token': csrfToken } : {} });
  if (!response.ok) throw new ApiError('Could not sign out', response.status);
  csrfToken = null;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/projects${path}`, { ...init, credentials: 'same-origin', headers: { ...init?.headers, ...(csrfToken && init?.method && init.method !== 'GET' ? { 'x-csrf-token': csrfToken } : {}) } });
  const data: unknown = await response.json();
  if (!response.ok) {
    if (response.status === 401) { csrfToken = null; window.dispatchEvent(new window.Event('firelaunch-session-expired')); }
    const error = data as { error?: { message?: string } };
    throw new ApiError(error.error?.message ?? `Request failed (${response.status})`, response.status);
  }
  return data;
}

const json = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });

export async function listProjects(): Promise<ChannelProject[]> {
  const data = await request('');
  return projectSchema.array().parse(data);
}

export async function getProject(id: string): Promise<ChannelProject> {
  return projectSchema.parse(await request(`/${encodeURIComponent(id)}`));
}

export async function createProject(title: string, id?: string): Promise<ChannelProject> {
  return projectSchema.parse(await request('', json({ title, ...(id ? { id } : {}) })));
}

export async function mutateProject(project: ChannelProject, mutation: ChannelMutation): Promise<ChannelProject> {
  return projectSchema.parse(await request(`/${project.id}/mutations`, json({ expectedRevision: project.revision, mutation })));
}
export async function setVideoInclusion(project: ChannelProject, catalogRevision: number, itemId: string,
  action: 'publish' | 'remove'): Promise<ChannelProject> {
  return projectSchema.parse(await request(`/${project.id}/video-inclusion`, json({
    expectedRevision: project.revision, expectedCatalogRevision: catalogRevision, itemId, action
  })));
}
export async function setMediaInclusion(project: ChannelProject, catalogRevision: number, itemId: string,
  action: 'publish' | 'remove'): Promise<ChannelProject> {
  return projectSchema.parse(await request(`/${project.id}/media-inclusion`, json({
    expectedRevision: project.revision, expectedCatalogRevision: catalogRevision, itemId, action
  })));
}
export type SectionCandidate = { itemId: string; contentId: string; kind: 'video' | 'audio' | 'book';
  title: string; byline?: string; reason?: string; audiobook?: boolean };
export type SectionCandidates = { projectRevision: number; catalogRevision: number; items: SectionCandidate[] };
export const readSectionCandidates = (projectId: string) =>
  request(`/${projectId}/section-content`) as Promise<SectionCandidates>;
export const setSectionContent = (project: ChannelProject, catalogRevision: number, pageId: string,
  moduleId: string, itemId: string, contentId: string, selected: boolean) =>
  request(`/${project.id}/section-content`, json({ expectedRevision: project.revision,
    expectedCatalogRevision: catalogRevision, pageId, moduleId, contentId,
    ...(itemId.startsWith('ci_') ? { itemId } : {}), selected })) as Promise<ChannelProject>;

export async function agentStatus(id: string): Promise<{ provider: string; configured: boolean; message: string }> {
  return await request(`/${id}/agent-status`) as { provider: string; configured: boolean; message: string };
}

export async function askAgent(project: ChannelProject, message: string, catalogSelection?: { expectedCatalogRevision: number; itemIds: string[]; collectionIds: string[] }): Promise<AgentResponse> {
  const result = await request(`/${project.id}/agent`, json({ expectedRevision: project.revision, message, ...(catalogSelection ? { catalogSelection } : {}) })) as AgentResponse;
  return { ...result, project: projectSchema.parse(result.project) };
}

export type CodeOverview = { generated: boolean; files: string[]; changed: string[]; stale: boolean; path: string | null };
export type SourceFile = { path: string; content: string; sha256: string };
export type BuildEvidence = { status: 'blocked' | 'failed' | 'succeeded'; reason?: string; command?: string[]; exitCode?: number | null; durationMs?: number; output?: string; artifact?: { path: string; sha256: string; bytes: number }; toolchain: { missing: string[]; node: { detail: string }; npm: { detail: string }; vegaSdk: { detail: string }; vegaCli: { detail: string }; device: { detail: string } } };
export type Readiness = { checks: { group: string; ready: boolean; detail: string }[]; copy: { appName: string; shortDescription: string; longDescription: string; releaseNotes: string }; assets: { artwork: string[]; unresolvedLocal: string[]; screenshots: string[] }; build: BuildEvidence; submitted: false };
export const codeOverview = (id: string) => request(`/${id}/code`) as Promise<CodeOverview>;
export const generateCode = (id: string) => request(`/${id}/code`, json({})) as Promise<CodeOverview>;
export const readSource = (id: string, path: string) => request(`/${id}/code/file?path=${encodeURIComponent(path)}`) as Promise<SourceFile>;
export const saveSource = (id: string, file: SourceFile, content: string) => request(`/${id}/code/file`, json({ path: file.path, expectedHash: file.sha256, content })) as Promise<SourceFile>;
export const buildStatus = (id: string) => request(`/${id}/build`) as Promise<BuildEvidence>;
export const runBuild = (id: string) => request(`/${id}/build`, json({})) as Promise<BuildEvidence>;
export type NativeExportStatus = { status: 'blocked' | 'queued' | 'running' | 'ready' | 'failed' | 'canceled' | 'expired'; reason?: string;
  job: { id: string; attempt?: number; errorCode?: string | null; expiresAt?: string; createdAt?: string;
    completedAt?: string | null; artifactBytes?: number | null; packageId?: string | null;
    deploymentId?: string | null; release?: { releaseId: string; sequence: number } | null } | null; downloadReady: boolean };
export const nativeExportStatus = (id: string) => request(`/${encodeURIComponent(id)}/export-app`) as Promise<NativeExportStatus>;
export const requestNativeBuild = (id: string) => request(`/${encodeURIComponent(id)}/export-app`, json({})) as Promise<NativeExportStatus>;
export async function downloadNativeExport(projectId: string, jobId: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/export-app/${encodeURIComponent(jobId)}/download`,
    { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new ApiError(data?.error?.message ?? 'ZIP download is unavailable. Refresh the build status.', response.status);
  }
  if (response.headers.get('content-type')?.split(';')[0] !== 'application/zip')
    throw new ApiError('The server did not return a Vega ZIP.', 502);
  const filename = response.headers.get('content-disposition')?.match(/filename="([a-zA-Z0-9._-]+\.zip)"/)?.[1] ?? 'firelaunch-vega-release.zip';
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export const readiness = (id: string) => request(`/${id}/readiness`) as Promise<Readiness>;
export const createBundle = (id: string) => request(`/${id}/bundle`, json({})) as Promise<{ path?: string; files?: string[]; status?: 'blocked'; reason?: string; submitted: false }>;

import { catalogInventorySchema, type CatalogSource, type CatalogItem, type Collection, type MediaAsset } from '@firelaunch/contracts';
export type CatalogSnapshot = ReturnType<typeof catalogInventorySchema.parse> & { revision: number };
export type CatalogSelection = { expectedCatalogRevision: number; itemIds: string[]; collectionIds: string[] };
export type ImportPreview = { sourceId: string; format: 'csv' | 'json' | 'feed'; revision: number; fingerprint: string; content?: string; rows: { line: number; externalId: string; kind: CatalogItem['kind']; metadata: { title: string }; action: 'create' | 'update' | 'unchanged' | 'ambiguous' }[]; issues: { line: number; code: string; message: string }[] };
export const readCatalog = async (id: string): Promise<CatalogSnapshot> => {
  const data = await request(`/${id}/catalog`) as CatalogSnapshot;
  const { revision, ...inventory } = data;
  return { ...catalogInventorySchema.parse(inventory), revision };
};
export type CatalogKind = 'sources' | 'items' | 'collections' | 'media-assets';
export async function writeCatalog(id: string, kind: CatalogKind, revision: number, record: object, recordId?: string): Promise<{ revision: number; record: CatalogSource | CatalogItem | Collection | MediaAsset }> {
  return await request(`/${id}/catalog/${kind}${recordId ? `/${recordId}` : ''}`, { ...json({ expectedRevision: revision, record }), method: recordId ? 'PUT' : 'POST' }) as { revision: number; record: CatalogSource | CatalogItem | Collection | MediaAsset };
}
export async function deleteCatalogRecord(id: string, kind: CatalogKind, revision: number, recordId: string): Promise<void> {
  await request(`/${id}/catalog/${kind}/${recordId}`, { ...json({ expectedRevision: revision }), method: 'DELETE' });
}
export async function previewCatalogImport(id: string, sourceId: string, format: 'csv' | 'json' | 'feed', content?: string): Promise<ImportPreview> {
  return await request(`/${id}/catalog/imports/${format === 'feed' ? 'feed-preview' : 'preview'}`, json(format === 'feed' ? { sourceId } : { sourceId, format, content })) as ImportPreview;
}
export async function approveCatalogImport(id: string, preview: ImportPreview, content: string): Promise<{ revision: number; created: number; updated: number; unchanged: number }> {
  return await request(`/${id}/catalog/imports/${preview.format === 'feed' ? 'feed-approve' : 'approve'}`, json({ sourceId: preview.sourceId, ...(preview.format === 'feed' ? {} : { format: preview.format }), content, expectedRevision: preview.revision, fingerprint: preview.fingerprint })) as { revision: number; created: number; updated: number; unchanged: number };
}
export async function uploadPrivateMedia(id: string, file: File): Promise<{ id: string; contentType: string }> {
  if (file.size > 1_000_000 || !['image/png', 'image/jpeg', 'video/mp4', 'audio/mpeg'].includes(file.type)) throw new ApiError('Choose a PNG, JPEG, MP4 or MP3 under 1 MB.', 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return await request(`/${id}/private-objects`, json({ kind: 'media', contentType: file.type, contentBase64: btoa(binary) })) as { id: string; contentType: string };
}

export async function uploadPrivateAudio(id: string, file: File): Promise<{ id: string; contentType: string; byteSize: number; sha256: string }> {
  if (file.type !== 'audio/mpeg' || !/\.mp3$/i.test(file.name) || file.size < 1 || file.size > 320_000_000)
    throw new ApiError('Choose an MP3 file under 320 MB and two hours.', 400);
  return await request(`/${id}/private-objects/audio`, {
    method: 'POST', headers: { 'content-type': 'audio/mpeg' }, body: file
  }) as { id: string; contentType: string; byteSize: number; sha256: string };
}

export type SubtitleTrack = { id: string; itemId: string; videoAssetId: string; objectId: string; language: string; format: 'text/vtt'; byteSize: number; sha256: string; version: number; state: 'active' };
export async function listVideoSubtitles(projectId: string, itemId: string, videoAssetId: string): Promise<SubtitleTrack[]> {
  const result = await request(`/${projectId}/video-subtitles/${itemId}/${videoAssetId}`) as { tracks: SubtitleTrack[] };
  return result.tracks;
}
export async function uploadVideoSubtitle(projectId: string, itemId: string, videoAssetId: string, language: string, file: File,
  prior?: SubtitleTrack): Promise<SubtitleTrack> {
  if (file.size < 15 || file.size > 262144 || !file.name.toLowerCase().endsWith('.vtt')) throw new ApiError('Choose a WebVTT .vtt file under 256 KB.', 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return await request(`/${projectId}/video-subtitles`, json({ itemId, videoAssetId, language, contentBase64: btoa(binary),
    expectedVersion: prior?.version ?? 0, ...(prior ? { replaceTrackId: prior.id } : {}) })) as SubtitleTrack;
}
export async function removeVideoSubtitle(projectId: string, track: SubtitleTrack): Promise<void> {
  await request(`/${projectId}/video-subtitles/${track.id}`, { ...json({ expectedVersion: track.version }), method: 'DELETE' });
}

export async function uploadPrivateEvidence(id: string, file: File): Promise<{ id: string; contentType: string }> {
  if (file.size > 700_000 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type))
    throw new ApiError('Choose a PDF, PNG or JPEG evidence file under 700 KB.', 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return await request(`/${id}/private-objects`, json({ kind: 'evidence', contentType: file.type,
    contentBase64: btoa(binary) })) as { id: string; contentType: string };
}
export async function deletePrivateObject(id: string, objectId: string): Promise<void> {
  await request(`/${id}/private-objects/${objectId}`, { method: 'DELETE' });
}
export async function readPrivateObjectMetadata(id: string, objectId: string): Promise<{ id: string; byteSize: number; sha256: string; contentType: string }> {
  return await request(`/${id}/private-objects/${objectId}`) as { id: string; byteSize: number; sha256: string; contentType: string };
}
export async function readPrivateThumbnail(id: string, objectId: string, signal?: AbortSignal): Promise<Blob> {
  const capability = await request(`/${id}/private-objects/${objectId}/capability`, { ...json({}), ...(signal ? { signal } : {}) }) as { capability: string };
  if (signal?.aborted) throw new DOMException('Artwork request canceled', 'AbortError');
  const response = await fetch(`/api/projects/${encodeURIComponent(id)}/private-objects/${encodeURIComponent(objectId)}/content`, {
    credentials: 'same-origin', headers: { 'x-private-capability': capability.capability }, cache: 'no-store', ...(signal ? { signal } : {})
  });
  if (!response.ok) throw new ApiError('Thumbnail preview unavailable', response.status);
  const contentType = response.headers.get('content-type');
  const blob = await response.blob();
  if (!['image/png', 'image/jpeg'].includes(contentType ?? '') || blob.size < 1 || blob.size > 1_000_000)
    throw new ApiError('Thumbnail preview unavailable', 400);
  return blob;
}

export type VideoUploadStatus = { id: string; state: 'initiated' | 'completed' | 'verified' | 'aborting' | 'expiring' | 'aborted' | 'expired'; expectedBytes: number; expiresAt: string; partSize: number; partCount: number; verification: 'unverified' | 'pending_sha256' | 'sha256_verified'; processingAvailable?: boolean; processing?: { state: 'pending' | 'leased' | 'ready' | 'failed' | 'revoked'; failureCode: string | null } | null };
export const startVideoUpload = (projectId: string, input: { mediaAssetId: string; idempotencyKey: string; fileName: string; contentType: 'video/mp4'; expectedBytes: number; expectedSha256: string; claimedDurationSeconds: number }) =>
  request(`/${projectId}/media-uploads`, json(input)) as Promise<VideoUploadStatus>;
export const videoUploadPart = (projectId: string, uploadId: string, mediaAssetId: string, partNumber: number) =>
  request(`/${projectId}/media-uploads/${uploadId}/part`, json({ mediaAssetId, partNumber })) as Promise<{ url: string; contentLength: number; expiresInSeconds: number }>;
export const finalizeVideoUpload = (projectId: string, uploadId: string, mediaAssetId: string, parts: { partNumber: number; etag: string }[]) =>
  request(`/${projectId}/media-uploads/${uploadId}/finalize`, json({ mediaAssetId, parts })) as Promise<VideoUploadStatus>;
export const abortVideoUpload = (projectId: string, uploadId: string, mediaAssetId: string) =>
  request(`/${projectId}/media-uploads/${uploadId}/abort`, json({ mediaAssetId })) as Promise<VideoUploadStatus>;
export const retryVideoProcessing = (projectId: string, uploadId: string, mediaAssetId: string) =>
  request(`/${projectId}/media-uploads/${uploadId}/retry`, json({ mediaAssetId })) as Promise<VideoUploadStatus>;
export const readVideoUpload = (projectId: string, uploadId: string, mediaAssetId: string) =>
  request(`/${projectId}/media-uploads/${uploadId}`, { headers: { 'x-media-asset-id': mediaAssetId } }) as Promise<VideoUploadStatus>;
export type VideoAssetStatus = { uploadId: string; uploadState: VideoUploadStatus['state']; processingAvailable?: boolean; processing: VideoUploadStatus['processing'] } | null;
export const readVideoAssetStatus = (projectId: string, mediaAssetId: string) =>
  request(`/${projectId}/media-uploads`, { headers: { 'x-media-asset-id': mediaAssetId } }) as Promise<VideoAssetStatus>;
export const revokeVideoAsset = (projectId: string, mediaAssetId: string) =>
  request(`/${projectId}/media-uploads/revoke`, json({ mediaAssetId })) as Promise<{ revoked: true }>;

export async function readDeployment(id: string) {
  return channelDeploymentSchema.parse(await request(`/${id}/deployment`));
}
export async function createDeployment(id: string, input: { appName: string; packageId: string; manifestEndpoint: string;
  nativeReleaseApproval: 'creator_approved' }) {
  return channelDeploymentSchema.parse(await request(`/${id}/deployment`, json(input)));
}
export type LiveStatus = { revisions: { channel: number; catalog: number }; liveReleaseId: string | null; liveSequence: number; approvalRequired: true; nativeSubmission: 'separate' };
export type ReleaseHistory = { liveReleaseId: string | null; releases: { id: string; sequence: number; sha256: string; publishedAt: string; previousReleaseId: string | null; rollbackSourceReleaseId: string | null }[] };
export type PublicationReview = { revisions: LiveStatus['revisions']; expectedLiveReleaseId: string | null; bindings: PublicationBindings; rollbackSourceReleaseId?: string };
const publicationPath = (projectId: string, deploymentId: string) => `/${projectId}/publication/${deploymentId}`;
export const readLiveStatus = (projectId: string, deploymentId: string) => request(`${publicationPath(projectId, deploymentId)}/status`) as Promise<LiveStatus>;
export type LiveSummary = { releaseId: string; sequence: number; revisions: { channel: number; catalog: number }; catalogItemIds: string[] } | null;
export const readLiveSummary = (projectId: string, deploymentId: string) => request(`${publicationPath(projectId, deploymentId)}/current-summary`) as Promise<LiveSummary>;
export const readReleaseHistory = (projectId: string, deploymentId: string) => request(`${publicationPath(projectId, deploymentId)}/history`) as Promise<ReleaseHistory>;
export const checkLiveReadiness = (projectId: string, deploymentId: string, review: PublicationReview) => request(`${publicationPath(projectId, deploymentId)}/readiness`, json(review));
export const approveLive = (projectId: string, deploymentId: string, review: PublicationReview) => request(`${publicationPath(projectId, deploymentId)}/${review.rollbackSourceReleaseId ? 'rollback' : 'approve'}`, json(review)) as Promise<{ approvalId: string }>;
export const publishLive = (projectId: string, deploymentId: string, approvalId: string) => request(`${publicationPath(projectId, deploymentId)}/publish`, json({ approvalId })) as Promise<{ releaseId: string; sequence: number }>;
