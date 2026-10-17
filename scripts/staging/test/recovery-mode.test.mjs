import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseArgs, validateScope } from '../recovery-mode.mjs';

const env = {
  FIRELAUNCH_OBJECT_STORE: 's3', FIRELAUNCH_OBJECT_AUTH: 'aws-profile', FIRELAUNCH_OBJECT_REGION: 'us-east-2',
  FIRELAUNCH_OBJECT_BUCKET: 'firelaunch-staging-originals-363242105231-use2',
  FIRELAUNCH_RESTORE_OBJECT_BUCKET: 'firelaunch-staging-media-363242105231-use2',
  FIRELAUNCH_RECOVERY_KEY: 'a'.repeat(64),
  FIRELAUNCH_DATABASE_URL: 'postgres://operator@localhost/firelaunch_qualification_schema10',
  FIRELAUNCH_RESTORE_DATABASE_URL: 'postgres://operator@localhost/firelaunch_restore_schema10'
};
const approval = { account: '363242105231', region: 'us-east-2', mode: 'restore',
  sourceBucket: env.FIRELAUNCH_OBJECT_BUCKET, destinationBucket: env.FIRELAUNCH_RESTORE_OBJECT_BUCKET,
  approvalId: 'c6_rehearsal_01', expiresAt: '2099-01-01T00:00:00Z' };

test('recovery operations require an explicit approval document', () => {
  assert.throws(() => parseArgs(['--mode', 'restore', '--release', '/tmp/release', '--archive', '/tmp/a.flrec', '--evidence', '/tmp/evidence.json']));
  assert.equal(parseArgs(['--mode', 'restore', '--release', '/tmp/release', '--archive', '/tmp/a.flrec', '--evidence', '/tmp/evidence.json', '--authorization-file', '/tmp/approval.json']).mode, 'restore');
});
test('scope rejects live database, wrong bucket, expired or wrong-mode authorization', () => {
  assert.doesNotThrow(() => validateScope(env, 'restore', approval));
  assert.throws(() => validateScope({ ...env, FIRELAUNCH_DATABASE_URL: 'postgres://operator@localhost/firelaunch_staging' }, 'restore', approval));
  assert.throws(() => validateScope({ ...env, FIRELAUNCH_RESTORE_OBJECT_BUCKET: env.FIRELAUNCH_OBJECT_BUCKET }, 'restore', approval));
  assert.throws(() => validateScope(env, 'backup', approval));
  assert.throws(() => validateScope(env, 'restore', { ...approval, expiresAt: '2000-01-01T00:00:00Z' }));
  assert.throws(() => validateScope({ ...env, FIRELAUNCH_OBJECT_ENDPOINT: 'https://other.example' }, 'restore', approval));
});
