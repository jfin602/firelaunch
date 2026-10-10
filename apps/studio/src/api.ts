import { projectSchema, type ChannelProject } from '@firelaunch/contracts';
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
  if (response.status === 401) throw new ApiError('Sign in required', 401);
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

export async function agentStatus(id: string): Promise<{ provider: 'mock' | 'bedrock'; configured: boolean; message: string }> {
  return await request(`/${id}/agent-status`) as { provider: 'mock' | 'bedrock'; configured: boolean; message: string };
}

export async function askAgent(project: ChannelProject, message: string): Promise<AgentResponse> {
  const result = await request(`/${project.id}/agent`, json({ expectedRevision: project.revision, message })) as AgentResponse;
  return { ...result, project: projectSchema.parse(result.project) };
}

export type CodeOverview = { generated: boolean; files: string[]; changed: string[]; stale: boolean; path: string };
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
export const createBundle = (id: string) => request(`/${id}/bundle`, json({})) as Promise<{ path: string; files: string[]; submitted: false }>;
