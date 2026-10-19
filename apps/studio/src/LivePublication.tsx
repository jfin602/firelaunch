import React, { useEffect, useState } from 'react';
import type { ChannelProject, CatalogItem, MediaAsset, PublicationBindings } from '@firelaunch/contracts';
import { ApiError, approveLive, checkLiveReadiness, createDeployment, publishLive, readCatalog, readDeployment, readLiveStatus, readReleaseHistory, readVideoAssetStatus, type CatalogSnapshot, type LiveStatus, type PublicationReview, type ReleaseHistory, type VideoAssetStatus } from './api.js';

type Choice = { catalogItemId: string; artworkAssetId: string; playbackAssetId: string };

export function LivePublication({ project, hosted, onPublished }: { project: ChannelProject; hosted: boolean; onPublished?: () => void }) {
  const [deployment, setDeployment] = useState<Awaited<ReturnType<typeof readDeployment>> | null>(null);
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [history, setHistory] = useState<ReleaseHistory | null>(null);
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [videoStates, setVideoStates] = useState<Record<string, VideoAssetStatus>>({});
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [logoAssetId, setLogoAssetId] = useState('');
  const [heroArtworkAssetId, setHeroArtworkAssetId] = useState('');
  const [approval, setApproval] = useState<{ id: string; review: PublicationReview } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(hosted);
  const [missingDeployment, setMissingDeployment] = useState(false);
  const [newDeployment, setNewDeployment] = useState({ appName: '', packageId: '', manifestEndpoint: '' });
  const [identityApproved, setIdentityApproved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    setApproval(null);
    setError('');
    setLoading(true);
    try {
      const bound = await readDeployment(project.id).catch(reason => {
        if (reason instanceof ApiError && reason.status === 404) {
          setMissingDeployment(true);
          return null;
        }
        throw reason;
      });
      if (!bound) {
        setDeployment(null); setStatus(null); setHistory(null); setCatalog(null); setVideoStates({});
        return;
      }
      const [current, releases, inventory] = await Promise.all([
        readLiveStatus(project.id, bound.id), readReleaseHistory(project.id, bound.id), readCatalog(project.id)
      ]);
      const managed = inventory.mediaAssets.filter(asset => asset.location.type === 'managed_hls');
      const states = await Promise.allSettled(managed.map(asset => readVideoAssetStatus(project.id, asset.id)));
      setVideoStates(Object.fromEntries(states.flatMap((result, index) =>
        result.status === 'fulfilled' ? [[managed[index]!.id, result.value] as const] : [])));
      setDeployment(bound); setStatus(current); setHistory(releases); setCatalog(inventory);
      setMissingDeployment(false);
    } catch (reason) {
      setDeployment(null); setStatus(null); setHistory(null); setCatalog(null); setVideoStates({});
      setError(String(reason));
    } finally { setLoading(false); }
  }
  useEffect(() => {
    if (hosted) void refresh();
    return () => { setApproval(null); };
  }, [project.id, project.revision, hosted]);

  const eligible = (asset: MediaAsset, kind: MediaAsset['kind']) => asset.kind === kind && asset.deliveryEligible &&
    (asset.location.type === 'https' || (kind === 'video' && asset.location.type === 'managed_hls' &&
      videoStates[asset.id]?.uploadState === 'verified' && videoStates[asset.id]?.processing?.state === 'ready')) &&
    (kind === 'artwork' ? asset.tvDisplayRights ?? asset.rights : asset.tvPlaybackRights ?? asset.rights)?.status === 'cleared';
  const assets = catalog?.mediaAssets ?? [];
  const artwork = assets.filter(asset => eligible(asset, 'artwork'));
  const itemById = new Map(catalog?.items.map(item => [item.id, item]) ?? []);
  const options = (item: CatalogItem | undefined, kind: MediaAsset['kind']) => assets.filter(asset => item?.mediaAssetIds.includes(asset.id) && eligible(asset, kind));
  const choiceFor = (contentId: string): Choice => choices[contentId] ?? { catalogItemId: '', artworkAssetId: '', playbackAssetId: '' };
  const missingBindings = project.spec.content.some(content => {
    const choice = choiceFor(content.id);
    const item = itemById.get(choice.catalogItemId);
    return !item || !options(item, 'artwork').some(asset => asset.id === choice.artworkAssetId) ||
      (content.presentation !== 'information' && !options(item, content.presentation === 'audio' ? 'audio' : 'video').some(asset => asset.id === choice.playbackAssetId));
  });
  const update = (contentId: string, field: keyof Choice, value: string) => {
    setApproval(null);
    setChoices(previous => ({ ...previous, [contentId]: { ...choiceFor(contentId), [field]: value, ...(field === 'catalogItemId' ? { artworkAssetId: '', playbackAssetId: '' } : {}) } }));
  };
  const bindings = (): PublicationBindings => ({ content: project.spec.content.map(content => {
    const choice = choiceFor(content.id);
    return { contentId: content.id, catalogItemId: choice.catalogItemId, artworkAssetId: choice.artworkAssetId,
      ...(content.presentation === 'information' ? {} : { playbackAssetId: choice.playbackAssetId }) };
  }), ...(logoAssetId ? { logoAssetId } : {}), ...(heroArtworkAssetId ? { heroArtworkAssetId } : {}) });
  const review = (rollbackSourceReleaseId?: string): PublicationReview => ({
    revisions: { channel: status!.revisions.channel, catalog: status!.revisions.catalog }, expectedLiveReleaseId: status!.liveReleaseId,
    bindings: rollbackSourceReleaseId ? { content: [] } : bindings(), ...(rollbackSourceReleaseId ? { rollbackSourceReleaseId } : {})
  });
  const act = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (reason) {
      setApproval(null);
      setError(`${reason instanceof Error ? reason.message : String(reason)} Review current rights and revisions, refresh, then retry.`);
    } finally { setBusy(false); }
  };
  const approve = (rollbackSourceReleaseId?: string) => void act(async () => {
    if (!deployment || !status || !catalog) return;
    const snapshot = review(rollbackSourceReleaseId);
    await checkLiveReadiness(project.id, deployment.id, snapshot);
    const result = await approveLive(project.id, deployment.id, snapshot);
    setApproval({ id: result.approvalId, review: snapshot });
    setNotice(rollbackSourceReleaseId ? 'Rollback approved, not published. Confirm the new release below.' : 'Draft approved, not live. Confirm publication below.');
  });
  const publish = () => void act(async () => {
    if (!deployment || !approval || !status) return;
    for (const binding of approval.review.bindings.content) {
      const selected = catalog?.mediaAssets.find(asset => asset.id === binding.playbackAssetId);
      if (selected?.location.type === 'managed_hls') {
        const latest = await readVideoAssetStatus(project.id, selected.id);
        if (latest?.uploadState !== 'verified' || latest.processing?.state !== 'ready')
          throw new Error('Managed video is no longer verified and ready. Refresh publication review.');
      }
    }
    if (status.revisions.channel !== approval.review.revisions.channel || status.revisions.catalog !== approval.review.revisions.catalog || status.liveReleaseId !== approval.review.expectedLiveReleaseId) {
      throw new Error('Approval is stale. Refresh and approve again.');
    }
    if (!window.confirm(`Publish ${approval.review.rollbackSourceReleaseId ? 'a new rollback release' : 'this approved FREE channel draft'} to live TV? This replaces the whole live channel with ${project.spec.content.length} reviewed content item(s) at channel revision ${approval.review.revisions.channel} and catalog revision ${approval.review.revisions.catalog}. Native build and Appstore submission are separate.`)) return;
    const result = await publishLive(project.id, deployment.id, approval.id);
    await refresh();
    onPublished?.();
    setNotice(`Live release #${result.sequence} published. Native build and Appstore submission remain separate.`);
  });
  const setupDeployment = () => void act(async () => {
    if (!identityApproved) throw new Error('Approve this channel’s immutable app identity first.');
    await createDeployment(project.id, { appName: newDeployment.appName.trim(),
      packageId: newDeployment.packageId.trim(), manifestEndpoint: newDeployment.manifestEndpoint.trim(),
      nativeReleaseApproval: 'creator_approved' });
    await refresh();
    setNotice('Creator-owned deployment recorded. Review rights and draft content before approval.');
  });

  if (!hosted) return <p>Live publication requires an authenticated creator deployment. Local Build and store handoff remain separate.</p>;
  return <section aria-label="Live channel publication" className="delivery">
    <h2>Draft vs Live</h2><p className="muted">Preview and edits remain private drafts. Live content requires separate creator approval and publication; neither Generate nor Build publishes.</p>
    <button disabled={busy || loading} onClick={() => void refresh()}>Refresh live state and rights</button>
    {loading && <p role="status">Loading owned release state…</p>}
    {error && <p role="alert" className="delivery-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {missingDeployment && !loading && <div className="delivery-setup"><h3>Set up this channel’s live identity</h3>
      <p>Use a creator-owned package ID and a separate public-only HTTPS manifest origin. This identity is immutable; creating it does not publish content or submit an app.</p>
      <label className="field"><span>APP NAME</span><input maxLength={120} value={newDeployment.appName} onChange={event => setNewDeployment({ ...newDeployment, appName: event.target.value })}/></label>
      <label className="field"><span>PACKAGE ID</span><input placeholder="com.creator.channel" value={newDeployment.packageId} onChange={event => setNewDeployment({ ...newDeployment, packageId: event.target.value })}/></label>
      <label className="field"><span>PUBLIC-ONLY MANIFEST ORIGIN</span><input type="url" placeholder="https://tv.example.com/" value={newDeployment.manifestEndpoint} onChange={event => setNewDeployment({ ...newDeployment, manifestEndpoint: event.target.value })}/></label>
      <label className="check"><input type="checkbox" checked={identityApproved} onChange={event => setIdentityApproved(event.target.checked)}/> I approve this app identity and resolver origin for my channel.</label>
      <button disabled={busy || !identityApproved || !newDeployment.appName.trim() || !newDeployment.packageId.trim() || !newDeployment.manifestEndpoint.trim()} onClick={setupDeployment}>Create owned deployment</button>
    </div>}
    {deployment && status && catalog && history && <>
      <p>Draft revision {project.revision} · catalog revision {catalog.revision}. Live: {history.liveReleaseId ? `release #${status.liveSequence} (${history.liveReleaseId})` : 'none'}.</p>
      <p>This review replaces the whole live channel: {project.spec.content.length} content item(s){project.spec.content.length ? ` — ${project.spec.content.map(content => content.title).join(', ')}` : ''}. Changes to any item, rights or channel layout require a fresh approval. Free delivery only.</p>
      {project.revision !== status.revisions.channel || catalog.revision !== status.revisions.catalog ? <p role="alert">Draft changed elsewhere. Refresh before approval.</p> : null}
      <p>Deployment: {deployment.appName} · {deployment.packageId}. Changes to the native package require a separate qualified build.</p>
      <h3>Review TV content bindings</h3><p>Choose owned catalog items and rights-cleared artwork and playback. Managed video appears only after verified upload and ready HLS processing. Uploading, failed, revoked, or unverified media blocks approval. Server readiness also checks that the draft URL matches the verified CloudFront master. Writing may be informational without playback.</p>
      {project.spec.content.map(content => {
        const choice = choiceFor(content.id);
        const item = itemById.get(choice.catalogItemId);
        const playable = content.presentation !== 'information';
        return <fieldset key={content.id}><legend>{content.title} · {content.presentation ?? 'video'}</legend>
          <label className="field"><span>Reviewed catalog item</span><select value={choice.catalogItemId} onChange={event => update(content.id, 'catalogItemId', event.target.value)}><option value="">Select item</option>{catalog.items.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.creatorOverrides?.title ?? candidate.sourceRecord.metadata.title} · {candidate.id}</option>)}</select></label>
          <label className="field"><span>TV display artwork</span><select value={choice.artworkAssetId} onChange={event => update(content.id, 'artworkAssetId', event.target.value)}><option value="">Select rights-cleared artwork</option>{options(item, 'artwork').map(asset => <option key={asset.id} value={asset.id}>{asset.id}</option>)}</select></label>
          {playable && <label className="field"><span>TV playback {content.presentation === 'audio' ? 'audio' : 'video'}</span><select value={choice.playbackAssetId} onChange={event => update(content.id, 'playbackAssetId', event.target.value)}><option value="">Select rights-cleared playback</option>{options(item, content.presentation === 'audio' ? 'audio' : 'video').map(asset => <option key={asset.id} value={asset.id}>{asset.id}</option>)}</select></label>}
        </fieldset>;
      })}
      {!!project.spec.brand.logo && <label className="field"><span>Logo artwork</span><select value={logoAssetId} onChange={event => { setLogoAssetId(event.target.value); setApproval(null); }}><option value="">Select rights-cleared artwork</option>{artwork.map(asset => <option key={asset.id} value={asset.id}>{asset.id}</option>)}</select></label>}
      {!!project.spec.brand.heroArtwork && <label className="field"><span>Hero artwork</span><select value={heroArtworkAssetId} onChange={event => { setHeroArtworkAssetId(event.target.value); setApproval(null); }}><option value="">Select rights-cleared artwork</option>{artwork.map(asset => <option key={asset.id} value={asset.id}>{asset.id}</option>)}</select></label>}
      {(!project.spec.content.length || missingBindings || (!!project.spec.brand.logo && !logoAssetId) || (!!project.spec.brand.heroArtwork && !heroArtworkAssetId)) && <p role="status">Draft blocked: select reviewed items and eligible public, rights-cleared artwork{project.spec.content.some(content => content.presentation !== 'information') ? ' and playback media' : ''}. Server readiness also checks current rights and exact URL bindings.</p>}
      <button disabled={busy || !!approval || project.revision !== status.revisions.channel || catalog.revision !== status.revisions.catalog || !project.spec.content.length || missingBindings || (!!project.spec.brand.logo && !logoAssetId) || (!!project.spec.brand.heroArtwork && !heroArtworkAssetId)} onClick={() => approve()}>Approve draft for live review</button>
      {approval && <button className="primary" disabled={busy} onClick={publish}>Confirm publish approved {approval.review.rollbackSourceReleaseId ? 'rollback' : 'draft'}</button>}
      <h3>Release history</h3>
      {!history.releases.length && <p>No live releases yet.</p>}
      <ul>{history.releases.map(release => <li key={release.id}>#{release.sequence} · {release.publishedAt} · SHA-256 <code>{release.sha256}</code> {release.id === history.liveReleaseId ? '· LIVE' : <button disabled={busy || !!approval} onClick={() => approve(release.id)}>Approve rollback to #{release.sequence}</button>}{release.rollbackSourceReleaseId && ' · rollback release'}</li>)}</ul>
    </>}
  </section>;
}
