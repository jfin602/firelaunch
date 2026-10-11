import assert from 'node:assert/strict';
import test from 'node:test';
import { starterChannel } from '@firelaunch/channel-engine';
import { assertExportableMedia, publicMediaUrl } from '../src/hosted-media-policy.js';
import { HostedWorkspaceService } from '../src/hosted-workspace.js';
import type { HostedProjectRepository } from '../src/hosted-repository.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';

test('hosted media references accept only stable public HTTPS or bundled artwork', () => {
  const spec = starterChannel('Creator channel');
  const content = { id: `item_${'a'.repeat(32)}`, title: 'Film', description: '',
    artwork: 'assets/catalog-placeholder.png', presentation: 'video' as const,
    mediaUrl: 'https://media.example/film.mp4' };
  assert.doesNotThrow(() => assertExportableMedia({ ...spec, content: [content] }));
  for (const mediaUrl of [
    'http://media.example/film.mp4', 'https://127.0.0.1/film.mp4', 'https://[::1]/film.mp4',
    'https://localhost./film.mp4', 'https://media.internal/film.mp4',
    'https://media.example/film.mp4?token=private', 'https://media.example/film.mp4#private',
    'https://studio.example/api/projects/channel/private-objects/object/content',
    'https://studio.example/api/%70rivate-objects/object/content'
  ]) {
    assert.equal(publicMediaUrl(mediaUrl), false, mediaUrl);
    assert.throws(() => assertExportableMedia({ ...spec, content: [{ ...content, mediaUrl }] }), { code: 'INVALID_INPUT' });
  }
  assert.throws(() => assertExportableMedia({ ...spec, brand: { ...spec.brand, logo: 'http://localhost/logo.png' } }), { code: 'INVALID_INPUT' });
  assert.equal(publicMediaUrl('https://media.example/film.mp4'), true);
});

test('legacy unsafe hosted media cannot enter generated source or export', async () => {
  const spec = starterChannel('Legacy channel');
  const unsafe = { ...spec, brand: { ...spec.brand, heroArtwork: 'http://localhost/private-cover.png' } };
  let sourceReads = 0;
  const repository = { async read() { return { id: spec.id, revision: 1, spec: unsafe }; },
    async source() { sourceReads++; return { files: {}, baseline: {}, fingerprint: '', specRevision: 1 }; } } as unknown as HostedProjectRepository;
  const principal = {} as AuthenticatedPrincipal;
  const workspace = new HostedWorkspaceService(repository);
  await assert.rejects(workspace.generate(principal, spec.id), { code: 'INVALID_INPUT' });
  await assert.rejects(workspace.exportSource(principal, spec.id), { code: 'INVALID_INPUT' });
  assert.equal(sourceReads, 0, 'unsafe legacy spec is rejected before source is read or generated');
});
