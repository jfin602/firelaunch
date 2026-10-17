import React, { useEffect, useRef, useState } from 'react';
import type { CatalogItem, Collection } from '@firelaunch/contracts';
import { ApiError, deletePrivateObject, readVideoAssetStatus, readVideoUpload, retryVideoProcessing, uploadPrivateMedia, writeCatalog, type CatalogSnapshot, type VideoUploadStatus } from './api.js';
import { extractVideoThumbnail, hashVideoFile, readVideoDuration, titleFromFilename, uploadVideo, validateVideoFile } from './video-upload.js';

const claim = (use: 'television_display' | 'television_playback', assertedAt: string) =>
  ({ status: 'cleared' as const, basis: 'creator_asserted' as const, permittedUse: use, assertedAt });
const unknown = () =>
  ({ status: 'unknown' as const, basis: 'none' as const, permittedUse: 'none' as const });

async function saveThumbnail(projectId: string, itemId: string, thumbnail: File,
  refresh: () => Promise<CatalogSnapshot>): Promise<void> {
  if (!['image/jpeg', 'image/png'].includes(thumbnail.type) || thumbnail.size < 1 || thumbnail.size > 1_000_000)
    throw new Error('Choose a PNG or JPEG thumbnail under 1 MB.');
  const current = await refresh();
  const priorArtwork = current.mediaAssets.find(value => value.catalogItemId === itemId && value.kind === 'artwork' && value.location.type === 'private_object');
  const uploaded = await uploadPrivateMedia(projectId, thumbnail);
  let attached = false;
  try {
    const { id: artworkId, creatorAccountId: _owner, projectId: _project, ...priorRecord } = priorArtwork ?? {};
    await writeCatalog(projectId, 'media-assets', current.revision, {
      ...priorRecord, schemaVersion: 1, catalogItemId: itemId, kind: 'artwork', location: { type: 'private_object', objectId: uploaded.id },
      tvDisplayRights: claim('television_display', new Date().toISOString()), tvPlaybackRights: unknown(), deliveryEligible: false
    }, artworkId);
    attached = true;
    await refresh();
    if (priorArtwork?.location.type === 'private_object') await deletePrivateObject(projectId, priorArtwork.location.objectId).catch(() => undefined);
  } catch (reason) {
    if (!attached) await deletePrivateObject(projectId, uploaded.id).catch(() => undefined);
    throw new Error(`Thumbnail could not be attached: ${reason instanceof Error ? reason.message : String(reason)}`);
  }
}

// Catalog collections are project-owned draft curation. They record the intended shelf
// while a private upload waits for processing, without putting unplayable media in ChannelSpec.
async function saveVideoPlacement(projectId: string, itemId: string, requestedCollectionId: string,
  refresh: () => Promise<CatalogSnapshot>): Promise<CatalogSnapshot> {
  let current = await refresh();
  if (!requestedCollectionId && current.collections.some(value => value.itemIds.includes(itemId))) return current;
  let collection: Collection | undefined = requestedCollectionId
    ? current.collections.find(value => value.id === requestedCollectionId)
    : current.collections.find(value => value.kind === 'series' && value.title === 'Videos');
  if (requestedCollectionId && !collection) throw new Error('Selected category is unavailable. Refresh the library.');
  if (!collection) {
    try {
      const added = await writeCatalog(projectId, 'collections', current.revision,
        { schemaVersion: 1, kind: 'series', title: 'Videos', itemIds: [itemId] });
      collection = added.record as Collection;
    } catch (reason) {
      if (!(reason instanceof ApiError && reason.status === 409)) throw reason;
    }
    current = await refresh();
    collection ??= current.collections.find(value => value.kind === 'series' && value.title === 'Videos');
    if (!collection) throw new Error('Video category could not be saved. Refresh and retry.');
  }
  if (!collection.itemIds.includes(itemId)) {
    try {
      const { id, creatorAccountId: _owner, projectId: _project, ...record } = collection;
      await writeCatalog(projectId, 'collections', current.revision, { ...record, itemIds: [...record.itemIds, itemId] }, id);
    } catch (reason) {
      if (!(reason instanceof ApiError && reason.status === 409)) throw reason;
      current = await refresh();
      if (!current.collections.find(value => value.id === collection!.id)?.itemIds.includes(itemId)) throw reason;
    }
  }
  current = await refresh();
  if (requestedCollectionId) {
    const defaultShelf = current.collections.find(value => value.kind === 'series' && value.title === 'Videos' && value.id !== requestedCollectionId);
    if (defaultShelf?.itemIds.includes(itemId)) {
      const { id, creatorAccountId: _owner, projectId: _project, ...record } = defaultShelf;
      await writeCatalog(projectId, 'collections', current.revision,
        { ...record, itemIds: record.itemIds.filter(value => value !== itemId) }, id);
      current = await refresh();
    }
  }
  return current;
}

