import { projectSchema, type ChannelProject } from '@firelaunch/contracts';
import type { ChannelMutation } from '@firelaunch/channel-engine';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/projects${path}`, init);
  const data: unknown = await response.json();
  if (!response.ok) {
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
