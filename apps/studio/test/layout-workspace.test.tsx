import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { applyMutation } from '@firelaunch/channel-engine';
import type { ChannelProject } from '@firelaunch/contracts';
import { fixtureChannel } from '../../../packages/channel-engine/test/fixtures.js';
import App from '../src/App.js';
import { catalogContentId, eligibleStaticImageContent } from '../src/Preview.js';
import type { CatalogSnapshot } from '../src/api.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.example/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { cleanup, fireEvent, render, screen, waitFor, within } = await import('@testing-library/react');
const spec = fixtureChannel();
const secondPageId = `page_${'5'.repeat(32)}`;
spec.navigation.push(secondPageId);
spec.pages.push({ id: secondPageId, title: 'Explore', modules: [{ id: `mod_${'6'.repeat(32)}`, kind: 'grid', title: 'Films', contentIds: [] }] });
const first: ChannelProject = { id: spec.id, spec, revision: 1, createdAt: '2026-10-21T00:00:00Z', updatedAt: '2026-10-21T00:00:00Z' };
const second: ChannelProject = { ...first, id: `ch_${'b'.repeat(32)}`, spec: { ...fixtureChannel(), id: `ch_${'b'.repeat(32)}`, title: 'Other channel' } };
const session = { accountId: `cr_${'a'.repeat(32)}`, email: 'owner@example.com', csrfToken: 'csrf', expiresAt: '2099-01-01T00:00:00.000Z' };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('static image picker admits only owned display-cleared catalog artwork', () => {
  const owner = session.accountId, project = { ...first, spec: { ...first.spec, content: [{ ...first.spec.content[0]!, id: catalogContentId(`ci_${'9'.repeat(32)}`) }] } };
  const itemId = `ci_${'9'.repeat(32)}`, assetId = `ma_${'8'.repeat(32)}`, sourceId = `src_${'7'.repeat(32)}`;
  const snapshot = { creatorAccountId: owner, projectId: project.id,
    items: [{ id: itemId, creatorAccountId: owner, projectId: project.id, sourceRecord: { sourceId }, mediaAssetIds: [assetId] }],
    mediaAssets: [{ id: assetId, creatorAccountId: owner, projectId: project.id, catalogItemId: itemId, kind: 'artwork', deliveryEligible: true,
      tvDisplayRights: { status: 'cleared', permittedUse: 'television_display' } }],
    sources: [{ id: sourceId, creatorAccountId: owner, projectId: project.id, state: 'verified', permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted' } }] } as unknown as CatalogSnapshot;
  assert.equal(eligibleStaticImageContent(project.spec, snapshot, owner).length, 1);
  assert.deepEqual(eligibleStaticImageContent(project.spec, snapshot, second.id), []);
  assert.deepEqual(eligibleStaticImageContent(project.spec, { ...snapshot, mediaAssets: [{ ...snapshot.mediaAssets[0]!, creatorAccountId: second.id }] }, owner), []);
  assert.deepEqual(eligibleStaticImageContent(project.spec, { ...snapshot, mediaAssets: [{ ...snapshot.mediaAssets[0]!, tvDisplayRights: { status: 'revoked', basis: 'creator_asserted', permittedUse: 'television_display' } }] }, owner), []);
  assert.deepEqual(eligibleStaticImageContent(project.spec, { ...snapshot, mediaAssets: [{ ...snapshot.mediaAssets[0]!,
    tvDisplayRights: { status: 'unknown', basis: 'none', permittedUse: 'none' },
    tvPlaybackRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_playback' } }] }, owner), []);
});

test('Pages & Layout selection, rename, guarded deletion and account-safe project switch', async () => {
  let current = first;
  const writes: string[] = [];
  const previous = globalThis.fetch;
  const originalConfirm = window.confirm;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/session') return json(session);
    if (url === '/api/projects') return json([current, second]);
    if (url === `/api/projects/${first.id}`) return json(current);
    if (url === `/api/projects/${second.id}`) return json(second);
    if (url === `/api/projects/${first.id}/mutations`) {
      const { mutation } = JSON.parse(String(init?.body));
      writes.push(mutation.type);
      current = { ...current, revision: current.revision + 1, spec: applyMutation(current.spec, mutation) };
      return json(current);
    }
    throw new Error(`Unexpected ${url}`);
  }) as typeof fetch;
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel Wild Earth` });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    assert.equal(screen.getByRole('button', { name: 'Pages & Layout' }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(within(screen.getByRole('group', { name: 'Channel views' })).getAllByRole('button').map(button => button.textContent), ['Pages & Layout', 'Appearance']);
    const preview = screen.getByRole('region', { name: 'Interactive TV Preview' });
    assert.equal(screen.getAllByRole('region', { name: 'Interactive TV Preview' }).length, 1);
    const root = document.getElementById('channel-fullscreen-root')!;
    assert.deepEqual(Array.from(root.children).map(child => child.className), ['channel-dock', 'channel-tv-stage']);
    const dock = screen.getByRole('region', { name: 'Channel editor rail' });
    assert.ok(dock.contains(screen.getByRole('group', { name: 'Channel views' })));
    assert.ok(root.querySelector('.channel-tv-stage')?.contains(preview));
    assert.ok(preview.contains(screen.getByLabelText('Virtual remote')));
    assert.equal(root.querySelectorAll('.tv-frame').length, 1);
    assert.equal(root.querySelectorAll('.channel-stage-action').length, 1);
    assert.equal(root.querySelectorAll('.remote-bar').length, 1);
    const controls = preview.querySelector('.preview-heading')!;
    assert.deepEqual(Array.from(preview.children).map(child => child.className), ['tv-frame', 'preview-heading', 'remote-bar']);
    assert.ok(controls.contains(screen.getByRole('button', { name: 'View full screen' })));
    assert.equal(root.querySelectorAll('.channel-editor').length, 1);
    const editor = dock.querySelector('.channel-editor')!;
    assert.equal(screen.queryByRole('complementary', { name: 'Layout inspector' }), null);
    let rail = screen.getByRole('navigation', { name: 'Channel pages' });
    assert.equal(within(rail).getByRole('button', { name: 'Home' }).getAttribute('aria-current'), 'page');
    assert.match(rail.textContent ?? '', /PAGES · 1 OF 2/);
    assert.equal((within(rail).getByRole('combobox', { name: 'Go to page' }) as HTMLSelectElement).options.length, 2);
    assert.ok(within(rail).getByRole('button', { name: 'New page' }));
    const homeSection = screen.getByRole('region', { name: 'hero section 1' });
    assert.ok(within(homeSection).getByText('Oceans'));
    const editSection = within(homeSection).getByRole('button', { name: 'Edit section' });
    editSection.focus(); fireEvent.click(editSection);
    const inspector = screen.getByRole('complementary', { name: 'Layout inspector' });
    await waitFor(() => assert.equal(document.activeElement, within(inspector).getByRole('button', { name: 'Close layout inspector' })));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => assert.equal(screen.queryByRole('complementary', { name: 'Layout inspector' }), null));
    await waitFor(() => assert.equal(document.activeElement, editSection));
    fireEvent.change(within(rail).getByRole('combobox', { name: 'Go to page' }), { target: { value: secondPageId } });
    assert.match(rail.textContent ?? '', /PAGES · 2 OF 2/);
    assert.ok(screen.getByText('Choose content for Films.'));
    await waitFor(() => assert.ok(within(preview).getByRole('heading', { name: 'Films' })));
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    assert.equal(screen.getByRole('region', { name: 'Interactive TV Preview' }), preview);
    assert.equal(dock.querySelector('.channel-editor'), editor);
    const appearance = within(dock).getByRole('complementary', { name: 'Appearance editor' });
    fireEvent.change(within(appearance).getByRole('textbox', { name: 'DISPLAY NAME' }), { target: { value: 'Wild Earth TV' } });
    const saveName = within(appearance).getByRole('button', { name: 'Save name' });
    fireEvent.click(saveName);
    await waitFor(() => assert.equal(current.spec.title, 'Wild Earth TV'));
    await waitFor(() => assert.equal((saveName as HTMLButtonElement).disabled, true));
    fireEvent.change(within(appearance).getByRole('textbox', { name: 'DISPLAY NAME' }), { target: { value: 'Unsaved name' } });
    window.confirm = () => false;
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Layout' }));
    assert.equal(screen.getByRole('button', { name: 'Appearance' }).getAttribute('aria-pressed'), 'true');
    window.confirm = () => true;
    writes.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Layout' }));
    rail = screen.getByRole('navigation', { name: 'Channel pages' });
    assert.equal(screen.getByRole('region', { name: 'Interactive TV Preview' }), preview);
    assert.equal(dock.querySelector('.channel-editor'), editor);
    assert.equal(screen.queryByRole('button', { name: 'Close TV Preview' }), null);
    assert.equal(screen.queryByRole('button', { name: 'AI Assistant' }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Edit page' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'PAGE NAME' }), { target: { value: 'Home' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename page' }));
    assert.match(screen.getByRole('alert').textContent ?? '', /already exists/);
    assert.deepEqual(writes, []);
    fireEvent.change(screen.getByRole('textbox', { name: 'PAGE NAME' }), { target: { value: 'Discover' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename page' }));
    await waitFor(() => assert.ok(within(rail).getByRole('button', { name: 'Discover' })));
    window.confirm = () => false;
    fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
    assert.deepEqual(writes, ['updatePage']);
    window.confirm = () => true;
    fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
    await waitFor(() => assert.equal(current.spec.pages.length, 1));
    assert.ok(within(rail).getByRole('button', { name: 'Home' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit page' }));
    assert.equal((screen.getByRole('button', { name: 'Delete page' }) as HTMLButtonElement).disabled, true);
    fireEvent.click(screen.getByRole('button', { name: /Switch workspace, current channel/ }));
    fireEvent.click(screen.getByRole('button', { name: second.spec.title }));
    await screen.findByRole('button', { name: `Switch workspace, current channel Other channel` });
    assert.equal(screen.getAllByRole('region', { name: 'Interactive TV Preview' }).length, 1);
    assert.notEqual(screen.getByRole('region', { name: 'Interactive TV Preview' }), preview);
    assert.equal(screen.queryByRole('complementary', { name: 'Layout inspector' }), null);
    assert.equal(screen.queryByText('Discover'), null);
  } finally { cleanup(); globalThis.fetch = previous; window.confirm = originalConfirm; dom.window.history.replaceState(null, '', '/'); }
});

test('layout controls remain accessible in narrow flow', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.channel-presentation\{grid-template-columns:clamp\(340px,39%,520px\) minmax\(0,1fr\);grid-template-rows:minmax\(0,1fr\)\}/);
  assert.match(css, /\.channel-dock-body\{overflow-y:auto;overscroll-behavior:contain\}/);
  const composition = css.split('/* C8-UI3 P2:')[1];
  assert.ok(composition);
  assert.match(composition, /\.channel-presentation\{grid-template-columns:clamp\(360px,32%,440px\) minmax\(0,1fr\)\}/);
  assert.match(composition, /\.channel-tv-stage \.tv-frame\{width:min\(100%,calc\(\(100cqh - 220px\)\*16\/9\)\);max-height:calc\(100cqh - 220px\);aspect-ratio:16\/9;flex:none;border:0;border-radius:0;box-shadow:none\}/);
  assert.match(composition, /\.channel-tv-stage \.remote-bar\{order:2;position:static/);
  assert.match(composition, /\.channel-tv-stage \.remote-bar\{[^}]*width:194px;[^}]*background:#1b1e20/);
  assert.match(composition, /\.channel-tv-stage \.remote button\{min-width:34px;height:34px;min-height:34px\}/);
  assert.match(composition, /@media\(max-height:760px\)\{\.channel-presentation:not\(\.preview-fullscreen\) \.channel-tv-stage \.remote-bar span\{display:none\}\}/);
  assert.match(composition, /\.preview-fullscreen \.channel-tv-stage \.preview-heading\{position:absolute/);
  assert.match(css, /@media\(max-width:1000px\)[\s\S]*\.channel-presentation\{height:auto;min-height:0;display:flex;flex-direction:column\}/);
  assert.ok(css.lastIndexOf('.tv-hero .tv-card,.preview-fullscreen .tv-hero .tv-card{width:min(58%,42.66cqh)}') > css.lastIndexOf('.preview-fullscreen .tv-hero .tv-card{width:min(100%,42em)}'));
});

test('saved owner artwork resolves to the same private image in editor and TV', async () => {
  const originalFetch = globalThis.fetch, create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  const itemId = `ci_${'8'.repeat(32)}`, assetId = `ma_${'9'.repeat(32)}`, objectId = `ma_${'a'.repeat(32)}`;
  const sourceId = `src_${'a'.repeat(32)}`, externalId = { provider: 'creator', kind: 'upload_id', value: 'owned-film' };
  const unknown = { status: 'unknown', basis: 'none', permittedUse: 'none' };
  const contentId = catalogContentId(itemId);
  const ownedSpec = fixtureChannel();
  ownedSpec.content[0] = { ...ownedSpec.content[0]!, id: contentId, artwork: 'assets/catalog-placeholder.png' };
  const hero = ownedSpec.pages[0]!.modules[0]!;
  if (hero.kind !== 'hero' && hero.kind !== 'rail' && hero.kind !== 'grid') throw new Error('Expected artwork section');
  hero.contentIds = [contentId];
  const project = { ...first, spec: ownedSpec };
  URL.createObjectURL = () => 'blob:https://studio.example/owned-preview';
  URL.revokeObjectURL = () => {};
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input); requests.push(path);
    if (path === '/api/auth/session') return json(session);
    if (path === '/api/projects') return json([project]);
    if (path === `/api/projects/${project.id}`) return json(project);
    if (path === `/api/projects/${project.id}/catalog`) return json({ schemaVersion: 1, revision: 1, projectId: project.id, creatorAccountId: session.accountId,
      sources: [{ schemaVersion: 1, id: sourceId, projectId: project.id, creatorAccountId: session.accountId, type: 'creator_upload', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' } }], collections: [],
      items: [{ schemaVersion: 1, id: itemId, projectId: project.id, creatorAccountId: session.accountId, kind: 'video', mediaAssetIds: [assetId], sourceRecord: { sourceId, externalId, observedAt: '2026-10-21T00:00:00.000Z', metadata: { title: 'Oceans' } }, externalIdentifiers: [externalId] }],
      mediaAssets: [{ schemaVersion: 1, id: assetId, projectId: project.id, creatorAccountId: session.accountId, catalogItemId: itemId, kind: 'artwork', location: { type: 'private_object', objectId }, tvDisplayRights: unknown, tvPlaybackRights: unknown, deliveryEligible: false }] });
    if (path.endsWith('/capability')) return json({ capability: 'private-header' });
    if (path.endsWith('/content')) {
      assert.equal(new Headers(init?.headers).get('x-private-capability'), 'private-header');
      return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'content-type': 'image/jpeg' } });
    }
    throw new Error(`Unexpected ${path}`);
  }) as typeof fetch;
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: 'Switch workspace, current channel Wild Earth' });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    const editor = screen.getByRole('region', { name: 'hero section 1' });
    const tv = screen.getByRole('region', { name: 'Interactive TV Preview' });
    await waitFor(() => assert.equal(editor.querySelector('.layout-tile img')?.getAttribute('src'), 'blob:https://studio.example/owned-preview'), { onTimeout: () => new Error(requests.join('\n')) });
    await waitFor(() => assert.equal(tv.querySelector('.tv-art img')?.getAttribute('src'), 'blob:https://studio.example/owned-preview'));
    assert.doesNotMatch(document.body.innerHTML, /private-header|private-objects/);
  } finally { cleanup(); globalThis.fetch = originalFetch; URL.createObjectURL = create; URL.revokeObjectURL = revoke; dom.window.history.replaceState(null, '', '/'); }
});

test('Image + Text section saves bounded text and preset through the normal mutation path', async () => {
  let current = first;
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/session') return json(session);
    if (url === '/api/projects') return json([current]);
    if (url === `/api/projects/${current.id}`) return json(current);
    if (url === `/api/projects/${current.id}/mutations`) {
      const { mutation } = JSON.parse(String(init?.body));
      current = { ...current, revision: current.revision + 1, spec: applyMutation(current.spec, mutation) };
      return json(current);
    }
    throw new Error(`Unexpected ${url}`);
  }) as typeof fetch;
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel Wild Earth` });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Layout' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Section type' }), { target: { value: 'image-text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    await waitFor(() => assert.equal(current.spec.pages[0]?.modules.at(-1)?.kind, 'image-text'));
    const inspector = screen.getByRole('complementary', { name: 'Layout inspector' });
    fireEvent.change(within(inspector).getByRole('textbox', { name: 'Section text' }), { target: { value: 'Our original story' } });
    fireEvent.click(within(inspector).getByText('Customize'));
    fireEvent.change(within(inspector).getByRole('combobox', { name: 'Image side' }), { target: { value: 'right' } });
    fireEvent.click(within(inspector).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => { const module = current.spec.pages[0]?.modules.at(-1); assert.equal(module?.kind === 'image-text' ? module.body : undefined, 'Our original story'); });
    const saved = current.spec.pages[0]?.modules.at(-1);
    assert.equal(saved?.kind === 'image-text' ? saved.imageSide : undefined, 'right');
    assert.match(within(inspector).getByRole('status').textContent ?? '', /Saved privately/);
  } finally { cleanup(); globalThis.fetch = previous; dom.window.history.replaceState(null, '', '/'); }
});

test('section edits reorder by stable IDs, preserve Library references and retain failed drafts', async () => {
  let current = first;
  let fail = false;
  const originalFetch = globalThis.fetch;
  const originalConfirm = window.confirm;
  const writes: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/auth/session') return json(session);
    if (url === '/api/projects') return json([current, second]);
    if (url === `/api/projects/${current.id}`) return json(current);
    if (url === `/api/projects/${first.id}/section-content` && !init?.method) return json({
      projectRevision: current.revision, catalogRevision: 1,
      items: [{ itemId: `ci_${'9'.repeat(32)}`, contentId: current.spec.content[0]!.id,
        kind: 'video', title: 'Oceans' }]
    });
    if (url === `/api/projects/${first.id}/section-content` && init?.method === 'POST') {
      const choice = JSON.parse(String(init.body)) as { pageId: string; moduleId: string; itemId: string; selected: boolean };
      writes.push('section-content');
      const module = current.spec.pages.flatMap(page => page.modules).find(value => value.id === choice.moduleId)!;
      if (module.kind === 'hero' || module.kind === 'rail' || module.kind === 'grid') {
        current = { ...current, revision: current.revision + 1, spec: applyMutation(current.spec, {
          type: 'updateModule', pageId: choice.pageId, module: { ...module,
            contentIds: choice.selected ? [...module.contentIds, current.spec.content[0]!.id] : [] }
        }) };
      }
      return json(current);
    }
    if (url === `/api/projects/${first.id}/mutations`) {
      const { mutation } = JSON.parse(String(init?.body));
      writes.push(mutation.type);
      if (fail) return new Response(JSON.stringify({ error: 'Save unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } });
      current = { ...current, revision: current.revision + 1, spec: applyMutation(current.spec, mutation) };
      return json(current);
    }
    throw new Error(`Unexpected ${url}`);
  }) as typeof fetch;
  try {
    render(createElement(App));
    await screen.findByRole('button', { name: `Switch workspace, current channel Wild Earth` });
    fireEvent.click(screen.getByRole('button', { name: 'Channel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pages & Layout' }));
    const section = screen.getByRole('region', { name: 'hero section 1' });
    fireEvent.click(within(section).getByRole('button', { name: 'Edit section' }));
    const inspector = screen.getByRole('complementary', { name: 'Layout inspector' });
    assert.equal((await within(inspector).findByRole('checkbox', { name: 'Oceans' }) as HTMLInputElement).checked, true);
    assert.ok(within(inspector).getByText('Choose content'));
    const originalMedia = current.spec.content[0]?.mediaUrl;
    fireEvent.click(within(inspector).getByRole('checkbox', { name: 'Oceans' }));
    await waitFor(() => assert.deepEqual((current.spec.pages[0]?.modules[0] as { contentIds: string[] }).contentIds, []));
    fireEvent.click(within(inspector).getByRole('checkbox', { name: 'Oceans' }));
    await waitFor(() => assert.equal((current.spec.pages[0]?.modules[0] as { contentIds: string[] }).contentIds[0], current.spec.content[0]?.id));
    assert.equal(current.spec.content[0]?.mediaUrl, originalMedia);
    fireEvent.click(within(inspector).getByRole('button', { name: 'Close layout inspector' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Section type' }), { target: { value: 'text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    await waitFor(() => assert.equal(current.spec.pages[0]?.modules.length, 2));
    const textId = current.spec.pages[0]!.modules[1]!.id;
    const editor = screen.getByRole('complementary', { name: 'Layout inspector' });
    fireEvent.change(within(editor).getByRole('textbox', { name: 'Section text' }), { target: { value: 'Our story' } });
    window.confirm = () => false;
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    assert.ok(screen.getByRole('complementary', { name: 'Layout inspector' }));
    fail = true;
    fireEvent.click(within(editor).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => assert.match(within(editor).getByRole('alert').textContent ?? '', /Save failed/));
    assert.equal((within(editor).getByRole('textbox', { name: 'Section text' }) as HTMLTextAreaElement).value, 'Our story');
    fail = false;
    fireEvent.click(within(editor).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => assert.equal(current.spec.pages[0]?.modules[1]?.kind === 'text' && current.spec.pages[0]?.modules[1]?.body, 'Our story'));
    fireEvent.click(within(editor).getByRole('button', { name: 'Close layout inspector' }));
    const move = screen.getByRole('button', { name: 'Move About up' });
    move.focus(); fireEvent.click(move);
    await waitFor(() => assert.equal(current.spec.pages[0]?.modules[0]?.id, textId));
    assert.equal(document.activeElement, move);
    window.confirm = () => false;
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove section' })[0]!);
    assert.equal(current.spec.pages[0]?.modules.length, 2);
    window.confirm = () => true;
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove section' })[0]!);
    await waitFor(() => assert.equal(current.spec.pages[0]?.modules.length, 1));
    assert.equal(current.spec.content[0]?.title, 'Oceans');
    assert.deepEqual(writes.slice(0, 2), ['section-content', 'section-content']);
    assert.ok(writes.includes('reorderModules'));
  } finally { cleanup(); globalThis.fetch = originalFetch; window.confirm = originalConfirm; dom.window.history.replaceState(null, '', '/'); }
});
