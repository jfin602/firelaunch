import React, { useEffect, useRef, useState } from 'react';
import { StudioModal, ModalHeader, ModalFooter } from './StudioModal.js';
import type { ChannelProject } from '@firelaunch/contracts';
import { downloadNativeExport, nativeExportStatus, readDeployment, readLiveSummary,
  requestNativeBuild, type NativeExportStatus } from './api.js';

const active = (status: NativeExportStatus | null) => status?.status === 'queued' || status?.status === 'running';
const formatBytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

export function NativeExportWorkspace({ project, initial, onClose, onStatus }: {
  project: ChannelProject; initial: NativeExportStatus | null; onClose: () => void;
  onStatus: (status: NativeExportStatus) => void;
}) {
  const [status, setStatus] = useState<NativeExportStatus | null>(initial);
  const [deployment, setDeployment] = useState<Awaited<ReturnType<typeof readDeployment>> | null>(null);
  const [release, setRelease] = useState<Awaited<ReturnType<typeof readLiveSummary>>>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const pending = useRef(false);
  const refresh = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      setVerifying(true);
      const next = await nativeExportStatus(project.id);
      setStatus(next); onStatus(next); setError('');
    } catch (reason) { setStatus(null); setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { pending.current = false; setVerifying(false); setLoading(false); }
  };
  useEffect(() => {
    let live = true;
    void readDeployment(project.id).then(async bound => {
      const current = await readLiveSummary(project.id, bound.id);
      if (live) { setDeployment(bound); setRelease(current); }
    }).catch(() => { if (live) { setDeployment(null); setRelease(null); } });
    void refresh();
    return () => { live = false; };
  }, [project.id]);
  useEffect(() => {
    if (!active(status)) return;
    const poll = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    const timer = window.setInterval(poll, 5_000);
    document.addEventListener('visibilitychange', poll);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', poll); };
  }, [project.id, status?.status, status?.job?.id]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const retry = async () => {
    if (busy || !['failed', 'canceled', 'expired'].includes(status?.status ?? '')) return;
    setBusy(true); setError('');
    try { const next = await requestNativeBuild(project.id); setStatus(next); onStatus(next); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const download = async () => {
    if (!status?.downloadReady || !status.job || busy) return;
    setBusy(true); setError('');
    try { await downloadNativeExport(project.id, status.job.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); await refresh(); }
    finally { setBusy(false); }
  };
  const stage = busy && !status?.downloadReady ? 'Preparing' : verifying && status?.status === 'ready' ? 'Verifying' :
    status?.status === 'queued' ? 'Queued' : status?.status === 'running' ? 'Building' :
      status?.downloadReady ? 'Ready' : status?.status === 'failed' ? 'Failed' :
        status?.status === 'expired' ? 'Expired' : status?.status === 'canceled' ? 'Canceled' : 'Preparing';
  const elapsed = status?.job?.createdAt ? Math.max(0, Math.floor((clock - Date.parse(status.job.createdAt)) / 1000)) : 0;
  return <StudioModal className="video-workspace native-export-workspace" titleId="native-export-title" descriptionId="native-export-description" onClose={onClose}>
    <ModalHeader eyebrow="VEGA APP DELIVERY" title="Build & Export App" titleId="native-export-title" descriptionId="native-export-description" description={project.spec.title} onClose={onClose} closeLabel="Close app export"/>
    <div className="video-workspace-body native-export-body" aria-live="polite">
      <div className="native-export-summary"><div><small>APP</small><strong>{deployment?.appName ?? project.spec.title}</strong></div><div><small>APP PACKAGE</small><strong>{deployment?.packageId ?? 'No approved deployment'}</strong></div><div><small>PUBLISHED RELEASE</small><strong>{release ? `Release #${release.sequence}` : 'No approved release'}</strong></div></div>
      {error && <p role="alert" className="catalog-error">{error}</p>}
      {loading && <p role="status">Restoring the current build from the server…</p>}
      {!loading && <section className="native-export-stage"><div className="native-export-stage-heading"><span className={active(status) || verifying || busy ? 'native-export-spinner' : 'native-export-dot'} aria-hidden="true"/><div><span className="eyebrow">BUILD STATUS</span><h3>{stage}</h3></div></div>
        {status?.status === 'queued' && <p>Your build is in the queue. You can close this popup and return later.</p>}
        {status?.status === 'running' && <p>The isolated Vega worker is building the approved release. You can browse Studio while it runs.</p>}
        {status?.status === 'failed' && <p>The build failed. Review the error before retrying.</p>}
        {status?.status === 'expired' && <p>The previous build expired. Retry to check the current approved release.</p>}
        {status?.reason && <p>{status.reason}</p>}
        {status?.job?.errorCode && <p>Worker result: {status.job.errorCode}</p>}
        {status?.job && <p className="native-export-meta">Job {status.job.id} · Attempt {status.job.attempt ?? 0}{active(status) && ` · Elapsed ${Math.floor(elapsed / 60)}m ${String(elapsed % 60).padStart(2,'0')}s`}</p>}
      </section>}
      {status?.downloadReady && status.job ? <div className="native-export-ready"><p>The verified x86_64 Vega package is ready in a four-file ZIP.</p><dl><div><dt>Architecture</dt><dd>x86_64 Release</dd></div><div><dt>Package size</dt><dd>{status.job.artifactBytes ? formatBytes(status.job.artifactBytes) : 'Verified'}</dd></div><div><dt>Completed</dt><dd>{status.job.completedAt ? new Date(status.job.completedAt).toLocaleString() : 'Ready'}</dd></div></dl><button className="primary" type="button" disabled={busy} onClick={() => void download()}>{busy ? 'Preparing download…' : 'Download ZIP'}</button></div>
        : ['failed', 'canceled', 'expired'].includes(status?.status ?? '') ? <button className="primary" type="button" disabled={loading || busy || !deployment || !release} onClick={() => void retry()}>{busy ? 'Checking approved release…' : 'Retry native build'}</button>
          : !deployment || !release ? <p>Approve a deployment and publish a rights-cleared release in Publish before exporting the native app.</p> : null}
      <p className="muted">The build continues after you close this popup. Reopen it to check progress or download the finished app.</p>
      <ModalFooter><button type="button" onClick={onClose} data-modal-close>Close</button></ModalFooter>
    </div>
  </StudioModal>;
}
