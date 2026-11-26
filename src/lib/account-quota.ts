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
  buildCgroupCandidateDirs,
  computeQuotaCpuPercent,
  computeQuotaMetric,
  parseCgroupMemoryLimit,
  parseCgroupPidsMax,
  parseCgroupV1CpuQuota,
  parseCgroupV2CpuMax,
  parseCgroupV2CpuUsageUsec,
  parseLinuxQuotaOutput,
  parseProcSelfCgroup,
  parseProcSelfLimits,
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
const DISK_SCAN_CACHE_TTL_MS = 120_000;
const LINUX_QUOTA_CACHE_TTL_MS = 60_000;
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
 * Probes Linux per-user filesystem quota via `quota -w -p` / `quota -w` (safe `execFile`, no shell)
 * and falls back to cPanel's cached `~/.cpanel/datastore/` quota output when present.
 * Note: Linux `quota` exits with code 1 when the user is over their soft quota while still
 * printing valid quota output to stdout — we inspect `err.stdout` before giving up.
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
      const candidates: Array<[string, string[]]> = [
        ["/usr/bin/quota", ["-w", "-p"]],
        ["/usr/sbin/quota", ["-w", "-p"]],
        ["quota", ["-w", "-p"]],
        ["/usr/bin/quota", ["-w"]],
        ["quota", ["-w"]],
      ];

      for (const [bin, args] of candidates) {
        try {
          const { stdout } = await execFileAsync(bin, args, {
            timeout: 2000,
            maxBuffer: 256 * 1024,
          });
          const parsed = parseLinuxQuotaOutput(stdout);
          if (parsed) {
            cachedLinuxQuota = { value: parsed, expiresAt: Date.now() + LINUX_QUOTA_CACHE_TTL_MS };
            return parsed;
          }
        } catch (err) {
          // Linux `quota` exits with code 1 when over soft limit while stdout still holds valid data
          const maybeStdout =
            err && typeof err === "object" && "stdout" in err && typeof err.stdout === "string"
              ? err.stdout
              : "";
          if (maybeStdout) {
            const parsed = parseLinuxQuotaOutput(maybeStdout);
            if (parsed) {
              cachedLinuxQuota = { value: parsed, expiresAt: Date.now() + LINUX_QUOTA_CACHE_TTL_MS };
              return parsed;
            }
          }
        }
      }

      // Check cPanel cached quota datastore file if running on a cPanel shared host
      const home = process.env.HOME?.trim();
      if (home && home !== "/" && home !== "/root") {
        const cpanelCacheCandidates = [
          path.join(/*turbopackIgnore: true*/ home, ".cpanel", "datastore", "_usr_bin_quota_-v"),
          path.join(/*turbopackIgnore: true*/ home, ".cpanel", "datastore", "_usr_bin_quota_-w"),
        ];
        for (const cacheFile of cpanelCacheCandidates) {
          const raw = safeReadFileSync(cacheFile);
          if (raw) {
            const parsed = parseLinuxQuotaOutput(raw);
            if (parsed) {
              cachedLinuxQuota = { value: parsed, expiresAt: Date.now() + LINUX_QUOTA_CACHE_TTL_MS };
              return parsed;
            }
          }
        }
      }

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
 * Fast native Linux disk & inode scanner using `du -sk` and `du --inodes -s` via safe
 * `execFile` (no shell). Runs ~40x faster than walking 60k+ files via JS lstat IPC calls.
 * Returns null if `du` is unavailable or unsupported (e.g. non-GNU / Windows), triggering
 * the pure-Node fallback walker cleanly.
 */
