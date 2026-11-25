import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { execute, queryOne } from "./db";
import {
  DEFAULT_ACCOUNT_QUOTA_CONFIG,
  accountQuotaConfigInputSchema,
  computeQuotaCpuPercent,
  computeQuotaMetric,
  parseCgroupMemoryLimit,
  parseCgroupPidsMax,
  parseCgroupV1CpuQuota,
  parseCgroupV2CpuMax,
  parseCgroupV2CpuUsageUsec,
  parseLinuxQuotaOutput,
  type AccountQuotaConfig,
  type AccountQuotaConfigInput,
  type AccountQuotaSnapshot,
  type DirectoryUsageEntry,
  type ParsedLinuxQuota,
  type QuotaSource,
} from "./account-quota-core";

const execFileAsync = promisify(execFile);

const ACCOUNT_QUOTA_SETTING_KEY = "host_account_quota";
const CONFIG_CACHE_TTL_MS = 10_000;
const DISK_SCAN_CACHE_TTL_MS = 30_000;
const LINUX_QUOTA_CACHE_TTL_MS = 30_000;
const MAX_SCAN_ENTRIES = 120_000;

let cachedConfig: { value: AccountQuotaConfig; expiresAt: number } | null = null;

interface WorkspaceDiskScan {
  scopePath: string;
  totalBytes: number;
  totalFiles: number;
  topFolders: Array<{ name: string; bytes: number; files: number }>;
  scannedAtMs: number;
}

let cachedWorkspaceScan: { value: WorkspaceDiskScan; expiresAt: number } | null = null;
let inFlightWorkspaceScan: Promise<WorkspaceDiskScan> | null = null;

let cachedLinuxQuota: { value: ParsedLinuxQuota | null; expiresAt: number } | null = null;
let inFlightLinuxQuota: Promise<ParsedLinuxQuota | null> | null = null;

interface AccountCpuSample {
  usageUsec: number;
  capturedAtMs: number;
  mode: "cgroup_v2" | "cgroup_v1" | "process";
}

let lastAccountCpuSample: AccountCpuSample | null = null;

function safeReadFileSync(filePath: string): string | null {
  try {
    return fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8");
  } catch {
    return null;
  }
}

