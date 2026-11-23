import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import v8 from "node:v8";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getActiveDbEngine } from "./db";

const execFileAsync = promisify(execFile);

export interface CpuTickSnapshot {
  idle: number;
  total: number;
}

export interface NetworkTickSnapshot {
  rxBytes: number;
  txBytes: number;
  interfaceCount: number;
  capturedAtMs: number;
}

export interface SystemTelemetrySnapshot {
  timestamp: string;
  cpu: {
    percent: number;
    cores: number;
    model: string;
    speedMhz: number;
    loadAvg: [number, number, number];
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    percent: number;
    swapTotalBytes: number;
    swapUsedBytes: number;
    swapPercent: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    percent: number;
    mountLabel: string;
  };
  network: {
    rxBytesPerSec: number;
    txBytesPerSec: number;
    totalRxBytes: number;
    totalTxBytes: number;
    interfaceCount: number;
  };
  runtime: {
    nodeVersion: string;
    platform: string;
    arch: string;
    hostname: string;
    osUptimeSec: number;
    processUptimeSec: number;
    processRssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    heapLimitBytes: number;
    heapPercent: number;
    appVersion: string;
    dbEngine: "sqlite" | "mysql";
  };
}

/**
 * Captures cumulative CPU idle & total ticks across all logical cores.
 */
export function captureCpuTicks(cpus: os.CpuInfo[] = os.cpus()): CpuTickSnapshot {
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return { idle, total };
}

/**
 * Computes true live CPU utilization % between two CPU tick snapshots.
 */
export function computeCpuPercentFromDeltas(
  prev: CpuTickSnapshot | null,
  curr: CpuTickSnapshot,
  fallbackLoad1m: number,
  coreCount: number
): number {
  if (prev && curr.total > prev.total) {
    const totalDelta = curr.total - prev.total;
    const idleDelta = Math.max(0, curr.idle - prev.idle);
    const pct = ((totalDelta - idleDelta) / totalDelta) * 100;
    return Math.round(Math.max(0, Math.min(100, pct)) * 10) / 10;
  }
  // Fallback for the very first sample before a second tick delta arrives
  const cores = Math.max(1, coreCount);
  const est = (fallbackLoad1m / cores) * 100;
  return Math.round(Math.max(0, Math.min(100, est)) * 10) / 10;
}

/**
 * Reads accurate Linux memory & swap metrics from `/proc/meminfo` (using MemAvailable
 * so Linux page cache isn't misreported as "used" memory, matching 3x-ui & `free -h`).
 */
function readLinuxMemoryMetrics(): {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
} | null {
  try {
    if (process.platform !== "linux") return null;
    const raw = fs.readFileSync("/proc/meminfo", "utf8");
    const map = new Map<string, number>();
    for (const line of raw.split("\n")) {
      const m = /^([A-Za-z0-9_()]+):\s+(\d+)\s*kB/i.exec(line.trim());
      if (m) {
        map.set(m[1], Number(m[2]) * 1024);
      }
    }
    const total = map.get("MemTotal");
    if (!total || total <= 0) return null;
    const available = map.get("MemAvailable") ?? (map.get("MemFree") ?? 0);
    const used = Math.max(0, total - available);
    const swapTotal = map.get("SwapTotal") ?? 0;
    const swapFree = map.get("SwapFree") ?? swapTotal;
    const swapUsed = Math.max(0, swapTotal - swapFree);
    return {
      totalBytes: total,
      usedBytes: used,
      freeBytes: available,
      swapTotalBytes: swapTotal,
      swapUsedBytes: swapUsed,
    };
  } catch {
    return null;
  }
}

type DiskMetrics = {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  percent: number;
  mountLabel: string;
};

const DISK_CACHE_TTL_MS = 15_000;
let cachedDiskMetrics: { value: DiskMetrics; expiresAt: number } | null = null;

/**
 * Reads disk capacity & usage via Node's zero-subprocess `fs.statfsSync` syscall,
 * falling back to `df -kP` if unavailable on the host OS. Cached for 15s to avoid
 * redundant filesystem calls on every telemetry tick.
 */
