import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { MockProvider, type AgentProvider } from '@firelaunch/agent';
import { createApi } from '../src/api.js';
import { ProjectRepository } from '../src/repository.js';

test('API agent uses persistence and optimistic revisions; deterministic editing still works', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'firelaunch-agent-api-'));
  const repository = new ProjectRepository(directory);
  const server = createApi(repository, new MockProvider(), { mode: 'local-legacy' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/projects`;
  const post = (url: string, data: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  try {
    const project = await (await post(base, { title: 'Nature' })).json();
    const status = await (await fetch(`${base}/${project.id}/agent-status`)).json();
    assert.equal(status.provider, 'mock');
    const response = await post(`${base}/${project.id}/agent`, { expectedRevision: 1, message: 'add page Explore' });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, 'completed');
    assert.equal(result.project.revision, 2);
    assert.equal(result.project.spec.pages[1].title, 'Explore');
    assert.equal((await new ProjectRepository(directory).read(project.id)).spec.pages[1]?.title, 'Explore');
    assert.equal((await post(`${base}/${project.id}/agent`, { expectedRevision: 1, message: 'add page Again' })).status, 409);
    const deterministic = await post(`${base}/${project.id}/mutations`, { expectedRevision: 2, mutation: { type: 'updatePage', pageId: result.project.spec.pages[1].id, title: 'Adventure' } });
    assert.equal(deterministic.status, 200);
    assert.equal((await deterministic.json()).spec.pages[1].title, 'Adventure');
    assert.equal((await post(`${base}/${project.id}/agent`, { expectedRevision: 3, message: '' })).status, 400);
  } finally {
    server.close(); await once(server, 'close');
    await rm(directory, { recursive: true, force: true });
  }
});

test('API refuses unsupported tool calls without mutating persisted project', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'firelaunch-agent-refusal-'));
  const repository = new ProjectRepository(directory);
  const provider: AgentProvider = { name: 'bedrock', async next() { return { text: '', calls: [{ id: 'bad', name: 'run_shell', input: { command: 'echo no' } }] }; } };
  const server = createApi(repository, provider, { mode: 'local-legacy' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const project = await repository.create({ title: 'Nature' });
    const response = await fetch(`http://127.0.0.1:${address.port}/api/projects/${project.id}/agent`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: 1, message: 'do something unsafe' }) });
    const result = await response.json();
    assert.equal(result.status, 'refused');
    assert.match(result.events.at(-1).text, /Unsupported tool/);
    assert.equal((await repository.read(project.id)).revision, 1);
  } finally {
    server.close(); await once(server, 'close');
    await rm(directory, { recursive: true, force: true });
  }
});
