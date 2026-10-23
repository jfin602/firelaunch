import { createHash } from 'node:crypto';
import { releaseBuildCommand, type NativeBuildEvidence, type ReleaseBuildInput } from './release-build.js';
import { RepositoryError } from './repository.js';

const MAX_VPKG_BYTES = 500_000_000;
const sha256 = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const fail = (message: string): never => { throw new RepositoryError('CONFLICT', message); };

// ZIP store method is deliberate: the VPKG is already compressed and the archive
// can be inspected without invoking a shell, an archive extractor, or creator code.
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type Entry = { name: string; data: Buffer };
function zip(entries: Entry[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const filename = Buffer.from(name, 'utf8');
    const checksum = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, data);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x800, 8);
    record.writeUInt32LE(checksum, 16);
    record.writeUInt32LE(data.length, 20);
    record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(filename.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(record, filename);
    offset += header.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

export type NativeExport = Readonly<{ zip: Buffer; zipSha256: string; vpkgSha256: string; vpkgName: string }>;

/** Accept only bytes from an independently authenticated isolated worker receipt. */
export function createNativeExport(input: ReleaseBuildInput, evidence: NativeBuildEvidence, vpkg: Buffer): NativeExport {
  if (evidence.inputFingerprint !== input.fingerprint || evidence.sourceHash !== input.sourceHash ||
    evidence.deploymentId !== input.deploymentId || evidence.packageId !== input.packageId ||
    evidence.inspectedPackageId !== input.packageId || evidence.target !== 'x86_64' || evidence.buildType !== 'Release' ||
    evidence.publishedRelease.releaseId !== input.publishedRelease.releaseId ||
    evidence.publishedRelease.sequence !== input.publishedRelease.sequence ||
    JSON.stringify(evidence.command) !== JSON.stringify(releaseBuildCommand(input)) ||
    !/^[a-f0-9]{64}$/.test(evidence.dependencyLockSha256) ||
    !/^v24\.\d+\.\d+$/.test(evidence.toolchain.node) || !/^12\.\d+\.\d+$/.test(evidence.toolchain.npm) ||
    !/^\d+\.\d+\.\d+$/.test(evidence.toolchain.vegaCli) || !/^\d+\.\d+\.\d+$/.test(evidence.toolchain.vegaSdk) ||
    !evidence.artifactPath.endsWith('_x86_64.vpkg') || evidence.artifactPath.startsWith('/') ||
    evidence.artifactPath.split('/').some(part => part === '..' || part === '.' || !part) ||
    !Buffer.isBuffer(vpkg) || vpkg.length < 1024 || vpkg.length > MAX_VPKG_BYTES ||
    evidence.bytes !== vpkg.length || evidence.sha256 !== sha256(vpkg)) fail('Native worker artifact identity or checksum differs from build input');
  const vpkgName = `${input.packageId}_x86_64.vpkg`;
  const readme = Buffer.from(`# VegaLaunch Vega release\n\nPackage ID: ${input.packageId}\n\nThis ZIP contains the native x86_64 Release package. Verify SHA256SUMS before installing.\n\n1. Start Vega VirtualDevice and run \`vega device list\` to find its serial.\n2. Run \`vega device install-app --device <serial> --packagePath ${vpkgName}\`.\n3. Run \`vega device launch-app --device <serial> --appName ${input.packageId}.main\`.\n\nThe app reads its creator-approved published release from ${input.manifestEndpoint}. Device playback and Amazon submission require separate qualification.\n`);
  const info = Buffer.from(`${JSON.stringify({ format: 'vegalaunch-vega-export-v1', product: 'VegaLaunch', projectId: input.projectId,
    specRevision: input.specRevision, deploymentId: input.deploymentId, packageId: input.packageId,
    manifestEndpoint: input.manifestEndpoint, publishedRelease: input.publishedRelease,
    sourceHash: input.sourceHash, inputFingerprint: input.fingerprint,
    vpkg: { name: vpkgName, bytes: vpkg.length, sha256: evidence.sha256 },
    toolchain: evidence.toolchain, dependencyLockSha256: evidence.dependencyLockSha256 }, null, 2)}\n`);
  const sums = Buffer.from(`${sha256(vpkg)}  ${vpkgName}\n${sha256(readme)}  README.md\n${sha256(info)}  export-info.json\n`);
  const archive = zip([{ name: vpkgName, data: vpkg }, { name: 'README.md', data: readme },
    { name: 'export-info.json', data: info }, { name: 'SHA256SUMS', data: sums }]);
  verifyNativeExport(archive, vpkgName, evidence.sha256);
  return Object.freeze({ zip: archive, zipSha256: sha256(archive), vpkgSha256: evidence.sha256, vpkgName });
}

/** Strict, bounded verifier for the four uncompressed entries produced above. */
export function verifyNativeExport(archive: Buffer, vpkgName: string, expectedVpkgSha256: string): void {
  if (archive.length < 1024 || archive.length > MAX_VPKG_BYTES + 20_000 ||
    !/^[a-zA-Z0-9._-]+_x86_64\.vpkg$/.test(vpkgName) || !/^[a-f0-9]{64}$/.test(expectedVpkgSha256))
    fail('Invalid native export bounds');
  const expected = [vpkgName, 'README.md', 'export-info.json', 'SHA256SUMS'];
  const entries = new Map<string, Buffer>();
  let position = 0;
  const offsets: number[] = [];
  for (const name of expected) {
    if (position + 30 > archive.length || archive.readUInt32LE(position) !== 0x04034b50 ||
      archive.readUInt16LE(position + 8) !== 0 || archive.readUInt16LE(position + 6) !== 0x800 ||
      archive.readUInt16LE(position + 28) !== 0) fail('Invalid ZIP local header');
    const nameLength = archive.readUInt16LE(position + 26);
    const size = archive.readUInt32LE(position + 18);
    if (size !== archive.readUInt32LE(position + 22) || size > MAX_VPKG_BYTES ||
      archive.subarray(position + 30, position + 30 + nameLength).toString('utf8') !== name ||
      position + 30 + nameLength + size > archive.length) fail('Invalid ZIP entry');
    const body = archive.subarray(position + 30 + nameLength, position + 30 + nameLength + size);
    if (crc32(body) !== archive.readUInt32LE(position + 14)) fail('ZIP checksum differs');
    offsets.push(position);
    entries.set(name, body);
    position += 30 + nameLength + size;
  }
  const centralStart = position;
  for (const [index, name] of expected.entries()) {
    if (position + 46 > archive.length || archive.readUInt32LE(position) !== 0x02014b50 ||
      archive.readUInt16LE(position + 10) !== 0 || archive.readUInt16LE(position + 8) !== 0x800 ||
      archive.readUInt16LE(position + 30) !== 0 || archive.readUInt16LE(position + 32) !== 0 ||
      archive.readUInt16LE(position + 34) !== 0 || archive.readUInt32LE(position + 42) !== offsets[index])
      fail('Invalid ZIP directory');
    const nameLength = archive.readUInt16LE(position + 28);
    const body = entries.get(name)!;
    if (archive.subarray(position + 46, position + 46 + nameLength).toString('utf8') !== name ||
      archive.readUInt32LE(position + 20) !== body.length || archive.readUInt32LE(position + 24) !== body.length ||
      archive.readUInt32LE(position + 16) !== crc32(body)) fail('ZIP directory differs from entries');
    position += 46 + nameLength;
  }
  if (position + 22 !== archive.length || archive.readUInt32LE(position) !== 0x06054b50 ||
    archive.readUInt16LE(position + 8) !== 4 || archive.readUInt16LE(position + 10) !== 4 ||
    archive.readUInt32LE(position + 12) !== position - centralStart ||
    archive.readUInt32LE(position + 16) !== centralStart || archive.readUInt16LE(position + 20) !== 0)
    fail('Invalid ZIP end record or trailing content');
  if (sha256(entries.get(vpkgName)!) !== expectedVpkgSha256) fail('VPKG checksum differs');
  const sums = entries.get('SHA256SUMS')!.toString('utf8');
  if (sums !== `${expectedVpkgSha256}  ${vpkgName}\n${sha256(entries.get('README.md')!)}  README.md\n${sha256(entries.get('export-info.json')!)}  export-info.json\n`)
    fail('ZIP SHA256SUMS differs');
}