async function readDiskMetrics(): Promise<DiskMetrics> {
  const now = Date.now();
  if (cachedDiskMetrics && cachedDiskMetrics.expiresAt > now) {
    return cachedDiskMetrics.value;
  }

  const targetDir = process.cwd();
  try {
    if (typeof fs.statfsSync === "function") {
      const stat = fs.statfsSync(targetDir);
      const blockSize = Number(stat.bsize || 4096);
      const totalBytes = Number(stat.blocks) * blockSize;
      const freeBytes = Number(stat.bavail) * blockSize;
      const usedBytes = Math.max(0, totalBytes - Number(stat.bfree) * blockSize);
      const effectiveTotal = usedBytes + freeBytes;
      const percent = effectiveTotal > 0 ? Math.round((usedBytes / effectiveTotal) * 1000) / 10 : 0;
      const value: DiskMetrics = {
        totalBytes,
        usedBytes,
        freeBytes,
        percent: Math.max(0, Math.min(100, percent)),
        mountLabel: "/",
      };
      cachedDiskMetrics = { value, expiresAt: now + DISK_CACHE_TTL_MS };
      return value;
    }
  } catch {
    // Fallback to df below
  }

  try {
    const { stdout } = await execFileAsync("df", ["-kP", targetDir], { timeout: 3000 });
    const lines = stdout.trim().split("\n");
    if (lines.length >= 2) {
      const cols = lines[lines.length - 1].trim().split(/\s+/);
      const totalBytes = Number(cols[1]) * 1024;
      const usedBytes = Number(cols[2]) * 1024;
      const freeBytes = Number(cols[3]) * 1024;
      const percent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
      const value: DiskMetrics = {
        totalBytes,
        usedBytes,
        freeBytes,
        percent: Math.max(0, Math.min(100, percent)),
        mountLabel: cols[5] || "/",
      };
      cachedDiskMetrics = { value, expiresAt: now + DISK_CACHE_TTL_MS };
      return value;
    }
  } catch {
    // Ignore fallback failure
  }

  return { totalBytes: 0, usedBytes: 0, freeBytes: 0, percent: 0, mountLabel: "/" };
}

let cachedAppVersion: string | null = null;
function readAppVersion(): string {
  if (cachedAppVersion) return cachedAppVersion;
  try {
    const pkgPath = path.join(/*turbopackIgnore: true*/ process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
    cachedAppVersion = pkg.version || "1.0.0";
  } catch {
    cachedAppVersion = "1.0.0";
  }
  return cachedAppVersion;
}

/**
 * Reads cumulative RX/TX byte counters across non-loopback Linux interfaces from `/proc/net/dev`.
 */
function readLinuxNetworkCounters(): NetworkTickSnapshot {
  const capturedAtMs = Date.now();
  try {
    if (process.platform !== "linux") {
      return { rxBytes: 0, txBytes: 0, interfaceCount: 0, capturedAtMs };
    }
    const raw = fs.readFileSync("/proc/net/dev", "utf8");
    const lines = raw.split("\n").slice(2);
    let rxBytes = 0;
    let txBytes = 0;
    let interfaceCount = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes(":")) continue;
      const [ifaceRaw, rest] = trimmed.split(":");
      const iface = ifaceRaw.trim();
      if (!iface || iface === "lo") continue;
      const cols = rest.trim().split(/\s+/);
      if (cols.length < 9) continue;
      const rx = Number(cols[0]);
      const tx = Number(cols[8]);
      if (Number.isFinite(rx) && Number.isFinite(tx)) {
        rxBytes += rx;
        txBytes += tx;
        interfaceCount += 1;
      }
    }
    return { rxBytes, txBytes, interfaceCount, capturedAtMs };
  } catch {
    return { rxBytes: 0, txBytes: 0, interfaceCount: 0, capturedAtMs };
  }
}

/**
 * Computes live network RX/TX bytes per second between two `/proc/net/dev` snapshots.
 */
export function computeNetworkRatesFromDeltas(
  prev: NetworkTickSnapshot | null,
  curr: NetworkTickSnapshot
): { rxBytesPerSec: number; txBytesPerSec: number } {
  if (!prev) return { rxBytesPerSec: 0, txBytesPerSec: 0 };
  const elapsedSec = (curr.capturedAtMs - prev.capturedAtMs) / 1000;
  if (!Number.isFinite(elapsedSec) || elapsedSec <= 0.05) {
    return { rxBytesPerSec: 0, txBytesPerSec: 0 };
  }
  const rxDelta = Math.max(0, curr.rxBytes - prev.rxBytes);
  const txDelta = Math.max(0, curr.txBytes - prev.txBytes);
  return {
    rxBytesPerSec: Math.round(rxDelta / elapsedSec),
    txBytesPerSec: Math.round(txDelta / elapsedSec),
  };
}

let lastGlobalCpuTicks: CpuTickSnapshot | null = null;
let lastGlobalNetTicks: NetworkTickSnapshot | null = null;
const SNAPSHOT_COALESCE_MS = 800;
let lastCoalescedResult: {
  capturedAtMs: number;
  result: {
    snapshot: SystemTelemetrySnapshot;
    cpuTicks: CpuTickSnapshot;
    netTicks: NetworkTickSnapshot;
  };
} | null = null;

