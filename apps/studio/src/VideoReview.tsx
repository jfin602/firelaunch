import React, { useEffect, useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { sourceUseEligible, type ChannelProject, type CatalogItem } from '@firelaunch/contracts';
import { ApiError, readVideoAssetStatus, setVideoInclusion, writeCatalog, type CatalogSnapshot, type VideoAssetStatus } from './api.js';
import type { VideoPage } from './video-pages.js';

export function VideoReview({ project, item, inventory, refresh, onProjectUpdate, page, onNavigate }: {
  project: ChannelProject; item: CatalogItem; inventory: CatalogSnapshot; refresh: () => Promise<CatalogSnapshot>;
  onProjectUpdate: (project: ChannelProject) => void; page: Extract<VideoPage, 'channel' | 'publish'>;
  onNavigate: (page: VideoPage) => void;
}) {
  const [video, setVideo] = useState<VideoAssetStatus>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const source = inventory.sources.find(value => value.id === item.sourceRecord.sourceId);
  const assets = inventory.mediaAssets.filter(value => value.catalogItemId === item.id);
  const managed = assets.find(value => value.kind === 'video' && value.location.type === 'managed_hls');
  const privateArtwork = [...item.mediaAssetIds].reverse().map(id => assets.find(value => value.id === id))
    .find(value => value?.kind === 'artwork' && value.location.type === 'private_object');
  const sourceReady = !!source && !!managed && sourceUseEligible(source, managed, 'television_playback');
  const completingArtwork = !!source && !!managed && !!privateArtwork && !privateArtwork.deliveryEligible &&
    sourceReady && sourceUseEligible(source, privateArtwork, 'television_display') &&
    privateArtwork.tvDisplayRights?.attestationVersion === 'channel-media-v1';
  const ready = videoLoaded && !!managed && video?.uploadState === 'verified' && video.processing?.state === 'ready' &&
    managed.tvDisplayRights?.status === 'cleared' && managed.tvPlaybackRights?.status === 'cleared' && managed.deliveryEligible;
  const stableId = `item_${bytesToHex(sha256(new TextEncoder().encode(`catalog-content-v1\0${item.id}`))).slice(0, 32)}`;
  const linked = project.spec.content.some(content => content.id === stableId && content.presentation === 'video') &&
    project.spec.pages.some(channelPage => channelPage.modules.some(module =>
      (module.kind === 'hero' || module.kind === 'rail' || module.kind === 'grid') && module.contentIds.includes(stableId)));

  useEffect(() => {
    let active = true;
    if (!managed) { setVideo(null); setVideoLoaded(true); return; }
    setVideoLoaded(false);
    const update = () => void readVideoAssetStatus(project.id, managed.id).then(value => {
      if (active) { setVideo(value); setVideoLoaded(true); }
    }).catch(() => { if (active) { setVideo(null); setVideoLoaded(true); } });
    update(); const timer = window.setInterval(update, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [project.id, managed?.id, inventory.revision]);
  useEffect(() => {
    if (!privateArtwork || privateArtwork.deliveryEligible || !managed ||
      !sourceReady || !sourceUseEligible(source!, privateArtwork, 'television_display') ||
      privateArtwork.tvDisplayRights?.attestationVersion !== 'channel-media-v1') return;
    let active = true;
    const { id, creatorAccountId: _owner, projectId: _project, ...record } = privateArtwork;
    void writeCatalog(project.id, 'media-assets', inventory.revision, { ...record, deliveryEligible: true }, id)
      .then(() => { if (active) void refresh(); }).catch(() => undefined);
    return () => { active = false; };
  }, [project.id, inventory.revision, privateArtwork?.id, privateArtwork?.deliveryEligible, managed?.id, source?.id]);

  const change = (action: 'publish' | 'remove') => void (async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const next = await setVideoInclusion(project, inventory.revision, item.id, action);
      onProjectUpdate(next);
      setNotice(action === 'publish' ? 'In Channel. This video appears in TV Preview and the next eligible channel export.' :
        'Removed from Channel. The video and its files remain in your private Library.');
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 409 ? `${reason.message} Refresh and retry.` :
        reason instanceof Error ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally { setBusy(false); }
  })();
  const status = !videoLoaded ? 'Checking video status…' : !managed ? 'Upload a video on Video first.' :
    video?.processing?.state === 'failed' ? 'Processing failed. Retry on Video.' :
    video?.processing?.state === 'revoked' ? 'Video rights were revoked. Publication is blocked.' :
    !sourceReady ? 'Source or playback permission is unavailable.' :
    !ready ? 'Wait for verified private video processing and cleared playback rights.' : '';

  return <section className="video-review" aria-label={page === 'channel' ? 'Channel placement' : 'Video publication'}>
    {error && <p role="alert" className="catalog-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <h3>{page === 'publish' ? 'Publish' : 'Channel placement'}</h3>
    <p role="status"><strong>{linked ? 'In Channel' : 'Private'}</strong> · {linked ?
      'Included in this channel draft and TV Preview.' : 'Saved in Library and absent from TV Preview.'}</p>
    {status && <p role="status">{status} {videoLoaded && <button type="button" onClick={() => onNavigate('video')}>Go to Video</button>}</p>}
    {completingArtwork && <p role="status">Preparing your confirmed thumbnail…</p>}
    {linked ? <button type="button" disabled={busy} onClick={() => change('remove')}>Remove from Channel</button> :
      <button type="button" disabled={busy || !ready || !sourceReady} onClick={() => change('publish')}>Publish</button>}
    <p>This changes the current channel draft and future eligible exports. Installed apps and the live public release are unchanged.</p>
  </section>;
}
