import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { lstat, open, readdir } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { migrateChannel } from '@firelaunch/channel-engine';
import { projectSchema, type ChannelProject } from '@firelaunch/contracts';
import type { Pool } from 'pg';
import { RepositoryError } from '../repository.js';
import { audit } from '../operations.js';

const projectId = /^ch_[a-f0-9]{32}$/;
const accountId = /^cr_[a-f0-9]{32}$/;
const hexHash = /^[a-f0-9]{64}$/;
const MAX_FILE = 256_000;
const MAX_FILES = 400;
const MAX_TOTAL = 16_000_000;
const textName = /\.(?:js|jsx|ts|tsx|json|toml|md|txt)$|^(?:README|LICENSE)$/i;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const unsafe = (message: string): never => { throw new RepositoryError('STORAGE_ERROR', message); };

async function directory(name: string): Promise<void> {
  const info = await lstat(name);
  if (!info.isDirectory() || info.isSymbolicLink()) unsafe('Unsafe legacy directory');
}

async function guardedRoot(root: string): Promise<void> {
  if (!path.isAbsolute(root)) unsafe('Legacy root must be absolute');
  const resolved = path.resolve(root);
  let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    await directory(current);
  }
}

async function readBounded(name: string, limit: number): Promise<Buffer> {
  const info = await lstat(name);
  if (!info.isFile() || info.isSymbolicLink() || info.size > limit) unsafe('Unsafe or oversized legacy file');
  const handle = await open(name, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > limit || opened.ino !== info.ino || opened.dev !== info.dev) unsafe('Legacy file changed while reading');
    const content = await handle.readFile();
    if (content.length > limit) unsafe('Oversized legacy file');
    return content;
  } finally { await handle.close(); }
}

function textFile(bytes: Buffer): string {
  if (bytes.includes(0)) unsafe('Binary generated source requires manual recovery');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return unsafe('Non-UTF-8 generated source requires manual recovery'); }
}

type LegacySource = { fingerprint: string; files: Record<string, string>; baseline: Record<string, string>; changed: string[]; excluded: string[] };
export type LegacySnapshot = { project: ChannelProject; source: LegacySource | null; fingerprint: string; excluded: string[] };
export type ImportResult = { projectId: string; status: 'ready' | 'imported' | 'already-imported' | 'collision' | 'error';
  message: string; fingerprint?: string; changedFiles?: string[]; excluded?: string[] };

