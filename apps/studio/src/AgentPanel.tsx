import { useEffect, useState, type FormEvent } from 'react';
import type { AgentEvent } from '@firelaunch/agent';
import type { ChannelProject } from '@firelaunch/contracts';
import { agentStatus, askAgent, getProject } from './api.js';

export function AgentPanel({ project, onUpdate, events, onEvents }: { project: ChannelProject; onUpdate: (project: ChannelProject) => void; events: AgentEvent[]; onEvents: (entries: AgentEvent[]) => void }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('Checking provider…');
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void agentStatus(project.id).then(result => { if (active) { setStatus(`${result.provider.toUpperCase()} · ${result.message}`); setAvailable(result.configured); } }).catch(() => { if (active) { setStatus('Provider status unavailable'); setAvailable(false); } });
    return () => { active = false; };
  }, [project.id]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const request = message.trim();
    if (!request || busy) return;
    setMessage(''); setBusy(true);
    try {
      const result = await askAgent(project, request);
      onUpdate(result.project);
      onEvents(result.events);
      if (result.status === 'error') {
        try { onUpdate(await getProject(project.id)); } catch { setStatus('Could not refresh project; reload before editing.'); }
      }
    } catch (reason) {
      onEvents([{ kind: 'user', text: request }, { kind: 'error', text: reason instanceof Error ? reason.message : 'Agent request failed' }]);
      try { onUpdate(await getProject(project.id)); } catch { setStatus('Could not refresh project; reload before editing.'); }
    } finally { setBusy(false); }
  };
  return <div className="panel-content agent-panel"><span className="eyebrow">CHANNEL AGENT</span><h2>Describe a change.</h2><p>Validated tools save to ChannelSpec; Preview updates after each request. Mock is deterministic and offline. Bedrock configuration does not prove model access until a request succeeds.</p>
    <p className="agent-status" role="status">{status}</p>
    <div className="agent-transcript" aria-label="Agent activity" aria-live="polite">{events.length === 0 ? <p>No agent activity yet.</p> : events.map((entry, index) => <p key={index} className={`agent-${entry.kind}`}><strong>{entry.kind.toUpperCase()}</strong> {entry.text}</p>)}</div>
    <form onSubmit={event => void submit(event)}><label className="field">REQUEST<textarea maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} placeholder="e.g. Add page Explore" /></label><button className="primary" type="submit" disabled={busy || !available || !message.trim()}>{busy ? 'Working…' : 'Send request →'}</button></form>
  </div>;
}
