import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { channelSpecSchema, createProjectSchema, idSchema, projectSchema, type ChannelProject, type ChannelSpec } from '@firelaunch/contracts';
import { migrateChannel, newId, starterChannel } from '@firelaunch/channel-engine';
import { z } from 'zod';

export class RepositoryError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'CONFLICT' | 'STORAGE_ERROR' | 'INVALID_INPUT', message: string) { super(message); }
}

async function directoryNoLink(directory: string): Promise<void> {
  const stats = await lstat(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new RepositoryError('STORAGE_ERROR', 'Unsafe storage directory');
}

async function fileNoLink(file: string): Promise<void> {
  const stats = await lstat(file);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new RepositoryError('STORAGE_ERROR', 'Unsafe project file');
}

async function exists(file: string): Promise<boolean> {
  try { await lstat(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}

export class ProjectRepository {
  private readonly root: string;
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(dataRoot: string) { this.root = path.resolve(dataRoot); }

  private async base(): Promise<string> {
    let parent = path.parse(this.root).root;
    for (const segment of this.root.slice(parent.length).split(path.sep).filter(Boolean)) {
      parent = path.join(parent, segment);
      if (!(await exists(parent))) await mkdir(parent);
      await directoryNoLink(parent);
    }
    const base = path.join(this.root, 'projects');
    if (!(await exists(base))) await mkdir(base);
    await directoryNoLink(base);
    return base;
  }

  private async projectDirectory(id: string): Promise<string> {
    idSchema.parse(id);
    if (!id.startsWith('ch_')) throw new RepositoryError('NOT_FOUND', 'Project not found');
    const base = await this.base();
    const directory = path.resolve(base, id);
    if (path.dirname(directory) !== base) throw new RepositoryError('STORAGE_ERROR', 'Unsafe project path');
    return directory;
  }

  private async guardedDirectory(id: string): Promise<string> {
    const directory = await this.projectDirectory(id);
    if (!(await exists(directory))) throw new RepositoryError('NOT_FOUND', 'Project not found');
    await directoryNoLink(directory);
    const resolved = await realpath(directory);
    if (path.dirname(resolved) !== await realpath(await this.base())) throw new RepositoryError('STORAGE_ERROR', 'Project escapes data root');
    return directory;
  }

  async workspace(id: string): Promise<string> { return this.guardedDirectory(id); }

  private async locked<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(action);
    this.locks.set(id, operation);
    try { return await operation; }
    finally { if (this.locks.get(id) === operation) this.locks.delete(id); }
  }

  private async write(directory: string, project: ChannelProject): Promise<void> {
    const destination = path.join(directory, 'project.json');
    if (await exists(destination)) await fileNoLink(destination);
    const temporary = path.join(directory, `.project-${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(project)}\n`);
        await handle.sync();
      } finally { await handle.close(); }
      await directoryNoLink(directory);
      if (await exists(destination)) await fileNoLink(destination);
      await rename(temporary, destination);
      const dirHandle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
      try { await dirHandle.sync(); } finally { await dirHandle.close(); }
    } finally { await rm(temporary, { force: true }); }
  }

  async create(raw: unknown): Promise<ChannelProject> {
    const input = createProjectSchema.parse(raw);
    const id = newId('ch');
    const spec = starterChannel(input.title, id);
    const now = new Date().toISOString();
    const project = projectSchema.parse({ id, spec: { ...spec, slug: input.slug ?? spec.slug }, revision: 1, createdAt: now, updatedAt: now });
    const directory = await this.projectDirectory(id);
    await mkdir(directory);
    try { await this.write(directory, project); }
    catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
    return project;
  }

  async read(id: string): Promise<ChannelProject> {
    const directory = await this.guardedDirectory(id);
    const file = path.join(directory, 'project.json');
    if (!(await exists(file))) throw new RepositoryError('STORAGE_ERROR', 'Project file missing');
    await fileNoLink(file);
    const stats = await lstat(file);
    if (stats.size > 2_000_000) throw new RepositoryError('STORAGE_ERROR', 'Project file too large');
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let raw: unknown;
    try { raw = JSON.parse(await handle.readFile({ encoding: 'utf8' })); }
    catch { throw new RepositoryError('STORAGE_ERROR', 'Invalid project JSON'); }
    finally { await handle.close(); }
    try {
      if (typeof raw !== 'object' || raw === null || !('spec' in raw)) throw new Error('Missing ChannelSpec');
      const spec = migrateChannel(raw.spec);
      const project = projectSchema.parse({ ...raw, spec });
      if (project.id !== id) throw new Error('Mismatched project identity');
      return project;
    } catch { throw new RepositoryError('STORAGE_ERROR', 'Invalid project record or unsupported schema'); }
  }

  async list(): Promise<ChannelProject[]> {
    const base = await this.base();
    const entries = await readdir(base);
    const projects: ChannelProject[] = [];
    for (const entry of entries) {
      if (!/^ch_[a-f0-9]{32}$/.test(entry)) throw new RepositoryError('STORAGE_ERROR', 'Unexpected project directory');
      projects.push(await this.read(entry));
    }
    return projects.sort((left, right) => left.id.localeCompare(right.id));
  }

  async update(id: string, expectedRevision: number, rawSpec: unknown): Promise<ChannelProject> {
    return this.locked(id, async () => {
      const current = await this.read(id);
      if (current.revision !== expectedRevision) throw new RepositoryError('CONFLICT', 'Project revision changed');
      const spec: ChannelSpec = channelSpecSchema.parse(rawSpec);
      if (spec.id !== id) throw new z.ZodError([{ code: 'custom', path: ['spec', 'id'], message: 'Channel ID cannot change' }]);
      const project = projectSchema.parse({ ...current, spec, revision: current.revision + 1, updatedAt: new Date().toISOString() });
      await this.write(await this.guardedDirectory(id), project);
      return project;
    });
  }
}