export async function readLegacyProject(dataRoot: string, id: string): Promise<LegacySnapshot> {
  if (!projectId.test(id)) unsafe('Invalid legacy project ID');
  await guardedRoot(dataRoot);
  const projects = path.join(dataRoot, 'projects');
  await directory(projects);
  const home = path.join(projects, id);
  await directory(home);
  const entries = await readdir(home, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) unsafe('Symlink in legacy project');
    if (!['project.json', 'generation.json', 'generated', 'build.json'].includes(entry.name) && !/^submission-[a-f0-9-]{36}$/.test(entry.name))
      unsafe('Unexpected legacy project entry requires manual review');
  }
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(path.join(home, 'project.json'), 2_000_000))); }
  catch { return unsafe('Invalid legacy project JSON'); }
  let project: ChannelProject;
  try {
    if (typeof raw !== 'object' || raw === null || !('spec' in raw)) throw new Error('Missing spec');
    project = projectSchema.parse({ ...raw, spec: migrateChannel(raw.spec) });
    if (project.id !== id) throw new Error('Mismatched ID');
  } catch { return unsafe('Invalid legacy project contract'); }
  const hasSource = entries.some(entry => entry.name === 'generated');
  const hasBaseline = entries.some(entry => entry.name === 'generation.json');
  if (hasSource !== hasBaseline) unsafe('Generated source and baseline must be imported together');
  let source: LegacySource | null = null;
  if (hasSource) {
    let rawBaseline: unknown;
    try { rawBaseline = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(path.join(home, 'generation.json'), 2_000_000))); }
    catch { return unsafe('Invalid legacy generation baseline'); }
    if (!rawBaseline || typeof rawBaseline !== 'object' || !('fingerprint' in rawBaseline) || !('files' in rawBaseline) ||
      typeof rawBaseline.fingerprint !== 'string' || !hexHash.test(rawBaseline.fingerprint) ||
      !rawBaseline.files || typeof rawBaseline.files !== 'object' || Array.isArray(rawBaseline.files)) unsafe('Invalid legacy generation baseline');
    const parsedBaseline = rawBaseline as { fingerprint: string; files: Record<string, unknown> };
    const baseline = parsedBaseline.files;
    const files: Record<string, string> = Object.create(null);
    const excluded: string[] = [];
    let total = 0;
    async function visit(folder: string, prefix = ''): Promise<void> {
      await directory(folder);
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) unsafe('Symlink in generated source');
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!name || name.length > 240 || name.includes('\\') || name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')))
          unsafe('Unsafe generated source path');
        const absolute = path.join(folder, entry.name);
        if (!prefix && (name === 'build' || name === 'node_modules')) {
          if (!entry.isDirectory()) unsafe('Unsafe generated output directory');
          excluded.push(name); continue;
        }
        if (entry.isDirectory()) await visit(absolute, name);
        else if (entry.isFile()) {
          if (!textName.test(name)) unsafe('Unsupported generated file requires manual recovery');
          if (Object.keys(files).length >= MAX_FILES) unsafe('Too many generated files');
          const bytes = await readBounded(absolute, MAX_FILE);
          total += bytes.length;
          if (total > MAX_TOTAL) unsafe('Generated source exceeds import limit');
          files[name] = textFile(bytes);
        } else unsafe('Unsupported generated source entry');
      }
    }
    await visit(path.join(home, 'generated'));
    for (const [name, value] of Object.entries(baseline)) {
      if (!name || name.length > 240 || name.includes('\\') || name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) || !textName.test(name) ||
        typeof value !== 'string' || !hexHash.test(value)) unsafe('Invalid baseline file entry');
    }
    const names = new Set([...Object.keys(files), ...Object.keys(baseline)]);
    if (names.size > MAX_FILES) unsafe('Too many baseline files');
    const changed = [...names].filter(name => files[name] === undefined || hash(files[name]!) !== baseline[name]).sort();
    source = { fingerprint: parsedBaseline.fingerprint, files, baseline: Object.fromEntries(Object.entries(baseline).map(([name, value]) => [name, `sha256:${value}`])),
      changed, excluded };
  }
  if (entries.some(entry => entry.name === 'build.json')) {
    let build: unknown;
    try { build = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(path.join(home, 'build.json'), 2_000_000))); }
    catch { return unsafe('Invalid legacy build record'); }
    if (build && typeof build === 'object' && 'status' in build && build.status === 'succeeded')
      unsafe('Verified legacy build artifact requires separate manual recovery');
  }
  const excluded = [...(source?.excluded ?? []), ...entries.filter(entry => entry.name === 'build.json' || entry.name.startsWith('submission-')).map(entry => entry.name)].sort();
  const fingerprint = hash(JSON.stringify({ project, source }));
  return { project, source, fingerprint, excluded };
}

/** Admin-only import. The explicit account ID is selected by an operator, never inferred from legacy files or an HTTP request. */
export class LegacyImporter {
  constructor(private readonly pool: Pool, private readonly dataRoot: string, private readonly creatorAccountId: string) {
    if (!accountId.test(creatorAccountId)) throw new RepositoryError('INVALID_INPUT', 'Invalid destination creator account');
  }

  async projectIds(): Promise<string[]> {
    await guardedRoot(this.dataRoot);
    const projects = path.join(this.dataRoot, 'projects');
    await directory(projects);
    const entries = await readdir(projects, { withFileTypes: true });
    for (const entry of entries) if (!projectId.test(entry.name)) unsafe('Unexpected legacy project entry');
    return entries.map(entry => entry.name).sort();
  }

