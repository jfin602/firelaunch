import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const obsolete = new RegExp(['fire', 'launch'].join('[-_ ]?'), 'i');
const roots = ['apps', 'packages', 'templates', 'scripts', 'test'];
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

test('active source, templates and scripts use canonical product naming', () => {
  assert.deepEqual(roots.flatMap(inspect), []);
});
