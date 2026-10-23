import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isIP } from 'node:net';
import { generateProject } from '@vegalaunch/generator';
import type { ChannelDeployment, ChannelProject } from '@vegalaunch/contracts';
import { RepositoryError } from './repository.js';
import { isTrustedVegaAsset, isTrustedVegaAssetPath, TRUSTED_VEGA_ASSET_MAX_BYTES } from './trusted-vega-assets.js';

export const DEPENDENCY_LOCK_COMMAND = Object.freeze(['npm', 'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
export const DEPENDENCY_INSTALL_COMMAND = Object.freeze(['npm', 'ci', '--no-audit', '--no-fund']);
export const RELEASE_BUILD_COMMAND = Object.freeze(['./node_modules/.bin/react-native', 'build-vega', '--target', 'x86_64', '--build-type', 'Release']);
export function releaseBuildCommand(input: ReleaseBuildInput): readonly string[] {
  if (!Number.isSafeInteger(input.publishedRelease.sequence) || input.publishedRelease.sequence < 1)
    invalid('Invalid native build number');
  return Object.freeze([...RELEASE_BUILD_COMMAND, '--build-number', String(input.publishedRelease.sequence)]);
}
export const VPT_INFO_COMMAND = Object.freeze(['vpt', 'info', '--json']);
export const VPT_VALIDATE_COMMAND = Object.freeze(['vpt', 'validate', '--no-color']);
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const conflict = (message: string): never => { throw new RepositoryError('CONFLICT', message); };
const invalid = (message: string): never => { throw new RepositoryError('INVALID_INPUT', message); };
export type ReleaseIdentity = Readonly<{ releaseId: string; sequence: number }>;
export type ReleaseBuildInput = Readonly<{
  format: 'firelaunch-vega-build-input-v1'; projectId: string; creatorAccountId: string;
  specRevision: number; generatorFingerprint: string; sourceRevision: number;
  deploymentId: string; packageId: string; manifestEndpoint: string;
  publishedRelease: ReleaseIdentity; files: Readonly<Record<string, string>>;
  fileSha256: Readonly<Record<string, string>>; sourceHash: string; fingerprint: string;
}>;
export type StoredSource = { specRevision: number; fingerprint: string; files: Record<string, string>; baseline: Record<string, string> };

function validEndpoint(endpoint: string, deploymentId: string): string {
  let url: URL;
  try { url = new URL(endpoint); } catch { return invalid('Invalid public manifest endpoint'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port ||
    !['/', `/public/v1/deployments/${deploymentId}/current`].includes(url.pathname) || isIP(host) ||
    host.startsWith('[') || /\.(?:test|invalid|example)$/.test(host) ||
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') ||
    host === 'example.org' || host.endsWith('.example.org') || host === 'example.com' || host.endsWith('.example.com') ||
    host === 'example.net' || host.endsWith('.example.net')) invalid('Release requires a real public-only HTTPS resolver');
  return new URL(`/public/v1/deployments/${deploymentId}/current`, url.origin).toString();
}

function validFiles(files: Record<string, string>): Record<string, string> {
  const names = Object.keys(files).sort();
  if (!names.length || names.length > 400) invalid('Invalid source file count');
  let total = 0;
  for (const name of names) {
    const content = files[name]!;
    const trusted = typeof content === 'string' && isTrustedVegaAsset(name, content);
    if (!name || name.length > 240 || name.includes('\\') || name.includes('\0') || name.startsWith('/') ||
      name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) ||
      !trusted && !(/\.(?:js|jsx|ts|tsx|json|toml|md|txt)$|^(?:README|LICENSE)$/i.test(name))) invalid('Unsafe source path');
    if (typeof content !== 'string' || content.includes('\0') ||
      Buffer.byteLength(content) > (trusted ? TRUSTED_VEGA_ASSET_MAX_BYTES : 256_000))
      invalid('Unsafe source content');
    total += Buffer.byteLength(content);
    if (total > 8_000_000) invalid('Source exceeds build input limit');
    if (/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(content) ||
      /https?:\/\/[^\s"'`<>]+(?:X-Amz-|[?&](?:token|signature|secret|key)=|\/api\/(?:private|preview|media\/private))/i.test(content))
      invalid('Private credential or capability in source');
    if (trusted) continue;
    for (const match of content.matchAll(/https?:\/\/[^\s"'`<>)}\]]+/g)) {
      let url: URL;
      try { url = new URL(match[0]); } catch { continue; }
      const host = url.hostname.toLowerCase().replace(/\.$/, '');
      if (url.protocol !== 'https:' || url.username || url.password || isIP(host) || host.startsWith('[') || host === 'localhost' ||
        host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') ||
        /(?:private|preview|original|signed)/i.test(url.pathname) ||
        [...url.searchParams.keys()].some(key => /(?:token|signature|secret|key|credential|x-amz-)/i.test(key)))
        invalid('Private or unsafe URL in source');
    }
  }
  return Object.freeze(Object.fromEntries(names.map(name => [name, files[name]!])));
}

export async function createReleaseBuildInput(project: ChannelProject, source: StoredSource | null,
  deployment: ChannelDeployment, release: ReleaseIdentity | null, creatorAccountId: string): Promise<ReleaseBuildInput> {
  if (!source) throw new RepositoryError('CONFLICT', 'Generate deployment-bound source before building');
  if (!release || !/^rel_[a-f0-9]{32}$/.test(release.releaseId) || !Number.isSafeInteger(release.sequence) || release.sequence < 1)
    throw new RepositoryError('CONFLICT', 'No creator-approved published release');
  if (deployment.projectId !== project.id || deployment.channelId !== project.id || deployment.creatorAccountId !== creatorAccountId)
    conflict('Deployment identity differs from project');
  const endpoint = validEndpoint(deployment.manifestEndpoint ?? '', deployment.id);
  const generated = await generateProject(project.spec, deployment);
  if (source.specRevision !== project.revision || source.fingerprint !== generated.fingerprint)
    conflict('Generated source is stale for channel or deployment');
  const files = validFiles(source.files);
  if (Object.keys(source.baseline).some(name => !Object.hasOwn(files, name))) conflict('Generated source file is missing');
  const binding = JSON.parse(files['src/release-config.json'] ?? 'null');
  const expectedBinding = { deploymentId: deployment.id, channelId: project.id, packageId: deployment.packageId,
    origin: new URL(endpoint).origin };
  if (JSON.stringify(binding) !== JSON.stringify(expectedBinding)) conflict('Release configuration differs from deployment');
  const manifest = files['manifest.toml'] ?? '';
  if (!manifest.includes(`id = "${deployment.packageId}"`) ||
    !/^min = "1\.2"$/m.test(manifest) || !/^target = "1\.2"$/m.test(manifest) ||
    !/^categories = \["com\.amazon\.category\.main"\]$/m.test(manifest) ||
    !manifest.includes(`id = "${deployment.packageId}.main"`)) conflict('Vega manifest identity or OS/category invalid');
  const packageJson = JSON.parse(files['package.json'] ?? 'null');
  if (packageJson?.dependencies?.['react-native'] !== '0.83.0' ||
    packageJson?.dependencies?.['@amazon-devices/react-native-kepler'] !== '~4.0.0' ||
    packageJson?.dependencies?.['@amazon-devices/react-native-w3cmedia'] !== '~2.3.2' ||
    JSON.parse(files['app.json'] ?? 'null')?.name !== `${deployment.packageId}.main`)
    conflict('Unsupported Vega package or app identity');
  const fileSha256 = Object.freeze(Object.fromEntries(Object.entries(files).map(([name, body]) => [name, sha256(body)])));
  const sourceHash = sha256(JSON.stringify(fileSha256));
  const identity = { format: 'firelaunch-vega-build-input-v1' as const, projectId: project.id,
    creatorAccountId: deployment.creatorAccountId, specRevision: project.revision,
    generatorFingerprint: generated.fingerprint, sourceRevision: source.specRevision,
    deploymentId: deployment.id, packageId: deployment.packageId, manifestEndpoint: endpoint,
    publishedRelease: Object.freeze({ ...release }), files, fileSha256, sourceHash };
  return Object.freeze({ ...identity, fingerprint: sha256(JSON.stringify({ ...identity, files: undefined })) });
}

/** The isolated worker calls this in its empty disposable directory. The hosted API never calls it. */
export async function materializeReleaseBuildInput(input: ReleaseBuildInput, destination: string): Promise<void> {
  if (!isAbsolute(destination)) invalid('Unsafe worker destination');
  let ancestor = resolve(destination);
  while (true) {
    const info = await lstat(ancestor).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    });
    if (info?.isSymbolicLink() || (info && !info.isDirectory())) invalid('Unsafe worker destination');
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length) conflict('Worker destination must be empty');
  if (sha256(JSON.stringify(input.fileSha256)) !== input.sourceHash ||
    sha256(JSON.stringify({ ...input, files: undefined, fingerprint: undefined })) !== input.fingerprint)
    conflict('Build input fingerprint changed');
  if (input.format !== 'firelaunch-vega-build-input-v1' || !/^ch_[a-f0-9]{32}$/.test(input.projectId) ||
    !/^cr_[a-f0-9]{32}$/.test(input.creatorAccountId) || !/^dep_[a-f0-9]{32}$/.test(input.deploymentId) ||
    !/^rel_[a-f0-9]{32}$/.test(input.publishedRelease.releaseId) ||
    !Number.isSafeInteger(input.publishedRelease.sequence) || input.publishedRelease.sequence < 1 ||
    validEndpoint(input.manifestEndpoint, input.deploymentId) !== input.manifestEndpoint)
    invalid('Invalid build input identity');
  const files = validFiles({ ...input.files });
  const binding = JSON.parse(files['src/release-config.json'] ?? 'null');
  if (JSON.stringify(binding) !== JSON.stringify({ deploymentId: input.deploymentId, channelId: input.projectId,
    packageId: input.packageId, origin: new URL(input.manifestEndpoint).origin }))
    conflict('Build input release binding changed');
  if (!(files['manifest.toml'] ?? '').includes(`id = "${input.packageId}"`))
    conflict('Build input package identity changed');
  for (const [name, body] of Object.entries(files)) {
    if (sha256(body) !== input.fileSha256[name]) conflict('Build input source changed');
  }
  if (Object.keys(files).length !== Object.keys(input.fileSha256).length) conflict('Build input source map changed');
  for (const [name, body] of Object.entries(files)) {
    const file = resolve(destination, name);
    if (relative(destination, file).startsWith('..') || relative(destination, file).startsWith(sep)) invalid('Unsafe worker source path');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body, { flag: 'wx' });
  }
}

export type NativeBuildEvidence = Readonly<{ inputFingerprint: string; sourceHash: string; command: readonly string[];
  target: 'x86_64'; buildType: 'Release'; toolchain: NativeToolchain; dependencyLockSha256: string;
  artifactPath: string; bytes: number; sha256: string;
  deploymentId: string; packageId: string; publishedRelease: ReleaseIdentity; inspectedPackageId: string }>;
export type NativeToolchain = Readonly<{ node: string; npm: string; vegaCli: string; vegaSdk: string }>;

/** SDK 0.24 autolinking adds only these pinned Kepler modules before [wants]. */
function sdkManifestOnlyAddedModules(original: string, built: string): boolean {
  const marker = '[wants]\n';
  const originalAt = original.indexOf(marker);
  const builtAt = built.indexOf(marker);
  if (originalAt < 0 || builtAt < 0 || original.indexOf(marker, originalAt + 1) >= 0 ||
    built.indexOf(marker, builtAt + 1) >= 0 || built.slice(builtAt) !== original.slice(originalAt)) return false;
  const prefix = original.slice(0, originalAt).trimEnd();
  if (!built.startsWith(prefix)) return false;
  const inserted = built.slice(prefix.length, builtAt);
  const modules = new Set([
    '/com.amazon.kepler.kepler_media_controls_1@IKeplerMediaControls_0',
    '/com.amazon.kepler.keplermediadescriptor_1@IKeplermediadescriptor_1',
    '/com.amazon.kepler.keplerscript_4@IKeplerScript_0',
    '/com.amazon.kepler.w3cmedia_2@IW3cmedia_3',
    '/com.amazon.kepler.async_storage__async_storage_2@IAsyncStorage__AsyncStorage_1',
    '/com.amazon.kepler.runtime.react_native_kepler_4@IReactNativeKepler_0'
  ]);
  const seen = new Set<string>();
  const remainder = inserted.replace(/\[\[needs\.module\]\]\n(id = "([^"\n]+)"\n)/g, (_block, _line, id: string) => {
    if (!modules.has(id) || seen.has(id)) return '!INVALID!';
    seen.add(id);
    return '';
  });
  return seen.size > 0 && /^\s*$/.test(remainder);
}

async function verifyMaterializedSource(input: ReleaseBuildInput, destination: string, rejectUnknown: boolean,
  allowSdkManifest = false): Promise<void> {
  const expected = new Set(Object.keys(input.files));
  async function visit(directory: string, prefix: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!prefix && ['node_modules', 'build', 'package-lock.json'].includes(entry.name)) continue;
      if (entry.isSymbolicLink()) conflict('Symlink in worker source');
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(join(directory, entry.name), name);
      else if (!entry.isFile() || !expected.has(name)) conflict('Unknown worker source file');
    }
  }
  if (rejectUnknown) await visit(destination, '');
  for (const [name, expectedHash] of Object.entries(input.fileSha256)) {
    const parts = name.split('/');
    let current = destination;
    for (const part of parts.slice(0, -1)) {
      current = join(current, part);
      const folder = await lstat(current);
      if (!folder.isDirectory() || folder.isSymbolicLink()) conflict(`Worker source directory changed: ${name}`);
    }
    const file = join(destination, name);
    const info = await lstat(file);
    const body = info.isFile() && !info.isSymbolicLink() ? await readFile(file) : null;
    if (!body || info.size > (isTrustedVegaAssetPath(name) ? TRUSTED_VEGA_ASSET_MAX_BYTES : 256_000) ||
      (sha256(body) !== expectedHash && !(allowSdkManifest && name === 'manifest.toml' &&
        sdkManifestOnlyAddedModules(input.files[name]!, body.toString('utf8')))))
      conflict(`Worker source changed after dependency or native build: ${name}`);
  }
}

