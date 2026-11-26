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
  telegramApiBaseUrl: string;
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
  telegramApiBaseUrl: string;
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
    apiBaseUrl: boolean;
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
  telegramApiBaseUrl: "",
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
// Telegram Input Normalizers & Safe Bot API Base URL Validation
// ============================================================================

const ZERO_WIDTH_RE = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

/** Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits and minus signs to ASCII. */
export function normalizeDigitsToAscii(raw: string): string {
  return raw
    .replace(ZERO_WIDTH_RE, "")
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[−–—]/g, "-");
}

/**
 * Normalizes Telegram Bot Token pasted by admins:
 * strips whitespace/invisible chars, converts Persian digits in the bot ID,
 * and removes an accidental leading "bot" prefix (e.g. "bot123456:AAH...").
 */
export function normalizeTelegramBotToken(raw: string): string {
  const cleaned = raw.replace(ZERO_WIDTH_RE, "").replace(/\s+/g, "").trim();
  if (!cleaned) return "";
  const withoutPrefix = cleaned.replace(/^bot(?=[\d\u06F0-\u06F9\u0660-\u0669]+:)/i, "");
  const colonIdx = withoutPrefix.indexOf(":");
  if (colonIdx === -1) return normalizeDigitsToAscii(withoutPrefix);
  const botId = normalizeDigitsToAscii(withoutPrefix.slice(0, colonIdx));
  const secretPart = withoutPrefix.slice(colonIdx + 1);
  return `${botId}:${secretPart}`;
}

/**
 * Normalizes Target Chat / Channel ID:
 * converts Persian/Arabic digits and turns pasted t.me links into @username or -100<id>.
 */
export function normalizeTelegramChatId(raw: string): string {
  const cleaned = normalizeDigitsToAscii(raw).trim();
  if (!cleaned) return "";

  // Handle private supergroup/channel message link: https://t.me/c/1234567890/12 -> -1001234567890
  const privateLink = cleaned.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/c\/(\d+)(?:\/.*)?$/i
  );
  if (privateLink) {
    return `-100${privateLink[1]}`;
  }

  // Handle public channel/username link: https://t.me/my_channel -> @my_channel
  const publicLink = cleaned.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([a-zA-Z][a-zA-Z0-9_]{3,63})(?:\/.*)?$/i
  );
  if (publicLink) {
    return `@${publicLink[1]}`;
  }

  return cleaned.replace(/\s+/g, "");
}

/** Normalizes Telegram numeric api_id (converts Persian/Arabic digits, strips spaces). */
export function normalizeTelegramApiId(raw: string): string {
  return normalizeDigitsToAscii(raw).replace(/\s+/g, "").trim();
}

/** Normalizes optional forum topic / message_thread_id. */
export function normalizeTelegramThreadId(raw: string): string {
  return normalizeDigitsToAscii(raw).replace(/\s+/g, "").trim();
}

/** Returns true if an IPv4 or IPv6 address is loopback, private, link-local, or reserved. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const lower = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!lower) return true;

  // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice(7);
    if (mapped.includes(".")) {
      return isPrivateOrReservedIp(mapped);
    }
    const hexParts = mapped.split(":");
    if (hexParts.length === 2) {
      const hi = Number.parseInt(hexParts[0], 16);
      const lo = Number.parseInt(hexParts[1], 16);
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateOrReservedIp(ipv4);
      }
    }
    return true;
  }

  // IPv4 dotted quad
  const v4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    const c = Number(v4[3]);
    const d = Number(v4[4]);
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
    if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking
    if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  // IPv6 addresses
  if (lower.includes(":")) {
    if (lower === "::" || lower === "::1") return true;
    if (/^0*:0*:0*:0*:0*:0*:0*:0*[01]$/.test(lower)) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
    if (/^fe[89ab]/.test(lower)) return true; // Link-local fe80::/10
    if (lower.startsWith("ff")) return true; // Multicast
    if (lower.startsWith("100::")) return true; // Discard prefix
    return false;
  }

  return false;
}

/**
 * Validates an optional custom Telegram Bot API HTTPS reverse-proxy URL
 * (e.g., a Cloudflare Worker endpoint for hosts where api.telegram.org is blocked).
 * Rejects non-HTTPS schemes, credentials, query strings, localhost, internal hostnames,
 * and private/loopback/metadata IP addresses.
 */
