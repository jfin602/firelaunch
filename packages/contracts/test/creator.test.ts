import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CREATOR_SCHEMA_VERSION, channelDeploymentSchema, channelOwnershipSchema,
  channelSpecSchema, creatorAccountSchema, creatorAppRegistrySchema,
  creatorProfileSchema, projectSchema
} from '../src/index.js';
import { fixtureChannel } from '../../channel-engine/test/fixtures.js';

const hex = (digit: string) => digit.repeat(32);
const creatorA = `cr_${hex('a')}`;
const creatorB = `cr_${hex('b')}`;
const channelA = `ch_${hex('a')}`;
const channelB = `ch_${hex('b')}`;
const channelC = `ch_${hex('c')}`;
const timestamp = '2026-10-09T00:00:00.000Z';
const account = (id: string, email: string) => ({ schemaVersion: CREATOR_SCHEMA_VERSION, id, email, createdAt: timestamp });
const profile = (creatorAccountId: string) => ({ schemaVersion: CREATOR_SCHEMA_VERSION, creatorAccountId, displayName: 'Wild Earth', websiteUrl: 'https://example.com/creator' });
const ownership = (creatorAccountId: string, projectId: string) => ({ schemaVersion: CREATOR_SCHEMA_VERSION, creatorAccountId, projectId, channelId: projectId });
const deployment = (creatorAccountId: string, projectId: string, id: string, packageId: string) => ({
  schemaVersion: CREATOR_SCHEMA_VERSION, id, creatorAccountId, projectId, channelId: projectId,
  appName: 'Wild Earth TV', packageId, releaseControl: 'creator' as const,
  nativeReleaseApproval: 'pending_creator' as const,
  manifestEndpoint: 'https://channels.example.com/manifest', consoleEvidence: { state: 'none' as const }
});

test('versioned private account and public profile accept bounded creator identity', () => {
  assert.equal(creatorAccountSchema.parse(account(creatorA, 'a@example.com')).id, creatorA);
  assert.equal(creatorProfileSchema.parse(profile(creatorA)).creatorAccountId, creatorA);
});

test('creator records reject invalid identifiers and schema versions', () => {
  assert.equal(creatorAccountSchema.safeParse(account(`ch_${hex('a')}`, 'a@example.com')).success, false);
  assert.equal(creatorAccountSchema.safeParse({ ...account(creatorA, 'a@example.com'), schemaVersion: 2 }).success, false);
  assert.equal(creatorProfileSchema.safeParse({ ...profile(creatorA), creatorAccountId: `cr_${hex('g')}` }).success, false);
  assert.equal(channelDeploymentSchema.safeParse({ ...deployment(creatorA, channelA, `dep_${hex('a')}`, 'com.example.app'), id: `dep_${hex('g')}` }).success, false);
});

test('one account owns distinct projects and branded app identities', () => {
  const registry = {
    accounts: [account(creatorA, 'a@example.com'), account(creatorB, 'b@example.com')],
    profiles: [profile(creatorA), profile(creatorB)],
    ownerships: [ownership(creatorA, channelA), ownership(creatorA, channelB), ownership(creatorB, channelC)],
    deployments: [
      deployment(creatorA, channelA, `dep_${hex('a')}`, 'com.example.wildearth'),
      deployment(creatorA, channelB, `dep_${hex('b')}`, 'com.example.wildmusic'),
      deployment(creatorB, channelC, `dep_${hex('c')}`, 'com.example.othercreator')
    ]
  };
  assert.equal(creatorAppRegistrySchema.parse(registry).deployments.length, 3);
  assert.equal(creatorAppRegistrySchema.safeParse({ ...registry, deployments: [registry.deployments[0], { ...registry.deployments[1], packageId: registry.deployments[0].packageId }] }).success, false);
  assert.equal(creatorAppRegistrySchema.safeParse({ ...registry, deployments: [registry.deployments[0], { ...registry.deployments[1], projectId: channelA, channelId: channelA }] }).success, false);
});

test('ownership and deployment reject inconsistent ch_ project/channel IDs', () => {
  assert.equal(channelOwnershipSchema.safeParse({ ...ownership(creatorA, channelA), channelId: channelB }).success, false);
  assert.equal(channelDeploymentSchema.safeParse({ ...deployment(creatorA, channelA, `dep_${hex('a')}`, 'com.example.app'), channelId: channelB }).success, false);
  assert.equal(channelOwnershipSchema.safeParse(ownership(creatorA, `page_${hex('a')}`)).success, false);
});

