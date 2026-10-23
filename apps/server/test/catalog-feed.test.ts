import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';
import type { request as httpsRequest } from 'node:https';
import { Pool } from 'pg';
import { fetchFeedSnapshot, parseFeed, publicAddress } from '../src/catalog-feed.js';
import { CatalogRepository } from '../src/catalog-repository.js';
import { HostedProjectRepository } from '../src/hosted-repository.js';

const json = JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', items: [
  { id: 'https://creator.example/story/1', title: 'First', summary: 'A story', _vegalaunch_kind: 'book' }
] });

function harness(routes: Record<string, { status: number; headers?: Record<string, string>; body?: string }>,
  answers: Record<string, { address: string; family: 4 | 6 }[]> = {}) {
  const calls: { host: string; address: string; family: number }[] = [];
  const transport = {
    resolve: async (host: string) => answers[host] ?? [{ address: '8.8.8.8', family: 4 as const }],
    request: ((url: URL, options: { lookup: (host: string, options: object, callback: (error: null, address: string, family: number) => void) => void }, callback: (response: PassThrough) => void) => {
      const request = new EventEmitter() as EventEmitter & { end: () => void };
      request.end = () => {
        options.lookup(url.hostname, {}, (_error, address, family) => calls.push({ host: url.hostname, address, family }));
        const route = routes[url.hostname + url.pathname] ?? { status: 404 };
        const response = Object.assign(new PassThrough(), { statusCode: route.status, headers: route.headers ?? {} });
        callback(response);
        if (route.status === 200) response.end(route.body ?? '');
      };
      return request;
    }) as unknown as typeof httpsRequest
  };
  return { calls, transport };
}

test('JSON Feed and RSS/Atom subset normalizes stable IDs and rejects dangerous XML', () => {
  const first = JSON.parse(parseFeed(json, 'application/feed+json'));
  assert.match(first[0].externalId, /^feed-[a-f0-9]{64}$/);
  assert.equal(first[0].rawExternalId, 'https://creator.example/story/1');
  assert.equal(first[0].kind, 'book');
  assert.equal(first[0].description, 'A story');
  const rss = JSON.parse(parseFeed('<rss><channel><item><guid>book-1</guid><title>One</title><description>Story</description></item></channel></rss>', 'application/rss+xml'));
  assert.deepEqual(rss, [{ externalId: 'book-1', rawExternalId: 'book-1', kind: 'listing', title: 'One', description: 'Story' }]);
  const atom = JSON.parse(parseFeed('<feed><entry><id>entry-1</id><title>Two</title><summary>Summary</summary></entry></feed>', 'application/atom+xml'));
  assert.deepEqual(atom, [{ externalId: 'entry-1', rawExternalId: 'entry-1', kind: 'listing', title: 'Two', description: 'Summary' }]);
  assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY x "bad">]><rss/>', 'application/rss+xml'), { code: 'INVALID_INPUT' });
  assert.throws(() => parseFeed('<?xml-stylesheet href="x"?><rss/>', 'application/rss+xml'), { code: 'INVALID_INPUT' });
  assert.throws(() => parseFeed(JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', items: Array(1001).fill({ id: 'x', title: 'X' }) }), 'application/json'), { code: 'INVALID_INPUT' });
  assert.throws(() => parseFeed(json, 'text/html'), { code: 'INVALID_INPUT' });
});

test('address policy denies local, metadata, mapped, transition and mixed DNS answers', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '100.100.100.200', '192.168.1.1', '::1', 'fc00::1', '::ffff:127.0.0.1', '2002::1', '2001:db8::1']) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress('8.8.8.8'), true);
  assert.equal(publicAddress('2001:4860:4860::8888'), true);
  const { calls, transport } = harness({ 'feed.example/feed': { status: 200, headers: { 'content-type': 'application/json' }, body: json } },
    { 'feed.example': [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }] });
  await assert.rejects(fetchFeedSnapshot('https://feed.example/feed', transport), { code: 'INVALID_INPUT' });
  assert.equal(calls.length, 0);
  await assert.rejects(fetchFeedSnapshot('https://127.0.0.1/feed', transport), { code: 'INVALID_INPUT' });
  await assert.rejects(fetchFeedSnapshot('http://feed.example/feed', transport), { code: 'INVALID_INPUT' });
});

