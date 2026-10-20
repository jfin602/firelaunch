import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, TVEventHandler, View } from 'react-native';
import { KeplerVideoSurfaceView, VideoPlayer } from '@amazon-devices/react-native-w3cmedia';
import bundled from './channel.json';
import { installRelease } from './release-client';
import { activeItem, initialState, itemFocusId, navFocusId, transition } from './tv-runtime';
import { createPlaybackController } from './playback-controller';
import { createHlsPlayer, installHlsPolyfills } from './hlsjs/adapter';

function Playback({ item, muted, controls }) {
  const [playback, setPlayback] = useState({ status: 'loading', message: 'Loading video' });
  const controller = useRef(null);
  const stopping = useRef(Promise.resolve());
  const mounted = useRef(true);
  const newController = () => createPlaybackController({
    createVideo: () => new VideoPlayer(), createHls: createHlsPlayer,
    installPolyfills: installHlsPolyfills, onState: setPlayback
  });
  if (!controller.current) controller.current = newController();
  useEffect(() => {
    mounted.current = true;
    controls.current = controller.current;
    return () => {
      mounted.current = false;
      controls.current = null;
      if (!controller.current.isClosed()) stopping.current = controller.current.stop();
    };
  }, []);
  const audio = item.presentation === 'audio';
  return <View style={audio ? styles.audioPlayback : styles.videoPlayback}>
    {audio && (item.artwork.startsWith('https://')
      ? <Image source={{ uri: item.artwork }} style={styles.audioArtwork} /> : <View style={styles.audioArtwork} />)}
    {audio && <Text style={styles.playbackStatus}>Now listening</Text>}
    <KeplerVideoSurfaceView style={audio ? styles.audioSurface : styles.video}
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
    <Text style={styles.playbackStatus}>{playback.message}</Text>
    <Text style={styles.playbackStatus}>Left / Right: seek 10s · Select: play / pause · Up / Down: mute · Back: details</Text>
    {playback.status === 'error' && <Text style={styles.playbackStatus}>Press Back to return to details.</Text>}
  </View>;
}

export default function App() {
  const [view, setView] = useState(() => ({ channel: bundled, state: initialState(bundled) }));
  const viewRef = useRef(view);
  viewRef.current = view;
  const controls = useRef(null);
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
  return <View style={[styles.screen, { backgroundColor: brand.backgroundColor }]}>
    {state.screen === 'page' ? <>
      {brand.logo?.startsWith('https://') && <Image source={{ uri: brand.logo }} style={styles.brandLogo} />}
      {brand.showTitle !== false && <Text style={[styles.heading, { color: brand.textColor }]}>{channel.title}</Text>}
      <View style={styles.nav}>{channel.pages.map(target => <Pressable key={target.id}
        focusable={false}
        onPress={() => setView(previous => ({ ...previous, state: { screen: 'page', pageId: target.id, focusId: navFocusId(target.id) } }))}
        style={[styles.navItem, state.focusId === navFocusId(target.id) && [styles.focused, focusStyle]]}>
        <Text style={{ color: brand.textColor }}>{target.title}</Text>
      </Pressable>)}</View>
      <ScrollView>{page.modules.map(module => <View key={module.id} style={styles.module}>
        {module.title && <Text style={[styles.moduleTitle, { color: brand.textColor }]}>{module.title}</Text>}
        {module.kind === 'text' ? <Text style={{ color: brand.textColor }}>{module.body}</Text> :
          <View style={module.kind === 'grid' ? styles.grid : styles.rail}>{module.items.map(content => {
            const focusId = itemFocusId(page.id, module.id, content.id);
            return <Pressable key={focusId} focusable={false} onPress={() => setView(previous => ({ ...previous,
              state: transition(previous.channel, { screen: 'page', pageId: page.id, focusId }, 'select') }))}
              style={[styles.card, module.kind === 'hero' && styles.hero,
                state.focusId === focusId && [styles.focused, focusStyle]]}>
              {content.artwork.startsWith('https://') ? <Image source={{ uri: content.artwork }} style={styles.artwork} />
                : <View style={styles.artwork} />}
              <Text style={{ color: brand.textColor }}>{content.title}</Text>
            </Pressable>;
          })}</View>}
      </View>)}</ScrollView>
    </> : <>
      <Text style={[styles.heading, { color: brand.textColor }]}>{item?.title}</Text>
      {state.screen === 'detail' ? <>
        {item?.artwork?.startsWith('https://') && <Image source={{ uri: item.artwork }} style={styles.detailArtwork} />}
        <Text style={{ color: brand.textColor }}>{item?.description}</Text>
        {item?.presentation === 'information' ? <Pressable focusable={false} style={[styles.card, styles.focused, focusStyle]} onPress={() => dispatch('back')}>
          <Text style={{ color: brand.textColor }}>Back to channel</Text>
        </Pressable> : <Pressable focusable={false} style={[styles.card, styles.focused, focusStyle]} onPress={() => dispatch('select')}>
          <Text style={{ color: brand.textColor }}>{item?.presentation === 'audio' ? 'Play audio' : 'Play film'}</Text>
        </Pressable>}
      </> : item && <Playback key={item.id} item={item} muted={channel.playback.startMuted} controls={controls} />}
      <Pressable focusable={false} onPress={() => dispatch('back')}><Text style={{ color: brand.textColor }}>Back</Text></Pressable>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 60 }, heading: { fontSize: 48, fontWeight: 'bold' },
  nav: { flexDirection: 'row', marginVertical: 24 }, navItem: { padding: 16, marginRight: 16 },
  module: { marginVertical: 16 }, moduleTitle: { fontSize: 30, marginBottom: 12 },
  rail: { flexDirection: 'row' }, grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { width: 250, padding: 12, borderWidth: 4, borderColor: 'transparent', marginRight: 16 },
  hero: { width: 420 }, artwork: { height: 160, width: '100%', marginBottom: 12 },
  brandLogo: { width: 160, height: 80, resizeMode: 'contain' },
  detailArtwork: { width: 420, height: 240, resizeMode: 'contain', marginBottom: 20 },
  focused: { borderWidth: 4 }, videoPlayback: { flex: 1 }, video: { flex: 1 },
  audioPlayback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  audioArtwork: { width: 320, height: 320 }, playbackStatus: { color: '#FFFFFF', fontSize: 24, marginTop: 12 },
  audioSurface: { width: 1, height: 1, opacity: 0 }
});
