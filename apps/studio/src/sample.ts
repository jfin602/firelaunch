import type { ChannelProject } from '@firelaunch/contracts';
import type { ChannelMutation } from '@firelaunch/channel-engine';

export const SAMPLE_MEDIA = 'http://127.0.0.1:4173/media/field-notes.mp4';
export const newFilmMediaUrl = (hosted: boolean) => hosted ? '' : SAMPLE_MEDIA;
export const SAMPLE_ART = 'assets/field-notes.svg';

export function sampleMutations(project: ChannelProject, itemIds: [string, string, string]): ChannelMutation[] {
  const { spec } = project;
  const home = spec.pages[0];
  const [hero, row] = home?.modules ?? [];
  if (spec.pages.length !== 1 || home?.title !== 'Home' || spec.content.length || home.modules.length !== 2 || hero?.kind !== 'hero' || row?.kind !== 'rail' || hero.contentIds.length || row.contentIds.length) {
    throw new Error('Demo content can only be added to an untouched starter channel');
  }
  return [
    { type: 'addContent', content: { id: itemIds[0], title: 'Field Notes', description: 'An original five-second procedural motion study created for FireLaunch. This demo clip is a placeholder for licensed wildlife footage.', artwork: SAMPLE_ART, mediaUrl: SAMPLE_MEDIA, category: 'Nature', durationSeconds: 5 } },
    { type: 'addContent', content: { id: itemIds[1], title: 'Ocean Palette', description: 'Original concept artwork with the same procedural demo clip; replace with rights-cleared ocean footage for a real channel.', artwork: 'assets/ocean-palette.svg', mediaUrl: SAMPLE_MEDIA, category: 'Oceans', durationSeconds: 5 } },
    { type: 'addContent', content: { id: itemIds[2], title: 'Golden Hour', description: 'Original concept artwork with the same procedural demo clip; replace with rights-cleared wildlife footage for a real channel.', artwork: 'assets/golden-hour.svg', mediaUrl: SAMPLE_MEDIA, category: 'Africa', durationSeconds: 5 } },
    { type: 'updateModule', pageId: home.id, module: { ...hero, contentIds: [itemIds[0]] } },
    { type: 'updateModule', pageId: home.id, module: { ...row, contentIds: [itemIds[1], itemIds[2]] } }
  ];
}
