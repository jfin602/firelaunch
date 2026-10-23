import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { parseCatalogFile } from '../src/catalog-file-import.js';
import { CatalogRepository } from '../src/catalog-repository.js';
import { HostedProjectRepository } from '../src/hosted-repository.js';

const sourceId = `src_${'a'.repeat(32)}`;

test('CSV quoted lines, escaped quotes, and JSON normalize the same source IDs', () => {
  const csv = 'externalId,kind,title,description\r\n novel-1 ,book,"A ""quoted"" title","two\nlines"\r\n';
  const parsed = parseCatalogFile('csv', csv, sourceId);
  assert.equal(parsed.rows[0]?.externalId, 'novel-1');
  assert.equal(parsed.rows[0]?.metadata.title, 'A "quoted" title');
  assert.equal(parsed.rows[0]?.metadata.description, 'two\nlines');
  assert.equal(parsed.rows[0]?.line, 2);
  assert.equal(parsed.issues.length, 0);
  const json = parseCatalogFile('json', '[{"externalId":" novel-1 ","kind":"book","title":"A title"}]', sourceId);
  assert.equal(json.rows[0]?.externalId, 'novel-1');
  assert.notEqual(json.fingerprint, parsed.fingerprint);
});

test('file preview shows invalid, duplicate and ambiguous rows and rejects malformed documents', () => {
  const parsed = parseCatalogFile('json', JSON.stringify([
    { externalId: 'x', kind: 'book', title: 'One' },
    { externalId: 'x', kind: 'book', title: 'One' },
    { externalId: 'x', kind: 'book', title: 'Two' },
    { externalId: '../bad', kind: 'book', title: 'Wrong' }
  ]), sourceId);
  assert.deepEqual(parsed.issues.map(issue => issue.code), ['DUPLICATE', 'AMBIGUOUS', 'INVALID']);
  assert.throws(() => parseCatalogFile('csv', 'externalId,kind,title\nx,book,"unclosed', sourceId), { code: 'INVALID_INPUT' });
  assert.deepEqual(parseCatalogFile('csv', 'externalId,kind,title\nx,book,title,extra', sourceId).issues.map(issue => issue.code), ['INVALID']);
  assert.throws(() => parseCatalogFile('json', '[{"externalId":"x","kind":"book","title":{"nested":true}}]', sourceId), { code: 'INVALID_INPUT' });
  assert.throws(() => parseCatalogFile('json', '[]'.padEnd(512_001, ' '), sourceId), { code: 'INVALID_INPUT' });
  assert.throws(() => parseCatalogFile('json', `[{"externalId":"x","kind":"book","title":"\ud800"}]`, sourceId), { code: 'INVALID_INPUT' });
});

