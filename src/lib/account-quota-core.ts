import { z } from "zod";

export type QuotaSource =
  | "manual_plan"
  | "env_override"
  | "linux_quota"
  | "cgroup_v2"
  | "cgroup_v1"
  | "host_fallback";

export interface AccountQuotaConfig {
  planLabel: string;
  /** User-configured disk limit in MiB (null = auto-detect) */
  diskLimitMb: number | null;
  /** User-configured RAM limit in MiB (null = auto-detect) */
  ramLimitMb: number | null;
  /** User-configured vCPU cores (e.g. 0.5, 1, 2; null = auto-detect) */
  cpuCores: number | null;
  /** User-configured inode/file count limit (null = auto-detect) */
  inodeLimit: number | null;
  /** User-configured entry process limit (null = auto-detect) */
  entryProcessLimit: number | null;
  updatedAt: string | null;
}

export const DEFAULT_ACCOUNT_QUOTA_CONFIG: AccountQuotaConfig = {
  planLabel: "",
  diskLimitMb: null,
  ramLimitMb: null,
  cpuCores: null,
  inodeLimit: null,
  entryProcessLimit: null,
  updatedAt: null,
};

export interface QuotaMetricSnapshot {
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  overLimit: boolean;
  source: QuotaSource;
  detectedLimit: number | null;
}

export interface DirectoryUsageEntry {
  name: string;
  bytes: number;
  files: number;
  percentOfLimit: number;
}

export interface AccountQuotaSnapshot {
  config: AccountQuotaConfig;
  scopePath: string;
  disk: QuotaMetricSnapshot & {
    /** Actual scanned bytes inside the account/project workspace */
    workspaceBytes: number;
    breakdown: DirectoryUsageEntry[];
  };
  memory: QuotaMetricSnapshot & {
    processRssBytes: number;
    cgroupUsageBytes: number | null;
  };
  cpu: {
    percent: number;
    remainingPercent: number;
    allocatedCores: number;
    hostCores: number;
    source: QuotaSource;
    detectedCores: number | null;
  };
  inodes: QuotaMetricSnapshot;
  processes: QuotaMetricSnapshot;
  detectedCapabilities: {
    cgroupVersion: "v2" | "v1" | "none";
    linuxDiskQuota: boolean;
  };
}

export interface ParsedLinuxQuota {
  filesystem: string;
  usedBytes: number;
  softLimitBytes: number;
  hardLimitBytes: number;
  effectiveLimitBytes: number;
  usedInodes: number;
  softInodeLimit: number;
  hardInodeLimit: number;
  effectiveInodeLimit: number;
}

const nullablePositiveNumber = (min: number, max: number) =>
  z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "number" ? val : Number(String(val).trim());
      return Number.isFinite(num) ? num : Number.NaN;
    })
    .refine((val) => val === null || (Number.isFinite(val) && val >= min && val <= max), {
      message: `Must be empty or between ${min} and ${max}`,
    });

export const accountQuotaConfigInputSchema = z.object({
  planLabel: z
    .string()
    .trim()
    .max(80)
    .optional()
    .default(""),
  diskLimitMb: nullablePositiveNumber(16, 10_485_760), // 16 MB up to 10 TB
  ramLimitMb: nullablePositiveNumber(64, 1_048_576), // 64 MB up to 1 TB
  cpuCores: nullablePositiveNumber(0.1, 256), // 0.1 vCPU up to 256 cores
  inodeLimit: nullablePositiveNumber(100, 100_000_000), // 100 up to 100M files
  entryProcessLimit: nullablePositiveNumber(1, 100_000), // 1 up to 100k procs
});

export type AccountQuotaConfigInput = z.infer<typeof accountQuotaConfigInputSchema>;

/**
 * Pure calculation for a quota metric: computes exact remaining capacity,
 * clamped utilization percent (0..100), and whether usage exceeds the quota.
 */
