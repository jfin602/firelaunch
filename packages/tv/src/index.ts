import { channelSpecSchema, type ChannelSpec } from '@firelaunch/contracts';
import { projectTelevision } from './runtime.js';

export * from './runtime.js';

export function televisionFromSpec(spec: ChannelSpec) {
  return projectTelevision(channelSpecSchema.parse(spec));
}
