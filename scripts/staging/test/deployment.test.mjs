import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scriptDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = path.join(scriptDir, 'lib.sh');
const run = (command, args = []) => spawnSync('bash', ['-c', `source "$1"; shift; ${command}`, '--', lib, ...args], { encoding: 'utf8' });

test('schema inspection rejects gaps and sees the candidate migration ceiling', () => {
  const repo = path.resolve(scriptDir, '..', '..');
  const actual = run('schema_max "$1"', [repo]);
  assert.equal(actual.status, 0, actual.stderr);
  assert.equal(actual.stdout.trim(), '13');
  const root = mkdtempSync(path.join(tmpdir(), 'firelaunch-schema-'));
  try {
    const migrations = path.join(root, 'apps/server/migrations');
    mkdirSync(migrations, { recursive: true });
    writeFileSync(path.join(migrations, '001_first.up.sql'), 'SELECT 1;');
    writeFileSync(path.join(migrations, '003_third.up.sql'), 'SELECT 3;');
    assert.notEqual(run('schema_max "$1"', [root]).status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('rollback gate refuses the observed migration 13 to binary ceiling 10', () => {
  assert.equal(run('rollback_schema_safe 10 10').status, 0);
  assert.notEqual(run('rollback_schema_safe 13 10').status, 0);
  assert.notEqual(run('rollback_schema_safe invalid 13').status, 0);
});

test('release link switch is confined to versioned staging releases', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'firelaunch-links-'));
  const oldName = '20261011T163833Z-aaaaaaaaaaaa';
  const newName = '20261016T120000Z-bbbbbbbbbbbb';
  const old = path.join(root, 'releases', oldName);
  const newer = path.join(root, 'releases', newName);
  try {
    mkdirSync(old, { recursive: true });
    mkdirSync(newer);
    symlinkSync(old, path.join(root, 'current'));
    const changed = run('base="$1"; switch_release "$2"; set_previous "$3"', [root, newName, old]);
    assert.equal(changed.status, 0, changed.stderr);
    assert.equal(readlinkSync(path.join(root, 'current')), newer);
    assert.equal(readlinkSync(path.join(root, 'previous')), old);
    const legacyName = '20261011T163833Z';
    const legacy = path.join(root, 'releases', legacyName);
    mkdirSync(legacy);
    const restored = run('base="$1"; switch_release "$2"', [root, legacyName]);
    assert.equal(restored.status, 0, restored.stderr);
    assert.equal(readlinkSync(path.join(root, 'current')), legacy);
    assert.notEqual(run('base="$1"; switch_release ../outside', [root]).status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('archive validation rejects traversal and escaping links', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'firelaunch-archive-'));
  try {
    const bad = path.join(root, 'bad.tar.gz');
    execFileSync('python3', ['-c', `import io,tarfile,sys
with tarfile.open(sys.argv[1],'w:gz') as t:
 b=b'x'; i=tarfile.TarInfo('../escape'); i.size=len(b); t.addfile(i,io.BytesIO(b))`, bad]);
    assert.notEqual(run('validate_archive "$1"', [bad]).status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