/**
 * Collects a complete real-time hardware & runtime telemetry snapshot
 * (CPU %, RAM, Swap, Disk, Network I/O, Node Heap, Uptime, Engine).
 * Coalesces bursts within 800ms when called in default snapshot mode so multiple
 * open admin tabs share a single OS sample.
 */
export async function collectSystemTelemetry(
  prevTicksOverride?: CpuTickSnapshot | null,
  prevNetOverride?: NetworkTickSnapshot | null
): Promise<{
  snapshot: SystemTelemetrySnapshot;
  cpuTicks: CpuTickSnapshot;
  netTicks: NetworkTickSnapshot;
}> {
  const isDefaultSnapshot = prevTicksOverride === undefined && prevNetOverride === undefined;
  const now = Date.now();
  if (
    isDefaultSnapshot &&
    lastCoalescedResult &&
    now - lastCoalescedResult.capturedAtMs < SNAPSHOT_COALESCE_MS
  ) {
    return lastCoalescedResult.result;
  }

  const cpus = os.cpus();
  const currTicks = captureCpuTicks(cpus);
  const load = os.loadavg() as [number, number, number];
  const prevTicks = prevTicksOverride !== undefined ? prevTicksOverride : lastGlobalCpuTicks;
  const cpuPercent = computeCpuPercentFromDeltas(prevTicks, currTicks, load[0] ?? 0, cpus.length);
  lastGlobalCpuTicks = currTicks;

  const currNet = readLinuxNetworkCounters();
  const prevNet = prevNetOverride !== undefined ? prevNetOverride : lastGlobalNetTicks;
  const netRates = computeNetworkRatesFromDeltas(prevNet, currNet);
  lastGlobalNetTicks = currNet;

  const linuxMem = readLinuxMemoryMetrics();
  const totalBytes = linuxMem?.totalBytes ?? os.totalmem();
  const freeBytes = linuxMem?.freeBytes ?? os.freemem();
  const usedBytes = linuxMem?.usedBytes ?? Math.max(0, totalBytes - freeBytes);
  const memPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
  const swapTotalBytes = linuxMem?.swapTotalBytes ?? 0;
  const swapUsedBytes = linuxMem?.swapUsedBytes ?? 0;
  const swapPercent = swapTotalBytes > 0 ? Math.round((swapUsedBytes / swapTotalBytes) * 1000) / 10 : 0;

  const disk = await readDiskMetrics();
  const procMem = process.memoryUsage();
  const heapLimitBytes = Math.max(procMem.heapTotal, v8.getHeapStatistics().heap_size_limit || 0);
  const heapPercent =
    heapLimitBytes > 0 ? Math.round((procMem.heapUsed / heapLimitBytes) * 1000) / 10 : 0;

  const rawModel = (cpus[0]?.model || "").trim().replace(/\s+/g, " ");
  const cleanModel =
    !rawModel || rawModel.toLowerCase() === "unknown"
      ? `${os.arch().toUpperCase()} · ${cpus.length || 1} vCPU`
      : rawModel;

  const snapshot: SystemTelemetrySnapshot = {
    timestamp: new Date().toISOString(),
    cpu: {
      percent: cpuPercent,
      cores: cpus.length || 1,
      model: cleanModel,
      speedMhz: cpus[0]?.speed || 0,
      loadAvg: [
        Math.round((load[0] ?? 0) * 100) / 100,
        Math.round((load[1] ?? 0) * 100) / 100,
        Math.round((load[2] ?? 0) * 100) / 100,
      ],
    },
    memory: {
      totalBytes,
      usedBytes,
      freeBytes,
      percent: Math.max(0, Math.min(100, memPercent)),
      swapTotalBytes,
      swapUsedBytes,
      swapPercent: Math.max(0, Math.min(100, swapPercent)),
    },
    disk,
    network: {
      rxBytesPerSec: netRates.rxBytesPerSec,
      txBytesPerSec: netRates.txBytesPerSec,
      totalRxBytes: currNet.rxBytes,
      totalTxBytes: currNet.txBytes,
      interfaceCount: currNet.interfaceCount,
    },
    runtime: {
      nodeVersion: process.version,
      platform: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      hostname: os.hostname().slice(0, 48),
      osUptimeSec: Math.floor(os.uptime()),
      processUptimeSec: Math.floor(process.uptime()),
      processRssBytes: procMem.rss,
      heapUsedBytes: procMem.heapUsed,
      heapTotalBytes: procMem.heapTotal,
      heapLimitBytes,
      heapPercent: Math.max(0, Math.min(100, heapPercent)),
      appVersion: readAppVersion(),
      dbEngine: getActiveDbEngine(),
    },
  };

  const result = { snapshot, cpuTicks: currTicks, netTicks: currNet };
  if (isDefaultSnapshot) {
    lastCoalescedResult = { capturedAtMs: now, result };
  }
  return result;
}
