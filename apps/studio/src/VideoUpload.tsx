import React, { useEffect, useRef, useState } from 'react';
import type { CatalogItem, Collection } from '@firelaunch/contracts';
import { ApiError, deletePrivateObject, readPrivateThumbnail, readVideoAssetStatus, readVideoUpload, retryVideoProcessing, uploadPrivateMedia, writeCatalog, type CatalogSnapshot, type VideoUploadStatus } from './api.js';
import { extractVideoThumbnail, hashVideoFile, readVideoDuration, titleFromFilename, validateVideoFile } from './video-upload.js';
import { startVideoTransfer, stopVideoTransfer, subscribeVideoTransfers, videoTransfer, type VideoTransfer } from './video-transfer.js';
import type { VideoPage } from './video-pages.js';

const claim = (use: 'television_display' | 'television_playback', assertedAt: string) =>
  ({ status: 'cleared' as const, basis: 'creator_asserted' as const, permittedUse: use, assertedAt });
const unknown = () =>
  ({ status: 'unknown' as const, basis: 'none' as const, permittedUse: 'none' as const });

async function saveThumbnail(projectId: string, itemId: string, thumbnail: File,
  refresh: () => Promise<CatalogSnapshot>): Promise<void> {
  if (!['image/jpeg', 'image/png'].includes(thumbnail.type) || thumbnail.size < 1 || thumbnail.size > 1_000_000)
    throw new Error('Choose a PNG or JPEG thumbnail under 1 MB.');
  const current = await refresh();
  const uploaded = await uploadPrivateMedia(projectId, thumbnail);
  let attached = false;
  try {
    await writeCatalog(projectId, 'media-assets', current.revision, {
      schemaVersion: 1, catalogItemId: itemId, kind: 'artwork', location: { type: 'private_object', objectId: uploaded.id },
      tvDisplayRights: claim('television_display', new Date().toISOString()), tvPlaybackRights: unknown(), deliveryEligible: false
    });
    attached = true;
    await refresh();
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
  const [status, setStatus] = useState('Checking private video status…');
  useEffect(() => {
    if (!assetId) { setStatus('No upload yet · open to add an MP4'); return; }
    let alive = true;
    let pending = false;
    const check = () => {
      if (!alive || pending || document.visibilityState === 'hidden') return;
      pending = true;
      void readVideoAssetStatus(projectId, assetId).then(value => {
        if (!alive) return;
        if (!value) { setStatus('No upload yet · open to add an MP4'); return; }
        if (value.uploadState !== 'verified') {
          setStatus(value.uploadState === 'completed' && value.processingAvailable === false ?
            'Uploaded · processing unavailable; open for details' : value.uploadState === 'completed' ?
            'Uploaded · waiting for private verification' :
            'Upload incomplete · open to retry with your file'); return;
        }
        switch (value.processing?.state) {
          case 'ready': setStatus('Processed privately · open to review rights and channel readiness'); break;
          case 'failed': setStatus('Processing failed · open to retry or replace'); break;
          case 'revoked': setStatus('Revoked · publication blocked; open to review'); break;
          case 'leased': setStatus('Processing needs operator attention · open for details'); break;
          default: setStatus(value.processingAvailable === false ? 'Processing unavailable · open for details' :
            'Processing privately · check back later');
        }
      }).catch(() => { if (alive) setStatus('Status unavailable · open to retry'); })
        .finally(() => { pending = false; });
    };
    check();
    const timer = window.setInterval(check, 15_000);
    document.addEventListener('visibilitychange', check);
    return () => { alive = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [projectId, assetId]);
  return <span>{status}</span>;
}

export function NewVideoUpload({ accountId, projectId, inventory, refresh, onCreated, onClose, onBusyChange, existingItem, page = 'video' }: {
  accountId: string; projectId: string; inventory: CatalogSnapshot; refresh: () => Promise<CatalogSnapshot>;
  onCreated: (itemId: string) => void; onClose: () => void; onBusyChange?: (busy: boolean) => void; existingItem?: CatalogItem; page?: VideoPage;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(existingItem?.creatorOverrides?.title ?? existingItem?.sourceRecord.metadata.title ?? '');
  const [titleEdited, setTitleEdited] = useState(false);
  const [description, setDescription] = useState(existingItem?.creatorOverrides?.description ?? existingItem?.sourceRecord.metadata.description ?? '');
  const [collectionId, setCollectionId] = useState(() => inventory.collections.find(value => existingItem && value.itemIds.includes(existingItem.id) && !(value.kind === 'series' && value.title === 'Videos'))?.id ?? '');
  const [newCategory, setNewCategory] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [thumbnailNotice, setThumbnailNotice] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [itemId, setItemId] = useState(existingItem?.id ?? '');
  const [assetId, setAssetId] = useState('');
  const [session, setSession] = useState<VideoUploadStatus | null>(null);
  const [transfer, setTransfer] = useState<VideoTransfer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const latestArtwork = [...(inventory.items.find(value => value.id === (existingItem?.id ?? itemId))?.mediaAssetIds ?? [])]
    .reverse().map(id => inventory.mediaAssets.find(asset => asset.id === id))
    .find(asset => asset?.kind === 'artwork' && asset.location.type === 'private_object');
  const thumbnailObjectId = latestArtwork?.location.type === 'private_object' ? latestArtwork.location.objectId : '';
  const busyRef = useRef(false);
  const activeRef = useRef(true);
  useEffect(() => { activeRef.current = true; return () => { activeRef.current = false; }; }, []);
  useEffect(() => {
    if (page !== 'details' || typeof URL.createObjectURL !== 'function') { setThumbnailPreview(''); return; }
    let active = true;
    let preview = '';
    const show = (blob: Blob) => {
      if (!active) return;
      preview = URL.createObjectURL(blob);
      setThumbnailPreview(preview);
    };
    if (thumbnail) show(thumbnail);
    else if (thumbnailObjectId) void readPrivateThumbnail(projectId, thumbnailObjectId).then(show).catch(() => { if (active) setThumbnailPreview(''); });
    else setThumbnailPreview('');
    return () => { active = false; if (preview) URL.revokeObjectURL(preview); };
  }, [page, projectId, thumbnail, thumbnailObjectId]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  useEffect(() => {
    const update = () => { const current = itemId ? videoTransfer(accountId, projectId, itemId) : undefined; setTransfer(current ? { ...current } : null); };
    update(); return subscribeVideoTransfers(update);
  }, [accountId, projectId, itemId]);
  useEffect(() => {
    if (!itemId || session || busy || transfer?.state === 'uploading') return;
    const asset = inventory.mediaAssets.find(value => value.catalogItemId === itemId && value.kind === 'video' && value.location.type === 'managed_hls');
    if (!asset) return;
    setAssetId(asset.id);
    let active = true;
    void readVideoAssetStatus(projectId, asset.id).then(value => value && readVideoUpload(projectId, value.uploadId, asset.id))
      .then(value => { if (active && value) setSession(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [projectId, itemId, inventory.revision, busy, session, transfer?.state]);
  useEffect(() => {
    if (!session || !['completed', 'verified'].includes(session.state)) return;
    let active = true;
    let pending = false;
    const check = () => {
      if (!active || pending || document.visibilityState === 'hidden') return;
      pending = true;
      void readVideoUpload(projectId, session.id, assetId).then(next => {
        if (active) setSession(next);
      }).catch(() => { if (active) setError('Processing status is unavailable. Reopen this video to try again.'); })
        .finally(() => { pending = false; });
    };
    const timer = window.setInterval(check, 15_000);
    document.addEventListener('visibilitychange', check);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [projectId, assetId, session?.id, session?.state, session?.processing?.state, session?.processingAvailable]);
  const chooseFile = (next: File | null) => {
    if (!next) return;
    try { validateVideoFile(next); setFile(next); if (!titleEdited && !itemId) setTitle(titleFromFilename(next.name)); setError(''); }
    catch (reason) { setFile(null); setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const setWorking = (value: boolean) => { busyRef.current = value; setBusy(value); onBusyChange?.(value); };
  const submit = async () => {
    if (busyRef.current) return;
    if (itemId && videoTransfer(accountId, projectId, itemId)?.state === 'uploading') return;
    setWorking(true);
    setError('');
    try {
      if (!file) throw new Error('Choose an MP4 video.');
      validateVideoFile(file);
      if (!title.trim()) throw new Error('Enter a video title on Details.');
      if (title.trim().length > 160) throw new Error('Keep the title under 160 characters.');
      if (!rightsConfirmed) throw new Error('Confirm your television display, artwork and playback rights.');
      if (thumbnail && (!['image/jpeg', 'image/png'].includes(thumbnail.type) || thumbnail.size < 1 || thumbnail.size > 1_000_000))
        throw new Error('Choose a PNG or JPEG thumbnail under 1 MB.');
      const inspectedDurationSeconds = await readVideoDuration(file);
      if (!activeRef.current) return;
      const externalId = await hashVideoFile(file);
      if (!activeRef.current) return;
      const chosenThumbnail = thumbnail ?? await extractVideoThumbnail(file);
      if (!activeRef.current) return;
      setThumbnailNotice(chosenThumbnail ? thumbnail ? 'Custom thumbnail saved as private draft artwork.' : 'Video still saved as private draft artwork.'
        : 'No thumbnail could be extracted. A draft placeholder remains until you add artwork.');
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
      void startVideoTransfer({ accountId, projectId, itemId: ownedItemId, assetId: ownedAssetId, file,
        durationSeconds: inspectedDurationSeconds, sha256: externalId })
        .then(result => { if (activeRef.current) { setSession(result); return refresh(); } })
        .catch(() => { if (activeRef.current) return refresh().catch(() => undefined); });
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 409 ? 'Catalog changed in another tab. Review the saved draft and retry.' : reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally { setWorking(false); }
  };
  const saveDetails = async () => {
    if (!existingItem || busyRef.current) return;
    setError(''); setWorking(true);
    try {
      if (!title.trim() || title.trim().length > 160) throw new Error('Enter a video title under 160 characters.');
      const current = inventory;
      const owned = current.items.find(value => value.id === existingItem.id && value.kind === 'video');
      if (!owned) throw new Error('Video draft is unavailable for this project. Refresh the library.');
      const { id, creatorAccountId: _owner, projectId: _project, ...record } = owned;
      await writeCatalog(projectId, 'items', current.revision, { ...record, creatorOverrides: {
        ...owned.creatorOverrides, title: title.trim(), description: description.trim(), editedAt: new Date().toISOString()
      } }, id);
      await refresh();
    } catch (reason) { setError(reason instanceof ApiError && reason.status === 409 ? 'Catalog changed in another tab. Review the saved draft and retry.' : reason instanceof Error ? reason.message : String(reason)); await refresh().catch(() => undefined); }
    finally { setWorking(false); }
  };
  const createCategory = async () => {
    if (!newCategory.trim() || !itemId || busyRef.current) return;
    setError(''); setWorking(true);
    try {
      const title = newCategory.trim();
      if (title.length > 120) throw new Error('Keep the category under 120 characters.');
      const added = await writeCatalog(projectId, 'collections', inventory.revision,
        { schemaVersion: 1, kind: 'series', title, itemIds: [itemId] });
      setCollectionId(added.record.id); setNewCategory(''); await refresh();
    } catch (reason) { setError(reason instanceof ApiError && reason.status === 409 ? 'Catalog changed in another tab. Review the saved draft and retry.' : reason instanceof Error ? reason.message : String(reason)); await refresh().catch(() => undefined); }
    finally { setWorking(false); }
  };
  const savePlacement = async () => {
    if (!itemId || busyRef.current) return;
    setError(''); setWorking(true);
    try { await saveVideoPlacement(projectId, itemId, collectionId, refresh); }
    catch (reason) { setError(reason instanceof ApiError && reason.status === 409 ? 'Library changed in another tab. Review the category and retry.' : reason instanceof Error ? reason.message : String(reason)); }
    finally { setWorking(false); }
  };
  const retry = async () => {
    if (!session || !assetId) return;
    setError(''); setWorking(true);
    try { setSession(await retryVideoProcessing(projectId, session.id, assetId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setWorking(false); }
  };
  const updateThumbnail = async () => {
    if (!existingItem || !thumbnail || !rightsConfirmed) return;
    setError(''); setWorking(true);
    try { await saveThumbnail(projectId, existingItem.id, thumbnail, refresh); setThumbnail(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setWorking(false); }
  };
  if (page === 'publish') return null;
  return <section className="video-upload-panel" aria-label={page === 'video' ? existingItem ? 'Replace video' : 'Add Video' : page === 'details' ? 'Video details' : 'Channel category'}>
    {page === 'video' && <>
      <h3>{existingItem ? 'Video upload' : 'Add your video'}</h3><p>Your video stays private until you approve and publish the channel.</p>
      <div className={`video-dropzone${dragging ? ' dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()}
        onDragLeave={event => { event.preventDefault(); setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0] ?? null); }}>
        <strong>Drop an MP4 here</strong><span>or choose a file · up to 2 GB · 2 hours</span>
        <input aria-label="Video file" type="file" accept=".mp4,video/mp4" disabled={busy} onChange={event => chooseFile(event.target.files?.[0] ?? null)}/>
      </div>
      {file && <p className="video-file" role="status">Selected: {file.name} · {(file.size / 1_000_000).toFixed(1)} MB</p>}
      {!title.trim() && file && <p role="status">Add a title on Details before starting the upload.</p>}
      <label className="check video-rights"><input type="checkbox" checked={rightsConfirmed} onChange={event => setRightsConfirmed(event.target.checked)}/> I own or license this video and thumbnail for TV display and streaming.</label>
      <div className="button-row"><button className="primary" disabled={busy || transfer?.state === 'uploading' || !file || !title.trim() || !rightsConfirmed} onClick={() => void submit()}>{busy ? 'Preparing…' : existingItem ? 'Replace video' : 'Upload video'}</button>
        {session?.processing?.state === 'failed' && <button type="button" disabled={busy} onClick={() => void retry()}>Retry processing</button>}
        {transfer?.state === 'uploading' && <button type="button" onClick={() => stopVideoTransfer(accountId, projectId, itemId)}>Stop upload</button>}</div>
      {transfer?.state === 'uploading' && <><progress aria-label="Video upload progress" value={transfer.progress} max="100"/><p role="status" className="video-upload-notice">{transfer.progress === 0 ? 'Preparing private upload…' : transfer.progress < 100 ? `Uploading ${transfer.progress}%` : 'Upload sent; finishing private verification…'}</p></>}
      {transfer && ['failed', 'stopped'].includes(transfer.state) && <p role="alert">{transfer.error}</p>}
      {session?.state === 'initiated' && transfer?.state !== 'uploading' && <p role="status">This upload is incomplete. Select the MP4 again to retry; your saved details remain. Uploads do not resume after refresh.</p>}
      {session && <p role="status" className={`video-upload-notice${session.processing?.state === 'failed' ? ' video-upload-failed' : ''}`}>{videoProcessingMessage(session)}</p>}
    </>}
    {page === 'details' && <>
      <h3>Video details</h3><p>Edit details while your video uploads or processes.</p>
      <label className="field"><span>Title *</span><input required maxLength={160} value={title} onChange={event => { setTitleEdited(true); setTitle(event.target.value); }}/></label>
      <label className="field"><span>Description (optional)</span><textarea maxLength={4000} value={description} onChange={event => setDescription(event.target.value)}/></label>
      <label className="field"><span>Thumbnail (PNG or JPEG, up to 1 MB)</span><input type="file" accept="image/png,image/jpeg" onChange={event => setThumbnail(event.target.files?.[0] ?? null)}/></label>
      {thumbnailPreview && <img className="video-thumbnail-preview" src={thumbnailPreview} alt="Uploaded thumbnail preview"/>}
      <p className="video-file">{thumbnail ? `Selected thumbnail: ${thumbnail.name}` : thumbnailObjectId ? 'Uploaded thumbnail saved privately.' : 'No uploaded thumbnail yet.'} TV display requires approval on Publish.</p>
      {thumbnailNotice && <p role="status" className="video-upload-notice">{thumbnailNotice}</p>}
      {existingItem ? <div className="button-row"><button type="button" disabled={busy} onClick={() => void saveDetails()}>Save details</button>
        {thumbnail && <button type="button" disabled={busy || !rightsConfirmed} onClick={() => void updateThumbnail()}>Save thumbnail</button>}</div>
        : <p role="status">Choose an MP4 on Video to create this draft. Its title and thumbnail will be saved with the upload.</p>}
      {existingItem && thumbnail && !rightsConfirmed && <p>Confirm video and thumbnail rights on Video before saving a new thumbnail.</p>}
    </>}
    {page === 'channel' && <>
      <h3>Channel category</h3>
      {!itemId ? <p>Upload a video first, then choose where it appears in your library.</p> : <>
        <label className="field"><span>Category</span><select value={collectionId} onChange={event => setCollectionId(event.target.value)}><option value="">Videos</option>{inventory.collections.filter(value => !(value.kind === 'series' && value.title === 'Videos')).map(value => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label>
        <div className="button-row"><button type="button" disabled={busy} onClick={() => void savePlacement()}>Save category</button></div>
        <div className="button-row"><label className="field"><span>New category (optional)</span><input maxLength={120} value={newCategory} onChange={event => setNewCategory(event.target.value)}/></label><button type="button" disabled={busy || !newCategory.trim()} onClick={() => void createCategory()}>Create category</button></div>
      </>}
    </>}
    {itemId && error && <p>Your draft is still in the library. Reopen it after refreshing if needed.</p>}
    {error && <p role="alert" className="catalog-error">{error}</p>}
  </section>;
}
