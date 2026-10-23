import React from 'react';
import { createRoot } from 'react-dom/client';
import { channelSpecSchema } from '@vegalaunch/contracts';
import { Preview } from './src/Preview.js';
import './src/style.css';
import './hero-demo.css';
import silentPlanet from '../../test-assets/hero-multimedia/silent-planet.jpg';
import echoesOfEarth from '../../test-assets/hero-multimedia/echoes-of-earth.jpg';
import neonShadows from '../../test-assets/hero-multimedia/neon-shadows.jpg';
import lastFrontier from '../../test-assets/hero-multimedia/last-frontier.jpg';
import ambientFocus from '../../test-assets/hero-multimedia/ambient-focus.jpg';
import observatoryBook from '../../test-assets/hero-multimedia/observatory-book.jpg';

const page = (digit: string) => `page_${digit.repeat(32)}`;
const mod = (digit: string) => `mod_${digit.repeat(32)}`;
const item = (digit: string) => `item_${digit.repeat(32)}`;
const art = (path: string) => new URL(path, window.location.href).href;
const content = [
  { id: item('1'), title: 'The Silent Planet', description: 'A lone explorer discovers a hidden world where silence reveals the truth.', artwork: art(silentPlanet), mediaUrl: art('/media/field-notes.mp4'), category: 'Featured film', publicationDate: '2024-01-01' },
  { id: item('2'), title: 'Echoes of Earth', description: 'A voyage beyond the familiar into a vast blue wilderness.', artwork: art(echoesOfEarth), mediaUrl: art('/media/field-notes.mp4'), category: 'Film' },
  { id: item('3'), title: 'Neon Shadows', description: 'One search lights the way through a sleepless city.', artwork: art(neonShadows), mediaUrl: art('/media/field-notes.mp4'), category: 'Series' },
  { id: item('4'), title: 'The Last Frontier', description: 'A cinematic journey through the mountains and beyond.', artwork: art(lastFrontier), mediaUrl: art('/media/field-notes.mp4'), category: 'Film' },
  { id: item('5'), title: 'Ambient Focus', description: 'Slow down and settle into a warm soundscape.', artwork: art(ambientFocus), presentation: 'audio' as const, mediaUrl: art('/qualification/p8-recovery/original-tone-24s-9d72bd377940dbc4.mp3'), category: 'Audio' },
  { id: item('6'), title: 'The Observatory', description: 'A researcher follows the stars into an ancient mystery.', artwork: art(observatoryBook), presentation: 'information' as const, category: 'Book', author: 'Demo Library' }
];
const spec = channelSpecSchema.parse({
  schemaVersion: 1, id: `ch_${'a'.repeat(32)}`, title: 'snabble tv', slug: 'snabble-tv-demo',
  brand: { primaryColor: '#ff6a00', backgroundColor: '#000000', textColor: '#ffffff', typography: 'sans', showTitle: true },
  navigation: [page('a'), page('b'), page('c'), page('d')],
  pages: [
    { id: page('a'), title: 'Featured', modules: [
      { id: mod('1'), kind: 'hero', contentIds: [item('1')] },
      { id: mod('2'), kind: 'text', title: 'Explore', body: 'Original demo artwork for the focused title.' },
      { id: mod('3'), kind: 'rail', title: 'Films, audio and books', contentIds: content.map(value => value.id) },
      { id: mod('4'), kind: 'image-text', title: 'More to discover', body: 'Other authored modules stay reachable.', imageContentId: item('4') }
    ] },
    ...(['Series', 'Home', 'Movies'] as const).map((title, index) => ({ id: page('bcd'[index]!), title,
      modules: [{ id: mod('567'[index]!), kind: 'rail' as const, title, contentIds: [item('2'), item('3')] }] }))
  ],
  content, playback: { autoplayNext: false, startMuted: false }
});

document.body.classList.add('hero-demo');
createRoot(document.getElementById('root')!).render(<Preview spec={spec} fullscreen controlsVisible={false} />);
