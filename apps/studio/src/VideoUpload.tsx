import React, { useEffect, useRef, useState } from 'react';
import type { CatalogItem, MediaAsset } from '@firelaunch/contracts';
import { ApiError, readVideoAssetStatus, readVideoUpload, retryVideoProcessing, writeCatalog, type CatalogSnapshot, type VideoUploadStatus } from './api.js';
import { uploadVideo, validateVideoFile } from './video-upload.js';

const claim = (use: 'television_display' | 'television_playback') =>
  ({ status: 'cleared' as const, basis: 'creator_asserted' as const, permittedUse: use, assertedAt: new Date().toISOString() });

export function videoProcessingMessage(session: VideoUploadStatus): string {
  if (session.state === 'completed') return 'Upload complete; awaiting source verification and processing. This video is private.';
  if (session.state !== 'verified') return 'Upload has not been verified.';
  switch (session.processing?.state) {
    case 'pending': return 'Managed processing is queued or running. This video is private.';
    case 'leased': return 'Legacy processing is incomplete. Contact the operator before retrying.';
    case 'ready': return 'HLS is ready in private staging. Publication needs separate approval.';
    case 'failed': return session.processing.failureCode === 'verification_failed'
      ? 'Output verification failed. Retry processing, or upload a replacement master.'
      : 'Managed processing failed. Retry processing, or upload a replacement master.';
    case 'revoked': return 'Video rights or processing were revoked. Publication is blocked.';
    default: return 'Waiting for managed processing.';
  }
}

export function VideoLibraryStatus({ projectId, assetId }: { projectId: string; assetId: string | undefined }) {
  const [status, setStatus] = useState('Draft · no upload');
  useEffect(() => {
    if (!assetId) return;
    let alive = true;
    void readVideoAssetStatus(projectId, assetId).then(value => {
      if (!alive) return;
      if (!value) { setStatus('Draft · awaiting upload'); return; }
      const state = value.processing?.state;
      setStatus(value.uploadState !== 'verified' ? `Upload ${value.uploadState} · private` :
        state === 'ready' ? 'Processed · private, publication review required' :
        state === 'failed' ? 'Processing failed · private' :
        state === 'revoked' ? 'Revoked · private' : 'Awaiting processing · private');
    }).catch(() => { if (alive) setStatus('Status unavailable'); });
    return () => { alive = false; };
  }, [projectId, assetId]);
  return <span>{status}</span>;
}

