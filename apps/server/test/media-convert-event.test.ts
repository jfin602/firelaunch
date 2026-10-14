import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyMediaConvertEvent } from '../src/media-convert-event.js';

const hex = 'a'.repeat(32);
const scope = `media/${hex}/${hex}/${hex}`;
const expected = {
  awsAccountId: '123456789012', awsRegion: 'us-east-2', awsJobId: '123-job',
  queueArn: 'arn:aws:mediaconvert:us-east-2:123456789012:queues/firelaunch',
  mediaConvertRoleArn: 'arn:aws:iam::123456789012:role/firelaunch',
  originalsBucket: 'private-originals', stagingBucket: 'private-delivery',
  originalKey: `${scope}/original/${hex}.mp4`, outputStagingPrefix: `${scope}/staged/${hex}/`,
  intentToken: '00000000-0000-4000-8000-000000000000', profileHash: 'b'.repeat(64)
};
const provider = {
  id: expected.awsJobId, status: 'COMPLETE', queueArn: expected.queueArn,
  roleArn: expected.mediaConvertRoleArn,
  originalUri: `s3://${expected.originalsBucket}/${expected.originalKey}`,
  stagingUri: `s3://${expected.stagingBucket}/${expected.outputStagingPrefix}`,
  intentToken: expected.intentToken, profileHash: expected.profileHash
};
const event = { source: 'aws.mediaconvert', 'detail-type': 'MediaConvert Job State Change',
  account: expected.awsAccountId, region: expected.awsRegion,
  detail: { accountId: expected.awsAccountId, jobId: expected.awsJobId,
    queue: expected.queueArn, status: 'COMPLETE' } };

test('signed GetJob correlation reduces a completion to a private observation', () => {
  assert.deepEqual(verifyMediaConvertEvent(event, provider, expected), {
    awsAccountId: expected.awsAccountId, awsRegion: expected.awsRegion,
    awsJobId: expected.awsJobId, status: 'COMPLETE'
  });
});
test('foreign account, region, job or queue event is rejected', () => {
  for (const patch of [{ account: '999999999999' }, { region: 'us-west-2' },
    { detail: { ...event.detail, jobId: 'other' } }, { detail: { ...event.detail, queue: 'other' } }])
    assert.equal(verifyMediaConvertEvent({ ...event, ...patch }, provider, expected), null);
});
test('forged event source or claimed status is rejected', () => {
  assert.equal(verifyMediaConvertEvent({ ...event, source: 'custom' }, provider, expected), null);
  assert.equal(verifyMediaConvertEvent({ ...event, detail: { ...event.detail, status: 'ERROR' } }, provider, expected), null);
});
test('provider input, output, role and intent must match durable reservation', () => {
  for (const patch of [{ originalUri: 's3://foreign/object.mp4' },
    { stagingUri: 's3://private-delivery/public/file' }, { roleArn: 'other' },
    { intentToken: 'other' }, { profileHash: 'other' }, { queueArn: 'other' }])
    assert.equal(verifyMediaConvertEvent(event, { ...provider, ...patch }, expected), null);
});
test('invalid or delivery output prefix is rejected', () => {
  assert.equal(verifyMediaConvertEvent(event, provider,
    { ...expected, outputStagingPrefix: `${scope}/delivery/${hex}/` }), null);
  assert.equal(verifyMediaConvertEvent(event, provider,
    { ...expected, originalKey: '../other.mp4' }), null);
  assert.equal(verifyMediaConvertEvent(event, provider,
    { ...expected, outputStagingPrefix: `media/${'c'.repeat(32)}/${hex}/${hex}/staged/${hex}/` }), null);
});
test('provider error needs bounded code and cannot masquerade as completion', () => {
  const errorEvent = { ...event, detail: { ...event.detail, status: 'ERROR' } };
  assert.equal(verifyMediaConvertEvent(errorEvent, { ...provider, status: 'ERROR' }, expected), null);
  assert.equal(verifyMediaConvertEvent(errorEvent, { ...provider, status: 'ERROR', errorCode: '1515' }, expected)?.status, 'ERROR');
});
