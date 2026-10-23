import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Pool } from 'pg';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import { CatalogRepository } from '../src/catalog-repository.js';
import { MediaPipelineRepository } from '../src/media-pipeline-repository.js';
import { ManagedMediaJobRepository } from '../src/managed-media-job-repository.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';

const databaseTest = process.env.VEGALAUNCH_TEST_DATABASE_URL ? test : test.skip;
const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll('-', '')}`;

databaseTest('migration 011, owned media jobs, CAS leases, replay, restart and revocation', async () => {
  const base = process.env.VEGALAUNCH_TEST_DATABASE_URL!;
  const admin = new Pool({ connectionString: base });
  const name = `vegalaunch_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(base); url.pathname = `/${name}`;
  await admin.query(`CREATE DATABASE ${name}`);
  let first: HostedProjectRepository | undefined;
  let restarted: HostedProjectRepository | undefined;
  try {
    const preMigrationPool = new Pool({ connectionString: url.toString() });
    try {
      await preMigrationPool.query('BEGIN');
      await preMigrationPool.query('CREATE TABLE vegalaunch_schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const names = (await readdir(new URL('../migrations/', import.meta.url)))
        .filter(name => /^0(0[1-9]|10)_.*\.up\.sql$/.test(name)).sort();
      assert.equal(names.length, 10);
      for (const [index, name] of names.entries()) {
        await preMigrationPool.query(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
        await preMigrationPool.query('INSERT INTO vegalaunch_schema_migrations(version) VALUES ($1)', [index + 1]);
      }
      await preMigrationPool.query('COMMIT');
      const old = new HostedProjectRepository(preMigrationPool);
      const oldAccount = await old.accountForIdentity({ issuer: 'https://issuer.example', subject: 'old', email: 'old@example.com' });
      await old.create({ accountId: oldAccount, issuer: 'https://issuer.example', subject: 'old', email: 'old@example.com' },
        { title: 'Stored before migration 011' });
    } finally { await preMigrationPool.end(); }
    first = await HostedProjectRepository.connect(url.toString());
    assert.equal((await first.pool.query('SELECT count(*)::int AS n FROM channel_projects')).rows[0]?.n, 1);
    const principal = async (subject: string): Promise<AuthenticatedPrincipal> => ({
      accountId: await first!.accountForIdentity({ issuer: 'https://issuer.example', subject,
        email: `${subject}@example.com` }), issuer: 'https://issuer.example', subject, email: `${subject}@example.com`
    });
    const owner = await principal('media-owner');
    const foreign = await principal('media-foreign');
    const forged = { ...foreign, accountId: owner.accountId };
    const project = await first.create(owner, { title: 'Media project' });
    const otherProject = await first.create(foreign, { title: 'Foreign project' });
    const catalog = new CatalogRepository(first);
    const source = (await catalog.mutate(owner, project.id, 'sources', 'POST', 0, {
      schemaVersion: 1, type: 'creator_json', state: 'discovered',
      permission: { retrieval: 'unknown', tvDisplay: 'unknown' }
    })).record!;
    const externalId = { provider: 'creator', kind: 'feed_item_id', value: 'original-film' };
    const item = (await catalog.mutate(owner, project.id, 'items', 'POST', 1, {
      schemaVersion: 1, kind: 'video', sourceRecord: { sourceId: source.id, externalId,
        observedAt: '2026-10-12T00:00:00.000Z', metadata: { title: 'Original film' } },
      externalIdentifiers: [externalId], mediaAssetIds: []
    })).record!;
    const asset = (await catalog.mutate(owner, project.id, 'media-assets', 'POST', 2, {
      schemaVersion: 1, catalogItemId: item.id, kind: 'video',
      location: { type: 'https', url: 'https://media.example.com/unpublished.mp4' },
      rights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_playback',
        assertedAt: new Date().toISOString() }, deliveryEligible: true
    })).record!;
    const pipeline = new MediaPipelineRepository(first);
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const request = { idempotencyKey: 'stable-upload-key-001', expectedBytes: 42, expectedSha256: 'a'.repeat(64), expiresAt };
    await assert.rejects(pipeline.createUpload(foreign, project.id, asset.id, request), /not found/i);
    await assert.rejects(pipeline.createUpload(forged, project.id, asset.id, request), /not found/i);
    const upload = await pipeline.createUpload(owner, project.id, asset.id, request);
    assert.deepEqual(await pipeline.createUpload(owner, project.id, asset.id, request), upload);
    const direct = await pipeline.createUpload(owner, project.id, asset.id, { ...request,
      idempotencyKey: 'direct-upload-key-0001', expectedBytes: 8_000_001,
      claimedDurationSeconds: 90, partSize: 8 * 1024 * 1024, partCount: 1 });
    await assert.rejects(pipeline.upload(foreign, project.id, asset.id, direct.id), { code: 'NOT_FOUND' });
    await assert.rejects(pipeline.upload(forged, project.id, asset.id, direct.id), { code: 'NOT_FOUND' });
    await assert.rejects(pipeline.upload(owner, otherProject.id, asset.id, direct.id), { code: 'NOT_FOUND' });
    assert.equal((await pipeline.upload(owner, project.id, asset.id, direct.id)).s3UploadId, null);
    assert.equal(await pipeline.attachS3Upload(owner, project.id, asset.id, direct.id, 'opaque-s3-upload'), true);
    assert.equal(await pipeline.attachS3Upload(owner, project.id, asset.id, direct.id, 'another-s3-upload'), false);
    await pipeline.recordCompletedOriginal(owner, project.id, asset.id, direct.id, 0);
    await assert.rejects(pipeline.enqueue(owner, project.id, asset.id, direct.id), /verified/i);
    await pipeline.recordVerifiedOriginal(owner, project.id, asset.id, direct.id,
      { bytes: 8_000_001, sha256: request.expectedSha256, expectedVersion: 1 });
    assert.equal((await pipeline.upload(owner, project.id, asset.id, direct.id)).state, 'verified');
    const abortRace = await pipeline.createUpload(owner, project.id, asset.id, { ...request,
      idempotencyKey: 'direct-abort-race-0001', claimedDurationSeconds: 90,
      partSize: 8 * 1024 * 1024, partCount: 1 });
    await pipeline.attachS3Upload(owner, project.id, asset.id, abortRace.id, 'opaque-race-upload');
    await pipeline.beginAbort(owner, project.id, asset.id, abortRace.id, 0);
    await assert.rejects(pipeline.recordCompletedOriginal(owner, project.id, asset.id, abortRace.id, 0), /stale/i);
    await assert.rejects(pipeline.beginAbort(foreign, project.id, asset.id, abortRace.id, 1), { code: 'NOT_FOUND' });
    const pending = (await pipeline.pendingCleanup()).find(row => row.id === abortRace.id);
    assert.equal(pending?.state, 'aborting');
    assert.equal(await pipeline.finishCleanup(abortRace.id, pending!.version, 'aborted'), true);
    assert.equal((await pipeline.upload(owner, project.id, asset.id, abortRace.id)).state, 'aborted');
    const quotaInput = { ...request, partSize: 8 * 1024 * 1024, partCount: 1, claimedDurationSeconds: 90 };
    await pipeline.createUpload(owner, project.id, asset.id, { ...quotaInput, idempotencyKey: 'quota-upload-one-0001' });
    await pipeline.createUpload(owner, project.id, asset.id, { ...quotaInput, idempotencyKey: 'quota-upload-two-0002' });
    await assert.rejects(pipeline.createUpload(owner, project.id, asset.id,
      { ...quotaInput, idempotencyKey: 'quota-upload-three-0003' }), /quota/i);
    await assert.rejects(pipeline.createUpload(owner, project.id, asset.id, { ...request, expectedBytes: 43 }), /idempotency/i);
    const abandoned = await pipeline.createUpload(owner, project.id, asset.id,
      { ...request, idempotencyKey: 'abandoned-upload-key' });
    await pipeline.closeUpload(owner, project.id, asset.id, abandoned.id, 0, 'aborted');
    await assert.rejects(pipeline.closeUpload(owner, project.id, asset.id, abandoned.id, 0, 'aborted'), /stale/i);
    const expiring = await pipeline.createUpload(owner, project.id, asset.id,
      { ...request, idempotencyKey: 'expiring-upload-key' });
    await assert.rejects(pipeline.closeUpload(owner, project.id, asset.id, expiring.id, 0, 'expired'), /stale/i);
    await first.pool.query(`UPDATE media_upload_sessions SET expires_at = now() - interval '1 second' WHERE id = $1`, [expiring.id]);
    await pipeline.closeUpload(owner, project.id, asset.id, expiring.id, 0, 'expired');
    assert.equal(upload.state, 'initiated');
    await assert.rejects(pipeline.enqueue(owner, project.id, asset.id, upload.id), /verified/i);
    await assert.rejects(pipeline.recordVerifiedOriginal(owner, project.id, asset.id, upload.id,
      { bytes: 42, sha256: 'b'.repeat(64), expectedVersion: 0 }), /checksum/i);
    await pipeline.recordVerifiedOriginal(owner, project.id, asset.id, upload.id,
      { bytes: 42, sha256: request.expectedSha256, expectedVersion: 0 });
    await assert.rejects(pipeline.recordVerifiedOriginal(owner, project.id, asset.id, upload.id,
      { bytes: 42, sha256: request.expectedSha256, expectedVersion: 0 }), /stale/i);
    const jobId = await pipeline.enqueue(owner, project.id, asset.id, upload.id);
    assert.equal(await pipeline.enqueue(owner, project.id, asset.id, upload.id), jobId);
    const leaseUntil = new Date(Date.now() + 120_000).toISOString();
    const [one, two] = await Promise.allSettled([
      pipeline.lease(owner, project.id, asset.id, jobId, 0, leaseUntil),
      pipeline.lease(owner, project.id, asset.id, jobId, 0, leaseUntil)
    ]);
    assert.equal([one, two].filter(v => v.status === 'fulfilled').length, 1);
    const lease = one.status === 'fulfilled' ? one.value : two.status === 'fulfilled' ? two.value : null;
    assert.ok(lease);
    assert.equal(lease.attempts, 1);
    await first.pool.query(`UPDATE media_processing_jobs SET lease_until = now() - interval '1 second' WHERE id = $1`, [jobId]);
    const reclaimed = await pipeline.lease(owner, project.id, asset.id, jobId, lease.version, leaseUntil);
    assert.equal(reclaimed.attempts, 2);
    await assert.rejects(pipeline.fail(owner, project.id, asset.id, jobId, lease.token, lease.version,
      'encode_failed'), /stale/i);
    await pipeline.fail(owner, project.id, asset.id, jobId, reclaimed.token, reclaimed.version, 'encode_failed');
    await assert.rejects(pipeline.retry(foreign, project.id, asset.id, jobId, 3), /not found/i);
    await pipeline.retry(owner, project.id, asset.id, jobId, 3);

    // Catalog replacement is a full delete/reinsert and must preserve the durable job.
    await catalog.mutate(owner, project.id, 'items', 'PUT', 3, { schemaVersion: 1, kind: 'video',
      sourceRecord: item.sourceRecord, externalIdentifiers: item.externalIdentifiers, mediaAssetIds: [asset.id],
      creatorOverrides: { title: 'Edited film', editedAt: '2026-10-12T01:00:00.000Z' } }, item.id);
    assert.equal((await first.pool.query('SELECT count(*)::int AS n FROM media_processing_jobs WHERE id = $1', [jobId])).rows[0]?.n, 1);
    const managedUpload = await pipeline.createUpload(owner, project.id, asset.id,
      { ...request, idempotencyKey: 'managed-upload-key-001', claimedDurationSeconds: 90 });
    await pipeline.recordVerifiedOriginal(owner, project.id, asset.id, managedUpload.id,
      { bytes: 42, sha256: request.expectedSha256, expectedVersion: 0 });
    const managedJobId = await pipeline.enqueue(owner, project.id, asset.id, managedUpload.id);
    const managedScope = { creatorAccountId: owner.accountId, projectId: project.id,
      mediaAssetId: asset.id, jobId: managedJobId };
    const managed = new ManagedMediaJobRepository(first.pool);
    const admission = { awsAccountId: '123456789012', awsRegion: 'us-east-2',
      profileHash: '7'.repeat(64), expectedVersion: 0 };
    await assert.rejects(managed.reserve(foreign, managedScope, admission), { code: 'NOT_FOUND' });
    await assert.rejects(managed.reserve(forged, managedScope, admission), { code: 'NOT_FOUND' });
    const intent = await managed.reserve(owner, managedScope, admission);
    assert.equal(intent.attempt, 1);
    assert.equal(intent.originalKey, managedUpload.originalKey);
    assert.equal((await managed.reserve(owner, managedScope, admission)).intentToken, intent.intentToken);
    await assert.rejects(pipeline.lease(owner, project.id, asset.id, managedJobId, 1,
      new Date(Date.now() + 60_000).toISOString()), { code: 'CONFLICT' });
    assert.equal((await first.pool.query(`SELECT count(*)::int AS n FROM managed_media_job_attempts
      WHERE processing_job_id=$1`, [managedJobId])).rows[0]?.n, 1);
    await assert.rejects(first.pool.query(`UPDATE managed_media_job_attempts SET creator_account_id=$2,
      project_id=$3 WHERE intent_token=$1`, [intent.intentToken, foreign.accountId, otherProject.id]), /immutable|constraint/i);
    await first.pool.end(); first = undefined;
    restarted = await HostedProjectRepository.connect(url.toString());
    const resumed = new MediaPipelineRepository(restarted);
    const managedRestarted = new ManagedMediaJobRepository(restarted.pool);
    const identity = { awsAccountId: admission.awsAccountId, awsRegion: admission.awsRegion, awsJobId: 'mc-123' };
    assert.equal((await managedRestarted.due()).some(row => row.intentToken === intent.intentToken), true);
    assert.equal(await managedRestarted.register({ ...managedScope, creatorAccountId: foreign.accountId },
      intent.intentToken, identity), false);
    assert.equal(await managedRestarted.register(managedScope, intent.intentToken,
      { ...identity, awsAccountId: '000000000000' }), false);
    assert.equal(await managedRestarted.register(managedScope, intent.intentToken, identity), true);
    assert.equal(await managedRestarted.register(managedScope, intent.intentToken, identity), true);
    assert.equal(await managedRestarted.observe({ ...managedScope, creatorAccountId: foreign.accountId },
      intent.intentToken, { ...identity, status: 'COMPLETE' }), false);
    assert.equal(await managedRestarted.observe(managedScope, intent.intentToken,
      { ...identity, awsRegion: 'us-west-2', status: 'COMPLETE' }), false);
    assert.equal(await managedRestarted.observe(managedScope, intent.intentToken,
      { ...identity, awsJobId: 'foreign-job', status: 'COMPLETE' }), false);
    assert.equal(await managedRestarted.observe(managedScope, intent.intentToken,
      { ...identity, status: 'PROGRESSING' }), true);
    assert.equal(await managedRestarted.observe(managedScope, intent.intentToken,
      { ...identity, status: 'SUBMITTED' }), false);
    const errorObservation = { ...identity, status: 'ERROR', errorCode: 'provider.error' };
    assert.equal(await managedRestarted.observe(managedScope, intent.intentToken, errorObservation), true);
    assert.equal(await managedRestarted.observe(managedScope, intent.intentToken, errorObservation), false);
    assert.equal((await resumed.processingStatus(owner, project.id, asset.id, managedUpload.id))?.state, 'failed');
    assert.equal(await managedRestarted.observe(managedScope, intent.intentToken,
      { ...identity, status: 'COMPLETE' }), false);
    const retryVersion = (await restarted.pool.query<{ version: number }>(
      'SELECT version FROM media_processing_jobs WHERE id=$1', [managedJobId])).rows[0]!.version;
    await assert.rejects(managedRestarted.reserve(owner, managedScope,
      { ...admission, expectedVersion: 0 }), { code: 'CONFLICT' });
    const retryIntent = await managedRestarted.reserve(owner, managedScope,
      { ...admission, expectedVersion: retryVersion });
    assert.equal(retryIntent.attempt, 2);
    assert.notEqual(retryIntent.intentToken, intent.intentToken);
    assert.equal(await managedRestarted.register(managedScope, retryIntent.intentToken, identity), false);
    const retryIdentity = { ...identity, awsJobId: 'mc-456' };
    assert.equal(await managedRestarted.register(managedScope, retryIntent.intentToken, retryIdentity), true);
    assert.equal(await managedRestarted.observe(managedScope, retryIntent.intentToken,
      { ...retryIdentity, status: 'COMPLETE' }), true);
    assert.equal((await resumed.processingStatus(owner, project.id, asset.id, managedUpload.id))?.state, 'pending');
    const checkpointVersion = (await restarted.pool.query<{ version: number }>(
      'SELECT version FROM managed_media_job_attempts WHERE intent_token=$1', [retryIntent.intentToken])).rows[0]!.version;
    const nextAt = new Date(Date.now() + 60_000).toISOString();
    assert.equal(await managedRestarted.checkpoint(managedScope, retryIntent.intentToken, checkpointVersion, nextAt), true);
    assert.equal(await managedRestarted.checkpoint(managedScope, retryIntent.intentToken, checkpointVersion, nextAt), false);
    const managedSetId = id('rs');
    const managedPrefix = `media/${owner.accountId.slice(3)}/${project.id.slice(3)}/${asset.id.slice(3)}/staged/${managedSetId.slice(3)}/`;
    const managedSet = { id: managedSetId, creatorAccountId: owner.accountId, projectId: project.id,
      catalogItemId: item.id, mediaAssetId: asset.id, jobId: managedJobId, profile: 'hls-avc-aac-v1' as const,
      masterKey: `${managedPrefix}master.m3u8`, masterSha256: 'a'.repeat(64),
      variants: [{ height: 480 as const, playlistKey: `${managedPrefix}v480.m3u8`,
        playlistSha256: 'b'.repeat(64), segmentsSha256: 'c'.repeat(64), segmentCount: 1 }],
      verifiedAt: new Date().toISOString() };
    assert.equal(await managedRestarted.failVerification(managedScope, retryIntent.intentToken), true);
    assert.equal((await resumed.processingStatus(owner, project.id, asset.id, managedUpload.id))?.failureCode,
      'verification_failed');
    await restarted.pool.query(`UPDATE managed_media_job_attempts SET reconcile_after=now()-interval '1 second'
      WHERE intent_token=$1`, [retryIntent.intentToken]);
    assert.equal((await managedRestarted.due()).some(row => row.intentToken === retryIntent.intentToken), true);
    assert.equal(await managedRestarted.ready({ ...managedScope, creatorAccountId: foreign.accountId },
      retryIntent.intentToken, managedSet), false);
    assert.equal(await managedRestarted.ready(managedScope, retryIntent.intentToken,
      { ...managedSet, masterKey: `${managedPrefix}other.m3u8` }), false);
    assert.equal(await managedRestarted.ready(managedScope, retryIntent.intentToken, managedSet), true);
    assert.equal(await managedRestarted.ready(managedScope, retryIntent.intentToken, managedSet), false);
    assert.equal((await resumed.processingStatus(owner, project.id, asset.id, managedUpload.id))?.state, 'ready');
    assert.equal((await resumed.processingStatus(owner, project.id, asset.id, managedUpload.id))?.failureCode, null);
    assert.equal((await restarted.pool.query('SELECT attempts FROM media_processing_jobs WHERE id=$1',
      [managedJobId])).rows[0]?.attempts, 2);
    const lateUpload = await resumed.createUpload(owner, project.id, asset.id,
      { ...request, idempotencyKey: 'managed-late-upload-001', claimedDurationSeconds: 90 });
    await resumed.recordVerifiedOriginal(owner, project.id, asset.id, lateUpload.id,
      { bytes: 42, sha256: request.expectedSha256, expectedVersion: 0 });
    const lateJobId = await resumed.enqueue(owner, project.id, asset.id, lateUpload.id);
    const lateScope = { ...managedScope, jobId: lateJobId };
    const lateIntent = await managedRestarted.reserve(owner, lateScope, admission);
    const nextLease = await resumed.lease(owner, project.id, asset.id, jobId, 4, leaseUntil);
    const prefix = `media/${owner.accountId.slice(3)}/${project.id.slice(3)}/${asset.id.slice(3)}/delivery/`;
    const rendition = { id: id('rs'), creatorAccountId: owner.accountId, projectId: project.id,
      catalogItemId: item.id, mediaAssetId: asset.id, jobId, profile: 'hls-avc-aac-v1' as const,
      masterKey: `${prefix}master.m3u8`, masterSha256: 'c'.repeat(64), variants: [{ height: 480 as const,
        playlistKey: `${prefix}480p.m3u8`, playlistSha256: 'd'.repeat(64),
        segmentsSha256: 'e'.repeat(64), segmentCount: 2 }],
      verifiedAt: new Date().toISOString() };
    await assert.rejects(resumed.complete(owner, project.id, asset.id, jobId, randomUUID(), nextLease.version, rendition), /stale/i);
    await resumed.complete(owner, project.id, asset.id, jobId, nextLease.token, nextLease.version, rendition);
    assert.equal((await restarted.pool.query('SELECT state FROM media_processing_jobs WHERE id = $1', [jobId])).rows[0]?.state, 'ready');
    await assert.rejects(restarted.pool.query('UPDATE media_rendition_sets SET master_sha256 = $2 WHERE id = $1',
      [rendition.id, 'e'.repeat(64)]), /immutable/i);
    await assert.rejects(restarted.pool.query(`INSERT INTO media_upload_sessions(id, creator_account_id, project_id,
      item_id, asset_id, idempotency_key, original_key, expected_bytes, expected_sha256, content_type, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,'video/mp4',now() + interval '1 hour')`,
      [id('up'), foreign.accountId, otherProject.id, item.id, asset.id, 'foreign-scope-key1',
        `media/${foreign.accountId.slice(3)}/${otherProject.id.slice(3)}/${asset.id.slice(3)}/original/forged.mp4`, 'f'.repeat(64)]), /foreign key/i);
    await assert.rejects(restarted.pool.query(`INSERT INTO media_upload_sessions(id, creator_account_id, project_id,
      item_id, asset_id, idempotency_key, original_key, expected_bytes, expected_sha256, content_type, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,'video/mp4',now() + interval '1 hour')`,
      [id('up'), owner.accountId, project.id, item.id, asset.id, 'spoofed-object-key1',
        `media/${foreign.accountId.slice(3)}/${project.id.slice(3)}/${asset.id.slice(3)}/original/forged.mp4`, 'f'.repeat(64)]), /check constraint/i);
    await resumed.revoke(owner, project.id, asset.id);
    assert.equal((await restarted.pool.query('SELECT state FROM media_processing_jobs WHERE id = $1', [jobId])).rows[0]?.state, 'revoked');
    assert.equal(await managedRestarted.ready(managedScope, retryIntent.intentToken, managedSet), false);
    assert.ok((await restarted.pool.query('SELECT revoked_at FROM media_rendition_sets WHERE id = $1', [rendition.id])).rows[0]?.revoked_at);
    assert.equal(await managedRestarted.observe(managedScope, retryIntent.intentToken,
      { ...retryIdentity, status: 'ERROR', errorCode: 'late' }), false);
    assert.equal((await restarted.pool.query('SELECT state FROM media_processing_jobs WHERE id=$1',
      [managedJobId])).rows[0]?.state, 'revoked');
    assert.ok((await restarted.pool.query(`SELECT cancel_requested_at FROM managed_media_job_attempts
      WHERE intent_token=$1`, [retryIntent.intentToken])).rows[0]?.cancel_requested_at);
    const lateIdentity = { ...identity, awsJobId: 'mc-after-revoke' };
    assert.equal(await managedRestarted.register(lateScope, lateIntent.intentToken, lateIdentity), true);
    const cancellation = (await managedRestarted.cancellationsDue()).find(row => row.intentToken === lateIntent.intentToken);
    assert.equal(cancellation?.awsJobId, lateIdentity.awsJobId);
    assert.equal(await managedRestarted.cancellationChecked(lateScope, lateIntent.intentToken,
      cancellation!.version), true);
    assert.equal(await managedRestarted.cancellationChecked(lateScope, lateIntent.intentToken,
      cancellation!.version), false);
    assert.equal(await managedRestarted.observe(lateScope, lateIntent.intentToken,
      { ...lateIdentity, status: 'COMPLETE' }), false);
    await assert.rejects(resumed.createUpload(owner, project.id, asset.id,
      { ...request, idempotencyKey: 'another-upload-key-1' }), /not found/i);
    await assert.rejects(resumed.lease(owner, project.id, asset.id, jobId, 6, leaseUntil), /not found/i);
  } finally {
    await first?.pool.end(); await restarted?.pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`); await admin.end();
  }
});

databaseTest('migration 013 preserves a READY rendition created under migration 012', async () => {
  const base = process.env.VEGALAUNCH_TEST_DATABASE_URL!;
  const admin = new Pool({ connectionString: base });
  const name = `vegalaunch_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(base); url.pathname = `/${name}`;
  await admin.query(`CREATE DATABASE ${name}`);
  let hosted: HostedProjectRepository | undefined;
  try {
    hosted = await HostedProjectRepository.connect(url.toString());
    await hosted.pool.query(await readFile(new URL('../migrations/013_managed_media_jobs.down.sql', import.meta.url), 'utf8'));
    await hosted.pool.query('DELETE FROM vegalaunch_schema_migrations WHERE version=13');
    const owner: AuthenticatedPrincipal = { accountId: await hosted.accountForIdentity({
      issuer: 'https://issuer.example', subject: 'legacy-ready', email: 'legacy@example.com'
    }), issuer: 'https://issuer.example', subject: 'legacy-ready', email: 'legacy@example.com' };
    const project = await hosted.create(owner, { title: 'Legacy READY project' });
    const catalog = new CatalogRepository(hosted);
    const source = (await catalog.mutate(owner, project.id, 'sources', 'POST', 0, {
      schemaVersion: 1, type: 'creator_json', state: 'discovered',
      permission: { retrieval: 'unknown', tvDisplay: 'unknown' }
    })).record!;
    const externalId = { provider: 'creator', kind: 'feed_item_id', value: 'legacy-ready' };
    const item = (await catalog.mutate(owner, project.id, 'items', 'POST', 1, {
      schemaVersion: 1, kind: 'video', sourceRecord: { sourceId: source.id, externalId,
        observedAt: '2026-10-12T00:00:00.000Z', metadata: { title: 'Legacy film' } },
      externalIdentifiers: [externalId], mediaAssetIds: []
    })).record!;
    const asset = (await catalog.mutate(owner, project.id, 'media-assets', 'POST', 2, {
      schemaVersion: 1, catalogItemId: item.id, kind: 'video',
      location: { type: 'https', url: 'https://media.example.com/legacy.mp4' },
      rights: { status: 'cleared', basis: 'creator_asserted', permittedUse: 'television_playback',
        assertedAt: new Date().toISOString() }, deliveryEligible: true
    })).record!;
    const pipeline = new MediaPipelineRepository(hosted);
    const sha = 'a'.repeat(64);
    const upload = await pipeline.createUpload(owner, project.id, asset.id, {
      idempotencyKey: 'legacy-ready-upload-01', expectedBytes: 42, expectedSha256: sha,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString()
    });
    await pipeline.recordVerifiedOriginal(owner, project.id, asset.id, upload.id,
      { bytes: 42, sha256: sha, expectedVersion: 0 });
    const jobId = await pipeline.enqueue(owner, project.id, asset.id, upload.id);
    // Reproduce the pre-013 worker row without invoking the new worker guard against a pre-013 database.
    const lease = { token: randomUUID(), version: 1 };
    await hosted.pool.query(`UPDATE media_processing_jobs SET state='leased', lease_token=$2,
      lease_until=now()+interval '2 minutes', attempts=1, version=1 WHERE id=$1`, [jobId, lease.token]);
    const prefix = `media/${owner.accountId.slice(3)}/${project.id.slice(3)}/${asset.id.slice(3)}/staged/`;
    const rendition = { id: id('rs'), creatorAccountId: owner.accountId, projectId: project.id,
      catalogItemId: item.id, mediaAssetId: asset.id, jobId, profile: 'hls-avc-aac-v1' as const,
      masterKey: `${prefix}master.m3u8`, masterSha256: 'b'.repeat(64),
      variants: [{ height: 480 as const, playlistKey: `${prefix}480p.m3u8`,
        playlistSha256: 'c'.repeat(64), segmentsSha256: 'd'.repeat(64), segmentCount: 1 }],
      verifiedAt: new Date().toISOString() };
    await pipeline.complete(owner, project.id, asset.id, jobId, lease.token, lease.version, rendition);
    const before = (await hosted.pool.query('SELECT state, rendition_set_id FROM media_processing_jobs WHERE id=$1',
      [jobId])).rows[0];
    await hosted.migrate();
    const after = (await hosted.pool.query('SELECT state, rendition_set_id FROM media_processing_jobs WHERE id=$1',
      [jobId])).rows[0];
    assert.deepEqual(after, before);
    assert.equal(after.state, 'ready');
    assert.equal((await hosted.pool.query('SELECT count(*)::int AS n FROM media_rendition_sets WHERE id=$1',
      [rendition.id])).rows[0]?.n, 1);
    assert.equal((await hosted.pool.query('SELECT count(*)::int AS n FROM managed_media_job_attempts')).rows[0]?.n, 0);
    const nextUpload = await pipeline.createUpload(owner, project.id, asset.id, {
      idempotencyKey: 'managed-after-ready-01', expectedBytes: 42, expectedSha256: sha,
      claimedDurationSeconds: 90,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString()
    });
    await pipeline.recordVerifiedOriginal(owner, project.id, asset.id, nextUpload.id,
      { bytes: 42, sha256: sha, expectedVersion: 0 });
    const nextJobId = await pipeline.enqueue(owner, project.id, asset.id, nextUpload.id);
    await new ManagedMediaJobRepository(hosted.pool).reserve(owner, {
      creatorAccountId: owner.accountId, projectId: project.id, mediaAssetId: asset.id, jobId: nextJobId
    }, { awsAccountId: '123456789012', awsRegion: 'us-east-2', profileHash: '7'.repeat(64), expectedVersion: 0 });
    assert.equal((await hosted.pool.query('SELECT state FROM media_processing_jobs WHERE id=$1', [jobId])).rows[0]?.state, 'ready');
  } finally {
    await hosted?.pool.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`); await admin.end();
  }
});