export function computeQuotaMetric(params: {
  used: number;
  limit: number;
  source: QuotaSource;
  detectedLimit: number | null;
}): QuotaMetricSnapshot {
  const safeUsed = Number.isFinite(params.used) && params.used > 0 ? params.used : 0;
  const safeLimit = Number.isFinite(params.limit) && params.limit > 0 ? params.limit : 0;
  const remaining = safeLimit > 0 ? Math.max(0, safeLimit - safeUsed) : 0;
  const rawPercent = safeLimit > 0 ? (safeUsed / safeLimit) * 100 : 0;
  const percent = Math.round(Math.max(0, Math.min(100, rawPercent)) * 10) / 10;
  return {
    used: safeUsed,
    limit: safeLimit,
    remaining,
    percent,
    overLimit: safeLimit > 0 && safeUsed > safeLimit,
    source: params.source,
    detectedLimit: params.detectedLimit,
  };
}

/**
 * Parses Linux `quota -w -p` (or `quota -w`) stdout for the current user.
 * Handles soft/hard limits, `*` over-quota markers, and multi-filesystem rows.
 */
export function parseLinuxQuotaOutput(stdout: string): ParsedLinuxQuota | null {
  if (!stdout || !stdout.trim()) return null;
  const lines = stdout.split(/\r?\n/);

  let best: ParsedLinuxQuota | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith("Disk quotas") ||
      line.startsWith("Filesystem") ||
      line.startsWith("none")
    ) {
      continue;
    }

    const cols = line.split(/\s+/);
    // Standard `quota -w -p` columns:
    // 0: Filesystem, 1: blocks(KiB, optional *), 2: quota(soft), 3: limit(hard), 4: grace,
    // 5: files(optional *), 6: quota(soft), 7: limit(hard), 8: grace
    if (cols.length < 8) continue;

    const cleanNum = (token: string | undefined): number => {
      if (!token) return 0;
      const cleaned = token.replace(/\*$/, "");
      const n = Number(cleaned);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    const filesystem = cols[0];
    const usedBlocksKb = cleanNum(cols[1]);
    const softBlocksKb = cleanNum(cols[2]);
    const hardBlocksKb = cleanNum(cols[3]);

    // When blocks are over soft limit, grace column can be e.g. "6days" or numeric timestamp.
    // Standard `-p` always emits 9 columns; standard without `-p` may omit grace if not over quota.
    // Detect offset for files column safely.
    const looksLikeGrace = (tok: string | undefined) =>
      !tok || tok === "-" || tok === "none" || /\d+(days?|hours?|mins?|secs?)$/i.test(tok) || Number(tok) > 1_000_000_000;

    let filesIdx = 5;
    if (cols.length === 7 && !looksLikeGrace(cols[4])) {
      filesIdx = 4;
    } else if (cols.length >= 8 && !looksLikeGrace(cols[4]) && cols.length === 7) {
      filesIdx = 4;
    }

    const usedInodes = cleanNum(cols[filesIdx]);
    const softInodeLimit = cleanNum(cols[filesIdx + 1]);
    const hardInodeLimit = cleanNum(cols[filesIdx + 2]);

    const effectiveBlocksKb = softBlocksKb > 0 ? softBlocksKb : hardBlocksKb;
    const effectiveInodeLimit = softInodeLimit > 0 ? softInodeLimit : hardInodeLimit;

    if (effectiveBlocksKb <= 0 && effectiveInodeLimit <= 0 && usedBlocksKb <= 0) {
      continue;
    }

    const parsed: ParsedLinuxQuota = {
      filesystem,
      usedBytes: usedBlocksKb * 1024,
      softLimitBytes: softBlocksKb * 1024,
      hardLimitBytes: hardBlocksKb * 1024,
      effectiveLimitBytes: effectiveBlocksKb * 1024,
      usedInodes,
      softInodeLimit,
      hardInodeLimit,
      effectiveInodeLimit,
    };

    if (!best || (parsed.effectiveLimitBytes > 0 && best.effectiveLimitBytes === 0)) {
      best = parsed;
    }
  }

  return best;
}

/**
 * Parses cgroup v2 `memory.max` (or cgroup v1 `memory.limit_in_bytes`).
 * Returns null if unlimited (`"max"` or sentinel values >= hostTotalBytes).
 */
export function parseCgroupMemoryLimit(raw: string | null | undefined, hostTotalBytes: number): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "max") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  // cgroup v1 unlimited sentinel is ~9.22e18 (PAGE_ALIGNED LONG_MAX) or > hostTotalBytes
  if (value >= 1e15) return null;
  if (hostTotalBytes > 0 && value >= hostTotalBytes * 0.99) return null;
  return value;
}

