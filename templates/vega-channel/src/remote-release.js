import { z } from 'zod';
import { sha256 } from './sha256.js';
import { initialState, projectTelevision } from './tv-runtime.js';

const id = prefix => z.string().regex(new RegExp(`^${prefix}_[a-f0-9]{32}$`));
const positive = z.number().int().positive();
const title = z.string().trim().min(1).max(120);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const publicUrl = z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol === 'https:' && !!host && !url.username && !url.password && !url.search && !url.hash &&
      !host.startsWith('[') && !/^\d+\.\d+\.\d+\.\d+$/.test(host) && host !== 'localhost' &&
      !host.endsWith('.localhost') && !host.endsWith('.local') && !host.endsWith('.internal') &&
      !host.endsWith('.amazonaws.com') && !host.endsWith('.amazonaws.com.cn') &&
      (!url.port || url.port === '443') &&
      !url.pathname.split('/').some(part =>
        ['staged', 'original', 'private-objects'].includes(decodeURIComponent(part).toLowerCase()));
  } catch { return false; }
});
const unique = values => new Set(values).size === values.length;
const artwork = publicUrl;
const content = z.strictObject({
  id: id('item'), title, description: z.string().max(2000), artwork,
  presentation: z.enum(['video', 'audio', 'information']).optional(), mediaUrl: publicUrl.optional(),
  audiobook: z.strictObject({ mediaUrl: publicUrl }).optional(),
  durationSeconds: positive.max(86400).optional(), category: z.string().trim().min(1).max(80).optional(),
  series: z.string().trim().min(1).max(80).optional(),
  author: title.optional(), narrator: title.optional(), publicationDate: z.iso.date().optional()
}).refine(item => item.presentation === 'information'
  ? !item.mediaUrl && !item.durationSeconds : !!item.mediaUrl && !item.audiobook);
const moduleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ id: id('mod'), kind: z.literal('hero'), title: title.optional(), contentIds: z.array(id('item')).max(1),
    crop: z.enum(['cover', 'contain']).optional(), alignment: z.enum(['left', 'center']).optional(),
    spacing: z.enum(['comfortable', 'compact']).optional() }),
  ...['rail', 'grid'].map(kind => z.strictObject({ id: id('mod'), kind: z.literal(kind), title,
    contentIds: z.array(id('item')).max(100).refine(unique), spacing: z.enum(['comfortable', 'compact']).optional() })),
  z.strictObject({ id: id('mod'), kind: z.literal('text'), title, body: z.string().max(2000),
    alignment: z.enum(['left', 'center']).optional(), background: z.enum(['theme', 'surface']).optional(),
    spacing: z.enum(['comfortable', 'compact']).optional() }),
  ...['image-banner', 'image-text'].map(kind => z.strictObject({ id: id('mod'), kind: z.literal(kind), title,
    body: z.string().max(2000), imageContentId: id('item').optional(),
    ...(kind === 'image-text' ? { imageSide: z.enum(['left', 'right']).optional() } : {}),
    crop: z.enum(['cover', 'contain']).optional(), alignment: z.enum(['left', 'center']).optional(),
    spacing: z.enum(['comfortable', 'compact']).optional(), background: z.enum(['theme', 'surface']).optional() }))
]);
const channel = z.strictObject({
  schemaVersion: z.literal(1), id: id('ch'), title,
  slug: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  brand: z.strictObject({ primaryColor: color, backgroundColor: color, textColor: color,
    logo: artwork.optional(), heroArtwork: artwork.optional(), typography: z.enum(['sans', 'serif']), showTitle: z.boolean() }),
  navigation: z.array(id('page')).min(1).max(30).refine(unique),
  pages: z.array(z.strictObject({ id: id('page'), title, modules: z.array(moduleSchema).max(30) })).min(1).max(30),
  content: z.array(content).max(500), playback: z.strictObject({ autoplayNext: z.boolean(), startMuted: z.boolean() })
}).superRefine((value, context) => {
  const pages = value.pages.map(page => page.id);
  const items = value.content.map(item => item.id);
  const modules = value.pages.flatMap(page => page.modules.map(module => module.id));
  if (!unique(pages) || !unique(items) || !unique(modules) || value.navigation.some(page => !pages.includes(page)) ||
    value.pages.some(page => page.modules.some(module =>
      (module.kind === 'hero' || module.kind === 'rail' || module.kind === 'grid')
        ? module.contentIds.some(item => !items.includes(item))
        : (module.kind === 'image-banner' || module.kind === 'image-text') &&
          !!module.imageContentId && !items.includes(module.imageContentId))))
    context.addIssue({ code: 'custom', message: 'Invalid channel references' });
});
const binding = z.strictObject({ contentId: id('item'), catalogItemId: id('ci'),
  playbackAssetId: id('ma').optional(), audiobookAssetId: id('ma').optional(), artworkAssetId: id('ma') });
