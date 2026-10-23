import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { StudioModal, ModalHeader, ModalFooter } from './StudioModal.js';
import { resolvedCatalogMetadata, type MediaAsset } from '@firelaunch/contracts';
import { ApiError, deleteCatalogRecord, deletePrivateObject, readCatalog, readPrivateObjectMetadata, uploadPrivateAudio, uploadPrivateMedia,
  writeCatalog, type CatalogSnapshot } from './api.js';
import { AudioPlayer } from './AudioPlayer.js';
import { OwnedArtwork } from './OwnedArtwork.js';

const unknown = () => ({ status: 'unknown' as const, basis: 'none' as const, permittedUse: 'none' as const });
const claim = (use: 'television_display' | 'television_playback', cleared: boolean) => cleared
  ? { status: 'cleared' as const, basis: 'creator_asserted' as const, permittedUse: use, assertedAt: new Date().toISOString(), attestationVersion: 'channel-media-v1' as const }
  : unknown();
const reason = (error: unknown) => error instanceof ApiError && error.status === 409
  ? 'The library changed in another tab. Review the latest saved draft and retry.'
  : error instanceof Error ? error.message : String(error);

export function AudioWorkspace({ projectId, accountId, itemId, onIdentity, onClose }: {
  projectId: string; accountId: string; itemId?: string; onIdentity: (id: string) => void; onClose: () => void;
}) {
  const [inventory, setInventory] = useState<CatalogSnapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [album, setAlbum] = useState('');
  const [episode, setEpisode] = useState('');
  const [trackNumber, setTrackNumber] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [newCollection, setNewCollection] = useState('');
  const [collectionKind, setCollectionKind] = useState<'album' | 'playlist'>('album');
  const [cover, setCover] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [listening, setListening] = useState(false);
  const initialized = useRef('');
  const refresh = async () => {
    const data = await readCatalog(projectId);
    if (data.projectId !== projectId || data.creatorAccountId !== accountId ||
      [...data.sources, ...data.items, ...data.collections, ...data.mediaAssets].some(value =>
        value.projectId !== projectId || value.creatorAccountId !== accountId))
      throw new Error('Audio library is unavailable for this account.');
    setInventory(data); return data;
  };
  useEffect(() => { void refresh().catch(value => setError(reason(value))); }, [projectId, accountId]);
  useEffect(() => {
    if (!itemId || !inventory || initialized.current === itemId || busy) return;
    const item = inventory.items.find(value => value.id === itemId && value.kind === 'audio');
    if (!item) return;
    initialized.current = itemId;
    const metadata = resolvedCatalogMetadata(item);
    setTitle(metadata.title); setArtist(metadata.artist ?? ''); setDescription(metadata.description ?? '');
    setAlbum(metadata.album ?? ''); setEpisode(metadata.episode ?? ''); setTrackNumber(String(metadata.trackNumber ?? ''));
    setCollectionId(inventory.collections.find(value => value.itemIds.includes(itemId) && ['album', 'playlist'].includes(value.kind))?.id ?? '');
    const ownedAudio = [...inventory.mediaAssets].reverse().find(value => value.catalogItemId === itemId && value.kind === 'audio' && value.location.type === 'private_object');
    setRightsConfirmed(ownedAudio?.tvDisplayRights?.status === 'cleared' && ownedAudio.tvPlaybackRights?.status === 'cleared');
  }, [inventory, itemId, busy]);
  const item = inventory?.items.find(value => value.id === itemId && value.kind === 'audio');
  const assets = inventory?.mediaAssets.filter(value => value.catalogItemId === item?.id) ?? [];
  const audioAsset = [...assets].reverse().find(value => value.kind === 'audio' && value.location.type === 'private_object' && value.tvPlaybackRights?.status !== 'revoked');
  const doWork = async (action: () => Promise<string>) => {
    setBusy(true); setError(''); setMessage('');
    try { setMessage(await action()); }
    catch (value) { setError(reason(value)); await refresh().catch(() => undefined); }
    finally { setBusy(false); }
  };
  const save = (event: FormEvent) => { event.preventDefault(); void doWork(async () => {
    if (!title.trim() || !artist.trim()) throw new Error('Title and artist are required.');
    if ((cover || audioFile) && !rightsConfirmed) throw new Error('Confirm permission for the new media before saving.');
    if (trackNumber && (!/^[1-9][0-9]{0,3}$/.test(trackNumber) || Number(trackNumber) > 9999)) throw new Error('Track number must be 1–9999.');
    let current = await refresh();
    let ownedId = itemId ?? '';
    const metadata = { title: title.trim(), artist: artist.trim(), ...(description.trim() ? { description: description.trim() } : {}),
      ...(album.trim() ? { album: album.trim() } : {}), ...(episode.trim() ? { episode: episode.trim() } : {}),
      ...(trackNumber ? { trackNumber: Number(trackNumber) } : {}) };
    if (!ownedId) {
      let source = current.sources.find(value => value.type === 'creator_upload');
      if (!source) {
        const added = await writeCatalog(projectId, 'sources', current.revision, {
          schemaVersion: 1, type: 'creator_upload', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' }
        });
        current = await refresh(); source = current.sources.find(value => value.id === added.record.id);
      }
      if (!source) throw new Error('Audio source could not be saved.');
      const identifier = { provider: 'creator' as const, kind: 'upload_id' as const, value: crypto.randomUUID() };
      const added = await writeCatalog(projectId, 'items', current.revision, { schemaVersion: 1, kind: 'audio',
        sourceRecord: { sourceId: source.id, externalId: identifier, observedAt: new Date().toISOString(), metadata },
        externalIdentifiers: [identifier], mediaAssetIds: [] });
      ownedId = added.record.id; onIdentity(ownedId); current = await refresh();
    } else {
      const existing = current.items.find(value => value.id === ownedId && value.kind === 'audio');
      if (!existing) throw new Error('Audio draft is unavailable for this channel.');
      const { id, creatorAccountId: _owner, projectId: _project, ...record } = existing;
      await writeCatalog(projectId, 'items', current.revision, {
        ...record, creatorOverrides: { ...metadata, editedAt: new Date().toISOString() }
      }, id);
      current = await refresh();
    }
    if (cover) {
      if (!['image/jpeg', 'image/png'].includes(cover.type) || cover.size < 1 || cover.size > 1_000_000)
        throw new Error('Choose a PNG or JPEG cover under 1 MB.');
      const image = await createImageBitmap(cover);
      const square = image.width === image.height;
      image.close();
      if (!square) throw new Error('Choose a square cover image.');
      const uploaded = await uploadPrivateMedia(projectId, cover);
      try { await writeCatalog(projectId, 'media-assets', current.revision, { schemaVersion: 1,
        catalogItemId: ownedId, kind: 'artwork', location: { type: 'private_object', objectId: uploaded.id },
        tvDisplayRights: claim('television_display', rightsConfirmed), tvPlaybackRights: unknown(), deliveryEligible: false }); }
      catch (error) { await deletePrivateObject(projectId, uploaded.id).catch(() => undefined); throw error; }
      current = await refresh(); setCover(null);
    }
    if (audioFile) {
      const old = [...current.mediaAssets].reverse().find(value => value.catalogItemId === ownedId && value.kind === 'audio' && value.location.type === 'private_object');
      if (old?.deliveryEligible) throw new Error('An approved audio asset cannot be replaced from this private draft. Revoke delivery first.');
      const uploaded = await uploadPrivateAudio(projectId, audioFile);
      if (old?.location.type === 'private_object') {
        let prior;
        try { prior = await readPrivateObjectMetadata(projectId, old.location.objectId); }
        catch (error) { await deletePrivateObject(projectId, uploaded.id).catch(() => undefined); throw error; }
        if (prior.sha256 === uploaded.sha256 && prior.byteSize === uploaded.byteSize) {
          await deletePrivateObject(projectId, uploaded.id);
          setAudioFile(null);
          await refresh();
          return 'This MP3 is already saved privately. No duplicate attachment was added.';
        }
      }
      let attached = false;
      try {
        await writeCatalog(projectId, 'media-assets', current.revision, { schemaVersion: 1,
          catalogItemId: ownedId, kind: 'audio', location: { type: 'private_object', objectId: uploaded.id },
          tvDisplayRights: claim('television_display', rightsConfirmed),
          tvPlaybackRights: claim('television_playback', rightsConfirmed), deliveryEligible: false });
        attached = true; current = await refresh();
      } catch (error) { if (!attached) await deletePrivateObject(projectId, uploaded.id).catch(() => undefined); throw error; }
      if (old) {
        await deleteCatalogRecord(projectId, 'media-assets', current.revision, old.id);
        if (old.location.type === 'private_object') await deletePrivateObject(projectId, old.location.objectId);
      }
      setAudioFile(null); setListening(false);
    } else {
      const existingAudio = [...current.mediaAssets].reverse().find(value => value.catalogItemId === ownedId && value.kind === 'audio' && value.location.type === 'private_object' && value.tvPlaybackRights?.status !== 'revoked');
      if (existingAudio && !existingAudio.deliveryEligible &&
        rightsConfirmed && (existingAudio.tvDisplayRights?.status !== 'cleared' || existingAudio.tvPlaybackRights?.status !== 'cleared')) {
        const { id, creatorAccountId: _owner, projectId: _project, ...record } = existingAudio;
        await writeCatalog(projectId, 'media-assets', current.revision, { ...record,
          tvDisplayRights: claim('television_display', rightsConfirmed),
          tvPlaybackRights: claim('television_playback', rightsConfirmed), deliveryEligible: false }, id);
        current = await refresh();
      }
    }
    if (newCollection.trim()) {
      const created = await writeCatalog(projectId, 'collections', current.revision, { schemaVersion: 1,
        kind: collectionKind, title: newCollection.trim(), itemIds: [ownedId] });
      setCollectionId(created.record.id); setNewCollection(''); current = await refresh();
    } else if (collectionId) {
      const selected = current.collections.find(value => value.id === collectionId && ['album', 'playlist'].includes(value.kind));
      if (!selected) throw new Error('Choose an available album or playlist.');
      if (!selected.itemIds.includes(ownedId)) {
        const { id, creatorAccountId: _owner, projectId: _project, ...record } = selected;
        await writeCatalog(projectId, 'collections', current.revision, { ...record, itemIds: [...record.itemIds, ownedId] }, id);
        current = await refresh();
      }
    }
    await refresh();
    return 'Audio draft saved privately.';
  }); };
  const listen = () => void doWork(async () => {
    if (!audioAsset || audioAsset.location.type !== 'private_object') throw new Error('Save a private MP3 first.');
    setAudioUrl(`/api/projects/${encodeURIComponent(projectId)}/private-objects/${encodeURIComponent(audioAsset.location.objectId)}/audio`);
    setListening(true);
    return 'Playing the private owner preview. This is not a live TV release.';
  });
  const revoke = (asset: MediaAsset) => void doWork(async () => {
    if (!inventory || asset.deliveryEligible) throw new Error('Approved delivery requires a separate revocation review.');
    const { id, creatorAccountId: _owner, projectId: _project, ...record } = asset;
    await writeCatalog(projectId, 'media-assets', inventory.revision, { ...record,
      tvPlaybackRights: { ...unknown(), status: 'revoked' }, deliveryEligible: false }, id);
    setListening(false); await refresh(); return 'Audio playback rights revoked; private listening stopped.';
  });
  const close = () => { if (!busy) onClose(); };
  return <StudioModal className="video-workspace audio-workspace" titleId="audio-workspace-title" descriptionId="audio-workspace-description" onClose={close} closeDisabled={busy} guardUnsaved resetDirtyKey={inventory?.revision}>
    <ModalHeader eyebrow="PRIVATE AUDIO WORKSPACE" title={item ? title || 'Audio draft' : 'Add Audio'} titleId="audio-workspace-title"
      descriptionId="audio-workspace-description" description="Save a track or episode with its cover. Publication is separate." onClose={close} closeDisabled={busy}/>
    <div className="video-workspace-body">
      {error && <p role="alert" className="catalog-error">{error}</p>}{message && <p role="status">{message}</p>}
      {!inventory && !error && <p>Loading audio library…</p>}
      {itemId && inventory && !item && <p role="alert">This audio draft is unavailable in this channel.</p>}
      {inventory && (!itemId || item) && <form onSubmit={save} className="audio-workspace-form">
        <label className="field">TITLE<input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)}/></label>
        <label className="field">ARTIST OR CREATOR<input required maxLength={160} value={artist} onChange={event => setArtist(event.target.value)}/></label>
        <label className="field">DESCRIPTION<textarea maxLength={4000} value={description} onChange={event => setDescription(event.target.value)}/></label>
        <div className="audio-workspace-fields"><label className="field">ALBUM<input maxLength={160} value={album} onChange={event => setAlbum(event.target.value)}/></label>
          <label className="field">EPISODE<input maxLength={160} value={episode} onChange={event => setEpisode(event.target.value)}/></label>
          <label className="field">TRACK NUMBER<input inputMode="numeric" value={trackNumber} onChange={event => setTrackNumber(event.target.value)}/></label></div>
        <label className="field">MP3 FILE · UP TO 2 HOURS / 320 MB<input type="file" accept=".mp3,audio/mpeg" onChange={event => { setAudioFile(event.target.files?.[0] ?? null); setRightsConfirmed(false); }}/></label>
        <label className="field">SQUARE COVER · PNG OR JPEG · UNDER 1 MB<input type="file" accept="image/png,image/jpeg" onChange={event => { setCover(event.target.files?.[0] ?? null); setRightsConfirmed(false); }}/></label>
        {item && <OwnedArtwork item={item} assets={inventory.mediaAssets} projectId={projectId} accountId={accountId} className="audio-workspace-cover" fallback={<span>♫</span>}/>}
        {(cover || audioFile || (audioAsset && (audioAsset.tvDisplayRights?.status !== 'cleared' || audioAsset.tvPlaybackRights?.status !== 'cleared'))) && <label className="check"><input type="checkbox" checked={rightsConfirmed} onChange={event => setRightsConfirmed(event.target.checked)}/> I confirm I own or have permission to show the cover and play this MP3 in my channel.</label>}
        <label className="field">ALBUM OR PLAYLIST<select value={collectionId} onChange={event => setCollectionId(event.target.value)}><option value="">No collection</option>
          {inventory.collections.filter(value => ['album', 'playlist'].includes(value.kind)).map(value => <option key={value.id} value={value.id}>{value.title} · {value.kind}</option>)}</select></label>
        <div className="audio-workspace-fields"><label className="field">NEW COLLECTION<input maxLength={160} value={newCollection} onChange={event => setNewCollection(event.target.value)}/></label>
          <label className="field">TYPE<select value={collectionKind} onChange={event => setCollectionKind(event.target.value as 'album' | 'playlist')}><option value="album">Album</option><option value="playlist">Playlist</option></select></label></div>
        <ModalFooter><button type="button" disabled={busy} onClick={close} data-modal-close>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving privately…' : 'Save audio draft'}</button></ModalFooter>
      </form>}
      {item && <div className="audio-workspace-summary"><strong>Saved status: PRIVATE</strong>
        <p>{!audioAsset ? 'Add an MP3 to continue.' : audioAsset.tvPlaybackRights?.status === 'revoked' ? 'Needs attention · playback permission revoked.' : audioAsset.tvPlaybackRights?.status !== 'cleared' ? 'Needs attention · confirm playback permission.' : 'MP3 saved privately.'}</p>
        {audioAsset && <div className="button-row"><button type="button" disabled={busy || audioAsset.tvPlaybackRights?.status === 'revoked'} onClick={listen}>Listen privately</button>
          <button type="button" disabled={busy || audioAsset.tvPlaybackRights?.status === 'revoked'} onClick={() => revoke(audioAsset)}>Revoke playback rights</button></div>}
        {listening && audioUrl && audioAsset?.tvPlaybackRights?.status !== 'revoked' &&
          <AudioPlayer source={audioUrl} title={title} creator={artist} artwork={<OwnedArtwork item={item} assets={inventory!.mediaAssets}
            projectId={projectId} accountId={accountId} className="audio-workspace-player-art" fallback={<span>♫</span>}/>}/>}</div>}
    </div></StudioModal>;
}
