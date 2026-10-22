import { createHash } from 'node:crypto';
import { channelSpecSchema, createPageFromTemplate, type ChannelSpec, type ContentItem, type Module, type Page } from '@firelaunch/contracts';
import { starterChannel } from '@firelaunch/channel-engine';
import type { CatalogProjection } from './catalog-projection.js';

export type CompositionKind = 'video' | 'audio' | 'writing';
export type CompositionResult = {
  spec: ChannelSpec;
  // Persist this safe, generated baseline alongside the applied bindings in a later checkpoint.
  // It is the three-way merge ancestor, never a replacement for the creator's current spec.
  baseline: ChannelSpec;
  notices: string[];
};

function stableId(kind: 'page' | 'mod', channelId: string, role: string): string {
  return `${kind}_${createHash('sha256').update('catalog-composition-v1\0').update(channelId).update('\0').update(role).digest('hex').slice(0, 32)}`;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const unique = (ids: string[]): string[] => [...new Set(ids)];

/** A deterministic, export-safe draft; persistence and authenticated selection are separate. */
export function composeCatalogDraft(kind: CompositionKind, current: ChannelSpec,
  projection: CatalogProjection, previous?: ChannelSpec): CompositionResult {
  current = channelSpecSchema.parse(current);
  if (previous) {
    previous = channelSpecSchema.parse(previous);
    if (previous.id !== current.id) throw new Error('Composition baseline belongs to another channel');
  }
  // Removing a generated video from the channel is an explicit editorial choice.
  // A later Generate with the old saved catalog selection must not add it back.
  // The one-video Publish action can add it to current again, which clears this omission.
  const priorContent = new Set(previous?.content.map(item => item.id) ?? []);
  const currentContent = new Set(current.content.map(item => item.id));
  const withheld = new Set(projection.bindings.filter(binding => kind === 'video' &&
    priorContent.has(binding.contentId) && !currentContent.has(binding.contentId))
    .map(binding => binding.contentId));
  const blocked = projection.bindings.filter(binding => binding.baseline === null);
  const selectedEligible = projection.bindings.filter(binding => binding.baseline !== null).map(binding => binding.baseline!)
    .filter(item => kind === 'writing' || item.presentation === kind);
  const eligible = selectedEligible.filter(item => !withheld.has(item.id));
  const ofType = (type: ContentItem['presentation']) => eligible.filter(item => item.presentation === type).map(item => item.id);
  const video = ofType('video'), audio = ofType('audio'), books = ofType('information');
  const allowed = new Set(eligible.map(item => item.id));
  const collections = (collectionKind: string) => projection.collections.filter(c => c.kind === collectionKind)
    .map(c => ({ id: c.id, title: c.title, ids: unique(c.contentIds.filter(id => allowed.has(id))) })).filter(c => c.ids.length).slice(0, 25);
  const page = (role: string, title: string, modules: Module[]): Page => ({ id: stableId('page', current.id, `${kind}:${role}`), title, modules });
  const hero = (role: string, ids: string[], title: string): Module =>
    ({ id: stableId('mod', current.id, `${kind}:${role}`), kind: 'hero', title, contentIds: ids.slice(0, 1) });
  const rail = (role: string, title: string, ids: string[]): Module =>
    ({ id: stableId('mod', current.id, `${kind}:${role}`), kind: 'rail', title, contentIds: unique(ids).slice(0, 100) });
  const grid = (role: string, title: string, ids: string[]): Module =>
    ({ id: stableId('mod', current.id, `${kind}:${role}`), kind: 'grid', title, contentIds: unique(ids).slice(0, 100) });
  const text = (role: string, title: string, body: string): Module =>
    ({ id: stableId('mod', current.id, `${kind}:${role}`), kind: 'text', title, body });
  const notice = blocked.length ? `${blocked.length} selected work${blocked.length === 1 ? '' : 's'} need rights, delivery, or source review before TV use.` : '';
  let pages: Page[];
  if (kind === 'video') {
    pages = [page('screen', 'Featured', [
      hero('feature', video, 'Featured film'),
      text('intro', 'Watch', video.length ? 'Explore films and series from this creator.' : 'No licensed video is ready for playback yet.'),
      rail('films', 'Films and episodes', video),
      ...collections('featured').map(c => rail(`featured:${c.id}`, c.title, c.ids.filter(id => video.includes(id)))),
      ...(notice ? [text('review', 'Needs review', notice)] : [])
    ]), page('series', 'Series', [
      text('series-intro', 'Series', 'Choose an episode to view its details and start playback.'),
      ...collections('series').map(c => rail(`series:${c.id}`, c.title, c.ids.filter(id => video.includes(id)))),
      grid('library', 'Video library', video)
    ])];
  } else if (kind === 'audio') {
    pages = [page('listen', 'Listen', [
      hero('featured', audio, 'Featured listening'),
      text('intro', 'Listen', audio.length ? 'Browse albums and playlists, then choose a track to listen.' : 'No licensed audio is ready for listening yet.'),
      rail('tracks', 'Tracks and episodes', audio),
      ...(notice ? [text('review', 'Needs review', notice)] : [])
    ]), page('albums', 'Albums & playlists', [
      ...collections('album').slice(0, 12).map(c => rail(`album:${c.id}`, c.title, c.ids.filter(id => audio.includes(id)))),
      ...collections('playlist').slice(0, 12).map(c => rail(`playlist:${c.id}`, c.title, c.ids.filter(id => audio.includes(id)))),
      grid('library', 'Listening library', audio),
      ...(!audio.length ? [text('empty-library', 'Listening library', 'Add approved audio with cleared playback rights to fill this page.')] : [])
    ])];
  } else {
    pages = [page('author', 'Author', [
      text('intro', 'About this author', books.length ? 'Explore books, then open each title for its description.' : 'No reviewed books are selected yet.'),
      hero('book', books, 'Featured book'),
      rail('readings', 'Companion readings and interviews', [...audio, ...video]),
      ...(notice ? [text('review', 'Needs review', notice)] : [])
    ]), page('bookshelf', 'Bookshelf', [
      ...collections('bookshelf').map(c => rail(`shelf:${c.id}`, c.title, c.ids.filter(id => books.includes(id)))),
      grid('books', 'Books', books),
      text('reading-note', 'About playback', 'Books open informational details. Only cleared companion audio or video can play.')
    ])];
  }
  // Empty rails are omitted; text supplies a visible empty/review state instead.
  pages = pages.map(p => ({ ...p, modules: p.modules.filter(m => m.kind === 'text' || m.kind === 'image-banner' || m.kind === 'image-text' || m.contentIds.length) }));
  const generated = channelSpecSchema.parse({ ...current, navigation: pages.map(p => p.id), pages, content: eligible });
  const oldPages = new Map(previous?.pages.map(p => [p.id, p]));
  const oldContent = new Map(previous?.content.map(c => [c.id, c]));
  const currentPages = new Map(current.pages.map(p => [p.id, p]));
  const generatedIds = new Set(pages.map(p => p.id));
  const revoked = new Set(projection.bindings.filter(b => !b.baseline).map(b => b.contentId));
  const mergeModule = (candidate: Module, edited: Module | undefined, ancestor: Module | undefined): Module => {
    if (!edited) return candidate;
    if (!ancestor) throw new Error(`Generated module ID collides with creator module: ${candidate.id}`);
    if (same(edited, ancestor)) return candidate;
    if (edited.kind !== candidate.kind) return edited;
    if (edited.kind === 'text' || edited.kind === 'image-banner' || edited.kind === 'image-text' || candidate.kind === 'text' || candidate.kind === 'image-banner' || candidate.kind === 'image-text') return edited;
    return { ...edited, contentIds: edited.contentIds.filter(id => !revoked.has(id)) };
  };
  const mergedPages = pages.flatMap(candidate => {
    const edited = currentPages.get(candidate.id);
    const ancestor = oldPages.get(candidate.id);
    if (!edited && ancestor) return []; // Creator deleted this generated page.
    if (!edited) return [candidate];
    if (!ancestor) throw new Error(`Generated page ID collides with creator page: ${candidate.id}`);
    const priorModules = new Map(ancestor.modules.map(m => [m.id, m]));
    const editedModules = new Map(edited.modules.map(m => [m.id, m]));
    const candidates = new Map(candidate.modules.map(m => [m.id, m]));
    const order = same(edited.modules.map(m => m.id), ancestor.modules.map(m => m.id))
      ? candidate.modules.map(m => m.id)
      : unique([...edited.modules.map(m => m.id), ...candidate.modules.filter(m => !priorModules.has(m.id)).map(m => m.id)]);
    return [{ ...edited, title: edited.title === ancestor.title ? candidate.title : edited.title,
      modules: order.flatMap(id => {
        const fresh = candidates.get(id), manual = editedModules.get(id), old = priorModules.get(id);
        if (old && !manual) return [];
        if (!fresh) return manual ? [manual] : [];
        return [mergeModule(fresh, manual, old)];
      }) }];
  });
  const untouchedStarter = !previous && current.pages.length === 1 && current.content.length === 0 && !!current.pages[0] &&
    (current.pages[0].modules.length === 0 ||
      same(current.pages[0], createPageFromTemplate(current.pages[0].id, 'Home', 'hero')) ||
      same(current.pages[0], starterChannel(current.title, current.id, current.pages[0].id).pages[0]));
  const manualPages = untouchedStarter ? [] : current.pages.filter(p => !generatedIds.has(p.id) && !oldPages.has(p.id));
  const manualContent = current.content.filter(c => !oldContent.has(c.id) && !allowed.has(c.id) && !revoked.has(c.id));
  const content = [...eligible.map(candidate => {
    const edited = current.content.find(c => c.id === candidate.id);
    const ancestor = oldContent.get(candidate.id);
    if (!edited) return candidate;
    if (!ancestor) throw new Error(`Generated content ID collides with creator content: ${candidate.id}`);
    return { ...candidate,
      title: edited.title === ancestor.title ? candidate.title : edited.title,
      description: edited.description === ancestor.description ? candidate.description : edited.description };
  }), ...manualContent];
  const validContent = new Set(content.map(c => c.id));
  const sanitized = [...mergedPages, ...manualPages].map(p => ({ ...p, modules: p.modules.map(m => {
    if (m.kind === 'text') return m;
    if (m.kind === 'image-banner' || m.kind === 'image-text') {
      if (!m.imageContentId || validContent.has(m.imageContentId)) return m;
      const { imageContentId: _removed, ...withoutImage } = m;
      return withoutImage;
    }
    return { ...m, contentIds: m.contentIds.filter(id => validContent.has(id)) };
  }) }));
  let navigation = previous && !same(current.navigation, previous.navigation)
    ? unique([...current.navigation.filter(id => sanitized.some(p => p.id === id)), ...mergedPages.map(p => p.id)])
    : unique([...mergedPages.map(p => p.id), ...manualPages.map(p => p.id)]);
  const spec = channelSpecSchema.parse({ ...current, pages: sanitized, navigation, content });
  // Keep withheld IDs in the merge ancestor so repeated Generate calls cannot
  // forget the removal after the first regeneration.
  const baseline = channelSpecSchema.parse({ ...generated, content: selectedEligible });
  return { spec, baseline, notices: [
    ...blocked.map(b => `${b.contentId}: ${b.blockedReason ?? 'unavailable'}`),
    ...(eligible.length ? [] : ['No selected content is currently eligible for this draft.'])
  ] };
}
