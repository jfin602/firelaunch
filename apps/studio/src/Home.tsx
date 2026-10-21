import React, { useEffect, useRef, useState } from 'react';
import type { ChannelProject } from '@firelaunch/contracts';
import { ApiError, readCatalog, type CatalogSnapshot } from './api.js';
import { VideoLibraryStatus } from './VideoUpload.js';
import { OwnedArtwork } from './OwnedArtwork.js';

export function Home({ project, projects, accountId, hosted, libraryRevision = 0, onSelectProject, onPreview, onSurface, onEditChannel, onOpenVideo }: {
  project: ChannelProject; projects: ChannelProject[]; accountId: string | null; hosted: boolean; libraryRevision?: number;
  onSelectProject: (id: string) => void; onPreview: () => void;
  onSurface: (surface: 'Library' | 'Channel') => void;
  onEditChannel: () => void;
  onOpenVideo?: (itemId?: string) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(hosted ? 'loading' : 'ready');
  const [retry, setRetry] = useState(0);
  const scopeRef = useRef('');
  useEffect(() => {
    const scope = `${accountId ?? 'local'}:${project.id}`;
    const changedScope = scopeRef.current !== scope;
    scopeRef.current = scope;
    if (changedScope) setCatalog(null);
    if (!hosted || !accountId) { setState('ready'); return; }
    let alive = true;
    if (changedScope) setState('loading');
    void readCatalog(project.id).then(snapshot => {
      if (!alive) return;
      if (snapshot.projectId !== project.id || snapshot.creatorAccountId !== accountId ||
        [...snapshot.items, ...snapshot.mediaAssets].some(value => value.projectId !== project.id || value.creatorAccountId !== accountId)) {
        setState('error'); return;
      }
      setCatalog(snapshot); setState('ready');
    }).catch(reason => {
      if (!alive) return;
      if (reason instanceof ApiError && reason.status === 401) return;
      setState('error');
    });
    return () => { alive = false; };
  }, [project.id, accountId, hosted, retry, libraryRevision]);

  const items = catalog?.items ?? [];
  return <div className="home" aria-label="Channel Home">
    <div className="home-hero"><span className="eyebrow">YOUR CHANNEL WORKSPACE</span><h2>{project.spec.title}</h2>
      <p>{hosted ? 'Private draft. Review catalog content and rights before putting anything on TV.' : 'Local channel draft. Open an editor or TV Preview to keep building.'}</p>
      <div className="button-row" aria-label="Quick actions"><h3>Quick actions</h3><button className="primary" onClick={() => hosted && onOpenVideo ? onOpenVideo() : onSurface('Library')}>{hosted ? 'Add Video' : 'Open Library / Add Video'}</button><button onClick={onEditChannel}>Edit channel</button><button onClick={onPreview}>TV Preview</button></div>
    </div>
    <section className="home-section" aria-label="Your channels"><div className="home-section-head"><h3>Your channels</h3><span>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span></div>
      <div className="home-projects">{projects.map(item => <button key={item.id} className="home-project" aria-current={item.id === project.id ? 'true' : undefined} onClick={() => onSelectProject(item.id)}><strong>{item.spec.title}</strong><small>{item.id === project.id ? 'Current channel · ' : ''}{hosted ? 'Private draft' : 'Local draft'} · revision {item.revision}</small></button>)}</div>
    </section>
    <section className="home-section" aria-label="Current channel library"><div className="home-section-head"><h3>Library in {project.spec.title}</h3><button onClick={() => onSurface('Library')}>Go to Library →</button></div>
      {!hosted ? <p>Library requires a hosted account. Your local channel content is available in Pages &amp; Shelves and TV Preview.</p>
        : state === 'loading' ? <p role="status">Loading this channel’s library…</p>
        : state === 'error' ? <div role="alert"><p>Could not load this channel’s library.</p><button onClick={() => setRetry(value => value + 1)}>Retry library</button></div>
        : items.length === 0 ? <p>No catalog items yet. Open Library to add a video or import creator-controlled content.</p>
        : <div className="home-media-grid">{items.map(item => {
          const asset = catalog?.mediaAssets.find(value => value.catalogItemId === item.id && value.kind === 'video' && value.location.type === 'managed_hls');
          const title = item.creatorOverrides?.title ?? item.sourceRecord.metadata.title;
          const rights = asset?.tvPlaybackRights?.status === 'revoked' ? 'Playback rights revoked' : asset?.tvPlaybackRights?.status === 'cleared' ? 'Playback rights asserted' : 'Playback rights unknown';
          return <button key={item.id} className="home-media-card" onClick={() => item.kind === 'video' && onOpenVideo ? onOpenVideo(item.id) : onSurface('Library')} aria-label={item.kind === 'video' ? `Open ${title} video` : `Open ${title} in Library`}>
            <OwnedArtwork item={item} assets={catalog?.mediaAssets ?? []} projectId={project.id} accountId={accountId} className={`home-art home-art-${item.kind}`} fallback={<span className="home-art-fallback" aria-label="Artwork unavailable">{item.kind === 'video' ? '▣' : item.kind === 'audio' ? '♫' : '◇'}</span>}/><span className="home-media-copy"><strong>{title}</strong><small>{item.kind === 'book' || item.kind === 'listing' ? 'Informational · no playback' : item.kind === 'video' ? 'Video · private draft' : 'Audio · private draft'}</small>
              <small>{item.kind === 'video' || item.kind === 'audio' ? rights : 'Review display rights in Library'}</small>
              {item.kind === 'video' && <><small>{asset ? <VideoLibraryStatus key={`${project.id}:${item.id}:${asset.id}`} projectId={project.id} assetId={asset.id}/> : 'No upload yet · open to add an MP4'}</small><small className="video-card-action">Open video →</small></>}</span>
          </button>;
        })}</div>}
    </section>
  </div>;
}
