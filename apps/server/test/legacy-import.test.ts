import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { ProjectRepository } from '../src/repository.js';
import { WorkspaceService } from '../src/workspace.js';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { HostedWorkspaceService } from '../src/hosted-workspace.js';
import { LegacyImporter, readLegacyProject } from '../src/migration/legacy-import.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';

async function fixture(action: (root: string, repository: ProjectRepository, workspace: WorkspaceService) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'firelaunch-import-'));
  try {
    const repository = new ProjectRepository(root);
    await action(root, repository, new WorkspaceService(repository));
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('legacy reader preserves customized source and rejects corrupt, symlink and binary input', () => fixture(async (root, repository, workspace) => {
  const project = await repository.create({ title: 'Legacy channel' });
  await workspace.generate(project.id);
  const original = await workspace.read(project.id, 'src/App.js');
  await workspace.save(project.id, original.path, `${original.content}\n// authored edit\n`, original.sha256);
  const snapshot = await readLegacyProject(root, project.id);
  assert.equal(snapshot.project.revision, project.revision);
  assert.deepEqual(snapshot.source?.changed, ['src/App.js']);
  assert.match(snapshot.source?.files['src/App.js'] ?? '', /authored edit/);
  const generated = path.join(root, 'projects', project.id, 'generated');
  await writeFile(path.join(generated, 'binary.js'), Buffer.from([0, 1, 2]));
  await assert.rejects(readLegacyProject(root, project.id), /Binary generated source/);
  await rm(path.join(generated, 'binary.js'));
  await writeFile(path.join(generated, 'credential.pem'), 'not portable source');
  await assert.rejects(readLegacyProject(root, project.id), /Unsupported generated file/);
  await rm(path.join(generated, 'credential.pem'));
  await symlink('/etc/passwd', path.join(generated, 'link.js'));
  await assert.rejects(readLegacyProject(root, project.id), /Symlink/);
  await rm(path.join(generated, 'link.js'));
  await writeFile(path.join(root, 'projects', project.id, 'project.json'), '{');
  await assert.rejects(readLegacyProject(root, project.id), /Invalid legacy project JSON/);
  await writeFile(path.join(root, 'projects', project.id, 'project.json'), Buffer.from([0xff]));
  await assert.rejects(readLegacyProject(root, project.id), /Invalid legacy project JSON/);
  const linkedId = `ch_${'a'.repeat(32)}`;
  await symlink(path.join(root, 'projects', project.id), path.join(root, 'projects', linkedId));
  const importer = new LegacyImporter({} as Pool, root, `cr_${'b'.repeat(32)}`);
  assert.deepEqual(await importer.projectIds(), [linkedId, project.id].sort());
  assert.equal((await importer.run(linkedId)).status, 'error');
}));

const dbUrl = process.env.FIRELAUNCH_TEST_DATABASE_URL;
(dbUrl ? test : test.skip)('Postgres importer is dry-run, atomic, idempotent, owner-bound and source-portable', async () => {
  const admin = new Pool({ connectionString: dbUrl });
  const database = `firelaunch_import_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(dbUrl!); url.pathname = `/${database}`;
  await admin.query(`CREATE DATABASE ${database}`);
  let hosted: HostedProjectRepository | undefined;
  try {
    hosted = await HostedProjectRepository.connect(url.toString());
    const firstId = await hosted.accountForIdentity({ issuer: 'https://issuer.example', subject: 'first', email: 'first@example.com' });
    const secondId = await hosted.accountForIdentity({ issuer: 'https://issuer.example', subject: 'second', email: 'second@example.com' });
    const first: AuthenticatedPrincipal = { accountId: firstId, issuer: 'https://issuer.example', subject: 'first', email: 'first@example.com' };
    const second: AuthenticatedPrincipal = { accountId: secondId, issuer: 'https://issuer.example', subject: 'second', email: 'second@example.com' };
    await fixture(async (root, repository, workspace) => {
      const project = await repository.create({ title: 'Imported channel' });
      await workspace.generate(project.id);
      const source = await workspace.read(project.id, 'src/App.js');
      await workspace.save(project.id, source.path, `${source.content}\n// custom work\n`, source.sha256);
      const revised = await repository.update(project.id, project.revision, { ...project.spec, title: 'Imported channel revised' });
      const beforeProject = await readFile(path.join(root, 'projects', project.id, 'project.json'));
      const beforeSource = await readFile(path.join(root, 'projects', project.id, 'generated/src/App.js'));
      const importer = new LegacyImporter(hosted!.pool, root, firstId);
      assert.deepEqual(await importer.projectIds(), [project.id]);
      const linkedId = `ch_${'c'.repeat(32)}`;
      await symlink(path.join(root, 'projects', project.id), path.join(root, 'projects', linkedId));
      assert.deepEqual(await importer.projectIds(), [linkedId, project.id].sort());
      assert.equal((await importer.run(linkedId, true)).status, 'error');
      assert.equal((await importer.run(project.id)).status, 'ready');
      assert.equal((await hosted!.pool.query('SELECT count(*)::int AS n FROM channel_projects')).rows[0].n, 0);
      assert.equal((await importer.run(project.id, true)).status, 'imported');
      assert.equal((await importer.run(project.id, true)).status, 'already-imported');
      assert.equal((await new LegacyImporter(hosted!.pool, root, secondId).run(project.id, true)).status, 'collision');
      assert.equal((await hosted!.read(first, project.id)).revision, revised.revision);
      await assert.rejects(hosted!.read(second, project.id), { code: 'NOT_FOUND' });
      const hostedSource = await hosted!.source(first, project.id);
      assert.match(hostedSource?.files['src/App.js'] ?? '', /custom work/);
      const service = new HostedWorkspaceService(hosted!);
      assert.deepEqual((await service.overview(first, project.id)).changed, ['src/App.js']);
      assert.equal((await service.overview(first, project.id)).stale, true);
      await assert.rejects(service.generate(first, project.id), { code: 'CONFLICT' });
      const bundle = await service.exportSource(first, project.id);
      await assert.rejects(service.exportSource(second, project.id), { code: 'NOT_FOUND' });
      const json = path.join(root, 'export.json');
      const output = path.join(root, 'standalone');
      await writeFile(json, JSON.stringify(bundle));
      const verify = spawnSync(process.execPath, ['scripts/materialize-source-export.mjs', json, output], { cwd: process.cwd(), encoding: 'utf8' });
      assert.equal(verify.status, 0, verify.stderr);
      assert.equal(await readFile(path.join(output, 'src/App.js'), 'utf8'), beforeSource.toString('utf8'));
      assert.deepEqual(await readFile(path.join(root, 'projects', project.id, 'project.json')), beforeProject);
      assert.deepEqual(await readFile(path.join(root, 'projects', project.id, 'generated/src/App.js')), beforeSource);
      assert.equal((await hosted!.pool.query("SELECT count(*)::int AS n FROM creator_audit_events WHERE event_type = 'legacy_project_imported'")).rows[0].n, 1);
      await writeFile(path.join(root, 'projects', project.id, 'generated/src/App.js'), `${beforeSource.toString('utf8')}\n// later local change\n`);
      assert.equal((await importer.run(project.id, true)).status, 'collision');
      const tampered = { ...bundle, files: { ...bundle.files, 'src/App.js': 'tampered' } };
      await writeFile(json, JSON.stringify(tampered));
      const refused = spawnSync(process.execPath, ['scripts/materialize-source-export.mjs', json, path.join(root, 'tampered')], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(refused.status, 0);
      await writeFile(json, JSON.stringify(bundle));
      await symlink(output, path.join(root, 'output-link'));
      const linkedOutput = spawnSync(process.execPath, ['scripts/materialize-source-export.mjs', json, path.join(root, 'output-link', 'child')], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(linkedOutput.status, 0);
      assert.equal(await readFile(path.join(output, 'src/App.js'), 'utf8'), beforeSource.toString('utf8'));
      const concurrent = await repository.create({ title: 'Concurrent import' });
      assert.deepEqual((await Promise.all([importer.run(concurrent.id, true), importer.run(concurrent.id, true)])).map(result => result.status).sort(),
        ['already-imported', 'imported']);
      const failed = await repository.create({ title: 'Rollback channel' });
      await hosted!.pool.query(`CREATE FUNCTION reject_legacy_marker() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END $$`);
      await hosted!.pool.query('CREATE TRIGGER reject_legacy_marker BEFORE INSERT ON legacy_import_markers FOR EACH ROW EXECUTE FUNCTION reject_legacy_marker()');
      assert.equal((await importer.run(failed.id, true)).status, 'error');
      assert.equal((await hosted!.pool.query('SELECT count(*)::int AS n FROM channel_projects WHERE id = $1', [failed.id])).rows[0].n, 0);
      assert.equal((await hosted!.pool.query('SELECT count(*)::int AS n FROM channel_ownerships WHERE project_id = $1', [failed.id])).rows[0].n, 0);
      assert.equal((await hosted!.pool.query("SELECT count(*)::int AS n FROM creator_audit_events WHERE event_type = 'legacy_project_import_failed' AND project_id = $1", [failed.id])).rows[0].n, 1);
      assert.equal((await hosted!.pool.query("SELECT count(*)::int AS n FROM creator_audit_events WHERE event_type = 'legacy_project_import_failed' AND project_id = $1", [linkedId])).rows[0].n, 1);
      assert.deepEqual(await repository.read(failed.id), failed);
    });
  } finally {
    if (hosted) await hosted.pool.end();
    await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);
    await admin.end();
  }
});