export function validateTelegramApiBaseUrl(
  raw: string
): { ok: true; normalized: string } | { ok: false; error: string } {
  const trimmed = raw.replace(ZERO_WIDTH_RE, "").trim();
  if (!trimmed) {
    return { ok: true, normalized: "" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: "Custom Telegram API URL must be a valid HTTPS URL (e.g. https://my-proxy.workers.dev).",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      error: "Custom Telegram API URL must use HTTPS.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: "Custom Telegram API URL cannot include embedded credentials.",
    };
  }

  if (parsed.search || parsed.hash) {
    return {
      ok: false,
      error: "Custom Telegram API URL cannot include query parameters or hash fragments.",
    };
  }

  if (parsed.port && parsed.port !== "443" && parsed.port !== "8443") {
    return {
      ok: false,
      error: "Custom Telegram API URL must use standard HTTPS port 443 (or 8443).",
    };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || !host.includes(".")) {
    return {
      ok: false,
      error: "Custom Telegram API URL must point to a public domain name.",
    };
  }

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".arpa") ||
    host === "metadata.google.internal"
  ) {
    return {
      ok: false,
      error: "Local or internal hostnames are not permitted for Telegram API URL.",
    };
  }

  // Reject raw IPv4/IPv6 literals that resolve to private/loopback/metadata ranges
  const bareHost = host.replace(/^\[|\]$/g, "");
  if (
    /^\d+$/.test(bareHost) ||
    /^0x[0-9a-f]+$/i.test(bareHost) ||
    isPrivateOrReservedIp(bareHost)
  ) {
    return {
      ok: false,
      error: "Private, loopback, or reserved IP addresses are not permitted.",
    };
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  return {
    ok: true,
    normalized: `${parsed.origin}${cleanPath}`,
  };
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
    .default("")
    .transform((val) => normalizeTelegramChatId(val))
    .refine((val) => val.length <= 64, "Chat ID is too long")
    .refine(
      (val) => val === "" || /^-?\d+$/.test(val) || /^@[a-zA-Z][a-zA-Z0-9_]{3,63}$/.test(val),
      "Chat ID must be numeric (e.g. -1001234567890) or @channel_username"
    ),
  telegramThreadId: z
    .string()
    .default("")
    .transform((val) => normalizeTelegramThreadId(val))
    .refine((val) => val.length <= 32, "Thread ID is too long")
    .refine((val) => val === "" || /^\d+$/.test(val), "Thread ID must be a positive integer"),
  telegramBotToken: z
    .string()
    .max(256)
    .transform((val) => normalizeTelegramBotToken(val))
    .optional(),
  clearBotToken: z.boolean().optional(),
  telegramApiId: z
    .string()
    .default("")
    .transform((val) => normalizeTelegramApiId(val))
    .refine((val) => val.length <= 32, "api_id is too long")
    .refine((val) => val === "" || /^\d{4,12}$/.test(val), "Telegram api_id must be a numeric ID"),
  telegramApiHash: z
    .string()
    .max(128)
    .transform((val) => val.replace(ZERO_WIDTH_RE, "").trim())
    .optional(),
  clearApiHash: z.boolean().optional(),
  telegramApiBaseUrl: z
    .string()
    .max(256)
    .default("")
    .superRefine((val, ctx) => {
      const checked = validateTelegramApiBaseUrl(val);
      if (!checked.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: checked.error,
        });
      }
    })
    .transform((val) => {
      const checked = validateTelegramApiBaseUrl(val);
      return checked.ok ? checked.normalized : "";
    }),
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
