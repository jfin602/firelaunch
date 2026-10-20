import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

// A ChannelSpec keeps its stable, public delivery URL. Studio preview can use a
// separate authenticated route for that exact managed rendition without persisting it.
export function studioVideoSource(source: string, projectId?: string, contentId?: string): string {
  if (!projectId || !contentId) return source;
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.search || url.hash ||
      !/^\/media\/[a-f0-9]{32}\/[a-f0-9]{32}\/[a-f0-9]{32}\/delivery\/[a-f0-9]{32}\/[a-f0-9]{64}\/master\.m3u8$/.test(url.pathname)) return source;
    return `/api/projects/${encodeURIComponent(projectId)}/preview-hls/${encodeURIComponent(contentId)}/master.m3u8`;
  } catch { return source; }
}

export function VideoPlayer({ source, startMuted, projectId, contentId }: {
  source: string; startMuted: boolean; projectId?: string; contentId: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsActive = useRef(false);
  const [error, setError] = useState('');
  const playableSource = studioVideoSource(source, projectId, contentId);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError('');
    hlsActive.current = false;
    const hlsSource = /\.m3u8(?:$|[?#])/.test(playableSource);
    if (!hlsSource || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playableSource;
      return () => { video.pause(); video.removeAttribute('src'); video.load(); };
    }
    if (!Hls.isSupported()) {
      setError('This browser cannot play this video format.');
      return;
    }
    const hls = new Hls({ enableWorker: true });
    hlsActive.current = true;
    let networkRecovered = false;
    let mediaRecovered = false;
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !networkRecovered) {
        networkRecovered = true;
        hls.startLoad();
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
        mediaRecovered = true;
        hls.recoverMediaError();
      } else {
        setError('Video playback is unavailable. Check your connection or video access and reopen it.');
        hls.stopLoad();
      }
    });
    hls.attachMedia(video);
    hls.loadSource(playableSource);
    return () => { hlsActive.current = false; hls.destroy(); video.pause(); video.removeAttribute('src'); video.load(); };
  }, [playableSource]);

  return <><video ref={videoRef} controls autoPlay muted={startMuted} playsInline onError={() => {
    if (!hlsActive.current) setError('Video playback is unavailable. Check the format or video access.');
  }}/>{error && <p role="alert" className="tv-player-error">{error}</p>}</>;
}
