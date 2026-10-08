import assert from 'node:assert/strict';
import test from 'node:test';
import { doctor, type DoctorProbe } from '../src/doctor.js';

const missing: DoctorProbe = { env: {}, exists: () => false, command: () => null };

test('reports missing tooling without claiming build readiness', () => {
  const report = doctor(missing);
  assert.equal(report.buildReady, false);
  assert.deepEqual(report.missing, ['Node', 'npm', 'ADBT context', 'Vega SDK', 'Vega CLI', 'adb', 'device/simulator']);
});

test('reports observed commands and authorized devices, not inferred SDK identity', () => {
  const report = doctor({ env: { VEGA_SDK_PATH: '/sdk', ADBT_CONTEXT_PATH: '/adbt' }, exists: () => true,
    command: (name, args) => ({ status: 0, stdout: name === 'adb' && args[0] === 'devices'
      ? 'List of devices attached\nABC\tdevice\nOFF\toffline\n' : `${name} 1.0`, stderr: '' }) });
  assert.deepEqual(report.missing, ['Node', 'npm', 'Vega CLI']);
  assert.equal(report.device.detail, 'ABC');
  assert.equal(report.buildReady, false);
  assert.match(report.vegaSdk.detail, /unverified/);
});

test('recognizes repository-required Node and npm versions', () => {
  const report = doctor({ ...missing, command: name => ({ status: 0,
    stdout: name === 'node' ? 'v24.21.0' : name === 'npm' ? '12.2.0' : 'version unknown', stderr: '' }) });
  assert.equal(report.node.available, true);
  assert.equal(report.npm.available, true);
  assert.equal(report.buildReady, false);
});

test('does not treat an arbitrary executable as a verified Vega SDK CLI', () => {
  const report = doctor({ env: { VEGA_CLI_PATH: '/tools/unknown' }, exists: () => true,
    command: () => ({ status: 0, stdout: 'graphing tool version 1', stderr: '' }) });
  assert.equal(report.vegaCli.available, false);
  assert.ok(report.missing.includes('Vega CLI'));
});
