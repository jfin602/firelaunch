import React, { useEffect, useRef, useState } from 'react';
import type { CatalogItem, MediaAsset } from '@firelaunch/contracts';
import { ApiError, readVideoAssetStatus, readVideoUpload, retryVideoProcessing, writeCatalog, type CatalogSnapshot, type VideoUploadStatus } from './api.js';
import { uploadVideo, validateVideoFile } from './video-upload.js';

const claim = (use: 'television_display' | 'television_playback') =>
  ({ status: 'cleared' as const, basis: 'creator_asserted' as const, permittedUse: use, assertedAt: new Date().toISOString() });

export function videoProcessingMessage(session: VideoUploadStatus): string {
  if (session.state === 'completed') return 'Upload complete; verifying source and requesting managed processing.';
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
    {busy && controller.current && <p role="status">{progress < 100 ? `Uploading ${progress}%` : 'Upload complete; verifying source and requesting managed processing.'}</p>}
    {session && <p role="status">{videoProcessingMessage(session)} {ready ? 'Ready for separate publication review.' : 'Unavailable for live publication.'}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
