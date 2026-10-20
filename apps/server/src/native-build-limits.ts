/** Parsed from the effective cgroup/filesystem, never from requested unit properties. */
export function assertNativeBuildLimits(cpu: string, memory: string, pids: string, diskBytes: number): void {
  const [quota,period] = cpu.trim().split(/\s+/).map(Number);
  const memoryBytes = Number(memory.trim());
  const processLimit = Number(pids.trim());
  if (!Number.isFinite(quota) || quota! <= 0 || !Number.isFinite(period) || period! <= 0 || quota!/period! > 2 ||
    !Number.isSafeInteger(memoryBytes) || memoryBytes < 1_000_000_000 || memoryBytes > 3_000_000_000 ||
    !Number.isSafeInteger(processLimit) || processLimit < 1 || processLimit > 128 ||
    !Number.isSafeInteger(diskBytes) || diskBytes < 1_000_000_000 || diskBytes > 20_000_000_000)
    throw new Error('Native build CPU, memory, PID or disk limit absent');
}
