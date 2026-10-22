import React, { useEffect, useRef, useState } from 'react';
import { contentPresentation, isPlayableContent, mediaUseEligible, type ChannelSpec, type ContentItem } from '@firelaunch/contracts';
import { activeItem, itemFocusId, navFocusId, televisionFromSpec, transition, type TvCommand, type TvState } from '@firelaunch/tv';
import { keyboardCommand, navigate, reconcile } from './preview-state.js';
import { VideoPlayer } from './VideoPlayer.js';
import { AudioPlayer, type AudioPlayerHandle } from './AudioPlayer.js';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { readCatalog, type CatalogSnapshot } from './api.js';
import { OwnedArtwork, ownedArtworkObject, useOwnedArtwork } from './OwnedArtwork.js';

function artwork(url: string): string {
  return url.startsWith('assets/') ? `/media/${url.slice(7)}` : url;
}
export function catalogContentId(itemId: string): string {
  return `item_${bytesToHex(sha256(new TextEncoder().encode(`catalog-content-v1\0${itemId}`))).slice(0, 32)}`;
}

export function eligibleStaticImageContent(spec: ChannelSpec, inventory: CatalogSnapshot | null, accountId: string | undefined): ContentItem[] {
  if (!accountId) return spec.content;
  if (!inventory || inventory.projectId !== spec.id || inventory.creatorAccountId !== accountId) return [];
  return spec.content.filter(content => inventory.items.some(item =>
    item.projectId === spec.id && item.creatorAccountId === accountId && catalogContentId(item.id) === content.id &&
    item.mediaAssetIds.some(id => inventory.mediaAssets.some(asset => asset.id === id && asset.projectId === spec.id &&
      asset.creatorAccountId === accountId && asset.catalogItemId === item.id && asset.kind === 'artwork' &&
      asset.deliveryEligible && mediaUseEligible(asset, 'television_display'))) &&
    inventory.sources.some(source => source.id === item.sourceRecord.sourceId && source.projectId === spec.id &&
      source.creatorAccountId === accountId && source.state !== 'discovered' &&
      ['creator_asserted', 'provider_authorized'].includes(source.permission.retrieval) &&
      ['creator_asserted', 'provider_authorized'].includes(source.permission.tvDisplay))));
}


export function PreviewArtwork({ contentId, source, inventory, projectId, accountId }: { contentId: string; source: string; inventory: CatalogSnapshot | null; projectId?: string; accountId?: string | null | undefined }) {
  const item = inventory?.items.find(value => catalogContentId(value.id) === contentId);
  const objectId = projectId && inventory ? ownedArtworkObject(item, inventory.mediaAssets, projectId, accountId ?? null) : null;
  const privateUrl = useOwnedArtwork(projectId ?? '', accountId ?? null, objectId, null, contentId);
  const [failed, setFailed] = useState('');
  const url = privateUrl && privateUrl !== failed ? privateUrl : artwork(source);
  return url === failed ? <span className="preview-artwork-fallback" role="img" aria-label="Artwork unavailable">▣</span>
    : <img src={url} alt="" onError={() => setFailed(url)}/>;
}

