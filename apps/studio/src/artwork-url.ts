import type { CatalogItem } from '@vegalaunch/contracts';

// Catalog artwork is a creator/source URL, never a private object capability.
export function safeArtwork(item: CatalogItem): string | null {
  const value = item.creatorOverrides?.artworkUrl ?? item.sourceRecord.metadata.artworkUrl;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.origin === window.location.origin && url.pathname.startsWith('/api/')) ||
      /(^|\.)s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
