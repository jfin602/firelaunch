import React, { useEffect, useState } from 'react';
import type { ChannelProject } from '@firelaunch/contracts';
import { buildStatus, codeOverview, createBundle, generateCode, nativeExportStatus, readSource, readiness, requestNativeBuild, runBuild, saveSource, type BuildEvidence, type CodeOverview, type NativeExportStatus, type Readiness, type SourceFile } from './api.js';
import { LivePublication } from './LivePublication.js';

export function Delivery({ project, surface, hosted = false }: { project: ChannelProject; surface: 'Code' | 'Build' | 'Publish'; hosted?: boolean }) {
  const [code, setCode] = useState<CodeOverview | null>(null);
  const [file, setFile] = useState<SourceFile | null>(null);
  const [draft, setDraft] = useState('');
  const [build, setBuild] = useState<BuildEvidence | null>(null);
  const [nativeExport, setNativeExport] = useState<NativeExportStatus | null>(null);
  const [publish, setPublish] = useState<Readiness | null>(null);
  const [bundle, setBundle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setCode(null); setFile(null); setBuild(null); setNativeExport(null); setPublish(null); setBundle(''); setError('');
    void Promise.all([codeOverview(project.id), buildStatus(project.id), readiness(project.id), hosted ? nativeExportStatus(project.id) : Promise.resolve(null)])
      .then(([source, evidence, checks, exportState]) => { if (active) { setCode(source); setBuild(evidence); setPublish(checks); setNativeExport(exportState); } })
      .catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, [project.id, project.revision, hosted]);
  async function action(work: () => Promise<void>) { setBusy(true); setError(''); try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } }
  async function open(name: string) {
    if (file && draft !== file.content && !window.confirm('Discard unsaved edits?')) return;
    await action(async () => { const next = await readSource(project.id, name); setFile(next); setDraft(next.content); });
  }
  return <div className="panel-content delivery"><span className="eyebrow">{surface.toUpperCase()} / CREATOR-OWNED</span>
    {!code && !error && <p role="status">Loading source, build and readiness evidence…</p>}
    {error && <p role="alert" className="delivery-error">{error}</p>}
    {surface === 'Code' && <><h2>Vega source</h2><p className="muted">{code?.path ? <>An ordinary source tree at <code>{code.path}</code>.</> : 'Creator-owned source is stored privately for this project.'} ChannelSpec changes require explicit regeneration; custom edits block it.</p>
      <button disabled={busy || !code || !!file && draft !== file.content} onClick={() => void action(async () => { if (code?.generated && !window.confirm('Regenerate clean source from current ChannelSpec? Existing custom edits are protected.')) return; setCode(await generateCode(project.id)); setFile(null); setPublish(await readiness(project.id)); })}>{code?.generated ? 'Regenerate source' : 'Generate source'}</button>
      {code?.stale && <p className="delivery-warning">Source differs from current ChannelSpec. Regenerate after preserving custom edits.</p>}
      {!!code?.changed.length && <p className="delivery-warning">Custom changes: {code.changed.join(', ')}. Regeneration is blocked until manually preserved or restored.</p>}
      <div className="file-list" aria-label="Generated source files">{code?.files.map(name => <button key={name} className={file?.path === name ? 'active' : ''} aria-current={file?.path === name ? 'true' : undefined} onClick={() => void open(name)}>{name}{code.changed.includes(name) ? ' • modified' : ''}</button>)}</div>
      {file && <><h3>{file.path}</h3><textarea aria-label="Generated source" spellCheck={false} value={draft} onChange={event => setDraft(event.target.value)}/><button disabled={busy || draft === file.content} onClick={() => void action(async () => { const saved = await saveSource(project.id, file, draft); setFile(saved); setCode(await codeOverview(project.id)); setBuild(await buildStatus(project.id)); })}>Save text edit</button></>}
    </>}
    {surface === 'Build' && <><h2>Release build evidence</h2><p className="muted">Local legacy builds use a verified Vega CLI. Hosted native builds use the approved published release.</p>{!hosted && code && !code.generated && <p className="delivery-warning">Generate source in Code before building.</p>}{!hosted && code?.stale && <p className="delivery-warning">Source is stale. Regenerate in Code before building.</p>}<button disabled={busy || hosted || !code?.generated || code.stale || build?.status === 'blocked'} onClick={() => void action(async () => { setBuild(await runBuild(project.id)); setPublish(await readiness(project.id)); })}>Run Vega release build</button>
      <p>Status: <strong>{build?.status ?? 'Loading'}</strong>{build?.reason && ` — ${build.reason}`}</p>
      {hosted && <section aria-label="Export App"><h3>Export App</h3><p role="status">{nativeExport ? <><strong>{nativeExport.status}</strong>{nativeExport.reason && ` — ${nativeExport.reason}`}{nativeExport.job && ` · job ${nativeExport.job.id}`}</> : 'Loading export availability…'}</p><button disabled={busy || !nativeExport || nativeExport.status !== 'blocked'} onClick={() => void action(async () => setNativeExport(await requestNativeBuild(project.id)))}>Request Vega build</button><button disabled>Download Vega ZIP</button><p className="muted">A source JSON export or submission bundle is not an installable Vega package. The ZIP download follows artifact qualification.</p></section>}
      {build?.command && <p>Command: <code>{build.command.join(' ')}</code> · exit {build.exitCode ?? 'signal'} · {build.durationMs} ms</p>}
      {build?.artifact && <p>Verified VPKG: <code>{build.artifact.path}</code> ({build.artifact.bytes} bytes)<br/>SHA-256: <code>{build.artifact.sha256}</code></p>}
      {build?.output && <pre tabIndex={0} aria-label="Build command output">{build.output}</pre>}
      {build?.toolchain && <div><h3>Toolchain doctor</h3>{(['node', 'npm', 'vegaSdk', 'vegaCli', 'device'] as const).map(key => <p key={key}>{key}: {build.toolchain[key].detail}</p>)}</div>}
    </>}
    {surface === 'Publish' && <><LivePublication project={project} hosted={hosted}/><h2>Submission handoff</h2><p className="muted">Live content publication above is not a native package build or Amazon Developer Console submission. No Amazon Developer Console action has occurred. Review each item and submit through your own Amazon account.</p>
      {publish?.checks.map(check => <p key={check.group}><strong>{check.ready ? '✓' : '○'} {check.group}</strong><br/>{check.detail}</p>)}
      {publish && <div><h3>Draft store copy</h3><p><strong>{publish.copy.appName}</strong> — {publish.copy.shortDescription}</p><p>{publish.copy.longDescription}</p><p>Release notes: {publish.copy.releaseNotes}</p><p>Artwork references: {publish.assets.artwork.join(', ') || 'None'}; screenshots: none recorded.</p></div>}
      <button disabled={busy || hosted || !publish} onClick={() => void action(async () => { const result = await createBundle(project.id); if (result.status === 'blocked') setError(result.reason ?? 'Bundle unavailable'); else setBundle(result.path ?? ''); })}>Create local submission bundle</button>{bundle && <p>Bundle: <code>{bundle}</code> (readiness, copy, assets, checklist; not submitted)</p>}
    </>}
  </div>;
}
