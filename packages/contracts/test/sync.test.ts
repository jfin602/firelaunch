import assert from 'node:assert/strict';
import test from 'node:test';
import { syncEventKey, syncObservationSchema, syncPolicySchema, validateSyncDecision } from '../src/index.js';

const hex = (digit: string) => digit.repeat(32);
const creatorAccountId = `cr_${hex('a')}`;
const projectId = `ch_${hex('b')}`;
const sourceId = `src_${hex('c')}`;
const catalogItemId = `ci_${hex('d')}`;
const timestamp = '2026-10-09T00:00:00.000Z';
const externalId = { provider: 'creator' as const, kind: 'feed_item_id' as const, value: 'film-1' };
const policy = () => ({
  schemaVersion: 1, creatorAccountId, projectId, sourceId,
  fieldOwnership: { title: 'source' as const, description: 'source' as const, artworkUrl: 'creator' as const },
  newItemRule: 'review' as const, missingItemRule: { graceHours: 168, afterGrace: 'review' as const },
  conflictRule: 'queue_review' as const, revocationRule: 'suspend_source_and_media' as const
});
const event = { sourceId, externalId, contentSha256: 'a'.repeat(64) };
const observation = () => ({
  schemaVersion: 1, creatorAccountId, projectId, event, observedAt: timestamp,
  kind: 'field_changes' as const, status: 'accepted' as const, catalogItemId,
  changes: [{ field: 'title' as const, afterSha256: 'b'.repeat(64), decision: 'accept_source' as const }]
});
const item = () => ({
  schemaVersion: 1, id: catalogItemId, creatorAccountId, projectId, kind: 'video',
  sourceRecord: { sourceId, externalId, observedAt: timestamp, metadata: { title: 'Source title' } },
  externalIdentifiers: [externalId], mediaAssetIds: [],
  creatorOverrides: { title: 'Creator title', editedAt: timestamp }
});

test('sync identity is stable and policy is review and grace bound', () => {
  assert.equal(syncEventKey(event), syncEventKey({ ...event }));
  assert.equal(syncPolicySchema.parse(policy()).missingItemRule.graceHours, 168);
  assert.equal(syncPolicySchema.safeParse({ ...policy(), newItemRule: 'publish' }).success, false);
  assert.equal(syncPolicySchema.safeParse({ ...policy(), missingItemRule: { graceHours: 0, afterGrace: 'delete' } }).success, false);
  assert.equal(syncPolicySchema.safeParse({ ...policy(), accessToken: 'secret' }).success, false);
  assert.equal(syncEventKey({ ...event, contentSha256: 'c'.repeat(64) }) === syncEventKey(event), false);
});

test('source updates preserve creator-owned fields and explicit overrides', () => {
  const accepted = observation();
  assert.throws(() => validateSyncDecision(policy(), accepted, item()), /must be preserved/);
  const preserved = { ...accepted, changes: [{ ...accepted.changes[0], decision: 'preserve_creator' }] };
  assert.equal(validateSyncDecision(policy(), preserved, item()).status, 'accepted');
  const artwork = { ...accepted, changes: [{ field: 'artworkUrl', afterSha256: 'c'.repeat(64), decision: 'accept_source' }] };
  assert.throws(() => validateSyncDecision(policy(), artwork, item()), /must be preserved/);
  const noOverride = { ...item(), creatorOverrides: undefined };
  assert.equal(validateSyncDecision(policy(), accepted, noOverride).status, 'accepted');
  assert.throws(() => validateSyncDecision(policy(), preserved, noOverride), /No creator ownership/);
});

test('conflicts queue review and malformed decisions fail closed', () => {
  const conflict = { ...observation(), status: 'queued_review', changes: [{ field: 'description', afterSha256: 'c'.repeat(64), decision: 'queue_review' }] };
  assert.equal(validateSyncDecision(policy(), conflict, item()).status, 'queued_review');
  assert.equal(syncObservationSchema.safeParse({ ...conflict, status: 'accepted' }).success, false);
  assert.equal(syncObservationSchema.safeParse({ ...conflict, changes: [...conflict.changes, conflict.changes[0]] }).success, false);
  assert.equal(syncObservationSchema.safeParse({ ...conflict, changes: [{ ...conflict.changes[0], script: 'evil' }] }).success, false);
  assert.equal(syncObservationSchema.safeParse({ ...conflict, event: { ...event, contentSha256: 'bad' } }).success, false);
  assert.throws(() => validateSyncDecision({ ...policy(), sourceId: `src_${hex('f')}` }, conflict, item()), /scope differ/);
});

test('new, missing, revoked and failed observations never silently apply', () => {
  const base = observation();
  const newItem = { ...base, kind: 'new_item', status: 'queued_review', catalogItemId: undefined, changes: [] };
  assert.equal(syncObservationSchema.safeParse(newItem).success, true);
  assert.equal(syncObservationSchema.safeParse({ ...newItem, status: 'accepted' }).success, false);
  const missing = { ...base, kind: 'missing_item', status: 'queued_review', missingSince: timestamp, changes: [] };
  assert.equal(validateSyncDecision(policy(), missing, item()).status, 'queued_review');
  assert.equal(syncObservationSchema.safeParse({ ...missing, status: 'accepted' }).success, false);
  assert.throws(() => validateSyncDecision(policy(), { ...missing, observedAt: '2026-10-08T00:00:00.000Z' }, item()), /Missing-since/);
  const revoked = { ...base, kind: 'permission_revoked', status: 'rejected', changes: [] };
  assert.equal(validateSyncDecision(policy(), revoked, item()).status, 'rejected');
  assert.equal(syncObservationSchema.safeParse({ ...revoked, status: 'accepted' }).success, false);
  assert.equal(syncObservationSchema.safeParse({ ...base, kind: 'error', status: 'rejected', changes: [], errorCode: 'rate_limited' }).success, true);
  assert.equal(syncObservationSchema.safeParse({ ...base, kind: 'error', status: 'accepted', changes: [], errorCode: 'rate_limited' }).success, false);
});
