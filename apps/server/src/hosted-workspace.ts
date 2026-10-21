import { createHash } from 'node:crypto';
import { generateProject } from '@firelaunch/generator';
import type { ChannelProject, ChannelDeployment } from '@firelaunch/contracts';
import { RepositoryError } from './repository.js';
import type { AuthenticatedPrincipal } from './auth/oidc.js';
import type { HostedProjectRepository } from './hosted-repository.js';
import { assertExportableMedia } from './hosted-media-policy.js';
import { PublicationRepository } from './publication-repository.js';
import { createReleaseBuildInput, type ReleaseBuildInput, type StoredSource } from './release-build.js';
import { isTrustedVegaAsset, isTrustedVegaAssetPath, TRUSTED_VEGA_ASSET_MAX_BYTES } from './trusted-vega-assets.js';

const textName = /\.(?:js|jsx|ts|tsx|json|toml|md|txt)$|^(?:README|LICENSE)$/i;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
async function optionalDeployment(repository: HostedProjectRepository, principal: AuthenticatedPrincipal, id: string) {
  try { return await repository.readDeployment(principal, id); }
  catch (error) {
    if (error instanceof RepositoryError && error.code === 'NOT_FOUND' && error.message === 'Deployment not found') return undefined;
    throw error;
  }
}
export const sourceMatchesBaseline = (content: string | undefined, baseline: string | undefined): boolean =>
  content !== undefined && baseline !== undefined && (/^sha256:[a-f0-9]{64}$/.test(baseline) ? hash(content) === baseline.slice(7) : content === baseline);
async function releaseSourceForApproved(source: Awaited<ReturnType<HostedProjectRepository['source']>>,
  approved: ChannelProject, deployment: ChannelDeployment): Promise<StoredSource> {
  const generated = await generateProject(approved.spec, deployment);
  if (source?.specRevision === approved.revision && source.fingerprint === generated.fingerprint) return source;
  if (source && [...new Set([...Object.keys(source.files), ...Object.keys(source.baseline)])].some(name =>
    !sourceMatchesBaseline(source.files[name], source.baseline[name])))
    throw new RepositoryError('CONFLICT', 'Custom generated files exist. Preserve edits before building the approved release.');
  // A newer private draft may have clean saved source. Build a separate,
  // immutable source snapshot from the approved release without changing it.
  const files = Object.fromEntries(generated.files);
  return { specRevision: approved.revision, fingerprint: generated.fingerprint,
    files, baseline: { ...files } };
}
function safeName(name: string): void {
  if (!name || name.length > 240 || name.includes('\\') || name.includes('\0') || name.startsWith('/') ||
    name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) ||
    !textName.test(name) && !isTrustedVegaAssetPath(name))
    throw new RepositoryError('INVALID_INPUT', 'Unsafe generated text file path');
}

export const NATIVE_EXPORT_BLOCKER = 'Native export is blocked: no separately isolated Vega build worker with verified host limits and artifact transport is configured. Ask the operator to provision and qualify that worker.';
const blockedBuild = { status: 'blocked' as const, reason: NATIVE_EXPORT_BLOCKER,
  toolchain: { missing: ['isolated hosted build'], node: { detail: 'Hosted build disabled' }, npm: { detail: 'Hosted build disabled' },
    vegaSdk: { detail: 'Hosted build disabled' }, vegaCli: { detail: 'Hosted build disabled' }, device: { detail: 'No device evidence' } } };

export class HostedWorkspaceService {
  constructor(private readonly repository: HostedProjectRepository,
    private readonly publication: Pick<PublicationRepository, 'currentSummary' | 'currentBuildSnapshot'> = new PublicationRepository(repository)) {}

  /** Internal worker submission contract. No hosted build route calls this in P1. */
  async releaseBuildInput(principal: AuthenticatedPrincipal, id: string): Promise<ReleaseBuildInput> {
    const project = await this.repository.read(principal, id);
    const deployment = await this.repository.readDeployment(principal, id);
    if (deployment.creatorAccountId !== principal.accountId) throw new RepositoryError('NOT_FOUND', 'Project not found');
    if (deployment.nativeReleaseApproval !== 'creator_approved')
      throw new RepositoryError('CONFLICT', 'Native deployment is not creator-approved');
    const release = await this.publication.currentSummary(principal, id, deployment.id);
    if (!release) throw new RepositoryError('CONFLICT', 'No creator-approved published release');
    const approved = await this.publication.currentBuildSnapshot(principal, id, deployment.id, release.releaseId);
    if (approved.revision !== release.revisions.channel)
      throw new RepositoryError('CONFLICT', 'Approved channel revision changed');
    assertExportableMedia(approved.channel);
    const approvedProject = { ...project, spec: approved.channel, revision: approved.revision };
    const source = await this.repository.source(principal, id);
    const releaseSource = await releaseSourceForApproved(source, approvedProject, deployment);
    const input = await createReleaseBuildInput(approvedProject, releaseSource, deployment,
      { releaseId: release.releaseId, sequence: release.sequence }, principal.accountId);
    // Repeat after assembling the snapshot. P2 must call this again before artifact acceptance/download.
    const current = await this.repository.read(principal, id);
    const currentDeployment = await this.repository.readDeployment(principal, id);
    if (currentDeployment.nativeReleaseApproval !== 'creator_approved')
      throw new RepositoryError('CONFLICT', 'Native deployment approval changed during snapshot');
    const currentSource = await this.repository.source(principal, id);
    const currentRelease = await this.publication.currentSummary(principal, id, currentDeployment.id);
    if (!currentRelease || currentRelease.releaseId !== release.releaseId)
      throw new RepositoryError('CONFLICT', 'Published release changed during snapshot');
    const currentApproved = await this.publication.currentBuildSnapshot(principal, id, currentDeployment.id, currentRelease.releaseId);
    if (currentApproved.revision !== currentRelease.revisions.channel)
      throw new RepositoryError('CONFLICT', 'Approved channel changed during snapshot');
    const currentApprovedProject = { ...current, spec: currentApproved.channel, revision: currentApproved.revision };
    const confirmed = await createReleaseBuildInput({ ...current, spec: currentApproved.channel, revision: currentApproved.revision },
      await releaseSourceForApproved(currentSource, currentApprovedProject, currentDeployment), currentDeployment,
      { releaseId: currentRelease.releaseId, sequence: currentRelease.sequence }, principal.accountId);
    if (confirmed.fingerprint !== input.fingerprint) throw new RepositoryError('CONFLICT', 'Build input changed during snapshot');
    return input;
  }

