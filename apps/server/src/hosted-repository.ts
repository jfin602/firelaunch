import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { channelDeploymentSchema, channelSpecSchema, createProjectSchema, projectSchema, type ChannelDeployment, type ChannelProject, type ChannelSpec } from '@firelaunch/contracts';
import { newId, starterChannel } from '@firelaunch/channel-engine';
import { z } from 'zod';
import { RepositoryError } from './repository.js';
import type { AuthenticatedPrincipal } from './auth/oidc.js';

type ProjectRow = { id: string; revision: number; spec: unknown; created_at: Date; updated_at: Date };
const channelId = z.string().regex(/^ch_[a-f0-9]{32}$/);
const accountId = z.string().regex(/^cr_[a-f0-9]{32}$/);
const identityPart = z.string().min(1).max(512);

function project(row: ProjectRow): ChannelProject {
  try {
    return projectSchema.parse({ id: row.id, revision: row.revision, spec: row.spec,
      createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() });
  } catch { throw new RepositoryError('STORAGE_ERROR', 'Invalid hosted project record'); }
}

function sqlError(error: unknown): never {
  if (error instanceof RepositoryError || error instanceof z.ZodError) throw error;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === '23505') throw new RepositoryError('CONFLICT', 'Identity already exists');
    if (error.code === '23503' || error.code === '23514') throw new RepositoryError('INVALID_INPUT', 'Invalid ownership or project record');
  }
  throw new RepositoryError('STORAGE_ERROR', 'Hosted database operation failed');
}

export class HostedProjectRepository {
  constructor(readonly pool: Pool) {}

  static async connect(connectionString: string): Promise<HostedProjectRepository> {
    if (!connectionString) throw new Error('Hosted PostgreSQL connection is required');
    const repository = new HostedProjectRepository(new Pool({ connectionString, max: 10 }));
    try { await repository.migrate(); return repository; }
    catch (error) { await repository.pool.end(); throw error; }
  }

