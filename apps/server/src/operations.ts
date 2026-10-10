import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { PrivateObjectStore } from './private-objects.js';

const accountId = z.string().regex(/^cr_[a-f0-9]{32}$/);
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const events = z.enum(['auth_denied', 'auth_failed', 'storage_failed', 'import_failed', 'backup_started', 'backup_failed', 'backup_succeeded', 'recovery_started', 'recovery_failed', 'recovery_succeeded', 'account_exported', 'account_deleted', 'orphan_cleanup_failed']);
const outcomes = z.enum(['started', 'success', 'denied', 'failure']);

/** Only enumerated fields reach durable audit or stdout. No request payloads, tokens, emails, URLs or object keys. */
export async function audit(pool: Pool | undefined, event: z.infer<typeof events>, outcome: z.infer<typeof outcomes>, actor?: string, count?: number): Promise<void> {
  events.parse(event); outcomes.parse(outcome);
  const record = { event, outcome, actorHash: actor ? hash(actor) : null, ...(count === undefined ? {} : { count: z.number().int().nonnegative().parse(count) }) };
  process.stderr.write(`${JSON.stringify({ type: 'firelaunch_audit', ...record })}\n`);
  if (pool) await pool.query('INSERT INTO operational_audit_events(event_type,outcome,actor_hash,details) VALUES ($1,$2,$3,$4::jsonb)',
    [event, outcome, record.actorHash, JSON.stringify(count === undefined ? {} : { count })]).catch(() => undefined);
}

export async function health(pool: Pool, store: PrivateObjectStore): Promise<{ status: 'ok' | 'degraded'; database: boolean; objectStore: boolean; migration: number }> {
  let database = false; let objectStore = false; let migration = 0;
  try { const result = await pool.query<{ version: number }>('SELECT max(version)::int AS version FROM firelaunch_schema_migrations'); migration = result.rows[0]?.version ?? 0; database = migration === 4; } catch { /* safe status only */ }
  // Object stores expose no list permission. A missing random key must return an error, proving a reachable authenticated read path.
  try { await store.get(`private/${'0'.repeat(64)}`); objectStore = true; }
  catch (error) { objectStore = !(error instanceof TypeError) && /NoSuchKey|ENOENT|not found/i.test(String(error)); }
  return { status: database && objectStore ? 'ok' : 'degraded', database, objectStore, migration };
}

/** Operator only: no API route. Bounded account export includes actual private bytes and excludes credentials/capabilities. */
export async function exportAccount(pool: Pool, store: PrivateObjectStore, id: string): Promise<{ account: unknown; providerIdentities: unknown[]; projects: unknown[]; source: unknown[]; deployments: unknown[]; legacyImportMarkers: unknown[]; creatorAuditEvents: unknown[]; operationalAuditEvents: unknown[]; objects: { metadata: unknown; contentBase64: string }[] }> {
  accountId.parse(id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const account = (await client.query('SELECT id, email, created_at FROM creator_accounts WHERE id = $1', [id])).rows[0];
    if (!account) throw new Error('Account not found');
    const providerIdentities = (await client.query('SELECT issuer, subject FROM provider_identities WHERE creator_account_id = $1 ORDER BY issuer, subject', [id])).rows;
    const projects = (await client.query('SELECT id, spec, revision, created_at, updated_at FROM channel_projects WHERE creator_account_id = $1 ORDER BY id', [id])).rows;
    const source = (await client.query('SELECT project_id, spec_revision, fingerprint, files, baseline FROM hosted_source_projects WHERE creator_account_id = $1 ORDER BY project_id', [id])).rows;
    const deployments = (await client.query('SELECT deployment FROM channel_deployments WHERE creator_account_id = $1 ORDER BY id', [id])).rows.map(row => row.deployment);
    const legacyImportMarkers = (await client.query('SELECT legacy_project_id, fingerprint, imported_project_id FROM legacy_import_markers WHERE creator_account_id = $1 ORDER BY legacy_project_id', [id])).rows;
    const creatorAuditEvents = (await client.query('SELECT event_type, project_id, occurred_at, details FROM creator_audit_events WHERE creator_account_id = $1 ORDER BY id LIMIT 10001', [id])).rows;
    const operationalAuditEvents = (await client.query('SELECT event_type, outcome, occurred_at, details FROM operational_audit_events WHERE actor_hash = $1 ORDER BY id LIMIT 10001', [hash(id)])).rows;
    if (creatorAuditEvents.length > 10000 || operationalAuditEvents.length > 10000) throw new Error('Account export exceeds audit event limit');
    const rows = (await client.query('SELECT id, project_id, kind, object_key, content_type, byte_size, sha256 FROM private_objects WHERE creator_account_id = $1 ORDER BY id', [id])).rows;
    if (rows.length > 1000) throw new Error('Account export exceeds object count limit');
    const objects = [];
    let bytes = 0;
    for (const row of rows) {
      const content = await store.get(row.object_key);
      bytes += content.length;
      if (bytes > 100_000_000 || content.length !== row.byte_size || hash(content) !== row.sha256) throw new Error('Account export integrity or size failure');
      const { object_key: _key, ...metadata } = row;
      objects.push({ metadata, contentBase64: content.toString('base64') });
    }
    await client.query('COMMIT');
    return { account, providerIdentities, projects, source, deployments, legacyImportMarkers, creatorAuditEvents, operationalAuditEvents, objects };
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
}

/** Commit revocation and deletion first; durable garbage queue survives process or object-store failure. */
export async function deleteAccount(pool: Pool, store: PrivateObjectStore, id: string): Promise<{ queued: number; cleaned: number; failed: number }> {
  accountId.parse(id);
  const client = await pool.connect();
  let count = 0;
  try {
    await client.query('BEGIN');
    const account = await client.query('SELECT id FROM creator_accounts WHERE id = $1 FOR UPDATE', [id]);
    if (!account.rowCount) throw new Error('Account not found');
    const queued = await client.query('INSERT INTO private_object_garbage(object_key) SELECT object_key FROM private_objects WHERE creator_account_id = $1 ON CONFLICT DO NOTHING RETURNING object_key', [id]);
    count = queued.rowCount ?? 0;
    await client.query('DELETE FROM creator_accounts WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { client.release(); }
  await audit(pool, 'account_deleted', 'success', id, count);
  const cleanup = await cleanOrphans(pool, store);
  return { queued: count, ...cleanup };
}

export async function cleanOrphans(pool: Pool, store: PrivateObjectStore): Promise<{ cleaned: number; failed: number }> {
  const rows = (await pool.query<{ object_key: string }>('SELECT object_key FROM private_object_garbage ORDER BY queued_at LIMIT 1000')).rows;
  let cleaned = 0; let failed = 0;
  for (const row of rows) {
    try {
      await store.delete(row.object_key);
      await pool.query('DELETE FROM private_object_garbage WHERE object_key = $1', [row.object_key]);
      cleaned++;
    } catch {
      failed++;
      await pool.query('UPDATE private_object_garbage SET attempts = attempts + 1 WHERE object_key = $1', [row.object_key]);
    }
  }
  if (failed) await audit(pool, 'orphan_cleanup_failed', 'failure', undefined, failed);
  return { cleaned, failed };
}
