import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, TVEventHandler, View, useWindowDimensions } from 'react-native';
import { KeplerVideoSurfaceView, VideoPlayer } from '@amazon-devices/react-native-w3cmedia';
import bundled from './channel.json';
import { installRelease } from './release-client';
import { accentTextColor, activeItem, heroSelector, heroSpotlight, initialState, itemFocusId, navFocusId, transition } from './tv-runtime';
import { createPlaybackController } from './playback-controller';
import { createHlsPlayer, installHlsPolyfills } from './hlsjs/adapter';
import { audioArtworkFrame, featureArtworkFrame, featureScrollTarget, tvLayout } from './tv-layout';

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function layoutFrame(event) { return event?.nativeEvent?.layout; }

function SoundIcon({ muted }) {
  return <View style={styles.soundIcon} accessibilityLabel={muted ? 'Muted' : 'Sound on'}>
    <View style={styles.speakerBox} />
    <View style={styles.speakerCone} />
    {muted ? <Text style={styles.speakerOff}>×</Text> : <>
      <View style={styles.speakerWaveInner} />
      <View style={styles.speakerWaveOuter} />
    </>}
  </View>;
}

function StaticArtwork({ source, crop, banner, font, color, layout }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  const artStyle = [styles.staticArt, banner && styles.bannerArt, { height: Math.min(160, layout.cardArtworkHeight * 1.8) }];
  if (source?.startsWith('https://') && !failed) return <Image source={{ uri: source }}
    resizeMode={crop === 'contain' ? 'contain' : 'cover'} onError={() => setFailed(true)} style={artStyle} />;
  return <View style={[artStyle, styles.missingArt]}><Text style={[font, color]}>Artwork unavailable</Text></View>;
}

function heroAction(content) {
  if (content.audiobook) return 'Listen to Audiobook';
  if (content.presentation === 'information') return 'Explore';
  return content.presentation === 'audio' ? 'Listen' : 'Watch';
}

function Feature({ content, brand, font, layout }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = content.artwork?.startsWith('https://') ? content.artwork : null;
  const visible = source && source !== failedSource;
  const frame = featureArtworkFrame(layout, content.presentation);
  const meta = [content.author, content.publicationDate?.slice(0, 4), content.category, content.series].filter(Boolean);
  return <View style={[styles.feature, { height: layout.featureHeight, backgroundColor: brand.backgroundColor }]}>
    {visible && <Image key={`back:${source}`} source={{ uri: source }} resizeMode="cover"
      onError={() => setFailedSource(source)} style={styles.featureBackdrop} />}
    <View style={styles.featureScrim} />
    <View style={[styles.featureCopy, { padding: 20 * layout.scale }]}>
      <Text style={[styles.featureKicker, font, { borderColor: brand.primaryColor }]}>FEATURED</Text>
      <Text numberOfLines={2} style={[styles.featureTitle, font, { fontSize: 36 * layout.scale }]}>{content.title}</Text>
      <Text numberOfLines={3} style={[styles.featureDescription, font, { fontSize: 18 * layout.scale }]}>{content.description}</Text>
      {meta.length > 0 && <Text numberOfLines={1} style={[styles.featureMeta, font]}>{meta.join('  ·  ')}</Text>}
      <Text style={[styles.featureAction, font, { backgroundColor: brand.primaryColor,
        color: accentTextColor(brand.primaryColor) }]}>{heroAction(content)}  →</Text>
    </View>
    <View style={[styles.featureFrame, { width: layout.contentWidth * 0.42 }]}>
      {visible ? <Image key={`front:${source}`} source={{ uri: source }} resizeMode="contain"
        onError={() => setFailedSource(source)} style={{ width: frame.width, height: frame.height }} />
        : <Text style={[font, styles.featureFallback]}>Artwork unavailable</Text>}
    </View>
  </View>;
}

