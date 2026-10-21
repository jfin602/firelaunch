// The media player is injected so the lifecycle can be checked without a Vega device.
export function createPlaybackController({ createVideo, createHls, installPolyfills, onState }) {
  let video;
  let hls;
  let surface;
  let closed = false;
  let initialized = false;
  let generation = 0;
  let startupTimer;
  const clearStartupTimer = () => { if (startupTimer) clearTimeout(startupTimer); startupTimer = undefined; };
  const report = (status, message) => { if (!closed) onState({ status, message }); };
  const onPlaying = () => { clearStartupTimer(); report('playing', 'Playing'); };
  const onPause = () => report('paused', 'Paused');
  const onWaiting = () => report('loading', 'Buffering');
  const onError = () => { clearStartupTimer(); report('error', 'Playback failed. Check the public stream and try again.'); };

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
        ['waiting', onWaiting], ['error', onError]]) oldVideo.removeEventListener(name, listener);
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
          ['waiting', onWaiting], ['error', onError]]) instance.addEventListener(name, listener);
        if (/\.m3u8$/i.test(new URL(item.mediaUrl).pathname)) {
          installPolyfills(instance);
          const adaptive = createHls();
          hls = adaptive;
          adaptive.on(adaptive.Events.ERROR, (_, detail) => {
            console.warn('FireLaunch HLS error', detail?.type, detail?.details, detail?.fatal === true);
            if (detail?.fatal) onError();
          });
          adaptive.on(adaptive.Events.MANIFEST_LOADING, () => report('loading', 'Requesting stream'));
          adaptive.on(adaptive.Events.MANIFEST_LOADED, () => report('loading', 'Preparing video'));
          adaptive.on(adaptive.Events.FRAG_LOADING, () => report('loading', 'Requesting video segment'));
          adaptive.on(adaptive.Events.FRAG_LOADED, () => report('loading', 'Video segment received'));
          adaptive.on(adaptive.Events.BUFFER_APPENDED, () => report('loading', 'Preparing video frames'));
          // MSE has no playable source until Hls.js has parsed the manifest.
          // Calling play immediately after attachMedia can reject before a
          // MediaSource exists, leaving the surface permanently idle.
          adaptive.on(adaptive.Events.MANIFEST_PARSED, () => {
            if (!closed && generation === mine) void (async () => {
              report('loading', 'Starting video');
              try { await instance.play(); } catch { onError(); }
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
          await instance.play();
        }
      } catch { onError(); }
    },
    async stop() { await stop(); },
    async toggle() {
      if (!video || closed) return;
      try { if (video.paused) await video.play(); else video.pause(); } catch { onError(); }
    },
    async play() { if (video && !closed) try { await video.play(); } catch { onError(); } },
    pause() { if (video && !closed) video.pause(); },
    seek(seconds) {
      if (!video || closed || !Number.isFinite(video.currentTime)) return;
      const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
      video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
    },
    toggleMute() { if (video && !closed) video.muted = !video.muted; }
  };
}
