import { createHash } from 'node:crypto';
import { generateProject } from '@firelaunch/generator';
import { RepositoryError } from './repository.js';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';

const textName = /\.(?:js|jsx|ts|tsx|json|toml|md|txt)$|^(?:README|LICENSE)$/i;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const sourceMatchesBaseline = (content: string | undefined, baseline: string | undefined): boolean =>
  content !== undefined && baseline !== undefined && (/^sha256:[a-f0-9]{64}$/.test(baseline) ? hash(content) === baseline.slice(7) : content === baseline);
function safeName(name: string): void {
  if (!name || name.length > 240 || name.includes('\\') || name.includes('\0') || name.startsWith('/') ||
    name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) || !textName.test(name))
    throw new RepositoryError('INVALID_INPUT', 'Unsafe generated text file path');
}

const blockedBuild = { status: 'blocked' as const, reason: 'Hosted Vega builds require an isolated build service',
  toolchain: { missing: ['isolated hosted build'], node: { detail: 'Hosted build disabled' }, npm: { detail: 'Hosted build disabled' },
    vegaSdk: { detail: 'Hosted build disabled' }, vegaCli: { detail: 'Hosted build disabled' }, device: { detail: 'No device evidence' } } };

export class HostedWorkspaceService {
  constructor(private readonly repository: HostedProjectRepository) {}

  async overview(principal: AuthenticatedPrincipal, id: string) {
    const project = await this.repository.read(principal, id);
    const source = await this.repository.source(principal, id);
    if (!source) return { generated: false, files: [] as string[], changed: [] as string[], stale: false, path: null };
    const changed = [...new Set([...Object.keys(source.files), ...Object.keys(source.baseline)])]
      .filter(name => !sourceMatchesBaseline(source.files[name], source.baseline[name])).sort();
    return { generated: true, files: Object.keys(source.files).sort(), changed,
      stale: source.fingerprint !== (await generateProject(project.spec)).fingerprint, path: null };
  }

  async generate(principal: AuthenticatedPrincipal, id: string) {
    const project = await this.repository.read(principal, id);
    const generated = await generateProject(project.spec);
    const files = Object.fromEntries(generated.files);
    const baseline = Object.fromEntries([...generated.files].map(([name, content]) => [name, content]));
    await this.repository.generateSource(principal, id, project.revision, generated.fingerprint, files, baseline);
    return this.overview(principal, id);
  }

  async read(principal: AuthenticatedPrincipal, id: string, name: string) {
    await this.repository.read(principal, id);
    safeName(name);
    const source = await this.repository.source(principal, id);
    const content = source?.files[name];
    if (content === undefined) throw new RepositoryError('NOT_FOUND', 'Generated text file not found');
    if (Buffer.byteLength(content) > 256_000) throw new RepositoryError('STORAGE_ERROR', 'Generated text file too large');
    return { path: name, content, sha256: hash(content) };
  }

  async save(principal: AuthenticatedPrincipal, id: string, name: string, content: string, expectedHash: string) {
    await this.repository.read(principal, id);
    safeName(name);
    if (Buffer.byteLength(content) > 256_000 || content.includes('\0')) throw new RepositoryError('INVALID_INPUT', 'Text edit exceeds size limit');
    await this.repository.saveSource(principal, id, name, content, expectedHash);
    return this.read(principal, id, name);
  }

  async exportSource(principal: AuthenticatedPrincipal, id: string) {
    const project = await this.repository.read(principal, id);
    const source = await this.repository.source(principal, id);
    if (!source) throw new RepositoryError('NOT_FOUND', 'Generated source not found');
    const files = Object.fromEntries(Object.entries(source.files).sort(([a], [b]) => a.localeCompare(b)));
    const sha256 = Object.fromEntries(Object.entries(files).map(([name, content]) => [name, hash(content)]));
    return { format: 'firelaunch-source-export-v1' as const, projectId: project.id, revision: project.revision,
      generatorFingerprint: source.fingerprint, rights: 'No media or artwork license is inferred by this export',
      sha256, files };
  }

  async buildStatus(principal: AuthenticatedPrincipal, id: string) {
    await this.repository.read(principal, id);
    return blockedBuild;
  }

  async build(principal: AuthenticatedPrincipal, id: string) { return this.buildStatus(principal, id); }

  async readiness(principal: AuthenticatedPrincipal, id: string) {
    const project = await this.repository.read(principal, id);
    const code = await this.overview(principal, id);
    const spec = project.spec;
    const title = spec.title;
    const artwork = [...new Set([spec.brand.logo, spec.brand.heroArtwork, ...spec.content.map(item => item.artwork)]
      .filter((value): value is string => !!value))];
    const manifest = code.generated ? (await this.read(principal, id, 'manifest.toml')).content : '';
    const manifestReady = /^\[\[components\.interactive\]\]$/m.test(manifest) &&
      /^\s*categories\s*=\s*\[[^\]]*"com\.amazon\.category\.main"[^\]]*\]/m.test(manifest) &&
      !code.changed.some(name => ['manifest.toml', 'package.json', 'firelaunch.json'].includes(name));
    const sections = spec.pages.map(page => page.title).join(', ');
    const featured = spec.content.slice(0, 3).map(item => item.title).join(', ');
    return {
      checks: [
        { group: 'Channel/schema', ready: true, detail: `ChannelSpec revision ${project.revision} validates` },
        { group: 'TV experience', ready: false, detail: 'Preview is not Vega simulator or device evidence' },
        { group: 'Manifest/project', ready: code.generated && !code.stale && manifestReady,
          detail: !code.generated ? 'Generate Vega source' : code.stale ? 'Regenerate to match current channel' :
            manifestReady ? 'Generated manifest contains the main category; verify assets and source' : 'Manifest or project metadata changed; verify before submission' },
        { group: 'Build artifact', ready: false, detail: blockedBuild.reason },
        { group: 'Store assets/copy', ready: false, detail: `Review copy and rights for ${artwork.length} artwork reference(s); supply icon and device screenshots` },
        { group: 'Support/privacy metadata', ready: false, detail: 'Creator must provide support contact, privacy policy and rights declarations' },
        { group: 'Device evidence', ready: false, detail: 'No Vega device evidence has been recorded' },
        { group: 'Human Amazon steps', ready: false, detail: 'Creator submission has not occurred' }
      ],
      copy: { appName: title, shortDescription: `Explore ${title} on your TV`.slice(0, 80),
        longDescription: `Explore ${title} on Fire TV. Browse ${sections || 'the channel'} with your remote.${featured ? ` Discover featured videos including ${featured}.` : ''} Select a title for details and playback.`,
        releaseNotes: `Initial release of ${title}: TV-first browsing${spec.content.length ? ` with ${spec.content.length} video${spec.content.length === 1 ? '' : 's'}` : ''} and playback.` },
      assets: { artwork, unresolvedLocal: artwork.filter(value => value.startsWith('assets/')), screenshots: [] as string[] },
      build: blockedBuild, generatedPath: null, submitted: false as const
    };
  }

  async bundle(principal: AuthenticatedPrincipal, id: string) {
    await this.repository.read(principal, id);
    return { status: 'blocked' as const, reason: 'Hosted submission bundles require private export storage; no bundle was created', submitted: false as const };
  }
}
