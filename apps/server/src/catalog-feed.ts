import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { TextDecoder } from 'node:util';
import ipaddr from 'ipaddr.js';
import { SaxesParser } from 'saxes';
import { RepositoryError } from './repository.js';

const MAX_BYTES = 512_000;
const MAX_ITEMS = 1000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
type FeedRow = { externalId: string; rawExternalId: string; kind: 'video' | 'audio' | 'book' | 'listing'; title: string; description?: string; artworkUrl?: string };
type Address = { address: string; family: 4 | 6 };
type Transport = {
  resolve: (host: string) => Promise<Address[]>;
  request: typeof httpsRequest;
};
const productionTransport: Transport = {
  resolve: host => dnsLookup(host, { all: true, verbatim: true }) as Promise<Address[]>,
  request: httpsRequest
};
function invalid(message: string): never { throw new RepositoryError('INVALID_INPUT', message); }

export function publicAddress(address: string): boolean {
  if (address.includes('%') || !isIP(address) || !ipaddr.isValid(address)) return false;
  const parsed = ipaddr.parse(address);
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress() || !v6.match(ipaddr.parse('2000::'), 3) || v6.range() !== 'unicast') return false;
    // Transition and documentation ranges may encapsulate non-public IPv4 destinations.
    return !['2001::/32', '2001:10::/28', '2001:db8::/32', '2002::/16'].some(cidr => v6.match(ipaddr.parseCIDR(cidr)));
  }
  const v4 = parsed as ipaddr.IPv4;
  if (v4.range() !== 'unicast') return false;
  return !['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16',
    '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24', '192.168.0.0/16',
    '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4']
    .some(cidr => v4.match(ipaddr.parseCIDR(cidr)));
}

function destination(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { return invalid('Invalid feed URL'); }
  const host = url.hostname.toLowerCase();
  if (raw.length > 2048 || url.protocol !== 'https:' || !host || isIP(host) || host.startsWith('[') ||
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
    url.username || url.password || url.hash || (url.port && url.port !== '443')) invalid('Feed needs a public HTTPS destination');
  return url;
}

async function readOnce(url: URL, transport: Transport, signal: AbortSignal): Promise<{ status: number; location?: string; body?: string; contentType?: string }> {
  const addresses = await transport.resolve(url.hostname);
  if (signal.aborted) invalid('Feed request timed out');
  if (!addresses.length || addresses.some(value => value.family !== isIP(value.address) || !publicAddress(value.address))) invalid('Feed resolves to an unsafe address');
  const pinned = addresses[0]!;
  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      method: 'GET', signal, headers: { accept: 'application/feed+json, application/json, application/rss+xml, application/atom+xml, application/xml', 'accept-encoding': 'identity' },
      lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family)
    }, response => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy(); resolve({ status, ...(response.headers.location ? { location: response.headers.location } : {}) }); return;
      }
      if (status !== 200) { response.destroy(); reject(new RepositoryError('INVALID_INPUT', `Feed returned HTTP ${status}`)); return; }
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        response.destroy(); reject(new RepositoryError('INVALID_INPUT', 'Compressed feeds are unsupported')); return;
      }
      const length = Number(response.headers['content-length']);
      if (Number.isFinite(length) && length > MAX_BYTES) { response.destroy(); reject(new RepositoryError('INVALID_INPUT', 'Feed exceeds byte limit')); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { response.destroy(); reject(new RepositoryError('INVALID_INPUT', 'Feed exceeds byte limit')); }
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try { resolve({ status, body: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)), contentType: String(response.headers['content-type'] ?? '') }); }
        catch { reject(new RepositoryError('INVALID_INPUT', 'Invalid feed UTF-8')); }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

function stableId(raw: string): string {
  const value = raw.normalize('NFC').trim();
  if (!value || value.length > 2048) invalid('Feed item needs a bounded stable ID');
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) ? value : `feed-${createHash('sha256').update(value).digest('hex')}`;
}
function kind(value: unknown): FeedRow['kind'] {
  return ['video', 'audio', 'book', 'listing'].includes(String(value)) ? value as FeedRow['kind'] : 'listing';
}
function text(value: unknown): string | undefined { return typeof value === 'string' ? value.trim() : undefined; }

