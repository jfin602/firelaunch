import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { contentPresentation, isPlayableContent, mediaUseEligible, type ChannelSpec, type ContentItem } from '@firelaunch/contracts';
import { accentTextColor, activeItem, heroActionFocusId, heroSelector, heroSpotlight, itemFocusId, navFocusId, televisionFromSpec, transition, type TvCommand, type TvState } from '@firelaunch/tv';
import { keyboardCommand, navigate, reconcile } from './preview-state.js';
import { VideoPlayer } from './VideoPlayer.js';
import { AudioPlayer, type AudioPlayerHandle } from './AudioPlayer.js';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { readCatalog, type CatalogSnapshot } from './api.js';
import { OwnedArtwork, ownedArtworkObject, retainOwnedArtworkUrl, useOwnedArtwork } from './OwnedArtwork.js';
import { HeroImageQueue, heroArtworkGroups } from '@firelaunch/tv/hero-image-queue';

function artwork(url: string): string {
  return url.startsWith('assets/') ? `/media/${url.slice(7)}` : url;
}
export function catalogContentId(itemId: string): string {
  return `item_${bytesToHex(sha256(new TextEncoder().encode(`catalog-content-v1\0${itemId}`))).slice(0, 32)}`;
}

export function ownerBookPreviewContent(spec: ChannelSpec, inventory: CatalogSnapshot, accountId: string, origin: string): ContentItem[] {
  return spec.content.map(content => {
    if (inventory.projectId !== spec.id || inventory.creatorAccountId !== accountId || content.presentation !== 'information') return content;
    const book = inventory.items.find(value => value.kind === 'book' && value.projectId === spec.id && value.creatorAccountId === accountId && catalogContentId(value.id) === content.id);
    if (!book) return content;
    const metadata = { ...book.sourceRecord.metadata, ...book.creatorOverrides };
    const attached = inventory.mediaAssets.find(value => value.id === book.audiobook?.audioAssetId && value.catalogItemId === book.id &&
      value.projectId === spec.id && value.creatorAccountId === accountId && value.kind === 'audio' &&
      value.tvPlaybackRights?.status === 'cleared');
    // The TV contract validates absolute HTTP(S) media URLs. Resolve the owner-only route
    // against this Studio origin for the transient preview, never for the saved ChannelSpec.
    const privateAudioUrl = attached?.location.type === 'private_object'
      ? new URL(`/api/projects/${encodeURIComponent(spec.id)}/private-objects/${encodeURIComponent(attached.location.objectId)}/audio`, origin).href : undefined;
    const publicAudioUrl = attached?.location.type === 'https' && attached.deliveryEligible &&
      content.audiobook?.mediaUrl === attached.location.url ? attached.location.url : undefined;
    const { audiobook: _previousAudio, ...safeContent } = content;
    return { ...safeContent, ...(metadata.author ? { author: metadata.author } : {}),
      ...(metadata.series ? { series: metadata.series.slice(0, 80) } : {}),
      ...(metadata.narrator ? { narrator: metadata.narrator } : {}),
      ...(metadata.publicationDate ? { publicationDate: metadata.publicationDate } : {}),
      ...(privateAudioUrl || publicAudioUrl ? { audiobook: { mediaUrl: privateAudioUrl ?? publicAudioUrl! } } : {}) };
  });
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


function usePreviewArtworkSource(contentId: string, source: string, inventory: CatalogSnapshot | null, projectId?: string, accountId?: string | null, requireCleared = false) {
  const item = inventory?.items.find(value => catalogContentId(value.id) === contentId);
  const cleared = !requireCleared || !accountId || !!(item && inventory && inventory.projectId === projectId && inventory.creatorAccountId === accountId && inventory.mediaAssets.some(asset => item.mediaAssetIds.includes(asset.id) &&
    asset.kind === 'artwork' && asset.catalogItemId === item.id && asset.projectId === projectId &&
    asset.creatorAccountId === accountId && mediaUseEligible(asset, 'television_display')));
  const objectId = cleared && projectId && inventory ? ownedArtworkObject(item, inventory.mediaAssets, projectId, accountId ?? null) : null;
  const privateUrl = useOwnedArtwork(projectId ?? '', accountId ?? null, objectId, null, contentId);
  const [failed, setFailed] = useState('');
  const url = !cleared ? null : requireCleared && objectId ? privateUrl
    : privateUrl && privateUrl !== failed ? privateUrl : artwork(source);
  return { url: url === failed ? null : url, pending: !!objectId && !privateUrl, setFailed };
}

type ResolvedArt = { url: string | null; pending: boolean };
export function PreviewArtwork({ contentId, source, inventory, projectId, accountId, requireCleared = false, onSource }: { contentId: string; source: string; inventory: CatalogSnapshot | null; projectId?: string; accountId?: string | null | undefined; requireCleared?: boolean; onSource?: (id: string, value: ResolvedArt) => void }) {
  const { url, pending, setFailed } = usePreviewArtworkSource(contentId, source, inventory, projectId, accountId, requireCleared);
  useEffect(() => { onSource?.(contentId, { url, pending }); }, [contentId, url, pending, onSource]);
  return !url ? <span className="preview-artwork-fallback" role="img" aria-label="Artwork unavailable">▣</span>
    : <img src={url} alt="" onError={() => setFailed(url)}/>;
}

export function adequateHeroArtwork(width: number, height: number): boolean {
  return width >= 180 && height >= 120 && width * height >= 40_000;
}

function HeroArtwork({ content, source, queue, imageMeta, onVisible }: { content: ContentItem; source: ResolvedArt | undefined;
  queue: HeroImageQueue; imageMeta: Map<string, { wide: boolean; image: HTMLImageElement }>; onVisible: (content: ContentItem) => void }) {
  const [shown, setShown] = useState<{ content: ContentItem; url: string | null; wide: boolean } | null>(null);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const [outgoing, setOutgoing] = useState<typeof shown>(null);
  const latest = useRef('');
  const key = `${content.id}:${content.artwork}:${source?.url ?? ''}`;
  latest.current = key;
  useEffect(() => {
    if (!source || source.pending) {
      const timer = setTimeout(() => { if (latest.current === key) { setOutgoing(null); setShown({ content, url: null, wide: false }); onVisible(content); } }, 8000);
      return () => clearTimeout(timer);
    }
    if (!source.url) { setOutgoing(null); setShown({ content, url: null, wide: false }); onVisible(content); return; }
    const url = source.url;
    void queue.request(url, 0).then(ready => {
      if (latest.current !== key) return;
      const image = imageMeta.get(url);
      setOutgoing(ready ? shownRef.current : null);
      setShown({ content, url: ready ? url : null, wide: ready && !!image?.wide });
      onVisible(content);
    });
  }, [key, source?.pending, queue]);
  useEffect(() => {
    if (!outgoing) return;
    const timer = setTimeout(() => setOutgoing(null), 180);
    return () => clearTimeout(timer);
  }, [outgoing]);
  useEffect(() => {
    const releases = [...new Set([shown?.url, outgoing?.url].filter((url): url is string => !!url))]
      .map(retainOwnedArtworkUrl);
    return () => releases.forEach(release => release());
  }, [shown?.url, outgoing?.url]);
  const layer = (entry: typeof shown, active: boolean) => entry?.url ? <div key={entry.url + (active ? ':active' : ':old')}
    className={'tv-feature-art-layer has-art' + (entry.wide ? ' is-wide' : '') + (active ? ' tv-feature-art-enter' : '')}
    style={{ backgroundImage: `linear-gradient(color-mix(in srgb, var(--tv-bg) 12%, transparent), color-mix(in srgb, var(--tv-bg) 12%, transparent)), url("${entry.url.replaceAll('"', '%22')}")` }}>
    {!entry.wide && <img src={entry.url} alt="" referrerPolicy="no-referrer"/>}</div> : null;
  return <div className="tv-feature-art">{layer(outgoing, false)}{layer(shown, true)}
    {shown && !shown.url && <span className="tv-feature-art-fallback" role="img" aria-label="Artwork unavailable">▣</span>}
  </div>;
}

async function preloadHeroImage(url: string, imageMeta: Map<string, { wide: boolean; image: HTMLImageElement }>, protectedUrls: Set<string>): Promise<boolean> {
  const image = new Image();
  image.referrerPolicy = 'no-referrer';
  return new Promise(resolve => {
    image.onload = () => {
      if (!adequateHeroArtwork(image.naturalWidth, image.naturalHeight)) { resolve(false); return; }
      const finish = () => {
        imageMeta.delete(url);
        imageMeta.set(url, { wide: image.naturalWidth / image.naturalHeight >= 1.35, image });
        while (imageMeta.size > 24) {
          const victim = [...imageMeta.keys()].find(key => !protectedUrls.has(key));
          if (!victim) break;
          imageMeta.delete(victim);
        }
        resolve(true);
      };
      if (image.decode) void image.decode().then(finish, finish);
      else finish();
    };
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

function heroAction(content: ContentItem): string {
  if (content.audiobook) return 'Listen to Audiobook';
  if (contentPresentation(content) === 'information') return 'Explore';
  return contentPresentation(content) === 'audio' ? 'Listen' : 'Watch';
}

export function Preview({ spec, selectedPageId, hosted = false, accountId, libraryRevision = 0, fullscreen = false, controlsVisible = true, onHideControls, onEnterFullscreen, onExitFullscreen, enterButtonRef, exitButtonRef }: { spec: ChannelSpec; selectedPageId?: string | undefined; hosted?: boolean; accountId?: string | null | undefined; libraryRevision?: number; fullscreen?: boolean; controlsVisible?: boolean; onHideControls?: () => void; onEnterFullscreen?: () => void; onExitFullscreen?: () => void; enterButtonRef?: React.Ref<HTMLButtonElement>; exitButtonRef?: React.Ref<HTMLButtonElement> }) {
  const imageMeta = useRef(new Map<string, { wide: boolean; image: HTMLImageElement }>());
  const protectedUrls = useRef(new Set<string>());
  const heroQueue = useRef<HeroImageQueue | null>(null);
  if (!heroQueue.current) heroQueue.current = new HeroImageQueue(url => preloadHeroImage(url, imageMeta.current, protectedUrls.current), 2, 24);
  const [artSources, setArtSources] = useState<{ scope: string; values: Record<string, ResolvedArt> }>({ scope: '', values: {} });
  const [heroCopy, setHeroCopy] = useState<{ scope: string; content: ContentItem } | null>(null);
  const [inventory, setInventory] = useState<CatalogSnapshot | null>(null);
  useEffect(() => {
    setInventory(null);
    if (!hosted || !accountId) return;
    let active = true;
    void readCatalog(spec.id).then(data => { if (active && data.projectId === spec.id && data.creatorAccountId === accountId &&
      [...data.items, ...data.mediaAssets].every(value => value.projectId === spec.id && value.creatorAccountId === accountId)) setInventory(data); }).catch(() => undefined);
    return () => { active = false; };
  }, [spec.id, hosted, accountId, libraryRevision]);
  const previewContent = hosted && inventory && accountId
    ? ownerBookPreviewContent(spec, inventory, accountId, window.location.origin) : spec.content;
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
    if (stateRef.current.screen === 'detail' && (command === 'up' || command === 'down')) {
      const details = screenRef.current?.querySelector<HTMLElement>('.tv-detail-text');
      if (details) details.scrollTop += (command === 'down' ? 1 : -1) * Math.max(40, details.clientHeight * 0.6);
      return;
    }
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
    if (current.screen !== 'page' || !focused) return;
    const selector = focused.closest<HTMLElement>('.tv-feature-selector');
    if (selector) {
      const row = focused.closest<HTMLElement>('.tv-items');
      if (row) {
        if (focused.offsetLeft < row.scrollLeft) row.scrollLeft = focused.offsetLeft;
        else if (focused.offsetLeft + focused.offsetWidth > row.scrollLeft + row.clientWidth)
          row.scrollLeft = focused.offsetLeft + focused.offsetWidth - row.clientWidth;
      }
    } else focused.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
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
  const heroPair = heroSelector(page);
  const emptyFeature = !heroPair && page.modules.length === 2 && page.modules[0]?.kind === 'hero' &&
    page.modules[1]?.kind === 'rail' && !page.modules[0].items.length && !page.modules[1].items.length;
  const spotlight = heroSpotlight(page, current);
  const artScope = useMemo(() => `${accountId ?? ''}:${spec.id}:${libraryRevision}:${page.id}:${spec.content.map(value => `${value.id}:${value.artwork}:${value.title}:${value.description}`).join('|')}`,
    [accountId, spec.id, spec.content, libraryRevision, page.id]);
  const sources = artSources.scope === artScope ? artSources.values : {};
  const recordArtSource = useCallback((id: string, value: ResolvedArt) => setArtSources(previous => {
    const values = previous.scope === artScope ? previous.values : {};
    const old = values[id];
    return old?.url === value.url && old.pending === value.pending && previous.scope === artScope ? previous
      : { scope: artScope, values: { ...values, [id]: value } };
  }), [artScope]);
  useEffect(() => {
    heroQueue.current?.clear(); imageMeta.current = new Map(); protectedUrls.current = new Set(); setHeroCopy(null);
  }, [artScope]);
  useEffect(() => {
    if (!spotlight || !heroPair || current.screen !== 'page') return;
    const currentUrl = sources[spotlight.id]?.url ?? '';
    const row = heroPair.selector.items.map(value => sources[value.id]?.url ?? '').filter(Boolean);
    const eligible = hosted ? eligibleStaticImageContent(spec, inventory, accountId ?? undefined) : spec.content;
    const allowed = new Set(eligible.map(value => value.id));
    const remaining = [...page.modules.filter(module => module !== heroPair.hero && module !== heroPair.selector)
      .flatMap(module => [...module.items.map(value => value.id), module.image?.id]),
      ...tv.pages.filter(other => other.id !== page.id).flatMap(other => other.modules.flatMap(module =>
        [...module.items.map(value => value.id), module.image?.id]))]
      .filter((id): id is string => !!id && allowed.has(id))
      .map(id => spec.content.find(value => value.id === id)?.artwork ?? '')
      .map(artwork).filter(url => url.startsWith('https://'));
    const groups = heroArtworkGroups(currentUrl, row, remaining);
    protectedUrls.current = new Set(groups.slice(0, 2).flat());
    heroQueue.current?.schedule(groups);
  }, [artScope, sources, spotlight?.id, current.screen, inventory]);
  const displayedSpotlight = heroCopy?.scope === artScope ? heroCopy.content : spotlight;
  const item = activeItem(tv, current);
  const privateDrafts = hosted && inventory ? inventory.items.filter(value => value.kind === 'video' && !spec.content.some(content => content.id === catalogContentId(value.id))).slice(0, 8) : [];
  const focus = (id: string) => current.focusId === id ? ' focused' : '';
  const selectFocus = (focusId: string) => setState(transition(tv, { screen: 'page', pageId: page.id, focusId }, 'select'));
  const style = { '--tv-accent': tv.brand.primaryColor, '--tv-accent-ink': accentTextColor(tv.brand.primaryColor), '--tv-bg': tv.brand.backgroundColor, '--tv-text': tv.brand.textColor, fontFamily: tv.brand.typography === 'serif' ? 'Georgia, serif' : 'inherit' } as React.CSSProperties;

  return <section className="preview-wrap" aria-label="Interactive TV Preview">
    <div className="tv-frame" ref={frameRef} tabIndex={0} style={style} aria-label={`TV screen, use arrow keys, Enter and ${fullscreen ? 'Backspace' : 'Escape'}`}>
      <div className={'tv-screen' + (current.screen === 'page' && heroPair && spotlight ? ' tv-screen-featured' : '')} ref={screenRef}>
        {current.screen === 'page' ? <>
          {heroPair && spotlight && <HeroArtwork key={artScope} content={spotlight} source={sources[spotlight.id]}
            queue={heroQueue.current!} imageMeta={imageMeta.current}
            onVisible={content => setHeroCopy({ scope: artScope, content })}/>}
          <header className="tv-header">
            {tv.brand.showTitle && <strong className="tv-logo">{tv.brand.logo && <img src={artwork(tv.brand.logo)} alt=""/>}{tv.title}</strong>}
            <nav className="tv-nav" aria-label="TV pages">{tv.pages.map(target => <button key={target.id} data-tv-focus={navFocusId(target.id)} className={'tv-nav-button' + focus(navFocusId(target.id))} onClick={() => setState({ screen: 'page', pageId: target.id, focusId: navFocusId(target.id) })}>{target.title}</button>)}</nav>
          </header>
          <div className="tv-content-wrap" key={page.id}><div className="tv-content" onScroll={showScrollPosition}>
            {page.modules.length === 0 && <div className="tv-empty">Your channel is ready for content.<small>Add content to light up this screen.</small></div>}
            {page.modules.map(module => emptyFeature && module === page.modules[1] ? null : emptyFeature && module === page.modules[0] ?
              <section className="tv-feature tv-feature-empty" key={module.id} aria-label="Featured layout, awaiting content">
                <div className="tv-feature-display"><div className="tv-feature-copy"><span className="tv-feature-kicker">FEATURED</span>
                  <h2>Your featured title</h2><p>Add your first item to bring its title, story and artwork into this space.</p></div>
                  <div className="tv-feature-empty-art" role="img" aria-label="Artwork appears here when you add a title" />
                </div>
                <div className="tv-feature-selector"><h3>{page.modules[1]?.title}</h3><p className="tv-feature-empty-hint">Your content row will appear here.</p>
                  <div className="tv-feature-empty-cards" aria-hidden="true">{Array.from({ length: 5 }, (_, index) =>
                    <span className="tv-feature-empty-card" key={index} />)}</div></div>
              </section> : module === heroPair?.selector ? null : module === heroPair?.hero && spotlight ? <section className="tv-feature" key={module.id} aria-label="Featured title and selector">
              <div className="tv-feature-display">
                <div className="tv-feature-copy"><span className="tv-feature-kicker">FEATURED</span><h2>{displayedSpotlight?.title}</h2>
                  <p>{displayedSpotlight && (displayedSpotlight.description.length > 220 ? `${displayedSpotlight.description.slice(0, 217).trimEnd()}…` : displayedSpotlight.description)}</p>
                  <div className="tv-feature-meta">{[displayedSpotlight?.author, displayedSpotlight?.publicationDate?.slice(0, 4), displayedSpotlight?.category, displayedSpotlight?.series].filter(Boolean).map((part, index) => <span key={index}>{part}</span>)}</div>
                  <button data-tv-focus={heroActionFocusId(page.id)} className={'tv-feature-action' + focus(heroActionFocusId(page.id))}
                    onClick={() => selectFocus(heroActionFocusId(page.id))}>{heroAction(displayedSpotlight ?? spotlight)} <span aria-hidden="true">→</span></button>
                </div>
              </div>
              <div className="tv-feature-selector" aria-label={heroPair.selector.title ?? 'Browse titles'}>
                <h3>{heroPair.selector.title}</h3><div className="tv-items">{heroPair.selector.items.map(content => {
                  const id = itemFocusId(page.id, heroPair.selector.id, content.id);
                  const presentation = contentPresentation(content);
                  return <button key={id} data-tv-focus={id} className={'tv-card' + (presentation === 'information' ? ' tv-book-card' : presentation === 'audio' ? ' tv-audio-card' : '') + focus(id)} onClick={() => selectFocus(id)} aria-label={`Open ${content.title}`}>
                    <span className="tv-art"><PreviewArtwork contentId={content.id} source={content.artwork} inventory={inventory} projectId={spec.id} accountId={accountId} requireCleared onSource={recordArtSource}/></span><span className="tv-card-caption">{content.title}</span>
                  </button>;
                })}</div>
              </div>
            </section> : <section className={`tv-module tv-${module.kind} tv-crop-${module.crop ?? 'cover'} tv-align-${module.alignment ?? 'left'}`} key={module.id}>
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
            <div className="tv-detail-copy"><div className="tv-detail-text"><span className="eyebrow">{contentPresentation(item) === 'video' ? 'NOW SHOWING' : contentPresentation(item) === 'audio' ? 'NOW LISTENING' : item.author ? 'BOOK SHOWCASE' : 'ABOUT THIS TITLE'} · {item.category ?? 'FEATURE'}</span><h2>{item.title}</h2>
              {item.author && <p className="tv-book-author">By {item.author}</p>}{item.series && <p>Series: {item.series}</p>}{item.publicationDate && <p>Published {item.publicationDate}</p>}
              <p>{item.description}</p>{item.audiobook && item.narrator && <p>Narrated by {item.narrator}</p>}</div><div className="tv-detail-actions">
              {isPlayableContent(item) || item.audiobook ? <button data-tv-focus={current.focusId} className="tv-play focused" onClick={() => dispatch('select')}>▶ &nbsp; {item.audiobook ? 'Listen to Audiobook' : contentPresentation(item) === 'audio' ? 'Play audio' : 'Play film'}</button>
                : <button data-tv-focus={current.focusId} className="tv-play focused" onClick={() => dispatch('back')}>← Back to channel</button>}
              <small>{isPlayableContent(item) || item.audiobook ? `Press Enter to listen or play · ${fullscreen ? 'Backspace' : 'Escape'} to go back` : `Use ↑ ↓ to read · ${fullscreen ? 'Backspace' : 'Escape'} to go back`}</small></div></div>
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
