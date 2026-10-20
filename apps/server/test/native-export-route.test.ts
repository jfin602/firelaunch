import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createApi } from '../src/api.js';
import { ProjectRepository, RepositoryError } from '../src/repository.js';
import type { HostedProjectRepository } from '../src/hosted-repository.js';
import type { ServerMode } from '../src/auth/config.js';
import { HostedWorkspaceService } from '../src/hosted-workspace.js';
import { NativeBuildQueue } from '../src/native-build-queue.js';
import type { ReleaseBuildInput } from '../src/release-build.js';

test('hosted export submits only the session owner snapshot and reports owned queue state', async t => {
  const owner = `cr_${'a'.repeat(32)}`;
  const foreign = `cr_${'b'.repeat(32)}`;
  const project = `ch_${'c'.repeat(32)}`;
  let principal = '';
  let csrf = false;
  let snapshotCalls = 0;
  let enqueued: ReleaseBuildInput | null = null;
  let state: 'queued' | 'running' | 'ready' | 'failed' | 'expired' = 'queued';
  const jobId = `job_${'d'.repeat(32)}`;
  const input = { format: 'firelaunch-vega-build-input-v1', creatorAccountId: owner,
    projectId: project, fingerprint: 'e'.repeat(64) } as ReleaseBuildInput;
  t.mock.method(HostedWorkspaceService.prototype, 'releaseBuildInput', async (caller, id) => {
    assert.equal(caller.accountId, owner); assert.equal(id, project); snapshotCalls++; return input;
  });
  t.mock.method(NativeBuildQueue.prototype, 'enqueue', async value => { enqueued = value; return jobId; });
  t.mock.method(NativeBuildQueue.prototype, 'latestStatus', async (accountId, id) => {
    assert.equal(accountId, owner); assert.equal(id, project);
    return enqueued ? { id: jobId, state, attempt: 1, errorCode: state === 'failed' ? 'SANDBOX_BUILD_FAILED' : null,
      artifactSha256: null, artifactBytes: null, expiresAt: '2026-10-21T00:00:00.000Z' } : null;
  });
  t.mock.method(NativeBuildQueue.prototype, 'status', async (accountId, id, requestedJobId) => {
    assert.equal(accountId, owner); assert.equal(id, project); assert.equal(requestedJobId, jobId);
    return { id: jobId, state, attempt: 1, errorCode: null, artifactSha256: null, artifactBytes: null,
      expiresAt: '2026-10-21T00:00:00.000Z' };
  });
  const hosted = { read: async (caller: { accountId: string }, id: string) => {
    if (caller.accountId !== owner || id !== project) throw new RepositoryError('NOT_FOUND', 'Project not found');
    return { id: project };
  }, pool: { query: async () => ({ rows: [], rowCount: 0 }) } } as unknown as HostedProjectRepository;
  const mode = { mode: 'hosted', auth: {
    session: () => principal ? { principal: { accountId: principal, issuer: 'test', subject: principal, email: 'test@example.com' }, csrf: 'valid' } : null,
    authorizedMutation: () => csrf
  } } as unknown as ServerMode;
  const server = createApi(new ProjectRepository('/tmp/firelaunch-export-unused'), undefined, mode, hosted);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server address unavailable');
  const url = `http://127.0.0.1:${address.port}/api/projects/${project}/export-app`;
  const post = () => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  try {
    assert.equal((await fetch(url)).status, 401);
    principal = owner;
    assert.equal((await post()).status, 403);
    csrf = true;
    assert.equal((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creatorAccountId: foreign, sourceFiles: { 'app.js': 'unsafe' }, command: 'npm run build' }) })).status, 400);
    assert.equal(snapshotCalls, 0);
    const status = await fetch(url);
    assert.equal(status.status, 200);
    const data = await status.json() as { status: string; downloadReady: boolean; reason: string };
    assert.equal(data.status, 'blocked'); assert.equal(data.downloadReady, false);
    assert.match(data.reason, /No native build/);
    const create = await post();
    assert.equal(create.status, 202);
    assert.equal((await create.json() as { job: { id: string } }).job.id, jobId);
    assert.equal(enqueued, input);
    assert.equal(snapshotCalls, 1);
    for (const [next, shown] of [['queued','queued'],['running','running'],['ready','ready'],
      ['failed','failed'],['expired','expired']] as const) {
      state = next;
      const result = await fetch(url);
      assert.equal(result.status, 200);
      const current = await result.json() as { status: string; job: { id: string; errorCode: string | null }; downloadReady: boolean };
      assert.equal(current.status, shown);
      assert.equal(current.job.id, jobId);
      assert.equal(current.downloadReady, false);
      assert.equal(current.job.errorCode, next === 'failed' ? 'SANDBOX_BUILD_FAILED' : null);
    }
    assert.equal((await fetch(`${url}/job_deadbeef/download`)).status, 404);
    principal = foreign;
    assert.equal((await fetch(url)).status, 404);
    assert.equal((await post()).status, 404);
    assert.equal((await fetch(`${url}/job_deadbeef/download`)).status, 404);
    assert.equal(snapshotCalls, 1);
  } finally { server.close(); await once(server, 'close'); }
});