export function parseFeed(content: string, contentType: string): string {
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES || content.includes('\u0000') || content.startsWith('\uFEFF')) invalid('Invalid or oversized feed');
  let rows: FeedRow[];
  const mime = contentType.split(';', 1)[0]!.trim().toLowerCase();
  if (mime === 'application/json' || mime === 'application/feed+json') {
    let document: unknown;
    try { document = JSON.parse(content); } catch { return invalid('Malformed JSON Feed'); }
    if (!document || typeof document !== 'object' || Array.isArray(document)) invalid('Invalid JSON Feed');
    const feed = document as Record<string, unknown>;
    if (typeof feed.version !== 'string' || !/^https:\/\/jsonfeed\.org\/version\/1(?:\.1)?$/.test(feed.version) || !Array.isArray(feed.items) || feed.items.length > MAX_ITEMS) invalid('Unsupported JSON Feed');
    rows = feed.items.map((value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Invalid JSON Feed item');
      const item = value as Record<string, unknown>;
      const title = text(item.title);
      if (!title) invalid('Feed item needs a title');
      if (typeof item.id !== 'string') invalid('Feed item needs a stable ID');
      const description = text(item.summary), artworkUrl = text(item.image);
      return { externalId: stableId(item.id), rawExternalId: item.id, kind: kind(item._vegalaunch_kind ?? item._firelaunch_kind), title,
        ...(description ? { description } : {}), ...(artworkUrl ? { artworkUrl } : {}) };
    });
  } else if (['application/rss+xml', 'application/atom+xml', 'application/xml', 'text/xml'].includes(mime)) {
    rows = parseXml(content);
  } else invalid('Unsupported feed content type');
  if (rows.length > MAX_ITEMS) invalid('Too many feed items');
  return JSON.stringify(rows);
}

function parseXml(content: string): FeedRow[] {
  const parser = new SaxesParser({ xmlns: false });
  const rows: FeedRow[] = []; const path: string[] = [];
  let current: Record<string, string> | undefined;
  let field = ''; let buffer = ''; let root = '';
  parser.on('doctype', () => invalid('XML doctype is unsupported'));
  parser.on('processinginstruction', () => invalid('XML processing instructions are unsupported'));
  parser.on('opentag', tag => {
    path.push(tag.name);
    if (path.length > 16) invalid('XML nesting limit exceeded');
    if (path.length === 1) { root = tag.name; if (root !== 'rss' && root !== 'feed') invalid('Expected RSS or Atom feed'); }
    if ((root === 'rss' && path.join('/') === 'rss/channel/item') || (root === 'feed' && path.join('/') === 'feed/entry')) {
      if (rows.length >= MAX_ITEMS) invalid('Too many feed items');
      current = {}; return;
    }
    if (current && path.length === (root === 'rss' ? 4 : 3)) {
      field = tag.name; buffer = '';
      if (root === 'feed' && field === 'link' && typeof tag.attributes.href === 'string' && !current.id) current.link = tag.attributes.href;
    }
  });
  parser.on('text', value => { if (field) buffer += value; });
  parser.on('cdata', value => { if (field) buffer += value; });
  parser.on('closetag', tag => {
    if (current && field === tag.name) { if (field !== 'link' || buffer.trim()) current[field] = buffer.trim(); field = ''; buffer = ''; }
    if (current && ((root === 'rss' && path.join('/') === 'rss/channel/item') || (root === 'feed' && path.join('/') === 'feed/entry'))) {
      const title = current.title;
      if (!title) invalid('Feed item needs a title');
      const rawExternalId = current.guid || current.id || current.link || '';
      rows.push({ externalId: stableId(rawExternalId), rawExternalId, kind: kind(current['vegalaunch:kind'] ?? current['firelaunch:kind']), title,
        ...(current.description || current.summary ? { description: current.description || current.summary } : {}) });
      current = undefined;
    }
    path.pop();
  });
  try { parser.write(content).close(); } catch (error) {
    if (error instanceof RepositoryError) throw error;
    invalid('Malformed or unsafe XML feed');
  }
  return rows;
}

export async function fetchFeedSnapshot(endpoint: string, transport: Transport = productionTransport): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let url = destination(endpoint);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await Promise.race([
        readOnce(url, transport, controller.signal),
        new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new RepositoryError('INVALID_INPUT', 'Feed request timed out')), { once: true }))
      ]);
      if (response.status === 200) return parseFeed(response.body!, response.contentType!);
      if (hop === MAX_REDIRECTS || !response.location) invalid('Too many or invalid feed redirects');
      url = destination(new URL(response.location, url).toString());
    }
    return invalid('Too many feed redirects');
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    return invalid('Feed fetch failed');
  } finally { clearTimeout(timer); controller.abort(); }
}
