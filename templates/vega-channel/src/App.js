import React, { useEffect, useState } from 'react';
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, TVEventHandler, View } from 'react-native';
import { Video } from '@amazon-devices/react-native-w3cmedia';
import channel from './channel.json';
import { activeItem, initialState, itemFocusId, navFocusId, transition } from './tv-runtime';

function Playback({ item, muted }) {
  return <Video style={styles.video} src={item.mediaUrl} muted={muted} autoplay controls />;
}

export default function App() {
  const [state, setState] = useState(() => initialState(channel));
  const dispatch = command => setState(previous => transition(channel, previous, command));
  useEffect(() => {
    const handler = new TVEventHandler();
    handler.enable(null, (_, event) => {
      const command = { up: 'up', down: 'down', left: 'left', right: 'right', select: 'select', back: 'back' }[event?.eventType];
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
      {brand.showTitle !== false && <Text style={[styles.heading, { color: brand.textColor }]}>{channel.title}</Text>}
      <View style={styles.nav}>{channel.pages.map(target => <Pressable key={target.id}
        onPress={() => setState({ screen: 'page', pageId: target.id, focusId: navFocusId(target.id) })}
        style={[styles.navItem, state.focusId === navFocusId(target.id) && [styles.focused, focusStyle]]}>
        <Text style={{ color: brand.textColor }}>{target.title}</Text>
      </Pressable>)}</View>
      <ScrollView>{page.modules.map(module => <View key={module.id} style={styles.module}>
        {module.title && <Text style={[styles.moduleTitle, { color: brand.textColor }]}>{module.title}</Text>}
        {module.kind === 'text' ? <Text style={{ color: brand.textColor }}>{module.body}</Text> :
          <View style={module.kind === 'grid' ? styles.grid : styles.rail}>{module.items.map(content => {
            const focusId = itemFocusId(page.id, module.id, content.id);
            return <Pressable key={focusId} onPress={() => setState(transition(channel,
              { screen: 'page', pageId: page.id, focusId }, 'select'))}
              style={[styles.card, module.kind === 'hero' && styles.hero,
                state.focusId === focusId && [styles.focused, focusStyle]]}>
              {content.artwork.startsWith('http') ? <Image source={{ uri: content.artwork }} style={styles.artwork} />
                : <View style={styles.artwork} />}
              <Text style={{ color: brand.textColor }}>{content.title}</Text>
            </Pressable>;
          })}</View>}
      </View>)}</ScrollView>
    </> : <>
      <Text style={[styles.heading, { color: brand.textColor }]}>{item?.title}</Text>
      {state.screen === 'detail' ? <>
        <Text style={{ color: brand.textColor }}>{item?.description}</Text>
        <Pressable style={[styles.card, styles.focused, focusStyle]} onPress={() => dispatch('select')}>
          <Text style={{ color: brand.textColor }}>Play</Text>
        </Pressable>
      </> : item && <Playback item={item} muted={channel.playback.startMuted} />}
      <Pressable onPress={() => dispatch('back')}><Text style={{ color: brand.textColor }}>Back</Text></Pressable>
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
  focused: { borderWidth: 4 }, video: { flex: 1 }
});
