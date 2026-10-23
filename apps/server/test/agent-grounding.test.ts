import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ChannelAgent, executeTool, type AgentProvider } from '@vegalaunch/agent';
import { ProjectRepository } from '../src/repository.js';
import { agentCatalogGrounding } from '../src/agent-grounding.js';
import { CatalogProjectionService, type CatalogProjection } from '../src/catalog-projection.js';
import type { HostedProjectRepository } from '../src/hosted-repository.js';
import type { CatalogRepository } from '../src/catalog-repository.js';

const catalogId = `ci_${'1'.repeat(32)}`;
const contentId = `item_${'2'.repeat(32)}`;
const projection: CatalogProjection = { projectRevision: 1, catalogRevision: 2, collections: [], bindings: [
  { catalogItemId: catalogId, contentId, collectionIds: [], baseline: { id: contentId, title: 'Creator book', description: `A book ${'x'.repeat(1000)}`,
    artwork: 'assets/catalog-placeholder.png', presentation: 'information' } },
  { catalogItemId: `ci_${'3'.repeat(32)}`, contentId: `item_${'4'.repeat(32)}`, collectionIds: [], baseline: null,
    blockedReason: 'playback_rights_or_delivery_missing' }
] };

test('catalog grounding is paginated and reveals only approved presentation fields', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'firelaunch-grounding-'));
  try {
    const repository = new ProjectRepository(directory);
    const project = await repository.create({ title: 'Books' });
    const grounding = agentCatalogGrounding(projection);
    const inspected = JSON.parse(executeTool(project.spec, 'inspect_catalog', { offset: 0 }, grounding).output);
    assert.equal(inspected.total, 2);
    assert.equal(inspected.items[0].description.length, 240);
    assert.equal(inspected.items[1].eligible, false);
    for (const field of ['sourceRecord', 'evidenceId', 'objectId', 'mediaUrl', 'creatorAccountId']) assert.equal(JSON.stringify(inspected).includes(field), false);
    assert.throws(() => executeTool(project.spec, 'inspect_catalog', { ownerId: 'foreign' }, grounding), /invalid/i);
    assert.throws(() => executeTool(project.spec, 'inspect_catalog', { offset: 491 }, grounding), /invalid/i);
    assert.throws(() => executeTool(project.spec, 'add_catalog_content', { catalogItemId: `ci_${'3'.repeat(32)}` }, grounding), /not selected and eligible/);
    assert.throws(() => executeTool(project.spec, 'add_catalog_content', { catalogItemId: `ci_${'9'.repeat(32)}` }, grounding), /not selected and eligible/);
    const malicious = executeTool(project.spec, 'add_content', { content: { title: 'Unknown video', description: '', artwork: 'https://example.com/art.jpg', mediaUrl: 'http://localhost/private' } });
    assert.throws(() => grounding.authorize(project.spec, malicious.spec), /selected, approved/);
    const provider: AgentProvider = { name: 'openai', async next(turns) {
      if (turns.length === 1) return { text: '', calls: [{ id: 'inspect', name: 'inspect_catalog', input: {} }] };
      if (turns.length === 3) return { text: '', calls: [{ id: 'add', name: 'add_catalog_content', input: { catalogItemId: catalogId } }] };
      return { text: 'Added the selected book.', calls: [] };
    } };
    const saved = await new ChannelAgent(provider).run(project, 'Add my book', (spec, revision) => repository.update(project.id, revision, spec), grounding);
    assert.equal(saved.status, 'completed');
    assert.equal(saved.project.revision, 2);
    assert.equal(saved.project.spec.content[0]?.id, contentId);
    assert.equal((await repository.read(project.id)).spec.content[0]?.title, 'Creator book');
    assert.ok(saved.events.some(event => event.text.includes('add_catalog_content: saved')));
    assert.throws(() => grounding.authorize(saved.project.spec, { ...saved.project.spec, content: [{ ...saved.project.spec.content[0]!, mediaUrl: 'https://example.com/unapproved.mp4' }] }), /Media changes/);
    const stale = await new ChannelAgent(provider).run(project, 'Add my book', (spec, revision) => repository.update(project.id, revision, spec), grounding);
    assert.equal(stale.status, 'error');
    assert.equal((await repository.read(project.id)).revision, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('catalog projection denies a foreign principal before reading inventory for agent grounding', async () => {
  let catalogReads = 0;
  const projects = { async read() { throw Object.assign(new Error('Project not found'), { code: 'NOT_FOUND' }); } } as unknown as HostedProjectRepository;
  const catalog = { async read() { catalogReads++; return {}; } } as unknown as CatalogRepository;
  const service = new CatalogProjectionService(projects, catalog);
  await assert.rejects(service.project({ accountId: 'foreign', issuer: 'https://issuer.example', subject: 'foreign', email: 'f@example.com' },
    `ch_${'a'.repeat(32)}`, { expectedProjectRevision: 1, expectedCatalogRevision: 0, itemIds: [catalogId], collectionIds: [] }), { code: 'NOT_FOUND' });
  assert.equal(catalogReads, 0);
});