function parseEnvPositiveNumber(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function sanitizeStoredConfig(raw: Partial<AccountQuotaConfig> | null | undefined): AccountQuotaConfig {
  const cleanNum = (v: unknown, min: number, max: number): number | null => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    if (v < min || v > max) return null;
    return v;
  };
  return {
    planLabel: typeof raw?.planLabel === "string" ? raw.planLabel.trim().slice(0, 80) : "",
    diskLimitMb: cleanNum(raw?.diskLimitMb, 16, 10_485_760),
    ramLimitMb: cleanNum(raw?.ramLimitMb, 64, 1_048_576),
    cpuCores: cleanNum(raw?.cpuCores, 0.1, 256),
    inodeLimit: cleanNum(raw?.inodeLimit, 100, 100_000_000),
    entryProcessLimit: cleanNum(raw?.entryProcessLimit, 1, 100_000),
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export async function getAccountQuotaConfig(): Promise<AccountQuotaConfig> {
  const now = Date.now();
  if (cachedConfig && cachedConfig.expiresAt > now) {
    return cachedConfig.value;
  }
  try {
    const row = await queryOne<{ value: string }>(
      "SELECT value FROM settings WHERE `key` = ?",
      [ACCOUNT_QUOTA_SETTING_KEY]
    );
    if (!row?.value) {
      cachedConfig = { value: DEFAULT_ACCOUNT_QUOTA_CONFIG, expiresAt: now + CONFIG_CACHE_TTL_MS };
      return DEFAULT_ACCOUNT_QUOTA_CONFIG;
    }
    const parsed = JSON.parse(row.value) as Partial<AccountQuotaConfig>;
    const clean = sanitizeStoredConfig(parsed);
    cachedConfig = { value: clean, expiresAt: now + CONFIG_CACHE_TTL_MS };
    return clean;
  } catch {
    return DEFAULT_ACCOUNT_QUOTA_CONFIG;
  }
}

export async function saveAccountQuotaConfig(
  rawInput: unknown
): Promise<{ ok: true; config: AccountQuotaConfig } | { ok: false; error: string }> {
  const parsed = accountQuotaConfigInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || "Invalid quota limits.";
    return { ok: false, error: firstIssue };
  }

  const data: AccountQuotaConfigInput = parsed.data;
  const next: AccountQuotaConfig = {
    planLabel: data.planLabel ?? "",
    diskLimitMb: data.diskLimitMb ?? null,
    ramLimitMb: data.ramLimitMb ?? null,
    cpuCores: data.cpuCores ?? null,
    inodeLimit: data.inodeLimit ?? null,
    entryProcessLimit: data.entryProcessLimit ?? null,
    updatedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(next);
  const existing = await queryOne<{ key: string }>(
    "SELECT `key` FROM settings WHERE `key` = ?",
    [ACCOUNT_QUOTA_SETTING_KEY]
  );
  if (existing) {
    await execute("UPDATE settings SET value = ? WHERE `key` = ?", [
      serialized,
      ACCOUNT_QUOTA_SETTING_KEY,
    ]);
  } else {
    await execute("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", [
      ACCOUNT_QUOTA_SETTING_KEY,
      serialized,
    ]);
  }

  cachedConfig = { value: next, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS };
  return { ok: true, config: next };
}

export function invalidateAccountQuotaCaches(): void {
  cachedConfig = null;
  cachedWorkspaceScan = null;
  cachedLinuxQuota = null;
}

/**
 * Probes Linux per-user filesystem quota via `quota -w -p` (safe `execFile`, no shell).
 * Cached for 30 seconds. Returns null on systems without `quota` or without user quotas.
 */
async function probeLinuxDiskQuota(): Promise<ParsedLinuxQuota | null> {
  if (process.platform !== "linux") return null;
  const now = Date.now();
  if (cachedLinuxQuota && cachedLinuxQuota.expiresAt > now) {
    return cachedLinuxQuota.value;
  }
  if (inFlightLinuxQuota) return inFlightLinuxQuota;

  inFlightLinuxQuota = (async () => {
    try {
      const { stdout } = await execFileAsync("quota", ["-w", "-p"], {
        timeout: 2000,
        maxBuffer: 256 * 1024,
      });
      const parsed = parseLinuxQuotaOutput(stdout);
      cachedLinuxQuota = { value: parsed, expiresAt: Date.now() + LINUX_QUOTA_CACHE_TTL_MS };
      return parsed;
    } catch {
      cachedLinuxQuota = { value: null, expiresAt: Date.now() + LINUX_QUOTA_CACHE_TTL_MS };
      return null;
    } finally {
      inFlightLinuxQuota = null;
    }
  })();

  return inFlightLinuxQuota;
}

/**
 * Recursively computes actual disk usage (bytes + file/inode count) inside a directory
 * without following symlinks, capped at `remainingBudget` entries to stay fast and safe on shared hosts.
 */
async function walkDirectoryUsage(
  rootDir: string,
  budget: { remaining: number }
): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  const stack: string[] = [rootDir];

  while (stack.length > 0 && budget.remaining > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(/*turbopackIgnore: true*/ current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (budget.remaining <= 0) break;
      budget.remaining -= 1;
      files += 1;

      const fullPath = path.join(/*turbopackIgnore: true*/ current, entry.name);
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        try {
          const st = await fsp.lstat(/*turbopackIgnore: true*/ fullPath);
          bytes += st.size;
        } catch {
          // Skip transient or unreadable files
        }
      }
    }
  }

  return { bytes, files };
}

/**
 * Scans the current app/account workspace to compute exact disk bytes, file count,
 * and top folder consumption breakdown. Cached for 30s with single-flight coalescing.
 */
