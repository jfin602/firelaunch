import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isIP } from 'node:net';
import { channelDeploymentSchema, channelSpecSchema, type ChannelSpec, type ChannelDeployment } from '@firelaunch/contracts';
import { televisionFromSpec } from '@firelaunch/tv';

export const TEMPLATE_VERSION = '0.0.3';
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

export async function generateProject(spec: ChannelSpec, deployment?: ChannelDeployment): Promise<GeneratedProject> {
  const valid = channelSpecSchema.parse(spec);
  const bound = deployment ? channelDeploymentSchema.parse(deployment) : undefined;
  if (bound && (bound.projectId !== valid.id || bound.channelId !== valid.id)) throw new Error('Deployment differs from channel');
  let origin: string | undefined;
  if (bound) {
    if (!bound.manifestEndpoint) throw new Error('Bound deployment needs a pinned HTTPS resolver');
    const endpoint = new URL(bound.manifestEndpoint);
    origin = endpoint.origin;
    const host = endpoint.hostname.toLowerCase().replace(/\.$/, '');
    if (isIP(host) || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host.endsWith('.internal') || (endpoint.port && endpoint.port !== '443')) throw new Error('Unsafe deployment resolver origin');
    if (endpoint.search || endpoint.hash || (endpoint.pathname !== '/' &&
      endpoint.pathname !== `/public/v1/deployments/${bound.id}/current`)) throw new Error('Invalid deployment resolver endpoint');
  }
  const bundled = bound ? channelSpecSchema.parse({ ...valid,
    brand: { ...valid.brand, logo: undefined, heroArtwork: undefined }, navigation: [valid.navigation[0]],
    pages: [{ id: valid.navigation[0], title: 'Channel', modules: [{ id: `mod_${'0'.repeat(32)}`,
      kind: 'text', title: 'Offline', body: 'Connect to load this channel.' }] }], content: [] }) : valid;
  const tv = televisionFromSpec(bundled);
  const files = await templateFiles(templateRoot);
  const runtime = (await readFile(runtimeFile, 'utf8')).replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n');
  const templateHash = createHash('sha256');
  for (const [name, body] of files) templateHash.update(name).update('\0').update(body).update('\0');
  templateHash.update('src/tv-runtime.js').update('\0').update(runtime);
  const templateFingerprint = templateHash.digest('hex');
  const publicBinding = bound ? { deploymentId: bound.id, channelId: valid.id, packageId: bound.packageId, origin } : null;
  const fingerprint = createHash('sha256').update(TEMPLATE_VERSION).update('\0')
    .update(templateFingerprint).update('\0').update(JSON.stringify(valid)).update('\0').update(JSON.stringify(publicBinding)).digest('hex');
  const appName = `FireLaunch ${valid.title}`;
  const packageName = `firelaunch-${valid.slug}`;
  const applicationId = bound?.packageId ?? `com.firelaunch.channel.${valid.id}`;
  files.set('package.json', json({ name: packageName, version: TEMPLATE_VERSION, private: true, scripts: {
    start: 'react-native start', 'build:release': 'react-native build-vega --build-type Release'
  }, dependencies: { 'react-native': '0.83.0', '@amazon-devices/react-native-kepler': '~4.0.0',
    react: '19.2.0', '@amazon-devices/react-native-w3cmedia': '~2.3.2',
    '@xmldom/xmldom': '0.8.15', 'base-64': '1.0.0',
    'fastestsmallesttextencoderdecoder': '1.0.22',
    ...(bound ? {
      '@react-native-async-storage/async-storage': 'npm:@amazon-devices/react-native-async-storage__async-storage@2.1.9000000000',
      zod: '4.6.5'
    } : {}) },
  devDependencies: { '@amazon-devices/kepler-cli-platform': '^0', '@types/react': '^19.2.0',
    '@react-native-community/cli': '20.0.0', '@react-native/babel-preset': '0.83.0',
    '@react-native/metro-config': '0.83.0',
    ...(bound ? { '@babel/plugin-transform-export-namespace-from': '7.29.7' } : {}) },
  kepler: { projectType: 'application', appName: packageName, targets: ['tv'] } }));
  files.set('app.json', json({ name: `${applicationId}.main`, displayName: appName }));
  files.set('manifest.toml', files.get('manifest.toml')!
    .replaceAll('FIRELAUNCH_APP_ID', JSON.stringify(applicationId))
    .replaceAll('FIRELAUNCH_COMPONENT_ID', JSON.stringify(`${applicationId}.main`))
    .replaceAll('FIRELAUNCH_APP_NAME', JSON.stringify(appName)));
  files.set('src/tv-runtime.js', runtime);
  files.set('src/channel.json', json(tv));
  if (bound) {
    files.set('babel.config.js', `module.exports = {\n  presets: ['module:@react-native/babel-preset'],\n  plugins: ['@babel/plugin-transform-export-namespace-from']\n};\n`);
    files.set('src/release-config.json', json(publicBinding));
    files.set('src/release-client.js', `import AsyncStorage from '@react-native-async-storage/async-storage';\nimport config from './release-config.json';\nimport { createChannelLoader } from './remote-release';\n\nexport function installRelease(bundled, onChannel) {\n  const loader = createChannelLoader(config, bundled, { storage: AsyncStorage, onChannel });\n  loader.start();\n  const interval = setInterval(() => loader.refresh(), 60_000);\n  return () => clearInterval(interval);\n}\n`);
  } else for (const name of ['src/release-config.json', 'src/remote-release.js', 'src/sha256.js']) files.delete(name);
  files.set('firelaunch.json', json({ generatorVersion: TEMPLATE_VERSION, schemaVersion: valid.schemaVersion,
    channelId: valid.id, fingerprint, templateFingerprint,
    unresolvedAssets: [...new Set([bundled.brand.logo, bundled.brand.heroArtwork, ...bundled.content.map(item => item.artwork)]
      .filter((asset): asset is string => typeof asset === 'string' && asset.startsWith('assets/')))].sort() }));
  return { fingerprint, files };
}

export async function writeGeneratedProject(spec: ChannelSpec, destination: string, deployment?: ChannelDeployment): Promise<GeneratedProject> {
  if (!isAbsolute(destination)) throw new Error('Destination must be absolute');
  const project = await generateProject(spec, deployment);
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
