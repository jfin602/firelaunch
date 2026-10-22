import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChannelProject } from '@firelaunch/contracts';
import { readCatalog, type CatalogSnapshot } from './api.js';
import { NewVideoUpload, VideoLibraryStatus } from './VideoUpload.js';
import { VideoReview } from './VideoReview.js';
import { VideoSubtitles } from './VideoSubtitles.js';
import { rememberVideoPage, savedVideoPage, videoPageKey, videoPages, type VideoPage } from './video-pages.js';

type VideoSelection = { projectId: string; accountId: string; itemId?: string };

export function VideoWorkspace({ selection, project, onIdentity, onClose, onProjectUpdate }: {
  selection: VideoSelection; project: ChannelProject; onIdentity: (itemId: string) => void; onClose: () => void;
  onProjectUpdate: (project: ChannelProject) => void;
}) {
  const [inventory, setInventory] = useState<CatalogSnapshot | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState<VideoPage>(() => savedVideoPage(videoPageKey(selection.accountId, selection.projectId, selection.itemId)));
  const uploadingRef = useRef(false);
  const createdId = useRef<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const selectionRef = useRef(selection);
  const mounted = useRef(false);
  selectionRef.current = selection;
  const pageKey = videoPageKey(selection.accountId, selection.projectId, selection.itemId);
  const selectPage = (next: VideoPage) => { setPage(next); rememberVideoPage(pageKey, next); };

  const owned = (data: CatalogSnapshot) => data.projectId === selectionRef.current.projectId &&
    data.creatorAccountId === selectionRef.current.accountId &&
    data.sources.every(source => source.projectId === data.projectId && source.creatorAccountId === data.creatorAccountId) &&
    data.items.every(item => item.projectId === data.projectId && item.creatorAccountId === data.creatorAccountId) &&
    data.collections.every(collection => collection.projectId === data.projectId && collection.creatorAccountId === data.creatorAccountId) &&
    data.mediaAssets.every(asset => asset.projectId === data.projectId && asset.creatorAccountId === data.creatorAccountId);
  const refresh = async () => {
    const data = await readCatalog(selection.projectId);
    if (!mounted.current || selectionRef.current.projectId !== selection.projectId || selectionRef.current.accountId !== selection.accountId)
      throw new Error('Video workspace changed. Reopen the video to continue.');
    if (!owned(data)) throw new Error('This video library is unavailable for the current account.');
    setInventory(data);
    return data;
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let live = true;
    void readCatalog(selection.projectId).then(data => {
      if (!live) return;
      if (!owned(data)) { setError('This video library is unavailable for the current account.'); return; }
      setInventory(data); setError('');
    }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { live = false; };
  }, [selection.projectId, selection.accountId, selection.itemId]);
  useEffect(() => {
    if (selection.itemId && createdId.current === selection.itemId) { rememberVideoPage(pageKey, page); return; }
    setPage(savedVideoPage(pageKey));
  }, [pageKey]);
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const priorOverflow = document.body.style.overflow;
    if (shell) shell.inert = true;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      if (shell) shell.inert = false;
      document.body.style.overflow = priorOverflow;
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, []);
  const requestClose = () => { if (!uploadingRef.current) onClose(); };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])') ?? [])
      .filter(element => element.getClientRects().length > 0 || element === closeButton.current);
    if (!focusable.length) { event.preventDefault(); closeButton.current?.focus(); return; }
    const first = focusable[0]!; const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  };
  const item = inventory?.items.find(value => value.id === selection.itemId && value.kind === 'video');
  const asset = inventory?.mediaAssets.find(value => value.catalogItemId === item?.id && value.kind === 'video' && value.location.type === 'managed_hls');
  const title = item?.creatorOverrides?.title ?? item?.sourceRecord.metadata.title;
  return createPortal(<div className="video-workspace-backdrop"><div ref={dialog} className="video-workspace" role="dialog" aria-modal="true" aria-labelledby="video-workspace-title" onKeyDown={onKeyDown}>
    <header className="video-workspace-header"><div><span className="eyebrow">PRIVATE VIDEO WORKSPACE</span><h2 id="video-workspace-title">{title ?? (selection.itemId ? 'Video draft' : 'Add Video')}</h2><p>{selection.itemId ? 'Saved in this channel library. Review or replace the private upload here.' : 'Start a private video draft for this channel.'}</p></div><button ref={closeButton} type="button" disabled={uploading} onClick={requestClose} aria-label="Close video workspace">Close ×</button></header>
    <nav className="video-workspace-pages" aria-label="Video workspace pages">
      <span className="video-workspace-progress">Page {videoPages.indexOf(page) + 1} of {videoPages.length}</span>
      <div className="video-workspace-page-buttons">{videoPages.map(entry => <button key={entry} type="button" aria-current={page === entry ? 'step' : undefined}
        className={page === entry ? 'active' : ''} onClick={() => selectPage(entry)}><span className="video-workspace-page-mark" aria-hidden="true">●</span>{entry[0]!.toUpperCase() + entry.slice(1)}</button>)}</div>
    </nav>
    <div className="video-workspace-body" aria-live="polite">
      {error && <p role="alert" className="catalog-error">{error}</p>}
      {!inventory && !error && <p role="status">Loading video library…</p>}
      {inventory && selection.itemId && !item && createdId.current !== selection.itemId && <p role="alert">This video draft is unavailable in the current channel.</p>}
      {page === 'video' && item && <div className="video-workspace-summary"><div><strong>{title}</strong><p>{asset ? <VideoLibraryStatus projectId={selection.projectId} assetId={asset.id}/> : 'Add an MP4 to continue'}</p></div></div>}
      {inventory && (!selection.itemId || item || createdId.current === selection.itemId) && <NewVideoUpload accountId={selection.accountId} projectId={selection.projectId} inventory={inventory} refresh={refresh} page={page} {...(item ? { existingItem: item } : {})} onCreated={id => { createdId.current = id; rememberVideoPage(videoPageKey(selection.accountId, selection.projectId, id), page); onIdentity(id); }} onClose={requestClose} onBusyChange={value => { uploadingRef.current = value; setUploading(value); }}/ >}
      {page === 'details' && item && asset && <VideoSubtitles key={`${selection.accountId}:${selection.projectId}:${item.id}:${asset.id}`} projectId={selection.projectId} itemId={item.id} videoAssetId={asset.id}/>}
      {page === 'publish' && !item && inventory && <p>Upload a video on the Video page before adding it to this channel.</p>}
      {inventory && item && (page === 'channel' || page === 'publish') && <VideoReview page={page} project={project} item={item} inventory={inventory} refresh={refresh} onProjectUpdate={onProjectUpdate} onNavigate={selectPage}/>}
      {uploading && <p role="status" className="video-workspace-lock">Keep this workspace open while the private draft is being prepared. You can close it once transfer begins.</p>}
    </div>
  </div></div>, document.body);
}