function ItemArtwork({ source, resizeMode, height, font, color }) {
  const [failedSource, setFailedSource] = useState(null);
  const visible = source?.startsWith('https://') && source !== failedSource;
  const style = [styles.artwork, { height }];
  return visible ? <Image key={source} source={{ uri: source }} resizeMode={resizeMode}
    onError={() => setFailedSource(source)} style={style} />
    : <View style={[style, styles.missingArt]}><Text numberOfLines={1}
      style={[font, color]}>Artwork unavailable</Text></View>;
}

function Section({ module, page, state, brand, font, focusStyle, layout, featureSelector,
  onLayout, onRowLayout, onItemLayout, onRowScroll, rowRef, setView }) {
  const color = { color: brand.textColor };
  const aligned = { textAlign: module.alignment === 'center' ? 'center' : 'left' };
  const compact = module.spacing === 'compact';
  const surface = module.background === 'surface' ? styles.sectionSurface : null;
  const moduleSpacing = { marginVertical: 8 * layout.scale };
  const title = module.title && <Text numberOfLines={featureSelector ? 1 : undefined} style={[styles.moduleTitle, { fontSize: 27 * layout.scale,
    marginBottom: 8 * layout.scale }, font, color, aligned]}>{module.title}</Text>;
  if (module.kind === 'text') return <View style={[styles.module, moduleSpacing, surface, { padding: 8 * layout.scale }]}>
    {title}<Text style={[styles.body, font, color, aligned]}>{module.body}</Text>
  </View>;
  if (module.kind === 'image-banner' || module.kind === 'image-text') {
    const art = <StaticArtwork source={module.image?.artwork} crop={module.crop}
      banner={module.kind === 'image-banner'} font={font} color={color} layout={layout} />;
    return <View style={[styles.module, moduleSpacing, styles.staticSection,
      { minHeight: layout.cardArtworkHeight * 2 }, surface, compact ? styles.compactSection : styles.comfortableSection]}>
      {title}<View style={[styles.staticRow, module.kind === 'image-text' && module.imageSide === 'right' && styles.staticRight]}>
        {art}<Text style={[styles.body, styles.staticCopy, font, color, aligned]}>{module.body}</Text>
      </View>
    </View>;
  }
  if (module.kind !== 'hero' && module.kind !== 'rail' && module.kind !== 'grid')
    throw new Error(`Unsupported TV section: ${module.kind}`);
  const cards = module.items.map(content => {
      const focusId = itemFocusId(page.id, module.id, content.id);
      return <Pressable key={focusId} focusable={false} onPress={() => setView(previous => ({ ...previous,
        state: transition(previous.channel, { screen: 'page', pageId: page.id, focusId }, 'select') }))}
        onLayout={event => {
          const frame = layoutFrame(event);
          if (frame) onItemLayout(focusId, frame);
        }}
        style={[styles.card, { width: module.kind === 'hero' ? layout.heroWidth : layout.cardWidth,
          padding: 8 * layout.scale, marginRight: 12 * layout.scale },
          compact && styles.compactCard, state.focusId === focusId && [styles.focused, focusStyle]]}>
        <ItemArtwork source={content.artwork} font={font} color={color}
          resizeMode={featureSelector || content.presentation === 'information' || content.presentation === 'audio' || module.kind === 'hero' || module.crop === 'contain' ? 'contain' : 'cover'}
          height={featureSelector ? layout.cardArtworkHeight : content.presentation === 'information' ? layout.cardArtworkHeight * 1.5 : module.kind === 'hero' ? layout.heroArtworkHeight : layout.cardArtworkHeight} />
        <Text numberOfLines={featureSelector ? 1 : 2} style={[font, color, aligned]}>{content.title}</Text>
        <Text style={[styles.cardType, font, color]}>{content.presentation === 'information' ? 'Book' : content.presentation === 'audio' ? 'Audio' : 'Video'}</Text>
      </Pressable>;
    });
  return <View onLayout={onLayout} style={[styles.module, moduleSpacing, compact && styles.compactSection]}>
    {title}{module.kind === 'grid' && !featureSelector ? <View onLayout={onRowLayout} style={styles.grid}>{cards}</View>
      : <ScrollView horizontal ref={rowRef} showsHorizontalScrollIndicator={false} onLayout={onRowLayout}
        onScroll={event => onRowScroll(module.id, event?.nativeEvent?.contentOffset?.x ?? 0)}
        scrollEventThrottle={16} style={styles.rail}>{cards}</ScrollView>}
  </View>;
}

