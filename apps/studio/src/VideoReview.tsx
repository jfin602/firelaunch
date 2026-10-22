import React, { useEffect, useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { sourceUseEligible, type ChannelProject, type CatalogItem, type MediaAsset } from '@firelaunch/contracts';
import { ApiError, deletePrivateObject, generateCatalogDraft, getProject, readCatalogDraft, readDeployment, readLiveSummary, readVideoAssetStatus, uploadPrivateEvidence, writeCatalog, type CatalogSnapshot, type LiveSummary, type VideoAssetStatus } from './api.js';
import { LivePublication } from './LivePublication.js';
import type { VideoPage } from './video-pages.js';

export function VideoReview({ project, item, inventory, refresh, onProjectUpdate, page, onNavigate }: {
  project: ChannelProject; item: CatalogItem; inventory: CatalogSnapshot; refresh: () => Promise<CatalogSnapshot>;
  onProjectUpdate: (project: ChannelProject) => void; page: Extract<VideoPage, 'channel' | 'publish'>;
  onNavigate: (page: VideoPage) => void;
}) {
  const [video, setVideo] = useState<VideoAssetStatus>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [live, setLive] = useState<LiveSummary>(null);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [sourceEvidence, setSourceEvidence] = useState<File | null>(null);
  const [sourceApproved, setSourceApproved] = useState(false);
  const [artworkApproved, setArtworkApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPublication, setShowPublication] = useState(false);
  const source = inventory.sources.find(value => value.id === item.sourceRecord.sourceId);
  const assets = inventory.mediaAssets.filter(value => value.catalogItemId === item.id);
  const managed = assets.find(value => value.kind === 'video' && value.location.type === 'managed_hls');
  const privateArtwork = [...item.mediaAssetIds].reverse().map(id => assets.find(value => value.id === id))
    .find(value => value?.kind === 'artwork' && value.location.type === 'private_object');
  const publicArtwork = privateArtwork
    ? privateArtwork.deliveryEligible && privateArtwork.tvDisplayRights?.status === 'cleared' ? privateArtwork : undefined
    : assets.find(value => value.kind === 'artwork' && value.location.type === 'https' && value.deliveryEligible && value.tvDisplayRights?.status === 'cleared');
  const sourceReady = !!source && !!managed && sourceUseEligible(source, managed, 'television_playback');
  const completingArtwork = !!source && !!managed && !!privateArtwork && !privateArtwork.deliveryEligible &&
    sourceReady && sourceUseEligible(source, privateArtwork, 'television_display') &&
    privateArtwork.tvDisplayRights?.attestationVersion === 'channel-media-v1';
  const ready = videoLoaded && !!managed && video?.uploadState === 'verified' && video.processing?.state === 'ready' &&
    managed.tvDisplayRights?.status === 'cleared' && managed.tvPlaybackRights?.status === 'cleared' && managed.deliveryEligible;
  const stableId = `item_${bytesToHex(sha256(new TextEncoder().encode(`catalog-content-v1\0${item.id}`))).slice(0, 32)}`;
  const linked = project.spec.content.some(content => content.id === stableId && content.presentation === 'video') &&
    project.spec.pages.some(page => page.modules.some(module =>
      (module.kind === 'hero' || module.kind === 'rail' || module.kind === 'grid') && module.contentIds.includes(stableId)));
  const inLive = live?.catalogItemIds.includes(item.id) ?? false;
  const draftAfterLive = inLive && (live?.revisions.channel !== project.revision || live?.revisions.catalog !== inventory.revision);

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
    if (!source || !privateArtwork || privateArtwork.deliveryEligible || !managed ||
      !sourceUseEligible(source, managed, 'television_playback') ||
      !sourceUseEligible(source, privateArtwork, 'television_display') ||
      privateArtwork.tvDisplayRights?.attestationVersion !== 'channel-media-v1') return;
    // The 0.9.2 upload already saved a separate, current thumbnail assertion. Complete
    // its delivery flag without asking for the same permission on Publish.
    let active = true;
    const { id, creatorAccountId: _owner, projectId: _project, ...record } = privateArtwork;
    void writeCatalog(project.id, 'media-assets', inventory.revision, { ...record, deliveryEligible: true }, id)
      .then(() => { if (active) void refresh(); }).catch(() => undefined);
    return () => { active = false; };
  }, [project.id, inventory.revision, privateArtwork?.id, privateArtwork?.deliveryEligible, managed?.id, source?.id]);
  useEffect(() => {
    let active = true;
    setLiveLoaded(false);
    setLiveError(false);
    void readDeployment(project.id).then(deployment => readLiveSummary(project.id, deployment.id))
      .then(value => { if (active) { setLive(value); setLiveLoaded(true); } })
      .catch(reason => { if (!active) return; if (reason instanceof ApiError && reason.status === 404) { setLive(null); setLiveLoaded(true); }
        else setLiveError(true); });
    return () => { active = false; };
  }, [project.id, project.revision, inventory.revision, showPublication]);
  const act = async (work: () => Promise<string>) => {
    setBusy(true); setError(''); setNotice('');
    try { setNotice(await work()); }
    catch (reason) { setError(reason instanceof ApiError && reason.status === 409 ? 'Catalog or channel changed elsewhere. Review the refreshed draft and retry.' : reason instanceof Error ? reason.message : String(reason)); await refresh().catch(() => undefined); }
    finally { setBusy(false); }
  };
  const verifySource = () => void act(async () => {
    if (!source || source.type !== 'creator_upload' || source.state !== 'discovered' || !sourceApproved || !sourceEvidence)
      throw new Error('Attach provenance evidence and confirm source permission.');
    const uploaded = await uploadPrivateEvidence(project.id, sourceEvidence);
    const { id, creatorAccountId: _owner, projectId: _project, ...record } = source;
    try { await writeCatalog(project.id, 'sources', inventory.revision, { ...record, state: 'verified',
      permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted', verificationEvidenceId: uploaded.id } }, id); }
    catch (reason) {
      try { await deletePrivateObject(project.id, uploaded.id); }
      catch { throw new Error(`Source evidence ${uploaded.id} needs private-object cleanup after the catalog write failed.`); }
      throw reason;
    }
    await refresh(); setSourceApproved(false); setSourceEvidence(null);
    return 'Source permission saved. The video remains private.';
  });
  const approveThumbnail = () => void act(async () => {
    if (!artworkApproved || !privateArtwork || privateArtwork.tvDisplayRights?.status !== 'cleared')
      throw new Error('Confirm TV display rights for your uploaded thumbnail.');
    const { id, creatorAccountId: _owner, projectId: _project, ...record } = privateArtwork;
    await writeCatalog(project.id, 'media-assets', inventory.revision, { ...record, deliveryEligible: true }, id);
    await refresh(); setArtworkApproved(false);
    return 'Uploaded thumbnail approved for TV review. It remains private until channel publication.';
  });
  const linkDraft = () => void act(async () => {
    if (!ready) throw new Error('Wait for verified video processing and confirmed playback permission before adding it to the channel preview.');
    const prior = await readCatalogDraft(project.id);
    if (prior && prior.creatorType !== 'video') throw new Error('This channel uses another draft type. Review its layout in Catalog before changing it.');
    const latestCatalog = await refresh();
    const latestProject = await getProject(project.id);
    if (latestProject.revision !== project.revision || latestCatalog.revision !== inventory.revision)
      throw new ApiError('Draft revision changed', 409);
    const selection = { expectedCatalogRevision: inventory.revision,
      itemIds: [...new Set([...(prior?.selection.itemIds ?? []), item.id])],
      collectionIds: prior?.selection.collectionIds ?? [] };
    const result = await generateCatalogDraft(project, 'video', selection);
    onProjectUpdate(result.project);
    return 'Video added to the private channel preview. Review all channel content before publishing.';
  });
  return <section className="video-review" aria-label={page === 'channel' ? 'Channel placement' : 'Video publication'}>
    {error && <p role="alert" className="catalog-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {page === 'channel' && <>
      <h3>Channel preview</h3>
      <p>{linked ? 'This video is in your private channel preview.' : 'When this video is ready, add it to the private channel preview. Your collection choice above is saved separately.'}</p>
      {!linked && <>
        {!ready && <p role="status">{!videoLoaded ? 'Checking video status…' : !managed ? 'Upload your video on Video first.' : video?.processing?.state === 'failed' ? 'Processing failed. Retry on Video.' : video?.processing?.state === 'revoked' ? 'Video rights were revoked; publication is blocked.' : 'Wait for private video processing to finish on Video.'}</p>}
        {ready && <button disabled={busy} onClick={linkDraft}>Add to channel preview</button>}
      </>}
    </>}
    {page === 'publish' && <>
      <h3>Publish</h3>
      {liveLoaded && <p role="status">{inLive ? `${ready ? 'Published' : 'Referenced but currently blocked'} in live release #${live!.sequence}${draftAfterLive ? ' · newer private draft changes await approval' : ''}` : 'Private draft · this video is not in the current live release.'}</p>}
      {liveError && <p role="alert">Live release status is unavailable. Reopen this video before relying on its status.</p>}
      {!ready && <p role="status">{!videoLoaded ? 'Checking video status…' : !managed ? 'Upload a video on Video.' : video?.processing?.state === 'failed' ? 'Processing failed. Retry on Video.' : video?.processing?.state === 'revoked' ? 'Video rights were revoked. Replace the video or resolve the revocation.' : 'Private video processing must finish before publication.'} {videoLoaded && <button type="button" onClick={() => onNavigate('video')}>Go to Video</button>}</p>}
      {!sourceReady && <div className="video-review-requirement"><h4>Confirm your source</h4><p>Keep private proof that you control this video and can show it on TV.</p>
        {source?.type === 'creator_upload' && source.state === 'discovered' ? <><label className="field"><span>Private proof (PDF, PNG or JPEG)</span><input type="file" accept="application/pdf,image/png,image/jpeg" onChange={event => setSourceEvidence(event.target.files?.[0] ?? null)}/></label>
          <label className="check"><input type="checkbox" checked={sourceApproved} onChange={event => setSourceApproved(event.target.checked)}/> I control this video source and have TV display permission.</label>
          {sourceApproved && sourceEvidence ? <button disabled={busy} onClick={verifySource}>Save source permission</button> : <p>Choose proof and confirm permission to continue.</p>}</>
          : <p>Review this source’s permission in Catalog before publishing.</p>}</div>}
      {completingArtwork && !error && <p role="status">Preparing your confirmed thumbnail for channel review…</p>}
      {!publicArtwork && (!completingArtwork || !!error) && <div className="video-review-requirement"><h4>Approve your thumbnail</h4>
        {privateArtwork?.tvDisplayRights?.status === 'cleared' ? <><p>Your uploaded thumbnail is private. Confirm it may appear on TV; FireLaunch will deliver the approved image when the channel goes live.</p>
          <label className="check"><input type="checkbox" checked={artworkApproved} onChange={event => setArtworkApproved(event.target.checked)}/> I approve TV display of this uploaded thumbnail.</label>
          {artworkApproved && <button disabled={busy} onClick={approveThumbnail}>Save thumbnail approval</button>}</>
          : <p>Add a licensed thumbnail on Details, then confirm its rights on Video. <button type="button" onClick={() => onNavigate('details')}>Go to Details</button></p>}</div>}
      {!linked && <p role="status">Add this video to your private channel preview on Channel. <button type="button" onClick={() => onNavigate('channel')}>Go to Channel</button></p>}
      {linked && ready && sourceReady && publicArtwork && <><p>Publishing replaces the whole live channel, not just this video. Review every item, approve the draft, then confirm the live release.</p>
        <button onClick={() => setShowPublication(value => !value)}>{showPublication ? 'Hide live review' : 'Review live channel'}</button>
        {showPublication && <LivePublication key={`${project.revision}:${inventory.revision}`} project={project} hosted simple onPublished={() => { setLiveError(false); void readDeployment(project.id)
          .then(deployment => readLiveSummary(project.id, deployment.id))
          .then(value => { setLive(value); setLiveLoaded(true); })
          .catch(() => { setLiveLoaded(false); setLiveError(true); }); }}/>}</>}
    </>}
  </section>;
}
