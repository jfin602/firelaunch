import React, { useEffect, useState, type FormEvent } from 'react';
import type { CatalogItem, Collection, MediaAsset } from '@firelaunch/contracts';
import { ApiError, approveCatalogImport, deletePrivateObject, previewCatalogImport, readCatalog, uploadPrivateMedia, writeCatalog, type CatalogSnapshot, type ImportPreview } from './api.js';

type CreatorType = 'video' | 'audio' | 'writing';
type SourceType = 'creator_csv' | 'creator_json' | 'creator_https_feed' | 'creator_upload';
const emptyRights = { status: 'unknown' as const, basis: 'none' as const, permittedUse: 'none' as const };
const sourceLabel: Record<SourceType, string> = { creator_csv: 'CSV file', creator_json: 'JSON file', creator_https_feed: 'HTTPS feed snapshot', creator_upload: 'Manual first item' };
const kindFor = (creator: CreatorType): CatalogItem['kind'] => creator === 'writing' ? 'book' : creator;
const collectionFor = (creator: CreatorType): Collection['kind'] => creator === 'writing' ? 'bookshelf' : creator === 'audio' ? 'album' : 'series';
const draftSource = (type: SourceType, endpointUrl: string) => ({ schemaVersion: 1, type, state: 'discovered', ...(type === 'creator_https_feed' ? { endpointUrl } : {}), permission: { retrieval: type === 'creator_https_feed' ? 'creator_asserted' : 'unknown', tvDisplay: 'unknown' } });
const errorText = (reason: unknown): string => reason instanceof ApiError && reason.status === 409 ? 'Catalog changed in another tab. Latest revision loaded; preview or save again.' : reason instanceof Error ? reason.message : String(reason);