function Playback({ item, muted, controls, activity, onBack, typography }) {
  const { width, height } = useWindowDimensions();
  const [playback, setPlayback] = useState({ status: 'loading', message: item.presentation === 'audio' ? 'Loading audio' : 'Loading video' });
  const [position, setPosition] = useState({ currentTime: 0, duration: 0, paused: true, muted });
  const [overlayVisible, setOverlayVisible] = useState(true);
  const controller = useRef(null);
  const stopping = useRef(Promise.resolve());
  const mounted = useRef(true);
  const hideTimer = useRef(null);
  const status = useRef(playback.status);
  status.current = playback.status;
  const showOverlay = () => {
    setOverlayVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (status.current === 'playing') hideTimer.current = setTimeout(() => setOverlayVisible(false), 4000);
  };
  const newController = () => createPlaybackController({
    createVideo: () => new VideoPlayer(), createHls: createHlsPlayer,
    installPolyfills: installHlsPolyfills, onState: setPlayback
  });
  if (!controller.current) controller.current = newController();
  useEffect(() => {
    mounted.current = true;
    controls.current = controller.current;
    activity.current = showOverlay;
    const progressTimer = setInterval(() => {
      if (mounted.current) setPosition(controller.current.snapshot());
    }, 250);
    return () => {
      mounted.current = false;
      controls.current = null;
      activity.current = null;
      clearInterval(progressTimer);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (!controller.current.isClosed()) stopping.current = controller.current.stop();
    };
  }, []);
  useEffect(() => {
    if (playback.status === 'playing') showOverlay();
    else { setOverlayVisible(true); if (hideTimer.current) clearTimeout(hideTimer.current); }
  }, [playback.status]);
  const audio = item.presentation === 'audio';
  const artworkFrame = audioArtworkFrame(width, height, Boolean(item.audiobook));
  const font = { fontFamily: typography === 'serif' ? 'serif' : 'sans-serif' };
  const progress = position.duration > 0 ? Math.min(100, position.currentTime / position.duration * 100) : 0;
  return <View style={styles.playerScreen}>
    {audio && <View pointerEvents="none" style={[styles.audioArtworkStage,
      { top: artworkFrame.top, bottom: artworkFrame.bottom }]}>
      {item.artwork.startsWith('https://')
        ? <Image source={{ uri: item.artwork }} resizeMode="contain"
          style={{ width: artworkFrame.width, height: artworkFrame.height }} />
        : <View style={{ width: artworkFrame.width, height: artworkFrame.height }} />}
    </View>}
    <KeplerVideoSurfaceView style={audio ? styles.audioSurface : styles.fullscreenVideo}
      onSurfaceViewCreated={async handle => {
        await stopping.current;
        if (!mounted.current) return;
        if (controller.current.isClosed()) controller.current = newController();
        controls.current = controller.current;
        await controller.current.start(handle, item, muted);
      }}
      onSurfaceViewDestroyed={() => {
        if (!controller.current.isClosed()) stopping.current = controller.current.stop();
      }} />
    {(overlayVisible || playback.status !== 'playing') && <>
      <View style={styles.playerTop}>
        <Pressable focusable={false} onPress={onBack} style={styles.playerBackButton}>
          <Text style={styles.playerBack}>‹</Text>
        </Pressable>
        <Text style={[styles.playerTitle, font]} numberOfLines={1}>{item.title}</Text>
        {audio && <Text style={[styles.playerCreator, font]} numberOfLines={1}>{item.narrator || item.author || item.category || ''}</Text>}
      </View>
      <View style={styles.playerCenter}>
        <View style={styles.playerAction}><Text style={styles.playerActionText}>
          {playback.status === 'ended' ? '↺' : position.paused ? '▶' : 'Ⅱ'}
        </Text></View>
        {playback.status !== 'playing' && playback.status !== 'paused' && playback.status !== 'ended' &&
          <Text style={[styles.playerMessage, font]}>{playback.message}</Text>}
      </View>
      <View style={styles.playerBottom}>
        <View style={styles.playerTimeline}><View style={[styles.playerProgress, { width: `${progress}%` }]} /></View>
        <View style={styles.playerControlRow}>
          <Text style={[styles.playerTime, font]}>{formatTime(position.currentTime)} / {formatTime(position.duration)}</Text>
          <View style={styles.playerHintRow}>
            <Text style={styles.playerHint}>◀ 10     ▶Ⅱ     10 ▶</Text>
            <SoundIcon muted={position.muted} />
          </View>
        </View>
      </View>
    </>}
  </View>;
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const layout = tvLayout(width, height);
  const [view, setView] = useState(() => ({ channel: bundled, state: initialState(bundled) }));
  const viewRef = useRef(view);
  viewRef.current = view;
  const controls = useRef(null);
  const playbackActivity = useRef(null);
  const scrollView = useRef(null);
  const detailScroll = useRef(null);
  const navScroll = useRef(null);
  const navLayouts = useRef(new Map());
  const navOffset = useRef(0);
  const navViewport = useRef(0);
  const sectionLayouts = useRef(new Map());
  const rowLayouts = useRef(new Map());
  const itemLayouts = useRef(new Map());
  const rowScrolls = useRef(new Map());
  const rowOffsets = useRef(new Map());
  const scrollOffset = useRef(0);
  const indicatorTimer = useRef(null);
  const [scrollMetrics, setScrollMetrics] = useState({ viewport: 0, content: 0, offset: 0, visible: false });
  const { channel, state } = view;
  const dispatch = command => setView(previous => ({ ...previous,
    state: transition(previous.channel, previous.state, command) }));
  const revealFocus = (focusId, currentPage) => {
    if (focusId.startsWith('nav:')) {
      scrollView.current?.scrollTo({ y: 0, animated: true });
      const item = navLayouts.current.get(focusId.slice(4));
      if (item && item.x < navOffset.current) navScroll.current?.scrollTo({ x: item.x, animated: true });
      else if (item && item.x + item.width > navOffset.current + navViewport.current)
        navScroll.current?.scrollTo({ x: item.x + item.width - navViewport.current, animated: true });
      return;
    }
    const module = currentPage?.modules.find(section => section.items.some(content =>
      itemFocusId(currentPage.id, section.id, content.id) === focusId));
    const section = sectionLayouts.current.get(module?.id);
    const row = rowLayouts.current.get(module?.id);
    const card = itemLayouts.current.get(focusId);
    const firstSelector = heroSelector(currentPage)?.selector.id === module?.id;
    if ((module?.kind === 'rail' || firstSelector) && row && card) {
      const offset = rowOffsets.current.get(module.id) ?? 0;
      const targetX = card.x < offset + 8 ? Math.max(0, card.x - 8)
        : card.x + card.width > offset + row.width - 8 ? card.x + card.width - row.width + 8 : offset;
      if (targetX !== offset) rowScrolls.current.get(module.id)?.scrollTo({ x: targetX, animated: true });
    }
    const focusedLayout = section && row && card
      ? { y: section.y + row.y + card.y, height: card.height } : section;
    const target = featureScrollTarget(focusedLayout, scrollOffset.current, scrollMetrics.viewport, firstSelector);
    if (target !== scrollOffset.current) scrollView.current?.scrollTo({ y: target, animated: true });
  };
  useEffect(() => {
    if (state.screen === 'page') revealFocus(state.focusId, channel.pages.find(candidate => candidate.id === state.pageId));
  }, [state.screen, state.pageId, state.focusId, scrollMetrics.viewport]);
  useEffect(() => {
    sectionLayouts.current.clear(); rowLayouts.current.clear(); itemLayouts.current.clear();
    rowScrolls.current.clear(); rowOffsets.current.clear(); scrollOffset.current = 0;
  }, [state.pageId]);
  useEffect(() => () => { if (indicatorTimer.current) clearTimeout(indicatorTimer.current); }, []);
  useEffect(() => {
    let active = true;
    const stop = installRelease(bundled, (next, nextState) => {
      if (active) setView({ channel: next, state: nextState });
    });
    return () => { active = false; stop(); };
  }, []);
  useEffect(() => {
    const handler = new TVEventHandler();
    handler.enable(null, (_, event) => {
      if (event?.eventKeyAction !== 0) return;
      if (viewRef.current.state.screen === 'playback') {
        playbackActivity.current?.();
        if (event?.eventType === 'left' || event?.eventType === 'rewind') { controls.current?.seek(-10); return; }
        if (event?.eventType === 'right' || event?.eventType === 'fastForward') { controls.current?.seek(10); return; }
        if (['select', 'enter', 'playPause'].includes(event?.eventType)) { void controls.current?.toggle(); return; }
        if (event?.eventType === 'play') { void controls.current?.play(); return; }
        if (event?.eventType === 'pause') { controls.current?.pause(); return; }
        if (event?.eventType === 'up' || event?.eventType === 'down') { controls.current?.toggleMute(); return; }
      }
      if (viewRef.current.state.screen === 'detail' && event?.eventType === 'down') {
        detailScroll.current?.scrollToEnd({ animated: true }); return;
      }
      if (viewRef.current.state.screen === 'detail' && event?.eventType === 'up') {
        detailScroll.current?.scrollTo({ y: 0, animated: true }); return;
      }
      const command = { up: 'up', down: 'down', left: 'left', right: 'right', select: 'select', enter: 'select' }[event?.eventType];
      if (command) dispatch(command);
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { dispatch('back'); return true; });
    return () => { handler.disable(); back.remove(); };
  }, []);
  const page = channel.pages.find(candidate => candidate.id === state.pageId);
  const heroPair = page && heroSelector(page);
  const spotlight = page && heroSpotlight(page, state);
  const item = activeItem(channel, state);
  const brand = channel.brand;
  const focusStyle = { borderColor: brand.primaryColor };
  const font = { fontFamily: brand.typography === 'serif' ? 'serif' : 'sans-serif' };
  if (state.screen === 'playback' && item) return <Playback key={item.id}
    item={item.audiobook ? { ...item, presentation: 'audio', mediaUrl: item.audiobook.mediaUrl } : item}
    muted={channel.playback.startMuted} controls={controls} activity={playbackActivity}
    onBack={() => dispatch('back')} typography={brand.typography} />;
  return <View style={[styles.screen, { backgroundColor: brand.backgroundColor,
    paddingHorizontal: layout.horizontalInset, paddingTop: layout.topInset }]}>
    {state.screen === 'page' ? <>
      <View style={[styles.header, { minHeight: 58 * layout.scale, marginBottom: 12 * layout.scale }]}>
        {brand.logo?.startsWith('https://') && <Image source={{ uri: brand.logo }}
          style={[styles.brandLogo, { width: 120 * layout.scale, height: 58 * layout.scale }]} />}
        {brand.showTitle !== false && <Text numberOfLines={1} style={[styles.heading,
          { fontSize: 42 * layout.scale, marginRight: 24 * layout.scale }, font,
          { color: brand.textColor }]}>{channel.title}</Text>}
        <ScrollView horizontal ref={navScroll} style={styles.navScroll} contentContainerStyle={styles.nav}
          showsHorizontalScrollIndicator={false}
          onLayout={event => { navViewport.current = layoutFrame(event)?.width ?? navViewport.current; }}
          onScroll={event => { navOffset.current = event?.nativeEvent?.contentOffset?.x ?? navOffset.current; }}
          scrollEventThrottle={16}>{channel.pages.map(target => <Pressable key={target.id}
            focusable={false}
            onLayout={event => {
              const frame = layoutFrame(event);
              if (frame) navLayouts.current.set(target.id, frame);
            }}
            onPress={() => setView(previous => ({ ...previous, state: { screen: 'page', pageId: target.id, focusId: navFocusId(target.id) } }))}
            style={[styles.navItem, { paddingVertical: 10 * layout.scale,
              paddingHorizontal: 14 * layout.scale, marginRight: 12 * layout.scale },
              state.focusId === navFocusId(target.id) && [styles.focused, focusStyle]]}>
            <Text numberOfLines={1} style={[font, { color: brand.textColor }]}>{target.title}</Text>
          </Pressable>)}</ScrollView>
      </View>
      <View style={styles.scrollArea}>
        <ScrollView key={page.id} ref={scrollView} showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onLayout={event => {
            const frame = layoutFrame(event);
            if (frame) setScrollMetrics(previous => ({ ...previous, viewport: frame.height }));
          }}
          onContentSizeChange={(_, content) => setScrollMetrics(previous => ({ ...previous, content }))}
          onScroll={event => {
            const offset = event?.nativeEvent?.contentOffset?.y;
            if (!Number.isFinite(offset)) return;
            scrollOffset.current = offset;
            setScrollMetrics(previous => ({ ...previous, offset, visible: true }));
            if (indicatorTimer.current) clearTimeout(indicatorTimer.current);
            indicatorTimer.current = setTimeout(() => setScrollMetrics(previous => ({ ...previous, visible: false })), 1000);
          }}>{page.modules.map(module => module === heroPair?.selector ? null : module === heroPair?.hero && spotlight ?
            <React.Fragment key={module.id}><Feature content={spotlight} brand={brand} font={font} layout={layout} />
              <Section module={heroPair.selector} page={page} state={state} brand={brand} font={font}
                focusStyle={focusStyle} layout={layout} featureSelector
                onLayout={event => {
                  const frame = layoutFrame(event);
                  if (frame) sectionLayouts.current.set(heroPair.selector.id, frame);
                }} onRowLayout={event => {
                  const frame = layoutFrame(event);
                  if (frame) rowLayouts.current.set(heroPair.selector.id, frame);
                }} onItemLayout={(focusId, frame) => {
                  itemLayouts.current.set(focusId, frame);
                  if (state.screen === 'page' && state.focusId === focusId) revealFocus(focusId, page);
                }} onRowScroll={(id, offset) => rowOffsets.current.set(id, offset)}
                rowRef={instance => { if (instance) rowScrolls.current.set(heroPair.selector.id, instance); }}
                setView={setView} /></React.Fragment> : <Section key={module.id} module={module} page={page}
            state={state} brand={brand} font={font} focusStyle={focusStyle} layout={layout}
            onLayout={event => {
              const frame = layoutFrame(event);
              if (!frame) return;
              sectionLayouts.current.set(module.id, frame);
              if (state.screen === 'page') revealFocus(state.focusId, page);
            }} onRowLayout={event => {
              const frame = layoutFrame(event);
              if (!frame) return;
              rowLayouts.current.set(module.id, frame);
              if (state.screen === 'page') revealFocus(state.focusId, page);
            }} onItemLayout={(focusId, itemLayout) => {
              itemLayouts.current.set(focusId, itemLayout);
              if (state.screen === 'page' && state.focusId === focusId) revealFocus(focusId, page);
            }} onRowScroll={(id, offset) => rowOffsets.current.set(id, offset)}
            rowRef={instance => { if (instance) rowScrolls.current.set(module.id, instance); }}
            setView={setView} />)}</ScrollView>
        {scrollMetrics.visible && scrollMetrics.viewport > 0 && scrollMetrics.content > scrollMetrics.viewport + 2 &&
          <View pointerEvents="none" style={[styles.scrollIndicator, {
            height: Math.max(20, scrollMetrics.viewport ** 2 / scrollMetrics.content),
            top: Math.max(0, Math.min(scrollMetrics.viewport - 20,
              scrollMetrics.offset / (scrollMetrics.content - scrollMetrics.viewport) *
              (scrollMetrics.viewport - Math.max(20, scrollMetrics.viewport ** 2 / scrollMetrics.content))))
          }]} />}
      </View>
    </> : <>
      <Text style={[styles.heading, font, { color: brand.textColor }]}>{item?.title}</Text>
      {state.screen === 'detail' ? <>
        <ScrollView ref={detailScroll} style={styles.detailScroll}>
          {item?.artwork?.startsWith('https://') && <Image source={{ uri: item.artwork }}
            style={item.presentation === 'information' ? styles.bookDetailArtwork : styles.detailArtwork} />}
          {item?.author && <Text style={[styles.detailMeta, font, { color: brand.textColor }]}>By {item.author}</Text>}
          {item?.series && <Text style={[styles.detailMeta, font, { color: brand.textColor }]}>{item.series}</Text>}
          {item?.publicationDate && <Text style={[styles.detailMeta, font, { color: brand.textColor }]}>{item.publicationDate}</Text>}
          <Text style={[styles.detailCopy, font, { color: brand.textColor }]}>{item?.description}</Text>
        </ScrollView>
        {(item?.presentation !== 'information' || item?.audiobook) &&
          <Pressable focusable={false} style={[styles.card, styles.focused, focusStyle]} onPress={() => dispatch('select')}>
            <Text style={[font, { color: brand.textColor }]}>{item?.audiobook ? 'Listen to Audiobook' : item?.presentation === 'audio' ? 'Listen' : 'Play film'}</Text>
          </Pressable>}
      </> : null}
      <Pressable focusable={false} onPress={() => dispatch('back')}><Text style={[font, { color: brand.textColor }]}>Back to channel</Text></Pressable>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', minHeight: 58, marginBottom: 12 },
  heading: { fontSize: 42, fontWeight: 'bold', flexShrink: 1, marginRight: 24 },
  navScroll: { flex: 1 }, nav: { flexDirection: 'row', alignItems: 'center' },
  navItem: { paddingVertical: 10, paddingHorizontal: 14, marginRight: 12, borderWidth: 2, borderColor: 'transparent', borderRadius: 6 },
  scrollArea: { flex: 1 }, scrollIndicator: { position: 'absolute', right: -2, width: 2,
    borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  feature: { flexDirection: 'row', overflow: 'hidden', borderRadius: 8, marginBottom: 2 },
  featureBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
  featureScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)' },
  featureCopy: { flex: 1, justifyContent: 'center', zIndex: 1 },
  featureKicker: { color: '#E5EEE9', fontSize: 14, fontWeight: 'bold', borderLeftWidth: 4, paddingLeft: 8 },
  featureTitle: { color: '#FFFFFF', fontWeight: 'bold', marginTop: 8 },
  featureDescription: { color: '#F0F3F1', lineHeight: 25, marginTop: 6 },
  featureMeta: { color: '#D0D9D3', fontSize: 17, marginTop: 8 },
  featureAction: { alignSelf: 'flex-start', fontSize: 18, fontWeight: 'bold', marginTop: 12,
    borderRadius: 5, paddingHorizontal: 14, paddingVertical: 7 },
  featureFrame: { alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  featureFallback: { color: '#E5EEE9', fontSize: 18 },
  module: { marginVertical: 8 }, moduleTitle: { fontSize: 27, marginBottom: 8 },
  body: { fontSize: 22, lineHeight: 32 }, sectionSurface: { backgroundColor: '#ffffff16', borderRadius: 8 },
  compactSection: { padding: 8, marginVertical: 8 }, comfortableSection: { padding: 20 },
  staticSection: { minHeight: 170 }, staticRow: { flexDirection: 'row', alignItems: 'center' },
  staticRight: { flexDirection: 'row-reverse' }, staticArt: { width: '45%', height: 220, backgroundColor: '#ffffff12' },
  bannerArt: { width: '60%' }, missingArt: { alignItems: 'center', justifyContent: 'center' },
  staticCopy: { flex: 1, paddingHorizontal: 24 }, compactCard: { marginRight: 8 },
  rail: { flexGrow: 0 }, grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { padding: 8, borderWidth: 2, borderColor: 'transparent', borderRadius: 6, marginRight: 12 },
  artwork: { height: 124, width: '100%', marginBottom: 8 },
  cardType: { fontSize: 16, marginTop: 4 },
  brandLogo: { width: 160, height: 80, resizeMode: 'contain' },
  detailArtwork: { width: 420, height: 240, resizeMode: 'contain', marginBottom: 20 },
  bookDetailArtwork: { width: 260, height: 370, resizeMode: 'contain', marginBottom: 20 },
  detailScroll: { flex: 1 }, detailMeta: { fontSize: 24, marginBottom: 8 },
  detailCopy: { fontSize: 22, lineHeight: 32, marginBottom: 24 },
  focused: {},
  playerScreen: { flex: 1, backgroundColor: '#000000' },
  fullscreenVideo: { ...StyleSheet.absoluteFillObject },
  playerTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 32, backgroundColor: 'rgba(0,0,0,0.72)' },
  playerBackButton: { width: 32, marginRight: 24, alignItems: 'flex-start' },
  playerBack: { color: '#FFFFFF', fontSize: 30, lineHeight: 34 },
  playerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', flex: 1 },
  playerCreator: { color: '#FFFFFF', fontSize: 18, maxWidth: 300, marginLeft: 20 },
  playerCenter: { position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center' },
  playerAction: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' },
  playerActionText: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold' },
  playerMessage: { color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.78)', fontSize: 24,
    paddingHorizontal: 20, paddingVertical: 10, marginTop: 22, textAlign: 'center' },
  playerBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 32,
    paddingTop: 10, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.76)' },
  playerTimeline: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.48)' },
  playerProgress: { height: 5, borderRadius: 3, backgroundColor: '#F04438' },
  playerControlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  playerTime: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  playerHint: { color: '#D7D7D7', fontSize: 18 },
  playerHintRow: { flexDirection: 'row', alignItems: 'center' },
  soundIcon: { width: 34, height: 24, marginLeft: 24 },
  speakerBox: { position: 'absolute', left: 0, top: 8, width: 7, height: 8, backgroundColor: '#D7D7D7' },
  speakerCone: { position: 'absolute', left: 5, top: 4, width: 0, height: 0, borderTopWidth: 8,
    borderBottomWidth: 8, borderRightWidth: 12, borderTopColor: 'transparent',
    borderBottomColor: 'transparent', borderRightColor: '#D7D7D7' },
  speakerWaveInner: { position: 'absolute', left: 17, top: 6, width: 8, height: 12, borderWidth: 2,
    borderColor: 'transparent', borderRightColor: '#D7D7D7', borderRadius: 8 },
  speakerWaveOuter: { position: 'absolute', left: 19, top: 2, width: 13, height: 20, borderWidth: 2,
    borderColor: 'transparent', borderRightColor: '#D7D7D7', borderRadius: 12 },
  speakerOff: { position: 'absolute', left: 19, top: -4, color: '#D7D7D7', fontSize: 25 },
  audioArtworkStage: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  audioSurface: { width: 1, height: 1, opacity: 0 }
});
