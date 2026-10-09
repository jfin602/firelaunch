import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ChannelMutation } from '@firelaunch/channel-engine';
import type { ChannelProject, ContentItem, Module, Page } from '@firelaunch/contracts';
import type { AgentEvent } from '@firelaunch/agent';
import { ApiError, askAgent, createProject, getProject, listProjects, mutateProject } from './api.js';
import { Preview } from './Preview.js';
import { AgentPanel } from './AgentPanel.js';
import { Delivery } from './Delivery.js';
import { SAMPLE_ART, SAMPLE_MEDIA, sampleMutations } from './sample.js';

function newId(kind: 'page' | 'mod' | 'item'): string {
  return `${kind}_${crypto.randomUUID().replaceAll('-', '')}`;
}

type Surface = 'Create' | 'Design' | 'Content' | 'Code' | 'Build' | 'Publish';
const surfaces: Surface[] = ['Create', 'Design', 'Content', 'Code', 'Build', 'Publish'];
const icons: Record<Surface, string> = { Create: '✳', Design: '◈', Content: '▦', Code: '⌘', Build: '⬡', Publish: '↗' };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Intro({ onCreate, busy }: { onCreate: (title: string, sample: boolean, request: string) => Promise<void>; busy: boolean }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [sample, setSample] = useState(true);
  const [request, setRequest] = useState('');
  return <div className="welcome"><div className="welcome-symbol">✳</div><span className="eyebrow">YOUR CHANNEL STARTS HERE</span><h1>Stories belong<br/><em>on the big screen.</em></h1><p>Shape your brand, curate a collection, and explore the TV experience before writing a line of code.</p>
    <div className="welcome-form"><div className="steps"><span className={step === 0 ? 'current' : ''}>01 Identity</span><span className={step === 1 ? 'current' : ''}>02 First look</span></div>
      {step === 0 ? <form onSubmit={event => { event.preventDefault(); if (title.trim()) setStep(1); }}><Field label="CHANNEL NAME"><input autoFocus required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Wild Earth" /></Field><button className="primary" type="submit">Continue <span>→</span></button></form>
        : <div><h2>{title}</h2><p>Start with original concept artwork and one procedural demo clip reused across Nature, Oceans and Africa, or begin blank. Replace demo media before device testing. The optional agent request uses mock mode unless Bedrock is configured.</p><label className="check"><input type="checkbox" checked={sample} onChange={event => setSample(event.target.checked)} /> Add rights-safe demo collection</label><Field label="INITIAL AGENT REQUEST (OPTIONAL)"><textarea maxLength={2000} value={request} onChange={event => setRequest(event.target.value)} placeholder="e.g. Add page Explore" /></Field><div className="button-row"><button onClick={() => setStep(0)}>← Back</button><button className="primary" disabled={busy} onClick={() => void onCreate(title.trim(), sample, request.trim())}>{busy ? 'Creating…' : 'Create channel →'}</button></div></div>}
    </div></div>;
}