const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1), releaseId: id('rel'), releaseSequence: positive,
  previousReleaseId: id('rel').optional(), publishedAt: z.iso.datetime(),
  deployment: z.strictObject({ id: id('dep'), projectId: id('ch'), channelId: id('ch'),
    packageId: z.string().min(5).max(255).regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/) }),
  approvedContentRevision: z.strictObject({ channel: positive, catalog: positive }), approvalId: id('ap'),
  clientCompatibility: z.strictObject({ minSchemaVersion: z.union([z.literal(1), z.literal(2)]),
    maxSchemaVersion: z.union([z.literal(1), z.literal(2)]), channelSchemaVersion: z.literal(1) }),
  channel, media: z.array(z.strictObject({ id: id('ma'), kind: z.enum(['video', 'audio', 'artwork']), url: publicUrl })).max(1502),
  bindings: z.strictObject({ content: z.array(binding).max(500), logoAssetId: id('ma').optional(), heroArtworkAssetId: id('ma').optional() })
});
const pointerSchema = z.strictObject({ deploymentId: id('dep'), releaseId: id('rel'),
  releaseSequence: positive, sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const canonical = value => JSON.stringify(value, (_, entry) => entry && !Array.isArray(entry) && typeof entry === 'object'
  ? Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) : entry);
const fail = () => { throw new Error('Invalid public release'); };

export function verifyRelease(pointerInput, bytes, config) {
  const pointer = pointerSchema.parse(pointerInput);
  if (pointer.deploymentId !== config.deploymentId || typeof bytes !== 'string' ||
    bytes.length > 1_048_576 || utf8Length(bytes) > 1_048_576 || sha256(bytes) !== pointer.sha256) fail();
  const decoded = JSON.parse(bytes);
  const manifest = manifestSchema.parse(decoded);
  if (canonical(manifest) !== bytes || manifest.releaseId !== pointer.releaseId ||
    manifest.releaseSequence !== pointer.releaseSequence || manifest.deployment.id !== config.deploymentId ||
    manifest.deployment.projectId !== config.channelId || manifest.deployment.channelId !== config.channelId ||
    manifest.channel.id !== config.channelId || manifest.deployment.packageId !== config.packageId ||
    manifest.clientCompatibility.minSchemaVersion > 2 ||
    manifest.clientCompatibility.minSchemaVersion > manifest.clientCompatibility.maxSchemaVersion ||
    (manifest.channel.content.some(item => item.presentation === 'audio' || item.audiobook) &&
      manifest.clientCompatibility.minSchemaVersion < 2) ||
    (manifest.releaseSequence === 1 ? !!manifest.previousReleaseId : !manifest.previousReleaseId) ||
    manifest.releaseId === manifest.previousReleaseId) fail();
  const media = new Map(manifest.media.map(asset => [asset.id, asset]));
  const bindings = new Map(manifest.bindings.content.map(entry => [entry.contentId, entry]));
  if (media.size !== manifest.media.length || bindings.size !== manifest.bindings.content.length ||
    bindings.size !== manifest.channel.content.length ||
    !unique(manifest.bindings.content.map(entry => entry.catalogItemId))) fail();
  const used = new Set();
  const requireMedia = (assetId, kind, url) => {
    const asset = media.get(assetId);
    if (!asset || asset.kind !== kind || asset.url !== url) fail();
    used.add(assetId);
  };
  for (const item of manifest.channel.content) {
    const entry = bindings.get(item.id);
    if (!entry) fail();
    if (item.presentation === 'information') {
      if (entry.playbackAssetId) fail();
      if (item.audiobook) requireMedia(entry.audiobookAssetId, 'audio', item.audiobook.mediaUrl);
      else if (entry.audiobookAssetId) fail();
    } else {
      if (entry.audiobookAssetId) fail();
      requireMedia(entry.playbackAssetId, item.presentation || 'video', item.mediaUrl);
    }
    requireMedia(entry.artworkAssetId, 'artwork', item.artwork);
  }
  for (const [url, assetId] of [[manifest.channel.brand.logo, manifest.bindings.logoAssetId],
    [manifest.channel.brand.heroArtwork, manifest.bindings.heroArtworkAssetId]]) {
    if (!!url !== !!assetId) fail();
    if (url) requireMedia(assetId, 'artwork', url);
  }
  if (used.size !== media.size) fail();
  return { pointer, channel: projectTelevision(manifest.channel) };
}

const utf8Length = text => {
  let length = 0;
  for (const character of text) {
    const point = character.codePointAt(0);
    length += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return length;
};

export function xhrGet(url, limit) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url);
    request.timeout = 5000;
    request.onload = () => {
      if (request.status !== 200 || request.responseURL !== url || utf8Length(request.responseText) > limit ||
        Number(request.getResponseHeader('content-length')) > limit) reject(new Error('Invalid HTTP release response'));
      else resolve(request.responseText);
    };
    request.onprogress = () => { if (request.responseText.length > limit || utf8Length(request.responseText) > limit) request.abort(); };
    request.onerror = request.ontimeout = request.onabort = () => reject(new Error('Release fetch failed'));
    request.send();
  });
}

