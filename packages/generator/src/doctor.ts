import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';

export type ToolStatus = { available: boolean; detail: string };
export type ToolchainReport = {
  node: ToolStatus; npm: ToolStatus; adbt: ToolStatus; vegaSdk: ToolStatus;
  vegaCli: ToolStatus; adb: ToolStatus; device: ToolStatus;
  missing: string[]; buildReady: false;
};
export type DoctorProbe = {
  command: (name: string, args: string[]) => { status: number | null; stdout: string; stderr: string } | null;
  exists: (path: string) => boolean;
  env: NodeJS.ProcessEnv;
};

function executable(name: string, env: NodeJS.ProcessEnv): string | undefined {
  for (const directory of (env.PATH ?? '').split(delimiter)) {
    if (directory && existsSync(join(directory, name))) return join(directory, name);
  }
  return undefined;
}

export function doctor(probe: DoctorProbe = {
  command: (name, args) => {
    const path = executable(name, process.env);
    if (!path) return null;
    const result = spawnSync(path, args, { encoding: 'utf8', timeout: 3000, maxBuffer: 65536 });
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }, exists: existsSync, env: process.env
}): ToolchainReport {
  const check = (name: string, args = ['--version']): ToolStatus => {
    const result = probe.command(name, args);
    return result?.status === 0 ? { available: true, detail: (result.stdout || result.stderr).trim() || 'Command succeeded' }
      : { available: false, detail: result ? `Exit ${result.status}: ${(result.stderr || result.stdout).trim()}` : `${name} not on PATH` };
  };
  const nodeVersion = check('node');
  const nodeMatch = /^v?(\d+)\.(\d+)\./.exec(nodeVersion.detail);
  const node = nodeVersion.available && nodeMatch && Number(nodeMatch[1]) === 24 && Number(nodeMatch[2]) >= 15
    ? nodeVersion : { available: false, detail: `${nodeVersion.detail}; requires Node >=24.15 <25` };
  const npmVersion = check('npm');
  const npmMatch = /^(\d+)\./.exec(npmVersion.detail);
  const npm = npmVersion.available && npmMatch && Number(npmMatch[1]) === 12
    ? npmVersion : { available: false, detail: `${npmVersion.detail}; requires npm >=12 <13` };
  const sdkPath = probe.env.VEGA_SDK_PATH;
  const vegaSdk = sdkPath && probe.exists(sdkPath)
    ? { available: true, detail: `VEGA_SDK_PATH=${sdkPath} (directory/path exists; SDK identity unverified)` }
    : { available: false, detail: sdkPath ? `VEGA_SDK_PATH missing: ${sdkPath}` : 'VEGA_SDK_PATH not set; SDK installation unverified' };
  const cliPath = probe.env.VEGA_CLI_PATH;
  const cliResult = cliPath && probe.exists(cliPath) ? probe.command(cliPath, ['--help']) : null;
  const vegaCli = cliResult?.status === 0 && /Amazon|Vega SDK/i.test(cliResult.stdout + cliResult.stderr)
    ? { available: true, detail: `${cliPath}: ${(cliResult.stdout || cliResult.stderr).trim().slice(0, 200)}` }
    : { available: false, detail: cliPath ? `VEGA_CLI_PATH=${cliPath}; SDK CLI identity not verified`
      : 'No verified Vega SDK CLI configured (VEGA_CLI_PATH not set)' };
  const adb = check('adb');
  const devices = adb.available ? probe.command('adb', ['devices']) : null;
  const serials = devices?.status === 0 ? devices.stdout.split('\n').slice(1).filter(line => /\tdevice\s*$/.test(line)) : [];
  const device = serials.length ? { available: true, detail: serials.map(line => line.split('\t')[0]).join(', ') }
    : { available: false, detail: adb.available ? 'No authorized adb devices reported' : 'adb unavailable; device visibility unverified' };
  const adbtPath = probe.env.ADBT_CONTEXT_PATH;
  const adbt = adbtPath && probe.exists(adbtPath)
    ? { available: true, detail: `ADBT_CONTEXT_PATH=${adbtPath} (path exists; MCP connection unverified)` }
    : { available: false, detail: adbtPath ? `ADBT_CONTEXT_PATH missing: ${adbtPath}` : 'ADBT_CONTEXT_PATH not set; MCP context unverified' };
  const missing = ([['Node', node], ['npm', npm], ['ADBT context', adbt], ['Vega SDK', vegaSdk],
    ['Vega CLI', vegaCli], ['adb', adb], ['device/simulator', device]] as const)
    .filter(([, result]) => !result.available).map(([name]) => name);
  return { node, npm, adbt, vegaSdk, vegaCli, adb, device, missing, buildReady: false };
}
