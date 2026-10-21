import { Hls, Events, XhrLoader } from './hls.mjs';
import Document from './polyfills/DocumentPolyfill';
import Element from './polyfills/ElementPolyfill';
import TextDecoderPolyfill from './polyfills/TextDecoderPolyfill';
import W3CMediaPolyfill from './polyfills/W3CMediaPolyfill';
import MiscPolyfill from './polyfills/MiscPolyfill';

// Amazon's SDK 0.24 MSE port needs these globals before constructing Hls.
export function installHlsPolyfills(video) {
  global.gmedia = video;
  Document.install();
  Element.install();
  TextDecoderPolyfill.install();
  W3CMediaPolyfill.install();
  MiscPolyfill.install();
}

export function createHlsPlayer() {
  const player = new Hls({
    enableWorker: false,
    emeEnabled: false,
    progressive: false,
    // Vega's FetchLoader parses text playlists but can stall on binary TS segments.
    // Keep playlist fetch behavior and use the vendored XHR loader for fragments.
    fLoader: XhrLoader,
    lowLatencyMode: false,
    backBufferLength: 30
  });
  return { Events, on: (...args) => player.on(...args),
    attachMedia: media => player.attachMedia(media),
    loadSource: url => player.loadSource(url),
    destroy: () => player.destroy() };
}
