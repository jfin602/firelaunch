import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const obsolete = /fire[-_ ]?launch/i;
const ignored = new Set(['node_modules', 'dist', 'build', '.git']);

function inspect(directory: string): string[] {
  const hits: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (obsolete.test(entry.name)) hits.push(path);
    if (entry.isDirectory()) hits.push(...inspect(path));
    else if (entry.isFile()) {
      const bytes = readFileSync(path);
      if (!bytes.includes(0) && obsolete.test(bytes.toString('utf8'))) hits.push(path);
    }
  }
  return hits;
}

test('Studio, TV presentation and generated metadata use VegaLaunch', () => {
  const surfaces = ['apps/studio/src', 'apps/studio/public', 'packages/generator/src', 'packages/tv/src'];
  const hits = surfaces.flatMap(inspect);
  // Existing drafts use this browser storage key. Moving it would strand unsaved edits.
  assert.deepEqual(hits, ['apps/studio/src/video-pages.ts']);
  assert.match(readFileSync('apps/studio/index.html', 'utf8'), /<title>VegaLaunch Studio<\/title>/);
  assert.match(readFileSync('apps/server/src/native-export.ts', 'utf8'), /format: 'vegalaunch-vega-export-v1', product: 'VegaLaunch'/);
  assert.match(readFileSync('apps/server/src/hosted-workspace.ts', 'utf8'), /format: 'vegalaunch-source-export-v1'/);
});

test('persisted database, session and staging identifiers stay compatible', () => {
  assert.match(readFileSync('apps/server/src/hosted-repository.ts', 'utf8'), /firelaunch_schema_migrations/);
  assert.match(readFileSync('apps/server/src/native-build-queue.ts', 'utf8'), /firelaunch_build\.jobs/);
  assert.match(readFileSync('apps/server/src/auth/sessions.ts', 'utf8'), /__Host-firelaunch_session/);
  assert.match(readFileSync('scripts/staging/lib.sh', 'utf8'), /base=\/srv\/firelaunch/);
});
