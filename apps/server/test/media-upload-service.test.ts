import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { HostedAuth } from '../src/auth/sessions.js';
import type { HostedProjectRepository } from '../src/hosted-repository.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';
import type { MediaPipelineRepository } from '../src/media-pipeline-repository.js';
import type { S3MediaStorage } from '../src/media-storage.js';
import { MediaUploadService } from '../src/media-upload-service.js';
import { createApi } from '../src/api.js';
import { ProjectRepository, RepositoryError } from '../src/repository.js';

const id = (prefix: string, hex: string) => `${prefix}_${hex.repeat(32)}`;
const projectId = id('ch', 'b');
const assetId = id('ma', 'c');
const uploadId = id('up', 'd');
const owner: AuthenticatedPrincipal = { accountId: id('cr', 'a'), issuer: 'test', subject: 'owner', email: 'owner@example.com' };
const foreign = { ...owner, accountId: id('cr', 'e'), subject: 'foreign' };
const expectedSha256 = createHash('sha256').update('video').digest('hex');
const input = { mediaAssetId: assetId, idempotencyKey: 'upload-retry-key-0001', fileName: 'owned.mp4',
  contentType: 'video/mp4', expectedBytes: 10_000_000, expectedSha256, claimedDurationSeconds: 90 };

function fixture() {
  const row = { id: uploadId, state: 'initiated', version: 0,
    originalKey: `media/${owner.accountId.slice(3)}/${projectId.slice(3)}/${assetId.slice(3)}/original/${uploadId.slice(3)}.mp4`,
    s3UploadId: null as string | null,
    expectedBytes: input.expectedBytes, expectedSha256, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    claimedDurationSeconds: 90, partSize: 8 * 1024 * 1024, partCount: 2 };
  const calls: string[] = [];
  const requireOwner = (principal: AuthenticatedPrincipal, project: string, asset: string, upload?: string) => {
    if (principal.accountId !== owner.accountId || principal.subject !== owner.subject || project !== projectId ||
      asset !== assetId || upload && upload !== uploadId) throw new RepositoryError('NOT_FOUND', 'Media asset not found');
  };
  const records = {
    async createUpload(principal: AuthenticatedPrincipal, project: string, asset: string, request: { expectedBytes: number }) {
      requireOwner(principal, project, asset);
      if (request.expectedBytes !== row.expectedBytes) throw new RepositoryError('CONFLICT', 'metadata changed');
      calls.push('create'); return { id: uploadId, originalKey: row.originalKey, state: row.state };
    },
    async upload(principal: AuthenticatedPrincipal, project: string, asset: string, upload: string) {
      requireOwner(principal, project, asset, upload); return { ...row };
    },
    async processingStatus(principal: AuthenticatedPrincipal, project: string, asset: string, upload: string) {
      requireOwner(principal, project, asset, upload); return null;
    },
    async latestAssetStatus(principal: AuthenticatedPrincipal, project: string, asset: string) {
      requireOwner(principal, project, asset); return { uploadId, uploadState: row.state, processing: null };
    },
    async attachS3Upload(principal: AuthenticatedPrincipal, project: string, asset: string, upload: string, s3: string) {
      requireOwner(principal, project, asset, upload); row.s3UploadId = s3; calls.push('attach'); return true;
    },
    async recordCompletedOriginal(principal: AuthenticatedPrincipal, project: string, asset: string, upload: string, version: number) {
      requireOwner(principal, project, asset, upload);
      if (row.version !== version) throw new RepositoryError('CONFLICT', 'stale');
      row.state = 'completed'; row.version++; calls.push('record-completed');
    },
    async beginAbort(principal: AuthenticatedPrincipal, project: string, asset: string, upload: string) {
      requireOwner(principal, project, asset, upload); row.state = 'aborting'; row.version++; calls.push('begin-abort');
    },
    async pendingCleanup() {
      if (row.state === 'initiated' && Date.parse(row.expiresAt) <= Date.now()) { row.state = 'expiring'; row.version++; }
      return row.state === 'aborting' || row.state === 'expiring' ? [{ id: uploadId, creatorAccountId: owner.accountId,
        projectId, assetId, s3UploadId: row.s3UploadId, version: row.version, state: row.state }] : [];
    },
    async finishCleanup(_upload: string, _version: number, state: 'aborted' | 'expired') {
      row.state = state; calls.push('close'); return true;
    }
  };
  const storage = {
    async createOriginal() { calls.push('s3-create'); return { key: row.originalKey, uploadId: 'opaque-s3' }; },
    async signOriginalPart(_scope: unknown, _session: string, _s3: string, part: number, contentLength: number) {
      calls.push('sign'); return { url: `https://s3.example/part/${part}?X-Amz-Signature=fake`, expiresInSeconds: 300, contentLength };
    },
    async completeOriginal() { calls.push('complete'); },
    async headOriginal() { calls.push('head'); },
    async abortOriginal() { calls.push('abort'); },
    async deleteOrphanOriginal() { calls.push('delete-orphan'); }
  };
  return { row, calls, records, storage, service: new MediaUploadService(records as unknown as MediaPipelineRepository,
    storage as unknown as S3MediaStorage) };
}

