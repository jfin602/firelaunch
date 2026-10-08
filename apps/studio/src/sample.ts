import type { ChannelProject } from '@firelaunch/contracts';
import type { ChannelMutation } from '@firelaunch/channel-engine';

export const SAMPLE_MEDIA = 'http://127.0.0.1:4173/media/field-notes.mp4';
export const SAMPLE_ART = 'assets/field-notes.svg';

export function sampleMutations(project: ChannelProject, itemId: string, moduleIds: [string, string, string]): ChannelMutation[] {
  const pageId = project.spec.pages[0]!.id;
  return [
    { type: 'addContent', content: { id: itemId, title: 'Field Notes', description: 'A short, procedurally generated motion study. Sample footage created for FireLaunch.', artwork: SAMPLE_ART, mediaUrl: SAMPLE_MEDIA, category: 'Sample', durationSeconds: 5 } },
    { type: 'addModule', pageId, module: { id: moduleIds[0], kind: 'hero', contentIds: [itemId] } },
    { type: 'addModule', pageId, module: { id: moduleIds[1], kind: 'rail', title: 'Featured films', contentIds: [itemId] } },
    { type: 'addModule', pageId, module: { id: moduleIds[2], kind: 'grid', title: 'Explore the collection', contentIds: [itemId] } }
  ];
}