  async assertReleaseBuildInputCurrent(principal: AuthenticatedPrincipal, id: string, fingerprint: string): Promise<void> {
    const current = await this.releaseBuildInput(principal, id);
    if (current.fingerprint !== fingerprint) throw new RepositoryError('CONFLICT', 'Build input changed');
  }

  async overview(principal: AuthenticatedPrincipal, id: string) {
    const project = await this.repository.read(principal, id);
    const source = await this.repository.source(principal, id);
    if (!source) return { generated: false, files: [] as string[], changed: [] as string[], stale: false, path: null };
    const deployment = await optionalDeployment(this.repository, principal, id);
    const changed = [...new Set([...Object.keys(source.files), ...Object.keys(source.baseline)])]
      .filter(name => !sourceMatchesBaseline(source.files[name], source.baseline[name])).sort();
    return { generated: true, files: Object.keys(source.files).sort(), changed,
      stale: !!deployment && !deployment.manifestEndpoint ||
        source.fingerprint !== (await generateProject(project.spec, deployment)).fingerprint, path: null };
  }

  async generate(principal: AuthenticatedPrincipal, id: string) {
    const project = await this.repository.read(principal, id);
    assertExportableMedia(project.spec);
    const deployment = await optionalDeployment(this.repository, principal, id);
    const generated = await generateProject(project.spec, deployment ?? undefined);
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
    if (Buffer.byteLength(content) > (isTrustedVegaAssetPath(name) ? TRUSTED_VEGA_ASSET_MAX_BYTES : 256_000) ||
      isTrustedVegaAssetPath(name) && !isTrustedVegaAsset(name, content))
      throw new RepositoryError('STORAGE_ERROR', 'Generated text file is oversized or changed');
    return { path: name, content, sha256: hash(content) };
  }

  async save(principal: AuthenticatedPrincipal, id: string, name: string, content: string, expectedHash: string) {
    await this.repository.read(principal, id);
    safeName(name);
    if (isTrustedVegaAssetPath(name)) throw new RepositoryError('INVALID_INPUT', 'Bundled vendor source is read-only');
    if (Buffer.byteLength(content) > 256_000 || content.includes('\0')) throw new RepositoryError('INVALID_INPUT', 'Text edit exceeds size limit');
    await this.repository.saveSource(principal, id, name, content, expectedHash);
    return this.read(principal, id, name);
  }

  async exportSource(principal: AuthenticatedPrincipal, id: string) {
    const project = await this.repository.read(principal, id);
    assertExportableMedia(project.spec);
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

  async exportStatus(principal: AuthenticatedPrincipal, id: string) {
    await this.repository.read(principal, id);
    return { status: 'blocked' as const, reason: NATIVE_EXPORT_BLOCKER, job: null, downloadReady: false };
  }

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
    const featuredVideos = spec.content.filter(item => item.presentation === 'video').slice(0, 3).map(item => item.title).join(', ');
    const videoCount = spec.content.filter(item => item.presentation === 'video').length;
    const audioCount = spec.content.filter(item => item.presentation === 'audio').length;
    const bookCount = spec.content.filter(item => item.presentation === 'information').length;
    const experiences = [videoCount ? 'watch cleared videos' : '', audioCount ? 'listen to cleared audio' : '',
      bookCount ? 'open books for details' : ''].filter(Boolean);
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
        longDescription: `Explore ${title} on Fire TV. Browse ${sections || 'the channel'} with your remote.${featuredVideos ? ` Discover featured videos including ${featuredVideos}.` : ''}${experiences.length ? ` Select a title to ${experiences.join(', or ')}.` : ''}`,
        releaseNotes: `Initial release of ${title}: TV-first browsing${experiences.length ? ` to ${experiences.join(', or ')}` : ''}.` },
      assets: { artwork, unresolvedLocal: artwork.filter(value => value.startsWith('assets/')), screenshots: [] as string[] },
      build: blockedBuild, generatedPath: null, submitted: false as const
    };
  }

  async bundle(principal: AuthenticatedPrincipal, id: string) {
    await this.repository.read(principal, id);
    return { status: 'blocked' as const, reason: 'Hosted submission bundles require private export storage; no bundle was created', submitted: false as const };
  }
}
