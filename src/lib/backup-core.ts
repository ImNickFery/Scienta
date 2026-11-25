import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// ============================================================================
// Types & Constants
// ============================================================================

export type TelegramTransportPreference = "auto" | "mtproto" | "bot_api";
export type TelegramActualTransport = "mtproto" | "bot_api" | "dry_run";
export type BackupTriggerSource = "scheduled" | "manual" | "cron" | "dry_run";
export type BackupRunStatus = "running" | "success" | "partial" | "failed" | "dry_run";

export const BACKUP_SETTINGS_KEY = "backup_telegram_settings";

/** Telegram standard Bot API hard upload cap (50 MB; keep 1 MB safety margin). */
export const BOT_API_MAX_BYTES = 49 * 1024 * 1024;

/** Telegram MTProto (api_id + api_hash) upload limit (2 GB; keep small safety margin). */
export const MTPROTO_MAX_BYTES = 1_990 * 1024 * 1024;

export interface BackupSettingsStored {
  enabled: boolean;
  scheduleUtcHour: number;
  scheduleUtcMinute: number;
  transportMode: TelegramTransportPreference;
  telegramChatId: string;
  telegramThreadId: string;
  telegramBotTokenEncrypted: string;
  telegramApiId: string;
  telegramApiHashEncrypted: string;
  cronSecretEncrypted: string;
  includeEnvFile: boolean;
  includeNodeModules: boolean;
  includeNextBuild: boolean;
  includeGitDir: boolean;
  compressionLevel: number;
  cleanupVerifyPasses: number;
  notifyCleanupSummary: boolean;
  lastScheduledUtcDate: string;
}

export interface BackupSettingsPublic {
  enabled: boolean;
  scheduleUtcHour: number;
  scheduleUtcMinute: number;
  transportMode: TelegramTransportPreference;
  telegramChatId: string;
  telegramThreadId: string;
  telegramApiId: string;
  hasBotToken: boolean;
  hasApiHash: boolean;
  hasCronSecret: boolean;
  mtprotoReady: boolean;
  botApiReady: boolean;
  envOverrides: {
    botToken: boolean;
    chatId: boolean;
    apiId: boolean;
    apiHash: boolean;
    cronSecret: boolean;
  };
  includeEnvFile: boolean;
  includeNodeModules: boolean;
  includeNextBuild: boolean;
  includeGitDir: boolean;
  compressionLevel: number;
  cleanupVerifyPasses: number;
  notifyCleanupSummary: boolean;
  lastScheduledUtcDate: string;
  nextScheduledRunUtc: string;
}

export const DEFAULT_BACKUP_SETTINGS: BackupSettingsStored = {
  enabled: true,
  scheduleUtcHour: 0,
  scheduleUtcMinute: 0,
  transportMode: "auto",
  telegramChatId: "",
  telegramThreadId: "",
  telegramBotTokenEncrypted: "",
  telegramApiId: "",
  telegramApiHashEncrypted: "",
  cronSecretEncrypted: "",
  includeEnvFile: true,
  includeNodeModules: false,
  includeNextBuild: false,
  includeGitDir: false,
  compressionLevel: 6,
  cleanupVerifyPasses: 3,
  notifyCleanupSummary: true,
  lastScheduledUtcDate: "",
};

export interface CleanupPassEntry {
  pass: number;
  checkedAt: string;
  dbArchiveExists: boolean;
  fullArchiveExists: boolean;
  runDirExists: boolean;
  stagingRemainingFiles: number;
  stagingRemainingBytes: number;
  forcedResweep: boolean;
  passed: boolean;
}

export interface CleanupVerificationReport {
  passesPlanned: number;
  passesCompleted: number;
  verified: boolean;
  remainingFiles: number;
  remainingBytes: number;
  passes: CleanupPassEntry[];
}

export interface BackupDiskInspection {
  stagingRoot: string;
  exists: boolean;
  fileCount: number;
  dirCount: number;
  totalBytes: number;
  leftoverEntries: string[];
  clean: boolean;
}

