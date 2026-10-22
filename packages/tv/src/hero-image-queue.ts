/** A small, scope-local artwork queue. The loader owns the platform image cache. */
export type ArtworkLoad = (url: string) => Promise<boolean>;
type Entry = { url: string; priority: number; order: number; state: 'queued' | 'loading' | 'ready' | 'failed';
  promise: Promise<boolean>; resolve: (ready: boolean) => void; failedAt?: number };

export class HeroImageQueue {
  private entries = new Map<string, Entry>();
  private active = 0;
  private order = 0;
  private pinned = new Set<string>();
  constructor(private readonly loadImage: ArtworkLoad, private readonly limit = 2, private readonly budget = 24) {}

  schedule(groups: readonly (readonly string[])[]): void {
    this.pinned = new Set(groups.slice(0, 2).flat());
    groups.forEach((urls, priority) => urls.forEach(url => this.request(url, priority)));
    // A new focus changes queued work immediately; in-flight requests cannot be cancelled safely.
    for (const entry of this.entries.values()) if (entry.state === 'queued' && !this.pinned.has(entry.url)) {
      const priority = groups.findIndex(group => group.includes(entry.url));
      entry.priority = priority < 0 ? 4 : priority;
    }
    this.pump();
  }

  request(url: string, priority = 3): Promise<boolean> {
    if (!url) return Promise.resolve(false);
    const existing = this.entries.get(url);
    if (existing) {
      if (existing.state === 'failed' && Date.now() - (existing.failedAt ?? 0) > 60_000) this.entries.delete(url);
      else {
        existing.priority = Math.min(existing.priority, priority);
        this.entries.delete(url); this.entries.set(url, existing);
        this.pump();
        return existing.promise;
      }
    }
    let resolve!: (ready: boolean) => void;
    const promise = new Promise<boolean>(done => { resolve = done; });
    this.entries.set(url, { url, priority, order: this.order++, state: 'queued', promise, resolve });
    this.pump();
    return promise;
  }

  ready(url: string): boolean { return this.entries.get(url)?.state === 'ready'; }

  clear(): void {
    // In-flight promises may finish, but their completion no longer owns a cache entry.
    for (const entry of this.entries.values()) if (entry.state === 'queued') entry.resolve(false);
    this.entries.clear(); this.pinned.clear();
  }

  private pump(): void {
    while (this.active < this.limit) {
      const next = [...this.entries.values()].filter(entry => entry.state === 'queued')
        .sort((a, b) => a.priority - b.priority || a.order - b.order)[0];
      if (!next) break;
      next.state = 'loading'; this.active++;
      void Promise.resolve().then(() => this.loadImage(next.url)).catch(() => false).then(ready => {
        next.state = ready ? 'ready' : 'failed';
        if (!ready) next.failedAt = Date.now();
        next.resolve(ready);
        this.active--;
        if (this.entries.get(next.url) === next) this.evict();
        this.pump();
      });
    }
  }

  private evict(): void {
    while (this.entries.size > this.budget) {
      const victim = [...this.entries.values()].find(entry =>
        !this.pinned.has(entry.url) && entry.state !== 'loading' && entry.state !== 'queued');
      if (!victim) break;
      this.entries.delete(victim.url);
    }
  }
}

export function heroArtworkGroups(current: string, row: readonly string[], remaining: readonly string[] = []): string[][] {
  const index = row.indexOf(current);
  const high = index < 0 ? [] : [row[index + 1], row[index - 1]].filter((url): url is string => !!url);
  const seen = new Set<string>();
  return [[current], high, row, remaining].map(group => group.filter(url => {
    if (!url || seen.has(url)) return false;
    seen.add(url); return true;
  }));
}
