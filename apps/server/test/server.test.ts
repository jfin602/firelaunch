import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { ProjectRepository } from '../src/repository.js';
import { createApi } from '../src/api.js';

async function temporary<T>(action: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'firelaunch-test-'));
  try { return await action(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('repository persists, reopens, lists and rejects stale revisions', () => temporary(async root => {
  const repository = new ProjectRepository(root);
  const created = await repository.create({ title: 'Wild Earth' });
  assert.equal(created.revision, 1);
  const reopened = await new ProjectRepository(root).read(created.id);
  assert.deepEqual(reopened, created);
  const updated = await repository.update(created.id, 1, { ...created.spec, title: 'Wild Oceans' });
  assert.equal(updated.revision, 2);
  assert.equal((await repository.list())[0]?.spec.title, 'Wild Oceans');
  await assert.rejects(repository.update(created.id, 1, created.spec), { code: 'CONFLICT' });
  await assert.rejects(repository.update(created.id, 2, { ...created.spec, schemaVersion: 2 }));
  await assert.rejects(repository.read('../escape'));
}));

test('repository rejects a symlink in the configured data-root ancestry', () => temporary(async root => {
  const link = path.join(root, 'link');
  await symlink(path.join(root, 'elsewhere'), link);
  await assert.rejects(new ProjectRepository(path.join(link, 'data')).create({ title: 'Unsafe' }), { code: 'STORAGE_ERROR' });
}));

test('repository rejects symlink project/file escapes and corrupt records', () => temporary(async root => {
  const repository = new ProjectRepository(root);
  const created = await repository.create({ title: 'Wild Earth' });
  const directory = path.join(root, 'projects', created.id);
  await rm(path.join(directory, 'project.json'));
  await symlink('/etc/passwd', path.join(directory, 'project.json'));
  await assert.rejects(repository.read(created.id), { code: 'STORAGE_ERROR' });
  await rm(path.join(directory, 'project.json'));
  await writeFile(path.join(directory, 'project.json'), '{bad');
  await assert.rejects(repository.read(created.id), { code: 'STORAGE_ERROR' });
  await rm(directory, { recursive: true });
  await symlink('/tmp', directory);
  await assert.rejects(repository.read(created.id), { code: 'STORAGE_ERROR' });
}));

test('API creates, lists, reads, mutates and reports bounded failures', () => temporary(async root => {
  const server = createApi(new ProjectRepository(root), undefined, { mode: 'local-legacy' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/projects`;
  const request = (url: string, method = 'GET', value?: unknown) => fetch(url, {
    method, ...(value === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) })
  });
  try {
    const createdResponse = await request(base, 'POST', { title: 'Wild Earth' });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal((await (await request(base)).json()).length, 1);
    assert.equal((await (await request(`${base}/${created.id}`)).json()).id, created.id);
    const mutated = await request(`${base}/${created.id}/mutations`, 'POST', { expectedRevision: 1, mutation: { type: 'setIdentity', title: 'Wild Oceans', slug: 'wild-oceans' } });
    assert.equal(mutated.status, 200);
    assert.equal((await mutated.json()).revision, 2);
    assert.equal((await request(`${base}/${created.id}/mutations`, 'POST', { expectedRevision: 1, mutation: { type: 'setIdentity', title: 'Stale', slug: 'stale' } })).status, 409);
    const put = await request(`${base}/${created.id}`, 'PUT', { expectedRevision: 2, spec: { ...created.spec, title: 'New title' } });
    assert.equal(put.status, 200);
    assert.equal((await put.json()).revision, 3);
    assert.equal((await request(`${base}/%2e%2e/%2e%2e/etc/passwd`)).status, 404);
    assert.equal((await request(`${base}/${created.id}`, 'PUT', { expectedRevision: 3, spec: { ...created.spec, id: 'ch_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } })).status, 400);
    assert.equal((await request(base, 'POST', { title: 'No', extra: true })).status, 400);
    assert.equal((await request(base, 'POST', { title: 'Too big', padding: 'x'.repeat(1_000_000) })).status, 400);
  } finally { server.close(); await once(server, 'close'); }
}));