async function scanWorkspaceDiskUsage(): Promise<WorkspaceDiskScan> {
  const now = Date.now();
  if (cachedWorkspaceScan && cachedWorkspaceScan.expiresAt > now) {
    return cachedWorkspaceScan.value;
  }
  if (inFlightWorkspaceScan) return inFlightWorkspaceScan;

  inFlightWorkspaceScan = (async () => {
    const scopePath = path.resolve(/*turbopackIgnore: true*/ process.cwd());
    const budget = { remaining: MAX_SCAN_ENTRIES };
    let totalBytes = 0;
    let totalFiles = 0;
    const folders: Array<{ name: string; bytes: number; files: number }> = [];
    let rootFilesBytes = 0;
    let rootFilesCount = 0;

    try {
      const topEntries = await fsp.readdir(/*turbopackIgnore: true*/ scopePath, {
        withFileTypes: true,
      });

      for (const entry of topEntries) {
        if (budget.remaining <= 0) break;
        const fullPath = path.join(/*turbopackIgnore: true*/ scopePath, entry.name);
        if (entry.isSymbolicLink()) continue;

        if (entry.isDirectory()) {
          // Skip transient Playwright screenshot folder if present during testing
          if (entry.name === ".playwright-cli") continue;
          budget.remaining -= 1;
          const sub = await walkDirectoryUsage(fullPath, budget);
          const dirFiles = sub.files + 1;
          totalBytes += sub.bytes;
          totalFiles += dirFiles;
          folders.push({ name: entry.name, bytes: sub.bytes, files: dirFiles });
        } else if (entry.isFile()) {
          budget.remaining -= 1;
          try {
            const st = await fsp.lstat(/*turbopackIgnore: true*/ fullPath);
            totalBytes += st.size;
            totalFiles += 1;
            rootFilesBytes += st.size;
            rootFilesCount += 1;
          } catch {
            // Skip unreadable file
          }
        }
      }
    } catch {
      // Fallback empty scan
    }

    if (rootFilesBytes > 0) {
      folders.push({ name: "(root files)", bytes: rootFilesBytes, files: rootFilesCount });
    }

    folders.sort((a, b) => b.bytes - a.bytes);

    const value: WorkspaceDiskScan = {
      scopePath,
      totalBytes,
      totalFiles,
      topFolders: folders.slice(0, 6),
      scannedAtMs: Date.now(),
    };
    cachedWorkspaceScan = { value, expiresAt: Date.now() + DISK_SCAN_CACHE_TTL_MS };
    return value;
  })().finally(() => {
    inFlightWorkspaceScan = null;
  });

  return inFlightWorkspaceScan;
}

interface CgroupReadings {
  version: "v2" | "v1" | "none";
  memoryLimitBytes: number | null;
  memoryUsageBytes: number | null;
  cpuLimitCores: number | null;
  cpuUsageUsec: number | null;
  pidsCurrent: number | null;
  pidsMax: number | null;
}

