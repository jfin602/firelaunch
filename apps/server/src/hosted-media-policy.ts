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

function unchangedDraftAudio(value: string | undefined, previous: string | undefined): boolean {
  if (!value || value !== previous) return false;
  try { return /^\/api\/draft-audio\/[^/]+\/[^/]+\/[^/]+\/(audio|cover)$/.test(new URL(value).pathname); }
  catch { return false; }
}

/** Preserve unchanged legacy private audio/cover references in owned draft edits, never in export. */
export function assertEditableDraftMedia(spec: ChannelSpec, previous: ChannelSpec): void {
  const prior = new Map(previous.content.map(item => [item.id, item]));
  const sanitized = { ...spec, content: spec.content.map(item => {
    const old = prior.get(item.id);
    return { ...item,
      artwork: unchangedDraftAudio(item.artwork, old?.artwork) ? 'assets/legacy-cover.png' : item.artwork,
      mediaUrl: unchangedDraftAudio(item.mediaUrl, old?.mediaUrl) ? 'assets/legacy-audio.mp3' : item.mediaUrl,
      audiobook: item.audiobook ? { ...item.audiobook,
        mediaUrl: unchangedDraftAudio(item.audiobook.mediaUrl, old?.audiobook?.mediaUrl)
          ? 'assets/legacy-audio.mp3' : item.audiobook.mediaUrl } : undefined };
  }) };
  assertExportableMedia(sanitized);
}
