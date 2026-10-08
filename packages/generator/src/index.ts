import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { channelSpecSchema, type ChannelSpec } from '@firelaunch/contracts';
import { televisionFromSpec } from '@firelaunch/tv';

export const TEMPLATE_VERSION = '0.0.2';
const templateRoot = fileURLToPath(new URL('../../../templates/vega-channel/', import.meta.url));
const runtimeFile = fileURLToPath(new URL('../../tv/dist/runtime.js', import.meta.url));
export type GeneratedProject = { fingerprint: string; files: ReadonlyMap<string, string> };

async function templateFiles(root: string, prefix = ''): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for (const entry of (await readdir(join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = join(prefix, entry.name);
    if (entry.isDirectory()) for (const [key, value] of await templateFiles(root, name)) files.set(key, value);
    else if (entry.isFile()) files.set(name.split(sep).join('/'), await readFile(join(root, name), 'utf8'));
    else throw new Error(`Unsupported template entry: ${name}`);
  }
  return files;
}

function json(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }

export async function generateProject(spec: ChannelSpec): Promise<GeneratedProject> {
  const valid = channelSpecSchema.parse(spec);
  const tv = televisionFromSpec(valid);
  const files = await templateFiles(templateRoot);
  const runtime = (await readFile(runtimeFile, 'utf8')).replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n');
  const templateHash = createHash('sha256');
  for (const [name, body] of files) templateHash.update(name).update('\0').update(body).update('\0');
  templateHash.update('src/tv-runtime.js').update('\0').update(runtime);
  const templateFingerprint = templateHash.digest('hex');
  const fingerprint = createHash('sha256').update(TEMPLATE_VERSION).update('\0')
    .update(templateFingerprint).update('\0').update(JSON.stringify(valid)).digest('hex');
  const appName = `FireLaunch ${valid.title}`;
  const packageName = `firelaunch-${valid.slug}`;
  const applicationId = `com.firelaunch.channel.${valid.id}`;
  files.set('package.json', json({ name: packageName, version: TEMPLATE_VERSION, private: true, scripts: {
    start: 'react-native start'
  }, dependencies: { 'react-native': 'npm:@amazon-devices/react-native-kepler@4.0.1', react: '19.2.0',
    '@amazon-devices/kepler-cli-platform': '0.22.14',
    '@amazon-devices/react-native-w3cmedia': '2.3.2' }, devDependencies: { '@types/react': '^19.1.1',
      '@react-native/babel-preset': '0.83.0', '@react-native/metro-config': '0.83.0' } }));
  files.set('manifest.toml', files.get('manifest.toml')!
    .replaceAll('FIRELAUNCH_APP_ID', JSON.stringify(applicationId))
    .replaceAll('FIRELAUNCH_COMPONENT_ID', JSON.stringify(`${applicationId}.main`))
    .replaceAll('FIRELAUNCH_APP_NAME', JSON.stringify(appName)));
  files.set('src/tv-runtime.js', runtime);
  files.set('src/channel.json', json(tv));
  files.set('firelaunch.json', json({ generatorVersion: TEMPLATE_VERSION, schemaVersion: valid.schemaVersion,
    channelId: valid.id, fingerprint, templateFingerprint,
    unresolvedAssets: [...new Set([valid.brand.logo, valid.brand.heroArtwork, ...valid.content.map(item => item.artwork)]
      .filter((asset): asset is string => typeof asset === 'string' && asset.startsWith('assets/')))].sort() }));
  return { fingerprint, files };
}

export async function writeGeneratedProject(spec: ChannelSpec, destination: string): Promise<GeneratedProject> {
  if (!isAbsolute(destination)) throw new Error('Destination must be absolute');
  const project = await generateProject(spec);
  try {
    const status = await lstat(destination);
    if (!status.isDirectory() || status.isSymbolicLink() || (await readdir(destination)).length > 0) {
      throw new Error('Destination must be an empty, non-symlink directory');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await mkdir(destination, { recursive: true });
  }
  for (const [name, body] of project.files) {
    const path = resolve(destination, name);
    if (relative(destination, path).startsWith('..') || relative(destination, path).startsWith(sep)) {
      throw new Error(`Unsafe output path: ${name}`);
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: 'wx' });
  }
  return project;
}
