import React, { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ChannelMutation } from '@firelaunch/channel-engine';
import { createPageFromTemplate, type ChannelProject, type ContentItem, type Module, type PageTemplate } from '@firelaunch/contracts';
import type { AgentEvent } from '@firelaunch/agent';
import { ApiError, askAgent, createProject, getProject, getSession, listProjects, logout, mutateProject, type CatalogSelection, type StudioSession } from './api.js';
import { Preview } from './Preview.js';
import { AgentPanel } from './AgentPanel.js';
import { Delivery } from './Delivery.js';
import { Catalog } from './Catalog.js';
import { Home } from './Home.js';
import { VideoWorkspace } from './VideoWorkspace.js';
import { clearVideoTransfers, stopVideoTransfer, subscribeVideoTransfers, videoTransfers, type VideoTransfer } from './video-transfer.js';
import { SAMPLE_ART, newFilmMediaUrl, sampleMutations } from './sample.js';

function newId(kind: 'page' | 'mod' | 'item'): string {
  return `${kind}_${crypto.randomUUID().replaceAll('-', '')}`;
}

type Surface = 'Home' | 'Library' | 'Channel' | 'Publish' | 'Export';
type ChannelView = 'AI Assistant' | 'Appearance' | 'Pages & Layout';
type ExportView = 'Build & Download' | 'Advanced Source';
const surfaces: Surface[] = ['Home', 'Library', 'Channel', 'Publish', 'Export'];
const channelViews: ChannelView[] = ['AI Assistant', 'Appearance', 'Pages & Layout'];
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

function ModuleEditor({ module, pageId, items, commit }: { module: Module; pageId: string; items: ContentItem[]; commit: (mutation: ChannelMutation) => Promise<boolean> }) {
  const [title, setTitle] = useState(module.title ?? '');
  const [body, setBody] = useState(module.kind === 'text' ? module.body : '');
  useEffect(() => { setTitle(module.title ?? ''); setBody(module.kind === 'text' ? module.body : ''); }, [module]);
  const update = (next: Module) => void commit({ type: 'updateModule', pageId, module: next });
  return <div className="module-editor"><div className="module-top"><strong>{module.kind.toUpperCase()}</strong><button className="danger" onClick={() => void commit({ type: 'removeModule', pageId, moduleId: module.id })}>Remove</button></div>
    <div className="inline-form">{module.kind !== 'hero' && <input aria-label="Module title" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} />}{module.kind !== 'hero' && <button disabled={!title.trim() || title === module.title} onClick={() => update({ ...module, title: title.trim() })}>Save title</button>}</div>
    {module.kind === 'text' ? <><textarea aria-label="Text module body" maxLength={2000} value={body} onChange={event => setBody(event.target.value)} /><button disabled={body === module.body} onClick={() => update({ ...module, body })}>Save text</button></> : <><div className="chips">{items.map(item => <label className="check" key={item.id}><input type="checkbox" checked={module.contentIds.includes(item.id)} onChange={event => update({ ...module, contentIds: event.target.checked ? [...module.contentIds, item.id] : module.contentIds.filter(id => id !== item.id) })} disabled={module.kind === 'hero' && !module.contentIds.includes(item.id) && module.contentIds.length > 0} />{item.title}</label>)}</div>{items.length === 0 && <small>Add a film above first.</small>}</>}
  </div>;
}

