import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { HostedProjectRepository } from '../src/hosted-repository.js';
import type { AuthenticatedPrincipal } from '../src/auth/oidc.js';

const baseUrl = process.env.VEGALAUNCH_TEST_DATABASE_URL;
(baseUrl ? test : test.skip)('draft export identities are created once per owned channel', async () => {
  const admin = new Pool({ connectionString: baseUrl });
  const dbName = `vegalaunch_export_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(baseUrl!); url.pathname = `/${dbName}`;
  await admin.query(`CREATE DATABASE ${dbName}`);
  let first: HostedProjectRepository | undefined;
  let second: HostedProjectRepository | undefined;
  try {
    first = await HostedProjectRepository.connect(url.toString());
    second = await HostedProjectRepository.connect(url.toString());
    const principal = async (subject: string): Promise<AuthenticatedPrincipal> => ({
      accountId: await first!.accountForIdentity({ issuer: 'https://issuer.example', subject,
        email: `${subject}@example.com` }), issuer: 'https://issuer.example', subject,
      email: `${subject}@example.com`
    });
    const a = await principal('a');
    const b = await principal('b');
    const a1 = await first.create(a, { title: 'Channel A1' });
    const a2 = await first.create(a, { title: 'Channel A2' });
    const b1 = await second.create(b, { title: 'Channel B1' });
    const [firstClick, repeatClick, otherChannel, otherCreator] = await Promise.all([
      first.ensureDraftDeployment(a, a1.id), second.ensureDraftDeployment(a, a1.id),
      first.ensureDraftDeployment(a, a2.id), second.ensureDraftDeployment(b, b1.id)
    ]);
    assert.equal(firstClick.id, repeatClick.id);
    assert.equal(firstClick.packageId, repeatClick.packageId);
    assert.notEqual(firstClick.packageId, otherChannel.packageId);
    assert.notEqual(firstClick.packageId, otherCreator.packageId);
    assert.equal(firstClick.manifestEndpoint, undefined);
    assert.equal(firstClick.nativeReleaseApproval, 'pending_creator');
    assert.equal((await first.pool.query('SELECT count(*)::int AS count FROM channel_deployments')).rows[0].count, 3);
    await assert.rejects(first.ensureDraftDeployment(b, a1.id), { code: 'NOT_FOUND' });
    await assert.rejects(second.readDeployment(a, b1.id), { code: 'NOT_FOUND' });
    const existing = await second.ensureDraftDeployment(a, a1.id);
    assert.equal(existing.id, firstClick.id);
  } finally {
    await first?.pool.end(); await second?.pool.end();
    await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);
    await admin.end();
  }
});