export function createChannelLoader(config, bundled, { get = xhrGet, storage, onChannel }) {
  if (!config || !publicUrl.safeParse(config.origin).success || new URL(config.origin).origin !== config.origin ||
    !/^dep_[a-f0-9]{32}$/.test(config.deploymentId) || bundled.id !== config.channelId ||
    !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(config.packageId))
    throw new Error('Invalid native release configuration');
  const key = `@vegalaunch:lkg:v1:${config.deploymentId}:${config.packageId}`;
  const base = `${config.origin}/public/v1/deployments/${config.deploymentId}`;
  let current = 0;
  let busy = false;
  const accept = (record, persist) => {
    const verified = verifyRelease(record.pointer, record.bytes, config);
    if (verified.pointer.releaseSequence <= current) return false;
    current = verified.pointer.releaseSequence;
    onChannel(verified.channel, initialState(verified.channel));
    if (persist) return storage.setItem(key, JSON.stringify(record)).catch(() => {});
    return true;
  };
  return {
    async start() {
      try {
        const cached = await storage.getItem(key);
        if (cached && cached.length <= 1_100_000) accept(JSON.parse(cached), false);
      } catch { }
      return this.refresh();
    },
    async refresh() {
      if (busy) return false;
      busy = true;
      try {
        const pointerBytes = await get(`${base}/current`, 512);
        if (utf8Length(pointerBytes) > 512) return false;
        const pointer = pointerSchema.parse(JSON.parse(pointerBytes));
        if (pointer.deploymentId !== config.deploymentId || pointer.releaseSequence <= current) return false;
        const bytes = await get(`${base}/releases/${pointer.releaseId}`, 1_048_576);
        await accept({ pointer, bytes }, true);
        return true;
      } catch { return false; }
      finally { busy = false; }
    }
  };
}