function readCgroupMetrics(hostTotalMemBytes: number): CgroupReadings {
  if (process.platform !== "linux") {
    return {
      version: "none",
      memoryLimitBytes: null,
      memoryUsageBytes: null,
      cpuLimitCores: null,
      cpuUsageUsec: null,
      pidsCurrent: null,
      pidsMax: null,
    };
  }

  // Try cgroup v2 unified hierarchy first
  const v2Controllers = safeReadFileSync("/sys/fs/cgroup/cgroup.controllers");
  if (v2Controllers !== null) {
    const memMaxRaw = safeReadFileSync("/sys/fs/cgroup/memory.max");
    const memCurrRaw = safeReadFileSync("/sys/fs/cgroup/memory.current");
    const cpuMaxRaw = safeReadFileSync("/sys/fs/cgroup/cpu.max");
    const cpuStatRaw = safeReadFileSync("/sys/fs/cgroup/cpu.stat");
    const pidsCurrRaw = safeReadFileSync("/sys/fs/cgroup/pids.current");
    const pidsMaxRaw = safeReadFileSync("/sys/fs/cgroup/pids.max");

    const memCurr = memCurrRaw ? Number(memCurrRaw.trim()) : Number.NaN;
    const pidsCurr = pidsCurrRaw ? Number(pidsCurrRaw.trim()) : Number.NaN;

    return {
      version: "v2",
      memoryLimitBytes: parseCgroupMemoryLimit(memMaxRaw, hostTotalMemBytes),
      memoryUsageBytes: Number.isFinite(memCurr) && memCurr > 0 ? memCurr : null,
      cpuLimitCores: parseCgroupV2CpuMax(cpuMaxRaw),
      cpuUsageUsec: parseCgroupV2CpuUsageUsec(cpuStatRaw),
      pidsCurrent: Number.isFinite(pidsCurr) && pidsCurr > 0 ? Math.floor(pidsCurr) : null,
      pidsMax: parseCgroupPidsMax(pidsMaxRaw),
    };
  }

  // Fallback: cgroup v1 hierarchy
  const v1MemLimitRaw = safeReadFileSync("/sys/fs/cgroup/memory/memory.limit_in_bytes");
  const v1MemUsageRaw = safeReadFileSync("/sys/fs/cgroup/memory/memory.usage_in_bytes");
  const v1CpuQuotaRaw = safeReadFileSync("/sys/fs/cgroup/cpu/cpu.cfs_quota_us");
  const v1CpuPeriodRaw = safeReadFileSync("/sys/fs/cgroup/cpu/cpu.cfs_period_us");
  const v1CpuAcctRaw = safeReadFileSync("/sys/fs/cgroup/cpuacct/cpuacct.usage");
  const v1PidsCurrRaw = safeReadFileSync("/sys/fs/cgroup/pids/pids.current");
  const v1PidsMaxRaw = safeReadFileSync("/sys/fs/cgroup/pids/pids.max");

  if (v1MemLimitRaw !== null || v1CpuQuotaRaw !== null) {
    const memUsage = v1MemUsageRaw ? Number(v1MemUsageRaw.trim()) : Number.NaN;
    const cpuNs = v1CpuAcctRaw ? Number(v1CpuAcctRaw.trim()) : Number.NaN;
    const pidsCurr = v1PidsCurrRaw ? Number(v1PidsCurrRaw.trim()) : Number.NaN;
    return {
      version: "v1",
      memoryLimitBytes: parseCgroupMemoryLimit(v1MemLimitRaw, hostTotalMemBytes),
      memoryUsageBytes: Number.isFinite(memUsage) && memUsage > 0 ? memUsage : null,
      cpuLimitCores: parseCgroupV1CpuQuota(v1CpuQuotaRaw, v1CpuPeriodRaw),
      cpuUsageUsec: Number.isFinite(cpuNs) && cpuNs >= 0 ? Math.floor(cpuNs / 1000) : null,
      pidsCurrent: Number.isFinite(pidsCurr) && pidsCurr > 0 ? Math.floor(pidsCurr) : null,
      pidsMax: parseCgroupPidsMax(v1PidsMaxRaw),
    };
  }

  return {
    version: "none",
    memoryLimitBytes: null,
    memoryUsageBytes: null,
    cpuLimitCores: null,
    cpuUsageUsec: null,
    pidsCurrent: null,
    pidsMax: null,
  };
}