  async run(id: string, apply = false): Promise<ImportResult> {
    if (!projectId.test(id)) return { projectId: id, status: 'error', message: 'Invalid legacy project ID' };
    let snapshot: LegacySnapshot;
    try { snapshot = await readLegacyProject(this.dataRoot, id); }
    catch (error) {
      if (apply) await this.auditFailure(id, 'validation_failed');
      return { projectId: id, status: 'error', message: error instanceof Error ? error.message : 'Legacy read failed' };
    }
    const base = { projectId: id, fingerprint: snapshot.fingerprint, changedFiles: snapshot.source?.changed ?? [], excluded: snapshot.excluded };
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [id]);
      const account = await client.query('SELECT 1 FROM creator_accounts WHERE id = $1', [this.creatorAccountId]);
      if (!account.rowCount) throw new RepositoryError('NOT_FOUND', 'Destination creator account does not exist');
      const existing = await client.query<{ creator_account_id: string }>('SELECT creator_account_id FROM channel_projects WHERE id = $1', [id]);
      const marker = await client.query<{ fingerprint: string }>('SELECT fingerprint FROM legacy_import_markers WHERE creator_account_id = $1 AND legacy_project_id = $2', [this.creatorAccountId, id]);
      if (existing.rows[0] || marker.rows[0]) {
        await client.query('ROLLBACK');
        if (existing.rows[0]?.creator_account_id === this.creatorAccountId && marker.rows[0]?.fingerprint === snapshot.fingerprint)
          return { ...base, status: 'already-imported', message: 'Same legacy snapshot already imported' };
        if (apply) await this.auditFailure(id, 'collision');
        return { ...base, status: 'collision', message: existing.rows[0]?.creator_account_id === this.creatorAccountId ? 'Project ID already belongs to this account with different import history' : 'Project ID belongs to another account' };
      }
      if (!apply) { await client.query('ROLLBACK'); return { ...base, status: 'ready', message: 'Dry run; no writes performed. Rights and Amazon licenses are not inferred.' }; }
      const p = snapshot.project;
      await client.query('INSERT INTO channel_projects(id, creator_account_id, spec, revision, created_at, updated_at) VALUES ($1,$2,$3::jsonb,$4,$5,$6)',
        [id, this.creatorAccountId, JSON.stringify(p.spec), p.revision, p.createdAt, p.updatedAt]);
      await client.query('INSERT INTO channel_ownerships(project_id, creator_account_id, channel_id) VALUES ($1,$2,$1)', [id, this.creatorAccountId]);
      if (snapshot.source) await client.query(`INSERT INTO hosted_source_projects(project_id, creator_account_id, spec_revision, fingerprint, files, baseline)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`, [id, this.creatorAccountId, p.revision, snapshot.source.fingerprint,
        JSON.stringify(snapshot.source.files), JSON.stringify(snapshot.source.baseline)]);
      await client.query('INSERT INTO legacy_import_markers(creator_account_id, legacy_project_id, fingerprint, imported_project_id) VALUES ($1,$2,$3,$2)',
        [this.creatorAccountId, id, snapshot.fingerprint]);
      await client.query('INSERT INTO creator_audit_events(creator_account_id,event_type,project_id,details) VALUES ($1,$2,$3,$4::jsonb)',
        [this.creatorAccountId, 'legacy_project_imported', id, JSON.stringify({ fingerprint: snapshot.fingerprint, changedFiles: base.changedFiles,
          excluded: base.excluded, rights: 'not_inferred' })]);
      await client.query('COMMIT');
      return { ...base, status: 'imported', message: 'Imported without modifying local originals; no rights or Amazon licenses inferred' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (apply) await this.auditFailure(id, 'transaction_failed');
      return { ...base, status: 'error', message: error instanceof RepositoryError ? error.message : 'Import transaction failed' };
    } finally { client.release(); }
  }

  private async auditFailure(id: string, reason: string): Promise<void> {
    await audit(this.pool, 'import_failed', 'failure', this.creatorAccountId);
    await this.pool.query(`INSERT INTO creator_audit_events(creator_account_id,event_type,project_id,details)
      SELECT $1,'legacy_project_import_failed',$2,$3::jsonb FROM creator_accounts WHERE id = $1`, [this.creatorAccountId, id, JSON.stringify({ reason })]).catch(() => undefined);
  }
}