function Design({ project, commit }: { project: ChannelProject; commit: (mutation: ChannelMutation) => Promise<boolean> }) {
  const { spec } = project;
  const [brand, setBrand] = useState(spec.brand);
  const [title, setTitle] = useState(spec.title);
  useEffect(() => { setBrand(spec.brand); setTitle(spec.title); }, [project.id, project.revision]);
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

function Content({ project, commit }: { project: ChannelProject; commit: (mutation: ChannelMutation) => Promise<boolean> }) {
  const { spec } = project;
  const [pageId, setPageId] = useState(spec.navigation[0]!);
  const [name, setName] = useState('');
  const [newPage, setNewPage] = useState('');
  const [moduleTitle, setModuleTitle] = useState('');
  const [kind, setKind] = useState<'hero' | 'rail' | 'grid' | 'text'>('rail');
  const [selectedId, setSelectedId] = useState<string>('');
  const selected = spec.content.find(item => item.id === selectedId);
  const [draft, setDraft] = useState({ title: '', description: '', artwork: SAMPLE_ART, mediaUrl: SAMPLE_MEDIA, category: '' });
  const page = spec.pages.find(candidate => candidate.id === pageId) ?? spec.pages[0]!;
  useEffect(() => { if (selected) setDraft({ title: selected.title, description: selected.description, artwork: selected.artwork, mediaUrl: selected.mediaUrl, category: selected.category ?? '' }); }, [selectedId]);
  const set = (key: keyof typeof draft, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    const content: ContentItem = { id: selected?.id ?? newId('item'), title: draft.title.trim(), description: draft.description, artwork: draft.artwork, mediaUrl: draft.mediaUrl, ...(draft.category.trim() && { category: draft.category.trim() }), ...(selected?.durationSeconds && { durationSeconds: selected.durationSeconds }), ...(selected?.series && { series: selected.series }) };
    if (await commit({ type: selected ? 'updateContent' : 'addContent', content })) setSelectedId(content.id);
  };
  const addModule = async () => {
    const id = newId('mod');
    const module: Module = kind === 'text' ? { id, kind, title: moduleTitle.trim() || 'About', body: '' }
      : kind === 'hero' ? { id, kind, contentIds: [] }
      : { id, kind, title: moduleTitle.trim() || 'Collection', contentIds: [] };
    if (await commit({ type: 'addModule', pageId: page.id, module })) setModuleTitle('');
  };
  return <div className="panel-content content-editor"><span className="eyebrow">YOUR PROGRAMMING</span><h2>Curate the screen.</h2><p className="muted">Catalog items are shared across pages. Modules decide where they appear.</p>
    <div className="section-label">01 / PAGES</div><div className="chips">{spec.navigation.map(id => { const target = spec.pages.find(candidate => candidate.id === id)!; return <button key={id} className={page.id === id ? 'active' : ''} onClick={() => setPageId(id)}>{target.title}</button>; })}</div>
    <Field label="PAGE NAME"><input value={name} onChange={event => setName(event.target.value)} placeholder={page.title} /></Field><button disabled={!name.trim()} onClick={() => void commit({ type: 'updatePage', pageId: page.id, title: name.trim() }).then(saved => { if (saved) setName(''); })}>Rename page</button>
    <div className="inline-form"><input value={newPage} onChange={event => setNewPage(event.target.value)} placeholder="New page title" maxLength={120}/><button disabled={!newPage.trim()} onClick={() => { const next: Page = { id: newId('page'), title: newPage.trim(), modules: [] }; void commit({ type: 'addPage', page: next }).then(saved => { if (saved) { setPageId(next.id); setNewPage(''); } }); }}>Add page</button></div>
    {spec.pages.length > 1 && <button className="danger" onClick={() => void commit({ type: 'removePage', pageId: page.id }).then(saved => { if (saved) setPageId(spec.navigation.find(id => id !== page.id)!); })}>Remove selected page</button>}
    <div className="section-label">02 / CATALOG</div><div className="chips"><button className={!selected ? 'active' : ''} onClick={() => { setSelectedId(''); setDraft({ title: '', description: '', artwork: SAMPLE_ART, mediaUrl: SAMPLE_MEDIA, category: '' }); }}>+ New film</button>{spec.content.map(item => <button key={item.id} className={selectedId === item.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>{item.title}</button>)}</div>
    <form onSubmit={event => void saveItem(event)}><Field label="TITLE"><input required maxLength={120} value={draft.title} onChange={event => set('title', event.target.value)}/></Field><Field label="DESCRIPTION"><textarea maxLength={2000} value={draft.description} onChange={event => set('description', event.target.value)}/></Field><Field label="ARTWORK · HTTP(S) OR ASSET PATH"><input required value={draft.artwork} onChange={event => set('artwork', event.target.value)}/></Field><Field label="PLAYABLE VIDEO URL · HTTP(S)"><input required type="url" value={draft.mediaUrl} onChange={event => set('mediaUrl', event.target.value)}/></Field><Field label="CATEGORY"><input value={draft.category} onChange={event => set('category', event.target.value)}/></Field><div className="button-row"><button className="primary" type="submit">{selected ? 'Save film' : 'Add film'}</button>{selected && <button type="button" className="danger" onClick={() => void commit({ type: 'removeContent', contentId: selected.id }).then(saved => { if (saved) setSelectedId(''); })}>Remove</button>}</div></form>
    <div className="section-label">03 / TV LAYOUT · {page.title.toUpperCase()}</div><div className="inline-form"><select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="hero">Hero</option><option value="rail">Rail</option><option value="grid">Grid</option><option value="text">Text</option></select><input placeholder="Module title" maxLength={120} value={moduleTitle} onChange={event => setModuleTitle(event.target.value)}/><button onClick={() => void addModule()}>Add</button></div>
    {page.modules.map(module => <ModuleEditor key={module.id} module={module} pageId={page.id} items={spec.content} commit={commit} />)}
  </div>;
}

export default function App() {
  const [projects, setProjects] = useState<ChannelProject[]>([]);
  const [project, setProject] = useState<ChannelProject | null>(null);
  const projectRef = useRef<ChannelProject | null>(null);
  const [surface, setSurface] = useState<Surface>('Create');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newChannel, setNewChannel] = useState(false);
  const [agentEvents, setAgentEvents] = useState<Record<string, AgentEvent[]>>({});
  const select = (next: ChannelProject) => { projectRef.current = next; setProject(next); window.history.replaceState(null, '', `?project=${next.id}`); };
  const acceptProject = (next: ChannelProject) => { select(next); setProjects(previous => previous.map(item => item.id === next.id ? next : item)); };
  useEffect(() => {
    void listProjects().then(items => {
      setProjects(items);
      const requested = new URLSearchParams(window.location.search).get('project');
      const choice = items.find(item => item.id === requested) ?? items[0];
      if (choice) select(choice);
    }).catch(reason => setError(String(reason))).finally(() => setLoading(false));
  }, []);
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
  const create = async (title: string, sample: boolean, request: string) => {
    setBusy(true); setError('');
    try {
      const created = await createProject(title);
      select(created); setProjects(previous => [...previous, created]); setNewChannel(false); setSurface('Create');
      if (sample) for (const mutation of sampleMutations(created, [newId('item'), newId('item'), newId('item')], [newId('mod'), newId('mod'), newId('mod'), newId('mod')])) if (!(await commit(mutation))) break;
      if (request && projectRef.current?.id === created.id) {
        const result = await askAgent(projectRef.current, request);
        acceptProject(result.project);
        setAgentEvents(previous => ({ ...previous, [created.id]: result.events }));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <div className="app-shell"><aside className="sidebar"><div className="wordmark"><span className="mark">✳</span><span>firelaunch<small>CREATOR STUDIO</small></span></div><div className="sidebar-label">WORKSPACE</div><button className="project-switch" onClick={() => setNewChannel(true)}><span className="project-avatar">{project?.spec.title[0] ?? '+'}</span><span>{project?.spec.title ?? 'New channel'}<small>{project ? `REV ${project.revision} · LOCAL` : 'GET STARTED'}</small></span><span>＋</span></button>{projects.length > 1 && <select className="project-select" aria-label="Switch project" value={project?.id ?? ''} onChange={event => { const next = projects.find(item => item.id === event.target.value); if (next) select(next); }}>{projects.map(item => <option key={item.id} value={item.id}>{item.spec.title}</option>)}</select>}
    <div className="sidebar-label">CHANNEL WORKSPACE</div><nav className="sidebar-nav" aria-label="Studio surfaces">{surfaces.map(target => <button key={target} disabled={!project} className={surface === target ? 'active' : ''} onClick={() => setSurface(target)}><span>{icons[target]}</span>{target}</button>)}</nav><div className="sidebar-footer">✧ &nbsp; Vega-first creation<br/><small>Version 0.0.7 · Local studio</small></div></aside>
    <main><header className="topbar"><div><span className="eyebrow">STUDIO / {surface.toUpperCase()}</span><h1>{project?.spec.title ?? 'Your next channel'}</h1></div><div className="topbar-right"><span className="status"><i/> {busy ? 'SAVING' : project ? 'SAVED LOCALLY' : 'READY'}</span><button onClick={() => setNewChannel(previous => !previous)}>{newChannel && project ? '← Current channel' : '＋ New channel'}</button></div></header>
      {error && <div className="error" role="alert">{error} <button onClick={() => setError('')}>Dismiss</button></div>}
      {loading ? <div className="loading" role="status">Loading local projects…</div> : (!project || newChannel) ? <Intro busy={busy} onCreate={create} /> : <div className="workspace"><div className="workspace-main"><Preview key={project.id} spec={project.spec}/><div className="under-preview"><div><span className="eyebrow">TV-FIRST INTERACTION</span><h2>From idea to living room.</h2><p>Navigate every tile with the remote. Changes you save on the right appear here immediately. Device playback still needs separate qualification.</p></div><span className="signal">◉ &nbsp; SHARED TV SEMANTICS</span></div></div><aside className="inspector" key={`${project.id}:${surface}`}>
        {surface === 'Design' ? <Design project={project} commit={commit}/> : surface === 'Content' ? <Content project={project} commit={commit}/> : surface === 'Create' ? <AgentPanel key={project.id} project={project} onUpdate={acceptProject} events={agentEvents[project.id] ?? []} onEvents={entries => setAgentEvents(previous => ({ ...previous, [project.id]: [...(previous[project.id] ?? []), ...entries].slice(-36) }))} /> : <Delivery project={project} surface={surface} />}
      </aside></div>}
    </main></div>;
}
