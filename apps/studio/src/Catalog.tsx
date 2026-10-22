import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CatalogItem, Collection, MediaAsset, ChannelProject } from '@firelaunch/contracts';
import { ApiError, approveCatalogImport, deletePrivateObject, generateCatalogDraft, getProject, previewCatalogImport, readCatalog, readCatalogDraft, readVideoAssetStatus, revokeVideoAsset, uploadPrivateEvidence, uploadPrivateMedia, writeCatalog, type CatalogSelection, type CatalogSnapshot, type DraftChanges, type ImportPreview, type VideoAssetStatus } from './api.js';
import { VideoLibraryStatus } from './VideoUpload.js';
import { safeArtwork } from './artwork-url.js';
import { OwnedArtwork, ownedArtworkObject } from './OwnedArtwork.js';

type CreatorType = 'video' | 'audio' | 'writing';
type SourceType = 'creator_csv' | 'creator_json' | 'creator_https_feed' | 'creator_upload';
const emptyRights = { status: 'unknown' as const, basis: 'none' as const, permittedUse: 'none' as const };
const sourceLabel: Record<SourceType, string> = { creator_csv: 'CSV file', creator_json: 'JSON file', creator_https_feed: 'HTTPS feed snapshot', creator_upload: 'Manual first item' };
const kindFor = (creator: CreatorType): CatalogItem['kind'] => creator === 'writing' ? 'book' : creator;
const collectionFor = (creator: CreatorType): Collection['kind'] => creator === 'writing' ? 'bookshelf' : creator === 'audio' ? 'album' : 'series';
const draftSource = (type: SourceType, endpointUrl: string) => ({ schemaVersion: 1, type, state: 'discovered', ...(type === 'creator_https_feed' ? { endpointUrl } : {}), permission: { retrieval: type === 'creator_https_feed' ? 'creator_asserted' : 'unknown', tvDisplay: 'unknown' } });
const errorText = (reason: unknown): string => reason instanceof ApiError && reason.status === 409 ? 'Catalog or channel changed in another tab. Latest revision loaded; review and retry.' : reason instanceof Error ? reason.message : String(reason);