function Content({ project, commit, hosted }: { project: ChannelProject; commit: (mutation: ChannelMutation) => Promise<boolean>; hosted: boolean }) {
  const { spec } = project;
  const [pageId, setPageId] = useState(spec.navigation[0]!);
  const [selection, setSelection] = useState<'page' | string | null>(null);
  const [advanced, setAdvanced] = useState(false);
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
  const [kind, setKind] = useState<'hero' | 'rail' | 'grid' | 'text'>('rail');
  const [selectedId, setSelectedId] = useState<string>('');
  const selected = spec.content.find(item => item.id === selectedId);
  const [draft, setDraft] = useState({ title: '', description: '', artwork: SAMPLE_ART, mediaUrl: newFilmMediaUrl(hosted), category: '' });
  const page = spec.pages.find(candidate => candidate.id === pageId) ?? spec.pages[0]!;
  const selectedModule = page.modules.find(module => module.id === selection);
  useEffect(() => { if (selection) selectionClose.current?.focus(); }, [selection]);
  useEffect(() => { if (selection && selection !== 'page' && !selectedModule) setSelection(null); }, [selection, selectedModule]);
  const closeSelection = () => { setSelection(null); window.setTimeout(() => selectionOpener.current?.focus(), 0); };
  useEffect(() => {
    if (!selection) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); closeSelection(); } };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [selection]);
  const selectPage = (id: string) => { setPageId(id); setSelection(null); setName(''); setRenameError(''); };
  useEffect(() => { if (selected) setDraft({ title: selected.title, description: selected.description, artwork: selected.artwork, mediaUrl: selected.mediaUrl ?? '', category: selected.category ?? '' }); }, [selectedId]);
  const set = (key: keyof typeof draft, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    const content: ContentItem = { id: selected?.id ?? newId('item'), title: draft.title.trim(), description: draft.description, artwork: draft.artwork,
      ...(selected?.presentation && { presentation: selected.presentation }),
      ...(selected?.presentation !== 'information' && { mediaUrl: draft.mediaUrl }),
      ...(draft.category.trim() && { category: draft.category.trim() }), ...(selected?.durationSeconds && { durationSeconds: selected.durationSeconds }), ...(selected?.series && { series: selected.series }) };
    if (await commit({ type: selected ? 'updateContent' : 'addContent', content })) setSelectedId(content.id);
  };
  const addModule = async () => {
    const id = newId('mod');
    const module: Module = kind === 'text' ? { id, kind, title: moduleTitle.trim() || 'About', body: '' }
      : kind === 'hero' ? { id, kind, contentIds: [] }
      : { id, kind, title: moduleTitle.trim() || 'Collection', contentIds: [] };
    if (await commit({ type: 'addModule', pageId: page.id, module })) setModuleTitle('');
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
  return <div className={`layout-workspace ${selection ? 'layout-has-inspector' : ''}`}><nav className="layout-page-rail" aria-label="Channel pages"><span className="eyebrow">PAGES</span>{spec.navigation.map(id => { const target = spec.pages.find(candidate => candidate.id === id)!; return <button key={id} type="button" data-page-id={id} className={page.id === id ? 'active' : ''} aria-current={page.id === id ? 'page' : undefined} onClick={() => selectPage(id)}>{target.title}</button>; })}<button ref={pageOpener} type="button" onClick={() => setPageDialogOpen(true)}>New page</button></nav><div className="layout-composition"><span className="eyebrow">DRAFT PAGE LAYOUT</span><h2>{page.title}</h2><p className="muted">Sections appear in this order. TV Preview above is interactive and shows your draft; publishing is separate.</p><button type="button" ref={selection === 'page' ? selectionOpener : undefined} aria-expanded={selection === 'page'} onClick={event => { selectionOpener.current = event.currentTarget; setSelection('page'); }}>Edit page</button>
    {page.modules.length === 0 && <p className="module-empty">This page has no sections yet. Add a section below to begin.</p>}
    <div className="layout-sections">{page.modules.map((module, index) => <section key={module.id} className={`layout-section layout-${module.kind}`} aria-label={`${module.kind} section ${index + 1}`}><div className="layout-section-heading"><span>{index + 1} · {module.kind === 'rail' ? 'Row' : module.kind === 'text' ? 'Text Area' : module.kind === 'hero' ? 'Hero' : 'Grid'}</span><button type="button" aria-expanded={selection === module.id} onClick={event => { selectionOpener.current = event.currentTarget; setSelection(module.id); }}>Edit section</button></div>{module.title && <h3>{module.title}</h3>}{module.kind === 'text' ? <p>{module.body || 'Add text in the section inspector.'}</p> : module.contentIds.length ? <div className="layout-tiles">{module.contentIds.map(id => { const item = spec.content.find(candidate => candidate.id === id); return item && <div key={id} className="layout-tile"><img src={item.artwork.startsWith('assets/') ? `/media/${item.artwork.slice(7)}` : item.artwork} alt=""/><span>{item.title}</span></div>; })}</div> : <p className="module-empty">Choose content for {module.kind === 'hero' ? 'the hero' : module.title ?? 'this section'}.</p>}</section>)}</div>
    <details className="layout-advanced" open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)}><summary>Advanced content and section controls</summary><p>Manage source fields and add sections here. Library is the main place to add creator media.</p>
    {pageDialogOpen && <div className="page-dialog-backdrop"><div ref={pageDialog} role="dialog" aria-modal="true" aria-labelledby="new-page-heading" className="page-dialog" onKeyDown={onPageDialogKeyDown}>
      <h3 id="new-page-heading">Create a page</h3><p>Name your page and choose a starting layout. You can choose content after creating it.</p>
      <form onSubmit={event => void createPage(event)}><label htmlFor="new-page-name">Page name</label><input ref={pageName} id="new-page-name" maxLength={120} required value={newPage} onChange={event => { setNewPage(event.target.value); setPageError(''); }} />
        <fieldset><legend>Starting layout</legend><div className="page-template-options">{(['hero', 'grid', 'rows'] as const).map(choice => <label key={choice} className={`page-template-option ${pageTemplate === choice ? 'selected' : ''}`}><input type="radio" name="page-template" value={choice} checked={pageTemplate === choice} onChange={() => setPageTemplate(choice)} /><span className={`page-template-preview ${choice}`} aria-hidden="true"><i/><i/><i/><i/></span><strong>{choice === 'hero' ? 'Hero' : choice === 'grid' ? 'Grid' : 'Rows'}</strong><small>{choice === 'hero' ? 'A featured video and a row' : choice === 'grid' ? 'A collection of video tiles' : 'Two video rows'}</small></label>)}</div></fieldset>
        {pageError && <p className="page-dialog-error" role="alert">{pageError}</p>}
        <div className="button-row"><button type="button" onClick={closePageDialog} disabled={pageSaving}>Cancel</button><button className="primary" type="submit" disabled={pageSaving}>{pageSaving ? 'Creating…' : 'Create page'}</button></div>
      </form></div></div>}
    <div className="section-label">02 / CATALOG</div><div className="chips" aria-label="Channel content"><button className={!selected ? 'active' : ''} aria-pressed={!selected} onClick={() => { setSelectedId(''); setDraft({ title: '', description: '', artwork: SAMPLE_ART, mediaUrl: newFilmMediaUrl(hosted), category: '' }); }}>+ New film</button>{spec.content.map(item => <button key={item.id} className={selectedId === item.id ? 'active' : ''} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}>{item.title}</button>)}</div>
    <form onSubmit={event => void saveItem(event)}><Field label="TITLE"><input required maxLength={120} value={draft.title} onChange={event => set('title', event.target.value)}/></Field><Field label="DESCRIPTION"><textarea maxLength={2000} value={draft.description} onChange={event => set('description', event.target.value)}/></Field><Field label="ARTWORK · HTTP(S) OR ASSET PATH"><input required value={draft.artwork} onChange={event => set('artwork', event.target.value)}/></Field>{selected?.presentation !== 'information' && <Field label={selected?.presentation === 'audio' ? 'PLAYABLE AUDIO URL · HTTP(S)' : 'PLAYABLE VIDEO URL · HTTP(S)'}><input required type="url" value={draft.mediaUrl} onChange={event => set('mediaUrl', event.target.value)}/></Field>}<Field label="CATEGORY"><input value={draft.category} onChange={event => set('category', event.target.value)}/></Field><div className="button-row"><button className="primary" type="submit">{selected ? selected.presentation === 'information' ? 'Save item' : selected.presentation === 'audio' ? 'Save audio' : 'Save film' : 'Add film'}</button>{selected && <button type="button" className="danger" onClick={() => void commit({ type: 'removeContent', contentId: selected.id }).then(saved => { if (saved) setSelectedId(''); })}>Remove</button>}</div></form>
    <div className="section-label">03 / TV LAYOUT · {page.title.toUpperCase()}</div><div className="inline-form"><select aria-label="Module type" value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="hero">Hero</option><option value="rail">Rail</option><option value="grid">Grid</option><option value="text">Text</option></select><input aria-label="Module title to add" placeholder="Module title" maxLength={120} value={moduleTitle} onChange={event => setModuleTitle(event.target.value)}/><button onClick={() => void addModule()}>Add</button></div>
    </details></div>{selection && <aside className="inspector layout-inspector" aria-label="Layout inspector"><div className="inspector-heading"><strong>Selected: {selection === 'page' ? page.title : selectedModule?.title ?? selectedModule?.kind}</strong><button ref={selectionClose} type="button" aria-label="Close layout inspector" onClick={closeSelection}>Close</button></div><div className="panel-content">{selection === 'page' ? <><Field label="PAGE NAME"><input value={name} onChange={event => { setName(event.target.value); setRenameError(''); }} placeholder={page.title} maxLength={120}/></Field><button disabled={!name.trim() || name.trim() === page.title} onClick={() => { if (spec.pages.some(candidate => candidate.id !== page.id && candidate.title.toLocaleLowerCase() === name.trim().toLocaleLowerCase())) { setRenameError('A page with this name already exists.'); return; } void commit({ type: 'updatePage', pageId: page.id, title: name.trim() }).then(saved => { if (saved) setName(''); }); }}>Rename page</button>{renameError && <p role="alert">{renameError}</p>}<button className="danger" disabled={spec.pages.length === 1} onClick={() => { if (!window.confirm(`Delete page ${page.title}? Its sections will be removed.`)) return; void commit({ type: 'removePage', pageId: page.id }).then(saved => { if (saved) { selectPage(spec.navigation.find(id => id !== page.id)!); window.setTimeout(() => pageOpener.current?.focus(), 0); } }); }}>Delete page</button>{spec.pages.length === 1 && <small>The channel needs at least one page.</small>}</> : selectedModule && <ModuleEditor key={selectedModule.id} module={selectedModule} pageId={page.id} items={spec.content} commit={commit} />}</div></aside>}</div>;
}

