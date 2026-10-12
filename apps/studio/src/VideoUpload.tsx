import React, { useEffect, useRef, useState } from 'react';
import type { CatalogItem, MediaAsset } from '@firelaunch/contracts';
import { ApiError, readVideoAssetStatus, readVideoUpload, writeCatalog, type CatalogSnapshot, type VideoUploadStatus } from './api.js';
import { uploadVideo, validateVideoFile } from './video-upload.js';

const claim = (use: 'television_display' | 'television_playback') =>
  ({ status: 'cleared' as const, basis: 'creator_asserted' as const, permittedUse: use, assertedAt: new Date().toISOString() });

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
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 14400) throw new Error('Enter a duration from 1 second to 4 hours.');
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
  if (item.kind !== 'video') return null;
  return <section aria-label="Creator video upload">
    <h3>Video master upload</h3><p>Upload your owned MP4 directly to private storage. Processing and rights review must finish before a separate live approval and publish.</p>
    <label className="field"><span>VIDEO FILE · MP4 · MAX 250 MB</span><input type="file" accept=".mp4,video/mp4" onChange={event => { setFile(event.target.files?.[0] ?? null); setError(''); }}/></label>
    <label className="field"><span>APPROXIMATE DURATION · SECONDS</span><input type="number" min="1" max="14400" value={duration} onChange={event => setDuration(event.target.value)}/></label>
    <label className="check"><input type="checkbox" checked={display} onChange={event => setDisplay(event.target.checked)}/> I have television display rights for this video</label>
    <label className="check"><input type="checkbox" checked={playback} onChange={event => setPlayback(event.target.checked)}/> I have television playback rights for this video</label>
    <div className="button-row"><button disabled={busy || !file || !display || !playback} onClick={() => void start()}>{session?.processing?.state === 'ready' ? 'Upload replacement master' : session || error ? 'Retry upload' : 'Upload video master'}</button>
      {busy && <button type="button" onClick={() => controller.current?.abort()}>Cancel upload</button>}</div>
    {busy && <p role="status">Uploading {progress}%</p>}
    {session && <p role="status">Upload: {session.state}; SHA-256: {session.verification}; processing: {session.processing?.state ?? 'waiting for worker'}{session.processing?.failureCode ? ` (${session.processing.failureCode})` : ''}. {ready ? 'Ready for separate publication review.' : 'Unavailable for live publication.'}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
