export const videoPages = ['video', 'details', 'channel', 'publish'] as const;
export type VideoPage = typeof videoPages[number];

export function videoPageKey(accountId: string, projectId: string, itemId?: string): string {
  return `vegalaunch-video-page:${accountId}:${projectId}:${itemId ?? 'new'}`;
}

export function savedVideoPage(key: string): VideoPage {
  try {
    const value = window.sessionStorage.getItem(key);
    return videoPages.find(page => page === value) ?? 'video';
  } catch { return 'video'; }
}

export function rememberVideoPage(key: string, page: VideoPage): void {
  try { window.sessionStorage.setItem(key, page); } catch { /* Storage can be unavailable in private browsing. */ }
}
