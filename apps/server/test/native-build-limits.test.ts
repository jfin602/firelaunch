import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNativeBuildLimits } from '../src/native-build-limits.js';

test('effective CPU, RAM, PID and disk limits reject unlimited or oversized values', () => {
  const allowed = ['150000 100000','2147483648','128',12_000_000_000] as const;
  assert.doesNotThrow(() => assertNativeBuildLimits(...allowed));
  for (const values of [
    ['max 100000',allowed[1],allowed[2],allowed[3]],
    ['300000 100000',allowed[1],allowed[2],allowed[3]],
    [allowed[0],'max',allowed[2],allowed[3]],
    [allowed[0],'4000000000',allowed[2],allowed[3]],
    [allowed[0],allowed[1],'max',allowed[3]],
    [allowed[0],allowed[1],'129',allowed[3]],
    [allowed[0],allowed[1],allowed[2],116_000_000_000]
  ] as [string,string,string,number][]) {
    assert.throws(() => assertNativeBuildLimits(...values));
  }
});
