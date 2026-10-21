// The media player is injected so the lifecycle can be checked without a Vega device.
export function createPlaybackController({ createVideo, createHls, installPolyfills, onState }) {
  let video;
  let hls;
  let surface;
  let closed = false;
  let initialized = false;
  let generation = 0;
  let startupTimer;
  let ended = false;
  let playbackStarted = false;
  const clearStartupTimer = () => { if (startupTimer) clearTimeout(startupTimer); startupTimer = undefined; };
  const report = (status, message) => { if (!closed) onState({ status, message }); };
  const reportStartup = (message) => { if (!playbackStarted) report('loading', message); };
  const onPlaying = () => { ended = false; playbackStarted = true; clearStartupTimer(); report('playing', 'Playing'); };
  const onPause = () => report('paused', 'Paused');
  const onWaiting = () => report('loading', 'Buffering');
  const onError = () => { clearStartupTimer(); report('error', 'Playback failed. Check the public stream and try again.'); };
  const onEnded = () => { ended = true; clearStartupTimer(); report('ended', 'Finished'); };
  const atEnd = () => video && Number.isFinite(video.duration) && Number.isFinite(video.currentTime)
    && video.duration > 0 && video.currentTime >= video.duration - 0.5;
  const playFromCurrentPosition = async () => {
    if (!video || closed) return;
    if (ended || atEnd()) { video.currentTime = 0; ended = false; }
    await video.play();
  };

  async function stop() {
    generation++;
    closed = true;
    clearStartupTimer();
    const oldVideo = video;
    const oldHls = hls;
    const oldSurface = surface;
    video = undefined;
    hls = undefined;
    surface = undefined;
    if (oldVideo && initialized) {
      for (const [name, listener] of [['playing', onPlaying], ['pause', onPause],
        ['waiting', onWaiting], ['error', onError], ['ended', onEnded]]) oldVideo.removeEventListener(name, listener);
      try { oldVideo.pause(); } catch { /* deinitialize still must run */ }
    }
    try { if (oldHls) await oldHls.destroy(); } catch { /* release media below */ }
    if (oldVideo && initialized) {
      try { if (oldSurface) oldVideo.clearSurfaceHandle(oldSurface); } catch { /* surface is already gone */ }
      try { await oldVideo.deinitialize(); } catch { /* preserve Back navigation */ }
    }
    if (oldVideo && global.gmedia === oldVideo) global.gmedia = null;
  }

  return {
    isClosed: () => closed,
    snapshot: () => ({ currentTime: Number.isFinite(video?.currentTime) ? video.currentTime : 0,
      duration: Number.isFinite(video?.duration) ? video.duration : 0,
      paused: video?.paused !== false, muted: video?.muted === true }),
    async start(handle, item, muted) {
      if (closed || video) return;
      const mine = ++generation;
      surface = handle;
      report('loading', 'Loading video');
      try {
        const instance = createVideo();
        video = instance;
        await instance.initialize();
        initialized = true;
        if (closed || generation !== mine) { await instance.deinitialize(); return; }
        instance.setSurfaceHandle(handle);
        instance.autoplay = false;
        instance.muted = muted;
        for (const [name, listener] of [['playing', onPlaying], ['pause', onPause],
          ['waiting', onWaiting], ['error', onError], ['ended', onEnded]]) instance.addEventListener(name, listener);
        if (/\.m3u8$/i.test(new URL(item.mediaUrl).pathname)) {
          installPolyfills(instance);
          const adaptive = createHls();
          hls = adaptive;
          adaptive.on(adaptive.Events.ERROR, (_, detail) => {
            console.warn('FireLaunch HLS error', detail?.type, detail?.details, detail?.fatal === true);
            if (detail?.fatal && detail?.details === 'bufferStalledError' && atEnd()) onEnded();
            else if (detail?.fatal) onError();
          });
          adaptive.on(adaptive.Events.MANIFEST_LOADING, () => reportStartup('Requesting stream'));
          adaptive.on(adaptive.Events.MANIFEST_LOADED, () => reportStartup('Preparing video'));
          adaptive.on(adaptive.Events.FRAG_LOADING, () => reportStartup('Requesting video segment'));
          adaptive.on(adaptive.Events.FRAG_LOADED, () => reportStartup('Video segment received'));
          adaptive.on(adaptive.Events.BUFFER_APPENDED, () => reportStartup('Preparing video frames'));
          // MSE has no playable source until Hls.js has parsed the manifest.
          // Calling play immediately after attachMedia can reject before a
          // MediaSource exists, leaving the surface permanently idle.
          adaptive.on(adaptive.Events.MANIFEST_PARSED, () => {
            if (!closed && generation === mine) void (async () => {
              reportStartup('Starting video');
              try { await playFromCurrentPosition(); } catch { onError(); }
            })();
          });
          startupTimer = setTimeout(() => {
            console.warn('FireLaunch HLS startup timed out');
            onError();
          }, 30_000);
          adaptive.loadSource(item.mediaUrl);
          adaptive.attachMedia(instance);
        } else {
          instance.src = item.mediaUrl;
          instance.load();
          if (closed || generation !== mine) return;
          await playFromCurrentPosition();
        }
      } catch { onError(); }
    },
    async stop() { await stop(); },
    async toggle() {
      if (!video || closed) return;
      try { if (video.paused || ended) await playFromCurrentPosition(); else video.pause(); } catch { onError(); }
    },
    async play() { if (video && !closed) try { await playFromCurrentPosition(); } catch { onError(); } },
    pause() { if (video && !closed) video.pause(); },
    seek(seconds) {
      if (!video || closed || !Number.isFinite(video.currentTime)) return;
      const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
      video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
      ended = false;
    },
    toggleMute() { if (video && !closed) video.muted = !video.muted; }
  };
}
