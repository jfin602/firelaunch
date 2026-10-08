import type { ChannelProject } from '@firelaunch/contracts';
import type { ChannelMutation } from '@firelaunch/channel-engine';

export const SAMPLE_MEDIA = 'http://127.0.0.1:4173/media/field-notes.mp4';
export const SAMPLE_ART = 'assets/field-notes.svg';

export function sampleMutations(project: ChannelProject, itemIds: [string, string, string], moduleIds: [string, string, string, string]): ChannelMutation[] {
  const pageId = project.spec.pages[0]!.id;
  return [
    { type: 'addContent', content: { id: itemIds[0], title: 'Field Notes', description: 'An original five-second procedural motion study created for FireLaunch. This demo clip is a placeholder for licensed wildlife footage.', artwork: SAMPLE_ART, mediaUrl: SAMPLE_MEDIA, category: 'Nature', durationSeconds: 5 } },
    { type: 'addContent', content: { id: itemIds[1], title: 'Ocean Palette', description: 'Original concept artwork with the same procedural demo clip; replace with rights-cleared ocean footage for a real channel.', artwork: 'assets/ocean-palette.svg', mediaUrl: SAMPLE_MEDIA, category: 'Oceans', durationSeconds: 5 } },
    { type: 'addContent', content: { id: itemIds[2], title: 'Golden Hour', description: 'Original concept artwork with the same procedural demo clip; replace with rights-cleared wildlife footage for a real channel.', artwork: 'assets/golden-hour.svg', mediaUrl: SAMPLE_MEDIA, category: 'Africa', durationSeconds: 5 } },
    { type: 'addModule', pageId, module: { id: moduleIds[0], kind: 'hero', contentIds: [itemIds[0]] } },
    { type: 'addModule', pageId, module: { id: moduleIds[1], kind: 'rail', title: 'Nature', contentIds: [itemIds[0]] } },
    { type: 'addModule', pageId, module: { id: moduleIds[2], kind: 'rail', title: 'Oceans', contentIds: [itemIds[1]] } },
    { type: 'addModule', pageId, module: { id: moduleIds[3], kind: 'rail', title: 'Africa', contentIds: [itemIds[2]] } }
  ];
}
