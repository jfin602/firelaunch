import { focusRows, heroSelector, initialState, itemFocusId, navFocusId, transition, type Television, type TvCommand, type TvState } from '@firelaunch/tv';
import { isPlayableContent } from '@firelaunch/contracts';

export function reconcile(tv: Television, state: TvState | null): TvState {
  if (!state) return initialState(tv);
  const page = tv.pages.find(candidate => candidate.id === state.pageId);
  if (!page) return initialState(tv);
  const rows = focusRows(tv, page.id);
  if (state.screen === 'page') {
    if (!rows.some(row => row.includes(state.focusId))) return { screen: 'page', pageId: page.id, focusId: navFocusId(page.id) };
    const selector = heroSelector(page)?.selector;
    const selected = selector?.items.find(item => item.id === state.selectedHeroItemId);
    if (state.selectedHeroItemId && !selected) {
      const { selectedHeroItemId: _stale, ...rest } = state;
      return rest;
    }
    return state;
  }
  const item = page.modules.flatMap(module => module.items).find(candidate => candidate.id === state.itemId);
  if (!item || !page.modules.some(module => module.items.some(candidate => candidate.id === item.id &&
    itemFocusId(page.id, module.id, candidate.id) === state.returnFocusId)) ||
    !rows.some(row => row.includes(state.returnFocusId))) return { screen: 'page', pageId: page.id, focusId: navFocusId(page.id) };
  if (!isPlayableContent(item) && !item.audiobook) return { ...state, screen: 'detail', focusId: `detail:${item.id}` };
  return state.screen === 'detail' ? { ...state, focusId: `play:${item.id}` } : state;
}

export function navigate(tv: Television, state: TvState | null, command: TvCommand): TvState {
  return transition(tv, reconcile(tv, state), command);
}

export function keyboardCommand(event: Pick<KeyboardEvent, 'key'>): TvCommand | null {
  return ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'select', Escape: 'back', Backspace: 'back' } as Record<string, TvCommand>)[event.key] ?? null;
}