/** The existing catalog Collection is the only category grouping for draft items. */
export function NewVideoUpload({ projectId, inventory, refresh, onCreated, onClose }: {
  projectId: string; inventory: CatalogSnapshot; refresh: () => Promise<CatalogSnapshot>;
  onCreated: (itemId: string) => void; onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [artworkUrl, setArtworkUrl] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [duration, setDuration] = useState('');
  const [display, setDisplay] = useState(false);
  const [playback, setPlayback] = useState(false);
  const [itemId, setItemId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [externalId] = useState(() => crypto.randomUUID().replaceAll('-', ''));
  const [session, setSession] = useState<VideoUploadStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const chooseFile = (next: File | null) => {
    if (!next) return;
    try { validateVideoFile(next); setFile(next); setError(''); }
    catch (reason) { setFile(null); setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const submit = async () => {
    if (busyRef.current) return;
    setError('');
    try {
      if (!title.trim()) throw new Error('Enter a video title.');
      if (!file) throw new Error('Choose an MP4 video.');
      validateVideoFile(file);
      const seconds = Number(duration);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 1800) throw new Error('Enter a duration from 1 second to 30 minutes.');
      if (!display || !playback) throw new Error('Confirm both television display and playback rights.');
      busyRef.current = true; setBusy(true); setProgress(0);
      let current = await refresh();
      let ownedItemId = itemId || current.items.find(value => value.kind === 'video' && value.sourceRecord.externalId.provider === 'creator' && value.sourceRecord.externalId.value === externalId)?.id || '';
      if (!ownedItemId) {
        let source = current.sources.find(value => value.type === 'creator_upload');
        if (!source) {
          const added = await writeCatalog(projectId, 'sources', current.revision, {
            schemaVersion: 1, type: 'creator_upload', state: 'discovered',
            permission: { retrieval: 'unknown', tvDisplay: 'unknown' }
          });
          current = await refresh();
          source = current.sources.find(value => value.id === added.record.id);
        }
        if (!source) throw new Error('Manual source was not saved. Refresh and retry.');
        const identifier = { provider: 'creator' as const, kind: 'upload_id' as const, value: externalId };
        const added = await writeCatalog(projectId, 'items', current.revision, {
          schemaVersion: 1, kind: 'video',
          sourceRecord: { sourceId: source.id, externalId: identifier, observedAt: new Date().toISOString(),
            metadata: { title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}),
              ...(artworkUrl.trim() ? { artworkUrl: artworkUrl.trim() } : {}) } },
          externalIdentifiers: [identifier], mediaAssetIds: []
        });
        ownedItemId = added.record.id; setItemId(ownedItemId); onCreated(ownedItemId);
        current = await refresh();
      }
      const chosenCollection = current.collections.find(value => value.id === collectionId);
      if (chosenCollection && !chosenCollection.itemIds.includes(ownedItemId)) {
        const { id, creatorAccountId: _owner, projectId: _project, ...record } = chosenCollection;
        await writeCatalog(projectId, 'collections', current.revision, { ...record, itemIds: [...record.itemIds, ownedItemId] }, id);
        current = await refresh();
      }
      let ownedAssetId = assetId || current.mediaAssets.find(value => value.catalogItemId === ownedItemId && value.kind === 'video' && value.location.type === 'managed_hls')?.id || '';
      if (!ownedAssetId) {
        const added = await writeCatalog(projectId, 'media-assets', current.revision, {
          schemaVersion: 1, catalogItemId: ownedItemId, kind: 'video', location: { type: 'managed_hls' },
          tvDisplayRights: claim('television_display'), tvPlaybackRights: claim('television_playback'), deliveryEligible: true
        });
        ownedAssetId = added.record.id; setAssetId(ownedAssetId);
        await refresh();
      }
      const nextController = new AbortController(); controller.current = nextController;
      const result = await uploadVideo(projectId, ownedAssetId, file, seconds, nextController.signal, setProgress, setSession);
      setSession(result); await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally { controller.current = null; busyRef.current = false; setBusy(false); }
  };
  return <section className="video-upload-panel" aria-label="Upload Video">
    <div className="video-upload-heading"><div><span className="eyebrow">PRIVATE VIDEO DRAFT</span><h3>Upload Video</h3></div><button type="button" disabled={busy} onClick={onClose}>Close</button></div>
    <p>Your MP4 stays private. Upload completion does not mean processing or publication is complete.</p>
    <div className={`video-dropzone${dragging ? ' dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()}
      onDragLeave={event => { event.preventDefault(); setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0] ?? null); }}>
      <strong>Drop an MP4 here</strong><span>or choose a file · up to 250 MB</span>
      <input aria-label="Choose video file" type="file" accept=".mp4,video/mp4" disabled={busy} onChange={event => chooseFile(event.target.files?.[0] ?? null)}/>
    </div>
    {file && <p className="video-file">{file.name} · {(file.size / 1_000_000).toFixed(1)} MB</p>}
    <label className="field"><span>TITLE *</span><input required maxLength={160} disabled={!!itemId} value={title} onChange={event => setTitle(event.target.value)}/></label>
    <label className="field"><span>DESCRIPTION</span><textarea maxLength={4000} disabled={!!itemId} value={description} onChange={event => setDescription(event.target.value)}/></label>
    <label className="field"><span>CATEGORY / COLLECTION</span><select value={collectionId} disabled={!!itemId} onChange={event => setCollectionId(event.target.value)}><option value="">No collection</option>{inventory.collections.map(value => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label>
    <label className="field"><span>OPTIONAL PUBLIC HTTPS ARTWORK URL</span><input type="url" disabled={!!itemId} value={artworkUrl} onChange={event => setArtworkUrl(event.target.value)} placeholder="https://example.com/cover.jpg"/></label>
    <label className="field"><span>APPROXIMATE DURATION · SECONDS *</span><input type="number" min="1" max="1800" value={duration} onChange={event => setDuration(event.target.value)}/></label>
    <label className="check"><input type="checkbox" checked={display} onChange={event => setDisplay(event.target.checked)}/> I own or license the television display rights</label>
    <label className="check"><input type="checkbox" checked={playback} onChange={event => setPlayback(event.target.checked)}/> I own or license the television playback rights</label>
    <div className="button-row"><button className="primary" disabled={busy || !file} onClick={() => void submit()}>{busy ? 'Uploading…' : session?.state === 'completed' || session?.state === 'verified' ? 'Upload replacement' : itemId ? 'Retry upload' : 'Upload Video'}</button><button type="button" disabled={busy} onClick={onClose}>Cancel</button>{busy && controller.current && <button type="button" onClick={() => controller.current?.abort()}>Stop upload</button>}</div>
    {busy && <progress aria-label="Video upload progress" value={progress} max="100" />}
    {session && <p role="status">{videoProcessingMessage(session)}</p>}
    {itemId && error && <p>Draft saved in your library. Retry here or select the item later.</p>}
    {error && <p role="alert" className="catalog-error">{error}</p>}
  </section>;
}

export function VideoUpload({ projectId, item, inventory, refresh }: { projectId: string; item: CatalogItem; inventory: CatalogSnapshot; refresh: () => Promise<CatalogSnapshot> }) {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState('');
  const [display, setDisplay] = useState(false);
  const [playback, setPlayback] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [session, setSession] = useState<VideoUploadStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const existing = inventory.mediaAssets.find(value => value.catalogItemId === item.id && value.kind === 'video' && value.location.type === 'managed_hls');
    if (existing && !assetId) setAssetId(existing.id);
  }, [item.id, inventory.revision, assetId]);
  useEffect(() => {
    if (!assetId || session || busy) return;
    let active = true;
    void readVideoAssetStatus(projectId, assetId).then(value => value && readVideoUpload(projectId, value.uploadId, assetId))
      .then(value => { if (active && value) setSession(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [projectId, assetId, busy]);
  useEffect(() => {
    if (!session || !['completed', 'verified'].includes(session.state) || session.processing?.state === 'ready' || session.processing?.state === 'failed' || session.processing?.state === 'revoked') return;
    let active = true;
    const timer = window.setInterval(() => void readVideoUpload(projectId, session.id, assetId).then(next => {
      if (active) setSession(next);
    }).catch(reason => { if (active) { setSession(null); setError(reason instanceof Error ? reason.message : String(reason)); } }), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [projectId, assetId, session?.id, session?.state, session?.processing?.state]);
  const asset = inventory.mediaAssets.find(value => value.id === assetId);
  const ready = session?.state === 'verified' && session.processing?.state === 'ready' &&
    asset?.tvDisplayRights?.status === 'cleared' && asset.tvPlaybackRights?.status === 'cleared';
  const start = async () => {
    if (!file) return;
    setError(''); setBusy(true); setProgress(0);
    const nextController = new AbortController();
    controller.current = nextController;
    try {
      validateVideoFile(file);
      const seconds = Number(duration);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 1800) throw new Error('Enter a duration from 1 second to 30 minutes.');
      if (!display || !playback) throw new Error('Review and assert both TV display and playback rights before uploading.');
      let ownedAssetId = assetId;
      if (!ownedAssetId) {
        const added = await writeCatalog(projectId, 'media-assets', inventory.revision, {
          schemaVersion: 1, catalogItemId: item.id, kind: 'video', location: { type: 'managed_hls' },
          tvDisplayRights: claim('television_display'), tvPlaybackRights: claim('television_playback'), deliveryEligible: true
        });
        ownedAssetId = (added.record as MediaAsset).id;
        setAssetId(ownedAssetId);
        await refresh();
      }
      const next = await uploadVideo(projectId, ownedAssetId, file, seconds, nextController.signal, setProgress, setSession);
      setSession(next);
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 404 ? 'Media asset or upload unavailable for this account.' : reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally { controller.current = null; setBusy(false); }
  };
  const retry = async () => {
    if (!session || !assetId) return;
    setError(''); setBusy(true);
    try { setSession(await retryVideoProcessing(projectId, session.id, assetId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  if (item.kind !== 'video') return null;
  return <section aria-label="Creator video upload">
    <h3>Video master upload</h3><p>Upload your owned MP4 directly to private storage. Processing and rights review must finish before a separate live approval and publish.</p>
    <label className="field"><span>VIDEO FILE · MP4 · MAX 250 MB</span><input type="file" accept=".mp4,video/mp4" onChange={event => { setFile(event.target.files?.[0] ?? null); setError(''); }}/></label>
    <label className="field"><span>APPROXIMATE DURATION · SECONDS · MAX 30 MINUTES</span><input type="number" min="1" max="1800" value={duration} onChange={event => setDuration(event.target.value)}/></label>
    <label className="check"><input type="checkbox" checked={display} onChange={event => setDisplay(event.target.checked)}/> I have television display rights for this video</label>
    <label className="check"><input type="checkbox" checked={playback} onChange={event => setPlayback(event.target.checked)}/> I have television playback rights for this video</label>
    <div className="button-row"><button disabled={busy || !file || !display || !playback} onClick={() => void start()}>{session ? 'Upload replacement master' : 'Upload video master'}</button>
      {session?.state === 'verified' && session.processing?.state === 'failed' && <button type="button" disabled={busy} onClick={() => void retry()}>Retry processing</button>}
      {busy && controller.current && <button type="button" onClick={() => controller.current?.abort()}>Cancel upload</button>}</div>
    {busy && controller.current && <p role="status">{progress < 100 ? `Uploading ${progress}%` : 'Upload complete; awaiting source verification and processing.'}</p>}
    {session && <p role="status">{videoProcessingMessage(session)} {ready ? 'Ready for separate publication review.' : 'Unavailable for live publication.'}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