test('direct upload control plane is owner scoped, bounded, retry safe and never reads video bytes', async () => {
  const { service, row, calls, storage } = fixture();
  for (const bad of [{ ...input, expectedBytes: 5_000_000_001 }, { ...input, fileName: '../bad.mp4' },
    { ...input, contentType: 'text/html' }, { ...input, claimedDurationSeconds: 14401 },
    { ...input, bucket: 'foreign' }, { ...input, expectedSha256: 'bad' }])
    await assert.rejects(service.start(owner, projectId, bad));
  await assert.rejects(service.start(foreign, projectId, input), { code: 'NOT_FOUND' });
  assert.equal(calls.length, 0);
  const started = await service.start(owner, projectId, input);
  assert.equal(started.verification, 'unverified');
  assert.equal(started.partCount, 2);
  assert.equal(JSON.stringify(started).includes('opaque-s3'), false);
  assert.equal(JSON.stringify(started).includes(row.originalKey), false);
  await service.start(owner, projectId, input);
  assert.equal(calls.filter(value => value === 's3-create').length, 1);
  await assert.rejects(service.part(foreign, projectId, uploadId, { mediaAssetId: assetId, partNumber: 1 }), { code: 'NOT_FOUND' });
  await assert.rejects(service.part(owner, projectId, uploadId, { mediaAssetId: assetId, partNumber: 3 }), { code: 'CONFLICT' });
  await assert.rejects(service.part(owner, projectId, uploadId, { mediaAssetId: assetId, partNumber: 0 }));
  assert.match((await service.part(owner, projectId, uploadId, { mediaAssetId: assetId, partNumber: 1 })).url, /^https:/);
  const parts = [1, 2].map(partNumber => ({ partNumber, etag: 'a'.repeat(32) }));
  await assert.rejects(service.finalize(owner, projectId, uploadId, { mediaAssetId: assetId, parts: [parts[0]] }), { code: 'CONFLICT' });
  await assert.rejects(service.finalize(owner, projectId, uploadId, { mediaAssetId: assetId,
    parts: [parts[1], parts[0]] }), { code: 'CONFLICT' });
  await assert.rejects(service.finalize(owner, projectId, uploadId, { mediaAssetId: assetId,
    parts: [{ ...parts[0], etag: 'forged' }, parts[1]] }));
  storage.headOriginal = async () => { calls.push('head-failed'); throw new Error('S3 unavailable'); };
  await assert.rejects(service.finalize(owner, projectId, uploadId, { mediaAssetId: assetId, parts }));
  assert.equal(row.state, 'initiated');
  storage.headOriginal = async () => { calls.push('head'); };
  const finished = await service.finalize(owner, projectId, uploadId, { mediaAssetId: assetId, parts });
  assert.equal(finished.verification, 'pending_worker_sha256');
  assert.equal((await service.finalize(owner, projectId, uploadId, { mediaAssetId: assetId, parts })).state, 'completed');
  await assert.rejects(service.part(owner, projectId, uploadId, { mediaAssetId: assetId, partNumber: 1 }), { code: 'CONFLICT' });
  await assert.rejects(service.abort(owner, projectId, uploadId, { mediaAssetId: assetId }), { code: 'CONFLICT' });
  assert.equal(calls.includes('record-completed'), true);
  assert.equal(calls.includes('get-video'), false);
});