export function Catalog({ projectId, hosted }: { projectId: string; hosted: boolean }) {
  const [inventory, setInventory] = useState<CatalogSnapshot | null>(null);
  const [creator, setCreator] = useState<CreatorType>('video');
  const [sourceType, setSourceType] = useState<SourceType>('creator_csv');
  const [endpoint, setEndpoint] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [manual, setManual] = useState({ externalId: '', title: '', description: '' });
  const [override, setOverride] = useState({ title: '', description: '' });
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionKind, setCollectionKind] = useState<Collection['kind']>('series');
  const [collectionId, setCollectionId] = useState('');
  const [mediaUse, setMediaUse] = useState<'artwork' | 'video' | 'audio'>('artwork');
  const [display, setDisplay] = useState(false);
  const [playback, setPlayback] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selected = inventory?.items.find(item => item.id === selectedId);
  const source = inventory?.sources.find(item => item.id === sourceId);
  const activeCollection = inventory?.collections.find(item => item.id === collectionId);
  const assets = inventory?.mediaAssets.filter(asset => asset.catalogItemId === selectedId) ?? [];
  const refresh = async () => { const data = await readCatalog(projectId); setInventory(data); return data; };
  useEffect(() => {
    if (!hosted) return;
    let alive = true;
    void readCatalog(projectId).then(data => { if (alive) setInventory(data); }).catch(reason => { if (alive) setError(errorText(reason)); });
    return () => { alive = false; };
  }, [projectId, hosted]);
  useEffect(() => { setOverride({ title: selected?.creatorOverrides?.title ?? '', description: selected?.creatorOverrides?.description ?? '' }); }, [selectedId, inventory?.revision]);
  const run = async (action: () => Promise<string>) => {
    setWorking(true); setError(''); setMessage('');
    try { setMessage(await action()); }
    catch (reason) { setError(errorText(reason)); if (reason instanceof ApiError && reason.status === 409) await refresh().catch(() => undefined); }
    finally { setWorking(false); }
  };
  const addSource = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    const result = await writeCatalog(projectId, 'sources', inventory!.revision, draftSource(sourceType, endpoint));
    await refresh(); setSourceId(result.record.id); setPreview(null);
    return `${sourceLabel[sourceType]} source added. ${sourceType === 'creator_https_feed' ? 'Retrieval permission asserted for this one-time snapshot.' : 'Import still needs preview and approval.'}`;
  }); };
  const readFile = (file: File | undefined) => { if (!file) return; if (file.size > 512_000) { setError('Catalog file exceeds 512 KB.'); return; } void file.text().then(value => { setContent(value); setPreview(null); setError(''); }).catch(reason => setError(errorText(reason))); };
  const showPreview = () => void run(async () => {
    if (!source) throw new Error('Select a source first.');
    const format = source.type === 'creator_csv' ? 'csv' : source.type === 'creator_json' ? 'json' : 'feed';
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
    await writeCatalog(projectId, 'items', inventory!.revision, { ...record, creatorOverrides: { ...(override.title.trim() ? { title: override.title.trim() } : {}), ...(override.description.trim() ? { description: override.description.trim() } : {}), editedAt: new Date().toISOString() } }, id);
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
    const expected = mediaUse === 'artwork' ? ['image/png', 'image/jpeg'] : mediaUse === 'video' ? ['video/mp4'] : ['audio/mpeg'];
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
  const setAssetRights = (asset: MediaAsset, use: 'television_display' | 'television_playback', cleared: boolean) => void run(async () => {
    const { id, creatorAccountId, projectId: _projectId, ...record } = asset;
    const claim = cleared ? { status: 'cleared' as const, basis: 'creator_asserted' as const, permittedUse: use, assertedAt: new Date().toISOString() } : { ...emptyRights, status: 'revoked' as const };
    const key = use === 'television_display' ? 'tvDisplayRights' : 'tvPlaybackRights';
    await writeCatalog(projectId, 'media-assets', inventory!.revision, { ...record, [key]: claim, deliveryEligible: false }, id);
    await refresh(); return `${use === 'television_display' ? 'Display' : 'Playback'} rights ${cleared ? 'asserted' : 'revoked'}; delivery remains disabled.`;
  });
  if (!hosted) return <div className="panel-content"><h2>Catalog needs a hosted account.</h2><p>Local channels still support the Create, Design, Content, Code, Build and Preview workflow.</p></div>;
  return <div className="panel-content catalog-panel"><span className="eyebrow">CATALOG / PRIVATE DRAFT</span><h2>Start with your work.</h2><p>Import creator-controlled records, review them, then curate Collections and licensed media. Catalog inventory does not change TV Preview until a later approved channel workflow.</p>
    {error && <p role="alert" className="catalog-error">{error}</p>}{message && <p role="status" className="catalog-status">{message}</p>}{!inventory ? <p>Loading catalog…</p> : <>
    <div className="section-label">01 / CREATOR & SOURCE</div><label className="field"><span>CREATOR TYPE</span><select aria-label="Creator type" value={creator} onChange={event => { const value = event.target.value as CreatorType; setCreator(value); setCollectionKind(collectionFor(value)); }}><option value="video">Video</option><option value="audio">Audio</option><option value="writing">Writing</option></select></label>
    <form onSubmit={addSource}><label className="field"><span>NEW SOURCE</span><select aria-label="New source" value={sourceType} onChange={event => setSourceType(event.target.value as SourceType)}>{Object.entries(sourceLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{sourceType === 'creator_https_feed' && <label className="field"><span>PUBLIC HTTPS FEED URL</span><input type="url" required value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://example.com/feed.json" /></label>}<button disabled={working}>Add source</button></form>
    <label className="field"><span>SELECT SOURCE</span><select aria-label="Select source" value={sourceId} onChange={event => { setSourceId(event.target.value); setPreview(null); }}><option value="">Choose a source</option>{inventory.sources.filter(value => ['creator_csv', 'creator_json', 'creator_https_feed', 'creator_upload'].includes(value.type)).map(value => <option key={value.id} value={value.id}>{sourceLabel[value.type as SourceType]} · {value.endpointUrl ?? value.id.slice(-8)}</option>)}</select></label>
    {source && source.type !== 'creator_upload' && <><div className="section-label">02 / PREVIEW & APPROVE</div>{source.type !== 'creator_https_feed' && <label className="field"><span>CATALOG FILE · {source.type === 'creator_csv' ? 'CSV' : 'JSON'} · MAX 512 KB</span><input type="file" accept={source.type === 'creator_csv' ? '.csv,text/csv' : '.json,application/json'} onChange={event => readFile(event.target.files?.[0])} /></label>}<p>Import requires stable externalId, kind and title. New rows, duplicates and malformed records are shown before approval.</p><button disabled={working || (source.type !== 'creator_https_feed' && !content)} onClick={showPreview}>Preview import</button>{preview && preview.sourceId === source.id && <div className="catalog-preview"><strong>{preview.rows.length} rows · {preview.issues.length} issues</strong><ul>{preview.rows.map(row => <li key={`${row.line}:${row.externalId}`}>Line {row.line}: {row.action} · {row.kind} · {row.metadata.title}</li>)}{preview.issues.map(issue => <li key={`${issue.line}:${issue.code}`} className="catalog-error">Line {issue.line}: {issue.code} · {issue.message}</li>)}</ul><button className="primary" disabled={working || preview.issues.length > 0} onClick={approve}>Approve snapshot</button></div>}</>}
    {source?.type === 'creator_upload' && <><div className="section-label">02 / FIRST ITEM</div><form onSubmit={addManual}><label className="field"><span>YOUR STABLE ITEM ID</span><input required pattern="[A-Za-z0-9][A-Za-z0-9._:-]*" maxLength={128} value={manual.externalId} onChange={event => setManual({ ...manual, externalId: event.target.value })}/></label><label className="field"><span>TITLE</span><input required maxLength={160} value={manual.title} onChange={event => setManual({ ...manual, title: event.target.value })}/></label><label className="field"><span>DESCRIPTION</span><textarea maxLength={4000} value={manual.description} onChange={event => setManual({ ...manual, description: event.target.value })}/></label><button className="primary" disabled={working}>Save draft item</button></form></>}
    <div className="section-label">03 / REVIEW ITEMS</div><p>{inventory.items.length} draft item(s). Books and listings can remain nonplayable inventory.</p><label className="field"><span>SELECT ITEM</span><select aria-label="Select catalog item" value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">Choose an item</option>{inventory.items.map(item => <option key={item.id} value={item.id}>{item.creatorOverrides?.title ?? item.sourceRecord.metadata.title} · {item.kind}</option>)}</select></label>
    {selected && <><p><strong>Source:</strong> {selected.sourceRecord.metadata.title}<br/><strong>External ID:</strong> {selected.sourceRecord.externalId.value}<br/><strong>Kind:</strong> {selected.kind}</p><form onSubmit={saveOverride}><label className="field"><span>CREATOR TITLE OVERRIDE</span><input maxLength={160} value={override.title} onChange={event => setOverride({ ...override, title: event.target.value })} placeholder={selected.sourceRecord.metadata.title}/></label><label className="field"><span>CREATOR DESCRIPTION OVERRIDE</span><textarea maxLength={4000} value={override.description} onChange={event => setOverride({ ...override, description: event.target.value })}/></label><button disabled={working || (!override.title.trim() && !override.description.trim())}>Save override</button></form></>}
    <div className="section-label">04 / COLLECTIONS</div><form onSubmit={addCollection}><label className="field"><span>COLLECTION NAME</span><input required maxLength={160} value={collectionTitle} onChange={event => setCollectionTitle(event.target.value)}/></label><label className="field"><span>COLLECTION TYPE</span><select value={collectionKind} onChange={event => setCollectionKind(event.target.value as Collection['kind'])}>{(['series', 'bookshelf', 'featured', 'album', 'playlist', 'rail'] as const).map(kind => <option key={kind}>{kind}</option>)}</select></label><button disabled={working}>Add Collection</button></form><label className="field"><span>EDIT COLLECTION</span><select aria-label="Select Collection" value={collectionId} onChange={event => setCollectionId(event.target.value)}><option value="">Choose a Collection</option>{inventory.collections.map(value => <option key={value.id} value={value.id}>{value.title} · {value.itemIds.length} items</option>)}</select></label>{activeCollection && selected && <button disabled={working} onClick={toggleCollection}>{activeCollection.itemIds.includes(selected.id) ? 'Remove selected item' : 'Add selected item'}</button>}
    {selected && <><div className="section-label">05 / PRIVATE MEDIA & TV RIGHTS</div><p>Upload a private file under 1 MB. Assert display and playback rights separately. An uploaded file alone is never ready for TV delivery.</p><form onSubmit={attachMedia}><label className="field"><span>MEDIA USE</span><select aria-label="Media use" value={mediaUse} onChange={event => setMediaUse(event.target.value as typeof mediaUse)}><option value="artwork">Artwork</option><option value="video">Video</option><option value="audio">Audio</option></select></label><label className="field"><span>PRIVATE FILE</span><input type="file" required accept="image/png,image/jpeg,video/mp4,audio/mpeg" onChange={event => setMediaFile(event.target.files?.[0] ?? null)}/></label><label className="check"><input type="checkbox" checked={display} onChange={event => setDisplay(event.target.checked)}/> I have television display rights</label><label className="check"><input type="checkbox" checked={playback} onChange={event => setPlayback(event.target.checked)}/> I have television playback rights</label><button disabled={working || !mediaFile}>Upload private media</button></form><ul>{assets.map(asset => <li key={asset.id}>{asset.kind}: display {asset.tvDisplayRights?.status ?? 'unknown'}, playback {asset.tvPlaybackRights?.status ?? 'unknown'} · {asset.deliveryEligible ? 'eligible' : 'delivery disabled'}<div className="button-row"><button disabled={working} onClick={() => setAssetRights(asset, 'television_display', asset.tvDisplayRights?.status !== 'cleared')}>{asset.tvDisplayRights?.status === 'cleared' ? 'Revoke display' : 'Assert display'}</button><button disabled={working} onClick={() => setAssetRights(asset, 'television_playback', asset.tvPlaybackRights?.status !== 'cleared')}>{asset.tvPlaybackRights?.status === 'cleared' ? 'Revoke playback' : 'Assert playback'}</button></div></li>)}</ul></>}
    </>}</div>;
}
