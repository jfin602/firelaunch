import { isIP } from 'node:net';
import type { ChannelSpec } from '@vegalaunch/contracts';
import { channelSpecSchema } from '@vegalaunch/contracts';
import { RepositoryError } from './repository.js';
import type { CatalogBinding } from './catalog-projection.js';

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

export type DraftMediaWarning = Readonly<{ contentId?: string; field: 'logo' | 'heroArtwork' | 'artwork' | 'playback' | 'audiobook'; message: string }>;

/** Build a private, offline-safe snapshot. Public-release checks remain strict. */
export function prepareDraftMedia(spec: ChannelSpec, bindings: readonly CatalogBinding[]):
  { spec: ChannelSpec; warnings: DraftMediaWarning[] } {
  const warnings: DraftMediaWarning[] = [];
  const safeArtwork = (value: string | undefined, field: 'logo' | 'heroArtwork' | 'artwork', contentId?: string) => {
    if (!value) return undefined;
    if (publicMediaUrl(value) || /^assets\/draft-artwork\/[a-f0-9]{64}\.(?:png|jpg)$/.test(value)) return value;
    warnings.push({ ...(contentId ? { contentId } : {}), field,
      message: `${field === 'artwork' ? 'Content artwork' : field === 'logo' ? 'Channel logo' : 'Hero artwork'} is unavailable in this package.` });
    return undefined;
  };
  const byId = new Map(bindings.map(binding => [binding.contentId, binding]));
  const content = spec.content.map(item => {
    const binding = byId.get(item.id);
    if (!binding || binding.blockedReason === 'source_revoked' || binding.blockedReason === 'unsupported_kind')
      throw new RepositoryError('CONFLICT', 'Draft content is not an approved owned catalog item');
    const baseline = binding.baseline;
    if (baseline && baseline.presentation !== item.presentation)
      throw new RepositoryError('CONFLICT', 'Draft content presentation differs from owned catalog item');
    const artwork = safeArtwork(item.artwork, 'artwork', item.id) ?? 'assets/catalog-placeholder.png';
    const playable = item.presentation !== 'information';
    const mediaUrl = playable && baseline?.mediaUrl && publicMediaUrl(baseline.mediaUrl)
      ? baseline.mediaUrl : undefined;
    const audiobookUrl = item.audiobook && baseline?.audiobook?.mediaUrl && publicMediaUrl(baseline.audiobook.mediaUrl)
      ? baseline.audiobook.mediaUrl : undefined;
    if (playable && !mediaUrl) warnings.push({ contentId: item.id, field: 'playback',
      message: `${item.title}: playback is unavailable until public delivery is configured.` });
    if (item.audiobook && !audiobookUrl) warnings.push({ contentId: item.id, field: 'audiobook',
      message: `${item.title}: audiobook playback is unavailable until public delivery is configured.` });
    return { ...item, artwork, presentation: playable && !mediaUrl ? 'information' as const : item.presentation,
      mediaUrl, audiobook: audiobookUrl ? { mediaUrl: audiobookUrl } : undefined,
      durationSeconds: playable && !mediaUrl ? undefined : item.durationSeconds };
  });
  const prepared = channelSpecSchema.parse({ ...spec,
    brand: { ...spec.brand, logo: safeArtwork(spec.brand.logo, 'logo'),
      heroArtwork: safeArtwork(spec.brand.heroArtwork, 'heroArtwork') }, content });
  return { spec: prepared, warnings };
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
