import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('vendored fragment XHR completion tolerates Kepler strict timer handles', () => {
  const source = readFileSync(new URL('../../../templates/vega-channel/src/hlsjs/hls.mjs', import.meta.url), 'utf8');
  const fragmentClass = source.slice(source.indexOf('class FragmentLoader {'), source.indexOf('function createLoaderContext('));
  const xhrClass = source.slice(source.indexOf('class XhrLoader {'), source.indexOf('class FetchLoader {'));
  const active = new Set<number>([7]);
  const cleared: number[] = [];
  const self = {
    performance: { now: () => 3 },
    clearTimeout: (handle: number) => {
      if (!active.delete(handle)) throw new Error(`invalid timer handle ${handle}`);
      cleared.push(handle);
    }
  };
  const { FragmentLoader, XhrLoader } = runInNewContext(
    `${fragmentClass}\n${xhrClass}\n({ FragmentLoader, XhrLoader })`,
    { self }
  ) as { FragmentLoader: new (...args: unknown[]) => Record<string, any>; XhrLoader: new (...args: unknown[]) => Record<string, any> };
  const fragment = new FragmentLoader({});
  const xhrLoader = Object.create(XhrLoader.prototype);
  const bytes = new Uint8Array([0x47, 0x40, 0x00]).buffer;
  const xhr = { readyState: 4, status: 200, responseType: 'arraybuffer', response: bytes,
    responseURL: 'https://cdn.example.org/segment.ts', onreadystatechange: null, onprogress: null };
  xhrLoader.loader = xhr;
  xhrLoader.requestTimeout = 7;
  xhrLoader.retryTimeout = undefined;
  xhrLoader.stats = { aborted: false, loading: { start: 1, first: 2, end: 0 } };
  xhrLoader.config = { loadPolicy: { maxLoadTimeMs: 1000 } };
  xhrLoader.context = { responseType: 'arraybuffer' };
  const frag = { loader: xhrLoader };
  fragment.loader = xhrLoader;
  let received = 0;
  xhrLoader.callbacks = { onSuccess: (response: { data: ArrayBuffer }) => {
    received = response.data.byteLength;
    fragment.resetLoader(frag, xhrLoader);
  } };

  xhrLoader.readystatechange();

  assert.equal(received, 3);
  assert.deepEqual(cleared, [7]);
  assert.equal(fragment.partLoadTimeout, -1);
  assert.equal(fragment.loader, null);
  assert.equal(frag.loader, null);
});
