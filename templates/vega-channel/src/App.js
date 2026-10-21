import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, TVEventHandler, View } from 'react-native';
import { KeplerVideoSurfaceView, VideoPlayer } from '@amazon-devices/react-native-w3cmedia';
import bundled from './channel.json';
import { installRelease } from './release-client';
import { activeItem, initialState, itemFocusId, navFocusId, transition } from './tv-runtime';
import { createPlaybackController } from './playback-controller';
import { createHlsPlayer, installHlsPolyfills } from './hlsjs/adapter';

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

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

function StaticArtwork({ source, crop, banner, font, color }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  const artStyle = [styles.staticArt, banner && styles.bannerArt];
  if (source?.startsWith('https://') && !failed) return <Image source={{ uri: source }}
    resizeMode={crop === 'contain' ? 'contain' : 'cover'} onError={() => setFailed(true)} style={artStyle} />;
  return <View style={[artStyle, styles.missingArt]}><Text style={[font, color]}>Artwork unavailable</Text></View>;
}

function Section({ module, page, state, brand, font, focusStyle, setView }) {
  const color = { color: brand.textColor };
  const aligned = { textAlign: module.alignment === 'center' ? 'center' : 'left' };
  const compact = module.spacing === 'compact';
  const surface = module.background === 'surface' ? styles.sectionSurface : null;
  const title = module.title && <Text style={[styles.moduleTitle, font, color, aligned]}>{module.title}</Text>;
  if (module.kind === 'text') return <View style={[styles.module, surface, compact ? styles.compactSection : styles.comfortableSection]}>
    {title}<Text style={[styles.body, font, color, aligned]}>{module.body}</Text>
  </View>;
  if (module.kind === 'image-banner' || module.kind === 'image-text') {
    const art = <StaticArtwork source={module.image?.artwork} crop={module.crop}
      banner={module.kind === 'image-banner'} font={font} color={color} />;
    return <View style={[styles.module, styles.staticSection, surface, compact ? styles.compactSection : styles.comfortableSection]}>
      {title}<View style={[styles.staticRow, module.kind === 'image-text' && module.imageSide === 'right' && styles.staticRight]}>
        {art}<Text style={[styles.body, styles.staticCopy, font, color, aligned]}>{module.body}</Text>
      </View>
    </View>;
  }
  if (module.kind !== 'hero' && module.kind !== 'rail' && module.kind !== 'grid')
    throw new Error(`Unsupported TV section: ${module.kind}`);
  return <View style={[styles.module, compact && styles.compactSection]}>
    {title}<View style={module.kind === 'grid' ? styles.grid : styles.rail}>{module.items.map(content => {
      const focusId = itemFocusId(page.id, module.id, content.id);
      return <Pressable key={focusId} focusable={false} onPress={() => setView(previous => ({ ...previous,
        state: transition(previous.channel, { screen: 'page', pageId: page.id, focusId }, 'select') }))}
        style={[styles.card, module.kind === 'hero' && styles.hero,
          compact && styles.compactCard, state.focusId === focusId && [styles.focused, focusStyle]]}>
        {content.artwork?.startsWith('https://') ? <Image source={{ uri: content.artwork }}
          resizeMode={module.crop === 'contain' ? 'contain' : 'cover'} style={styles.artwork} />
          : <View style={styles.artwork} />}
        <Text style={[font, color, aligned]}>{content.title}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

function Playback({ item, muted, controls, activity, onBack, typography }) {
  const [playback, setPlayback] = useState({ status: 'loading', message: 'Loading video' });
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
  const font = { fontFamily: typography === 'serif' ? 'serif' : 'sans-serif' };
  const progress = position.duration > 0 ? Math.min(100, position.currentTime / position.duration * 100) : 0;
  return <View style={styles.playerScreen}>
    {audio && (item.artwork.startsWith('https://')
      ? <Image source={{ uri: item.artwork }} style={styles.audioArtwork} /> : <View style={styles.audioArtwork} />)}
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
  const [view, setView] = useState(() => ({ channel: bundled, state: initialState(bundled) }));
  const viewRef = useRef(view);
  viewRef.current = view;
  const controls = useRef(null);
  const playbackActivity = useRef(null);
  const { channel, state } = view;
  const dispatch = command => setView(previous => ({ ...previous,
    state: transition(previous.channel, previous.state, command) }));
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
      const command = { up: 'up', down: 'down', left: 'left', right: 'right', select: 'select', enter: 'select' }[event?.eventType];
      if (command) dispatch(command);
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { dispatch('back'); return true; });
    return () => { handler.disable(); back.remove(); };
  }, []);
  const page = channel.pages.find(candidate => candidate.id === state.pageId);
  const item = activeItem(channel, state);
  const brand = channel.brand;
  const focusStyle = { borderColor: brand.primaryColor };
  const font = { fontFamily: brand.typography === 'serif' ? 'serif' : 'sans-serif' };
  if (state.screen === 'playback' && item) return <Playback key={item.id} item={item}
    muted={channel.playback.startMuted} controls={controls} activity={playbackActivity}
    onBack={() => dispatch('back')} typography={brand.typography} />;
  return <View style={[styles.screen, { backgroundColor: brand.backgroundColor }]}>
    {state.screen === 'page' ? <>
      {brand.logo?.startsWith('https://') && <Image source={{ uri: brand.logo }} style={styles.brandLogo} />}
      {brand.showTitle !== false && <Text style={[styles.heading, font, { color: brand.textColor }]}>{channel.title}</Text>}
      <View style={styles.nav}>{channel.pages.map(target => <Pressable key={target.id}
        focusable={false}
        onPress={() => setView(previous => ({ ...previous, state: { screen: 'page', pageId: target.id, focusId: navFocusId(target.id) } }))}
        style={[styles.navItem, state.focusId === navFocusId(target.id) && [styles.focused, focusStyle]]}>
        <Text style={[font, { color: brand.textColor }]}>{target.title}</Text>
      </Pressable>)}</View>
      <ScrollView>{page.modules.map(module => <Section key={module.id} module={module} page={page}
        state={state} brand={brand} font={font} focusStyle={focusStyle} setView={setView} />)}</ScrollView>
    </> : <>
      <Text style={[styles.heading, font, { color: brand.textColor }]}>{item?.title}</Text>
      {state.screen === 'detail' ? <>
        {item?.artwork?.startsWith('https://') && <Image source={{ uri: item.artwork }} style={styles.detailArtwork} />}
        <Text style={[font, { color: brand.textColor }]}>{item?.description}</Text>
        {item?.presentation === 'information' ? <Pressable focusable={false} style={[styles.card, styles.focused, focusStyle]} onPress={() => dispatch('back')}>
          <Text style={[font, { color: brand.textColor }]}>Back to channel</Text>
        </Pressable> : <Pressable focusable={false} style={[styles.card, styles.focused, focusStyle]} onPress={() => dispatch('select')}>
          <Text style={[font, { color: brand.textColor }]}>{item?.presentation === 'audio' ? 'Play audio' : 'Play film'}</Text>
        </Pressable>}
      </> : null}
      <Pressable focusable={false} onPress={() => dispatch('back')}><Text style={[font, { color: brand.textColor }]}>Back</Text></Pressable>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 60 }, heading: { fontSize: 48, fontWeight: 'bold' },
  nav: { flexDirection: 'row', marginVertical: 24 }, navItem: { padding: 16, marginRight: 16 },
  module: { marginVertical: 16 }, moduleTitle: { fontSize: 30, marginBottom: 12 },
  body: { fontSize: 22, lineHeight: 32 }, sectionSurface: { backgroundColor: '#ffffff16', borderRadius: 8 },
  compactSection: { padding: 8, marginVertical: 8 }, comfortableSection: { padding: 20 },
  staticSection: { minHeight: 170 }, staticRow: { flexDirection: 'row', alignItems: 'center' },
  staticRight: { flexDirection: 'row-reverse' }, staticArt: { width: '45%', height: 220, backgroundColor: '#ffffff12' },
  bannerArt: { width: '60%' }, missingArt: { alignItems: 'center', justifyContent: 'center' },
  staticCopy: { flex: 1, paddingHorizontal: 24 }, compactCard: { marginRight: 8 },
  rail: { flexDirection: 'row' }, grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { width: 250, padding: 12, borderWidth: 4, borderColor: 'transparent', marginRight: 16 },
  hero: { width: 420 }, artwork: { height: 160, width: '100%', marginBottom: 12 },
  brandLogo: { width: 160, height: 80, resizeMode: 'contain' },
  detailArtwork: { width: 420, height: 240, resizeMode: 'contain', marginBottom: 20 },
  focused: { borderWidth: 4 },
  playerScreen: { flex: 1, backgroundColor: '#000000' },
  fullscreenVideo: { ...StyleSheet.absoluteFillObject },
  playerTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 32, backgroundColor: 'rgba(0,0,0,0.72)' },
  playerBackButton: { width: 32, marginRight: 24, alignItems: 'flex-start' },
  playerBack: { color: '#FFFFFF', fontSize: 30, lineHeight: 34 },
  playerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', flex: 1 },
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
  audioArtwork: { width: 320, height: 320, alignSelf: 'center', marginTop: 220 },
  audioSurface: { width: 1, height: 1, opacity: 0 }
});