export function videoProcessingMessage(session: VideoUploadStatus): string {
  if (session.state === 'initiated') return 'Uploading · private draft.';
  if (session.state === 'completed') return session.processingAvailable === false
    ? 'Uploaded · processing is unavailable here. This private video cannot be played or published.'
    : 'Uploaded · private source verification is pending. TV playback is unavailable.';
  if (session.state !== 'verified') return 'Draft · upload is incomplete. Choose the video and retry.';
  switch (session.processing?.state) {
    case 'pending': return 'Processing · private. Publication is unavailable until output is verified.';
    case 'leased': return 'Needs attention · legacy processing is incomplete. Contact the operator.';
    case 'ready': return 'Processed · private. Check artwork, rights and channel readiness before separate creator approval.';
    case 'failed': return 'Needs attention · processing failed. Retry processing or upload a replacement.';
    case 'revoked': return 'Needs attention · rights or processing were revoked. Publication is blocked.';
    default: return session.processingAvailable === false
      ? 'Uploaded · processing is unavailable here. This video cannot be played or published yet.'
      : 'Uploaded · waiting for processing. This video is private.';
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
      setStatus(value.uploadState !== 'verified' ? value.processingAvailable === false && value.uploadState === 'completed'
        ? 'Uploaded · processing unavailable' : `Upload ${value.uploadState} · private` :
        state === 'ready' ? 'Ready for publication review · private' :
        state === 'failed' ? 'Needs attention · processing failed' :
        state === 'revoked' ? 'Needs attention · revoked' :
        value.processingAvailable === false ? 'Uploaded · processing unavailable' : 'Processing · private');
    }).catch(() => { if (alive) setStatus('Status unavailable'); });
    return () => { alive = false; };
  }, [projectId, assetId]);
  return <span>{status}</span>;
}