export function Catalog({ project, projectId: legacyProjectId, accountId, hosted, libraryRevision = 0, onGenerated, onSelectionRestored, onRefine, onOpenVideo, onOpenAudio, onOpenBook, onCatalogChange, initialSelection, initialCreator = 'video' }: { project?: ChannelProject; projectId?: string; accountId?: string; hosted: boolean; libraryRevision?: number; onGenerated?: (project: ChannelProject, selection: CatalogSelection, creator: CreatorType) => void; onSelectionRestored?: (selection: CatalogSelection, creator: CreatorType) => void; onRefine?: () => void; onOpenVideo?: (itemId?: string) => void; onOpenAudio?: (itemId?: string) => void; onOpenBook?: (itemId?: string) => void; onCatalogChange?: () => void; initialSelection?: CatalogSelection; initialCreator?: CreatorType }) {
  const projectId = project?.id ?? legacyProjectId!;
  const [inventory, setInventory] = useState<CatalogSnapshot | null>(null);
  const [creator, setCreator] = useState<CreatorType>(initialCreator);
  const [sourceType, setSourceType] = useState<SourceType>('creator_csv');
  const [endpoint, setEndpoint] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [content, setContent] = useState('');
  const [contentSourceId, setContentSourceId] = useState('');
  const fileReadVersion = useRef(0);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [manual, setManual] = useState({ externalId: '', title: '', description: '' });
  const [override, setOverride] = useState({ title: '', description: '', artworkUrl: '' });
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionKind, setCollectionKind] = useState<Collection['kind']>('series');
  const [collectionId, setCollectionId] = useState('');
  const [mediaUse, setMediaUse] = useState<'artwork' | 'audio'>('artwork');
  const [display, setDisplay] = useState(false);
  const [playback, setPlayback] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [publicArtworkUrl, setPublicArtworkUrl] = useState('');
  const [publicArtworkApproved, setPublicArtworkApproved] = useState(false);
  const [sourceEvidence, setSourceEvidence] = useState<File | null>(null);
  const [sourceApproved, setSourceApproved] = useState(false);
  const [videoStates, setVideoStates] = useState<Record<string, VideoAssetStatus>>({});
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [draftItemIds, setDraftItemIds] = useState<string[]>(initialSelection?.itemIds ?? []);
  const [draftCollectionIds, setDraftCollectionIds] = useState<string[]>(initialSelection?.collectionIds ?? []);
  const [changes, setChanges] = useState<DraftChanges | null>(null);
  const selected = inventory?.items.find(item => item.id === selectedId);
  const selectedSource = inventory?.sources.find(value => value.id === selected?.sourceRecord.sourceId);
  const source = inventory?.sources.find(item => item.id === sourceId);
  const activeCollection = inventory?.collections.find(item => item.id === collectionId);
  const assets = inventory?.mediaAssets.filter(asset => asset.catalogItemId === selectedId) ?? [];
  const managedVideo = assets.find(asset => asset.kind === 'video' && asset.location.type === 'managed_hls');
  const chosenItems = inventory?.items.filter(item => draftItemIds.includes(item.id) || inventory.collections.some(collection => draftCollectionIds.includes(collection.id) && collection.itemIds.includes(item.id))) ?? [];
  const matchingItems = chosenItems.filter(item => creator === 'writing' ? ['book', 'audio', 'video'].includes(item.kind) : item.kind === creator);
  const missingMedia = matchingItems.filter(item => item.kind !== 'book' && !inventory?.mediaAssets.some(asset =>
    item.mediaAssetIds.includes(asset.id) && asset.kind === item.kind && asset.deliveryEligible &&
    asset.tvPlaybackRights?.status === 'cleared' && (asset.location.type === 'https' && !new URL(asset.location.url).search ||
      asset.kind === 'video' && asset.location.type === 'managed_hls' && asset.tvDisplayRights?.status === 'cleared' &&
      videoStates[asset.id]?.uploadState === 'verified' && videoStates[asset.id]?.processing?.state === 'ready')));
  const generate = () => void run(async () => {
    if (!project || !inventory) throw new Error('Open a saved hosted channel first.');
    const selection = { expectedCatalogRevision: inventory.revision, itemIds: draftItemIds, collectionIds: draftCollectionIds };
    try {
      const result = await generateCatalogDraft(project, creator, selection);
      setChanges(result.changes); onGenerated?.(result.project, selection, creator);
      return `Draft saved at revision ${result.project.revision}. Review the difference and TV Preview.`;
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        const fresh = await getProject(project.id);
        onGenerated?.(fresh, selection, creator);
      }
      throw reason;
    }
  });
  const owns = (data: CatalogSnapshot) => data.projectId === projectId && (!accountId || data.creatorAccountId === accountId) &&
    [...data.sources, ...data.items, ...data.collections, ...data.mediaAssets].every(value => value.projectId === projectId && value.creatorAccountId === data.creatorAccountId);
  const refresh = async () => { const data = await readCatalog(projectId); if (!owns(data)) throw new Error('Catalog is unavailable for this account.'); setInventory(data); onCatalogChange?.(); return data; };
  useEffect(() => {
    if (!hosted) return;
    let alive = true;
    void readCatalog(projectId).then(data => { if (!owns(data)) throw new Error('Catalog is unavailable for this account.'); if (alive) { setInventory(data); setError(''); } }).catch(reason => { if (alive) { setInventory(null); setError(errorText(reason)); } });
    return () => { alive = false; };
  }, [projectId, accountId, hosted, libraryRevision]);
  useEffect(() => {
    if (!hosted || !inventory) return;
    let alive = true;
    const managed = inventory.mediaAssets.filter(asset => asset.location.type === 'managed_hls');
    void Promise.allSettled(managed.map(asset => readVideoAssetStatus(projectId, asset.id)))
      .then(results => {
        if (!alive) return;
        setVideoStates(Object.fromEntries(results.flatMap((result, index) =>
          result.status === 'fulfilled' ? [[managed[index]!.id, result.value] as const] : [])));
      });
    return () => { alive = false; };
  }, [projectId, hosted, inventory?.revision]);
  useEffect(() => {
    if (!project || initialSelection) return;
    let alive = true;
    void readCatalogDraft(project.id).then(draft => { if (alive && draft) { setCreator(draft.creatorType); setDraftItemIds(draft.selection.itemIds); setDraftCollectionIds(draft.selection.collectionIds); onSelectionRestored?.(draft.selection, draft.creatorType); } })
      .catch(reason => { if (alive) setError(errorText(reason)); });
    return () => { alive = false; };
  }, [projectId, hosted]);
  useEffect(() => { setOverride({ title: selected?.creatorOverrides?.title ?? '', description: selected?.creatorOverrides?.description ?? '', artworkUrl: selected?.creatorOverrides?.artworkUrl ?? '' }); }, [selectedId, inventory?.revision]);
  const run = async (action: () => Promise<string>) => {
    setWorking(true); setError(''); setMessage('');
    try { setMessage(await action()); }
    catch (reason) { setError(errorText(reason)); if (reason instanceof ApiError && reason.status === 409) await refresh().catch(() => undefined); }
    finally { setWorking(false); }
  };
  const addSource = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    const result = await writeCatalog(projectId, 'sources', inventory!.revision, draftSource(sourceType, endpoint));
    await refresh(); fileReadVersion.current++; setSourceId(result.record.id); setContent(''); setContentSourceId(''); setPreview(null);
    return `${sourceLabel[sourceType]} source added. ${sourceType === 'creator_https_feed' ? 'Retrieval permission asserted for this one-time snapshot.' : 'Import still needs preview and approval.'}`;
  }); };
  const readFile = (file: File | undefined) => { if (!file || !source) return; const version = ++fileReadVersion.current; setContent(''); setContentSourceId(''); setPreview(null); if (file.size > 512_000) { setError('Catalog file exceeds 512 KB.'); return; } const selectedSourceId = source.id; void file.text().then(value => { if (version !== fileReadVersion.current) return; setContent(value); setContentSourceId(selectedSourceId); setError(''); }).catch(reason => { if (version === fileReadVersion.current) setError(errorText(reason)); }); };
  const showPreview = () => void run(async () => {
    if (!source) throw new Error('Select a source first.');
    const format = source.type === 'creator_csv' ? 'csv' : source.type === 'creator_json' ? 'json' : 'feed';
    if (format !== 'feed' && contentSourceId !== source.id) throw new Error('Choose a file for the selected source.');
    const result = await previewCatalogImport(projectId, source.id, format, format === 'feed' ? undefined : content);
    setPreview(result);
    return result.issues.length ? `Preview found ${result.issues.length} issue(s). Correct the input before approval.` : `Preview ready: ${result.rows.length} item(s). Review actions before approval.`;
  });
  const approve = () => void run(async () => {
    if (!preview || preview.issues.length) throw new Error('Resolve preview issues before approval.');
    const result = await approveCatalogImport(projectId, preview, preview.content ?? content);
    setPreview(null); await refresh();
    return `Approved source snapshot: ${result.created} new, ${result.updated} updated, ${result.unchanged} unchanged. Items remain draft inventory.`;
  });
  const addManual = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    if (source?.type !== 'creator_upload') throw new Error('Choose a manual source.');
    const identifier = { provider: 'creator' as const, kind: 'feed_item_id' as const, value: manual.externalId.trim() };
    const result = await writeCatalog(projectId, 'items', inventory!.revision, { schemaVersion: 1, kind: kindFor(creator), sourceRecord: { sourceId: source.id, externalId: identifier, observedAt: new Date().toISOString(), metadata: { title: manual.title.trim(), ...(manual.description && { description: manual.description }) } }, externalIdentifiers: [identifier], mediaAssetIds: [] });
    await refresh(); setSelectedId(result.record.id); setManual({ externalId: '', title: '', description: '' });
    return 'Manual item saved as draft inventory. Add media and review rights separately.';
  }); };
  const saveOverride = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    if (!selected) throw new Error('Select an item.');
    const { id, creatorAccountId, projectId: _projectId, ...record } = selected;
    await writeCatalog(projectId, 'items', inventory!.revision, { ...record, creatorOverrides: { ...(override.title.trim() ? { title: override.title.trim() } : {}), ...(override.description.trim() ? { description: override.description.trim() } : {}), ...(override.artworkUrl.trim() ? { artworkUrl: override.artworkUrl.trim() } : {}), editedAt: new Date().toISOString() } }, id);
    await refresh(); return 'Creator override saved; original source values remain available.';
  }); };
  const addCollection = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    const result = await writeCatalog(projectId, 'collections', inventory!.revision, { schemaVersion: 1, kind: collectionKind, title: collectionTitle.trim(), itemIds: selected ? [selected.id] : [] });
    await refresh(); setCollectionTitle(''); setCollectionId(result.record.id); return 'Collection saved as draft curation.';
  }); };
  const toggleCollection = () => void run(async () => {
    if (!activeCollection || !selected) throw new Error('Select a Collection and item.');
    const { id, creatorAccountId, projectId: _projectId, ...record } = activeCollection;
    const itemIds = record.itemIds.includes(selected.id) ? record.itemIds.filter(value => value !== selected.id) : [...record.itemIds, selected.id];
    await writeCatalog(projectId, 'collections', inventory!.revision, { ...record, itemIds }, id);
    await refresh(); return 'Collection membership saved.';
  });
  const attachMedia = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    if (!selected || !mediaFile) throw new Error('Select an item and media file.');
    const expected = mediaUse === 'artwork' ? ['image/png', 'image/jpeg'] : ['audio/mpeg'];
    if (!expected.includes(mediaFile.type)) throw new Error(`Choose a ${mediaUse} file with a supported type.`);
    const uploaded = await uploadPrivateMedia(projectId, mediaFile);
    const assertedAt = new Date().toISOString();
    const rights = (use: 'television_display' | 'television_playback', cleared: boolean) => cleared ? { status: 'cleared', basis: 'creator_asserted', permittedUse: use, assertedAt } : emptyRights;
    try {
      await writeCatalog(projectId, 'media-assets', inventory!.revision, { schemaVersion: 1, catalogItemId: selected.id, kind: mediaUse, location: { type: 'private_object', objectId: uploaded.id }, tvDisplayRights: rights('television_display', display), tvPlaybackRights: rights('television_playback', playback), deliveryEligible: false });
    } catch (reason) {
      try { await deletePrivateObject(projectId, uploaded.id); }
      catch { throw new Error(`Attachment failed and private object ${uploaded.id} needs cleanup: ${errorText(reason)}`); }
      throw reason;
    }
    await refresh(); setMediaFile(null); setDisplay(false); setPlayback(false);
    return 'Private media attached with separate TV rights claims. Delivery remains disabled pending later publishing review.';
  }); };
  const attachPublicArtwork = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    if (!selected || !inventory || !publicArtworkApproved) throw new Error('Select an item and approve its TV display rights.');
    const url = new URL(publicArtworkUrl.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !url.hostname.includes('.') || /(^|\.)s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname) ||
      (url.origin === window.location.origin && url.pathname.startsWith('/api/')))
      throw new Error('Use a stable public HTTPS artwork URL without credentials, query or fragment.');
    const assertedAt = new Date().toISOString();
    await writeCatalog(projectId, 'media-assets', inventory.revision, { schemaVersion: 1,
      catalogItemId: selected.id, kind: 'artwork', location: { type: 'https', url: url.href },
      tvDisplayRights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_display', assertedAt },
      tvPlaybackRights: emptyRights, deliveryEligible: true });
    await refresh(); setPublicArtworkUrl(''); setPublicArtworkApproved(false);
    return 'Public artwork attached with creator-asserted TV display rights. Review it before live publication.';
  }); };
  const approveManagedVideo = () => void run(async () => {
    if (!inventory || !selected || !managedVideo || managedVideo.catalogItemId !== selected.id ||
      managedVideo.location.type !== 'managed_hls' ||
      managedVideo.tvDisplayRights?.status !== 'cleared' || managedVideo.tvPlaybackRights?.status !== 'cleared' ||
      videoStates[managedVideo.id]?.uploadState !== 'verified' || videoStates[managedVideo.id]?.processing?.state !== 'ready')
      throw new Error('Verified READY HLS and both cleared TV rights are required. Refresh the video state.');
    const { id, creatorAccountId: _owner, projectId: _project, ...record } = managedVideo;
    await writeCatalog(projectId, 'media-assets', inventory.revision, { ...record, deliveryEligible: true }, id);
    await refresh();
    return 'Managed video approved for delivery review. It remains private until a separate live publication.';
  });
  const revokeManagedVideo = () => {
    if (!selected || !managedVideo || managedVideo.catalogItemId !== selected.id ||
      !window.confirm(`Revoke ${selected.creatorOverrides?.title ?? selected.sourceRecord.metadata.title}? Live release access will stop. CDN cleanup still requires the operator.`)) return;
    void run(async () => {
      await revokeVideoAsset(projectId, managedVideo.id);
      await refresh();
      const status = await readVideoAssetStatus(projectId, managedVideo.id);
      setVideoStates(previous => ({ ...previous, [managedVideo.id]: status }));
      return 'Video revoked. Live release access is denied; operator CDN cleanup remains required.';
    });
  };
  const verifyCreatorSource = () => void run(async () => {
    if (!selectedSource || selectedSource.type !== 'creator_upload' || selectedSource.state !== 'discovered' ||
      !sourceApproved || !sourceEvidence) throw new Error('Review the creator-upload source and attach provenance evidence.');
    const uploaded = await uploadPrivateEvidence(projectId, sourceEvidence);
    const { id, creatorAccountId: _owner, projectId: _project, ...record } = selectedSource;
    try {
      await writeCatalog(projectId, 'sources', inventory!.revision, { ...record, state: 'verified',
        permission: { retrieval: 'creator_asserted', tvDisplay: 'creator_asserted',
          verificationEvidenceId: uploaded.id } }, id);
    } catch (reason) {
      try { await deletePrivateObject(projectId, uploaded.id); } catch { /* Preserve the original write error. */ }
      throw reason;
    }
    await refresh(); setSourceEvidence(null); setSourceApproved(false);
    return 'Creator-upload source verified with private provenance evidence. Every item still needs its own rights, READY media and publication approval.';
  });
  const setAssetRights = (asset: MediaAsset, use: 'television_display' | 'television_playback', cleared: boolean) => void run(async () => {
    const { id, creatorAccountId, projectId: _projectId, ...record } = asset;
    const claim = cleared ? { status: 'cleared' as const, basis: 'creator_asserted' as const, permittedUse: use, assertedAt: new Date().toISOString() } : { ...emptyRights, status: 'revoked' as const };
    const key = use === 'television_display' ? 'tvDisplayRights' : 'tvPlaybackRights';
    await writeCatalog(projectId, 'media-assets', inventory!.revision, { ...record, [key]: claim, deliveryEligible: false }, id);
    await refresh(); return `${use === 'television_display' ? 'Display' : 'Playback'} rights ${cleared ? 'asserted' : 'revoked'}; delivery remains disabled.`;
  });
  if (!hosted) return <div className="panel-content"><h2>Catalog needs a hosted account.</h2><p>Local channels still support the Create, Design, Content, Code, Build and Preview workflow.</p></div>;
  return <div className="panel-content catalog-panel"><span className="eyebrow">CATALOG / PRIVATE DRAFT</span><h2>Build your channel library.</h2><p>Add owned video or audio, then review it here. Other catalog sources and library tools are available below.</p>
    {error && <p role="alert" className="catalog-error">{error}</p>}{message && <p role="status" className="catalog-status">{message}</p>}{!inventory ? <p>Loading catalog…</p> : <>
    <div className="catalog-upload-entry"><div><strong>Your video library</strong><p>Add an owned MP4 as a private channel draft.</p></div><button className="primary" type="button" onClick={() => onOpenVideo?.()}>Add Video</button></div>
    <div className="catalog-upload-entry"><div><strong>Your audio library</strong><p>Add an owned MP3 with cover and separate rights as a private draft.</p></div><button className="primary" type="button" onClick={() => onOpenAudio?.()}>Add Audio</button></div>
    <div className="catalog-upload-entry"><div><strong>Your bookshelf</strong><p>Add an owned book with a portrait cover and optional MP3 audiobook.</p></div><button className="primary" type="button" onClick={() => onOpenBook?.()}>Add Book</button></div>
    <details className="catalog-management" open={creator !== 'video'}><summary>Import or enter other catalog content</summary><div className="section-label">01 / CREATOR & SOURCE</div><label className="field"><span>CREATOR TYPE</span><select aria-label="Creator type" value={creator} onChange={event => { const value = event.target.value as CreatorType; setCreator(value); setCollectionKind(collectionFor(value)); }}><option value="video">Video</option><option value="audio">Audio</option><option value="writing">Writing</option></select></label>
    <form onSubmit={addSource}><label className="field"><span>NEW SOURCE</span><select aria-label="New source" value={sourceType} onChange={event => setSourceType(event.target.value as SourceType)}>{Object.entries(sourceLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{sourceType === 'creator_https_feed' && <label className="field"><span>PUBLIC HTTPS FEED URL</span><input type="url" required value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://example.com/feed.json" /></label>}<button disabled={working}>Add source</button></form>
    <label className="field"><span>SELECT SOURCE</span><select aria-label="Select source" value={sourceId} onChange={event => { fileReadVersion.current++; setSourceId(event.target.value); setContent(''); setContentSourceId(''); setPreview(null); }}><option value="">Choose a source</option>{inventory.sources.filter(value => ['creator_csv', 'creator_json', 'creator_https_feed', 'creator_upload'].includes(value.type)).map(value => <option key={value.id} value={value.id}>{sourceLabel[value.type as SourceType]} · {value.endpointUrl ?? value.id.slice(-8)}</option>)}</select></label>
    {source && source.type !== 'creator_upload' && <><div className="section-label">02 / PREVIEW & APPROVE</div>{source.type !== 'creator_https_feed' && <label className="field"><span>CATALOG FILE · {source.type === 'creator_csv' ? 'CSV' : 'JSON'} · MAX 512 KB</span><input key={source.id} type="file" accept={source.type === 'creator_csv' ? '.csv,text/csv' : '.json,application/json'} onChange={event => readFile(event.target.files?.[0])} /></label>}<p>Import requires stable externalId, kind and title. New rows, duplicates and malformed records are shown before approval.</p><button disabled={working || (source.type !== 'creator_https_feed' && (!content || contentSourceId !== source.id))} onClick={showPreview}>Preview import</button>{preview && preview.sourceId === source.id && <div className="catalog-preview"><strong>{preview.rows.length} rows · {preview.issues.length} issues</strong><ul>{preview.rows.map(row => <li key={`${row.line}:${row.externalId}`}>Line {row.line}: {row.action} · {row.kind} · {row.metadata.title}</li>)}{preview.issues.map(issue => <li key={`${issue.line}:${issue.code}`} className="catalog-error">Line {issue.line}: {issue.code} · {issue.message}</li>)}</ul><button className="primary" disabled={working || preview.issues.length > 0} onClick={approve}>Approve snapshot</button></div>}</>}
    {source?.type === 'creator_upload' && <><div className="section-label">02 / FIRST ITEM</div><form onSubmit={addManual}><label className="field"><span>YOUR STABLE ITEM ID</span><input required pattern="[A-Za-z0-9][A-Za-z0-9._:-]*" maxLength={128} value={manual.externalId} onChange={event => setManual({ ...manual, externalId: event.target.value })}/></label><label className="field"><span>TITLE</span><input required maxLength={160} value={manual.title} onChange={event => setManual({ ...manual, title: event.target.value })}/></label><label className="field"><span>DESCRIPTION</span><textarea maxLength={4000} value={manual.description} onChange={event => setManual({ ...manual, description: event.target.value })}/></label><button className="primary" disabled={working}>Save draft item</button></form></>}
    </details><div className="section-label">03 / CONTENT LIBRARY</div><p>{inventory.items.length} draft item(s). Books and listings can remain nonplayable inventory.</p>
    <div className="catalog-library">{inventory.items.map(item => { const asset = inventory.mediaAssets.find(value => value.catalogItemId === item.id && value.kind === item.kind && (item.kind !== 'video' || value.location.type === 'managed_hls')); const selectedPrivateObject = ownedArtworkObject(item, inventory.mediaAssets, projectId, accountId ?? null); const artworkAsset = selectedPrivateObject ? inventory.mediaAssets.find(value => value.catalogItemId === item.id && value.projectId === projectId && value.creatorAccountId === accountId && item.mediaAssetIds.includes(value.id) && value.kind === 'artwork' && value.location.type === 'private_object' && value.location.objectId === selectedPrivateObject) : [...item.mediaAssetIds].reverse().map(id => inventory.mediaAssets.find(value => value.id === id && value.catalogItemId === item.id && value.kind === 'artwork')).find(value => !!value && value.tvDisplayRights?.status !== 'revoked'); const collection = inventory.collections.find(value => value.itemIds.includes(item.id)); const title = item.creatorOverrides?.title ?? item.sourceRecord.metadata.title; const bookAudio = inventory.mediaAssets.find(value => value.id === item.audiobook?.audioAssetId && value.catalogItemId === item.id); return <button type="button" className={`catalog-library-item${selectedId === item.id ? ' selected' : ''}`} key={item.id} onClick={() => { setSelectedId(item.id); if (item.kind === 'video') onOpenVideo?.(item.id); if (item.kind === 'audio') onOpenAudio?.(item.id); if (item.kind === 'book') onOpenBook?.(item.id); }} aria-label={`Select ${title} · ${item.kind}`}><OwnedArtwork item={item} assets={inventory.mediaAssets} projectId={projectId} accountId={accountId ?? null} className={`catalog-library-art catalog-library-art-${item.kind}`} fallback={<span className="catalog-library-art-fallback" aria-label="Artwork unavailable">{item.kind === 'video' ? '▣' : item.kind === 'audio' ? '♫' : '◇'}</span>}/><span className="catalog-library-copy"><strong>{title}</strong><small>{item.kind} · {collection?.title ?? 'No Collection'}</small><small>{artworkAsset?.location.type === 'private_object' ? artworkAsset.tvDisplayRights?.status !== 'cleared' ? 'Private artwork saved · TV display rights need review' : artworkAsset.deliveryEligible ? 'Artwork approved for TV delivery · live publication separate' : 'Private artwork saved · delivery approval required' : safeArtwork(item) ? 'Creator/source artwork · review display rights' : 'Artwork needs review · placeholder'}</small><small>{item.kind === 'video' ? <VideoLibraryStatus key={`${item.id}:${inventory.revision}`} projectId={projectId} assetId={asset?.id}/> : item.kind === 'audio' ? asset?.location.type === 'private_object' ? 'MP3 uploaded privately · delivery blocked' : 'Audio draft · no MP3 uploaded' : item.kind === 'book' ? bookAudio ? `Audiobook attached · playback ${bookAudio.tvPlaybackRights?.status ?? 'unknown'} · delivery blocked` : 'Book showcase · no Play' : 'Informational · no playback'}</small><small>{asset ? `${item.kind === 'audio' ? 'Audio' : 'Video'} rights: display ${asset.tvDisplayRights?.status ?? 'unknown'} · playback ${asset.tvPlaybackRights?.status ?? 'unknown'}` : artworkAsset ? `Artwork display ${artworkAsset.tvDisplayRights?.status ?? 'unknown'} · ${item.kind === 'book' && bookAudio ? 'audiobook attached' : 'no playback'}` : 'TV rights need review'}</small>{(item.kind === 'video' || item.kind === 'audio' || item.kind === 'book') && <small className="video-card-action">Open {item.kind} →</small>}</span></button>; })}</div>
    <label className="field"><span>SELECT ITEM</span><select aria-label="Select catalog item" value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">Choose an item</option>{inventory.items.map(item => <option key={item.id} value={item.id}>{item.creatorOverrides?.title ?? item.sourceRecord.metadata.title} · {item.kind}</option>)}</select></label>
    {selected && <details className="catalog-management"><summary>Edit selected item metadata</summary><p><strong>Source:</strong> {selected.sourceRecord.metadata.title}<br/><strong>External ID:</strong> {selected.sourceRecord.externalId.value}<br/><strong>Kind:</strong> {selected.kind}</p><form onSubmit={saveOverride}><label className="field"><span>CREATOR TITLE OVERRIDE</span><input maxLength={160} value={override.title} onChange={event => setOverride({ ...override, title: event.target.value })} placeholder={selected.sourceRecord.metadata.title}/></label><label className="field"><span>CREATOR DESCRIPTION OVERRIDE</span><textarea maxLength={4000} value={override.description} onChange={event => setOverride({ ...override, description: event.target.value })}/></label><label className="field"><span>CREATOR ARTWORK URL OVERRIDE</span><input type="url" maxLength={2048} value={override.artworkUrl} onChange={event => setOverride({ ...override, artworkUrl: event.target.value })} placeholder="https://example.com/cover.jpg"/></label><button disabled={working || (!override.title.trim() && !override.description.trim() && !override.artworkUrl.trim())}>Save override</button></form></details>}
    <details className="catalog-management"><summary>Manage collections (optional)</summary><div className="section-label">04 / COLLECTIONS</div><form onSubmit={addCollection}><label className="field"><span>COLLECTION NAME</span><input required maxLength={160} value={collectionTitle} onChange={event => setCollectionTitle(event.target.value)}/></label><label className="field"><span>COLLECTION TYPE</span><select value={collectionKind} onChange={event => setCollectionKind(event.target.value as Collection['kind'])}>{(['series', 'bookshelf', 'featured', 'album', 'playlist', 'rail'] as const).map(kind => <option key={kind}>{kind}</option>)}</select></label><button disabled={working}>Add Collection</button></form><label className="field"><span>EDIT COLLECTION</span><select aria-label="Select Collection" value={collectionId} onChange={event => setCollectionId(event.target.value)}><option value="">Choose a Collection</option>{inventory.collections.map(value => <option key={value.id} value={value.id}>{value.title} · {value.itemIds.length} items</option>)}</select></label>{activeCollection && selected && <button disabled={working} onClick={toggleCollection}>{activeCollection.itemIds.includes(selected.id) ? 'Remove selected item' : 'Add selected item'}</button>}</details>
    {selected?.kind === 'video' && <div className="catalog-video-actions"><button type="button" onClick={() => onOpenVideo?.(selected.id)}>Open video workspace</button></div>}
    {selected?.kind === 'audio' && <div className="catalog-video-actions"><button type="button" onClick={() => onOpenAudio?.(selected.id)}>Open audio workspace</button></div>}
    {selected?.kind === 'book' && <div className="catalog-video-actions"><button type="button" onClick={() => onOpenBook?.(selected.id)}>Open book workspace</button></div>}
    {managedVideo && !managedVideo.deliveryEligible && <div className="catalog-management"><p>Verified managed HLS needs a separate creator delivery review before it can enter a channel draft. Approval here does not publish or expose the private files.</p><button type="button" disabled={working || managedVideo.tvDisplayRights?.status !== 'cleared' || managedVideo.tvPlaybackRights?.status !== 'cleared' || videoStates[managedVideo.id]?.uploadState !== 'verified' || videoStates[managedVideo.id]?.processing?.state !== 'ready'} onClick={approveManagedVideo}>Approve verified video for delivery review</button></div>}
    {managedVideo && videoStates[managedVideo.id]?.processing?.state === 'ready' && <div className="catalog-management"><p>Revoke this video through the owner-scoped application workflow. Live release access stops immediately; CDN cleanup is a separate operator step.</p><button type="button" disabled={working} onClick={revokeManagedVideo}>Revoke selected video</button></div>}
    {selectedSource?.type === 'creator_upload' && selectedSource.state === 'discovered' && <div className="catalog-management"><p>This creator-upload source is shared by draft items. Verify its provenance and your permission to retrieve and display your uploaded work on TV. This does not approve other items, playback, or publication.</p><label className="field"><span>PRIVATE SOURCE EVIDENCE · PDF, PNG OR JPEG · MAX 700 KB</span><input type="file" accept="application/pdf,image/png,image/jpeg" onChange={event => setSourceEvidence(event.target.files?.[0] ?? null)}/></label><label className="check"><input type="checkbox" checked={sourceApproved} onChange={event => setSourceApproved(event.target.checked)}/> I control this creator-upload source and assert retrieval and TV display permission for my uploaded work.</label><button type="button" disabled={working || !sourceApproved || !sourceEvidence} onClick={verifyCreatorSource}>Verify creator-upload source</button></div>}
    {selected && <details className="catalog-management"><summary>Manage other private media and rights</summary><div className="section-label">05 / PRIVATE MEDIA & TV RIGHTS</div><p>Upload artwork or audio under 1 MB. Video replacement is available from the video library. Rights and processing need separate review before TV delivery.</p><form onSubmit={attachMedia}><label className="field"><span>MEDIA USE</span><select aria-label="Media use" value={mediaUse} onChange={event => setMediaUse(event.target.value as typeof mediaUse)}><option value="artwork">Artwork</option><option value="audio">Audio</option></select></label><label className="field"><span>PRIVATE FILE</span><input type="file" required accept="image/png,image/jpeg,audio/mpeg" onChange={event => setMediaFile(event.target.files?.[0] ?? null)}/></label><label className="check"><input type="checkbox" checked={display} onChange={event => setDisplay(event.target.checked)}/> I have television display rights</label><label className="check"><input type="checkbox" checked={playback} onChange={event => setPlayback(event.target.checked)}/> I have television playback rights</label><button disabled={working || !mediaFile}>Upload private media</button></form><ul>{assets.map(asset => <li key={asset.id}>{asset.kind}: display {asset.tvDisplayRights?.status ?? 'unknown'}, playback {asset.tvPlaybackRights?.status ?? 'unknown'} · {asset.location.type === 'managed_hls' ? 'managed HLS; processing and publication review required' : asset.deliveryEligible ? 'eligible' : 'delivery disabled'}<div className="button-row"><button disabled={working || asset.location.type === 'managed_hls'} onClick={() => setAssetRights(asset, 'television_display', asset.tvDisplayRights?.status !== 'cleared')}>{asset.tvDisplayRights?.status === 'cleared' ? 'Revoke display' : 'Assert display'}</button><button disabled={working || asset.location.type === 'managed_hls'} onClick={() => setAssetRights(asset, 'television_playback', asset.tvPlaybackRights?.status !== 'cleared')}>{asset.tvPlaybackRights?.status === 'cleared' ? 'Revoke playback' : 'Assert playback'}</button></div></li>)}</ul></details>}
    {selected && selected.kind !== 'video' && <details className="catalog-management"><summary>Attach approved public artwork</summary><p>For this item, use artwork you own or may display on TV. The URL must be publicly reachable and stable; signed links cannot be published.</p><form onSubmit={attachPublicArtwork}><label className="field"><span>PUBLIC HTTPS ARTWORK URL</span><input type="url" required maxLength={2048} value={publicArtworkUrl} onChange={event => setPublicArtworkUrl(event.target.value)} placeholder="https://example.com/poster.png"/></label><label className="check"><input type="checkbox" checked={publicArtworkApproved} onChange={event => setPublicArtworkApproved(event.target.checked)}/> I have television display rights for this artwork and approve public delivery.</label><button disabled={working || !publicArtworkApproved || !publicArtworkUrl.trim()}>Attach public artwork</button></form></details>}
    <div className="section-label">06 / GENERATE CHANNEL DRAFT</div><p>Select reviewed work and Collections for the {creator} channel. Books open details without Play. Audio and films need cleared playback rights and eligible delivery.</p>
    <div role="group" aria-label="Generate selection">{inventory.collections.map(collection => <label className="check" key={collection.id}><input type="checkbox" checked={draftCollectionIds.includes(collection.id)} onChange={event => setDraftCollectionIds(previous => event.target.checked ? [...previous, collection.id] : previous.filter(id => id !== collection.id))}/>{collection.title} · Collection ({collection.itemIds.length})</label>)}{inventory.items.map(item => <label className="check" key={item.id}><input type="checkbox" checked={draftItemIds.includes(item.id)} onChange={event => setDraftItemIds(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))}/>{item.creatorOverrides?.title ?? item.sourceRecord.metadata.title} · {item.kind}</label>)}</div>
    <p>Selected: {draftCollectionIds.length} Collection(s), {chosenItems.length} item(s); {matchingItems.length} match this creator type.</p>
    {missingMedia.length > 0 && <p className="catalog-error" role="status">{missingMedia.length} selected audio/video item(s) lack eligible playback media or rights. They will be excluded.</p>}
    {matchingItems.some(item => item.kind === 'book') && <p>Books can appear without playback media. Missing display artwork uses a placeholder.</p>}
    <button className="primary" disabled={working || !matchingItems.length || (creator !== 'writing' && matchingItems.every(item => missingMedia.includes(item)))} onClick={generate}>Generate {creator} draft →</button>
    {changes && <div className="catalog-preview" role="status"><strong>Saved draft difference</strong><p>{changes.added} added · {changes.updated} updated · {changes.removed} removed · Pages: {changes.pages.join(', ')}</p>{changes.notices.map((notice, index) => <p key={index}>{notice}</p>)}<p>Brand, creator edits and custom source are preserved. Review Pages &amp; Layout and Appearance before another Generate.</p><button onClick={onRefine}>Review page layout →</button></div>}
    </>}</div>;
}