// ============================================================================
// Validation Schemas
// ============================================================================

export const backupSettingsUpdateSchema = z.object({
  enabled: z.boolean().default(true),
  scheduleUtcHour: z.coerce.number().int().min(0).max(23).default(0),
  scheduleUtcMinute: z.coerce.number().int().min(0).max(59).default(0),
  transportMode: z.enum(["auto", "mtproto", "bot_api"]).default("auto"),
  telegramChatId: z
    .string()
    .trim()
    .max(64)
    .refine(
      (val) => val === "" || /^-?\d+$/.test(val) || /^@[a-zA-Z][a-zA-Z0-9_]{3,63}$/.test(val),
      "Chat ID must be numeric (e.g. -1001234567890) or @channel_username"
    )
    .default(""),
  telegramThreadId: z
    .string()
    .trim()
    .max(32)
    .refine((val) => val === "" || /^\d+$/.test(val), "Thread ID must be a positive integer")
    .default(""),
  telegramBotToken: z.string().trim().max(256).optional(),
  clearBotToken: z.boolean().optional(),
  telegramApiId: z
    .string()
    .trim()
    .max(32)
    .refine((val) => val === "" || /^\d{4,12}$/.test(val), "Telegram api_id must be a numeric ID")
    .default(""),
  telegramApiHash: z.string().trim().max(128).optional(),
  clearApiHash: z.boolean().optional(),
  includeEnvFile: z.boolean().default(true),
  includeNodeModules: z.boolean().default(false),
  includeNextBuild: z.boolean().default(false),
  includeGitDir: z.boolean().default(false),
  compressionLevel: z.coerce.number().int().min(1).max(9).default(6),
  cleanupVerifyPasses: z.coerce.number().int().min(2).max(5).default(3),
  notifyCleanupSummary: z.boolean().default(true),
});

// ============================================================================
// AES-256-GCM Secret Encryption & Sanitization
// ============================================================================

function deriveBackupKey(secretMaterial?: string): Buffer {
  const source =
    secretMaterial ||
    process.env.BACKUP_ENCRYPTION_KEY?.trim() ||
    process.env.SMTP_ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "scienta-local-ephemeral-backup-key-v1";
  return crypto.createHash("sha256").update(source).digest();
}

