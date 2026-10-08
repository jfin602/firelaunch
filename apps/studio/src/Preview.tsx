import { useEffect, useRef, useState } from 'react';
import type { ChannelSpec } from '@firelaunch/contracts';
import { activeItem, itemFocusId, navFocusId, televisionFromSpec, transition, type TvCommand, type TvState } from '@firelaunch/tv';
import { keyboardCommand, navigate, reconcile } from './preview-state.js';

function artwork(url: string): string {
  return url.startsWith('assets/') ? `/media/${url.slice(7)}` : url;
}

export function Preview({ spec }: { spec: ChannelSpec }) {
  const tv = televisionFromSpec(spec);
  const [state, setState] = useState<TvState | null>(null);
  const current = reconcile(tv, state);
  const screenRef = useRef<HTMLDivElement>(null);
  const tvRef = useRef(tv);
  const stateRef = useRef(current);
  tvRef.current = tv;
  stateRef.current = current;
  const dispatch = (command: TvCommand) => setState(previous => navigate(tvRef.current, previous, command));

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      const command = keyboardCommand(event);
      if (command) { event.preventDefault(); dispatch(command); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const focused = Array.from(screenRef.current?.querySelectorAll<HTMLElement>('[data-tv-focus]') ?? [])
      .find(element => element.dataset.tvFocus === current.focusId);
    focused?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [current.focusId, current.pageId, current.screen]);

  const page = tv.pages.find(candidate => candidate.id === current.pageId)!;
  const item = activeItem(tv, current);
  const focus = (id: string) => current.focusId === id ? ' focused' : '';
  const selectFocus = (focusId: string) => setState(transition(tv, { screen: 'page', pageId: page.id, focusId }, 'select'));
  const style = { '--tv-accent': tv.brand.primaryColor, '--tv-bg': tv.brand.backgroundColor, '--tv-text': tv.brand.textColor, fontFamily: tv.brand.typography === 'serif' ? 'Georgia, serif' : 'inherit' } as React.CSSProperties;

  return <section className="preview-wrap" aria-label="Interactive TV Preview">
    <div className="preview-heading"><span className="eyebrow">LIVE CHANNEL PREVIEW</span><span className="live-dot">● &nbsp;16:9 · INTERACTIVE</span></div>
    <div className="tv-frame" tabIndex={0} style={style} aria-label="TV screen, use arrow keys, Enter and Escape">
      <div className="tv-screen" ref={screenRef}>
        {current.screen === 'page' ? <>
          <header className="tv-header">
            {tv.brand.showTitle && <strong className="tv-logo">{tv.brand.logo && <img src={artwork(tv.brand.logo)} alt=""/>}{tv.title}</strong>}
            <nav className="tv-nav" aria-label="TV pages">{tv.pages.map(target => <button key={target.id} data-tv-focus={navFocusId(target.id)} className={'tv-nav-button' + focus(navFocusId(target.id))} onClick={() => setState({ screen: 'page', pageId: target.id, focusId: navFocusId(target.id) })}>{target.title}</button>)}</nav>
          </header>
          <div className="tv-content" key={page.id}>
            {page.modules.length === 0 && <div className="tv-empty">Your channel is ready for content.<small>Add a film in Content to light up this screen.</small></div>}
            {page.modules.map(module => <section className={'tv-module tv-' + module.kind} key={module.id}>
              {module.title && <h3>{module.title}</h3>}
              {module.kind === 'text' ? <p>{module.body}</p> : <div className="tv-items">{module.items.map(content => {
                const id = itemFocusId(page.id, module.id, content.id);
                return <button key={id} data-tv-focus={id} className={'tv-card' + focus(id)} onClick={() => selectFocus(id)} aria-label={`Open ${content.title}`}>
                  <span className="tv-art"><img src={artwork(content.artwork)} alt="" /></span><span className="tv-card-caption">{content.title}</span>
                </button>;
              })}</div>}
            </section>)}
          </div>
        </> : item && <div className={'tv-overlay tv-' + current.screen}>
          {current.screen === 'detail' ? <>
            <img src={artwork(item.artwork)} alt="" />
            <div className="tv-detail-copy"><span className="eyebrow">NOW SHOWING · {item.category ?? 'FEATURE'}</span><h2>{item.title}</h2><p>{item.description}</p><button className="tv-play focused" onClick={() => dispatch('select')}>▶ &nbsp; Play film</button><small>Press Enter to play · Escape to go back</small></div>
          </> : <div className="tv-player"><video key={item.id} src={item.mediaUrl} controls autoPlay muted={tv.playback.startMuted} playsInline /><div className="tv-player-footer"><strong>{item.title}</strong><button className="tv-play focused" onClick={() => dispatch('back')}>← Back to details</button></div></div>}
        </div>}
      </div>
    </div>
    <div className="remote-bar"><div><strong>Virtual remote</strong><span>Arrow keys · Enter select · Escape back</span></div><div className="remote" aria-label="Virtual remote"><button aria-label="Up" onClick={() => dispatch('up')}>↑</button><div><button aria-label="Left" onClick={() => dispatch('left')}>←</button><button aria-label="Select" onClick={() => dispatch('select')}>OK</button><button aria-label="Right" onClick={() => dispatch('right')}>→</button></div><button aria-label="Down" onClick={() => dispatch('down')}>↓</button><button aria-label="Back" className="remote-back" onClick={() => dispatch('back')}>↩ Back</button></div></div>
  </section>;
}