const database = process.env.VEGALAUNCH_TEST_DATABASE_URL;
(database ? test : test.skip)('approved import is atomic, revision-bound, owner-scoped and preserves overrides on reimport', async () => {
  const admin = new Pool({ connectionString: database });
  const name = `vegalaunch_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(database!); url.pathname = `/${name}`;
  await admin.query(`CREATE DATABASE ${name}`);
  let repository: HostedProjectRepository | undefined;
  try {
    repository = await HostedProjectRepository.connect(url.toString());
    const identity = async (subject: string) => ({ accountId: await repository!.accountForIdentity({ issuer: 'https://issuer.example', subject, email: `${subject}@example.com` }),
      issuer: 'https://issuer.example', subject, email: `${subject}@example.com` });
    const a = await identity('import-a'), b = await identity('import-b');
    const project = await repository.create(a, { title: 'Library' });
    const catalog = new CatalogRepository(repository);
    const source = (await catalog.mutate(a, project.id, 'sources', 'POST', 0,
      { schemaVersion: 1, type: 'creator_json', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } })).record!;
    const content = JSON.stringify([{ externalId: 'book-1', kind: 'book', title: 'Observed' }]);
    const preview = await catalog.previewImport(a, project.id, source.id, 'json', content);
    assert.deepEqual(preview.rows.map(row => row.action), ['create']);
    const unpreviewed = JSON.stringify([{ externalId: 'book-2', kind: 'book', title: 'Not previewed' }]);
    const unpreviewedFingerprint = parseCatalogFile('json', unpreviewed, source.id).fingerprint;
    await assert.rejects(catalog.approveImport(a, project.id, source.id, 'json', unpreviewed, preview.revision, unpreviewedFingerprint), { code: 'CONFLICT' });
    await assert.rejects(catalog.previewImport(b, project.id, source.id, 'json', content), { code: 'NOT_FOUND' });
    await assert.rejects(catalog.approveImport(b, project.id, source.id, 'json', content, preview.revision, preview.fingerprint), { code: 'NOT_FOUND' });
    await assert.rejects(catalog.approveImport(a, project.id, source.id, 'json', content, preview.revision, '0'.repeat(64)), { code: 'CONFLICT' });
    const invalid = JSON.stringify([{ externalId: 'book-1', kind: 'book', title: 'Observed' }, { externalId: 'book-1', kind: 'book', title: 'Other' }]);
    const invalidPreview = await catalog.previewImport(a, project.id, source.id, 'json', invalid);
    await assert.rejects(catalog.approveImport(a, project.id, source.id, 'json', invalid, invalidPreview.revision, invalidPreview.fingerprint), { code: 'INVALID_INPUT' });
    assert.equal((await catalog.read(a, project.id)).items.length, 0);
    assert.deepEqual(await catalog.approveImport(a, project.id, source.id, 'json', content, preview.revision, preview.fingerprint),
      { revision: 2, created: 1, updated: 0, unchanged: 0 });
    await assert.rejects(catalog.approveImport(a, project.id, source.id, 'json', content, preview.revision, preview.fingerprint), { code: 'CONFLICT' });
    const item = (await catalog.read(a, project.id)).items[0]!;
    const { id: _id, creatorAccountId: _owner, projectId: _project, ...editable } = item;
    await assert.rejects(catalog.mutate(a, project.id, 'items', 'PUT', 2,
      { ...editable, sourceRecord: { ...editable.sourceRecord, metadata: { title: 'Forged observation' } } }, item.id), { code: 'INVALID_INPUT' });
    await catalog.mutate(a, project.id, 'items', 'PUT', 2, { ...editable, creatorOverrides: { title: 'My title', editedAt: new Date().toISOString() } }, item.id);
    const kindChange = JSON.stringify([{ externalId: 'book-1', kind: 'video', title: 'Changed type' }]);
    const ambiguous = await catalog.previewImport(a, project.id, source.id, 'json', kindChange);
    assert.deepEqual(ambiguous.issues.map(issue => issue.code), ['AMBIGUOUS']);
    await assert.rejects(catalog.approveImport(a, project.id, source.id, 'json', kindChange, ambiguous.revision, ambiguous.fingerprint), { code: 'INVALID_INPUT' });
    const replacement = JSON.stringify([{ externalId: 'book-1', kind: 'book', title: 'Changed source' }]);
    const again = await catalog.previewImport(a, project.id, source.id, 'json', replacement);
    assert.deepEqual(again.rows.map(row => row.action), ['update']);
    assert.deepEqual(await catalog.approveImport(a, project.id, source.id, 'json', replacement, again.revision, again.fingerprint),
      { revision: 4, created: 0, updated: 1, unchanged: 0 });
    const after = (await catalog.read(a, project.id)).items[0]!;
    assert.equal(after.id, item.id);
    assert.equal(after.sourceRecord.metadata.title, 'Changed source');
    assert.equal(after.creatorOverrides?.title, 'My title');
    const repeat = await catalog.previewImport(a, project.id, source.id, 'json', replacement);
    assert.deepEqual(await catalog.approveImport(a, project.id, source.id, 'json', replacement, repeat.revision, repeat.fingerprint),
      { revision: 4, created: 0, updated: 0, unchanged: 1 });
    assert.equal((await catalog.read(a, project.id)).items[0]?.sourceRecord.observedAt, after.sourceRecord.observedAt);
  } finally {
    if (repository) await repository.pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
