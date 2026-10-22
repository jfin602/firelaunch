import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export type AudioPlayerHandle = { command: (value: 'left' | 'right' | 'select') => void };

const clock = (seconds: number) => Number.isFinite(seconds) && seconds >= 0
  ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';

/** Shared Studio transport for owned drafts and the TV preview. Native delivery is qualified separately. */
export const AudioPlayer = forwardRef<AudioPlayerHandle, {
  source: string; title: string; creator?: string; artwork?: React.ReactNode; onBack?: () => void;
  autoPlay?: boolean; startMuted?: boolean;
}>(function AudioPlayer({ source, title, creator, artwork, onBack, autoPlay = false, startMuted = false }, ref) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(startMuted);
  const seek = (seconds: number) => {
    const element = audio.current;
    if (element && Number.isFinite(element.duration) && element.duration > 0)
      element.currentTime = Math.max(0, Math.min(element.duration, element.currentTime + seconds));
  };
  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setError('Playback could not start. Check this file and try again.'));
    else element.pause();
  };
  useImperativeHandle(ref, () => ({ command: value => {
    if (value === 'left') seek(-10);
    else if (value === 'right') seek(10);
    else toggle();
  } }));
  return <div className="audio-player" aria-label={`Audio player for ${title}`}>
    <div className="audio-player-cover">{artwork ?? <span aria-label="Cover unavailable">♫</span>}</div>
    <div className="audio-player-body"><span className="eyebrow">NOW LISTENING</span><h3>{title}</h3>{creator && <p>{creator}</p>}
      <audio ref={audio} src={source} preload="metadata" autoPlay={autoPlay} muted={muted}
        onPlay={() => { setPlaying(true); setError(''); }} onPause={() => setPlaying(false)}
        onTimeUpdate={event => setElapsed(event.currentTarget.currentTime)}
        onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
        onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setError('Audio could not be loaded.'); }}/>
      <div className="audio-player-controls"><button type="button" onClick={() => seek(-10)} aria-label="Back ten seconds">−10s</button>
        <button type="button" onClick={toggle}>{playing ? 'Pause' : 'Play'}</button>
        <button type="button" onClick={() => seek(10)} aria-label="Forward ten seconds">+10s</button>
        <button type="button" onClick={() => setMuted(value => !value)}>{muted ? 'Unmute' : 'Mute'}</button></div>
      <label className="audio-player-progress"><span>{clock(elapsed)}</span><input type="range" min={0} max={Number.isFinite(duration) && duration > 0 ? duration : 1}
        value={Math.min(elapsed, Number.isFinite(duration) && duration > 0 ? duration : 1)}
        aria-label="Playback position" disabled={!Number.isFinite(duration) || duration <= 0}
        onChange={event => { if (audio.current) audio.current.currentTime = Number(event.target.value); }}/><span>{clock(duration)}</span></label>
      {error && <p role="alert">{error}</p>}{onBack && <button type="button" onClick={onBack}>← Back to details</button>}
    </div>
  </div>;
});
