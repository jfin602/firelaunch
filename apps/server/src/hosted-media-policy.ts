import { isIP } from 'node:net';
import type { ChannelSpec } from '@firelaunch/contracts';
import { RepositoryError } from './repository.js';

// ChannelSpec is exportable. A draft capability, signed URL, loopback address or
// private API route must never become a durable TV media reference.
export function publicMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash &&
      !isIP(host) && !host.startsWith('[') && host !== 'localhost' && !host.endsWith('.localhost') &&
      !host.endsWith('.local') && !host.endsWith('.internal') && !host.endsWith('.amazonaws.com') &&
      !host.endsWith('.amazonaws.com.cn') &&
      (!url.port || url.port === '443') &&
      !url.pathname.split('/').some(part => ['private-objects', 'draft-audio', 'staged', 'original'].includes(decodeURIComponent(part).toLowerCase()));
  } catch { return false; }
}

export function assertExportableMedia(spec: ChannelSpec): void {
  const references = [spec.brand.logo, spec.brand.heroArtwork,
    ...spec.content.flatMap(item => [item.artwork, item.mediaUrl, item.audiobook?.mediaUrl])];
  if (references.some(value => value && !value.startsWith('assets/') && !publicMediaUrl(value))) {
    throw new RepositoryError('INVALID_INPUT', 'Hosted media requires a stable public HTTPS URL or a bundled asset');
  }
}