test('each redirect resolves and pins a validated address before reading bounded content', async () => {
  const { calls, transport } = harness({
    'feed.example/feed': { status: 302, headers: { location: 'https://next.example/feed' } },
    'next.example/feed': { status: 200, headers: { 'content-type': 'application/feed+json' }, body: json }
  }, { 'feed.example': [{ address: '8.8.8.8', family: 4 }], 'next.example': [{ address: '1.1.1.1', family: 4 }] });
  const content = await fetchFeedSnapshot('https://feed.example/feed', transport);
  assert.equal(JSON.parse(content)[0].title, 'First');
  assert.deepEqual(calls, [{ host: 'feed.example', address: '8.8.8.8', family: 4 }, { host: 'next.example', address: '1.1.1.1', family: 4 }]);
  const unsafe = harness({ 'feed.example/feed': { status: 302, headers: { location: 'https://internal.example/feed' } } },
    { 'internal.example': [{ address: '169.254.169.254', family: 4 }] });
  await assert.rejects(fetchFeedSnapshot('https://feed.example/feed', unsafe.transport), { code: 'INVALID_INPUT' });
  assert.equal(unsafe.calls.length, 1);
  const compressed = harness({ 'feed.example/feed': { status: 200, headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' }, body: json } });
  await assert.rejects(fetchFeedSnapshot('https://feed.example/feed', compressed.transport), { code: 'INVALID_INPUT' });
  const oversized = harness({ 'feed.example/feed': { status: 200, headers: { 'content-type': 'application/json' }, body: 'x'.repeat(512_001) } });
  await assert.rejects(fetchFeedSnapshot('https://feed.example/feed', oversized.transport), { code: 'INVALID_INPUT' });
});

const database = process.env.VEGALAUNCH_TEST_DATABASE_URL;
(database ? test : test.skip)('feed snapshot uses owner-scoped preview receipt and explicit approval', async () => {
  const admin = new Pool({ connectionString: database });
  const name = `vegalaunch_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(database!); url.pathname = `/${name}`;
  await admin.query(`CREATE DATABASE ${name}`);
  let repository: HostedProjectRepository | undefined;
  try {
    repository = await HostedProjectRepository.connect(url.toString());
    const principal = async (subject: string) => ({ accountId: await repository!.accountForIdentity({ issuer: 'https://issuer.example', subject, email: `${subject}@example.com` }),
      issuer: 'https://issuer.example', subject, email: `${subject}@example.com` });
    const owner = await principal('feed-owner'), foreign = await principal('feed-foreign');
    const project = await repository.create(owner, { title: 'Feed channel' });
    let fetched = 0;
    const catalog = new CatalogRepository(repository, async endpoint => { assert.equal(endpoint, 'https://feed.example/feed'); fetched++; return parseFeed(json, 'application/feed+json'); });
    const source = (await catalog.mutate(owner, project.id, 'sources', 'POST', 0,
      { schemaVersion: 1, type: 'creator_https_feed', state: 'discovered', endpointUrl: 'https://feed.example/feed',
        permission: { retrieval: 'creator_asserted', tvDisplay: 'unknown' } })).record!;
    await assert.rejects(catalog.previewFeed(foreign, project.id, source.id), { code: 'NOT_FOUND' });
    assert.equal(fetched, 0);
    const preview = await catalog.previewFeed(owner, project.id, source.id);
    assert.equal(fetched, 1);
    assert.deepEqual(preview.rows.map(row => row.action), ['create']);
    assert.equal((await catalog.read(owner, project.id)).items.length, 0);
    await assert.rejects(catalog.approveImport(foreign, project.id, source.id, 'feed', preview.content, preview.revision, preview.fingerprint), { code: 'NOT_FOUND' });
    await assert.rejects(catalog.approveImport(owner, project.id, source.id, 'feed', '[]', preview.revision, preview.fingerprint), { code: 'CONFLICT' });
    assert.deepEqual(await catalog.approveImport(owner, project.id, source.id, 'feed', preview.content, preview.revision, preview.fingerprint),
      { revision: 2, created: 1, updated: 0, unchanged: 0 });
    const item = (await catalog.read(owner, project.id)).items[0]!;
    assert.equal(item.sourceRecord.sourceId, source.id);
    assert.equal(item.sourceRecord.rawExternalId, 'https://creator.example/story/1');
    assert.equal(item.sourceRecord.metadata.title, 'First');
    assert.equal(item.kind, 'book');
    const again = await catalog.previewFeed(owner, project.id, source.id);
    assert.deepEqual(await catalog.approveImport(owner, project.id, source.id, 'feed', again.content, again.revision, again.fingerprint),
      { revision: 2, created: 0, updated: 0, unchanged: 1 });
    assert.equal((await catalog.read(owner, project.id)).items[0]?.id, item.id);
  } finally {
    if (repository) await repository.pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
