import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { StudioModal, ModalHeader, ModalFooter } from './StudioModal.js';
import { resolvedCatalogMetadata, type MediaAsset } from '@firelaunch/contracts';
import { ApiError, deleteCatalogRecord, deletePrivateObject, readCatalog, readPrivateObjectMetadata,
  uploadPrivateAudio, uploadPrivateMedia, writeCatalog, type CatalogSnapshot } from './api.js';
import { AudioPlayer } from './AudioPlayer.js';
import { OwnedArtwork } from './OwnedArtwork.js';

const unknown = () => ({ status: 'unknown' as const, basis: 'none' as const, permittedUse: 'none' as const });
const rights = (use: 'television_display' | 'television_playback', checked: boolean) => checked
  ? { status: 'cleared' as const, basis: 'creator_asserted' as const, permittedUse: use, assertedAt: new Date().toISOString(), attestationVersion: 'channel-media-v1' as const }
  : unknown();
const reason = (error: unknown) => error instanceof ApiError && error.status === 409
  ? 'The library changed in another tab. Review the latest saved book and retry.'
  : error instanceof Error ? error.message : String(error);

export function BookWorkspace({ projectId, accountId, itemId, onIdentity, onClose }: {
  projectId: string; accountId: string; itemId?: string; onIdentity: (id: string) => void; onClose: () => void;
}) {
  const [inventory, setInventory] = useState<CatalogSnapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [isbn, setIsbn] = useState('');
  const [series, setSeries] = useState('');
  const [publicationDate, setPublicationDate] = useState('');
  const [narrator, setNarrator] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [attachAudio, setAttachAudio] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [bookshelfId, setBookshelfId] = useState('');
  const [newBookshelf, setNewBookshelf] = useState('');
  const [listening, setListening] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const initialized = useRef('');
  const refresh = async () => {
    const data = await readCatalog(projectId);
    if (data.projectId !== projectId || data.creatorAccountId !== accountId ||
      [...data.sources, ...data.items, ...data.collections, ...data.mediaAssets].some(value =>
        value.projectId !== projectId || value.creatorAccountId !== accountId))
      throw new Error('Book library is unavailable for this account.');
    setInventory(data); return data;
  };
  useEffect(() => { void refresh().catch(value => setError(reason(value))); }, [projectId, accountId]);
  useEffect(() => {
    if (!itemId || !inventory || initialized.current === itemId || busy) return;
    const item = inventory.items.find(value => value.id === itemId && value.kind === 'book');
    if (!item) return;
    initialized.current = itemId;
    const metadata = resolvedCatalogMetadata(item);
    setTitle(metadata.title); setAuthor(metadata.author ?? ''); setSynopsis(metadata.description ?? '');
    setIsbn(metadata.isbn ?? ''); setSeries(metadata.series ?? ''); setPublicationDate(metadata.publicationDate ?? '');
    setNarrator(metadata.narrator ?? '');
    setBookshelfId(inventory.collections.find(value => value.kind === 'bookshelf' && value.itemIds.includes(itemId))?.id ?? '');
    const coverAsset = [...item.mediaAssetIds].reverse().map(id => inventory.mediaAssets.find(value => value.id === id))
      .find(value => value?.kind === 'artwork' && value.location.type === 'private_object');
    const audioAsset = inventory.mediaAssets.find(value => value.id === item.audiobook?.audioAssetId);
    setRightsConfirmed((!coverAsset || coverAsset.tvDisplayRights?.status === 'cleared') &&
      (!audioAsset || audioAsset.tvPlaybackRights?.status === 'cleared'));
    setAttachAudio(!!audioAsset);
  }, [inventory, itemId, busy]);
  const item = inventory?.items.find(value => value.id === itemId && value.kind === 'book');
  const audiobook = inventory?.mediaAssets.find(value => value.id === item?.audiobook?.audioAssetId && value.catalogItemId === item.id && value.kind === 'audio');
  const doWork = async (action: () => Promise<string>) => {
    setBusy(true); setError(''); setMessage('');
    try { setMessage(await action()); }
    catch (value) { setError(reason(value)); await refresh().catch(() => undefined); }
    finally { setBusy(false); }
  };
  const updateBook = async (current: CatalogSnapshot, id: string, patch: object) => {
    const existing = current.items.find(value => value.id === id && value.kind === 'book');
    if (!existing) throw new Error('Book draft is unavailable for this channel.');
    const { id: _id, creatorAccountId: _owner, projectId: _project, ...record } = existing;
    const next = { ...record, ...patch } as typeof record;
    if ('audiobook' in patch && (patch as { audiobook?: unknown }).audiobook === null) delete next.audiobook;
    await writeCatalog(projectId, 'items', current.revision, next, id);
    return await refresh();
  };
  const save = (event: FormEvent) => { event.preventDefault(); void doWork(async () => {
    if (!title.trim() || !author.trim()) throw new Error('Title and author are required.');
    const normalizedIsbn = isbn.replace(/[\s-]/g, '').toUpperCase();
    if (normalizedIsbn && !/^(?:[0-9]{9}[0-9X]|97[89][0-9]{10})$/.test(normalizedIsbn)) throw new Error('Enter an ISBN-10 or ISBN-13.');
    if ((cover || (attachAudio && audioFile)) && !rightsConfirmed) throw new Error('Confirm permission for the new book media before saving.');
    if (attachAudio && audioFile && !narrator.trim()) throw new Error('Add a narrator for this audiobook.');
    let current = await refresh();
    let ownedId = itemId ?? '';
    const metadata = { title: title.trim(), author: author.trim(), ...(synopsis.trim() ? { description: synopsis.trim() } : {}),
      ...(normalizedIsbn ? { isbn: normalizedIsbn } : {}), ...(series.trim() ? { series: series.trim() } : {}),
      ...(publicationDate ? { publicationDate } : {}), ...(narrator.trim() ? { narrator: narrator.trim() } : {}) };
    if (!ownedId) {
      let source = current.sources.find(value => value.type === 'creator_upload');
      if (!source) {
        const added = await writeCatalog(projectId, 'sources', current.revision, {
          schemaVersion: 1, type: 'creator_upload', state: 'discovered', permission: { retrieval: 'unknown', tvDisplay: 'unknown' }
        });
        current = await refresh(); source = current.sources.find(value => value.id === added.record.id);
      }
      if (!source) throw new Error('Book source could not be saved.');
      const identifier = { provider: 'creator' as const, kind: 'upload_id' as const, value: crypto.randomUUID() };
      const added = await writeCatalog(projectId, 'items', current.revision, { schemaVersion: 1, kind: 'book',
        sourceRecord: { sourceId: source.id, externalId: identifier, observedAt: new Date().toISOString(), metadata },
        externalIdentifiers: [identifier], mediaAssetIds: [] });
      ownedId = added.record.id; onIdentity(ownedId); current = await refresh();
    } else current = await updateBook(current, ownedId, { creatorOverrides: { ...metadata, editedAt: new Date().toISOString() } });
    if (cover) {
      if (!['image/png', 'image/jpeg'].includes(cover.type) || cover.size < 1 || cover.size > 1_000_000)
        throw new Error('Choose a PNG or JPEG portrait cover under 1 MB.');
      const image = await createImageBitmap(cover);
      const portrait = image.height > image.width;
      image.close();
      if (!portrait) throw new Error('Choose a portrait cover image.');
      const uploaded = await uploadPrivateMedia(projectId, cover);
      try { await writeCatalog(projectId, 'media-assets', current.revision, { schemaVersion: 1,
        catalogItemId: ownedId, kind: 'artwork', location: { type: 'private_object', objectId: uploaded.id },
        tvDisplayRights: rights('television_display', rightsConfirmed), tvPlaybackRights: unknown(), deliveryEligible: false }); }
      catch (value) { await deletePrivateObject(projectId, uploaded.id).catch(() => undefined); throw value; }
      current = await refresh(); setCover(null);
    } else {
      const existingCover = [...current.mediaAssets].reverse().find(value => value.catalogItemId === ownedId && value.kind === 'artwork' &&
        value.location.type === 'private_object' && !value.deliveryEligible);
      if (existingCover && rightsConfirmed && existingCover.tvDisplayRights?.status !== 'cleared') {
        const { id, creatorAccountId: _owner, projectId: _project, ...record } = existingCover;
        await writeCatalog(projectId, 'media-assets', current.revision, { ...record,
          tvDisplayRights: rights('television_display', rightsConfirmed), deliveryEligible: false }, id);
        current = await refresh();
      }
    }
    if (attachAudio && audioFile) {
      const old = current.mediaAssets.find(value => value.id === current.items.find(item => item.id === ownedId)?.audiobook?.audioAssetId);
      if (old?.deliveryEligible) throw new Error('Approved audiobook delivery must be revoked before replacement.');
      const uploaded = await uploadPrivateAudio(projectId, audioFile);
      if (old?.location.type === 'private_object') {
        let prior;
        try { prior = await readPrivateObjectMetadata(projectId, old.location.objectId); }
        catch (value) { await deletePrivateObject(projectId, uploaded.id).catch(() => undefined); throw value; }
        if (prior.sha256 === uploaded.sha256 && prior.byteSize === uploaded.byteSize) {
          await deletePrivateObject(projectId, uploaded.id); setAudioFile(null);
          return 'This MP3 is already attached to the book.';
        }
      }
      let newAssetId = '';
      try {
        const added = await writeCatalog(projectId, 'media-assets', current.revision, { schemaVersion: 1,
          catalogItemId: ownedId, kind: 'audio', location: { type: 'private_object', objectId: uploaded.id },
          tvDisplayRights: rights('television_display', rightsConfirmed),
          tvPlaybackRights: rights('television_playback', rightsConfirmed), deliveryEligible: false });
        newAssetId = added.record.id;
        current = await refresh();
        current = await updateBook(current, ownedId, { audiobook: { audioAssetId: newAssetId } });
      } catch (value) {
        if (newAssetId) {
          const latest = await refresh().catch(() => null);
          if (latest && latest.items.find(value => value.id === ownedId)?.audiobook?.audioAssetId !== newAssetId) {
            await deleteCatalogRecord(projectId, 'media-assets', latest.revision, newAssetId).catch(() => undefined);
            await deletePrivateObject(projectId, uploaded.id).catch(() => undefined);
          }
        } else await deletePrivateObject(projectId, uploaded.id).catch(() => undefined);
        throw value;
      }
      if (old) {
        await deleteCatalogRecord(projectId, 'media-assets', current.revision, old.id);
        current = await refresh();
        if (old.location.type === 'private_object') await deletePrivateObject(projectId, old.location.objectId);
      }
      setAudioFile(null); setListening(false);
    } else if (audiobook && !audiobook.deliveryEligible &&
      rightsConfirmed && audiobook.tvPlaybackRights?.status !== 'cleared') {
      const { id, creatorAccountId: _owner, projectId: _project, ...record } = audiobook;
      await writeCatalog(projectId, 'media-assets', current.revision, { ...record,
        tvPlaybackRights: rights('television_playback', rightsConfirmed), deliveryEligible: false }, id);
      current = await refresh(); setListening(false);
    }
    if (newBookshelf.trim()) {
      const added = await writeCatalog(projectId, 'collections', current.revision, {
        schemaVersion: 1, kind: 'bookshelf', title: newBookshelf.trim(), itemIds: [ownedId] });
      setBookshelfId(added.record.id); setNewBookshelf(''); current = await refresh();
    } else if (bookshelfId) {
      const selected = current.collections.find(value => value.id === bookshelfId && value.kind === 'bookshelf');
      if (!selected) throw new Error('Choose an available bookshelf.');
      if (!selected.itemIds.includes(ownedId)) {
        const { id, creatorAccountId: _owner, projectId: _project, ...record } = selected;
        await writeCatalog(projectId, 'collections', current.revision, { ...record, itemIds: [...record.itemIds, ownedId] }, id);
      }
    }
    await refresh();
    return 'Book saved privately. Book-only has no Play action.';
  }); };
  const removeAudiobook = () => void doWork(async () => {
    if (!inventory || !audiobook || audiobook.deliveryEligible) throw new Error('Approved audiobook delivery must be revoked before removal.');
    const next = await updateBook(inventory, item!.id, { audiobook: null });
    await deleteCatalogRecord(projectId, 'media-assets', next.revision, audiobook.id);
    if (audiobook.location.type === 'private_object') await deletePrivateObject(projectId, audiobook.location.objectId);
    setListening(false); setAttachAudio(false); setRightsConfirmed(false); await refresh();
    return 'Audiobook removed. The book and its cover remain saved.';
  });
  const revokeAudiobook = () => void doWork(async () => {
    if (!inventory || !audiobook || audiobook.deliveryEligible) throw new Error('Approved audiobook delivery needs separate revocation review.');
    const { id, creatorAccountId: _owner, projectId: _project, ...record } = audiobook;
    await writeCatalog(projectId, 'media-assets', inventory.revision, { ...record,
      tvPlaybackRights: { ...unknown(), status: 'revoked' }, deliveryEligible: false }, id);
    setListening(false); setRightsConfirmed(false); await refresh();
    return 'Audiobook playback revoked. The book and cover remain saved.';
  });
  const listen = () => {
    if (!audiobook || audiobook.location.type !== 'private_object' || audiobook.tvPlaybackRights?.status !== 'cleared') return;
    setAudioUrl(`/api/projects/${encodeURIComponent(projectId)}/private-objects/${encodeURIComponent(audiobook.location.objectId)}/audio`);
    setListening(true);
  };
  return <StudioModal className="video-workspace book-workspace" titleId="book-workspace-title" descriptionId="book-workspace-description" onClose={onClose} closeDisabled={busy} guardUnsaved resetDirtyKey={inventory?.revision}>
    <ModalHeader eyebrow="PRIVATE BOOK WORKSPACE" title={item ? title || 'Book draft' : 'Add Book'} titleId="book-workspace-title"
      descriptionId="book-workspace-description" description="Save a book showcase with optional audiobook." onClose={onClose} closeDisabled={busy}/>
    <div className="video-workspace-body">
      {error && <p role="alert" className="catalog-error">{error}</p>}{message && <p role="status">{message}</p>}
      {!inventory && !error && <p>Loading book library…</p>}
      {itemId && inventory && !item && <p role="alert">This book is unavailable in this channel.</p>}
      {inventory && (!itemId || item) && <form onSubmit={save} className="audio-workspace-form">
        <label className="field">TITLE<input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)}/></label>
        <label className="field">AUTHOR<input required maxLength={160} value={author} onChange={event => setAuthor(event.target.value)}/></label>
        <label className="field">SYNOPSIS<textarea maxLength={4000} value={synopsis} onChange={event => setSynopsis(event.target.value)}/></label>
        <div className="audio-workspace-fields"><label className="field">ISBN (OPTIONAL)<input value={isbn} onChange={event => setIsbn(event.target.value)}/></label>
          <label className="field">SERIES<input maxLength={160} value={series} onChange={event => setSeries(event.target.value)}/></label>
          <label className="field">PUBLICATION DATE<input type="date" value={publicationDate} onChange={event => setPublicationDate(event.target.value)}/></label></div>
        <label className="field">PORTRAIT COVER · PNG OR JPEG · UNDER 1 MB<input type="file" accept="image/png,image/jpeg" onChange={event => { setCover(event.target.files?.[0] ?? null); setRightsConfirmed(false); }}/></label>
        {item && <OwnedArtwork item={item} assets={inventory.mediaAssets} projectId={projectId} accountId={accountId}
          className="book-workspace-cover" fallback={<span>◇</span>}/>}
        {(cover || (attachAudio && audioFile) || (item && !rightsConfirmed)) && <label className="check"><input type="checkbox" checked={rightsConfirmed} onChange={event => setRightsConfirmed(event.target.checked)}/> I confirm I own or have permission to show this cover{attachAudio ? ' and play this audiobook' : ''} in my channel.</label>}
        <label className="field">BOOKSHELF<select value={bookshelfId} onChange={event => setBookshelfId(event.target.value)}><option value="">No bookshelf</option>
          {inventory.collections.filter(value => value.kind === 'bookshelf').map(value => <option key={value.id} value={value.id}>{value.title}</option>)}</select></label>
        <label className="field">NEW BOOKSHELF<input maxLength={160} value={newBookshelf} onChange={event => setNewBookshelf(event.target.value)}/></label>
        <label className="check"><input type="checkbox" checked={attachAudio} onChange={event => setAttachAudio(event.target.checked)}/> Attach audiobook MP3</label>
        {attachAudio && <><label className="field">NARRATOR<input maxLength={160} value={narrator} onChange={event => setNarrator(event.target.value)}/></label>
          <label className="field">AUDIOBOOK MP3 · UP TO 2 HOURS / 320 MB<input type="file" accept=".mp3,audio/mpeg" onChange={event => { setAudioFile(event.target.files?.[0] ?? null); setRightsConfirmed(false); }}/></label>
          </>}
        <ModalFooter><button type="button" disabled={busy} onClick={onClose} data-modal-close>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving privately…' : 'Save book draft'}</button></ModalFooter>
      </form>}
      {item && <div className="audio-workspace-summary"><strong>Saved status: PRIVATE</strong>
        <p>{audiobook ? 'Audiobook attached privately.' : 'Book showcase · no Play.'}</p>
        {audiobook && <>{audiobook.tvPlaybackRights?.status !== 'cleared' && <p>Needs attention · audiobook playback permission {audiobook.tvPlaybackRights?.status === 'revoked' ? 'revoked' : 'not confirmed'}.</p>}
          <div className="button-row"><button type="button" disabled={busy || audiobook.tvPlaybackRights?.status !== 'cleared' || audiobook.location.type !== 'private_object'} onClick={listen}>Listen to Audiobook privately</button>
            <button type="button" disabled={busy || audiobook.deliveryEligible || audiobook.tvPlaybackRights?.status === 'revoked'} onClick={revokeAudiobook}>Revoke audiobook playback</button>
            <button type="button" disabled={busy || audiobook.deliveryEligible} onClick={removeAudiobook}>Remove audiobook</button></div></>}
        {listening && audioUrl && audiobook?.tvPlaybackRights?.status === 'cleared' &&
          <AudioPlayer source={audioUrl} title={title} creator={narrator} onBack={() => setListening(false)} artwork={<OwnedArtwork item={item} assets={inventory!.mediaAssets}
            projectId={projectId} accountId={accountId} className="audio-workspace-player-art" fallback={<span>◇</span>}/>}/>}</div>}
    </div></StudioModal>;
}