test('registry rejects cross-creator links and dangling references', () => {
  const base = {
    accounts: [account(creatorA, 'a@example.com'), account(creatorB, 'b@example.com')],
    profiles: [profile(creatorA)],
    ownerships: [ownership(creatorA, channelA)],
    deployments: [deployment(creatorA, channelA, `dep_${hex('a')}`, 'com.example.app')]
  };
  assert.equal(creatorAppRegistrySchema.safeParse({ ...base, deployments: [{ ...base.deployments[0], creatorAccountId: creatorB }] }).success, false);
  assert.equal(creatorAppRegistrySchema.safeParse({ ...base, ownerships: [ownership(creatorB, channelA)] }).success, false);
  assert.equal(creatorAppRegistrySchema.safeParse({ ...base, profiles: [profile(`cr_${hex('c')}`)] }).success, false);
  assert.equal(creatorAppRegistrySchema.safeParse({ ...base, ownerships: [] }).success, false);
});

test('strict records reject unknown secrets, hostile URLs and oversized values', () => {
  const d = deployment(creatorA, channelA, `dep_${hex('a')}`, 'com.example.app');
  assert.equal(creatorAccountSchema.safeParse({ ...account(creatorA, 'a@example.com'), amazonPassword: 'secret' }).success, false);
  assert.equal(creatorProfileSchema.safeParse({ ...profile(creatorA), email: 'private@example.com' }).success, false);
  assert.equal(channelDeploymentSchema.safeParse({ ...d, signingKey: 'secret' }).success, false);
  assert.equal(channelDeploymentSchema.safeParse({ ...d, releaseControl: 'firelaunch' }).success, false);
  assert.equal(channelDeploymentSchema.safeParse({ ...d, consoleListingReference: '../secret' }).success, false);
  assert.equal(channelDeploymentSchema.safeParse({ ...d, appName: 'A'.repeat(121) }).success, false);
  assert.equal(channelDeploymentSchema.safeParse({ ...d, packageId: '../bad' }).success, false);
  for (const manifestEndpoint of ['http://example.com/manifest', 'https://user:pass@example.com/x', 'https://example.com/x#token', 'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'file:///etc/passwd', 'https://example.com/' + 'a'.repeat(2048)]) {
    assert.equal(channelDeploymentSchema.safeParse({ ...d, manifestEndpoint }).success, false);
  }
  assert.equal(creatorProfileSchema.safeParse({ ...profile(creatorA), websiteUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(creatorProfileSchema.safeParse({ ...profile(creatorA), attribution: 'A'.repeat(501) }).success, false);
});

test('Console stage stays explicitly reported or backed by an evidence reference', () => {
  const d = deployment(creatorA, channelA, `dep_${hex('a')}`, 'com.example.app');
  assert.equal(channelDeploymentSchema.safeParse({ ...d, consoleEvidence: { state: 'creator_reported', submissionStage: 'submitted' } }).success, true);
  assert.equal(channelDeploymentSchema.safeParse({ ...d, consoleEvidence: { state: 'evidence_recorded', submissionStage: 'approved', evidenceId: `ev_${hex('a')}` } }).success, true);
  for (const consoleEvidence of [
    { state: 'none', submissionStage: 'approved' },
    { state: 'creator_reported', submissionStage: 'approved', evidenceId: `ev_${hex('a')}` },
    { state: 'evidence_recorded', submissionStage: 'approved' },
    { state: 'independently_verified', submissionStage: 'approved' }
  ]) assert.equal(channelDeploymentSchema.safeParse({ ...d, consoleEvidence }).success, false);
});

test('existing P0 ChannelSpec and local project fixture still parse unchanged', () => {
  const spec = fixtureChannel();
  assert.equal(channelSpecSchema.parse(spec).id, spec.id);
  assert.equal(projectSchema.parse({ id: spec.id, revision: 1, createdAt: timestamp, updatedAt: timestamp, spec }).spec.id, spec.id);
  assert.equal(channelSpecSchema.safeParse({ ...spec, creatorAccountId: creatorA }).success, false);
});
