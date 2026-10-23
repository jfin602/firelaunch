import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseArgs, validateScope } from '../recovery-mode.mjs';

const env = {
  VEGALAUNCH_OBJECT_STORE: 's3', VEGALAUNCH_OBJECT_AUTH: 'aws-profile', VEGALAUNCH_OBJECT_REGION: 'us-east-2',
  VEGALAUNCH_OBJECT_BUCKET: 'firelaunch-staging-originals-363242105231-use2',
  VEGALAUNCH_RESTORE_OBJECT_BUCKET: 'firelaunch-staging-media-363242105231-use2',
  VEGALAUNCH_RECOVERY_KEY: 'a'.repeat(64),
  VEGALAUNCH_DATABASE_URL: 'postgres://operator@localhost/vegalaunch_qualification_schema10',
  VEGALAUNCH_RESTORE_DATABASE_URL: 'postgres://operator@localhost/vegalaunch_restore_schema10'
};
const approval = { account: '363242105231', region: 'us-east-2', mode: 'restore',
  sourceBucket: env.VEGALAUNCH_OBJECT_BUCKET, destinationBucket: env.VEGALAUNCH_RESTORE_OBJECT_BUCKET,
  approvalId: 'c6_rehearsal_01', expiresAt: '2099-01-01T00:00:00Z' };

test('recovery operations require an explicit approval document', () => {
  assert.throws(() => parseArgs(['--mode', 'restore', '--release', '/tmp/release', '--archive', '/tmp/a.flrec', '--evidence', '/tmp/evidence.json']));
  assert.equal(parseArgs(['--mode', 'restore', '--release', '/tmp/release', '--archive', '/tmp/a.flrec', '--evidence', '/tmp/evidence.json', '--authorization-file', '/tmp/approval.json']).mode, 'restore');
});
test('scope rejects live database, wrong bucket, expired or wrong-mode authorization', () => {
  assert.doesNotThrow(() => validateScope(env, 'restore', approval));
  assert.throws(() => validateScope({ ...env, VEGALAUNCH_DATABASE_URL: 'postgres://operator@localhost/firelaunch_staging' }, 'restore', approval));
  assert.throws(() => validateScope({ ...env, VEGALAUNCH_RESTORE_OBJECT_BUCKET: env.VEGALAUNCH_OBJECT_BUCKET }, 'restore', approval));
  assert.throws(() => validateScope(env, 'backup', approval));
  assert.throws(() => validateScope(env, 'restore', { ...approval, expiresAt: '2000-01-01T00:00:00Z' }));
  assert.throws(() => validateScope({ ...env, VEGALAUNCH_OBJECT_ENDPOINT: 'https://other.example' }, 'restore', approval));
});
