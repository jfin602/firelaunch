import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const foundation = readFileSync(new URL('../cloudformation/02-firelaunch-staging-foundation.yaml', import.meta.url), 'utf8');
const app = foundation.split('  ApplicationPermissions:\n')[1].split('  PublisherPermissions:\n')[0];
const publisher = foundation.split('  PublisherPermissions:\n')[1].split('\nOutputs:')[0];
const service = foundation.split('  MediaConvertServiceRole:\n')[1].split('  EncodeQueue:\n')[0];
const bucket = foundation.split('  MediaBucketPolicy:\n')[1].split('  MediaConvertServiceRole:\n')[0];
const distribution = foundation.split('  DeliveryDistribution:\n')[1].split('  ApplicationPermissions:\n')[0];
const boundaryV2 = JSON.parse(readFileSync(new URL('../iam/firelaunch-developer-boundary.v2.json', import.meta.url), 'utf8'));
const boundaryV3 = JSON.parse(readFileSync(new URL('../iam/firelaunch-developer-boundary.v3.json', import.meta.url), 'utf8'));

test('source identity propagation is scoped to the app-to-publisher role hop', () => {
  const role = 'arn:aws:iam::363242105231:role/firelaunch/firelaunch-staging-publisher';
  const previous = boundaryV2.Statement.find(statement => statement.Sid === 'AssumeOnlyThePublisherRole');
  const proposed = boundaryV3.Statement.find(statement => statement.Sid === 'AssumeOnlyThePublisherRole');
  assert.deepEqual(proposed.Action, [...previous.Action, 'sts:SetSourceIdentity']);
  assert.equal(proposed.Resource, role);
  assert.deepEqual(boundaryV3.Statement.filter(statement => statement.Sid !== 'AssumeOnlyThePublisherRole'),
    boundaryV2.Statement.filter(statement => statement.Sid !== 'AssumeOnlyThePublisherRole'));
  assert.match(app, /Sid: AssumeOnlyThePublisherRole[\s\S]*?Action: \[sts:AssumeRole, sts:TagSession, sts:SetSourceIdentity\][\s\S]*?firelaunch-staging-publisher/);
  assert.match(app, /Sid: DenyDirectDeliveryPublication[\s\S]*?Effect: Deny/);
});

test('nested owner/asset key policy preserves distinct control, encoder and publisher roles', () => {
  const staged = '${MediaBucket.Arn}/media/*/*/*/staged/*';
  const delivery = '${MediaBucket.Arn}/media/*/*/*/delivery/*';
  assert.match(service, /Action: s3:PutObject/);
  assert.ok(service.includes(staged));
  assert.doesNotMatch(service, /\/delivery\/\*|s3:\*/);
  assert.match(app, /Sid: StagedReadAndNormalize[\s\S]*?Action: \[s3:GetObject, s3:PutObject\]/);
  assert.ok(app.includes(staged));
  assert.match(app, /Sid: DenyDirectDeliveryPublication[\s\S]*?Effect: Deny[\s\S]*?\/delivery\/\*/);
  assert.doesNotMatch(app.split('  - Sid: DenyDirectDeliveryPublication')[0], /\/delivery\/\*|s3:\*/);
  assert.ok(publisher.includes(staged) && publisher.includes(delivery));
  assert.doesNotMatch(publisher, /OriginalsBucket|\/original\/\*|s3:\*/);
  assert.ok(bucket.includes(delivery));
  assert.doesNotMatch(bucket, /\/staged\/\*|\/original\/\*/);
  assert.doesNotMatch(foundation, /\$\{MediaBucket\.Arn\}\/staged\/\*|\$\{MediaBucket\.Arn\}\/delivery\/\*/);
});

test('CloudFront maps viewer URI directly to published object and stays disabled by default', () => {
  assert.match(foundation, /DeliveryDistributionEnabled:[\s\S]*?Default: "false"/);
  assert.match(foundation, /EnableSignedDelivery: !And[\s\S]*?!Condition HasSigningKey[\s\S]*?DeliveryDistributionEnabled/);
  assert.match(distribution, /Enabled: !If \[EnableSignedDelivery, true, false\]/);
  assert.doesNotMatch(distribution, /OriginPath:/);
  assert.match(distribution, /TrustedKeyGroups: !If \[HasSigningKey/);
  assert.match(distribution, /DeliveryLockFunction\.FunctionMetadata\.FunctionARN/);
  assert.match(distribution, /DeliveryPathFunction\.FunctionMetadata\.FunctionARN/);
  const uri = `/media/${'a'.repeat(32)}/${'b'.repeat(32)}/${'c'.repeat(32)}/delivery/${'d'.repeat(32)}/${'e'.repeat(64)}/master.m3u8`;
  const pathRule = foundation.match(/if \(!([^\n]+)\.test\(uri\)\)/)?.[1];
  assert.ok(pathRule, 'viewer path guard must exist');
  const pattern = new Function(`return ${pathRule}`)();
  assert.equal(pattern.test(uri), true);
  for (const bad of [uri.replace('/delivery/', '/staged/'), '/delivery' + uri,
    uri.replace('/master.m3u8', '/../../original/secret.mp4'),
    uri.replace('/master.m3u8', '/other.m3u8/extra')]) assert.equal(pattern.test(bad), false);
  // No origin prefix means CloudFront requests this exact S3 key.
  assert.equal(uri.slice(1), `media/${'a'.repeat(32)}/${'b'.repeat(32)}/${'c'.repeat(32)}/delivery/${'d'.repeat(32)}/${'e'.repeat(64)}/master.m3u8`);
});
