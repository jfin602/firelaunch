import type { ChannelSpec, ContentItem, Brand } from '@firelaunch/contracts';

function isPlayableContent(item: ContentItem): boolean {
  return item.presentation !== 'information' && typeof item.mediaUrl === 'string';
}

export type TvModule = {
  id: string; kind: 'hero' | 'rail' | 'grid' | 'text' | 'image-banner' | 'image-text'; title?: string; body?: string;
  items: ContentItem[]; image?: { id: string; artwork: string };
  crop?: 'cover' | 'contain'; alignment?: 'left' | 'center'; spacing?: 'comfortable' | 'compact';
  background?: 'theme' | 'surface'; imageSide?: 'left' | 'right';
};
export type TvPage = { id: string; title: string; modules: TvModule[] };
export type Television = {
  id: string; title: string; brand: Brand; playback: ChannelSpec['playback']; pages: TvPage[];
};
export type TvCommand = 'up' | 'down' | 'left' | 'right' | 'select' | 'back';
export type TvState =
  | { screen: 'page'; pageId: string; focusId: string }
  | { screen: 'detail'; pageId: string; itemId: string; returnFocusId: string; focusId: string }
  | { screen: 'playback'; pageId: string; itemId: string; returnFocusId: string; focusId: string };

export function projectTelevision(spec: ChannelSpec): Television {
  const pages = new Map(spec.pages.map(page => [page.id, page]));
  const content = new Map(spec.content.map(item => [item.id, item]));
  return {
    id: spec.id, title: spec.title, brand: spec.brand, playback: spec.playback,
    pages: spec.navigation.map(pageId => {
      const page = pages.get(pageId);
      if (!page) throw new Error(`Unknown page: ${pageId}`);
      return { id: page.id, title: page.title, modules: page.modules.map(module => {
        const image = (module.kind === 'image-banner' || module.kind === 'image-text') && module.imageContentId
          ? content.get(module.imageContentId) : undefined;
        if ((module.kind === 'image-banner' || module.kind === 'image-text') && module.imageContentId && !image)
          throw new Error(`Unknown image content: ${module.imageContentId}`);
        const ids = module.kind === 'hero' || module.kind === 'rail' || module.kind === 'grid' ? module.contentIds : [];
        return { id: module.id, kind: module.kind,
          ...(module.title ? { title: module.title } : {}),
          ...('body' in module ? { body: module.body } : {}),
          ...('crop' in module && module.crop ? { crop: module.crop } : {}),
          ...('alignment' in module && module.alignment ? { alignment: module.alignment } : {}),
          ...('spacing' in module && module.spacing ? { spacing: module.spacing } : {}),
          ...('background' in module && module.background ? { background: module.background } : {}),
          ...('imageSide' in module && module.imageSide ? { imageSide: module.imageSide } : {}),
          ...(image ? { image: { id: image.id, artwork: image.artwork } } : {}),
          items: ids.map(itemId => {
            const item = content.get(itemId);
            if (!item) throw new Error(`Unknown content: ${itemId}`);
            return item;
          })
        };
      }) };
    })
  };
}

export function navFocusId(pageId: string): string { return `nav:${pageId}`; }
export function itemFocusId(pageId: string, moduleId: string, itemId: string): string {
  return `item:${pageId}:${moduleId}:${itemId}`;
}

export function focusRows(tv: Television, pageId: string): string[][] {
  const page = tv.pages.find(candidate => candidate.id === pageId);
  if (!page) throw new Error(`Unknown page: ${pageId}`);
  return [tv.pages.map(candidate => navFocusId(candidate.id)), ...page.modules
    .filter(module => module.items.length > 0)
    .map(module => module.items.map(item => itemFocusId(page.id, module.id, item.id)))];
}

export function initialState(tv: Television): TvState {
  const page = tv.pages[0];
  if (!page) throw new Error('Television requires a navigation page');
  return { screen: 'page', pageId: page.id, focusId: navFocusId(page.id) };
}

export function transition(tv: Television, state: TvState, command: TvCommand): TvState {
  if (state.screen === 'playback') {
    return command === 'back' ? { ...state, screen: 'detail', focusId: `play:${state.itemId}` } : state;
  }
  if (state.screen === 'detail') {
    if (command === 'back') return { screen: 'page', pageId: state.pageId, focusId: state.returnFocusId };
    const item = activeItem(tv, state);
    if (command === 'select' && item && isPlayableContent(item)) {
      return { ...state, screen: 'playback', focusId: `player:${state.itemId}` };
    }
    return state;
  }
  const rows = focusRows(tv, state.pageId);
  const rowIndex = rows.findIndex(row => row.includes(state.focusId));
  if (rowIndex < 0) return { screen: 'page', pageId: state.pageId, focusId: navFocusId(state.pageId) };
  if (command === 'back') return { screen: 'page', pageId: state.pageId, focusId: navFocusId(state.pageId) };
  const column = rows[rowIndex]!.indexOf(state.focusId);
  if (command === 'left' || command === 'right') {
    const next = rows[rowIndex]![column + (command === 'left' ? -1 : 1)];
    return next ? { ...state, focusId: next } : state;
  }
  if (command === 'up' || command === 'down') {
    const nextRow = rows[rowIndex + (command === 'up' ? -1 : 1)];
    return nextRow ? { ...state, focusId: nextRow[Math.min(column, nextRow.length - 1)]! } : state;
  }
  if (state.focusId.startsWith('nav:')) {
    const pageId = state.focusId.slice(4);
    return tv.pages.some(page => page.id === pageId)
      ? { screen: 'page', pageId, focusId: navFocusId(pageId) } : state;
  }
  const item = tv.pages.find(page => page.id === state.pageId)?.modules
    .flatMap(module => module.items.map(content => ({ content, focusId: itemFocusId(state.pageId, module.id, content.id) })))
    .find(candidate => candidate.focusId === state.focusId);
  return item ? { screen: 'detail', pageId: state.pageId, itemId: item.content.id,
    returnFocusId: state.focusId, focusId: `${isPlayableContent(item.content) ? 'play' : 'detail'}:${item.content.id}` } : state;
}

export function activeItem(tv: Television, state: TvState): ContentItem | undefined {
  if (state.screen === 'page') return undefined;
  return tv.pages.find(page => page.id === state.pageId)?.modules.flatMap(module => module.items)
    .find(item => item.id === state.itemId);
}