/** Invoker is supplied only by the separately isolated worker; it executes fixed commands in cwd. */
export async function produceIsolatedRelease(input: ReleaseBuildInput, destination: string, toolchain: NativeToolchain,
  invoke: (command: readonly string[], cwd: string) => Promise<{ exitCode: number; startedAt: number; stdout?: string }>): Promise<NativeBuildEvidence> {
  if (!/^v24\./.test(toolchain.node) || !/^12\./.test(toolchain.npm) ||
    !/^\d+\.\d+\.\d+$/.test(toolchain.vegaCli) || !/^\d+\.\d+\.\d+$/.test(toolchain.vegaSdk))
    invalid('Supported Node 24, npm 12 and Vega toolchain identity required');
  await materializeReleaseBuildInput(input, destination);
  if ((await invoke(DEPENDENCY_LOCK_COMMAND, destination)).exitCode !== 0 ||
    (await invoke(DEPENDENCY_INSTALL_COMMAND, destination)).exitCode !== 0)
    conflict('Native dependency preparation failed');
  const lockFile = join(destination, 'package-lock.json');
  const lockInfo = await lstat(lockFile);
  if (!lockInfo.isFile() || lockInfo.isSymbolicLink()) conflict('Unsafe dependency lock');
  const lock = await readFile(lockFile);
  if (lock.length < 100 || lock.length > 8_000_000) conflict('Dependency lock is missing or oversized');
  const lockJson = JSON.parse(lock.toString('utf8'));
  const packageJson = JSON.parse(input.files['package.json']!);
  if (!isDeepStrictEqual(lockJson.packages?.['']?.dependencies, packageJson.dependencies) ||
    !isDeepStrictEqual(lockJson.packages?.['']?.devDependencies, packageJson.devDependencies))
    conflict('Installed dependency lock differs from source');
  const dependencyLockSha256 = sha256(lock);
  await verifyMaterializedSource(input, destination, true);
  const command = releaseBuildCommand(input);
  const result = await invoke(command, destination);
  if (result.exitCode !== 0) conflict('Native release build failed');
  await verifyMaterializedSource(input, destination, false, true);
  const build = join(destination, 'build');
  const found: string[] = [];
  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > 12) invalid('Build output nesting limit');
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) invalid('Symlink in native build output');
      const file = join(dir, entry.name);
      if (entry.isDirectory()) await visit(file, depth + 1);
      else if (entry.isFile() && entry.name.endsWith('.vpkg')) found.push(file);
    }
  }
  await visit(build, 0);
  const canonical = found.filter(file => file.includes(`${sep}x86_64${sep}Release${sep}`));
  if (canonical.length !== 1 || found.length > 2 || found.some(file =>
    file !== canonical[0] && !file.includes(`${sep}build${sep}x86_64-release${sep}`)))
    conflict('Fresh x86_64 Release VPKG not found');
  const file = canonical[0]!;
  const info = await stat(file);
  if (!info.isFile() || info.size < 1024 || info.size > 500_000_000 || info.mtimeMs < result.startedAt - 2000)
    conflict('Native artifact is empty, stale or oversized');
  const packageResult = await invoke([...VPT_INFO_COMMAND, file], destination);
  const validation = await invoke([...VPT_VALIDATE_COMMAND, file], destination);
  let packageInfo: { id?: unknown; build_number?: unknown; os_version_registry?: { os_versions?: unknown } };
  try { packageInfo = JSON.parse(packageResult.stdout ?? ''); }
  catch { return conflict('Native package inspection failed'); }
  if (packageResult.exitCode !== 0 || validation.exitCode !== 0 || packageInfo.id !== input.packageId ||
    packageInfo.build_number !== input.publishedRelease.sequence ||
    !Array.isArray(packageInfo.os_version_registry?.os_versions) ||
    !packageInfo.os_version_registry.os_versions.includes('1.2'))
    conflict('Native package identity, validation or OS differs from build input');
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  const artifactHash = digest.digest('hex');
  for (const copy of found.filter(candidate => candidate !== file)) {
    const copyInfo = await stat(copy);
    if (!copyInfo.isFile() || copyInfo.size !== info.size || copyInfo.mtimeMs < result.startedAt - 2000)
      conflict('Native output copy differs or is stale');
    const copyDigest = createHash('sha256');
    for await (const chunk of createReadStream(copy)) copyDigest.update(chunk);
    if (copyDigest.digest('hex') !== artifactHash) conflict('Native output copy differs');
  }
  return Object.freeze({ inputFingerprint: input.fingerprint, sourceHash: input.sourceHash,
    command, target: 'x86_64', buildType: 'Release', toolchain, dependencyLockSha256,
    artifactPath: relative(destination, file).split(sep).join('/'), bytes: info.size,
    sha256: artifactHash, deploymentId: input.deploymentId, packageId: input.packageId,
    publishedRelease: input.publishedRelease, inspectedPackageId: input.packageId });
}