async function fastNativeDiskScan(
  scopePath: string,
  topEntryNames: string[]
): Promise<{
  totalBytes: number;
  totalFiles: number;
  folders: Array<{ name: string; bytes: number; files: number }>;
} | null> {
  if (process.platform !== "linux" || topEntryNames.length === 0) return null;

  try {
    const [sizeRes, inodeRes] = await Promise.all([
      execFileAsync("du", ["-sk", "--", ...topEntryNames], {
        cwd: scopePath,
        timeout: 4000,
        maxBuffer: 512 * 1024,
      }),
      execFileAsync("du", ["--inodes", "-s", "--", ...topEntryNames], {
        cwd: scopePath,
        timeout: 4000,
        maxBuffer: 512 * 1024,
      }).catch(() => null),
    ]);

    const inodeMap = new Map<string, number>();
    if (inodeRes?.stdout) {
      for (const line of inodeRes.stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const tabIdx = trimmed.indexOf("\t");
        if (tabIdx <= 0) continue;
        const count = Number(trimmed.slice(0, tabIdx).trim());
        const name = trimmed.slice(tabIdx + 1).trim();
        if (Number.isFinite(count) && count >= 0 && name) {
          inodeMap.set(name, count);
        }
      }
    }

    let totalBytes = 0;
    let totalFiles = 0;
    const folders: Array<{ name: string; bytes: number; files: number }> = [];

    for (const line of sizeRes.stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const tabIdx = trimmed.indexOf("\t");
      if (tabIdx <= 0) continue;
      const kb = Number(trimmed.slice(0, tabIdx).trim());
      const name = trimmed.slice(tabIdx + 1).trim();
      if (!Number.isFinite(kb) || kb < 0 || !name) continue;
      const bytes = kb * 1024;
      const files = inodeMap.get(name) ?? 0;
      totalBytes += bytes;
      totalFiles += files;
      folders.push({ name, bytes, files });
    }

    if (folders.length === 0) return null;
    // Require valid inode counts when using fast scan; otherwise fall back to Node walker
    if (totalFiles <= 0) return null;

    return { totalBytes, totalFiles, folders };
  } catch {
    return null;
  }
}

/**
 * Resolves the user's true hosting account directory. On cPanel / DirectAdmin shared hosts
 * where `process.cwd()` is inside a non-root `$HOME` (e.g. `/home/username/scienta-app/standalone`),
 * scanning `$HOME` measures the full hosting account (app, nodevenv, public_html, mail, logs)
 * instead of only the small `standalone/` subfolder.
 */
function resolveAccountScopePath(): string {
  const cwd = path.resolve(/*turbopackIgnore: true*/ process.cwd());
  const home = process.env.HOME?.trim();
  if (home && home !== "/" && home !== "/root" && !home.startsWith("/tmp")) {
    const resolvedHome = path.resolve(/*turbopackIgnore: true*/ home);
    if (cwd === resolvedHome || cwd.startsWith(resolvedHome + path.sep)) {
      return resolvedHome;
    }
  }
  return cwd;
}