  async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [482921]);
      await client.query('CREATE TABLE IF NOT EXISTS firelaunch_schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const result = await client.query<{ version: number }>('SELECT version FROM firelaunch_schema_migrations ORDER BY version');
      if (result.rows.some(row => row.version !== 1)) throw new Error('Unsupported hosted database migration');
      if (!result.rows.length) {
        const sql = await readFile(new URL('../migrations/001_hosted_ownership.up.sql', import.meta.url), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO firelaunch_schema_migrations(version) VALUES ($1)', [1]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async accountForIdentity(identity: Pick<AuthenticatedPrincipal, 'issuer' | 'subject' | 'email'>): Promise<string> {
    const issuer = identityPart.parse(identity.issuer);
    const subject = identityPart.parse(identity.subject);
    const email = z.email().max(254).parse(identity.email);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // The unique provider key is serialized even if independent app processes receive the same first login.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify([issuer, subject])]);
      const existing = await client.query<{ creator_account_id: string }>('SELECT creator_account_id FROM provider_identities WHERE issuer = $1 AND subject = $2', [issuer, subject]);
      let id = existing.rows[0]?.creator_account_id;
      if (!id) {
        id = `cr_${randomUUID().replaceAll('-', '')}`;
        await client.query('INSERT INTO creator_accounts(id, email) VALUES ($1, $2)', [id, email]);
        await client.query('INSERT INTO provider_identities(issuer, subject, creator_account_id) VALUES ($1, $2, $3)', [issuer, subject, id]);
      } else {
        await client.query('UPDATE creator_accounts SET email = $2 WHERE id = $1', [id, email]);
      }
      await client.query('COMMIT');
      return id;
    } catch (error) { await client.query('ROLLBACK'); return sqlError(error); }
    finally { client.release(); }
  }

  private async owner(principal: AuthenticatedPrincipal, client: PoolClient): Promise<string> {
    if (!principal || !principal.issuer || !principal.subject) throw new RepositoryError('NOT_FOUND', 'Project not found');
    const id = accountId.parse(principal.accountId);
    const result = await client.query('SELECT 1 FROM provider_identities WHERE creator_account_id = $1 AND issuer = $2 AND subject = $3', [id, principal.issuer, principal.subject]);
    if (!result.rowCount) throw new RepositoryError('NOT_FOUND', 'Project not found');
    return id;
  }

  async create(principal: AuthenticatedPrincipal, raw: unknown): Promise<ChannelProject> {
    const input = createProjectSchema.parse(raw);
    const id = newId('ch');
    const spec = starterChannel(input.title, id);
    const now = new Date().toISOString();
    const created = projectSchema.parse({ id, spec: { ...spec, slug: input.slug ?? spec.slug }, revision: 1, createdAt: now, updatedAt: now });
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const owner = await this.owner(principal, client);
      await client.query('INSERT INTO channel_projects(id, creator_account_id, spec, revision, created_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, $5, $6)', [id, owner, JSON.stringify(created.spec), 1, now, now]);
      await client.query('INSERT INTO channel_ownerships(project_id, creator_account_id, channel_id) VALUES ($1, $2, $1)', [id, owner]);
      await client.query('COMMIT');
      return created;
    } catch (error) { await client.query('ROLLBACK'); return sqlError(error); }
    finally { client.release(); }
  }

  async read(principal: AuthenticatedPrincipal, id: string): Promise<ChannelProject> {
    channelId.parse(id);
    const client = await this.pool.connect();
    try {
      const owner = await this.owner(principal, client);
      const result = await client.query<ProjectRow>('SELECT p.id, p.spec, p.revision, p.created_at, p.updated_at FROM channel_projects p JOIN channel_ownerships o ON o.project_id = p.id AND o.creator_account_id = p.creator_account_id WHERE p.id = $1 AND o.creator_account_id = $2', [id, owner]);
      if (!result.rows[0]) throw new RepositoryError('NOT_FOUND', 'Project not found');
      return project(result.rows[0]);
    } catch (error) { return sqlError(error); }
    finally { client.release(); }
  }

  async list(principal: AuthenticatedPrincipal): Promise<ChannelProject[]> {
    const client = await this.pool.connect();
    try {
      const owner = await this.owner(principal, client);
      const result = await client.query<ProjectRow>('SELECT p.id, p.spec, p.revision, p.created_at, p.updated_at FROM channel_projects p JOIN channel_ownerships o ON o.project_id = p.id AND o.creator_account_id = p.creator_account_id WHERE o.creator_account_id = $1 ORDER BY p.id', [owner]);
      return result.rows.map(project);
    } catch (error) { return sqlError(error); }
    finally { client.release(); }
  }

  async update(principal: AuthenticatedPrincipal, id: string, expectedRevision: number, rawSpec: unknown): Promise<ChannelProject> {
    channelId.parse(id);
    const spec: ChannelSpec = channelSpecSchema.parse(rawSpec);
    if (spec.id !== id) throw new z.ZodError([{ code: 'custom', path: ['spec', 'id'], message: 'Channel ID cannot change' }]);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new RepositoryError('INVALID_INPUT', 'Invalid revision');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const owner = await this.owner(principal, client);
      const updated = await client.query<ProjectRow>(`UPDATE channel_projects p SET spec = $4::jsonb, revision = p.revision + 1, updated_at = now()
        FROM channel_ownerships o WHERE p.id = $1 AND p.creator_account_id = $2 AND p.revision = $3
        AND o.project_id = p.id AND o.creator_account_id = $2
        RETURNING p.id, p.spec, p.revision, p.created_at, p.updated_at`, [id, owner, expectedRevision, JSON.stringify(spec)]);
      if (!updated.rows[0]) {
        const visible = await client.query('SELECT 1 FROM channel_ownerships WHERE project_id = $1 AND creator_account_id = $2', [id, owner]);
        throw new RepositoryError(visible.rowCount ? 'CONFLICT' : 'NOT_FOUND', visible.rowCount ? 'Project revision changed' : 'Project not found');
      }
      await client.query('COMMIT');
      return project(updated.rows[0]);
    } catch (error) { await client.query('ROLLBACK'); return sqlError(error); }
    finally { client.release(); }
  }

  async createDeployment(principal: AuthenticatedPrincipal, raw: unknown): Promise<ChannelDeployment> {
    const deployment = channelDeploymentSchema.parse(raw);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const owner = await this.owner(principal, client);
      if (deployment.creatorAccountId !== owner) throw new RepositoryError('NOT_FOUND', 'Project not found');
      const result = await client.query('INSERT INTO channel_deployments(id, creator_account_id, project_id, channel_id, package_id, deployment) SELECT $1, $2, $3, $3, $4, $5::jsonb FROM channel_ownerships WHERE project_id = $3 AND creator_account_id = $2 RETURNING id', [deployment.id, owner, deployment.projectId, deployment.packageId, JSON.stringify(deployment)]);
      if (!result.rowCount) throw new RepositoryError('NOT_FOUND', 'Project not found');
      await client.query('COMMIT');
      return deployment;
    } catch (error) { await client.query('ROLLBACK'); return sqlError(error); }
    finally { client.release(); }
  }

  async readDeployment(principal: AuthenticatedPrincipal, projectId: string): Promise<ChannelDeployment> {
    channelId.parse(projectId);
    const client = await this.pool.connect();
    try {
      const owner = await this.owner(principal, client);
      const result = await client.query<{ deployment: unknown }>('SELECT d.deployment FROM channel_deployments d JOIN channel_ownerships o ON o.project_id = d.project_id AND o.creator_account_id = d.creator_account_id WHERE d.project_id = $1 AND o.creator_account_id = $2', [projectId, owner]);
      if (!result.rows[0]) throw new RepositoryError('NOT_FOUND', 'Deployment not found');
      try { return channelDeploymentSchema.parse(result.rows[0].deployment); }
      catch { throw new RepositoryError('STORAGE_ERROR', 'Invalid deployment record'); }
    } catch (error) { return sqlError(error); }
    finally { client.release(); }
  }
}
