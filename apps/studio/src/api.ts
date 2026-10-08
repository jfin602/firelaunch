import { projectSchema, type ChannelProject } from '@firelaunch/contracts';
import type { ChannelMutation } from '@firelaunch/channel-engine';
import type { AgentResponse } from '@firelaunch/agent';

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

export async function agentStatus(id: string): Promise<{ provider: 'mock' | 'bedrock'; configured: boolean; message: string }> {
  return await request(`/${id}/agent-status`) as { provider: 'mock' | 'bedrock'; configured: boolean; message: string };
}

export async function askAgent(project: ChannelProject, message: string): Promise<AgentResponse> {
  const result = await request(`/${project.id}/agent`, json({ expectedRevision: project.revision, message })) as AgentResponse;
  return { ...result, project: projectSchema.parse(result.project) };
}