async function performWorkspaceDiskScan(): Promise<WorkspaceDiskScan> {
  const scopePath = resolveAccountScopePath();
  let totalBytes = 0;
  let totalFiles = 0;
  let folders: Array<{ name: string; bytes: number; files: number }> = [];

  try {
    const topEntries = await fsp.readdir(/*turbopackIgnore: true*/ scopePath, {
      withFileTypes: true,
    });

    const filteredEntries = topEntries.filter(
      (entry) => !entry.isSymbolicLink() && entry.name !== ".playwright-cli"
    );
    const dirNames = filteredEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const rootFileEntries = filteredEntries.filter((entry) => entry.isFile());

    // Measure root-level files directly (usually < 30 files)
    let rootFilesBytes = 0;
    let rootFilesCount = 0;
    for (const entry of rootFileEntries) {
      try {
        const st = await fsp.lstat(path.join(/*turbopackIgnore: true*/ scopePath, entry.name));
        rootFilesBytes += st.size;
        rootFilesCount += 1;
      } catch {
        // Skip unreadable root file
      }
    }

    const fastScan = await fastNativeDiskScan(scopePath, dirNames);
    if (fastScan) {
      totalBytes = fastScan.totalBytes + rootFilesBytes;
      totalFiles = fastScan.totalFiles + rootFilesCount;
      folders = fastScan.folders;
    } else {
      // Cross-platform pure-Node fallback when native `du --inodes` is unavailable
      const budget = { remaining: MAX_SCAN_ENTRIES };
      totalBytes = rootFilesBytes;
      totalFiles = rootFilesCount;
      for (const dirName of dirNames) {
        if (budget.remaining <= 0) break;
        budget.remaining -= 1;
        const fullPath = path.join(/*turbopackIgnore: true*/ scopePath, dirName);
        const sub = await walkDirectoryUsage(fullPath, budget);
        const dirFiles = sub.files + 1;
        totalBytes += sub.bytes;
        totalFiles += dirFiles;
        folders.push({ name: dirName, bytes: sub.bytes, files: dirFiles });
      }
    }

    if (rootFilesBytes > 0) {
      folders.push({ name: "(root files)", bytes: rootFilesBytes, files: rootFilesCount });
    }
  } catch {
    // Fallback empty scan
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
}

/**
 * Scans the current app/account workspace to compute exact disk bytes, file count,
 * and top folder consumption breakdown. Uses stale-while-revalidate caching (120s TTL)
 * and single-flight coalescing so live telemetry polling stays sub-2ms.
 */
async function scanWorkspaceDiskUsage(): Promise<WorkspaceDiskScan> {
  const now = Date.now();
  if (cachedWorkspaceScan) {
    if (cachedWorkspaceScan.expiresAt > now) {
      return cachedWorkspaceScan.value;
    }
    // Stale-while-revalidate: trigger background refresh without stalling live telemetry
    if (!inFlightWorkspaceScan) {
      inFlightWorkspaceScan = performWorkspaceDiskScan().finally(() => {
        inFlightWorkspaceScan = null;
      });
    }
    return cachedWorkspaceScan.value;
  }

  if (inFlightWorkspaceScan) return inFlightWorkspaceScan;
  inFlightWorkspaceScan = performWorkspaceDiskScan().finally(() => {
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

function readFirstValidNumber(dirs: string[], filename: string): number | null {
  for (const dir of dirs) {
    const raw = safeReadFileSync(`${dir}/${filename}`);
    if (raw !== null) {
      const n = Number(raw.trim());
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return null;
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

  const procCgroup = parseProcSelfCgroup(safeReadFileSync("/proc/self/cgroup"));

  // Try cgroup v2 unified hierarchy first (walking from process cgroup path up to /sys/fs/cgroup)
  const v2Controllers = safeReadFileSync("/sys/fs/cgroup/cgroup.controllers");
  if (v2Controllers !== null) {
    const v2Dirs = buildCgroupCandidateDirs("/sys/fs/cgroup", procCgroup.v2Path);

    let memoryLimitBytes: number | null = null;
    let cpuLimitCores: number | null = null;
    let pidsMax: number | null = null;

    for (const dir of v2Dirs) {
      const memLimit = parseCgroupMemoryLimit(
        safeReadFileSync(`${dir}/memory.max`),
        hostTotalMemBytes
      );
      if (memLimit !== null && (memoryLimitBytes === null || memLimit < memoryLimitBytes)) {
        memoryLimitBytes = memLimit;
      }

      const cpuCores = parseCgroupV2CpuMax(safeReadFileSync(`${dir}/cpu.max`));
      if (cpuCores !== null && (cpuLimitCores === null || cpuCores < cpuLimitCores)) {
        cpuLimitCores = cpuCores;
      }

      const pMax = parseCgroupPidsMax(safeReadFileSync(`${dir}/pids.max`));
      if (pMax !== null && (pidsMax === null || pMax < pidsMax)) {
        pidsMax = pMax;
      }
    }

    const memCurr = readFirstValidNumber(v2Dirs, "memory.current");
    const pidsCurr = readFirstValidNumber(v2Dirs, "pids.current");

    let cpuUsageUsec: number | null = null;
    for (const dir of v2Dirs) {
      const parsed = parseCgroupV2CpuUsageUsec(safeReadFileSync(`${dir}/cpu.stat`));
      if (parsed !== null) {
        cpuUsageUsec = parsed;
        break;
      }
    }

    return {
      version: "v2",
      memoryLimitBytes,
      memoryUsageBytes: memCurr !== null && memCurr > 0 ? memCurr : null,
      cpuLimitCores,
      cpuUsageUsec,
      pidsCurrent: pidsCurr !== null && pidsCurr > 0 ? Math.floor(pidsCurr) : null,
      pidsMax,
    };
  }

  // Fallback: cgroup v1 hierarchy — walk each subsystem's actual path from /proc/self/cgroup
  const memDirs = buildCgroupCandidateDirs("/sys/fs/cgroup/memory", procCgroup.v1Paths.memory);
  const cpuDirs = buildCgroupCandidateDirs("/sys/fs/cgroup/cpu", procCgroup.v1Paths.cpu);
  const cpuAcctDirs = buildCgroupCandidateDirs(
    "/sys/fs/cgroup/cpuacct",
    procCgroup.v1Paths.cpuacct ?? procCgroup.v1Paths.cpu
  );
  const pidsDirs = buildCgroupCandidateDirs("/sys/fs/cgroup/pids", procCgroup.v1Paths.pids);

  let hasAnyV1File = false;
  let memoryLimitBytes: number | null = null;
  for (const dir of memDirs) {
    const raw = safeReadFileSync(`${dir}/memory.limit_in_bytes`);
    if (raw !== null) {
      hasAnyV1File = true;
      const limit = parseCgroupMemoryLimit(raw, hostTotalMemBytes);
      if (limit !== null && (memoryLimitBytes === null || limit < memoryLimitBytes)) {
        memoryLimitBytes = limit;
      }
    }
  }

  let cpuLimitCores: number | null = null;
  for (const dir of cpuDirs) {
    const qRaw = safeReadFileSync(`${dir}/cpu.cfs_quota_us`);
    const pRaw = safeReadFileSync(`${dir}/cpu.cfs_period_us`);
    if (qRaw !== null) {
      hasAnyV1File = true;
      const cores = parseCgroupV1CpuQuota(qRaw, pRaw);
      if (cores !== null && (cpuLimitCores === null || cores < cpuLimitCores)) {
        cpuLimitCores = cores;
      }
    }
  }

  let pidsMax: number | null = null;
  for (const dir of pidsDirs) {
    const raw = safeReadFileSync(`${dir}/pids.max`);
    if (raw !== null) {
      hasAnyV1File = true;
      const pMax = parseCgroupPidsMax(raw);
      if (pMax !== null && (pidsMax === null || pMax < pidsMax)) {
        pidsMax = pMax;
      }
    }
  }

  if (hasAnyV1File) {
    const memUsage = readFirstValidNumber(memDirs, "memory.usage_in_bytes");
    const cpuNs = readFirstValidNumber(cpuAcctDirs, "cpuacct.usage");
    const pidsCurr = readFirstValidNumber(pidsDirs, "pids.current");

    return {
      version: "v1",
      memoryLimitBytes,
      memoryUsageBytes: memUsage !== null && memUsage > 0 ? memUsage : null,
      cpuLimitCores,
      cpuUsageUsec: cpuNs !== null && cpuNs >= 0 ? Math.floor(cpuNs / 1000) : null,
      pidsCurrent: pidsCurr !== null && pidsCurr > 0 ? Math.floor(pidsCurr) : null,
      pidsMax,
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
  const procLimits =
    process.platform === "linux"
      ? parseProcSelfLimits(safeReadFileSync("/proc/self/limits"), context.hostTotalMemBytes)
      : { maxProcesses: null, maxAddressSpaceBytes: null };
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
  const detectedRamLimitBytes = cgroup.memoryLimitBytes ?? procLimits.maxAddressSpaceBytes;
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
  } else if (cgroup.memoryLimitBytes !== null) {
    ramLimitBytes = cgroup.memoryLimitBytes;
    ramSource = cgroup.version === "v2" ? "cgroup_v2" : "cgroup_v1";
  } else if (procLimits.maxAddressSpaceBytes !== null) {
    ramLimitBytes = procLimits.maxAddressSpaceBytes;
    ramSource = "rlimit";
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
  const detectedPidsMax = cgroup.pidsMax ?? procLimits.maxProcesses;
  const usedProcesses = cgroup.pidsCurrent ?? 1;

  let processLimit: number;
  let processSource: QuotaSource;
  if (config.entryProcessLimit !== null) {
    processLimit = Math.round(config.entryProcessLimit);
    processSource = "manual_plan";
  } else if (envNproc !== null) {
    processLimit = Math.round(envNproc);
    processSource = "env_override";
  } else if (cgroup.pidsMax !== null) {
    processLimit = cgroup.pidsMax;
    processSource = cgroup.version === "v2" ? "cgroup_v2" : "cgroup_v1";
  } else if (procLimits.maxProcesses !== null) {
    processLimit = procLimits.maxProcesses;
    processSource = "rlimit";
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
