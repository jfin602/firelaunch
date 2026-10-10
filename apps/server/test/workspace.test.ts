import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { doctor } from '@firelaunch/generator/doctor';
import { ProjectRepository } from '../src/repository.js';
import { WorkspaceService } from '../src/workspace.js';
import { createApi } from '../src/api.js';

async function fixture(action: (workspace: WorkspaceService, repository: ProjectRepository, id: string, directory: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'firelaunch-workspace-'));
  try {
    const repository = new ProjectRepository(root);
    const project = await repository.create({ title: 'Wild Earth' });
    await action(new WorkspaceService(repository), repository, project.id, path.join(root, 'projects', project.id));
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('generation, guarded text edits and regeneration never overwrite custom work', () => fixture(async (workspace, repository, id, directory) => {
  assert.equal((await workspace.overview(id)).generated, false);
  await workspace.generate(id);
  const original = await workspace.read(id, 'src/App.js');
  await assert.rejects(workspace.read(id, '../project.json'));
  await assert.rejects(workspace.read(id, '/etc/passwd'));
  await assert.rejects(workspace.save(id, 'src/App.js', 'bad', '0'.repeat(64)), { code: 'CONFLICT' });
  await workspace.save(id, 'src/App.js', `${original.content}\n// creator edit\n`, original.sha256);
  assert.deepEqual((await workspace.overview(id)).changed, ['src/App.js']);
  await assert.rejects(workspace.generate(id), { code: 'CONFLICT' });
  assert.match((await workspace.read(id, 'src/App.js')).content, /creator edit/);
  const current = await repository.read(id);
  await repository.update(id, current.revision, { ...current.spec, title: 'New Earth' });
  assert.equal((await workspace.overview(id)).stale, true);
  await assert.rejects(workspace.generate(id), { code: 'CONFLICT' });
  await writeFile(path.join(directory, 'generated/src/App.js'), original.content);
  await workspace.generate(id);
  assert.equal((await workspace.overview(id)).stale, false);
}));

test('source symlinks, unexpected paths, size and binary edits fail closed', () => fixture(async (workspace, _repository, id, directory) => {
  await workspace.generate(id);
  const source = path.join(directory, 'generated');
  await assert.rejects(workspace.save(id, 'src/../../project.json', 'x', '0'.repeat(64)));
  await assert.rejects(workspace.save(id, 'src/App.js', 'x'.repeat(256_001), '0'.repeat(64)));
  await mkdir(path.join(source, 'assets'));
  await writeFile(path.join(source, 'assets', 'logo.png'), Buffer.from([0, 1, 2]));
  assert.deepEqual((await workspace.overview(id)).changed, ['assets/logo.png']);
  await assert.rejects(workspace.save(id, 'assets/logo.png', 'x', '0'.repeat(64)));
  await rm(path.join(source, 'src/App.js'));
  await symlink('/etc/passwd', path.join(source, 'src/App.js'));
  await assert.rejects(workspace.read(id, 'src/App.js'), { code: 'STORAGE_ERROR' });
  await assert.rejects(workspace.generate(id), { code: 'STORAGE_ERROR' });
}));

test('blocked and simulated build evidence requires exit success, fresh release artifact and unchanged source', () => fixture(async (_workspace, repository, id, directory) => {
  const blocked = new WorkspaceService(repository);
  assert.equal((await blocked.build(id)).status, 'blocked');
  await blocked.generate(id);
  assert.equal((await blocked.build(id)).status, 'blocked');
  const cli = path.join(directory, 'vega');
  await writeFile(cli, 'fake executable');
  const originalPath = process.env.VEGA_CLI_PATH;
  process.env.VEGA_CLI_PATH = cli;
  try {
    const detected = doctor();
    const report = { ...detected, node: { available: true, detail: 'v24.15.0' }, npm: { available: true, detail: '12.2.0' },
      vegaSdk: { available: true, detail: 'test SDK' }, vegaCli: { available: true, detail: 'test CLI' } };
    const projectRoot = path.join(directory, 'generated');
    const reactNative = path.join(projectRoot, 'node_modules/.bin/react-native');
    await mkdir(path.dirname(reactNative), { recursive: true });
    await writeFile(reactNative, 'fake React Native CLI');
    const artifact = path.join(projectRoot, 'build/armv7-release/channel_armv7.vpkg');
    const failure = new WorkspaceService(repository, () => report, async () => ({ exitCode: 0, output: 'claimed success', durationMs: 10 }));
    assert.equal((await failure.build(id)).status, 'failed');
    assert.equal((await failure.buildStatus(id)).status, 'failed');
    const success = new WorkspaceService(repository, () => report, async (command, args, cwd) => {
      assert.equal(command, reactNative); assert.deepEqual(args, ['build-vega', '--build-type', 'Release']); assert.equal(cwd, projectRoot);
      await mkdir(path.dirname(artifact), { recursive: true });
      await writeFile(artifact, 'real bytes from test executor');
      return { exitCode: 0, output: 'built', durationMs: 10 };
    });
    const evidence = await success.build(id);
    assert.equal(evidence.status, 'succeeded');
    assert.equal(evidence.artifact?.bytes, 29);
    assert.match(evidence.artifact?.sha256 ?? '', /^[a-f0-9]{64}$/);
    assert.equal((await success.buildStatus(id)).status, 'succeeded');
    const current = await repository.read(id);
    await repository.update(id, current.revision, { ...current.spec, title: 'Revised Earth' });
    assert.equal((await success.buildStatus(id)).status, 'blocked');
    assert.match((await success.build(id)).reason ?? '', /stale/);
    assert.equal((await success.readiness(id)).checks.find(check => check.group === 'Build artifact')?.ready, false);
    await success.generate(id);
    await mkdir(path.dirname(reactNative), { recursive: true });
    await writeFile(reactNative, 'fake React Native CLI');
    assert.equal((await failure.build(id)).status, 'failed');
    const source = await success.read(id, 'src/App.js');
    await success.save(id, source.path, `${source.content}\nmodified`, source.sha256);
    assert.notEqual((await success.buildStatus(id)).status, 'succeeded');
  } finally { if (originalPath === undefined) delete process.env.VEGA_CLI_PATH; else process.env.VEGA_CLI_PATH = originalPath; }
}));

test('readiness and bundle distinguish automated evidence from creator Amazon actions', () => fixture(async (workspace, _repository, id) => {
  await workspace.generate(id);
  const checks = await workspace.readiness(id);
  assert.equal(checks.submitted, false);
  assert.equal(checks.checks.length, 8);
  assert.equal(checks.checks.find(check => check.group === 'Manifest/project')?.ready, true);
  assert.equal(checks.checks.find(check => check.group === 'Human Amazon steps')?.ready, false);
  const bundle = await workspace.bundle(id);
  assert.equal(bundle.submitted, false);
  assert.match(await readFile(path.join(bundle.path, 'checklist.md'), 'utf8'), /No Developer Console submission has occurred/);
  assert.match(await readFile(path.join(bundle.path, 'store-copy.md'), 'utf8'), /Wild Earth/);
  assert.match(await readFile(path.join(bundle.path, 'store-assets.md'), 'utf8'), /Capture Fire TV\/Vega device screenshots/);
  assert.equal(JSON.parse(await readFile(path.join(bundle.path, 'readiness.json'), 'utf8')).build.status, 'blocked');
}));

test('API exposes bounded source endpoints without arbitrary process or path input', () => fixture(async (_workspace, repository, id) => {
  const server = createApi(repository, undefined, { mode: 'local-legacy' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/projects/${id}`;
  try {
    const empty = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
    assert.equal((await fetch(`${base}/code`, empty)).status, 200);
    const bad = await fetch(`${base}/code/file`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '../../project.json', content: 'x', expectedHash: '0'.repeat(64) }) });
    assert.notEqual(bad.status, 200);
    assert.equal((await fetch(`${base}/build`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command: 'rm' }) })).status, 400);
    assert.equal((await fetch(`${base}/build`, empty)).status, 200);
    assert.equal((await fetch(`${base}/code/file?path=${encodeURIComponent('src/App.js')}`)).status, 200);
    assert.equal((await fetch(`${base}/code/file?path=../project.json`)).status, 400);
  } finally { server.close(); await once(server, 'close'); }
}));
