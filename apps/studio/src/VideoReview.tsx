import React, { useEffect, useState } from 'react';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import type { ChannelProject, CatalogItem, MediaAsset } from '@firelaunch/contracts';
import { ApiError, deletePrivateObject, generateCatalogDraft, getProject, readCatalogDraft, readDeployment, readLiveSummary, readVideoAssetStatus, uploadPrivateEvidence, writeCatalog, type CatalogSnapshot, type LiveSummary, type VideoAssetStatus } from './api.js';
import { LivePublication } from './LivePublication.js';

const unknown = { status: 'unknown' as const, basis: 'none' as const, permittedUse: 'none' as const };

export function VideoReview({ project, item, inventory, refresh, onProjectUpdate }: {
  project: ChannelProject; item: CatalogItem; inventory: CatalogSnapshot; refresh: () => Promise<CatalogSnapshot>;
  onProjectUpdate: (project: ChannelProject) => void;
}) {
  const [video, setVideo] = useState<VideoAssetStatus>(null);
  const [live, setLive] = useState<LiveSummary>(null);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [sourceEvidence, setSourceEvidence] = useState<File | null>(null);
  const [sourceApproved, setSourceApproved] = useState(false);
  const [artworkUrl, setArtworkUrl] = useState('');
  const [artworkApproved, setArtworkApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPublication, setShowPublication] = useState(false);
  const source = inventory.sources.find(value => value.id === item.sourceRecord.sourceId);
  const assets = inventory.mediaAssets.filter(value => value.catalogItemId === item.id);
  const managed = assets.find(value => value.kind === 'video' && value.location.type === 'managed_hls');
  const publicArtwork = assets.find(value => value.kind === 'artwork' && value.location.type === 'https' && value.deliveryEligible && value.tvDisplayRights?.status === 'cleared');
  const sourceReady = source?.state === 'verified' && source.permission.retrieval === 'creator_asserted' && source.permission.tvDisplay === 'creator_asserted';
  const ready = !!managed && video?.uploadState === 'verified' && video.processing?.state === 'ready' &&
    managed.tvDisplayRights?.status === 'cleared' && managed.tvPlaybackRights?.status === 'cleared' && managed.deliveryEligible;
  const stableId = `item_${bytesToHex(sha256(new TextEncoder().encode(`catalog-content-v1\0${item.id}`))).slice(0, 32)}`;
  const linked = project.spec.content.some(content => content.id === stableId && content.presentation === 'video');
  const inLive = live?.catalogItemIds.includes(item.id) ?? false;
  const draftAfterLive = inLive && (live?.revisions.channel !== project.revision || live?.revisions.catalog !== inventory.revision);

  useEffect(() => {
    let active = true;
    if (!managed) { setVideo(null); return; }
    const update = () => void readVideoAssetStatus(project.id, managed.id).then(value => { if (active) setVideo(value); })
      .catch(() => { if (active) setVideo(null); });
    update(); const timer = window.setInterval(update, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [project.id, managed?.id]);
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
    return 'Source provenance saved. This does not publish the video.';
  });
  const attachArtwork = () => void act(async () => {
    if (!artworkApproved) throw new Error('Confirm TV display rights for the public artwork.');
    const url = new URL(artworkUrl.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.hostname.includes('.') ||
      /(^|\.)s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname) ||
      (url.origin === window.location.origin && url.pathname.startsWith('/api/')))
      throw new Error('Use a stable public HTTPS artwork URL without credentials, query or fragment.');
    await writeCatalog(project.id, 'media-assets', inventory.revision, { schemaVersion: 1, catalogItemId: item.id,
      kind: 'artwork', location: { type: 'https', url: url.href },
      tvDisplayRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt: new Date().toISOString() },
      tvPlaybackRights: unknown, deliveryEligible: true });
    await refresh(); setArtworkUrl(''); setArtworkApproved(false);
    return 'Public TV artwork attached to this private draft. Review its URL before publication.';
  });
  const linkDraft = () => void act(async () => {
    if (!sourceReady || !publicArtwork || !ready) throw new Error('Resolve source, public artwork, TV rights and verified READY HLS first.');
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
    return `Channel draft revision ${result.project.revision} saved. Review TV Preview and all content before publishing.`;
  });
  return <section className="video-review" aria-label="Video review and publication">
    <h3>Prepare this video for your channel</h3>
    {liveLoaded && <p role="status">{inLive ? `${ready ? 'Published' : 'Referenced but currently blocked'} in live release #${live!.sequence}${draftAfterLive ? ' · newer private draft changes await approval' : ''}` : 'Private draft · this video is not in the current live release.'}</p>}
    {liveError && <p role="alert">Live release status is unavailable. Reopen this video or refresh channel publication before relying on its status.</p>}
    {error && <p role="alert" className="catalog-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <ol className="video-review-steps">
      <li><strong>1. Upload and process</strong><p>{!managed ? 'Choose an MP4 and confirm your rights above.' : video?.uploadState !== 'verified' ? 'Private upload has not been verified.' : video.processing?.state === 'ready' ? 'Verified HLS is READY and still private.' : video.processing?.state === 'failed' ? 'Processing failed. Retry above.' : video.processing?.state === 'revoked' ? 'Video revoked. Replace or resolve rights before review.' : 'Processing is pending. This remains private.'}</p></li>
      <li><strong>2. Review source and TV artwork</strong>
        {!sourceReady && <div><p>Source provenance and retrieval/TV display permission are required before channel generation.</p>
          {source?.type === 'creator_upload' && source.state === 'discovered' && <><label className="field"><span>Private source evidence · PDF, PNG or JPEG</span><input type="file" accept="application/pdf,image/png,image/jpeg" onChange={event => setSourceEvidence(event.target.files?.[0] ?? null)}/></label>
            <label className="check"><input type="checkbox" checked={sourceApproved} onChange={event => setSourceApproved(event.target.checked)}/> I control this upload source and have retrieval and TV display permission.</label>
            <button disabled={busy || !sourceApproved || !sourceEvidence} onClick={verifySource}>Verify source</button></>}
          {(source?.type !== 'creator_upload' || source.state !== 'discovered') && <p>Review this source’s provenance and permission in Catalog before continuing.</p>}</div>}
        {!publicArtwork && <div><p>A private thumbnail is a draft only. Add stable public, rights-cleared TV artwork before publication.</p>
          <label className="field"><span>Public HTTPS artwork URL</span><input type="url" maxLength={2048} value={artworkUrl} onChange={event => setArtworkUrl(event.target.value)}/></label>
          <label className="check"><input type="checkbox" checked={artworkApproved} onChange={event => setArtworkApproved(event.target.checked)}/> I approve public TV display of this artwork.</label>
          <button disabled={busy || !artworkApproved || !artworkUrl.trim()} onClick={attachArtwork}>Attach public artwork</button></div>}
        {sourceReady && publicArtwork && <p>Source permission and public artwork are saved. Final server review checks the exact references.</p>}</li>
      <li><strong>3. Link the channel draft</strong><p>{linked ? `This video appears in channel draft revision ${project.revision}. Review the TV Preview and other content.` : 'A Videos category keeps this item in the library. Adding it regenerates this channel draft with the saved video selection; review the resulting layout and other content before publication.'}</p>
        {!linked && <button disabled={busy || !sourceReady || !publicArtwork || !ready} onClick={linkDraft}>Add to channel draft</button>}
        {managed && !ready && <p>Blocked until verified READY HLS, both TV rights and delivery review are current. {managed.tvDisplayRights?.status === 'revoked' || managed.tvPlaybackRights?.status === 'revoked' ? 'This asset has revoked rights; start a new video draft or resolve the revocation with the operator.' : 'Check the upload status above and rights in Catalog.'}</p>}</li>
      <li><strong>4. Approve and publish the whole channel</strong><p>Current channel revision {project.revision} · catalog revision {inventory.revision}. Publication reviews every channel item, including other videos, audio or writing. Approval and live confirmation are separate. Free TV delivery only; native package export and Appstore submission are separate.</p>
        <button disabled={!linked || !ready || !sourceReady || !publicArtwork} onClick={() => setShowPublication(value => !value)}>{showPublication ? 'Hide channel publication' : 'Review whole channel for publication'}</button>
        {showPublication && <LivePublication key={`${project.revision}:${inventory.revision}`} project={project} hosted onPublished={() => { setLiveError(false); void readDeployment(project.id)
          .then(deployment => readLiveSummary(project.id, deployment.id))
          .then(value => { setLive(value); setLiveLoaded(true); })
          .catch(() => { setLiveLoaded(false); setLiveError(true); }); }}/>}</li>
    </ol>
  </section>;
}
