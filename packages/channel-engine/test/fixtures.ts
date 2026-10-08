import { channelSpecSchema, type ChannelSpec } from '@firelaunch/contracts';

export function fixtureChannel(): ChannelSpec {
  return channelSpecSchema.parse({
    schemaVersion: 1,
    id: 'ch_11111111111111111111111111111111', title: 'Wild Earth', slug: 'wild-earth',
    brand: { primaryColor: '#48AA88', backgroundColor: '#101820', textColor: '#FFFFFF' },
    navigation: ['page_22222222222222222222222222222222'],
    pages: [{ id: 'page_22222222222222222222222222222222', title: 'Home', modules: [{
      id: 'mod_33333333333333333333333333333333', kind: 'hero', contentIds: ['item_44444444444444444444444444444444']
    }] }],
    content: [{ id: 'item_44444444444444444444444444444444', title: 'Oceans', description: 'An ocean film', artwork: 'assets/ocean.jpg', mediaUrl: 'https://example.org/ocean.mp4' }],
    playback: { autoplayNext: false, startMuted: false }
  });
}
