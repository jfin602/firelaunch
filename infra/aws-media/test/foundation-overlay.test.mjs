import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const overlay = readFileSync(new URL('../foundation-overlay.yaml', import.meta.url), 'utf8');
const baseline = readFileSync(new URL('../template.yaml', import.meta.url), 'utf8');
const profile = JSON.parse(readFileSync(new URL('../hls-avc-aac-v1.settings.json', import.meta.url), 'utf8'));
const section = (name, next) => overlay.split(`  ${name}:\n`)[1]?.split(`  ${next}:\n`)[0] ?? '';

test('overlay imports buckets and creates no CDN or public bucket', () => {
  assert.doesNotMatch(overlay, /Type: AWS::(?:S3::Bucket|CloudFront::Distribution|S3::BucketPolicy)/);
  assert.doesNotMatch(overlay, /PublicReadAccess|AllUsers|AuthenticatedUsers|\*\.amazonaws\.com/);
  assert.doesNotMatch(overlay, /s3:DeleteObject|LifecycleConfiguration|DeletionPolicy: Delete/);
  assert.match(baseline, /Resource: !Sub '\$\{DeliveryBucket\.Arn\}\/media\/\*\/\*\/\*\/delivery\/\*'/);
  assert.doesNotMatch(section('DeliveryBucketPolicy', 'UploaderRole'), /staged\/\*/);
  assert.equal((baseline.match(/SSEAlgorithm: AES256/g) ?? []).length, 2);
  assert.equal((baseline.match(/BlockPublicPolicy: true/g) ?? []).length, 2);
});
test('submit is control-plane admitted after verified upload, never raw S3 event', () => {
  assert.match(section('ControlPlaneMediaPolicy', 'MediaConvertEventsQueue'), /ControlPlaneRoleName/);
  assert.match(section('ControlPlaneMediaPolicy', 'MediaConvertEventsQueue'), /mediaconvert:CreateJob/);
  assert.doesNotMatch(overlay, /AWS::S3::BucketNotification|s3:ObjectCreated|s3\.amazonaws\.com/);
});
test('MediaConvert reads originals and writes staging only', () => {
  const role = section('MediaConvertRole', 'ControlPlaneMediaPolicy');
  assert.match(role, /original\/\*'/);
  assert.match(role, /staged\/\*'/);
  assert.doesNotMatch(role, /delivery\/\*|s3:\*|Resource: '\*'|s3:DeleteObject/);
});
test('control plane cannot publish or administer buckets', () => {
  const policy = section('ControlPlaneMediaPolicy', 'MediaConvertEventsQueue');
  assert.doesNotMatch(policy, /delivery\/\*|s3:PutObject|s3:DeleteObject|s3:PutBucketPolicy|iam:\*|Action: '\*'/);
  assert.match(policy, /iam:PassedToService/);
  assert.match(policy, /sqs:ReceiveMessage, sqs:DeleteMessage/);
});
test('completion route is restricted and recoverable', () => {
  const rule = section('MediaConvertEvents', 'EventDeadLetterPolicy');
  assert.match(rule, /State: DISABLED/);
  assert.match(rule, /source: \[aws\.mediaconvert\]/);
  assert.match(rule, /queue: \[!GetAtt BoundedQueue\.Arn\]/);
  assert.match(rule, /account: \[!Ref 'AWS::AccountId'\]/);
  assert.match(rule, /DeadLetterConfig:/);
  assert.match(rule, /RetryPolicy:/);
  assert.match(section('EventDeadLetterQueue', 'MediaConvertEvents'), /MessageRetentionPeriod: 1209600/);
  assert.match(section('MediaConvertEventsQueue', 'EventDeadLetterQueue'), /maxReceiveCount: 5/);
});
test('spend defaults are paused and bounded', () => {
  assert.match(overlay, /PricingPlan: ON_DEMAND/);
  assert.match(overlay, /ConcurrentJobs: 1/);
  assert.match(overlay, /Status: PAUSED/);
  assert.match(overlay, /RedrivePolicy:/);
});
test('fixed profile has only 480p and 720p H.264/AAC private destinations', () => {
  const group = profile.OutputGroups[0];
  assert.equal(group.OutputGroupSettings.HlsGroupSettings.Destination, 'REPLACE_WITH_RESERVED_PRIVATE_STAGING_S3_URI');
  assert.deepEqual(group.Outputs.map(o => o.VideoDescription.Height), [480, 720]);
  for (const output of group.Outputs) {
    assert.equal(output.VideoDescription.CodecSettings.Codec, 'H_264');
    assert.equal(output.AudioDescriptions[0].CodecSettings.Codec, 'AAC');
    assert.equal(output.ContainerSettings.Container, 'M3U8');
  }
  assert.equal(profile.Inputs[0].FileInput, 'REPLACE_WITH_VERIFIED_ORIGINAL_S3_URI');
});
