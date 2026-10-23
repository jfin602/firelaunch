import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSubtitleLanguage, validateWebVtt } from '../src/video-subtitles.js';
import { once } from 'node:events';
import { createApi } from '../src/api.js';
import { ProjectRepository, RepositoryError } from '../src/repository.js';
import type { HostedProjectRepository } from '../src/hosted-repository.js';
import type { PrivateObjectService } from '../src/private-objects.js';
import type { ServerMode } from '../src/auth/config.js';

const en = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello world\n';
test('optional private WebVTT validates English and Spanish cues and canonical languages', () => {
  assert.equal(validateWebVtt(Buffer.from(en)), en);
  assert.match(validateWebVtt(Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n¡Hola, mundo!\n')), /Hola/);
  assert.equal(normalizeSubtitleLanguage('EN-us'), 'en-US');
  assert.equal(normalizeSubtitleLanguage('es'), 'es');
});
test('WebVTT rejects invalid headers, Unicode, cues, external references, markup and size', () => {
  for (const input of ['BAD\n\n00:00:01.000 --> 00:00:03.000\nHi\n', 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<script>x</script>\n',
    'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nhttps://example.org\n', 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n../escape\n',
    'WEBVTT\n\n00:00:03.000 --> 00:00:01.000\nReverse\n', 'WEBVTT\n\nNOTE ignored'])
    assert.throws(() => validateWebVtt(Buffer.from(input)), { code: 'INVALID_INPUT' });
  assert.throws(() => validateWebVtt(Buffer.concat([Buffer.from(en), Buffer.from([0xff])])), { code: 'INVALID_INPUT' });
  assert.throws(() => validateWebVtt(Buffer.alloc(262145)), { code: 'INVALID_INPUT' });
  assert.throws(() => normalizeSubtitleLanguage('en/../../x'), { code: 'INVALID_INPUT' });
});

test('subtitle route requires CSRF and owner access before reading private tracks', async () => {
  const owner = `cr_${'a'.repeat(32)}`;
  const project = `ch_${'b'.repeat(32)}`;
  const item = `ci_${'c'.repeat(32)}`;
  const asset = `ma_${'d'.repeat(32)}`;
  let reads = 0;
  const hosted = { read: async () => { reads++; throw new RepositoryError('NOT_FOUND', 'Project not found'); },
    pool: { query: async () => ({ rows: [], rowCount: 0 }) } } as unknown as HostedProjectRepository;
  let csrf = false;
  const mode = { mode: 'hosted', auth: { session: () => ({ principal: { accountId: owner, issuer: 'test', subject: 'test', email: 'test@example.com' }, csrf: 'valid' }),
    authorizedMutation: () => csrf } } as unknown as ServerMode;
  const server = createApi(new ProjectRepository('/tmp/firelaunch-subtitle-test'), undefined, mode, hosted, {} as PrivateObjectService);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server address unavailable');
  const url = `http://127.0.0.1:${address.port}/api/projects/${project}/video-subtitles`;
  try {
    const denied = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(denied.status, 403); assert.equal(reads, 0);
    csrf = true;
    const foreign = await fetch(`${url}/${item}/${asset}`);
    assert.equal(foreign.status, 404); assert.equal(reads, 1);
  } finally { server.close(); await once(server, 'close'); }
});
