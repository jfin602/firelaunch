import React, { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ChannelMutation } from '@firelaunch/channel-engine';
import { createPageFromTemplate, type ChannelProject, type ContentItem, type Module, type PageTemplate } from '@firelaunch/contracts';
import { ApiError, askAgent, createProject, getProject, getSession, listProjects, logout, mutateProject, readCatalog, type CatalogSelection, type CatalogSnapshot, type StudioSession } from './api.js';
import { Preview, PreviewArtwork, eligibleStaticImageContent } from './Preview.js';
import { Delivery } from './Delivery.js';
import { Catalog } from './Catalog.js';
import { Home } from './Home.js';
import { VideoWorkspace } from './VideoWorkspace.js';
import { clearVideoTransfers, stopVideoTransfer, subscribeVideoTransfers, videoTransfers, type VideoTransfer } from './video-transfer.js';
import { sampleMutations } from './sample.js';

function newId(kind: 'page' | 'mod' | 'item'): string {
  return `${kind}_${crypto.randomUUID().replaceAll('-', '')}`;
}

type Surface = 'Home' | 'Library' | 'Channel' | 'Publish' | 'Export';
type ChannelView = 'Pages & Layout' | 'Appearance';
type ExportView = 'Build & Download' | 'Advanced Source';
const surfaces: Surface[] = ['Home', 'Library', 'Channel', 'Publish', 'Export'];
const channelViews: ChannelView[] = ['Pages & Layout', 'Appearance'];
const exportViews: ExportView[] = ['Build & Download', 'Advanced Source'];
const icons: Record<Surface, string> = { Home: '⌂', Library: '▤', Channel: '◈', Publish: '↗', Export: '⬡' };

