import React, { useEffect, useState } from 'react';
import { listVideoSubtitles, removeVideoSubtitle, uploadVideoSubtitle, type SubtitleTrack } from './api.js';

export function VideoSubtitles({ projectId, itemId, videoAssetId }: { projectId: string; itemId: string; videoAssetId: string }) {
  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [language, setLanguage] = useState('en');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setTracks([]);
    void listVideoSubtitles(projectId, itemId, videoAssetId).then(value => { if (live) setTracks(value); })
      .catch(reason => { if (live) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { live = false; };
  }, [projectId, itemId, videoAssetId]);
  const upload = async () => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const prior = tracks.find(track => track.language.toLowerCase() === language.trim().toLowerCase());
      await uploadVideoSubtitle(projectId, itemId, videoAssetId, language.trim(), file, prior);
      setTracks(await listVideoSubtitles(projectId, itemId, videoAssetId)); setFile(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const remove = async (track: SubtitleTrack) => {
    setBusy(true); setError('');
    try { await removeVideoSubtitle(projectId, track); setTracks(await listVideoSubtitles(projectId, itemId, videoAssetId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <section aria-label="Optional private subtitles"><h3>Optional subtitles</h3>
    <p>Private WebVTT tracks are saved for future use. They do not appear in the TV app yet, and captions are not required to publish.</p>
    <label className="field"><span>Language (for example, en or es)</span><input value={language} maxLength={35} onChange={event => setLanguage(event.target.value)}/></label>
    <label className="field"><span>WebVTT .vtt file (up to 256 KB)</span><input type="file" accept=".vtt,text/vtt" onChange={event => setFile(event.target.files?.[0] ?? null)}/></label>
    <button type="button" disabled={busy || !file || !language.trim()} onClick={() => void upload()}>{tracks.some(track => track.language.toLowerCase() === language.trim().toLowerCase()) ? 'Replace track' : 'Save track'}</button>
    {error && <p role="alert">{error}</p>}
    <ul>{tracks.map(track => <li key={track.id}>{track.language} · version {track.version} <button type="button" disabled={busy} onClick={() => void remove(track)}>Remove</button></li>)}</ul>
  </section>;
}
