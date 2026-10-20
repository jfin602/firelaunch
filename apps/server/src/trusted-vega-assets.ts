import { createHash } from 'node:crypto';

// These checked-in vendor bytes contain documentation URLs and exceed the
// ordinary source limit. Only exact copies receive the narrow exception.
const trustedAssets = new Map([
  ['src/hlsjs/hls.mjs', 'd954fa4cbb8555695ada1fb846b9577dda9e4ea916eeca8274cabcc137760ed1'],
  ['src/hlsjs/LICENSE-hlsjs.txt', 'ca8773cf798c7ed997d4dd7c8e23c348699f8d5b7462636694cc14de6cda12db']
]);

export const TRUSTED_VEGA_ASSET_MAX_BYTES = 1_100_000;

export function isTrustedVegaAsset(name: string, content: string | Buffer): boolean {
  const expected = trustedAssets.get(name);
  return expected !== undefined &&
    createHash('sha256').update(content).digest('hex') === expected;
}

export function isTrustedVegaAssetPath(name: string): boolean {
  return trustedAssets.has(name);
}
