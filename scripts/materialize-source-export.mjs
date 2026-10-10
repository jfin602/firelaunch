#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const [input, output] = process.argv.slice(2);
const textName = /\.(?:js|jsx|ts|tsx|json|toml|md|txt)$|^(?:README|LICENSE)$/i;
if (!input || !output || process.argv.length !== 4) throw new Error('Usage: node scripts/materialize-source-export.mjs EXPORT.json EMPTY_DIRECTORY');
const bundle = JSON.parse(await readFile(input, 'utf8'));
if (bundle.format !== 'firelaunch-source-export-v1' || !/^ch_[a-f0-9]{32}$/.test(bundle.projectId) ||
  !Number.isSafeInteger(bundle.revision) || bundle.revision < 1 || !/^[a-f0-9]{64}$/.test(bundle.generatorFingerprint) ||
  !bundle.files || !bundle.sha256 || typeof bundle.files !== 'object' || Array.isArray(bundle.files) ||
  typeof bundle.sha256 !== 'object' || Array.isArray(bundle.sha256)) throw new Error('Invalid source export');
const names = Object.keys(bundle.files);
if (names.length > 400 || names.length !== Object.keys(bundle.sha256).length) throw new Error('Invalid source export inventory');
for (const name of names) {
  if (!name || name.length > 240 || name.includes('\\') || name.startsWith('/') || name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) || !textName.test(name) ||
    typeof bundle.files[name] !== 'string' || Buffer.byteLength(bundle.files[name]) > 256_000 ||
    createHash('sha256').update(bundle.files[name]).digest('hex') !== bundle.sha256[name]) throw new Error(`Invalid source export file: ${name}`);
}
if (Object.keys(bundle.sha256).some(name => !Object.hasOwn(bundle.files, name))) throw new Error('Invalid source export hash inventory');
const root = path.resolve(output);
let directory = path.parse(root).root;
for (const part of root.slice(directory.length).split(path.sep).filter(Boolean)) {
  directory = path.join(directory, part);
  try { await mkdir(directory); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Output path contains a symlink or non-directory');
}
if ((await readdir(root)).length) throw new Error('Output directory must be empty');
for (const name of names) {
  const file = path.join(root, name);
  await mkdir(path.dirname(file), { recursive: true });
  const handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(bundle.files[name]); } finally { await handle.close(); }
}
process.stdout.write(`Verified ${names.length} files for ${bundle.projectId} revision ${bundle.revision}\n`);
