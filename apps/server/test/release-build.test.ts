import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateProject } from '@firelaunch/generator';
import type { ChannelDeployment, ChannelProject } from '@firelaunch/contracts';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import { HostedWorkspaceService } from '../src/hosted-workspace.js';
import type { HostedProjectRepository } from '../src/hosted-repository.js';
import type { PublicationRepository } from '../src/publication-repository.js';
import { createReleaseBuildInput, materializeReleaseBuildInput, produceIsolatedRelease,
  RELEASE_BUILD_COMMAND, releaseBuildCommand, DEPENDENCY_LOCK_COMMAND, DEPENDENCY_INSTALL_COMMAND, type StoredSource } from '../src/release-build.js';

const spec = fixtureChannel();
const owner = { accountId: `cr_${'b'.repeat(32)}`, issuer: 'https://issuer.test', subject: 'owner', email: 'owner@test.invalid' };
const foreign = { ...owner, accountId: `cr_${'c'.repeat(32)}`, subject: 'foreign' };
const project: ChannelProject = { id: spec.id, spec, revision: 3,
  createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z' };
const deployment: ChannelDeployment = { schemaVersion: 1, id: `dep_${'a'.repeat(32)}`,
  creatorAccountId: owner.accountId, projectId: spec.id, channelId: spec.id,
  appName: 'Creator channel', packageId: 'com.creator.channel', releaseControl: 'creator',
  nativeReleaseApproval: 'creator_approved',
  manifestEndpoint: `https://channels.creator.tv/public/v1/deployments/dep_${'a'.repeat(32)}/current`,
  consoleEvidence: { state: 'none' } };
const release = { releaseId: `rel_${'d'.repeat(32)}`, sequence: 1,
  revisions: { channel: project.revision, catalog: 0 }, catalogItemIds: [] as string[] };
async function stored(): Promise<StoredSource> {
  const generated = await generateProject(spec, deployment);
  const files = Object.fromEntries(generated.files);
  return { specRevision: project.revision, fingerprint: generated.fingerprint,
    files, baseline: { ...files } };
}

test('hosted source exposes the pinned player as read-only code', async () => {
  const source = await stored();
  const repository = { async read() { return project; }, async source() { return source; } } as unknown as HostedProjectRepository;
  const workspace = new HostedWorkspaceService(repository);
  const vendor = await workspace.read(owner, project.id, 'src/hlsjs/hls.mjs');
  assert.ok(vendor.content.length > 256_000);
  await assert.rejects(workspace.save(owner, project.id, vendor.path, 'modified', vendor.sha256), { code: 'INVALID_INPUT' });
  source.files[vendor.path] += '\n// changed\n';
  await assert.rejects(workspace.read(owner, project.id, vendor.path), { code: 'STORAGE_ERROR' });
});

test('creator build input pins published deployment and preserves safe edited source', async () => {
  const source = await stored();
  source.files['src/App.js'] += '\n// creator edit\n';
  const input = await createReleaseBuildInput(project, source, deployment, release, owner.accountId);
  assert.equal(input.creatorAccountId, owner.accountId);
  assert.equal(input.publishedRelease.releaseId, release.releaseId);
  assert.equal(input.files['src/App.js'], source.files['src/App.js']);
  assert.equal(input.manifestEndpoint, deployment.manifestEndpoint);
  const originBound = await createReleaseBuildInput(project, source,
    { ...deployment, manifestEndpoint: 'https://channels.creator.tv/' }, release, owner.accountId);
  assert.equal(originBound.manifestEndpoint, deployment.manifestEndpoint);
  assert.equal(originBound.fingerprint, input.fingerprint);
  assert.equal(input.packageId, deployment.packageId);
  assert.deepEqual(RELEASE_BUILD_COMMAND, ['./node_modules/.bin/react-native', 'build-vega', '--target', 'x86_64', '--build-type', 'Release']);
  assert.deepEqual(releaseBuildCommand(input), [...RELEASE_BUILD_COMMAND, '--build-number', '1']);
  const dir = await mkdtemp(join(tmpdir(), 'firelaunch-release-input-'));
  try {
    await materializeReleaseBuildInput(input, dir);
    assert.equal(await readFile(join(dir, 'src/App.js'), 'utf8'), source.files['src/App.js']);
    await assert.rejects(materializeReleaseBuildInput(input, dir), { code: 'CONFLICT' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('stale, missing, foreign binding and absent publication fail closed', async () => {
  const source = await stored();
  await assert.rejects(createReleaseBuildInput(project, null, deployment, release, owner.accountId), { code: 'CONFLICT' });
  await assert.rejects(createReleaseBuildInput(project, source, deployment, null, owner.accountId), { code: 'CONFLICT' });
  await assert.rejects(createReleaseBuildInput({ ...project, revision: 4 }, source, deployment, release, owner.accountId), { code: 'CONFLICT' });
  await assert.rejects(createReleaseBuildInput(project, source, { ...deployment, creatorAccountId: foreign.accountId }, release, owner.accountId), { code: 'CONFLICT' });
  await assert.rejects(createReleaseBuildInput(project, source, { ...deployment, manifestEndpoint: 'https://channels.example.org/' }, release, owner.accountId), { code: 'INVALID_INPUT' });
  const missing = await stored(); delete missing.files['src/App.js'];
  await assert.rejects(createReleaseBuildInput(project, missing, deployment, release, owner.accountId), { code: 'CONFLICT' });
  const changed = await stored();
  changed.files['src/release-config.json'] = changed.files['src/release-config.json']!.replace('com.creator.channel', 'com.other.channel');
  await assert.rejects(createReleaseBuildInput(project, changed, deployment, release, owner.accountId), { code: 'CONFLICT' });
});

test('malicious paths, private URLs, credentials and manifest edits are rejected', async () => {
  for (const [name, body] of [
    ['../escape.js', 'hello'], ['src/secret.js', 'https://host.test/api/private/asset'],
    ['src/secret.js', 'https://host.test/media?X-Amz-Signature=abc'],
    ['src/secret.js', 'AKIAABCDEFGHIJKLMNOP'],
    ['src/too-large.js', 'x'.repeat(256_001)],
    ['src/hlsjs/hls.mjs', 'modified vendor source']
  ]) {
    const source = await stored(); source.files[name] = body;
    await assert.rejects(createReleaseBuildInput(project, source, deployment, release, owner.accountId), { code: 'INVALID_INPUT' });
  }
  const source = await stored();
  source.files['manifest.toml'] = source.files['manifest.toml']!.replace('com.amazon.category.main', 'com.amazon.category.other');
  await assert.rejects(createReleaseBuildInput(project, source, deployment, release, owner.accountId), { code: 'CONFLICT' });
});

test('worker verifies fresh x86_64 output and source fingerprint without running in hosted service', async () => {
  const input = await createReleaseBuildInput(project, await stored(), deployment, release, owner.accountId);
  const dir = await mkdtemp(join(tmpdir(), 'firelaunch-release-build-'));
  try {
    const evidence = await produceIsolatedRelease(input, dir,
      { node: 'v24.21.0', npm: '12.2.0', vegaCli: '1.4.4', vegaSdk: '0.24.12112' }, async (command, cwd) => {
      assert.equal(cwd, dir);
      if (command[0] === 'vpt') {
        assert.match(command.at(-1)!, /\.vpkg$/);
        return { exitCode: 0, startedAt: Date.now(), stdout: command[1] === 'info' ? JSON.stringify({
          id: deployment.packageId, build_number: 1, os_version_registry: { os_versions: ['1.2'] }
        }) : '' };
      }
      if (command[0] === 'npm') {
        assert.ok(command === DEPENDENCY_LOCK_COMMAND || command === DEPENDENCY_INSTALL_COMMAND);
        if (command === DEPENDENCY_LOCK_COMMAND) {
          const pkg = JSON.parse(input.files['package.json']!);
          await writeFile(join(cwd, 'package-lock.json'), JSON.stringify({ packages: { '': {
            dependencies: pkg.dependencies, devDependencies: pkg.devDependencies
          } }, padding: 'x'.repeat(100) }));
        }
        return { exitCode: 0, startedAt: Date.now() };
      }
      assert.deepEqual(command, releaseBuildCommand(input));
      const target = join(cwd, 'build/private/kepler/test/vega/x86_64/Release');
      await mkdir(target, { recursive: true });
      await writeFile(join(target, 'test_x86_64.vpkg'), Buffer.alloc(2048, 1));
      const copy = join(cwd, 'build/x86_64-release');
      await mkdir(copy, { recursive: true });
      await writeFile(join(copy, 'test_x86_64.vpkg'), Buffer.alloc(2048, 1));
      return { exitCode: 0, startedAt: Date.now() };
    });
    assert.equal(evidence.bytes, 2048);
    assert.equal(evidence.packageId, deployment.packageId);
    assert.equal(evidence.inputFingerprint, input.fingerprint);
    assert.match(evidence.dependencyLockSha256, /^[a-f0-9]{64}$/);
    assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
  } finally { await rm(dir, { recursive: true, force: true }); }
  const tampered = { ...input, files: { ...input.files, 'src/App.js': 'changed' } };
  const changedDir = await mkdtemp(join(tmpdir(), 'firelaunch-release-changed-'));
  try { await assert.rejects(materializeReleaseBuildInput(tampered, changedDir), { code: 'CONFLICT' }); }
  finally { await rm(changedDir, { recursive: true, force: true }); }
  const linkDir = await mkdtemp(join(tmpdir(), 'firelaunch-release-link-'));
  const link = `${linkDir}-link`;
  try { await symlink(linkDir, link); await assert.rejects(materializeReleaseBuildInput(input, link), { code: 'INVALID_INPUT' }); }
  finally { await rm(link, { force: true }); await rm(linkDir, { recursive: true, force: true }); }
});

test('worker accepts pinned SDK manifest autolinks but rejects other manifest edits', async () => {
  const input = await createReleaseBuildInput(project, await stored(), deployment, release, owner.accountId);
  const moduleBlock = '[[needs.module]]\nid = "/com.amazon.kepler.w3cmedia_2@IW3cmedia_3"\n\n';
  for (const change of ['sdk', 'package', 'extra-module', 'source'] as const) {
    const dir = await mkdtemp(join(tmpdir(), 'firelaunch-release-manifest-'));
    try {
      const run = produceIsolatedRelease(input, dir,
        { node: 'v24.21.0', npm: '12.2.0', vegaCli: '1.4.4', vegaSdk: '0.24.12112' }, async (command, cwd) => {
          if (command[0] === 'npm' && command[1] === 'install') {
            const pkg = JSON.parse(input.files['package.json']!);
            await writeFile(join(cwd, 'package-lock.json'), JSON.stringify({ packages: { '': {
              dependencies: pkg.dependencies, devDependencies: pkg.devDependencies
            } }, padding: 'x'.repeat(100) }));
          }
          if (command[0] === './node_modules/.bin/react-native') {
            const manifest = input.files['manifest.toml']!.replace('[wants]\n',
              change === 'extra-module' ? '[[needs.module]]\nid = "/com.attacker.module@IUnsafe_1"\n\n[wants]\n' : `${moduleBlock}[wants]\n`);
            await writeFile(join(cwd, 'manifest.toml'), change === 'package' ? manifest.replace(deployment.packageId, 'com.foreign.channel') : manifest);
            if (change === 'source') await writeFile(join(cwd, 'src/App.js'), 'unexpected change');
            const target = join(cwd, 'build/private/kepler/test/vega/x86_64/Release');
            await mkdir(target, { recursive: true });
            await writeFile(join(target, 'test_x86_64.vpkg'), Buffer.alloc(2048, 1));
          }
          return { exitCode: 0, startedAt: Date.now(), stdout: command[1] === 'info' ? JSON.stringify({
            id: deployment.packageId, build_number: 1, os_version_registry: { os_versions: ['1.2'] }
          }) : '' };
        });
      if (change === 'sdk') assert.equal((await run).packageId, deployment.packageId);
      else await assert.rejects(run, { code: 'CONFLICT' });
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
});

test('worker rejects a VPT-validated package with a different application identity', async () => {
  const input = await createReleaseBuildInput(project, await stored(), deployment, release, owner.accountId);
  const dir = await mkdtemp(join(tmpdir(), 'firelaunch-release-wrong-id-'));
  try {
    await assert.rejects(produceIsolatedRelease(input, dir,
      { node: 'v24.21.0', npm: '12.2.0', vegaCli: '1.4.4', vegaSdk: '0.24.12112' }, async (command, cwd) => {
        if (command[0] === 'npm' && command[1] === 'install') {
          const pkg = JSON.parse(input.files['package.json']!);
          await writeFile(join(cwd, 'package-lock.json'), JSON.stringify({ packages: { '': {
            dependencies: pkg.dependencies, devDependencies: pkg.devDependencies
          } }, padding: 'x'.repeat(100) }));
        }
        if (command[0] === './node_modules/.bin/react-native') {
          const target = join(cwd, 'build/private/kepler/test/vega/x86_64/Release');
          await mkdir(target, { recursive: true });
          await writeFile(join(target, 'test_x86_64.vpkg'), Buffer.alloc(2048, 1));
        }
        return { exitCode: 0, startedAt: Date.now(), stdout: command[1] === 'info' ? JSON.stringify({
          id: 'com.foreign.channel', build_number: 1, os_version_registry: { os_versions: ['1.2'] }
        }) : '' };
      }), { code: 'CONFLICT' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('hosted snapshot denies foreign identity, preserves released revision, and detects source or release drift', async () => {
  let source = await stored();
  let currentProject = project;
  let currentRelease = release;
  const guarded = () => { if (active.accountId !== owner.accountId) throw Object.assign(new Error('Project not found'), { code: 'NOT_FOUND' }); };
  let active = owner;
  const repository = {
    read: async () => { guarded(); return currentProject; },
    readDeployment: async () => { guarded(); return deployment; },
    source: async () => { guarded(); return source; }
  } as unknown as HostedProjectRepository;
  const publication = { currentSummary: async () => { guarded(); return currentRelease; },
    currentBuildSnapshot: async () => { guarded(); return { channel: spec, revision: project.revision }; }
  } as unknown as PublicationRepository;
  const workspace = new HostedWorkspaceService(repository, publication);
  const first = await workspace.releaseBuildInput(owner, project.id);
  active = foreign;
  await assert.rejects(workspace.releaseBuildInput(foreign, project.id), { code: 'NOT_FOUND' });
  active = owner;
  await assert.rejects(new HostedWorkspaceService({ ...repository,
    readDeployment: async () => ({ ...deployment, nativeReleaseApproval: 'pending_creator' })
  } as HostedProjectRepository, publication).releaseBuildInput(owner, project.id), { code: 'CONFLICT' });
  source = { ...source, files: { ...source.files, 'src/App.js': `${source.files['src/App.js']}\n// edit` } };
  await assert.rejects(workspace.assertReleaseBuildInputCurrent(owner, project.id, first.fingerprint), { code: 'CONFLICT' });
  source = await stored();
  currentRelease = { ...release, sequence: 2 };
  await assert.rejects(workspace.assertReleaseBuildInputCurrent(owner, project.id, first.fingerprint), { code: 'CONFLICT' });
  currentRelease = release;
  currentProject = { ...project, revision: 4 };
  assert.equal((await workspace.releaseBuildInput(owner, project.id)).fingerprint, first.fingerprint);
  const draft = { ...spec, title: 'New private draft' };
  const draftGenerated = await generateProject(draft, deployment);
  const draftFiles = Object.fromEntries(draftGenerated.files);
  source = { specRevision: 4, fingerprint: draftGenerated.fingerprint, files: draftFiles, baseline: { ...draftFiles } };
  currentProject = { ...project, spec: draft, revision: 4 };
  assert.equal((await workspace.releaseBuildInput(owner, project.id)).fingerprint, first.fingerprint);
  assert.equal(source.files['app.json'], draftFiles['app.json']);
  source = { ...source, files: { ...source.files, 'src/App.js': `${source.files['src/App.js']}\n// private edit` } };
  await assert.rejects(workspace.releaseBuildInput(owner, project.id), /Preserve edits before building/);
  source = null as unknown as StoredSource;
  assert.equal((await workspace.releaseBuildInput(owner, project.id)).fingerprint, first.fingerprint);
});
