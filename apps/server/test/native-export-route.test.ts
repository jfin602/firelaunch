import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createApi } from '../src/api.js';
import { ProjectRepository, RepositoryError } from '../src/repository.js';
import type { HostedProjectRepository } from '../src/hosted-repository.js';
import type { ServerMode } from '../src/auth/config.js';

test('hosted export stays blocked while no isolated worker exists; auth, CSRF and owner checks precede it', async () => {
  const owner = `cr_${'a'.repeat(32)}`;
  const foreign = `cr_${'b'.repeat(32)}`;
  const project = `ch_${'c'.repeat(32)}`;
  let principal = '';
  let csrf = false;
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
    const status = await fetch(url);
    assert.equal(status.status, 200);
    const data = await status.json() as { status: string; downloadReady: boolean; reason: string };
    assert.equal(data.status, 'blocked'); assert.equal(data.downloadReady, false);
    assert.match(data.reason, /separately isolated Vega build worker/);
    const create = await post();
    assert.equal(create.status, 503);
    assert.equal((await fetch(`${url}/job_deadbeef/download`)).status, 404);
    principal = foreign;
    assert.equal((await fetch(url)).status, 404);
    assert.equal((await post()).status, 404);
    assert.equal((await fetch(`${url}/job_deadbeef/download`)).status, 404);
  } finally { server.close(); await once(server, 'close'); }
});