function VideoTransferNotice({ accountId, projectId, onOpen }: { accountId: string; projectId: string; onOpen: (itemId: string) => void }) {
  const [tasks, setTasks] = useState<VideoTransfer[]>([]);
  useEffect(() => {
    const update = () => setTasks(videoTransfers(accountId, projectId).map(task => ({ ...task })));
    update(); return subscribeVideoTransfers(update);
  }, [accountId, projectId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!videoTransfers(accountId).some(task => task.state === 'uploading')) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [accountId, projectId]);
  return <>{tasks.filter(task => task.state === 'uploading' || task.state === 'failed' || task.state === 'stopped').map(task =>
    <div className="video-transfer-banner" role="status" key={task.itemId}>
      <span>{task.state === 'uploading' ? task.progress === 100 ? 'Private video upload sent · finishing verification · Keep this tab open' : `Private video upload · ${task.progress}% · Keep this tab open` : task.error}</span>
      <button type="button" onClick={() => onOpen(task.itemId)}>Open video</button>
      {task.state === 'uploading' && <button type="button" onClick={() => stopVideoTransfer(accountId, projectId, task.itemId)}>Stop upload</button>}
    </div>)}</>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Intro({ onCreate, busy, hosted }: { onCreate: (title: string, sample: boolean, request: string, catalog: boolean) => Promise<void>; busy: boolean; hosted: boolean }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [sample, setSample] = useState(!hosted);
  const [request, setRequest] = useState('');
  const [catalog, setCatalog] = useState(hosted);
  return <div className="welcome"><div className="welcome-symbol">✳</div><span className="eyebrow">YOUR CHANNEL STARTS HERE</span><h1>Stories belong<br/><em>on the big screen.</em></h1><p>Shape your brand, curate a collection, and explore the TV experience before writing a line of code.</p>
    <div className="welcome-form"><div className="steps"><span className={step === 0 ? 'current' : ''}>01 Identity</span><span className={step === 1 ? 'current' : ''}>02 First look</span></div>
      {step === 0 ? <form onSubmit={event => { event.preventDefault(); if (title.trim()) setStep(1); }}><Field label="CHANNEL NAME"><input autoFocus required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Wild Earth" /></Field><button className="primary" type="submit">Continue <span>→</span></button></form>
        : <div><h2>{title}</h2>{hosted && <><label className="check"><input type="radio" name="entry" checked={catalog} onChange={() => setCatalog(true)}/> Start with my catalog</label><label className="check"><input type="radio" name="entry" checked={!catalog} onChange={() => setCatalog(false)}/> Start with a prompt</label></>}{catalog ? <p>Create a private channel workspace, then add a creator-controlled file, feed snapshot or manual first item. Inventory stays draft until separately approved for TV.</p> : <><p>{hosted ? 'Start a blank private draft, then attach your reviewed catalog media. No demo video is added to hosted channels.' : 'Start with original concept artwork and a procedural local demo clip, or begin blank.'}</p>{!hosted && <label className="check"><input type="checkbox" checked={sample} onChange={event => setSample(event.target.checked)} /> Add rights-safe demo collection</label>}<Field label="INITIAL AGENT REQUEST (OPTIONAL)"><textarea maxLength={2000} value={request} onChange={event => setRequest(event.target.value)} placeholder="e.g. Add page Explore" /></Field></>}<div className="button-row"><button onClick={() => setStep(0)}>← Back</button><button className="primary" disabled={busy} onClick={() => void onCreate(title.trim(), !catalog && sample, catalog ? '' : request.trim(), catalog)}>{busy ? 'Creating…' : 'Create channel →'}</button></div></div>}
    </div></div>;
}

function Design({ project, commit, onDirtyChange }: { project: ChannelProject; commit: (mutation: ChannelMutation) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void }) {
  const { spec } = project;
  const [brand, setBrand] = useState(spec.brand);
  const [title, setTitle] = useState(spec.title);
  useEffect(() => { setBrand(spec.brand); setTitle(spec.title); }, [project.id, project.revision]);
  useEffect(() => { onDirtyChange(title !== spec.title || JSON.stringify(brand) !== JSON.stringify(spec.brand)); }, [title, brand, spec.title, spec.brand, onDirtyChange]);
  return <div className="panel-content"><span className="eyebrow">CHANNEL IDENTITY</span><h2>Make it yours.</h2><p className="muted">Every change becomes part of your ChannelSpec and flows into Preview.</p>
    <form onSubmit={event => { event.preventDefault(); void commit({ type: 'setIdentity', title: title.trim(), slug: spec.slug }); }}><Field label="DISPLAY NAME"><input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></Field><button disabled={title.trim() === spec.title}>Save name</button></form>
    <form onSubmit={event => { event.preventDefault(); void commit({ type: 'setBrand', brand }); }}><div className="color-fields">{(['primaryColor', 'backgroundColor', 'textColor'] as const).map(key => <Field key={key} label={key.replace('Color', '').toUpperCase()}><div className="color-input"><input type="color" value={brand[key]} onChange={event => setBrand({ ...brand, [key]: event.target.value })}/><code>{brand[key]}</code></div></Field>)}</div>
      <Field label="TYPOGRAPHY"><select value={brand.typography} onChange={event => setBrand({ ...brand, typography: event.target.value as 'sans' | 'serif' })}><option value="sans">Modern sans</option><option value="serif">Editorial serif</option></select></Field>
      <Field label="LOGO ARTWORK URL OR ASSET PATH"><input value={brand.logo ?? ''} onChange={event => setBrand({ ...brand, logo: event.target.value || undefined })} placeholder="https://… or assets/logo.png" /></Field>
      <Field label="HERO ARTWORK URL OR ASSET PATH"><input value={brand.heroArtwork ?? ''} onChange={event => setBrand({ ...brand, heroArtwork: event.target.value || undefined })} placeholder="https://… or assets/hero.png" /></Field>
      <label className="check"><input type="checkbox" checked={brand.showTitle} onChange={event => setBrand({ ...brand, showTitle: event.target.checked })} /> Show channel title on TV</label><button className="primary" disabled={JSON.stringify(brand) === JSON.stringify(spec.brand)}>Save brand →</button>
    </form></div>;
}

type StaticModule = Extract<Module, { kind: 'image-banner' | 'image-text' }>;
function StaticModuleEditor({ module, pageId, imageItems, commit, onDirtyChange }: { module: StaticModule; pageId: string; imageItems: ContentItem[]; commit: (mutation: ChannelMutation) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<StaticModule>(module);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const dirty = JSON.stringify(draft) !== JSON.stringify(module);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const change = (next: StaticModule) => { setDraft(next); setStatus('idle'); };
  const save = async () => { setStatus('saving'); setStatus(await commit({ type: 'updateModule', pageId, module: draft }) ? 'saved' : 'failed'); };
  return <div className="module-editor"><strong>{module.kind === 'image-banner' ? 'Image Banner' : 'Image + Text'}</strong>
    <label className="field"><span>Headline</span><input aria-label="Section headline" maxLength={120} value={draft.title} onChange={event => change({ ...draft, title: event.target.value })}/></label>
    <label className="field"><span>Text</span><textarea aria-label="Section text" maxLength={2000} value={draft.body} onChange={event => change({ ...draft, body: event.target.value })}/></label>
    <label className="field"><span>Image from Library</span><select aria-label="Section image" value={draft.imageContentId ?? ''} onChange={event => { if (event.target.value) change({ ...draft, imageContentId: event.target.value }); else { const { imageContentId: _removed, ...withoutImage } = draft; change(withoutImage as StaticModule); } }}><option value="">Choose an image</option>{imageItems.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    {draft.imageContentId && !imageItems.some(item => item.id === draft.imageContentId) && <p role="alert">This image is no longer eligible for TV display. Choose another image or clear it.</p>}
    {imageItems.length === 0 && <small>Add display-cleared artwork in Library, then return here. Private drafts remain unpublished.</small>}
    <details><summary>Customize</summary>
      <label className="field"><span>Image crop</span><select aria-label="Image crop" value={draft.crop ?? 'cover'} onChange={event => change({ ...draft, crop: event.target.value as 'cover' | 'contain' })}><option value="cover">Fill</option><option value="contain">Fit</option></select></label>
      <label className="field"><span>Text alignment</span><select aria-label="Text alignment" value={draft.alignment ?? 'left'} onChange={event => change({ ...draft, alignment: event.target.value as 'left' | 'center' })}><option value="left">Left</option><option value="center">Center</option></select></label>
      <label className="field"><span>Spacing</span><select aria-label="Section spacing" value={draft.spacing ?? 'comfortable'} onChange={event => change({ ...draft, spacing: event.target.value as 'comfortable' | 'compact' })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      <label className="field"><span>Background</span><select aria-label="Section background" value={draft.background ?? 'theme'} onChange={event => change({ ...draft, background: event.target.value as 'theme' | 'surface' })}><option value="theme">Channel</option><option value="surface">Raised</option></select></label>
      {draft.kind === 'image-text' && <label className="field"><span>Image side</span><select aria-label="Image side" value={draft.imageSide ?? 'left'} onChange={event => change({ ...draft, imageSide: event.target.value as 'left' | 'right' })}><option value="left">Left</option><option value="right">Right</option></select></label>}
    </details><div className="button-row"><button className="primary" type="button" disabled={!dirty || !draft.title.trim() || status === 'saving'} onClick={() => void save()}>Save changes</button><button type="button" disabled={!dirty || status === 'saving'} onClick={() => { setDraft(module); setStatus('idle'); }}>Cancel edits</button></div>
    <p role="status">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved privately' : status === 'failed' ? 'Failed to save. Your edits are still here.' : dirty ? 'Unsaved changes' : ''}</p><small>New static layouts require an updated native app before live publication.</small>
  </div>;
}

function ModuleEditor({ module, pageId, items, imageItems, commit, onDirtyChange }: { module: Module; pageId: string; items: ContentItem[]; imageItems: ContentItem[]; commit: (mutation: ChannelMutation) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void }) {
  if (module.kind === 'image-banner' || module.kind === 'image-text') return <StaticModuleEditor module={module} pageId={pageId} imageItems={imageItems} commit={commit} onDirtyChange={onDirtyChange}/>;
  const [title, setTitle] = useState(module.title ?? '');
  const [body, setBody] = useState(module.kind === 'text' ? module.body : '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const dirty = title !== (module.title ?? '') || (module.kind === 'text' && body !== module.body);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const save = async (next: Module) => { setStatus('saving'); setStatus(await commit({ type: 'updateModule', pageId, module: next }) ? 'saved' : 'failed'); };
  return <div className="module-editor"><div className="module-top"><strong>{module.kind === 'rail' ? 'Content Row' : module.kind === 'grid' ? 'Content Grid' : module.kind === 'text' ? 'Text Area' : 'Featured Hero'}</strong></div>
    {module.kind !== 'hero' && <><label className="field"><span>Heading</span><input aria-label="Section heading" maxLength={120} value={title} onChange={event => { setTitle(event.target.value); setStatus('idle'); }} /></label></>}
    {module.kind === 'text' ? <label className="field"><span>Text</span><textarea aria-label="Section text" maxLength={2000} value={body} onChange={event => { setBody(event.target.value); setStatus('idle'); }} /></label> : <><strong>Choose content</strong><div className="chips" aria-label="Choose content from Library">{items.map(item => <label className="check" key={item.id}><input type="checkbox" checked={module.contentIds.includes(item.id)} onChange={event => void save({ ...module, contentIds: event.target.checked ? [...module.contentIds, item.id] : module.contentIds.filter(id => id !== item.id) })} disabled={status === 'saving' || (module.kind === 'hero' && !module.contentIds.includes(item.id) && module.contentIds.length > 0)} />{item.title}</label>)}</div>{items.length === 0 && <small>Add content in Library, then return here to choose it.</small>}</>}
    {module.kind === 'text' && <small>Edit text here. It stays private until you publish.</small>}
    {module.kind !== 'hero' && <div className="button-row"><button className="primary" type="button" disabled={!dirty || !title.trim() || status === 'saving'} onClick={() => void save(module.kind === 'text' ? { ...module, title: title.trim(), body } : { ...module, title: title.trim() })}>Save changes</button><button type="button" disabled={!dirty || status === 'saving'} onClick={() => { setTitle(module.title ?? ''); setBody(module.kind === 'text' ? module.body : ''); setStatus('idle'); }}>Cancel edits</button></div>}
    <p role="status">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved privately' : status === 'failed' ? 'Failed to save. Your edits are still here.' : dirty ? 'Unsaved changes' : ''}</p>
    <details><summary>Customize</summary><p>Section appearance follows your channel theme.</p></details>
  </div>;
}


function Content({ project, commit, onDirtyChange, accountId, libraryRevision, pageId, onPageSelect }: { project: ChannelProject; commit: (mutation: ChannelMutation) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void; accountId: string | undefined; libraryRevision: number; pageId: string; onPageSelect: (pageId: string) => void }) {
  const { spec } = project;
  const [inventory, setInventory] = useState<CatalogSnapshot | null>(null);
  useEffect(() => {
    if (!accountId) return;
    let active = true; setInventory(null);
    void readCatalog(project.id).then(snapshot => { if (active && snapshot.projectId === project.id && snapshot.creatorAccountId === accountId &&
      [...snapshot.items, ...snapshot.mediaAssets].every(value => value.projectId === project.id && value.creatorAccountId === accountId)) setInventory(snapshot); }).catch(() => undefined);
    return () => { active = false; };
  }, [project.id, accountId, libraryRevision]);
  const imageItems = eligibleStaticImageContent(spec, inventory, accountId);
  const [selection, setSelection] = useState<'page' | string | null>(null);
  const selectionOpener = useRef<HTMLButtonElement | null>(null);
  const selectionClose = useRef<HTMLButtonElement | null>(null);
  const [name, setName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [newPage, setNewPage] = useState('');
  const [pageTemplate, setPageTemplate] = useState<PageTemplate>('rows');
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [pageError, setPageError] = useState('');
  const [pageSaving, setPageSaving] = useState(false);
  const pageSubmitting = useRef(false);
  const pageOpener = useRef<HTMLButtonElement>(null);
  const pageName = useRef<HTMLInputElement>(null);
  const pageDialog = useRef<HTMLDivElement>(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [kind, setKind] = useState<Module['kind']>('rail');
  const [sectionStatus, setSectionStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [sectionBusy, setSectionBusy] = useState(false);
  const sectionDirty = useRef(false);
  const setSectionDirty = useCallback((dirty: boolean) => { sectionDirty.current = dirty; onDirtyChange(dirty || Boolean(moduleTitle.trim())); }, [onDirtyChange, moduleTitle]);
  useEffect(() => { onDirtyChange(sectionDirty.current || Boolean(moduleTitle.trim())); }, [moduleTitle, onDirtyChange]);
  useEffect(() => { if (selection === 'page') setSectionDirty(Boolean(name)); }, [selection, name]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (!sectionDirty.current) return; event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, []);
  const canLeaveSection = () => !(sectionDirty.current || moduleTitle.trim()) || window.confirm('Discard unsaved section edits?');
  const runSectionMutation = async (mutation: ChannelMutation) => { if (sectionBusy) return false; setSectionBusy(true); setSectionStatus('saving'); try { const saved = await commit(mutation); setSectionStatus(saved ? 'saved' : 'failed'); return saved; } finally { setSectionBusy(false); } };
  const page = spec.pages.find(candidate => candidate.id === pageId) ?? spec.pages[0]!;
  const selectedModule = page.modules.find(module => module.id === selection);
  useEffect(() => { if (selection) selectionClose.current?.focus(); }, [selection]);
  useEffect(() => { if (selection && selection !== 'page' && !selectedModule) setSelection(null); }, [selection, selectedModule]);
  const closeSelection = () => { if (!canLeaveSection()) return; setSectionDirty(false); setName(''); setSelection(null); window.setTimeout(() => selectionOpener.current?.focus(), 0); };
  useEffect(() => {
    if (!selection) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); closeSelection(); } };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [selection]);
  const selectPage = (id: string) => { if (!canLeaveSection()) return; setSectionDirty(false); setModuleTitle(''); onPageSelect(id); setSelection(null); setName(''); setRenameError(''); };
  const addModule = async () => {
    const id = newId('mod');
    const module: Module = kind === 'text' ? { id, kind, title: moduleTitle.trim() || 'About', body: '' }
      : kind === 'image-banner' || kind === 'image-text' ? { id, kind, title: moduleTitle.trim() || (kind === 'image-banner' ? 'Image Banner' : 'Image + Text'), body: '' }
      : kind === 'hero' ? { id, kind, contentIds: [] }
      : { id, kind, title: moduleTitle.trim() || 'Collection', contentIds: [] };
    if (await runSectionMutation({ type: 'addModule', pageId: page.id, module })) { setModuleTitle(''); setSelection(id); }
  };
  useEffect(() => { if (pageDialogOpen) pageName.current?.focus(); }, [pageDialogOpen]);
  const closePageDialog = () => {
    if (pageSubmitting.current) return;
    setPageDialogOpen(false); setPageError(''); setNewPage(''); setPageTemplate('rows');
    window.setTimeout(() => pageOpener.current?.focus(), 0);
  };
  const createPage = async (event: FormEvent) => {
    event.preventDefault();
    if (pageSubmitting.current) return;
    const title = newPage.trim();
    if (!title) { setPageError('Enter a page name.'); pageName.current?.focus(); return; }
    if (spec.pages.some(candidate => candidate.title.toLocaleLowerCase() === title.toLocaleLowerCase())) {
      setPageError('A page with this name already exists. Choose another name.'); pageName.current?.focus(); return;
    }
    const next = createPageFromTemplate(newId('page'), title, pageTemplate);
    pageSubmitting.current = true; setPageSaving(true); setPageError('');
    try {
      if (await commit({ type: 'addPage', page: next })) {
        selectPage(next.id); setPageDialogOpen(false); setNewPage(''); setPageTemplate('rows');
        window.setTimeout(() => document.querySelector<HTMLButtonElement>(`[data-page-id="${next.id}"]`)?.focus(), 0);
      } else setPageError('Page was not saved. Review the message above, then try again.');
    } finally { pageSubmitting.current = false; setPageSaving(false); }
  };
  const onPageDialogKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); closePageDialog(); return; }
    if (event.key !== 'Tab') return;
    const controls = Array.from(pageDialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)') ?? []);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <div className={`layout-workspace ${selection ? 'layout-has-inspector' : ''}`}><nav className="layout-page-rail" aria-label="Channel pages"><span className="eyebrow">PAGES</span>{spec.navigation.map(id => { const target = spec.pages.find(candidate => candidate.id === id)!; return <button key={id} type="button" data-page-id={id} className={page.id === id ? 'active' : ''} aria-current={page.id === id ? 'page' : undefined} onClick={() => selectPage(id)}>{target.title}</button>; })}<button ref={pageOpener} className="primary" type="button" onClick={() => { if (canLeaveSection()) setPageDialogOpen(true); }}>New page</button></nav><div className="layout-composition"><span className="eyebrow">DRAFT PAGE LAYOUT</span><h2>{page.title}</h2><p className="muted">Sections appear in this order. TV Preview above is interactive and shows your draft; publishing is separate.</p><button type="button" ref={selection === 'page' ? selectionOpener : undefined} aria-expanded={selection === 'page'} onClick={event => { if (!canLeaveSection()) return; selectionOpener.current = event.currentTarget; setSelection('page'); }}>Edit page</button>
    {page.modules.length === 0 && <p className="module-empty">This page has no sections yet. Add a section below to begin.</p>}
    <div className="layout-sections">{page.modules.map((module, index) => <section key={module.id} className={`layout-section layout-${module.kind}`} aria-label={`${module.kind} section ${index + 1}`}><div className="layout-section-heading"><span>{index + 1} · {module.kind === 'rail' ? 'Content Row' : module.kind === 'text' ? 'Text Area' : module.kind === 'hero' ? 'Featured Hero' : module.kind === 'image-banner' ? 'Image Banner' : module.kind === 'image-text' ? 'Image + Text' : 'Content Grid'}</span><button type="button" aria-expanded={selection === module.id} data-section-id={module.id} onClick={event => { if (!canLeaveSection()) return; selectionOpener.current = event.currentTarget; setSelection(module.id); }}>Edit section</button></div>{module.title && <h3>{module.title}</h3>}{module.kind === 'text' ? <p>{module.body || 'Add text in the section inspector.'}</p> : module.kind === 'image-banner' || module.kind === 'image-text' ? <div className="layout-static">{module.imageContentId && imageItems.some(item => item.id === module.imageContentId) && (() => { const image = spec.content.find(item => item.id === module.imageContentId); return image ? <PreviewArtwork contentId={image.id} source={image.artwork} inventory={inventory} projectId={project.id} accountId={accountId}/> : null; })()}{(!module.imageContentId || !imageItems.some(item => item.id === module.imageContentId)) && <p className="module-empty">Choose an eligible image from Library.</p>}{module.body ? <p className="layout-static-copy">{module.body}</p> : <p className="module-empty">Write text in the section inspector.</p>}</div> : module.contentIds.length ? <div className="layout-tiles">{module.contentIds.map(id => { const item = spec.content.find(candidate => candidate.id === id); return item && <div key={id} className="layout-tile"><img src={item.artwork.startsWith('assets/') ? `/media/${item.artwork.slice(7)}` : item.artwork} alt=""/><span>{item.title}</span></div>; })}</div> : <p className="module-empty">Choose content for {module.kind === 'hero' ? 'the featured section' : module.title ?? 'this section'}.</p>}<div className="button-row"><button type="button" disabled={index === 0 || sectionBusy} aria-label={`Move ${module.title ?? 'Featured Hero'} up`} onClick={() => { const ids = page.modules.map(item => item.id); [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!]; void runSectionMutation({ type: 'reorderModules', pageId: page.id, moduleIds: ids }); }}>Move up</button><button type="button" disabled={index === page.modules.length - 1 || sectionBusy} aria-label={`Move ${module.title ?? 'Featured Hero'} down`} onClick={() => { const ids = page.modules.map(item => item.id); [ids[index + 1], ids[index]] = [ids[index]!, ids[index + 1]!]; void runSectionMutation({ type: 'reorderModules', pageId: page.id, moduleIds: ids }); }}>Move down</button><button type="button" className="danger" disabled={sectionBusy} onClick={() => { if (!canLeaveSection()) return; if (((module.kind === 'text' || module.kind === 'image-banner' || module.kind === 'image-text') && (module.body || module.title || ('imageContentId' in module && module.imageContentId))) || ((module.kind === 'hero' || module.kind === 'rail' || module.kind === 'grid') && (module.contentIds.length || (module.kind !== 'hero' && module.title)))) if (!window.confirm('Remove this section? Its text, content choices and settings will be lost. Library content remains available.')) return; void runSectionMutation({ type: 'removeModule', pageId: page.id, moduleId: module.id }).then(saved => { if (saved) { if (selection === module.id) setSelection(null); window.setTimeout(() => (document.querySelector<HTMLButtonElement>(`[data-section-id="${page.modules[index + 1]?.id ?? page.modules[index - 1]?.id ?? ''}"]`) ?? document.querySelector<HTMLButtonElement>('.section-add button'))?.focus(), 0); } }); }}>Remove section</button></div></section>)}</div>
    <div className="section-add"><h3>Add Section</h3><label>Section type <select aria-label="Section type" value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="hero">Featured Hero</option><option value="rail">Content Row</option><option value="grid">Content Grid</option><option value="text">Text Area</option><option value="image-banner">Image Banner</option><option value="image-text">Image + Text</option></select></label>{kind !== 'hero' && <label>Heading <input aria-label="New section heading" placeholder="Section heading" maxLength={120} value={moduleTitle} onChange={event => setModuleTitle(event.target.value)}/></label>}<button className="primary" type="button" disabled={sectionBusy || page.modules.length >= 30} onClick={() => void addModule()}>Add section</button>{page.modules.length >= 30 && <small>Maximum 30 sections per page.</small>}<p role="status">{sectionStatus === 'saving' ? 'Saving…' : sectionStatus === 'saved' ? 'Saved privately' : sectionStatus === 'failed' ? 'Failed to save. Try again.' : ''}</p></div>
    {pageDialogOpen && <div className="page-dialog-backdrop"><div ref={pageDialog} role="dialog" aria-modal="true" aria-labelledby="new-page-heading" className="page-dialog" onKeyDown={onPageDialogKeyDown}>
      <h3 id="new-page-heading">Create a page</h3><p>Name your page and choose a starting layout. You can choose content after creating it.</p>
      <form onSubmit={event => void createPage(event)}><label htmlFor="new-page-name">Page name</label><input ref={pageName} id="new-page-name" maxLength={120} required value={newPage} onChange={event => { setNewPage(event.target.value); setPageError(''); }} />
        <fieldset><legend>Starting layout</legend><div className="page-template-options">{(['hero', 'grid', 'rows'] as const).map(choice => <label key={choice} className={`page-template-option ${pageTemplate === choice ? 'selected' : ''}`}><input type="radio" name="page-template" value={choice} checked={pageTemplate === choice} onChange={() => setPageTemplate(choice)} /><span className={`page-template-preview ${choice}`} aria-hidden="true"><i/><i/><i/><i/></span><strong>{choice === 'hero' ? 'Hero' : choice === 'grid' ? 'Grid' : 'Rows'}</strong><small>{choice === 'hero' ? 'A featured video and a row' : choice === 'grid' ? 'A collection of video tiles' : 'Two video rows'}</small></label>)}</div></fieldset>
        {pageError && <p className="page-dialog-error" role="alert">{pageError}</p>}
        <div className="button-row"><button type="button" onClick={closePageDialog} disabled={pageSaving}>Cancel</button><button className="primary" type="submit" disabled={pageSaving}>{pageSaving ? 'Creating…' : 'Create page'}</button></div>
      </form></div></div>}
    </div>{selection && <aside className="inspector layout-inspector" aria-label="Layout inspector"><div className="inspector-heading"><strong>Selected: {selection === 'page' ? page.title : selectedModule?.title ?? (selectedModule?.kind === 'hero' ? 'Featured Hero' : 'Section')}</strong><button ref={selectionClose} type="button" aria-label="Close layout inspector" onClick={closeSelection}>Close</button></div><div className="panel-content">{selection === 'page' ? <><Field label="PAGE NAME"><input value={name} onChange={event => { setName(event.target.value); setRenameError(''); }} placeholder={page.title} maxLength={120}/></Field><button type="button" className="primary" disabled={!name.trim() || name.trim() === page.title} onClick={() => { if (spec.pages.some(candidate => candidate.id !== page.id && candidate.title.toLocaleLowerCase() === name.trim().toLocaleLowerCase())) { setRenameError('A page with this name already exists.'); return; } void commit({ type: 'updatePage', pageId: page.id, title: name.trim() }).then(saved => { if (saved) setName(''); }); }}>Rename page</button>{renameError && <p role="alert">{renameError}</p>}<button type="button" className="danger" disabled={spec.pages.length === 1} onClick={() => { if (!window.confirm(`Delete page ${page.title}? Its sections will be removed.`)) return; void commit({ type: 'removePage', pageId: page.id }).then(saved => { if (saved) { selectPage(spec.navigation.find(id => id !== page.id)!); window.setTimeout(() => pageOpener.current?.focus(), 0); } }); }}>Delete page</button>{spec.pages.length === 1 && <small>The channel needs at least one page.</small>}</> : selectedModule && <ModuleEditor key={selectedModule.id} module={selectedModule} pageId={page.id} items={spec.content} imageItems={imageItems} commit={commit} onDirtyChange={setSectionDirty} />}</div></aside>}</div>;
}

export default function App() {
  const [projects, setProjects] = useState<ChannelProject[]>([]);
  const [project, setProject] = useState<ChannelProject | null>(null);
  const [editorPageSelection, setEditorPageSelection] = useState<{ projectId: string; pageId: string } | null>(null);
  const projectRef = useRef<ChannelProject | null>(null);
  const [surface, setSurface] = useState<Surface>('Library');
  const [channelView, setChannelView] = useState<ChannelView>('Pages & Layout');
  const [exportView, setExportView] = useState<ExportView>('Build & Download');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newChannel, setNewChannel] = useState(false);
  const [catalogSelections, setCatalogSelections] = useState<Record<string, { selection: CatalogSelection; creator: 'video' | 'audio' | 'writing' }>>({});
  const [session, setSession] = useState<StudioSession | null>(null);
  const [videoSelection, setVideoSelection] = useState<{ projectId: string; accountId: string; itemId?: string } | null>(null);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [signedOut, setSignedOut] = useState(false);
  const [inspectorProject, setInspectorProject] = useState<string | null>(null);
  const [previewFullscreen, setPreviewFullscreen] = useState<'native' | 'fallback' | null>(null);
  const [fullscreenNotice, setFullscreenNotice] = useState('');
  const [dockVisible, setDockVisible] = useState(false);
  const [appearanceDraftPending, setAppearanceDraftPending] = useState(false);
  const fullscreenRoot = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLElement>(null);
  const dockHover = useRef(false);
  const dockHideTimer = useRef<number | null>(null);
  const fullscreenTrigger = useRef<HTMLButtonElement>(null);
  const fullscreenExit = useRef<HTMLButtonElement>(null);
  const fullscreenRequest = useRef(0);
  const cancelDockHide = () => { if (dockHideTimer.current !== null) { window.clearTimeout(dockHideTimer.current); dockHideTimer.current = null; } };
  const dockMustStayOpen = () => dockHover.current || sectionDraftDirty.current || inspectorDirty.current || Boolean(fullscreenRoot.current?.querySelector('[role="dialog"]')) || Boolean(dock.current?.contains(document.activeElement));
  const scheduleDockHide = () => {
    cancelDockHide();
    if (dockMustStayOpen()) return;
    dockHideTimer.current = window.setTimeout(() => { dockHideTimer.current = null; if (!dockMustStayOpen()) setDockVisible(false); }, 1200);
  };
  const revealDock = () => { cancelDockHide(); setDockVisible(true); };
  const exitPreviewFullscreen = useCallback(() => {
    fullscreenRequest.current++;
    cancelDockHide();
    dockHover.current = false;
    setFullscreenNotice('');
    if (document.fullscreenElement === fullscreenRoot.current) void document.exitFullscreen?.().catch(() => undefined);
    setPreviewFullscreen(null);
    setDockVisible(false);
    window.setTimeout(() => fullscreenTrigger.current?.isConnected && fullscreenTrigger.current.focus(), 0);
  }, []);
  const enterPreviewFullscreen = () => {
    const target = fullscreenRoot.current;
    if (!target) return;
    const request = ++fullscreenRequest.current;
    const fallback = (reason: string) => { if (request === fullscreenRequest.current && target.isConnected) { setFullscreenNotice(reason); setPreviewFullscreen('fallback'); } };
    if (!target.requestFullscreen) { fallback('Browser full screen is unavailable. Expanded preview is open.'); return; }
    try {
      void target.requestFullscreen().then(() => {
        if (request !== fullscreenRequest.current) { if (document.fullscreenElement === target) void document.exitFullscreen?.().catch(() => undefined); return; }
        setPreviewFullscreen('native');
      }).catch(() => fallback('Browser full screen was denied. Expanded preview is open.'));
    } catch { fallback('Browser full screen was denied. Expanded preview is open.'); }
  };
  useEffect(() => {
    if (!previewFullscreen) return;
    fullscreenExit.current?.focus();
    const target = fullscreenRoot.current;
    const background = previewFullscreen === 'fallback' ? Array.from(document.querySelectorAll<HTMLElement>('.app-shell > .sidebar, .studio-main > :not(.workspace), .workspace > .inspector')).filter(element => !target?.contains(element)) : [];
    const previousInert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); exitPreviewFullscreen(); }
      else if (event.altKey && event.key.toLowerCase() === 'e' && !event.repeat) { event.preventDefault(); revealDock(); dock.current?.querySelector<HTMLElement>('.studio-subviews button')?.focus(); }
      else if (event.key === 'Tab' && previewFullscreen === 'fallback' && target) {
        const focusable = Array.from(target.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"], video[controls], audio[controls]')).filter(element => !element.hasAttribute('disabled') && !element.closest('[inert], .channel-stage-action'));
        if (!focusable.length) return;
        const first = focusable[0]!, last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { background.forEach((element, index) => { element.inert = previousInert[index]!; }); window.removeEventListener('keydown', onKey, true); };
  }, [previewFullscreen, exitPreviewFullscreen]);
  useEffect(() => {
    const onChange = () => { if (previewFullscreen === 'native' && document.fullscreenElement !== fullscreenRoot.current) exitPreviewFullscreen(); };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [previewFullscreen, exitPreviewFullscreen]);
  useEffect(() => { if (previewFullscreen && (surface !== 'Channel' || !project)) exitPreviewFullscreen(); }, [previewFullscreen, surface, project, exitPreviewFullscreen]);
  const fullscreenProject = useRef(project?.id);
  useEffect(() => {
    if (fullscreenProject.current !== project?.id && previewFullscreen) exitPreviewFullscreen();
    fullscreenProject.current = project?.id;
  }, [project?.id, previewFullscreen, exitPreviewFullscreen]);
  useEffect(() => () => { fullscreenRequest.current++; if (dockHideTimer.current !== null) window.clearTimeout(dockHideTimer.current); if (document.fullscreenElement === fullscreenRoot.current) void document.exitFullscreen?.().catch(() => undefined); }, []);
  const inspectorDirty = useRef(false);
  const sectionDraftDirty = useRef(false);
  const [sectionDraftPending, setSectionDraftPending] = useState(false);
  const leaveSectionDraft = () => !sectionDraftDirty.current || window.confirm('Discard unsaved section edits?');
  const reportSectionDraft = useCallback((dirty: boolean) => { sectionDraftDirty.current = dirty; setSectionDraftPending(dirty); }, []);
  const setInspectorDirty = (dirty: boolean) => { inspectorDirty.current = dirty; setAppearanceDraftPending(dirty); };
  useEffect(() => { if (previewFullscreen && dockVisible) scheduleDockHide(); }, [previewFullscreen, dockVisible, sectionDraftPending, appearanceDraftPending]);
  const closeInspector = () => {
    if (inspectorDirty.current && !window.confirm('Discard unsaved appearance changes?')) return false;
    inspectorDirty.current = false;
    setInspectorProject(null);
    return true;
  };
  const navigate = (target: Surface) => {
    if (!leaveSectionDraft()) return;
    if (inspectorProject && !closeInspector()) return;
    if (target === 'Channel') setChannelView('Pages & Layout');
    setSurface(target); setNewChannel(false);
  };
  const accountRef = useRef<string | null>(null);
  const identityGeneration = useRef(0);
  const switchGeneration = useRef(0);
  const select = (next: ChannelProject) => { projectRef.current = next; setProject(next); window.history.replaceState(null, '', `?project=${next.id}`); };
  const acceptProject = (next: ChannelProject) => { select(next); setProjects(previous => previous.map(item => item.id === next.id ? next : item)); };
  useEffect(() => {
    const expired = () => { if (accountRef.current) clearVideoTransfers(accountRef.current); identityGeneration.current++; switchGeneration.current++; accountRef.current = null; setVideoSelection(null); setInspectorProject(null); inspectorDirty.current = false; setSignedOut(true); setSession(null); setProjects([]); setProject(null); setCatalogSelections({}); projectRef.current = null; window.history.replaceState(null, '', window.location.pathname); };
    const checkSession = () => { if (!accountRef.current) return; void getSession().then(active => {
      if (!active || active.accountId !== accountRef.current) { expired(); return; }
      setSession(active);
    }).catch(reason => { if (reason instanceof ApiError && reason.status === 401) expired(); else setError('Could not verify the current session'); }); };
    window.addEventListener('firelaunch-session-expired', expired);
    window.addEventListener('focus', checkSession);
    const interval = window.setInterval(checkSession, 60_000);
    const generation = identityGeneration.current;
    void getSession().then(active => { if (generation !== identityGeneration.current) return null; accountRef.current = active?.accountId ?? null; setSession(active); setSurface(active ? 'Home' : 'Channel'); return listProjects(); }).then(items => {
      if (!items || generation !== identityGeneration.current) return;
      setProjects(items);
      const requested = new URLSearchParams(window.location.search).get('project');
      const choice = items.find(item => item.id === requested) ?? items[0];
      if (choice) select(choice);
      else window.history.replaceState(null, '', window.location.pathname);
    }).catch(reason => { if (reason instanceof ApiError && reason.status === 401) expired(); else setError(String(reason)); }).finally(() => setLoading(false));
    return () => { window.removeEventListener('firelaunch-session-expired', expired); window.removeEventListener('focus', checkSession); window.clearInterval(interval); };
  }, []);
  const switchProject = async (id: string) => {
    if (!leaveSectionDraft()) return;
    if (inspectorProject && inspectorDirty.current && !window.confirm('Discard unsaved appearance changes?')) return;
    const generation = ++switchGeneration.current;
    const identity = identityGeneration.current;
    if (id === projectRef.current?.id) return;
    try {
      const active = await getSession();
      if (generation !== switchGeneration.current || identity !== identityGeneration.current) return;
      if ((active?.accountId ?? null) !== accountRef.current) { window.dispatchEvent(new window.Event('firelaunch-session-expired')); return; }
      const next = await getProject(id);
      if (generation !== switchGeneration.current || identity !== identityGeneration.current || (active?.accountId ?? null) !== accountRef.current || next.id !== id) return;
      select(next);
      setInspectorProject(surface === 'Channel' && channelView === 'Appearance' ? next.id : null); inspectorDirty.current = false;
      setVideoSelection(null);
      setNewChannel(false);
    } catch (reason) { if (generation === switchGeneration.current && identity === identityGeneration.current) setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const commit = async (mutation: ChannelMutation): Promise<boolean> => {
    const current = projectRef.current;
    if (!current) return false;
    setBusy(true); setError('');
    try {
      const updated = await mutateProject(current, mutation);
      select(updated);
      setProjects(previous => previous.map(item => item.id === updated.id ? updated : item));
      return true;
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        const fresh = await getProject(current.id);
        select(fresh);
        setProjects(previous => previous.map(item => item.id === fresh.id ? fresh : item));
        setError('Project changed elsewhere. Latest revision loaded; review and retry your edit.');
      } else setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally { setBusy(false); }
  };
  const create = async (title: string, sample: boolean, request: string, catalog: boolean) => {
    setBusy(true); setError('');
    try {
      const created = await createProject(title);
      select(created); setVideoSelection(null); setProjects(previous => [...previous, created]); setNewChannel(false); setSurface(catalog ? 'Library' : 'Channel'); setChannelView('Pages & Layout');
      if (sample && !session) for (const mutation of sampleMutations(created, [newId('item'), newId('item'), newId('item')], [newId('mod'), newId('mod'), newId('mod'), newId('mod')])) if (!(await commit(mutation))) break;
      if (request && projectRef.current?.id === created.id) {
        const result = await askAgent(projectRef.current, request);
        acceptProject(result.project);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const draftSelection = project ? catalogSelections[project.id] : undefined;
  const editorPageId = project && editorPageSelection?.projectId === project.id && project.spec.navigation.includes(editorPageSelection.pageId)
    ? editorPageSelection.pageId : project?.spec.navigation[0];
  const openChannel = (view: ChannelView) => { if (!leaveSectionDraft()) return; if (inspectorProject && !closeInspector()) return; setInspectorProject(view === 'Appearance' ? project?.id ?? null : null); setChannelView(view); setSurface('Channel'); setNewChannel(false); };
  const openVideo = (itemId?: string) => {
    if (!project || !session) return;
    setVideoSelection({ projectId: project.id, accountId: session.accountId, ...(itemId ? { itemId } : {}) });
  };
  if (signedOut) return <div className="welcome"><h1>Sign in to FireLaunch</h1><p>Your session has ended or you have not signed in.</p><a className="primary" href="/api/auth/login">Sign in with Google</a></div>;
  return <div className="app-shell"><aside className="sidebar" aria-label="Studio navigation"><div className="sidebar-head"><div className="wordmark"><span className="mark">✳</span><span>firelaunch<small>CREATOR STUDIO</small></span></div>{session && <div className="sidebar-account"><span title={session.email}>{session.email}</span><button onClick={() => void logout().then(() => window.dispatchEvent(new window.Event('firelaunch-session-expired'))).catch(reason => setError(String(reason)))}>Sign out</button></div>}</div><div className="sidebar-project"><div className="sidebar-label">WORKSPACE</div><button className="project-switch" onClick={() => { if (leaveSectionDraft()) setNewChannel(true); }} aria-label="New channel workspace"><span className="project-avatar">{project?.spec.title[0] ?? '+'}</span><span>{project?.spec.title ?? 'New channel'}<small>{project ? `REV ${project.revision} · ${session ? 'PRIVATE' : 'LOCAL'}` : 'GET STARTED'}</small></span><span aria-hidden="true">＋</span></button>{projects.length > 1 && <select className="project-select" aria-label="Switch project" value={project?.id ?? ''} onChange={event => { if (projects.some(item => item.id === event.target.value)) void switchProject(event.target.value); }}>{projects.map(item => <option key={item.id} value={item.id}>{item.spec.title}</option>)}</select>}</div>
    <div className="sidebar-label sidebar-sections-label">CHANNEL WORKSPACE</div><nav className="sidebar-nav" aria-label="Studio surfaces">{surfaces.map(target => <button key={target} disabled={!project} aria-current={surface === target && project && !newChannel ? 'page' : undefined} className={surface === target && project && !newChannel ? 'active' : ''} onClick={() => navigate(target)}><span aria-hidden="true">{icons[target]}</span>{target}</button>)}</nav><div className="sidebar-footer">✧ &nbsp; Vega-first creation<br/><small>{session ? 'Hosted studio' : 'Local studio'}</small></div></aside>
    <main className="studio-main"><header className="topbar"><div className="topbar-title"><span className="eyebrow">STUDIO / {newChannel || !project ? 'NEW CHANNEL' : surface.toUpperCase()}</span><h1>{newChannel ? 'Your next channel' : project?.spec.title ?? 'Your next channel'}</h1></div><div className="topbar-right"><span className="status" role="status"><i aria-hidden="true"/> {busy ? 'SAVING' : sectionDraftPending ? 'UNSAVED EDITS' : project ? session ? 'SAVED PRIVATELY' : 'SAVED LOCALLY' : 'READY'}</span><button onClick={() => { if (!leaveSectionDraft()) return; if (inspectorProject && !closeInspector()) return; setNewChannel(previous => !previous); }}>{newChannel && project ? '← Current channel' : '＋ New channel'}</button></div></header>
      {session && project && <VideoTransferNotice accountId={session.accountId} projectId={project.id} onOpen={openVideo}/>}
      {error && <div className="error" role="alert">{error} <button onClick={() => setError('')}>Dismiss</button></div>}
      {loading ? <div className="loading" role="status">Loading projects…</div> : (!project || newChannel) ? <Intro busy={busy} hosted={!!session} onCreate={create} /> : surface === 'Home' ? <Home key={`${session?.accountId ?? 'local'}:${project.id}`} project={project} projects={projects} accountId={session?.accountId ?? null} hosted={!!session} libraryRevision={libraryRevision} onSelectProject={id => void switchProject(id)} onSurface={navigate} onEditChannel={() => openChannel('Appearance')} onOpenVideo={openVideo} onPreview={() => openChannel('Pages & Layout')}/> : <div className={`workspace ${surface === 'Channel' ? 'channel-workspace' : ''}`}>
        <div className="workspace-main" id="studio-controls">
          {surface === 'Export' && <div className="chips studio-subviews" role="group" aria-label="Export views">{exportViews.map(view => <button key={view} type="button" className={exportView === view ? 'active' : ''} aria-pressed={exportView === view} onClick={() => setExportView(view)}>{view}</button>)}</div>}
          {surface === 'Channel' ? <div id="channel-fullscreen-root" ref={fullscreenRoot} className={`channel-presentation${previewFullscreen ? ' preview-fullscreen' : ''}${dockVisible ? ' dock-revealed' : ''}`} role={previewFullscreen === 'fallback' ? 'dialog' : undefined} aria-modal={previewFullscreen === 'fallback' ? true : undefined} aria-label={previewFullscreen === 'fallback' ? 'Full-screen TV Preview' : undefined} onPointerMove={event => { if (!previewFullscreen || event.pointerType === 'touch') return; if (event.clientX - event.currentTarget.getBoundingClientRect().left <= 38) revealDock(); }} onPointerLeave={() => { if (previewFullscreen) scheduleDockHide(); }} onTouchStart={event => { if (previewFullscreen && event.touches[0]!.clientX - event.currentTarget.getBoundingClientRect().left <= 48) revealDock(); }}>
            <section id="channel-editor-drawer" ref={dock} className="channel-dock" aria-label="Channel editor rail" inert={!!previewFullscreen && !dockVisible} onPointerEnter={() => { dockHover.current = true; if (previewFullscreen) revealDock(); }} onPointerLeave={() => { dockHover.current = false; if (previewFullscreen) scheduleDockHide(); }} onFocusCapture={() => { if (previewFullscreen) revealDock(); }} onBlurCapture={() => { if (previewFullscreen) window.setTimeout(scheduleDockHide, 0); }}><div className="channel-dock-header"><div className="chips studio-subviews" role="group" aria-label="Channel views">{channelViews.map(view => <button key={view} type="button" className={channelView === view ? 'active' : ''} aria-pressed={channelView === view} onClick={() => { if (channelView === view || !leaveSectionDraft()) return; if (inspectorProject && !closeInspector()) return; setInspectorProject(view === 'Appearance' ? project.id : null); setChannelView(view); }}>{view}</button>)}</div></div>
              <div className="channel-dock-body"><div className="channel-editor" hidden={channelView !== 'Pages & Layout'}><Content key={`${session?.accountId ?? 'local'}:${project.id}`} project={project} commit={commit} onDirtyChange={reportSectionDraft} accountId={session?.accountId} libraryRevision={libraryRevision} pageId={editorPageId!} onPageSelect={pageId => setEditorPageSelection({ projectId: project.id, pageId })}/></div>
              {channelView === 'Appearance' && <aside className="channel-appearance" id="appearance-inspector" aria-label="Appearance editor"><Design key={project.id} project={project} commit={commit} onDirtyChange={setInspectorDirty}/></aside>}</div>
            </section>
            <div className="channel-tv-stage"><div id="tv-preview">{fullscreenNotice && <p className="preview-fullscreen-notice" role="status">{fullscreenNotice}</p>}<Preview key={`${session?.accountId ?? 'local'}:${project.id}`} spec={project.spec} selectedPageId={editorPageId} hosted={!!session} accountId={session?.accountId} libraryRevision={libraryRevision} fullscreen={!!previewFullscreen} onEnterFullscreen={enterPreviewFullscreen} onExitFullscreen={exitPreviewFullscreen} enterButtonRef={fullscreenTrigger} exitButtonRef={fullscreenExit}/></div></div>
            {previewFullscreen && <button type="button" className="channel-dock-handle" aria-label={`${dockVisible ? 'Hide' : 'Show'} editing drawer (Alt+E)`} aria-expanded={dockVisible} aria-controls="channel-editor-drawer" onPointerEnter={() => { dockHover.current = true; revealDock(); }} onPointerLeave={() => { dockHover.current = false; scheduleDockHide(); }} onClick={() => { dockHover.current = false; if (dockVisible && !dockMustStayOpen()) { cancelDockHide(); setDockVisible(false); } else revealDock(); }}>Edit channel <span aria-hidden="true">{dockVisible ? '‹' : '›'}</span></button>}
          </div> : <div className="channel-editor">{surface === 'Library' ? <Catalog project={project} hosted={!!session} {...(session ? { accountId: session.accountId } : {})} libraryRevision={libraryRevision} onOpenVideo={openVideo} onCatalogChange={() => setLibraryRevision(value => value + 1)} {...(draftSelection ? { initialSelection: draftSelection.selection, initialCreator: draftSelection.creator } : {})} onGenerated={(next, selection, creator) => { acceptProject(next); setCatalogSelections(previous => ({ ...previous, [next.id]: { selection, creator } })); }} onSelectionRestored={(selection, creator) => setCatalogSelections(previous => ({ ...previous, [project.id]: { selection, creator } }))} onRefine={() => openChannel('Pages & Layout')}/> : <Delivery key={`${project.id}:${surface}:${exportView}`} project={project} surface={surface === 'Publish' ? 'Publish' : exportView === 'Advanced Source' ? 'Code' : 'Build'} hosted={!!session} />}</div>}
        </div>
      </div>}
      <span className="sr-only" role="status" aria-live="polite">{inspectorProject === project?.id && surface === 'Channel' && channelView === 'Appearance' ? 'Appearance inspector open' : 'Appearance inspector closed'}</span>

    </main>{videoSelection && project?.id === videoSelection.projectId && session?.accountId === videoSelection.accountId && !newChannel && <VideoWorkspace key={`${videoSelection.accountId}:${videoSelection.projectId}`} selection={videoSelection} project={project} onProjectUpdate={acceptProject} onIdentity={itemId => setVideoSelection(previous => previous && previous.projectId === project.id && previous.accountId === session.accountId ? { ...previous, itemId } : previous)} onClose={() => { setVideoSelection(null); setLibraryRevision(value => value + 1); }}/>}</div>;
}