export function Preview({ spec, selectedPageId, hosted = false, accountId, libraryRevision = 0, fullscreen = false, controlsVisible = true, onHideControls, onEnterFullscreen, onExitFullscreen, enterButtonRef, exitButtonRef }: { spec: ChannelSpec; selectedPageId?: string | undefined; hosted?: boolean; accountId?: string | null | undefined; libraryRevision?: number; fullscreen?: boolean; controlsVisible?: boolean; onHideControls?: () => void; onEnterFullscreen?: () => void; onExitFullscreen?: () => void; enterButtonRef?: React.Ref<HTMLButtonElement>; exitButtonRef?: React.Ref<HTMLButtonElement> }) {
  const [inventory, setInventory] = useState<CatalogSnapshot | null>(null);
  useEffect(() => {
    setInventory(null);
    if (!hosted || !accountId) return;
    let active = true;
    void readCatalog(spec.id).then(data => { if (active && data.projectId === spec.id && data.creatorAccountId === accountId &&
      [...data.items, ...data.mediaAssets].every(value => value.projectId === spec.id && value.creatorAccountId === accountId)) setInventory(data); }).catch(() => undefined);
    return () => { active = false; };
  }, [spec.id, hosted, accountId, libraryRevision]);
  const previewContent = spec.content.map(content => {
    if (!hosted || !inventory || inventory.projectId !== spec.id || inventory.creatorAccountId !== accountId || content.presentation !== 'information') return content;
    const book = inventory.items.find(value => value.kind === 'book' && value.projectId === spec.id && value.creatorAccountId === accountId && catalogContentId(value.id) === content.id);
    if (!book) return content;
    const metadata = { ...book.sourceRecord.metadata, ...book.creatorOverrides };
    const attached = inventory.mediaAssets.find(value => value.id === book.audiobook?.audioAssetId && value.catalogItemId === book.id &&
      value.projectId === spec.id && value.creatorAccountId === accountId && value.kind === 'audio' &&
      value.tvPlaybackRights?.status === 'cleared');
    const privateAudioUrl = attached?.location.type === 'private_object'
      ? `/api/projects/${encodeURIComponent(spec.id)}/private-objects/${encodeURIComponent(attached.location.objectId)}/audio` : undefined;
    const publicAudioUrl = attached?.location.type === 'https' && attached.deliveryEligible &&
      content.audiobook?.mediaUrl === attached.location.url ? attached.location.url : undefined;
    const { audiobook: _previousAudio, ...safeContent } = content;
    return { ...safeContent, ...(metadata.author ? { author: metadata.author } : {}),
      ...(metadata.series ? { series: metadata.series.slice(0, 80) } : {}),
      ...(metadata.narrator ? { narrator: metadata.narrator } : {}),
      ...(metadata.publicationDate ? { publicationDate: metadata.publicationDate } : {}),
      ...(privateAudioUrl || publicAudioUrl ? { audiobook: { mediaUrl: privateAudioUrl ?? publicAudioUrl! } } : {}) };
  });
  const tv = televisionFromSpec({ ...spec, content: previewContent });
  const [state, setState] = useState<TvState | null>(null);
  const current = reconcile(tv, state);
  const screenRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLSpanElement>(null);
  const scrollIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const tvRef = useRef(tv);
  const stateRef = useRef(current);
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  tvRef.current = tv;
  stateRef.current = current;
  const dispatch = (command: TvCommand) => {
    const active = activeItem(tvRef.current, stateRef.current);
    if (stateRef.current.screen === 'playback' && active && (contentPresentation(active) === 'audio' || !!active.audiobook) &&
      (command === 'left' || command === 'right' || command === 'select')) {
      audioPlayerRef.current?.command(command); return;
    }
    setState(previous => navigate(tvRef.current, previous, command));
  };

  useEffect(() => {
    if (!selectedPageId || !tvRef.current.pages.some(page => page.id === selectedPageId)) return;
    setState(previous => {
      if (reconcile(tvRef.current, previous).pageId === selectedPageId) return previous;
      return { screen: 'page', pageId: selectedPageId, focusId: navFocusId(selectedPageId) };
    });
  }, [selectedPageId]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const inFrame = frameRef.current?.contains(target);
      // In fullscreen, Backspace is TV Back even when the Exit button or editor chrome has focus.
      if (!inFrame && !(fullscreen && event.key === 'Backspace' && frameRef.current?.closest('.channel-presentation')?.contains(target))) return;
      if (!inFrame && event.key !== 'Backspace') return;
      if (fullscreen && event.key === 'Escape') return;
      if (target.closest('.audio-player') && ['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key) &&
        !(target.closest('button') && ['Enter', ' '].includes(event.key))) {
        event.preventDefault();
        audioPlayerRef.current?.command(event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : 'select');
        return;
      }
      if (target.closest('audio, video')) {
        // Keep native media keys, but let Back leave playback even when the player has focus.
        if (event.key !== 'Escape' && event.key !== 'Backspace') return;
      } else if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const command = keyboardCommand(event);
      // Native Enter activates a focused TV button once; the frame itself uses the TV command.
      if (command === 'select' && target.closest('button')) return;
      if (command) { event.preventDefault(); dispatch(command); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  useEffect(() => {
    const focused = Array.from(screenRef.current?.querySelectorAll<HTMLElement>('[data-tv-focus]') ?? [])
      .find(element => element.dataset.tvFocus === current.focusId);
    focused?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [current.focusId, current.pageId, current.screen]);

  useEffect(() => () => { if (scrollIndicatorTimer.current) clearTimeout(scrollIndicatorTimer.current); }, []);
  const showScrollPosition = (event: React.UIEvent<HTMLDivElement>) => {
    const content = event.currentTarget;
    const indicator = scrollIndicatorRef.current;
    if (!indicator || content.scrollHeight <= content.clientHeight + 1) return;
    const size = Math.max(4, content.clientHeight / content.scrollHeight * 100);
    const travel = 100 - size;
    const progress = content.scrollTop / (content.scrollHeight - content.clientHeight);
    indicator.style.height = `${size}%`;
    indicator.style.top = `${Math.max(0, Math.min(travel, progress * travel))}%`;
    indicator.classList.add('is-scrolling');
    if (scrollIndicatorTimer.current) clearTimeout(scrollIndicatorTimer.current);
    scrollIndicatorTimer.current = setTimeout(() => indicator.classList.remove('is-scrolling'), 900);
  };

  const page = tv.pages.find(candidate => candidate.id === current.pageId)!;
  const item = activeItem(tv, current);
  const privateDrafts = hosted && inventory ? inventory.items.filter(value => value.kind === 'video' && !spec.content.some(content => content.id === catalogContentId(value.id))).slice(0, 8) : [];
  const focus = (id: string) => current.focusId === id ? ' focused' : '';
  const selectFocus = (focusId: string) => setState(transition(tv, { screen: 'page', pageId: page.id, focusId }, 'select'));
  const style = { '--tv-accent': tv.brand.primaryColor, '--tv-bg': tv.brand.backgroundColor, '--tv-text': tv.brand.textColor, fontFamily: tv.brand.typography === 'serif' ? 'Georgia, serif' : 'inherit' } as React.CSSProperties;

  return <section className="preview-wrap" aria-label="Interactive TV Preview">
    <div className="tv-frame" ref={frameRef} tabIndex={0} style={style} aria-label={`TV screen, use arrow keys, Enter and ${fullscreen ? 'Backspace' : 'Escape'}`}>
      <div className="tv-screen" ref={screenRef}>
        {current.screen === 'page' ? <>
          <header className="tv-header">
            {tv.brand.showTitle && <strong className="tv-logo">{tv.brand.logo && <img src={artwork(tv.brand.logo)} alt=""/>}{tv.title}</strong>}
            <nav className="tv-nav" aria-label="TV pages">{tv.pages.map(target => <button key={target.id} data-tv-focus={navFocusId(target.id)} className={'tv-nav-button' + focus(navFocusId(target.id))} onClick={() => setState({ screen: 'page', pageId: target.id, focusId: navFocusId(target.id) })}>{target.title}</button>)}</nav>
          </header>
          <div className="tv-content-wrap" key={page.id}><div className="tv-content" onScroll={showScrollPosition}>
            {page.modules.length === 0 && <div className="tv-empty">Your channel is ready for content.<small>Add content to light up this screen.</small></div>}
            {page.modules.map(module => <section className={`tv-module tv-${module.kind} tv-crop-${module.crop ?? 'cover'} tv-align-${module.alignment ?? 'left'}`} key={module.id}>
              {module.title && <h3>{module.title}</h3>}
              {module.kind === 'image-banner' || module.kind === 'image-text' ? <div className={`tv-static tv-static-${module.kind} tv-static-${module.imageSide ?? 'left'} tv-static-${module.spacing ?? 'comfortable'} tv-static-${module.background ?? 'theme'} tv-static-${module.alignment ?? 'left'} tv-static-${module.crop ?? 'cover'}`}>
                {module.image && (!hosted || (accountId && eligibleStaticImageContent(spec, inventory, accountId).some(item => item.id === module.image?.id))) &&
                  <span className="tv-static-art"><PreviewArtwork contentId={module.image.id} source={module.image.artwork} inventory={inventory} projectId={spec.id} accountId={accountId}/></span>}
                <div className="tv-static-copy">{module.body && <p>{module.body}</p>}</div>
              </div> : module.kind === 'text' ? <p className={`tv-text-${module.alignment ?? 'left'} tv-text-${module.background ?? 'theme'} tv-text-${module.spacing ?? 'comfortable'}`}>{module.body}</p> : <div className={`tv-items tv-spacing-${module.spacing ?? 'comfortable'}`}>{module.items.map(content => {
                const id = itemFocusId(page.id, module.id, content.id);
                const bookCard = inventory?.items.some(value => value.kind === 'book' && catalogContentId(value.id) === content.id);
                return <button key={id} data-tv-focus={id} className={'tv-card' + (bookCard ? ' tv-book-card' : '') + focus(id)} onClick={() => selectFocus(id)} aria-label={`Open ${content.title}`}>
                  <span className="tv-art"><PreviewArtwork contentId={content.id} source={content.artwork} inventory={inventory} projectId={spec.id} accountId={accountId}/></span><span className="tv-card-caption">{content.title}</span>
                </button>;
              })}</div>}
            </section>)}
            {privateDrafts.length > 0 && <section className="tv-module tv-grid studio-private-artwork" aria-label="Private video draft artwork">
              <h3>Private video drafts · artwork preview only</h3><div className="tv-items">{privateDrafts.map(draft =>
                <div className="tv-card" key={draft.id}><span className="tv-art"><OwnedArtwork item={draft} assets={inventory!.mediaAssets} projectId={spec.id} accountId={accountId ?? null} className="studio-draft-art" fallback={<span aria-label="Artwork unavailable">▣</span>}/></span><span className="tv-card-caption">{draft.creatorOverrides?.title ?? draft.sourceRecord.metadata.title}</span></div>)}</div>
            </section>}
          </div><span className="tv-scroll-indicator" ref={scrollIndicatorRef} aria-hidden="true" /></div>
        </> : item && <div className={'tv-overlay tv-' + current.screen}>
          {current.screen === 'detail' ? <>
            <PreviewArtwork contentId={item.id} source={item.artwork} inventory={inventory} projectId={spec.id} accountId={accountId}/>
            <div className="tv-detail-copy"><span className="eyebrow">{contentPresentation(item) === 'video' ? 'NOW SHOWING' : contentPresentation(item) === 'audio' ? 'NOW LISTENING' : item.author ? 'BOOK SHOWCASE' : 'ABOUT THIS TITLE'} · {item.category ?? 'FEATURE'}</span><h2>{item.title}</h2>
              {item.author && <p className="tv-book-author">By {item.author}</p>}{item.series && <p>Series: {item.series}</p>}{item.publicationDate && <p>Published {item.publicationDate}</p>}
              <p>{item.description}</p>{item.audiobook && item.narrator && <p>Narrated by {item.narrator}</p>}
              {isPlayableContent(item) || item.audiobook ? <button data-tv-focus={current.focusId} className="tv-play focused" onClick={() => dispatch('select')}>▶ &nbsp; {item.audiobook ? 'Listen to Audiobook' : contentPresentation(item) === 'audio' ? 'Play audio' : 'Play film'}</button>
                : <button data-tv-focus={current.focusId} className="tv-play focused" onClick={() => dispatch('back')}>← Back to channel</button>}
              <small>{isPlayableContent(item) || item.audiobook ? `Press Enter to listen or play · ${fullscreen ? 'Backspace' : 'Escape'} to go back` : `Press ${fullscreen ? 'Backspace' : 'Escape'} to go back`}</small></div>
          </> : <div className="tv-player">{contentPresentation(item) === 'audio' || item.audiobook
            ? <AudioPlayer ref={audioPlayerRef} key={item.id} source={item.audiobook?.mediaUrl ?? item.mediaUrl!} title={item.title} creator={item.narrator ?? item.author ?? ''} autoPlay startMuted={tv.playback.startMuted}
                artwork={<PreviewArtwork contentId={item.id} source={item.artwork} inventory={inventory} projectId={spec.id} accountId={accountId}/>}
                onBack={() => dispatch('back')}/>
            : <VideoPlayer key={item.id} source={item.mediaUrl!} startMuted={tv.playback.startMuted}
                contentId={item.id} {...(hosted ? { projectId: spec.id } : {})} />}
            <div className="tv-player-footer"><strong>{item.title}</strong><button className="tv-play focused" onClick={() => dispatch('back')}>← Back to details</button></div></div>}
        </div>}
      </div>
    </div>
    <div className="preview-heading" hidden={fullscreen && !controlsVisible}><span className="eyebrow" hidden={fullscreen}>DRAFT TV PREVIEW</span><span className="live-dot" hidden={fullscreen}>● &nbsp;16:9 · INTERACTIVE</span>{onEnterFullscreen && <span className="channel-stage-action" hidden={fullscreen}><button ref={enterButtonRef} type="button" className="preview-toggle" onClick={onEnterFullscreen}>View full screen</button></span>}{fullscreen && <div className="fullscreen-controls"><button type="button" className="preview-hide-controls" onClick={onHideControls} aria-label="Hide controls; press H to show, Alt+E for editor, or Escape to exit">Hide controls</button><button ref={exitButtonRef} type="button" className="preview-exit" onClick={onExitFullscreen}>Exit full screen</button></div>}</div>
    <div className="remote-bar" hidden={fullscreen && !controlsVisible}><div><strong>Virtual remote</strong><span>Arrow keys · Enter select · {fullscreen ? 'Backspace TV Back · Escape Exit · H Hide controls' : 'Escape TV Back'}</span></div><div className="remote" aria-label="Virtual remote"><button type="button" aria-label="Up" onClick={() => dispatch('up')}>↑</button><div><button type="button" aria-label="Left" onClick={() => dispatch('left')}>←</button><button type="button" aria-label="Select" onClick={() => dispatch('select')}>OK</button><button type="button" aria-label="Right" onClick={() => dispatch('right')}>→</button></div><button type="button" aria-label="Down" onClick={() => dispatch('down')}>↓</button><button type="button" aria-label="Back" className="remote-back" onClick={() => dispatch('back')}>↩ Back</button></div></div>
  </section>;
}
