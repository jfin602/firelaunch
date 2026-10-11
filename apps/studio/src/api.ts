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

export async function createProject(title: string): Promise<ChannelProject> {
  return projectSchema.parse(await request('', json({ title })));
}

export async function mutateProject(project: ChannelProject, mutation: ChannelMutation): Promise<ChannelProject> {
  return projectSchema.parse(await request(`/${project.id}/mutations`, json({ expectedRevision: project.revision, mutation })));
}

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
export const readiness = (id: string) => request(`/${id}/readiness`) as Promise<Readiness>;
export const createBundle = (id: string) => request(`/${id}/bundle`, json({})) as Promise<{ path?: string; files?: string[]; status?: 'blocked'; reason?: string; submitted: false }>;

import { catalogInventorySchema, type CatalogSource, type CatalogItem, type Collection, type MediaAsset } from '@firelaunch/contracts';
export type CatalogSnapshot = ReturnType<typeof catalogInventorySchema.parse> & { revision: number };
export type CatalogSelection = { expectedCatalogRevision: number; itemIds: string[]; collectionIds: string[] };
export type DraftChanges = { added: number; removed: number; updated: number; pages: string[]; notices: string[] };
export async function readCatalogDraft(id: string): Promise<{ creatorType: 'video' | 'audio' | 'writing'; selection: CatalogSelection } | null> {
  return await request(`/${id}/catalog-draft`) as { creatorType: 'video' | 'audio' | 'writing'; selection: CatalogSelection } | null;
}
export async function generateCatalogDraft(project: ChannelProject, creatorType: 'video' | 'audio' | 'writing', selection: CatalogSelection): Promise<{ project: ChannelProject; changes: DraftChanges }> {
  const result = await request(`/${project.id}/catalog-draft`, json({ creatorType, expectedRevision: project.revision, ...selection })) as { project: unknown; changes: DraftChanges };
  return { project: projectSchema.parse(result.project), changes: result.changes };
}
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
export async function deletePrivateObject(id: string, objectId: string): Promise<void> {
  await request(`/${id}/private-objects/${objectId}`, { method: 'DELETE' });
}

export async function readDeployment(id: string) {
  return channelDeploymentSchema.parse(await request(`/${id}/deployment`));
}
export type LiveStatus = { revisions: { channel: number; catalog: number }; liveReleaseId: string | null; liveSequence: number; approvalRequired: true; nativeSubmission: 'separate' };
export type ReleaseHistory = { liveReleaseId: string | null; releases: { id: string; sequence: number; sha256: string; publishedAt: string; previousReleaseId: string | null; rollbackSourceReleaseId: string | null }[] };
export type PublicationReview = { revisions: LiveStatus['revisions']; expectedLiveReleaseId: string | null; bindings: PublicationBindings; rollbackSourceReleaseId?: string };
const publicationPath = (projectId: string, deploymentId: string) => `/${projectId}/publication/${deploymentId}`;
export const readLiveStatus = (projectId: string, deploymentId: string) => request(`${publicationPath(projectId, deploymentId)}/status`) as Promise<LiveStatus>;
export const readReleaseHistory = (projectId: string, deploymentId: string) => request(`${publicationPath(projectId, deploymentId)}/history`) as Promise<ReleaseHistory>;
export const checkLiveReadiness = (projectId: string, deploymentId: string, review: PublicationReview) => request(`${publicationPath(projectId, deploymentId)}/readiness`, json(review));
export const approveLive = (projectId: string, deploymentId: string, review: PublicationReview) => request(`${publicationPath(projectId, deploymentId)}/${review.rollbackSourceReleaseId ? 'rollback' : 'approve'}`, json(review)) as Promise<{ approvalId: string }>;
export const publishLive = (projectId: string, deploymentId: string, approvalId: string) => request(`${publicationPath(projectId, deploymentId)}/publish`, json({ approvalId })) as Promise<{ releaseId: string; sequence: number }>;