export default function App() {
  const [projects, setProjects] = useState<ChannelProject[]>([]);
  const [project, setProject] = useState<ChannelProject | null>(null);
  const projectRef = useRef<ChannelProject | null>(null);
  const [surface, setSurface] = useState<Surface>('Library');
  const [channelView, setChannelView] = useState<ChannelView>('AI Assistant');
  const [exportView, setExportView] = useState<ExportView>('Build & Download');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newChannel, setNewChannel] = useState(false);
  const [agentEvents, setAgentEvents] = useState<Record<string, AgentEvent[]>>({});
  const [catalogSelections, setCatalogSelections] = useState<Record<string, { selection: CatalogSelection; creator: 'video' | 'audio' | 'writing' }>>({});
  const [session, setSession] = useState<StudioSession | null>(null);
  const [videoSelection, setVideoSelection] = useState<{ projectId: string; accountId: string; itemId?: string } | null>(null);
  const [libraryRevision, setLibraryRevision] = useState(0);
  const [signedOut, setSignedOut] = useState(false);
  const [inspectorProject, setInspectorProject] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const inspectorDirty = useRef(false);
  const inspectorOpener = useRef<HTMLButtonElement | null>(null);
  const inspectorClose = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (inspectorProject) inspectorClose.current?.focus(); }, [inspectorProject]);
  const setInspectorDirty = (dirty: boolean) => { inspectorDirty.current = dirty; };
  const closeInspector = () => {
    if (inspectorDirty.current && !window.confirm('Discard unsaved appearance changes?')) return false;
    inspectorDirty.current = false;
    setInspectorProject(null);
    window.setTimeout(() => inspectorOpener.current?.focus(), 0);
    return true;
  };
  const navigate = (target: Surface) => {
    if (inspectorProject && !closeInspector()) return;
    setSurface(target); setNewChannel(false);
  };
  const accountRef = useRef<string | null>(null);
  const identityGeneration = useRef(0);
  const switchGeneration = useRef(0);
  const select = (next: ChannelProject) => { projectRef.current = next; setProject(next); window.history.replaceState(null, '', `?project=${next.id}`); };
  const acceptProject = (next: ChannelProject) => { select(next); setProjects(previous => previous.map(item => item.id === next.id ? next : item)); };
  useEffect(() => {
    const expired = () => { if (accountRef.current) clearVideoTransfers(accountRef.current); identityGeneration.current++; switchGeneration.current++; accountRef.current = null; setVideoSelection(null); setInspectorProject(null); inspectorDirty.current = false; setSignedOut(true); setSession(null); setProjects([]); setProject(null); setAgentEvents({}); setCatalogSelections({}); projectRef.current = null; window.history.replaceState(null, '', window.location.pathname); };
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
      setInspectorProject(null); inspectorDirty.current = false;
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
      select(created); setVideoSelection(null); setProjects(previous => [...previous, created]); setNewChannel(false); setSurface(catalog ? 'Library' : 'Channel'); if (!catalog) setChannelView('AI Assistant');
      if (sample && !session) for (const mutation of sampleMutations(created, [newId('item'), newId('item'), newId('item')], [newId('mod'), newId('mod'), newId('mod'), newId('mod')])) if (!(await commit(mutation))) break;
      if (request && projectRef.current?.id === created.id) {
        const result = await askAgent(projectRef.current, request);
        acceptProject(result.project);
        setAgentEvents(previous => ({ ...previous, [created.id]: result.events }));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const draftSelection = project ? catalogSelections[project.id] : undefined;
  const openChannel = (view: ChannelView) => { if (inspectorProject && !closeInspector()) return; setChannelView(view); setSurface('Channel'); setNewChannel(false); };
  useEffect(() => {
    if (!inspectorProject) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !(event.target as HTMLElement)?.closest('.tv-frame')) { event.preventDefault(); closeInspector(); } };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [inspectorProject]);
  const openVideo = (itemId?: string) => {
    if (!project || !session) return;
    setVideoSelection({ projectId: project.id, accountId: session.accountId, ...(itemId ? { itemId } : {}) });
  };
  if (signedOut) return <div className="welcome"><h1>Sign in to FireLaunch</h1><p>Your session has ended or you have not signed in.</p><a className="primary" href="/api/auth/login">Sign in with Google</a></div>;
  return <div className="app-shell"><aside className="sidebar" aria-label="Studio navigation"><div className="sidebar-head"><div className="wordmark"><span className="mark">✳</span><span>firelaunch<small>CREATOR STUDIO</small></span></div>{session && <div className="sidebar-account"><span title={session.email}>{session.email}</span><button onClick={() => void logout().then(() => window.dispatchEvent(new window.Event('firelaunch-session-expired'))).catch(reason => setError(String(reason)))}>Sign out</button></div>}</div><div className="sidebar-project"><div className="sidebar-label">WORKSPACE</div><button className="project-switch" onClick={() => setNewChannel(true)} aria-label="New channel workspace"><span className="project-avatar">{project?.spec.title[0] ?? '+'}</span><span>{project?.spec.title ?? 'New channel'}<small>{project ? `REV ${project.revision} · ${session ? 'PRIVATE' : 'LOCAL'}` : 'GET STARTED'}</small></span><span aria-hidden="true">＋</span></button>{projects.length > 1 && <select className="project-select" aria-label="Switch project" value={project?.id ?? ''} onChange={event => { if (projects.some(item => item.id === event.target.value)) void switchProject(event.target.value); }}>{projects.map(item => <option key={item.id} value={item.id}>{item.spec.title}</option>)}</select>}</div>
    <div className="sidebar-label sidebar-sections-label">CHANNEL WORKSPACE</div><nav className="sidebar-nav" aria-label="Studio surfaces">{surfaces.map(target => <button key={target} disabled={!project} aria-current={surface === target && project && !newChannel ? 'page' : undefined} className={surface === target && project && !newChannel ? 'active' : ''} onClick={() => navigate(target)}><span aria-hidden="true">{icons[target]}</span>{target}</button>)}</nav><div className="sidebar-footer">✧ &nbsp; Vega-first creation<br/><small>{session ? 'Hosted studio' : 'Local studio'}</small></div></aside>
    <main className="studio-main"><header className="topbar"><div className="topbar-title"><span className="eyebrow">STUDIO / {newChannel || !project ? 'NEW CHANNEL' : surface.toUpperCase()}</span><h1>{newChannel ? 'Your next channel' : project?.spec.title ?? 'Your next channel'}</h1></div><div className="topbar-right"><span className="status" role="status"><i aria-hidden="true"/> {busy ? 'SAVING' : project ? session ? 'SAVED PRIVATELY' : 'SAVED LOCALLY' : 'READY'}</span><button onClick={() => { if (inspectorProject && !closeInspector()) return; setNewChannel(previous => !previous); }}>{newChannel && project ? '← Current channel' : '＋ New channel'}</button></div></header>
      {session && project && <VideoTransferNotice accountId={session.accountId} projectId={project.id} onOpen={openVideo}/>}
      {error && <div className="error" role="alert">{error} <button onClick={() => setError('')}>Dismiss</button></div>}
      {loading ? <div className="loading" role="status">Loading projects…</div> : (!project || newChannel) ? <Intro busy={busy} hosted={!!session} onCreate={create} /> : surface === 'Home' ? <Home key={`${session?.accountId ?? 'local'}:${project.id}`} project={project} projects={projects} accountId={session?.accountId ?? null} hosted={!!session} libraryRevision={libraryRevision} onSelectProject={id => void switchProject(id)} onSurface={navigate} onEditChannel={() => openChannel('Appearance')} onOpenVideo={openVideo} onPreview={() => { openChannel('Appearance'); setPreviewOpen(true); window.setTimeout(() => document.getElementById('tv-preview')?.scrollIntoView?.(), 0); }}/> : <div className={`workspace ${surface === 'Channel' ? 'channel-workspace' : ''} ${inspectorProject === project.id && surface === 'Channel' && channelView === 'Appearance' ? 'has-inspector' : ''}`}>
        <div className="workspace-main" id="studio-controls">
          {surface === 'Channel' && <div className="channel-toolbar"><div className="chips studio-subviews" role="group" aria-label="Channel views">{channelViews.map(view => <button key={view} type="button" className={channelView === view ? 'active' : ''} aria-pressed={channelView === view} onClick={() => { if (inspectorProject && !closeInspector()) return; setChannelView(view); }}>{view}</button>)}</div><button type="button" className="preview-toggle" aria-expanded={previewOpen} aria-controls="tv-preview" onClick={() => setPreviewOpen(open => !open)}>{previewOpen ? 'Close TV Preview' : 'TV Preview'}</button></div>}
          {surface === 'Export' && <div className="chips studio-subviews" role="group" aria-label="Export views">{exportViews.map(view => <button key={view} type="button" className={exportView === view ? 'active' : ''} aria-pressed={exportView === view} onClick={() => setExportView(view)}>{view}</button>)}</div>}
          <div className={previewOpen && surface === 'Channel' ? 'channel-preview-split' : ''}>
            {surface === 'Channel' && previewOpen && <div id="tv-preview"><Preview key={`${session?.accountId ?? 'local'}:${project.id}`} spec={project.spec} hosted={!!session} accountId={session?.accountId} libraryRevision={libraryRevision}/></div>}
            <div className="channel-editor">
              {surface === 'Library' ? <Catalog project={project} hosted={!!session} {...(session ? { accountId: session.accountId } : {})} libraryRevision={libraryRevision} onOpenVideo={openVideo} onCatalogChange={() => setLibraryRevision(value => value + 1)} {...(draftSelection ? { initialSelection: draftSelection.selection, initialCreator: draftSelection.creator } : {})} onGenerated={(next, selection, creator) => { acceptProject(next); setCatalogSelections(previous => ({ ...previous, [next.id]: { selection, creator } })); }} onSelectionRestored={(selection, creator) => setCatalogSelections(previous => ({ ...previous, [project.id]: { selection, creator } }))} onRefine={() => openChannel('AI Assistant')}/> : surface === 'Channel' && channelView === 'Appearance' ? <div className="panel-content"><span className="eyebrow">CHANNEL IDENTITY</span><h2>Appearance</h2><p>Choose your channel name, colors and artwork for the TV experience.</p><button type="button" ref={inspectorOpener} aria-expanded={inspectorProject === project.id} aria-controls={inspectorProject === project.id ? 'appearance-inspector' : undefined} onClick={() => { if (inspectorProject) closeInspector(); else setInspectorProject(project.id); }}>Edit appearance</button></div> : surface === 'Channel' && channelView === 'Pages & Layout' ? <Content key={`${session?.accountId ?? 'local'}:${project.id}`} project={project} commit={commit} hosted={!!session}/> : surface === 'Channel' ? <AgentPanel key={project.id} project={project} {...(draftSelection ? { catalogSelection: draftSelection.selection } : {})} onUpdate={acceptProject} events={agentEvents[project.id] ?? []} onEvents={entries => setAgentEvents(previous => ({ ...previous, [project.id]: [...(previous[project.id] ?? []), ...entries].slice(-36) }))} /> : <Delivery key={`${project.id}:${surface}:${exportView}`} project={project} surface={surface === 'Publish' ? 'Publish' : exportView === 'Advanced Source' ? 'Code' : 'Build'} hosted={!!session} />}
            </div>
          </div>
        </div>
        {surface === 'Channel' && channelView === 'Appearance' && inspectorProject === project.id && <aside className="inspector" id="appearance-inspector" aria-label="Appearance inspector"><div className="inspector-heading"><strong>Selected: appearance</strong><button ref={inspectorClose} type="button" aria-label="Close appearance inspector" onClick={closeInspector}>Close</button></div><Design key={project.id} project={project} commit={commit} onDirtyChange={setInspectorDirty}/></aside>}
      </div>}
      <span className="sr-only" role="status" aria-live="polite">{inspectorProject === project?.id && surface === 'Channel' && channelView === 'Appearance' ? 'Appearance inspector open' : 'Appearance inspector closed'}</span>

    </main>{videoSelection && project?.id === videoSelection.projectId && session?.accountId === videoSelection.accountId && !newChannel && <VideoWorkspace key={`${videoSelection.accountId}:${videoSelection.projectId}`} selection={videoSelection} project={project} onProjectUpdate={acceptProject} onIdentity={itemId => setVideoSelection(previous => previous && previous.projectId === project.id && previous.accountId === session.accountId ? { ...previous, itemId } : previous)} onClose={() => { setVideoSelection(null); setLibraryRevision(value => value + 1); }}/>}</div>;
}
