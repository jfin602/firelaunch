import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const template = readFileSync(new URL('../cloudformation/02-firelaunch-staging-foundation.yaml', import.meta.url), 'utf8');
const functionBlock = template.split('  FreeDeliveryPathFunction:\n')[1]?.split('  DeliverySigningPublicKey:\n')[0];
assert.ok(functionBlock, 'free delivery function must exist');
const code = functionBlock.split('      FunctionCode: !Sub |\n')[1]?.split('\n  DeliverySigningPublicKey:')[0]
  ?.split('\n').map(line => line.replace(/^        /, '')).join('\n');
assert.ok(code, 'free delivery function source must exist');

const host = 'dl2jzii5bnotd.cloudfront.net';
// Retained release #1 prefix from docs/tasks/p6-live-vod/Q2-closeout.md.
const hls = 'media/386ad586fba749ea979ce5e39c882246/21ae035aa31743b1a8a98f145ee34f6a/' +
  '00931342d7ac4dd6b6273d4458c61845/delivery/1827d55a2f9a9390e96b3f3f8c1e6d85/' +
  '7874303d9ceabcf880f5086d9a995b5ff010dd8c05fdc4424a5ab08842829494';
const poster = `media/386ad586fba749ea979ce5e39c882246/21ae035aa31743b1a8a98f145ee34f6a/${'c'.repeat(32)}/delivery/artwork/rel_${'d'.repeat(32)}/${'e'.repeat(64)}/poster.jpg`;
const allowedPattern = template.match(/  ApprovedFreeArtworkKey:[\s\S]*?AllowedPattern: '([^']+)'/)?.[1];

function handler(artwork = poster) {
  const source = code.replaceAll('${ApprovedFreeDeliveryPrefix}', hls)
    .replaceAll('${ApprovedFreeDeliveryHost}', host)
    .replaceAll('${ApprovedFreeArtworkKey}', artwork);
  return runInNewContext(`${source}\nhandler`, {});
}

function status(fn, uri, options = {}) {
  const request = { uri, method: options.method ?? 'GET', headers: { host: { value: options.host ?? host } },
    querystring: options.querystring ?? {} };
  const result = fn({ request });
  return result === request ? 200 : result.statusCode;
}

test('one exact approved immutable poster is allowed; all adjacent keys are denied', () => {
  assert.ok(allowedPattern);
  const pattern = new RegExp(allowedPattern);
  assert.equal(pattern.test(poster), true);
  assert.equal(pattern.test(poster.replace('.jpg', '.jpeg')), true);
  assert.equal(pattern.test(poster.replace('.jpg', '.png')), true);
  for (const name of ['poster.gif', 'other.jpg', 'poster.jpg/extra', 'poster.JPG'])
    assert.equal(pattern.test(poster.replace('poster.jpg', name)), false);
  const fn = handler();
  assert.equal(status(fn, `/${poster}`), 200);
  assert.equal(status(fn, `/${poster}`, { method: 'HEAD' }), 200);
  for (const key of [
    poster.replace('386ad586fba749ea979ce5e39c882246', 'f'.repeat(32)),
    poster.replace('21ae035aa31743b1a8a98f145ee34f6a', 'f'.repeat(32)),
    poster.replace('/' + 'c'.repeat(32) + '/', '/' + 'f'.repeat(32) + '/'),
    poster.replace(`rel_${'d'.repeat(32)}`, `rel_${'f'.repeat(32)}`),
    poster.replace('e'.repeat(64), 'f'.repeat(64)),
    poster.replace('poster.jpg', 'other.jpg'),
    poster.replace('poster.jpg', 'poster.png'),
    poster.replace('/delivery/artwork/', '/staged/artwork/'),
    poster.replace('/delivery/artwork/', '/original/artwork/'),
    poster.replace('/delivery/artwork/', '/delivery/encoded/artwork/'),
    poster + '/extra', poster + '%2fextra', poster.replace('/delivery/', '/delivery/../delivery/'),
    poster.replace('/delivery/', '/delivery/%61rtwork/'),
  ]) assert.equal(status(fn, `/${key}`), 403, key);
  assert.equal(status(fn, `/${poster}`, { querystring: { token: { value: 'signed' } } }), 403);
  assert.equal(status(fn, `/${poster}`, { host: 'other.cloudfront.net' }), 403);
  assert.equal(status(fn, `/${poster}`, { method: 'OPTIONS' }), 403);
  assert.equal(status(handler(poster.replace('386ad586fba749ea979ce5e39c882246', 'f'.repeat(32))),
    `/${poster.replace('386ad586fba749ea979ce5e39c882246', 'f'.repeat(32))}`), 403);
  assert.equal(status(handler(poster.replace('21ae035aa31743b1a8a98f145ee34f6a', 'f'.repeat(32))),
    `/${poster.replace('21ae035aa31743b1a8a98f145ee34f6a', 'f'.repeat(32))}`), 403);
});

test('missing approved poster parameter fails closed while release #1 HLS stays readable', () => {
  assert.match(template, /ApprovedFreeArtworkKey:\n\s+Type: String\n\s+Default: ""/);
  const fn = handler('');
  assert.equal(status(fn, `/${poster}`), 403);
  for (const name of ['master.m3u8', 'v480.m3u8', 'v720.m3u8',
    'v480-000.ts', 'v480-001.ts', 'v720-000.ts', 'v720-001.ts'])
    assert.equal(status(fn, `/${hls}/${name}`), 200, name);
  assert.equal(status(fn, `/${hls}/v480-002.ts`), 403);
});

test('proposal keeps private S3, OAC, publisher separation, and verified image MIME', () => {
  assert.match(template, /PublicAccessBlockConfiguration:[\s\S]*?BlockPublicAcls: true[\s\S]*?BlockPublicPolicy: true[\s\S]*?IgnorePublicAcls: true[\s\S]*?RestrictPublicBuckets: true/);
  assert.match(template, /SigningBehavior: always/);
  assert.match(template, /CloudFrontReadsPublishedDeliveryObjectsOnly[\s\S]*?Action: s3:GetObject[\s\S]*?\/media\/\*\/\*\/\*\/delivery\/\*/);
  assert.match(template, /DenyDirectDeliveryPublication[\s\S]*?Action: \[s3:PutObject, s3:PutObjectTagging, s3:DeleteObject\]/);
  assert.match(template, /PublishAndRevokeDeliveryObjects/);
  assert.equal((template.match(/Type: AWS::S3::Bucket\n/g) ?? []).length, 2);
  const storage = readFileSync(new URL('../../../../apps/server/src/media-storage.ts', import.meta.url), 'utf8');
  assert.match(storage, /delivery\/artwork\/\$\{releaseId\}\/\$\{sha256\}\/poster\./);
  assert.match(storage, /ContentType: contentType/);
  assert.match(storage, /head\.ContentType !== contentType/);
  assert.match(storage, /body\.subarray\(0, 8\).*Buffer\.from\(\[137, 80, 78, 71, 13, 10, 26, 10\]\)/s);
  assert.match(storage, /body\[0\] === 0xff && body\[1\] === 0xd8/);
});