/**
 * Parses cgroup v2 `cpu.max` content (format: "<quota> <period>", e.g. "100000 100000" -> 1.0 cores,
 * "50000 100000" -> 0.5 cores, "max 100000" -> null).
 */
export function parseCgroupV2CpuMax(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 2) return null;
  if (parts[0] === "max") return null;
  const quota = Number(parts[0]);
  const period = Number(parts[1]);
  if (!Number.isFinite(quota) || !Number.isFinite(period) || quota <= 0 || period <= 0) {
    return null;
  }
  return Math.round((quota / period) * 100) / 100;
}

/**
 * Parses cgroup v1 `cpu.cfs_quota_us` and `cpu.cfs_period_us`.
 * Returns null if quota <= 0 (meaning unlimited).
 */
export function parseCgroupV1CpuQuota(
  quotaRaw: string | null | undefined,
  periodRaw: string | null | undefined
): number | null {
  if (!quotaRaw || !periodRaw) return null;
  const quota = Number(quotaRaw.trim());
  const period = Number(periodRaw.trim());
  if (!Number.isFinite(quota) || !Number.isFinite(period) || quota <= 0 || period <= 0) {
    return null;
  }
  return Math.round((quota / period) * 100) / 100;
}

/**
 * Parses cgroup v2 `cpu.stat` to extract cumulative `usage_usec`.
 */
export function parseCgroupV2CpuUsageUsec(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = /^usage_usec\s+(\d+)/m.exec(raw);
  if (!match) return null;
  const val = Number(match[1]);
  return Number.isFinite(val) && val >= 0 ? val : null;
}

/**
 * Parses cgroup `pids.max` (returns null if `"max"` or non-finite).
 */
export function parseCgroupPidsMax(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "max") return null;
  const val = Number(trimmed);
  if (!Number.isFinite(val) || val <= 0 || val >= 1_000_000) return null;
  return Math.floor(val);
}

/**
 * Computes cgroup / process CPU utilization % normalized against the allocated vCPU quota.
 * e.g., 500_000 usec of CPU time over 1000ms wall time with 1.0 allocated vCPU = 50.0%.
 */
export function computeQuotaCpuPercent(params: {
  cpuDeltaUsec: number;
  wallDeltaMs: number;
  allocatedCores: number;
}): number {
  const { cpuDeltaUsec, wallDeltaMs, allocatedCores } = params;
  if (
    !Number.isFinite(cpuDeltaUsec) ||
    !Number.isFinite(wallDeltaMs) ||
    !Number.isFinite(allocatedCores) ||
    wallDeltaMs <= 20 ||
    allocatedCores <= 0 ||
    cpuDeltaUsec < 0
  ) {
    return 0;
  }
  const maxAvailableUsec = wallDeltaMs * 1000 * allocatedCores;
  const pct = (cpuDeltaUsec / maxAvailableUsec) * 100;
  return Math.round(Math.max(0, Math.min(100, pct)) * 10) / 10;
}

/**
 * Formats integer counts cleanly (e.g. 12,450 or 100K) for Inodes and Processes.
 */
export function formatCountCompact(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  const rounded = Math.round(value);
  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toFixed(2)}M`;
  if (rounded >= 100_000) return `${(rounded / 1_000).toFixed(1)}K`;
  return rounded.toLocaleString("en-US");
}

/**
 * Localized human-readable label for how a quota limit was obtained.
 */
export function formatQuotaSourceLabel(source: QuotaSource, isFa: boolean): string {
  switch (source) {
    case "manual_plan":
      return isFa ? "سقف پلن من" : "Plan Limit";
    case "env_override":
      return isFa ? "تنظیم محیطی" : "Env Quota";
    case "linux_quota":
      return isFa ? "سهمیه لینوکس" : "Linux Quota";
    case "cgroup_v2":
      return isFa ? "خودکار (cgroup v2)" : "Auto (cgroup v2)";
    case "cgroup_v1":
      return isFa ? "خودکار (cgroup v1)" : "Auto (cgroup v1)";
    case "host_fallback":
    default:
      return isFa ? "سقف هاست (قابل تنظیم)" : "Host Cap (Editable)";
  }
}
