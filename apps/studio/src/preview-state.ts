import { focusRows, initialState, navFocusId, transition, type Television, type TvCommand, type TvState } from '@firelaunch/tv';

export function reconcile(tv: Television, state: TvState | null): TvState {
  if (!state) return initialState(tv);
  const page = tv.pages.find(candidate => candidate.id === state.pageId);
  if (!page) return initialState(tv);
  const rows = focusRows(tv, page.id);
  if (state.screen === 'page') return rows.some(row => row.includes(state.focusId)) ? state : { screen: 'page', pageId: page.id, focusId: navFocusId(page.id) };
  const item = page.modules.some(module => module.items.some(candidate => candidate.id === state.itemId));
  return item && rows.some(row => row.includes(state.returnFocusId)) ? state : { screen: 'page', pageId: page.id, focusId: navFocusId(page.id) };
}

export function navigate(tv: Television, state: TvState | null, command: TvCommand): TvState {
  return transition(tv, reconcile(tv, state), command);
}

export function keyboardCommand(event: Pick<KeyboardEvent, 'key'>): TvCommand | null {
  return ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'select', Escape: 'back', Backspace: 'back' } as Record<string, TvCommand>)[event.key] ?? null;
}
