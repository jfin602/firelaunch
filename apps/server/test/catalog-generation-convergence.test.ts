import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool } from 'pg';
import { ChannelAgent, type AgentProvider } from '@firelaunch/agent';
import { itemFocusId, projectTelevision, transition } from '@firelaunch/tv';
import { agentCatalogGrounding } from '../src/agent-grounding.js';
import { composeCatalogDraft, type CompositionKind } from '../src/catalog-composition.js';
import { CatalogProjectionService } from '../src/catalog-projection.js';
import { CatalogRepository } from '../src/catalog-repository.js';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { HostedWorkspaceService } from '../src/hosted-workspace.js';

const database = process.env.FIRELAUNCH_TEST_DATABASE_URL;
const cleared = (use: 'television_display' | 'television_playback') => ({
  status: 'cleared', basis: 'creator_asserted', permittedUse: use, assertedAt: '2026-10-10T00:00:00.000Z'
});
const unknown = { status: 'unknown', basis: 'none', permittedUse: 'none' };

(database ? test : test.skip)('three isolated imported catalogs converge through generation, TV Preview, edit, restart and export', async () => {
  const admin = new Pool({ connectionString: database });
  const name = `firelaunch_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(database!); url.pathname = `/${name}`;
  await admin.query(`CREATE DATABASE ${name}`);
  let repository: HostedProjectRepository | undefined;
  try {
    repository = await HostedProjectRepository.connect(url.toString());
    const identity = async (subject: string) => ({ issuer: 'https://issuer.example', subject, email: `${subject}@example.com`,
      accountId: await repository!.accountForIdentity({ issuer: 'https://issuer.example', subject, email: `${subject}@example.com` }) });
    const foreign = await identity('foreign');
    const cases: { kind: CompositionKind; rows: { externalId: string; kind: string; title: string }[]; playable: string[]; withheld: string }[] = [
      { kind: 'video', rows: [{ externalId: 'film', kind: 'video', title: 'Short film' }, { externalId: 'episode', kind: 'video', title: 'Episode' },
        { externalId: 'uncleared', kind: 'video', title: 'Uncleared trailer' }], playable: ['film', 'episode'], withheld: 'uncleared' },
      { kind: 'audio', rows: [{ externalId: 'track', kind: 'audio', title: 'Album track' }, { externalId: 'uncleared', kind: 'audio', title: 'Uncleared track' }],
        playable: ['track'], withheld: 'uncleared' },
      { kind: 'writing', rows: [{ externalId: 'book', kind: 'book', title: 'Source book' }, { externalId: 'uncleared', kind: 'audio', title: 'Uncleared reading' }],
        playable: [], withheld: 'uncleared' }
    ];
    for (const scenario of cases) {
      const owner = await identity(scenario.kind);
      const created = await repository.create(owner, { title: `${scenario.kind} creator` });
      const catalog = new CatalogRepository(repository);
      const source = (await catalog.mutate(owner, created.id, 'sources', 'POST', 0, {
        schemaVersion: 1, type: 'creator_json', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' }
      })).record!;
      const input = JSON.stringify(scenario.rows);
      const preview = await catalog.previewImport(owner, created.id, source.id, 'json', input);
      assert.deepEqual(preview.issues, []);
      assert.equal((await catalog.read(owner, created.id)).items.length, 0, 'preview requires explicit approval');
      await catalog.approveImport(owner, created.id, source.id, 'json', input, preview.revision, preview.fingerprint);
      let inventory = await catalog.read(owner, created.id);
      const selectedIds = inventory.items.map(item => item.id);
      await assert.rejects(catalog.read(foreign, created.id), { code: 'NOT_FOUND' });
      if (scenario.kind === 'writing') {
        const book = inventory.items.find(item => item.kind === 'book')!;
        const { id: _id, creatorAccountId: _owner, projectId: _project, ...editable } = book;
        await catalog.mutate(owner, created.id, 'items', 'PUT', inventory.revision, { ...editable,
          creatorOverrides: { title: 'Creator book edition', editedAt: '2026-10-10T00:00:00.000Z' } }, book.id);
        inventory = await catalog.read(owner, created.id);
        await catalog.mutate(owner, created.id, 'collections', 'POST', inventory.revision,
          { schemaVersion: 1, kind: 'bookshelf', title: 'My books', itemIds: [book.id] });
      }
      for (const row of scenario.rows.filter(value => scenario.playable.includes(value.externalId) || value.externalId === scenario.withheld)) {
        inventory = await catalog.read(owner, created.id);
        const item = inventory.items.find(value => value.sourceRecord.externalId.value === row.externalId)!;
        await catalog.mutate(owner, created.id, 'media-assets', 'POST', inventory.revision, {
          schemaVersion: 1, catalogItemId: item.id, kind: row.kind,
          location: { type: 'https', url: `https://media.example/${scenario.kind}-${row.externalId}.${row.kind === 'video' ? 'mp4' : 'mp3'}` },
          tvDisplayRights: unknown, tvPlaybackRights: scenario.playable.includes(row.externalId) ? cleared('television_playback') : unknown,
          deliveryEligible: scenario.playable.includes(row.externalId)
        });
      }
      inventory = await catalog.read(owner, created.id);
      const collectionIds = inventory.collections.map(value => value.id);
      const service = new CatalogProjectionService(repository, catalog);
      const selection = (revision: number) => ({ expectedProjectRevision: revision, expectedCatalogRevision: inventory.revision,
        itemIds: selectedIds, collectionIds });
      await assert.rejects(service.project(foreign, created.id, selection(created.revision)), { code: 'NOT_FOUND' });
      const projected = await service.project(owner, created.id, selection(created.revision));
      assert.equal(projected.bindings.filter(binding => binding.baseline === null).length, 1);
      assert.equal(projected.bindings.filter(binding => binding.baseline !== null).length, scenario.kind === 'video' ? 2 : 1);
      const first = composeCatalogDraft(scenario.kind, created.spec, projected);
      let saved = await repository.saveCatalogDraft(owner, created.id, created.revision, inventory.revision, scenario.kind,
        first.spec, first.baseline, { itemIds: selectedIds, collectionIds });
      const tv = projectTelevision(saved.spec);
      const item = saved.spec.content[0]!;
      const page = tv.pages.find(value => value.modules.some(module => module.items.some(value => value.id === item.id)))!;
      const module = page.modules.find(value => value.items.some(value => value.id === item.id))!;
      const focused = { screen: 'page' as const, pageId: page.id, focusId: itemFocusId(page.id, module.id, item.id) };
      const detail = transition(tv, focused, 'select');
      assert.equal(detail.screen, 'detail');
      assert.deepEqual(transition(tv, detail, 'back'), focused);
      assert.equal(transition(tv, detail, 'select').screen, scenario.kind === 'writing' ? 'detail' : 'playback');
      assert.equal(saved.spec.content.some(value => value.title.includes('Uncleared')), false);
      const editedSpec = structuredClone(saved.spec);
      editedSpec.brand.primaryColor = '#123456';
      editedSpec.navigation.reverse();
      editedSpec.content[0]!.title = 'Manual title';
      saved = await repository.update(owner, created.id, saved.revision, editedSpec);
      const repeatProjection = await service.project(owner, created.id, selection(saved.revision));
      const prior = await repository.catalogDraftBaseline(owner, created.id);
      const repeat = composeCatalogDraft(scenario.kind, saved.spec, repeatProjection, prior!.spec);
      saved = await repository.saveCatalogDraft(owner, created.id, saved.revision, inventory.revision, scenario.kind,
        repeat.spec, repeat.baseline, { itemIds: selectedIds, collectionIds });
      assert.deepEqual(saved.spec, editedSpec, 'unchanged inputs preserve edits and order');
      assert.equal(saved.spec.content[0]!.title, 'Manual title');
      const provider: AgentProvider = { name: 'fixture', async next(turns) {
        if (turns.length === 1) return { text: '', calls: [{ id: 'inspect', name: 'inspect_catalog', input: {} }] };
        if (turns.length === 3) return { text: '', calls: [{ id: 'brand', name: 'set_brand', input: { changes: { textColor: '#eeeeee' } } }] };
        return { text: 'Saved.', calls: [] };
      } };
      const grounding = agentCatalogGrounding(await service.project(owner, created.id, selection(saved.revision)));
      const agentResult = await new ChannelAgent(provider).run(saved, 'Set text color',
        (spec, revision) => repository!.update(owner, created.id, revision, spec), grounding);
      assert.equal(agentResult.status, 'completed');
      assert.ok(agentResult.events.some(event => event.text.includes('set_brand: saved')));
      saved = agentResult.project;
      assert.equal(saved.spec.brand.textColor, '#eeeeee');
      const workspace = new HostedWorkspaceService(repository);
      await workspace.generate(owner, created.id);
      const readiness = await workspace.readiness(owner, created.id);
      assert.equal(readiness.copy.longDescription.includes('featured videos'), scenario.kind === 'video');
      assert.equal(readiness.copy.releaseNotes.includes('video'), scenario.kind === 'video');
      if (scenario.kind === 'writing') assert.equal(readiness.copy.longDescription.includes('playback'), false);
      const exported = await workspace.exportSource(owner, created.id);
      assert.ok(exported.files['manifest.toml']?.includes('com.amazon.category.main'));
      const output = JSON.stringify(exported);
      for (const sensitive of [owner.accountId, source.id, ...selectedIds, 'evidenceId', 'objectId', 'private-objects', 'X-Amz-Signature'])
        assert.equal(output.includes(sensitive), false, `export leaked ${sensitive}`);
      await assert.rejects(workspace.exportSource(foreign, created.id), { code: 'NOT_FOUND' });
      await assert.rejects(repository.read(foreign, created.id), { code: 'NOT_FOUND' });
      await repository.pool.end();
      repository = await HostedProjectRepository.connect(url.toString());
      const relogin = await identity(scenario.kind);
      assert.equal(relogin.accountId, owner.accountId);
      assert.deepEqual((await repository.read(relogin, created.id)).spec, saved.spec);
      assert.equal((await repository.catalogDraftBaseline(relogin, created.id))?.kind, scenario.kind);
      assert.equal((await new HostedWorkspaceService(repository).exportSource(relogin, created.id)).revision, saved.revision);
    }
  } finally {
    await repository?.pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