export function NewVideoUpload({ projectId, inventory, refresh, onCreated, onClose, existingItem }: {
  projectId: string; inventory: CatalogSnapshot; refresh: () => Promise<CatalogSnapshot>;
  onCreated: (itemId: string) => void; onClose: () => void; existingItem?: CatalogItem;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(existingItem?.creatorOverrides?.title ?? existingItem?.sourceRecord.metadata.title ?? '');
  const [titleEdited, setTitleEdited] = useState(false);
  const [description, setDescription] = useState(existingItem?.creatorOverrides?.description ?? existingItem?.sourceRecord.metadata.description ?? '');
  const [collectionId, setCollectionId] = useState(() => inventory.collections.find(value => existingItem && value.itemIds.includes(existingItem.id) && !(value.kind === 'series' && value.title === 'Videos'))?.id ?? '');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailNotice, setThumbnailNotice] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [itemId, setItemId] = useState(existingItem?.id ?? '');
  const [assetId, setAssetId] = useState('');
  const [session, setSession] = useState<VideoUploadStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!itemId || session || busy) return;
    const asset = inventory.mediaAssets.find(value => value.catalogItemId === itemId && value.kind === 'video' && value.location.type === 'managed_hls');
    if (!asset) return;
    setAssetId(asset.id);
    let active = true;
    void readVideoAssetStatus(projectId, asset.id).then(value => value && readVideoUpload(projectId, value.uploadId, asset.id))
      .then(value => { if (active && value) setSession(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [projectId, itemId, inventory.revision, busy, session]);
  useEffect(() => {
    if (!session || !['completed', 'verified'].includes(session.state) || ['ready', 'failed', 'revoked'].includes(session.processing?.state ?? '') || session.processingAvailable === false) return;
    let active = true;
    const timer = window.setInterval(() => void readVideoUpload(projectId, session.id, assetId).then(next => {
      if (active) setSession(next);
    }).catch(() => undefined), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [projectId, assetId, session?.id, session?.state, session?.processing?.state, session?.processingAvailable]);
  const chooseFile = (next: File | null) => {
    if (!next) return;
    try { validateVideoFile(next); setFile(next); if (!titleEdited && !itemId) setTitle(titleFromFilename(next.name)); setError(''); }
    catch (reason) { setFile(null); setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const submit = async () => {
    if (busyRef.current) return;
    setError('');
    try {
      if (!file) throw new Error('Choose an MP4 video.');
      validateVideoFile(file);
      if (!title.trim()) throw new Error('Enter a video title.');
      if (title.trim().length > 160) throw new Error('Keep the title under 160 characters.');
      if (!rightsConfirmed) throw new Error('Confirm your television display, artwork and playback rights.');
      if (thumbnail && (!['image/jpeg', 'image/png'].includes(thumbnail.type) || thumbnail.size < 1 || thumbnail.size > 1_000_000))
        throw new Error('Choose a PNG or JPEG thumbnail under 1 MB.');
      const inspectedDurationSeconds = await readVideoDuration(file);
      const externalId = await hashVideoFile(file);
      const chosenThumbnail = thumbnail ?? await extractVideoThumbnail(file);
      setThumbnailNotice(chosenThumbnail ? thumbnail ? 'Custom thumbnail saved as private draft artwork.' : 'Video still saved as private draft artwork.'
        : 'No thumbnail could be extracted. A draft placeholder remains until you add artwork.');
      busyRef.current = true; setBusy(true); setProgress(0);
      let current = await refresh();
      let ownedItemId = itemId || current.items.find(value => value.kind === 'video' && value.sourceRecord.externalId.provider === 'creator' && value.sourceRecord.externalId.value === externalId)?.id || '';
      if (!ownedItemId) {
        let source = current.sources.find(value => value.type === 'creator_upload');
        if (!source) {
          const added = await writeCatalog(projectId, 'sources', current.revision, {
            schemaVersion: 1, type: 'creator_upload', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' }
          });
          current = await refresh(); source = current.sources.find(value => value.id === added.record.id);
        }
        if (!source) throw new Error('Video source could not be saved. Refresh and retry.');
        const identifier = { provider: 'creator' as const, kind: 'upload_id' as const, value: externalId };
        const added = await writeCatalog(projectId, 'items', current.revision, {
          schemaVersion: 1, kind: 'video', sourceRecord: { sourceId: source.id, externalId: identifier,
            observedAt: new Date().toISOString(), metadata: { title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) } },
          externalIdentifiers: [identifier], mediaAssetIds: []
        });
        ownedItemId = added.record.id; setItemId(ownedItemId); onCreated(ownedItemId); current = await refresh();
      } else {
        const owned = current.items.find(value => value.id === ownedItemId && value.kind === 'video');
        if (!owned) throw new Error('Video draft is unavailable for this project. Refresh the library.');
        const changed = title.trim() !== (owned.creatorOverrides?.title ?? owned.sourceRecord.metadata.title) ||
          description.trim() !== (owned.creatorOverrides?.description ?? owned.sourceRecord.metadata.description ?? '');
        if (changed) {
          const { id, creatorAccountId: _owner, projectId: _project, ...record } = owned;
          await writeCatalog(projectId, 'items', current.revision, { ...record, creatorOverrides: {
            ...owned.creatorOverrides, title: title.trim(), description: description.trim(), editedAt: new Date().toISOString()
          } }, id);
          current = await refresh();
        }
      }
      const savedCollectionId = collectionId || current.collections.find(value => value.itemIds.includes(ownedItemId) && !(value.kind === 'series' && value.title === 'Videos'))?.id || '';
      if (!collectionId && savedCollectionId) setCollectionId(savedCollectionId);
      current = await saveVideoPlacement(projectId, ownedItemId, savedCollectionId, refresh);
      let ownedAssetId = assetId || current.mediaAssets.find(value => value.catalogItemId === ownedItemId && value.kind === 'video' && value.location.type === 'managed_hls')?.id || '';
      if (!ownedAssetId) {
        const assertedAt = new Date().toISOString();
        const added = await writeCatalog(projectId, 'media-assets', current.revision, {
          schemaVersion: 1, catalogItemId: ownedItemId, kind: 'video', location: { type: 'managed_hls' },
          tvDisplayRights: claim('television_display', assertedAt), tvPlaybackRights: claim('television_playback', assertedAt), deliveryEligible: true
        });
        ownedAssetId = added.record.id; setAssetId(ownedAssetId); current = await refresh();
      } else {
        const existing = current.mediaAssets.find(value => value.id === ownedAssetId)!;
        if (existing.tvDisplayRights?.status !== 'cleared' || existing.tvPlaybackRights?.status !== 'cleared')
          throw new Error('Video rights were revoked or need review. Resolve rights in the library before replacing this upload.');
      }
      if (chosenThumbnail) await saveThumbnail(projectId, ownedItemId, chosenThumbnail, refresh);
      const nextController = new AbortController(); controller.current = nextController;
      const result = await uploadVideo(projectId, ownedAssetId, file, nextController.signal, setProgress, setSession, inspectedDurationSeconds, externalId);
      setSession(result); await refresh();
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 409 ? 'Catalog changed in another tab. Review the saved draft and retry.' : reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally { controller.current = null; busyRef.current = false; setBusy(false); }
  };
  const retry = async () => {
    if (!session || !assetId) return;
    setError(''); setBusy(true);
    try { setSession(await retryVideoProcessing(projectId, session.id, assetId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const updateThumbnail = async () => {
    if (!existingItem || !thumbnail || !rightsConfirmed) return;
    setError(''); setBusy(true);
    try { await saveThumbnail(projectId, existingItem.id, thumbnail, refresh); setThumbnail(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <section className="video-upload-panel" aria-label={existingItem ? 'Replace video' : 'Add Video'}>
    <div className="video-upload-heading"><div><span className="eyebrow">PRIVATE VIDEO DRAFT</span><h3>{existingItem ? 'Replace video' : 'Add Video'}</h3></div><button type="button" disabled={busy} onClick={onClose}>Close</button></div>
    <p>Your video stays private. Processing and TV publication require separate review.</p>
    <div className={`video-dropzone${dragging ? ' dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()}
      onDragLeave={event => { event.preventDefault(); setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0] ?? null); }}>
      <strong>Drop an MP4 here</strong><span>or choose a file · up to 250 MB · 30 minutes</span>
      <input aria-label="Video file" type="file" accept=".mp4,video/mp4" disabled={busy} onChange={event => chooseFile(event.target.files?.[0] ?? null)}/>
    </div>
    {file && <p className="video-file" role="status">Selected: {file.name} · {(file.size / 1_000_000).toFixed(1)} MB</p>}
    <div className="video-form-grid"><label className="field"><span>Title *</span><input required maxLength={160} value={title} onChange={event => { setTitleEdited(true); setTitle(event.target.value); }}/></label>
      <label className="field"><span>Category</span><select value={collectionId} onChange={event => setCollectionId(event.target.value)}><option value="">Videos</option>{inventory.collections.filter(value => !(value.kind === 'series' && value.title === 'Videos')).map(value => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label></div>
    <label className="field"><span>Description (optional)</span><textarea maxLength={4000} value={description} onChange={event => setDescription(event.target.value)}/></label>
    <label className="field"><span>Custom thumbnail (optional)</span><input type="file" accept="image/png,image/jpeg" onChange={event => setThumbnail(event.target.files?.[0] ?? null)}/></label>
    <p className="video-file">Without a custom thumbnail, a draft placeholder appears until reviewed TV artwork is available.</p>
    {thumbnailNotice && <p role="status" className="video-upload-notice">{thumbnailNotice}</p>}
    <label className="check video-rights"><input type="checkbox" checked={rightsConfirmed} onChange={event => setRightsConfirmed(event.target.checked)}/> I own or license TV display rights for this video and its artwork, and TV playback and streaming rights.</label>
    <div className="button-row"><button className="primary" disabled={busy} onClick={() => void submit()}>{busy ? 'Uploading…' : 'Upload Video'}</button>
      {existingItem && thumbnail && <button type="button" disabled={busy || !rightsConfirmed} onClick={() => void updateThumbnail()}>Save thumbnail only</button>}
      {session?.processing?.state === 'failed' && <button type="button" disabled={busy} onClick={() => void retry()}>Retry processing</button>}
      {busy && controller.current && <button type="button" onClick={() => controller.current?.abort()}>Stop upload</button>}</div>
    {busy && <><progress aria-label="Video upload progress" value={progress} max="100"/><p role="status" className="video-upload-notice">{progress < 100 ? `Uploading ${progress}%` : 'Upload sent; finishing private verification…'}</p></>}
    {session && <p role="status" className={`video-upload-notice${session.processing?.state === 'failed' ? ' video-upload-failed' : ''}`}>{videoProcessingMessage(session)}</p>}
    {itemId && error && <p>Draft saved in your library. Select it to continue after reload.</p>}
    {error && <p role="alert" className="catalog-error">{error}</p>}
  </section>;
}