function readPartitionFallbackInodes(): number | null {
  try {
    if (typeof fs.statfsSync === "function") {
      const stat = fs.statfsSync(/*turbopackIgnore: true*/ process.cwd());
      const files = Number(stat.files);
      if (Number.isFinite(files) && files > 0) return files;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Collects the live per-account / hosting-plan resource quota snapshot
 * (Disk Space, Memory RAM, CPU Quota, Inodes/Files, Entry Processes)
 * with real OS/cgroup/Linux-quota detection and user-configured plan overrides.
 */
export async function collectAccountQuotaSnapshot(context: {
  hostTotalMemBytes: number;
  hostDiskTotalBytes: number;
  hostCores: number;
  processRssBytes: number;
}): Promise<AccountQuotaSnapshot> {
  const [config, linuxQuota, workspaceScan] = await Promise.all([
    getAccountQuotaConfig(),
    probeLinuxDiskQuota(),
    scanWorkspaceDiskUsage(),
  ]);

  const cgroup = readCgroupMetrics(context.hostTotalMemBytes);
  const envDiskMb = parseEnvPositiveNumber("HOST_QUOTA_DISK_MB");
  const envRamMb = parseEnvPositiveNumber("HOST_QUOTA_RAM_MB");
  const envCpuCores = parseEnvPositiveNumber("HOST_QUOTA_CPU_CORES");
  const envInodes = parseEnvPositiveNumber("HOST_QUOTA_INODES");
  const envNproc = parseEnvPositiveNumber("HOST_QUOTA_NPROC");

  // 1. Account Disk Quota (Used / Limit / Remaining)
  const detectedDiskLimitBytes =
    linuxQuota && linuxQuota.effectiveLimitBytes > 0 ? linuxQuota.effectiveLimitBytes : null;
  const diskUsedBytes =
    linuxQuota && linuxQuota.usedBytes > 0 ? linuxQuota.usedBytes : workspaceScan.totalBytes;

  let diskLimitBytes: number;
  let diskSource: QuotaSource;
  if (config.diskLimitMb !== null) {
    diskLimitBytes = Math.round(config.diskLimitMb * 1024 * 1024);
    diskSource = "manual_plan";
  } else if (envDiskMb !== null) {
    diskLimitBytes = Math.round(envDiskMb * 1024 * 1024);
    diskSource = "env_override";
  } else if (detectedDiskLimitBytes !== null) {
    diskLimitBytes = detectedDiskLimitBytes;
    diskSource = "linux_quota";
  } else {
    diskLimitBytes = Math.max(context.hostDiskTotalBytes, workspaceScan.totalBytes);
    diskSource = "host_fallback";
  }

  const diskBase = computeQuotaMetric({
    used: diskUsedBytes,
    limit: diskLimitBytes,
    source: diskSource,
    detectedLimit: detectedDiskLimitBytes,
  });

  const breakdown: DirectoryUsageEntry[] = workspaceScan.topFolders.map((item) => ({
    name: item.name,
    bytes: item.bytes,
    files: item.files,
    percentOfLimit:
      diskLimitBytes > 0
        ? Math.round(Math.min(100, (item.bytes / diskLimitBytes) * 100) * 10) / 10
        : 0,
  }));

  // 2. Account Memory / RAM Quota (Used / Limit / Remaining)
  const detectedRamLimitBytes = cgroup.memoryLimitBytes;
  const ramUsedBytes =
    cgroup.memoryLimitBytes !== null && cgroup.memoryUsageBytes !== null
      ? cgroup.memoryUsageBytes
      : context.processRssBytes;

  let ramLimitBytes: number;
  let ramSource: QuotaSource;
  if (config.ramLimitMb !== null) {
    ramLimitBytes = Math.round(config.ramLimitMb * 1024 * 1024);
    ramSource = "manual_plan";
  } else if (envRamMb !== null) {
    ramLimitBytes = Math.round(envRamMb * 1024 * 1024);
    ramSource = "env_override";
  } else if (detectedRamLimitBytes !== null) {
    ramLimitBytes = detectedRamLimitBytes;
    ramSource = cgroup.version === "v2" ? "cgroup_v2" : "cgroup_v1";
  } else {
    ramLimitBytes = context.hostTotalMemBytes;
    ramSource = "host_fallback";
  }

  const memoryBase = computeQuotaMetric({
    used: ramUsedBytes,
    limit: ramLimitBytes,
    source: ramSource,
    detectedLimit: detectedRamLimitBytes,
  });

  // 3. Account CPU Quota (% of allocated vCPUs)
  const detectedCores = cgroup.cpuLimitCores;
  let allocatedCores: number;
  let cpuSource: QuotaSource;
  if (config.cpuCores !== null) {
    allocatedCores = config.cpuCores;
    cpuSource = "manual_plan";
  } else if (envCpuCores !== null) {
    allocatedCores = envCpuCores;
    cpuSource = "env_override";
  } else if (detectedCores !== null) {
    allocatedCores = detectedCores;
    cpuSource = cgroup.version === "v2" ? "cgroup_v2" : "cgroup_v1";
  } else {
    allocatedCores = Math.max(1, context.hostCores);
    cpuSource = "host_fallback";
  }

  const nowMs = Date.now();
  let currCpuSample: AccountCpuSample;
  if (cgroup.cpuUsageUsec !== null && (cgroup.version === "v2" || cgroup.version === "v1")) {
    currCpuSample = {
      usageUsec: cgroup.cpuUsageUsec,
      capturedAtMs: nowMs,
      mode: cgroup.version === "v2" ? "cgroup_v2" : "cgroup_v1",
    };
  } else {
    const procCpu = process.cpuUsage();
    currCpuSample = {
      usageUsec: procCpu.user + procCpu.system,
      capturedAtMs: nowMs,
      mode: "process",
    };
  }

  let accountCpuPercent = 0;
  if (lastAccountCpuSample && lastAccountCpuSample.mode === currCpuSample.mode) {
    accountCpuPercent = computeQuotaCpuPercent({
      cpuDeltaUsec: currCpuSample.usageUsec - lastAccountCpuSample.usageUsec,
      wallDeltaMs: currCpuSample.capturedAtMs - lastAccountCpuSample.capturedAtMs,
      allocatedCores,
    });
  } else {
    // First-sample fallback estimate from OS load average clamped against allocated cores
    const load1m = os.loadavg()[0] ?? 0;
    accountCpuPercent =
      Math.round(Math.max(0, Math.min(100, (load1m / Math.max(0.1, allocatedCores)) * 100)) * 10) /
      10;
  }
  lastAccountCpuSample = currCpuSample;
  const remainingCpuPercent = Math.round(Math.max(0, 100 - accountCpuPercent) * 10) / 10;

  // 4. Account Inodes / Files Quota
  const detectedInodeLimit =
    linuxQuota && linuxQuota.effectiveInodeLimit > 0 ? linuxQuota.effectiveInodeLimit : null;
  const usedInodes =
    linuxQuota && linuxQuota.usedInodes > 0 ? linuxQuota.usedInodes : workspaceScan.totalFiles;

  let inodeLimit: number;
  let inodeSource: QuotaSource;
  if (config.inodeLimit !== null) {
    inodeLimit = Math.round(config.inodeLimit);
    inodeSource = "manual_plan";
  } else if (envInodes !== null) {
    inodeLimit = Math.round(envInodes);
    inodeSource = "env_override";
  } else if (detectedInodeLimit !== null) {
    inodeLimit = detectedInodeLimit;
    inodeSource = "linux_quota";
  } else {
    inodeLimit = readPartitionFallbackInodes() ?? 250_000;
    inodeSource = "host_fallback";
  }

  const inodes = computeQuotaMetric({
    used: usedInodes,
    limit: inodeLimit,
    source: inodeSource,
    detectedLimit: detectedInodeLimit,
  });

  // 5. Entry Processes / PIDs Quota
  const detectedPidsMax = cgroup.pidsMax;
  const usedProcesses = cgroup.pidsCurrent ?? 1;

  let processLimit: number;
  let processSource: QuotaSource;
  if (config.entryProcessLimit !== null) {
    processLimit = Math.round(config.entryProcessLimit);
    processSource = "manual_plan";
  } else if (envNproc !== null) {
    processLimit = Math.round(envNproc);
    processSource = "env_override";
  } else if (detectedPidsMax !== null) {
    processLimit = detectedPidsMax;
    processSource = cgroup.version === "v2" ? "cgroup_v2" : "cgroup_v1";
  } else {
    processLimit = Math.max(20, usedProcesses);
    processSource = "host_fallback";
  }

  const processes = computeQuotaMetric({
    used: usedProcesses,
    limit: processLimit,
    source: processSource,
    detectedLimit: detectedPidsMax,
  });

  return {
    config,
    scopePath: workspaceScan.scopePath,
    disk: {
      ...diskBase,
      workspaceBytes: workspaceScan.totalBytes,
      breakdown,
    },
    memory: {
      ...memoryBase,
      processRssBytes: context.processRssBytes,
      cgroupUsageBytes: cgroup.memoryUsageBytes,
    },
    cpu: {
      percent: accountCpuPercent,
      remainingPercent: remainingCpuPercent,
      allocatedCores,
      hostCores: Math.max(1, context.hostCores),
      source: cpuSource,
      detectedCores,
    },
    inodes,
    processes,
    detectedCapabilities: {
      cgroupVersion: cgroup.version,
      linuxDiskQuota: linuxQuota !== null,
    },
  };
}