export function encryptBackupSecret(plaintext: string, secretMaterial?: string): string {
  if (!plaintext) return "";
  const key = deriveBackupKey(secretMaterial);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptBackupSecret(ciphertext: string, secretMaterial?: string): string {
  if (!ciphertext) return "";
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return "";
  try {
    const key = deriveBackupKey(secretMaterial);
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const data = Buffer.from(parts[3], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** Redacts Telegram bot tokens and 32-hex api_hash strings from error logs. */
export function redactBackupSecrets(message: string): string {
  return message
    .replace(/\b\d{6,14}:[A-Za-z0-9_-]{20,80}\b/g, "[REDACTED_BOT_TOKEN]")
    .replace(/bot\d{6,14}:[A-Za-z0-9_-]{20,80}/gi, "bot[REDACTED_BOT_TOKEN]")
    .replace(/\b[a-f0-9]{32}\b/gi, (match) =>
      // Preserve obvious SHA/UUID substrings only when clearly labelled; redact standalone 32-hex hashes
      match.length === 32 ? "[REDACTED_HASH]" : match
    );
}

/** Constant-time string comparison for cron bearer secret verification. */
export function timingSafeEqualSecret(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ============================================================================
// UTC Schedule Math (Default 00:00 UTC)
// ============================================================================

export function formatUtcDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatUtcArchiveStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}${ss}-UTC`;
}

/**
 * Computes the next scheduled UTC execution timestamp strictly in the future
 * relative to `now` for the configured UTC hour and minute (default 00:00 UTC).
 */
export function computeNextScheduledUtcRun(
  hour: number,
  minute: number,
  now: Date = new Date()
): Date {
  const safeHour = Math.max(0, Math.min(23, Math.floor(hour)));
  const safeMinute = Math.max(0, Math.min(59, Math.floor(minute)));

  const candidate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      safeHour,
      safeMinute,
      0,
      0
    )
  );

  if (candidate.getTime() <= now.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

/**
 * Determines whether today's UTC scheduled backup is currently due to fire.
 * Triggers within a generous catch-up window after the target UTC minute
 * if today's UTC date hasn't already executed.
 */
export function isScheduledRunDue(params: {
  enabled: boolean;
  scheduleUtcHour: number;
  scheduleUtcMinute: number;
  lastScheduledUtcDate: string;
  now?: Date;
}): boolean {
  if (!params.enabled) return false;
  const now = params.now ?? new Date();
  const todayUtc = formatUtcDateStamp(now);
  if (params.lastScheduledUtcDate === todayUtc) return false;

  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const targetMinutes = params.scheduleUtcHour * 60 + params.scheduleUtcMinute;
  // Trigger if we are at or past target UTC time today (within 30-minute window to avoid
  // surprising mid-day triggers when a brand-new server boots hours later, while catching slight delays)
  return currentMinutes >= targetMinutes && currentMinutes <= targetMinutes + 30;
}

// ============================================================================
// Telegram Transport Selection (MTProto 2 GB vs Bot API 50 MB)
// ============================================================================

export interface TransportSelectionResult {
  ok: boolean;
  transport?: "mtproto" | "bot_api";
  error?: string;
}

export function selectTelegramTransport(params: {
  preference: TelegramTransportPreference;
  fileSizeBytes: number;
  hasBotToken: boolean;
  hasApiId: boolean;
  hasApiHash: boolean;
}): TransportSelectionResult {
  if (!params.hasBotToken) {
    return { ok: false, error: "Telegram Bot Token is not configured." };
  }

  const mtprotoCapable = params.hasApiId && params.hasApiHash;

  if (params.fileSizeBytes > MTPROTO_MAX_BYTES) {
    return {
      ok: false,
      error: `Archive size (${formatBytes(params.fileSizeBytes)}) exceeds Telegram's 2 GB single-file limit.`,
    };
  }

  if (params.preference === "mtproto") {
    if (!mtprotoCapable) {
      return {
        ok: false,
        error: "MTProto mode requires both Telegram api_id and api_hash.",
      };
    }
    return { ok: true, transport: "mtproto" };
  }

  if (params.preference === "bot_api") {
    if (params.fileSizeBytes > BOT_API_MAX_BYTES) {
      return {
        ok: false,
        error: `File (${formatBytes(params.fileSizeBytes)}) exceeds Telegram Bot API 50 MB limit. Switch to Auto/MTProto and configure api_id & api_hash.`,
      };
    }
    return { ok: true, transport: "bot_api" };
  }

  // Auto mode: prefer MTProto whenever api_id + api_hash are configured (handles up to 2 GB smoothly)
  if (mtprotoCapable) {
    return { ok: true, transport: "mtproto" };
  }

  if (params.fileSizeBytes <= BOT_API_MAX_BYTES) {
    return { ok: true, transport: "bot_api" };
  }

  return {
    ok: false,
    error: `File (${formatBytes(params.fileSizeBytes)}) exceeds 50 MB Bot API limit. Configure Telegram api_id and api_hash to unlock 2 GB MTProto uploads.`,
  };
}

// ============================================================================
// Staging Path Confinement & Site Archive Exclusion Rules
// ============================================================================

export function getBackupStagingRoot(appRoot: string = process.cwd()): string {
  return path.resolve(appRoot, "tmp", "scienta-backups");
}

/**
 * Guarantees that any path written to or deleted by the backup engine stays
 * strictly inside the dedicated backup staging root.
 */
export function assertInsideBackupStaging(targetPath: string, stagingRoot: string): string {
  const resolvedRoot = path.resolve(stagingRoot);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget === resolvedRoot) {
    throw new Error("Refusing to operate directly on staging root boundary.");
  }
  if (!resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Path escapes backup staging boundary: ${resolvedTarget}`);
  }
  return resolvedTarget;
}

export interface SiteArchiveFilterOptions {
  includeEnvFile: boolean;
  includeNodeModules: boolean;
  includeNextBuild: boolean;
  includeGitDir: boolean;
}

/**
 * Decides whether a relative POSIX path inside the site root should be archived.
 * ALWAYS excludes the backup staging folder, Playwright browser artifacts, and OS junk
 * to prevent infinite recursion and bloated temp archives.
 */
export function shouldIncludeSitePath(
  relativePosixPath: string,
  options: SiteArchiveFilterOptions
): boolean {
  const clean = relativePosixPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean) return false;

  const segments = clean.split("/");
  const first = segments[0];

  // Hard exclusions (anti-recursion & transient runtime caches)
  if (clean === "tmp/scienta-backups" || clean.startsWith("tmp/scienta-backups/")) return false;
  if (first === ".playwright-cli" || first === ".aistudio") return false;
  if (first === "deploy" && segments[1] === "tmp") return false;
  if (segments.includes(".DS_Store") || segments.includes("Thumbs.db")) return false;

  // Configurable heavy/sensitive directories
  if (!options.includeNodeModules && first === "node_modules") return false;
  if (!options.includeNextBuild && (first === ".next" || first === ".turbo")) return false;
  if (!options.includeGitDir && first === ".git") return false;
  if (!options.includeEnvFile && (clean === ".env" || clean.startsWith(".env.local"))) return false;

  return true;
}

// ============================================================================
// Multi-Pass Verified Host Cleanup Engine
// ============================================================================

function walkStagingStats(dir: string, baseRoot: string): {
  fileCount: number;
  dirCount: number;
  totalBytes: number;
  entries: string[];
} {
  let fileCount = 0;
  let dirCount = 0;
  let totalBytes = 0;
  const entries: string[] = [];

  if (!fs.existsSync(dir)) {
    return { fileCount, dirCount, totalBytes, entries };
  }

  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, dirent.name);
    const rel = path.relative(baseRoot, full).replace(/\\/g, "/");
    if (dirent.isDirectory()) {
      dirCount += 1;
      entries.push(`${rel}/`);
      const child = walkStagingStats(full, baseRoot);
      fileCount += child.fileCount;
      dirCount += child.dirCount;
      totalBytes += child.totalBytes;
      entries.push(...child.entries);
    } else {
      fileCount += 1;
      entries.push(rel);
      try {
        totalBytes += fs.lstatSync(full).size;
      } catch {
        // File vanished concurrently
      }
    }
  }

  return { fileCount, dirCount, totalBytes, entries };
}

export function inspectBackupStagingDisk(stagingRoot: string): BackupDiskInspection {
  const resolvedRoot = path.resolve(stagingRoot);
  const exists = fs.existsSync(resolvedRoot);
  if (!exists) {
    return {
      stagingRoot: resolvedRoot,
      exists: false,
      fileCount: 0,
      dirCount: 0,
      totalBytes: 0,
      leftoverEntries: [],
      clean: true,
    };
  }
  const stats = walkStagingStats(resolvedRoot, resolvedRoot);
  return {
    stagingRoot: resolvedRoot,
    exists: true,
    fileCount: stats.fileCount,
    dirCount: stats.dirCount,
    totalBytes: stats.totalBytes,
    leftoverEntries: stats.entries.slice(0, 50),
    clean: stats.fileCount === 0 && stats.dirCount === 0,
  };
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function purgeChildrenInsideStaging(stagingRoot: string): void {
  const resolvedRoot = path.resolve(stagingRoot);
  if (!fs.existsSync(resolvedRoot)) return;
  for (const dirent of fs.readdirSync(resolvedRoot, { withFileTypes: true })) {
    const child = assertInsideBackupStaging(path.join(resolvedRoot, dirent.name), resolvedRoot);
    fs.rmSync(child, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

/**
 * Deletes backup artifacts and performs N independent verification passes
 * (default 3 passes) confirming that neither archive file, nor the run directory,
 * nor any stray file in the backup staging root remains on the host disk.
 */
export async function verifyAndPurgeBackupArtifacts(params: {
  stagingRoot: string;
  runDir: string;
  artifactPaths: string[];
  passes?: number;
  passDelayMs?: number;
}): Promise<CleanupVerificationReport> {
  const resolvedRoot = path.resolve(params.stagingRoot);
  const safeRunDir = assertInsideBackupStaging(params.runDir, resolvedRoot);
  const safeArtifacts = params.artifactPaths
    .filter(Boolean)
    .map((p) => assertInsideBackupStaging(p, resolvedRoot));

  const plannedPasses = Math.max(2, Math.min(5, Math.floor(params.passes ?? 3)));
  const baseDelay = Math.max(0, Math.min(2000, params.passDelayMs ?? 350));

  // Initial purge pass: remove individual archive files first, then run dir, then any staging leftovers
  for (const artifact of safeArtifacts) {
    try {
      if (fs.existsSync(artifact)) {
        fs.rmSync(artifact, { force: true, maxRetries: 3, retryDelay: 100 });
      }
    } catch {
      // Will be retried and caught in verification passes
    }
  }
  try {
    if (fs.existsSync(safeRunDir)) {
      fs.rmSync(safeRunDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  } catch {
    // Will be retried in verification passes
  }

  const passes: CleanupPassEntry[] = [];

  for (let pass = 1; pass <= plannedPasses; pass += 1) {
    if (baseDelay > 0) {
      await sleepMs(baseDelay * pass);
    }

    let dbArchiveExists = safeArtifacts[0] ? fs.existsSync(safeArtifacts[0]) : false;
    let fullArchiveExists = safeArtifacts[1] ? fs.existsSync(safeArtifacts[1]) : false;
    let runDirExists = fs.existsSync(safeRunDir);
    let disk = inspectBackupStagingDisk(resolvedRoot);
    let forcedResweep = false;

    if (dbArchiveExists || fullArchiveExists || runDirExists || disk.fileCount > 0 || disk.dirCount > 0) {
      forcedResweep = true;
      for (const artifact of safeArtifacts) {
        try {
          if (fs.existsSync(artifact)) {
            fs.rmSync(artifact, { force: true, maxRetries: 3, retryDelay: 100 });
          }
        } catch {
          // Recorded below
        }
      }
      try {
        if (fs.existsSync(safeRunDir)) {
          fs.rmSync(safeRunDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        }
      } catch {
        // Recorded below
      }
      try {
        purgeChildrenInsideStaging(resolvedRoot);
      } catch {
        // Recorded below
      }

      dbArchiveExists = safeArtifacts[0] ? fs.existsSync(safeArtifacts[0]) : false;
      fullArchiveExists = safeArtifacts[1] ? fs.existsSync(safeArtifacts[1]) : false;
      runDirExists = fs.existsSync(safeRunDir);
      disk = inspectBackupStagingDisk(resolvedRoot);
    }

    const passed =
      !dbArchiveExists &&
      !fullArchiveExists &&
      !runDirExists &&
      disk.fileCount === 0 &&
      disk.dirCount === 0;

    passes.push({
      pass,
      checkedAt: new Date().toISOString(),
      dbArchiveExists,
      fullArchiveExists,
      runDirExists,
      stagingRemainingFiles: disk.fileCount,
      stagingRemainingBytes: disk.totalBytes,
      forcedResweep,
      passed,
    });
  }

  const last = passes[passes.length - 1];
  const allClean = Boolean(last?.passed);

  return {
    passesPlanned: plannedPasses,
    passesCompleted: passes.length,
    verified: allClean,
    remainingFiles: last?.stagingRemainingFiles ?? 0,
    remainingBytes: last?.stagingRemainingBytes ?? 0,
    passes,
  };
}

// ============================================================================
// Formatting Helpers
// ============================================================================

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const decimals = idx === 0 ? 0 : value >= 100 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[idx]}`;
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${mins}m ${rem}s`;
}

export function formatUtcClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} UTC`;
}
