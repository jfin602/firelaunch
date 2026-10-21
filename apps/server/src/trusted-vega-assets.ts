import { createHash } from 'node:crypto';

// These checked-in vendor bytes contain documentation URLs and exceed the
// ordinary source limit. Only exact copies receive the narrow exception.
const trustedAssets = new Map([
  ['src/hlsjs/hls.mjs', 'c539f487d215723ff0e78d57a94ef42c8ddc550fbb5194cd3d53673400549941'],
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