test('abort, expiry and S3 failure leave no falsely closed or verified session', async () => {
  const { service, row, calls, storage } = fixture();
  await service.start(owner, projectId, input);
  storage.abortOriginal = async () => { throw new Error('S3 unavailable'); };
  await assert.rejects(service.abort(owner, projectId, uploadId, { mediaAssetId: assetId }));
  assert.equal(row.state, 'aborting');
  storage.abortOriginal = async () => { calls.push('abort'); };
  assert.equal((await service.abort(owner, projectId, uploadId, { mediaAssetId: assetId })).state, 'aborted');
  assert.equal(calls.includes('delete-orphan'), true);
  assert.equal((await service.abort(owner, projectId, uploadId, { mediaAssetId: assetId })).state, 'aborted');
  row.state = 'initiated'; row.expiresAt = new Date(Date.now() - 1000).toISOString();
  await assert.rejects(service.part(owner, projectId, uploadId, { mediaAssetId: assetId, partNumber: 1 }), { code: 'CONFLICT' });
  storage.abortOriginal = async () => { throw new Error('S3 unavailable'); };
  assert.equal(await service.cleanupExpired(), 0);
  assert.equal(row.state, 'expiring');
  storage.abortOriginal = async () => { calls.push('abort'); };
  assert.equal(await service.cleanupExpired(), 1);
  assert.equal(row.state, 'expired');
});

test('hosted upload routes require a session and CSRF before invoking storage', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'firelaunch-upload-routes-'));
  const { service } = fixture();
  const principal = (cookie: string | undefined) => cookie === 'session=owner' ? owner : cookie === 'session=foreign' ? foreign : null;
  const auth = { publicOrigin: 'http://127.0.0.1', session(request: { headers: Record<string, string> }) {
    const p = principal(request.headers.cookie); return p ? { principal: p, csrf: 'csrf', expiresAt: Date.now() + 1000 } : null;
  }, authorizedMutation(request: { headers: Record<string, string> }) {
    return request.headers.origin === origin && request.headers['x-csrf-token'] === 'csrf';
  } } as unknown as HostedAuth;
  const api = createApi(new ProjectRepository(root), undefined, { mode: 'hosted', auth },
    {} as HostedProjectRepository, undefined, service);
  let origin = '';
  try {
    api.listen(0, '127.0.0.1'); await once(api, 'listening');
    const address = api.address(); assert.ok(address && typeof address !== 'string');
    origin = `http://127.0.0.1:${address.port}`;
    const route = `${origin}/api/projects/${projectId}/media-uploads`;
    const post = (cookie?: string, csrf = 'csrf', payload: unknown = input) => fetch(route, { method: 'POST',
      headers: { 'content-type': 'application/json', origin, cookie: cookie ?? '', 'x-csrf-token': csrf }, body: JSON.stringify(payload) });
    assert.equal((await post()).status, 401);
    assert.equal((await post('session=foreign')).status, 404);
    assert.equal((await post('session=owner', 'bad')).status, 403);
    assert.equal((await post('session=owner', 'csrf', { ...input, creatorAccountId: foreign.accountId })).status, 400);
    assert.equal((await post('session=owner')).status, 201);
    assert.equal((await fetch(`${route}/${uploadId}`, { headers: { cookie: 'session=owner', 'x-media-asset-id': assetId } })).status, 200);
    assert.equal((await fetch(`${route}/${uploadId}`, { headers: { cookie: 'session=foreign', 'x-media-asset-id': assetId } })).status, 404);
    assert.equal((await fetch(route, { headers: { cookie: 'session=owner', 'x-media-asset-id': assetId } })).status, 200);
    assert.equal((await fetch(route, { headers: { cookie: 'session=foreign', 'x-media-asset-id': assetId } })).status, 404);
    assert.equal((await fetch(`${route}/${uploadId}/part`, { method: 'POST', headers: { cookie: 'session=owner', origin,
      'content-type': 'application/json', 'x-csrf-token': 'bad' }, body: JSON.stringify({ mediaAssetId: assetId, partNumber: 1 }) })).status, 403);
  } finally { await new Promise<void>(resolve => api.close(() => resolve())); await rm(root, { recursive: true, force: true }); }
});
