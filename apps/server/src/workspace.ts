import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { channelSpecSchema, type ChannelProject } from '@firelaunch/contracts';
import { doctor, type ToolchainReport } from '@firelaunch/generator/doctor';
import { generateProject, writeGeneratedProject } from '@firelaunch/generator';
import { ProjectRepository, RepositoryError } from './repository.js';

const MAX_FILE = 256_000;
const MAX_FILES = 400;
const MAX_OUTPUT = 64_000;
const BUILD_TIMEOUT = 600_000;
const textName = /\.(?:js|jsx|ts|tsx|json|toml|md|txt)$|^(?:README|LICENSE)$/i;
type Baseline = { fingerprint: string; files: Record<string, string> };
type Artifact = { path: string; sha256: string; bytes: number };
export type BuildRecord = { status: 'blocked' | 'failed' | 'succeeded'; command?: string[]; exitCode?: number | null; durationMs?: number; output?: string; reason?: string; artifact?: Artifact; sourceHash?: string; toolchain: ToolchainReport };

function hash(content: string | Buffer): string { return createHash('sha256').update(content).digest('hex'); }
function safeName(name: string): string {
  if (!name || name.length > 240 || name.includes('\\') || name.includes('\0') || name.startsWith('/') || name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) throw new RepositoryError('INVALID_INPUT', 'Unsafe generated file path');
  return name;
}
async function regular(file: string, directory = false): Promise<boolean> {
  try { const info = await lstat(file); if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) throw new RepositoryError('STORAGE_ERROR', 'Symlink or unexpected generated entry'); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
async function guarded(root: string, name: string): Promise<string> {
  safeName(name);
  let current = root;
  const parts = name.split('/');
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    if (!(await regular(current, true))) throw new RepositoryError('NOT_FOUND', 'Generated directory missing');
  }
  return path.join(current, parts.at(-1)!);
}
async function fileHash(file: string, limit = MAX_FILE): Promise<string> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > limit) throw new RepositoryError('STORAGE_ERROR', 'Generated file too large');
    return hash(await handle.readFile());
  } finally { await handle.close(); }
}
async function sourceFiles(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function visit(directory: string, prefix: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (prefix === '' && (entry.name === 'build' || entry.name === 'node_modules')) {
        if (entry.isSymbolicLink()) throw new RepositoryError('STORAGE_ERROR', 'Symlink in generated source');
        continue;
      }
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      safeName(name);
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new RepositoryError('STORAGE_ERROR', 'Symlink in generated source');
      if (entry.isDirectory()) { await regular(full, true); await visit(full, name); }
      else if (entry.isFile()) {
        if (Object.keys(files).length >= MAX_FILES) throw new RepositoryError('STORAGE_ERROR', 'Too many generated files');
        files[name] = await fileHash(full, textName.test(name) ? MAX_FILE : 10_000_000);
      } else throw new RepositoryError('STORAGE_ERROR', 'Unsupported generated entry');
    }
  }
  await regular(root, true);
  await visit(root, '');
  return files;
}
function digest(files: Record<string, string>): string { return hash(JSON.stringify(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))); }
function differences(files: Record<string, string>, baseline: Baseline): string[] {
  return [...new Set([...Object.keys(files), ...Object.keys(baseline.files)])].filter(name => files[name] !== baseline.files[name]).sort();
}
async function atomicJson(file: string, data: unknown): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx', mode: 0o600 }); await rename(temporary, file); }
  finally { await rm(temporary, { force: true }); }
}
async function record<T>(file: string): Promise<T | null> {
  if (!(await regular(file))) return null;
  try { return JSON.parse(await readFile(file, 'utf8')) as T; }
  catch { throw new RepositoryError('STORAGE_ERROR', 'Invalid workspace evidence'); }
}
async function run(command: string, args: string[], cwd: string): Promise<{ exitCode: number | null; output: string; durationMs: number }> {
  const start = Date.now();
  return new Promise(resolve => {
    let output = '';
    let done = false;
    const child = spawn(command, args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' } });
    const append = (chunk: Buffer) => { output = (output + chunk.toString('utf8')).slice(-MAX_OUTPUT); };
    child.stdout.on('data', append); child.stderr.on('data', append);
    const timer = setTimeout(() => child.kill('SIGKILL'), BUILD_TIMEOUT);
    const finish = (exitCode: number | null) => { if (done) return; done = true; clearTimeout(timer); resolve({ exitCode, output, durationMs: Date.now() - start }); };
    child.on('error', error => { append(Buffer.from(error.message)); finish(null); });
    child.on('close', finish);
  });
}
async function releaseArtifacts(root: string): Promise<Artifact[]> {
  const build = path.join(root, 'build');
  if (!(await regular(build, true))) return [];
  const artifacts: Artifact[] = [];
  for (const folder of await readdir(build, { withFileTypes: true })) {
    if (folder.isSymbolicLink()) throw new RepositoryError('STORAGE_ERROR', 'Unsafe build directory');
    if (!/^(?:armv7|aarch64|x86_64)-release$/.test(folder.name)) continue;
    if (!folder.isDirectory()) continue;
    for (const entry of await readdir(path.join(build, folder.name), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new RepositoryError('STORAGE_ERROR', 'Unsafe build artifact');
      if (!entry.isFile() || !/^[a-zA-Z0-9_-]+\.vpkg$/.test(entry.name)) continue;
      const name = `build/${folder.name}/${entry.name}`;
      const file = await guarded(root, name);
      const bytes = (await stat(file)).size;
      if (bytes > 0 && bytes <= 2_000_000_000) {
        const contentHash = createHash('sha256');
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try { for await (const chunk of handle.createReadStream({ autoClose: false })) contentHash.update(chunk as Buffer); }
        finally { await handle.close(); }
        artifacts.push({ path: name, bytes, sha256: contentHash.digest('hex') });
      }
    }
  }
  return artifacts;
}

export class WorkspaceService {
  private locks = new Map<string, Promise<unknown>>();
  constructor(private repository: ProjectRepository, private inspect: () => ToolchainReport = doctor, private execute = run) {}
  private async locked<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(action);
    this.locks.set(id, current);
    try { return await current; } finally { if (this.locks.get(id) === current) this.locks.delete(id); }
  }
  private async location(id: string): Promise<{ project: ChannelProject; directory: string; root: string }> {
    const project = await this.repository.read(id);
    const directory = await this.repository.workspace(id);
    return { project, directory, root: path.join(directory, 'generated') };
  }
  async overview(id: string) {
    const { project, directory, root } = await this.location(id);
    if (!(await regular(root, true))) return { generated: false, files: [], changed: [], stale: false, path: root };
    const baseline = await record<Baseline>(path.join(directory, 'generation.json'));
    if (!baseline) throw new RepositoryError('STORAGE_ERROR', 'Generation baseline missing');
    const files = await sourceFiles(root);
    return { generated: true, files: Object.keys(files).sort(), changed: differences(files, baseline), stale: baseline.fingerprint !== (await generateProject(project.spec)).fingerprint, path: root };
  }
  async generate(id: string) { return this.locked(id, async () => {
    const { project, directory, root } = await this.location(id);
    const existed = await regular(root, true);
    if (existed) {
      const baseline = await record<Baseline>(path.join(directory, 'generation.json'));
      if (!baseline || differences(await sourceFiles(root), baseline).length) throw new RepositoryError('CONFLICT', 'Custom or unknown generated files exist. Export or manually preserve edits before regeneration.');
    }
    const temporary = path.join(directory, `generated-${randomUUID()}`);
    try {
      const generated = await writeGeneratedProject(project.spec, temporary);
      const files = await sourceFiles(temporary);
      if (existed) {
        const old = path.join(directory, `generated-old-${randomUUID()}`);
        await rename(root, old);
        try { await rename(temporary, root); } catch (error) { await rename(old, root); throw error; }
        await rm(old, { recursive: true });
      } else await rename(temporary, root);
      await atomicJson(path.join(directory, 'generation.json'), { fingerprint: generated.fingerprint, files } satisfies Baseline);
      await rm(path.join(directory, 'build.json'), { force: true });
      return this.overview(id);
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }); }
  async read(id: string, name: string) {
    const { root } = await this.location(id);
    if (!(await regular(root, true)) || !textName.test(safeName(name))) throw new RepositoryError('NOT_FOUND', 'Generated text file not found');
    const file = await guarded(root, name);
    if (!(await regular(file))) throw new RepositoryError('NOT_FOUND', 'Generated text file not found');
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let content: string;
    let sha256: string;
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > MAX_FILE) throw new RepositoryError('STORAGE_ERROR', 'Generated text file too large');
      const bytes = await handle.readFile();
      sha256 = hash(bytes);
      content = bytes.toString('utf8');
    } finally { await handle.close(); }
    if (content.includes('\uFFFD') || content.includes('\0')) throw new RepositoryError('STORAGE_ERROR', 'File is not UTF-8 text');
    return { path: name, content, sha256 };
  }
  async save(id: string, name: string, content: string, expectedHash: string) { return this.locked(id, async () => {
    if (Buffer.byteLength(content) > MAX_FILE || content.includes('\0')) throw new RepositoryError('INVALID_INPUT', 'Text edit exceeds size limit');
    const { directory, root } = await this.location(id);
    if (!textName.test(safeName(name))) throw new RepositoryError('INVALID_INPUT', 'Only generated text files are editable');
    const file = await guarded(root, name);
    if (!(await regular(file))) throw new RepositoryError('NOT_FOUND', 'Generated text file not found');
    if (await fileHash(file) !== expectedHash) throw new RepositoryError('CONFLICT', 'Generated file changed; reload before saving');
    const temporary = path.join(path.dirname(file), `.edit-${randomUUID()}`);
    try { await writeFile(temporary, content, { flag: 'wx' }); await regular(file); await rename(temporary, file); }
    finally { await rm(temporary, { force: true }); }
    await rm(path.join(directory, 'build.json'), { force: true });
    return this.read(id, name);
  }); }
  async build(id: string): Promise<BuildRecord> { return this.locked(id, async () => {
    const { directory, root } = await this.location(id);
    const toolchain = this.inspect();
    const generated = await regular(root, true);
    const missing = [!generated && 'Generate the Vega source first', !toolchain.node.available && toolchain.node.detail,
      !toolchain.npm.available && toolchain.npm.detail, !toolchain.vegaSdk.available && toolchain.vegaSdk.detail,
      !toolchain.vegaCli.available && toolchain.vegaCli.detail].filter(Boolean).map(String);
    if (missing.length) return { status: 'blocked', reason: missing.join('; '), toolchain };
    const sourceHash = digest(await sourceFiles(root));
    const before = new Map(await Promise.all((await releaseArtifacts(root)).map(async item => [item.path, { sha256: item.sha256, modified: (await stat(await guarded(root, item.path))).mtimeMs }] as const)));
    const started = Date.now();
    const cli = process.env.VEGA_CLI_PATH;
    if (!cli || !path.isAbsolute(cli)) return { status: 'blocked', reason: 'Set VEGA_CLI_PATH to a verified absolute Vega executable', toolchain };
    const resolvedCli = await realpath(cli).catch(() => '');
    if (!resolvedCli || !(await regular(resolvedCli))) return { status: 'blocked', reason: 'Vega CLI executable is missing or unsafe', toolchain };
    const command = [resolvedCli, 'build', '-b', 'Release'];
    const result = await this.execute(command[0]!, command.slice(1), root);
    const after = result.exitCode === 0 ? await releaseArtifacts(root) : [];
    const artifact = (await Promise.all(after.map(async item => ({ item, modified: (await stat(await guarded(root, item.path))).mtimeMs })))).find(candidate =>
      candidate.modified >= started - 2000 && (!before.has(candidate.item.path) || before.get(candidate.item.path)!.modified !== candidate.modified || before.get(candidate.item.path)!.sha256 !== candidate.item.sha256))?.item;
    const evidence: BuildRecord = { status: result.exitCode === 0 && artifact ? 'succeeded' : 'failed', command,
      exitCode: result.exitCode, output: result.output, durationMs: result.durationMs, toolchain, sourceHash,
      ...(!artifact && result.exitCode === 0 ? { reason: 'Command exited successfully but no new release VPKG was verified' } : {}),
      ...(artifact ? { artifact } : {}) };
    if (evidence.status === 'succeeded') {
      const artifactFile = await guarded(root, artifact!.path);
      if ((await stat(artifactFile)).mtimeMs < started - 2000) throw new RepositoryError('STORAGE_ERROR', 'Artifact was not produced by this build');
    }
    await atomicJson(path.join(directory, 'build.json'), evidence);
    return evidence;
  }); }
  async buildStatus(id: string) {
    const { directory, root } = await this.location(id);
    const previous = await record<BuildRecord>(path.join(directory, 'build.json'));
    const toolchain = this.inspect();
    if (!previous || previous.status !== 'succeeded' || !previous.artifact) return previous ?? { status: 'blocked', reason: 'No build has run', toolchain };
    if (!(await regular(root, true)) || digest(await sourceFiles(root)) !== previous.sourceHash ||
      !(await releaseArtifacts(root)).some(item => item.path === previous.artifact!.path && item.sha256 === previous.artifact!.sha256)) {
      return { ...previous, status: 'blocked', reason: 'Source or artifact changed since verified build', artifact: undefined };
    }
    return previous;
  }
  async readiness(id: string) {
    const { project, root } = await this.location(id);
    const code = await this.overview(id);
    const build = await this.buildStatus(id);
    const spec = channelSpecSchema.parse(project.spec);
    const title = spec.title;
    const sections = spec.pages.map(page => page.title).join(', ');
    const featured = spec.content.slice(0, 3).map(item => item.title).join(', ');
    const copy = { appName: title, shortDescription: `Explore ${title} on your TV`.slice(0, 80),
      longDescription: `Explore ${title} on Fire TV. Browse ${sections || 'the channel'} with your remote.${featured ? ` Discover featured videos including ${featured}.` : ''} Select a title for details and playback.`,
      releaseNotes: `Initial release of ${title}: TV-first browsing${spec.content.length ? ` with ${spec.content.length} video${spec.content.length === 1 ? '' : 's'}` : ''} and playback.` };
    const artwork = [...new Set([spec.brand.logo, spec.brand.heroArtwork, ...spec.content.map(item => item.artwork)].filter((value): value is string => !!value))];
    const assets = { artwork, unresolvedLocal: artwork.filter(value => value.startsWith('assets/')), screenshots: [] as string[] };
    const manifest = code.generated ? (await this.read(id, 'manifest.toml')).content : '';
    const manifestReady = /^\[\[components\.interactive\]\]$/m.test(manifest) && /^\s*categories\s*=\s*\[[^\]]*"com\.amazon\.category\.main"[^\]]*\]/m.test(manifest) &&
      !code.changed.some(name => ['manifest.toml', 'package.json', 'firelaunch.json'].includes(name));
    const checks = [
      { group: 'Channel/schema', ready: true, detail: `ChannelSpec revision ${project.revision} validates` },
      { group: 'TV experience', ready: false, detail: 'Preview is not simulator/device navigation and playback evidence; verify on Vega hardware' },
      { group: 'Manifest/project', ready: code.generated && !code.stale && manifestReady, detail: code.generated ? code.stale ? 'Regenerate to match current channel' : manifestReady ? 'Generated manifest contains the main category; inspect unresolved local assets' : 'Manifest or project metadata changed; verify before submission' : 'Generate Vega source' },
      { group: 'Build artifact', ready: build.status === 'succeeded', detail: build.status === 'succeeded' ? `${build.artifact?.path} SHA-256 ${build.artifact?.sha256}` : build.reason ?? 'Run a real release build' },
      { group: 'Store assets/copy', ready: false, detail: `Review draft copy and rights for ${artwork.length} artwork reference(s); supply icon and device screenshots` },
      { group: 'Support/privacy metadata', ready: false, detail: 'Creator must provide support contact, privacy policy and content-rights declarations' },
      { group: 'Device evidence', ready: false, detail: 'Run on Vega simulator and physical Fire TV; retain independent test evidence' },
      { group: 'Human Amazon steps', ready: false, detail: 'Creator signs into Developer Console, uploads release VPKG, selects devices, fills listing, reviews and submits' }
    ];
    const { output: _output, ...buildSummary } = build;
    return { checks, copy, assets, build: buildSummary, generatedPath: code.generated ? root : null, submitted: false };
  }
  async bundle(id: string) { return this.locked(id, async () => {
    const { directory } = await this.location(id);
    const readiness = await this.readiness(id);
    const folder = path.join(directory, `submission-${randomUUID()}`);
    await mkdir(folder);
    await writeFile(path.join(folder, 'readiness.json'), `${JSON.stringify(readiness, null, 2)}\n`, { flag: 'wx' });
    await writeFile(path.join(folder, 'store-copy.md'), `# ${readiness.copy.appName}\n\n${readiness.copy.shortDescription}\n\n${readiness.copy.longDescription}\n\n## Release notes\n${readiness.copy.releaseNotes}\n`, { flag: 'wx' });
    await writeFile(path.join(folder, 'store-assets.md'), `# Store asset inventory\n\nArtwork references (verify rights and resolution; these are not Appstore icon/screenshot uploads):\n${readiness.assets.artwork.map(asset => `- ${asset}`).join('\n') || '- No artwork referenced'}\n\nUnresolved local paths:\n${readiness.assets.unresolvedLocal.map(asset => `- [ ] Supply ${asset} in generated source`).join('\n') || '- None listed'}\n\n- [ ] Provide a licensed Appstore icon\n- [ ] Capture Fire TV/Vega device screenshots after testing (none recorded)\n- [ ] Confirm third-party media/artwork rights\n`, { flag: 'wx' });
    await writeFile(path.join(folder, 'checklist.md'), `# Creator-owned Amazon handoff\n\n${readiness.checks.map(check => `- [${check.ready ? 'x' : ' '}] ${check.group}: ${check.detail}`).join('\n')}\n\nNo Developer Console submission has occurred. Verify the artifact, rights and screenshots; sign into your own account and complete upload, device selection, listing, review and submission.\n`, { flag: 'wx' });
    return { path: folder, files: ['readiness.json', 'store-copy.md', 'store-assets.md', 'checklist.md'], submitted: false };
  }); }
}
