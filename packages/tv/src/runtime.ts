import type { ChannelSpec, ContentItem, Brand } from '@firelaunch/contracts';

export type TvModule = {
  id: string; kind: 'hero' | 'rail' | 'grid' | 'text'; title?: string; body?: string;
  items: ContentItem[];
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
      return { id: page.id, title: page.title, modules: page.modules.map(module => ({
        id: module.id, kind: module.kind,
        ...(module.title ? { title: module.title } : {}),
        ...(module.kind === 'text' ? { body: module.body } : {}),
        items: module.kind === 'text' ? [] : module.contentIds.map(itemId => {
          const item = content.get(itemId);
          if (!item) throw new Error(`Unknown content: ${itemId}`);
          return item;
        })
      })) };
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
    if (command === 'select') return { ...state, screen: 'playback', focusId: `player:${state.itemId}` };
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
    returnFocusId: state.focusId, focusId: `play:${item.content.id}` } : state;
}

export function activeItem(tv: Television, state: TvState): ContentItem | undefined {
  if (state.screen === 'page') return undefined;
  return tv.pages.find(page => page.id === state.pageId)?.modules.flatMap(module => module.items)
    .find(item => item.id === state.itemId);
}
