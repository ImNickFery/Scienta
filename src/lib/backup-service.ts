import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type * as ArchiverTypes from "archiver";
import mysql from "mysql2";
import { v4 as uuid } from "uuid";
import { execute, getActiveDbEngine, query, queryOne } from "./db";
import { logActivity } from "./activity-log";
import {
  assertInsideBackupStaging,
  BACKUP_SETTINGS_KEY,
  backupSettingsUpdateSchema,
  computeNextScheduledUtcRun,
  decryptBackupSecret,
  DEFAULT_BACKUP_SETTINGS,
  encryptBackupSecret,
  formatBytes,
  formatDurationMs,
  formatUtcArchiveStamp,
  formatUtcClock,
  formatUtcDateStamp,
  getBackupStagingRoot,
  inspectBackupStagingDisk,
  redactBackupSecrets,
  shouldIncludeSitePath,
  verifyAndPurgeBackupArtifacts,
  type BackupDiskInspection,
  type BackupRunStatus,
  type BackupSettingsPublic,
  type BackupSettingsStored,
  type BackupTriggerSource,
  type CleanupVerificationReport,
  type TelegramActualTransport,
} from "./backup-core";
import {
  sendTelegramStatusMessage,
  testTelegramConnection,
  uploadBackupFileToTelegram,
  type TelegramConnectionTestResult,
  type TelegramCredentials,
} from "./backup-telegram";

declare global {
  var __scientaBackupSchemaReady: boolean | undefined;
  var __scientaBackupSchemaPromise: Promise<void> | null | undefined;
  var __scientaBackupActiveRunId: string | null | undefined;
}

export interface BackupRunRecord {
  id: string;
  triggerSource: BackupTriggerSource;
  status: BackupRunStatus;
  dbEngine: "mysql" | "sqlite";
  dbFileName: string | null;
  dbSizeBytes: number;
  dbSha256: string | null;
  dbTableCount: number;
  dbTelegramMessageId: string | null;
  dbTransport: TelegramActualTransport | null;
  fullFileName: string | null;
  fullSizeBytes: number;
  fullSha256: string | null;
  fullFileCount: number;
  fullTelegramMessageId: string | null;
  fullTransport: TelegramActualTransport | null;
  cleanupPasses: number;
  cleanupVerified: boolean;
  cleanupRemainingFiles: number;
  cleanupLog: CleanupVerificationReport | null;
  durationMs: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  triggeredBy: string | null;
}

export interface ResolvedBackupSettings extends BackupSettingsStored {
  effectiveBotToken: string;
  effectiveChatId: string;
  effectiveApiId: string;
  effectiveApiHash: string;
  effectiveApiBaseUrl: string;
  effectiveCronSecret: string;
  envOverrides: {
    botToken: boolean;
    chatId: boolean;
    apiId: boolean;
    apiHash: boolean;
    apiBaseUrl: boolean;
    cronSecret: boolean;
  };
}

// ============================================================================
// Schema Bootstrapping (MySQL & SQLite Idempotent)
// ============================================================================

export async function ensureBackupSchema(): Promise<void> {
  if (globalThis.__scientaBackupSchemaReady) return;
  if (globalThis.__scientaBackupSchemaPromise) return globalThis.__scientaBackupSchemaPromise;

  globalThis.__scientaBackupSchemaPromise = (async () => {
    const engine = getActiveDbEngine();
    if (engine === "sqlite") {
      await execute(`
        CREATE TABLE IF NOT EXISTS backup_runs (
          id TEXT NOT NULL PRIMARY KEY,
          trigger_source TEXT NOT NULL DEFAULT 'manual',
          status TEXT NOT NULL DEFAULT 'running',
          db_engine TEXT NOT NULL DEFAULT 'sqlite',
          db_file_name TEXT NULL,
          db_size_bytes INTEGER NOT NULL DEFAULT 0,
          db_sha256 TEXT NULL,
          db_table_count INTEGER NOT NULL DEFAULT 0,
          db_telegram_message_id TEXT NULL,
          db_transport TEXT NULL,
          full_file_name TEXT NULL,
          full_size_bytes INTEGER NOT NULL DEFAULT 0,
          full_sha256 TEXT NULL,
          full_file_count INTEGER NOT NULL DEFAULT 0,
          full_telegram_message_id TEXT NULL,
          full_transport TEXT NULL,
          cleanup_passes INTEGER NOT NULL DEFAULT 0,
          cleanup_verified INTEGER NOT NULL DEFAULT 0,
          cleanup_remaining_files INTEGER NOT NULL DEFAULT 0,
          cleanup_log_json TEXT NULL,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          error_message TEXT NULL,
          triggered_by TEXT NULL,
          started_at TEXT NOT NULL DEFAULT (datetime('now')),
          finished_at TEXT NULL
        )
      `);
      await execute(
        `CREATE INDEX IF NOT EXISTS idx_backup_runs_started_at ON backup_runs (started_at DESC)`
      );
    } else {
      await execute(`
        CREATE TABLE IF NOT EXISTS backup_runs (
          id CHAR(36) NOT NULL PRIMARY KEY,
          trigger_source VARCHAR(24) NOT NULL DEFAULT 'manual',
          status VARCHAR(24) NOT NULL DEFAULT 'running',
          db_engine VARCHAR(16) NOT NULL DEFAULT 'mysql',
          db_file_name VARCHAR(255) NULL,
          db_size_bytes BIGINT NOT NULL DEFAULT 0,
          db_sha256 VARCHAR(64) NULL,
          db_table_count INT NOT NULL DEFAULT 0,
          db_telegram_message_id VARCHAR(64) NULL,
          db_transport VARCHAR(24) NULL,
          full_file_name VARCHAR(255) NULL,
          full_size_bytes BIGINT NOT NULL DEFAULT 0,
          full_sha256 VARCHAR(64) NULL,
          full_file_count INT NOT NULL DEFAULT 0,
          full_telegram_message_id VARCHAR(64) NULL,
          full_transport VARCHAR(24) NULL,
          cleanup_passes INT NOT NULL DEFAULT 0,
          cleanup_verified TINYINT(1) NOT NULL DEFAULT 0,
          cleanup_remaining_files INT NOT NULL DEFAULT 0,
          cleanup_log_json LONGTEXT NULL,
          duration_ms INT NOT NULL DEFAULT 0,
          error_message TEXT NULL,
          triggered_by CHAR(36) NULL,
          started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          finished_at DATETIME NULL,
          INDEX idx_backup_runs_started_at (started_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }
    globalThis.__scientaBackupSchemaReady = true;
  })().finally(() => {
    globalThis.__scientaBackupSchemaPromise = null;
  });

  return globalThis.__scientaBackupSchemaPromise;
}

// ============================================================================
// Settings Management (AES-256-GCM at rest + ENV overrides)
// ============================================================================

async function writeStoredSettings(next: BackupSettingsStored): Promise<void> {
  const serialized = JSON.stringify(next);
  const existing = await queryOne<{ key: string }>(
    "SELECT `key` FROM settings WHERE `key` = ? LIMIT 1",
    [BACKUP_SETTINGS_KEY]
  );
  if (existing) {
    await execute("UPDATE settings SET `value` = ?, updated_at = NOW() WHERE `key` = ?", [
      serialized,
      BACKUP_SETTINGS_KEY,
    ]);
  } else {
    await execute(
      "INSERT INTO settings (`key`, `value`, updated_at) VALUES (?, ?, NOW())",
      [BACKUP_SETTINGS_KEY, serialized]
    );
  }
}

export async function getResolvedBackupSettings(): Promise<ResolvedBackupSettings> {
  await ensureBackupSchema();
  const row = await queryOne<{ value: string | null }>(
    "SELECT `value` FROM settings WHERE `key` = ? LIMIT 1",
    [BACKUP_SETTINGS_KEY]
  );

  let stored: BackupSettingsStored = { ...DEFAULT_BACKUP_SETTINGS };
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value) as Partial<BackupSettingsStored>;
      stored = { ...DEFAULT_BACKUP_SETTINGS, ...parsed };
    } catch {
      stored = { ...DEFAULT_BACKUP_SETTINGS };
    }
  }

  const envBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const envChatId = process.env.TELEGRAM_BACKUP_CHAT_ID?.trim() || "";
  const envApiId = process.env.TELEGRAM_API_ID?.trim() || "";
  const envApiHash = process.env.TELEGRAM_API_HASH?.trim() || "";
  const envApiBaseUrl = process.env.TELEGRAM_API_BASE_URL?.trim() || "";
  const envCronSecret = process.env.BACKUP_CRON_SECRET?.trim() || "";

  const effectiveBotToken = envBotToken || decryptBackupSecret(stored.telegramBotTokenEncrypted);
  const effectiveChatId = envChatId || stored.telegramChatId;
  const effectiveApiId = envApiId || stored.telegramApiId;
  const effectiveApiHash = envApiHash || decryptBackupSecret(stored.telegramApiHashEncrypted);
  const effectiveApiBaseUrl = envApiBaseUrl || stored.telegramApiBaseUrl || "";
  const effectiveCronSecret = envCronSecret || decryptBackupSecret(stored.cronSecretEncrypted);

  return {
    ...stored,
    effectiveBotToken,
    effectiveChatId,
    effectiveApiId,
    effectiveApiHash,
    effectiveApiBaseUrl,
    effectiveCronSecret,
    envOverrides: {
      botToken: Boolean(envBotToken),
      chatId: Boolean(envChatId),
      apiId: Boolean(envApiId),
      apiHash: Boolean(envApiHash),
      apiBaseUrl: Boolean(envApiBaseUrl),
      cronSecret: Boolean(envCronSecret),
    },
  };
}

export function toPublicBackupSettings(resolved: ResolvedBackupSettings): BackupSettingsPublic {
  const hasBotToken = Boolean(resolved.effectiveBotToken);
  const hasApiHash = Boolean(resolved.effectiveApiHash);
  const hasApiId = Boolean(resolved.effectiveApiId);
  const nextRun = computeNextScheduledUtcRun(
    resolved.scheduleUtcHour,
    resolved.scheduleUtcMinute
  );

  return {
    enabled: resolved.enabled,
    scheduleUtcHour: resolved.scheduleUtcHour,
    scheduleUtcMinute: resolved.scheduleUtcMinute,
    transportMode: resolved.transportMode,
    telegramChatId: resolved.effectiveChatId,
    telegramThreadId: resolved.telegramThreadId,
    telegramApiId: resolved.effectiveApiId,
    telegramApiBaseUrl: resolved.effectiveApiBaseUrl,
    hasBotToken,
    hasApiHash,
    hasCronSecret: Boolean(resolved.effectiveCronSecret),
    mtprotoReady: hasBotToken && hasApiId && hasApiHash && Boolean(resolved.effectiveChatId),
    botApiReady: hasBotToken && Boolean(resolved.effectiveChatId),
    envOverrides: resolved.envOverrides,
    includeEnvFile: resolved.includeEnvFile,
    includeNodeModules: resolved.includeNodeModules,
    includeNextBuild: resolved.includeNextBuild,
    includeGitDir: resolved.includeGitDir,
    compressionLevel: resolved.compressionLevel,
    cleanupVerifyPasses: resolved.cleanupVerifyPasses,
    notifyCleanupSummary: resolved.notifyCleanupSummary,
    lastScheduledUtcDate: resolved.lastScheduledUtcDate,
    nextScheduledRunUtc: nextRun.toISOString(),
  };
}

export async function getPublicBackupSettings(): Promise<BackupSettingsPublic> {
  const resolved = await getResolvedBackupSettings();
  return toPublicBackupSettings(resolved);
}

export async function updateBackupSettings(
  input: unknown,
  actorUserId: string | null
): Promise<BackupSettingsPublic> {
  const parsed = backupSettingsUpdateSchema.parse(input);
  const current = await getResolvedBackupSettings();

  let telegramBotTokenEncrypted = current.telegramBotTokenEncrypted;
  if (parsed.clearBotToken) {
    telegramBotTokenEncrypted = "";
  } else if (parsed.telegramBotToken && parsed.telegramBotToken.length > 0) {
    telegramBotTokenEncrypted = encryptBackupSecret(parsed.telegramBotToken);
  }

  let telegramApiHashEncrypted = current.telegramApiHashEncrypted;
  if (parsed.clearApiHash) {
    telegramApiHashEncrypted = "";
  } else if (parsed.telegramApiHash && parsed.telegramApiHash.length > 0) {
    telegramApiHashEncrypted = encryptBackupSecret(parsed.telegramApiHash);
  }

  // Ensure a cron secret always exists if not already configured
  let cronSecretEncrypted = current.cronSecretEncrypted;
  if (!cronSecretEncrypted && !process.env.BACKUP_CRON_SECRET?.trim()) {
    cronSecretEncrypted = encryptBackupSecret(crypto.randomBytes(32).toString("hex"));
  }

  const next: BackupSettingsStored = {
    enabled: parsed.enabled,
    scheduleUtcHour: parsed.scheduleUtcHour,
    scheduleUtcMinute: parsed.scheduleUtcMinute,
    transportMode: parsed.transportMode,
    telegramChatId: parsed.telegramChatId,
    telegramThreadId: parsed.telegramThreadId,
    telegramBotTokenEncrypted,
    telegramApiId: parsed.telegramApiId,
    telegramApiHashEncrypted,
    telegramApiBaseUrl: parsed.telegramApiBaseUrl,
    cronSecretEncrypted,
    includeEnvFile: parsed.includeEnvFile,
    includeNodeModules: parsed.includeNodeModules,
    includeNextBuild: parsed.includeNextBuild,
    includeGitDir: parsed.includeGitDir,
    compressionLevel: parsed.compressionLevel,
    cleanupVerifyPasses: parsed.cleanupVerifyPasses,
    notifyCleanupSummary: parsed.notifyCleanupSummary,
    lastScheduledUtcDate: current.lastScheduledUtcDate,
  };

  await writeStoredSettings(next);

  await logActivity({
    userId: actorUserId,
    action: "backup.settings.update",
    entityType: "settings",
    entityId: BACKUP_SETTINGS_KEY,
    meta: {
      enabled: next.enabled,
      scheduleUtc: formatUtcClock(next.scheduleUtcHour, next.scheduleUtcMinute),
      transportMode: next.transportMode,
      cleanupVerifyPasses: next.cleanupVerifyPasses,
      hasCustomApiBaseUrl: Boolean(next.telegramApiBaseUrl),
    },
  });

  return getPublicBackupSettings();
}

export async function rotateBackupCronSecret(
  actorUserId: string | null
): Promise<{ secret: string; settings: BackupSettingsPublic }> {
  const current = await getResolvedBackupSettings();
  const rawSecret = `scb_${crypto.randomBytes(24).toString("hex")}`;
  const next: BackupSettingsStored = {
    enabled: current.enabled,
    scheduleUtcHour: current.scheduleUtcHour,
    scheduleUtcMinute: current.scheduleUtcMinute,
    transportMode: current.transportMode,
    telegramChatId: current.telegramChatId,
    telegramThreadId: current.telegramThreadId,
    telegramBotTokenEncrypted: current.telegramBotTokenEncrypted,
    telegramApiId: current.telegramApiId,
    telegramApiHashEncrypted: current.telegramApiHashEncrypted,
    telegramApiBaseUrl: current.telegramApiBaseUrl,
    cronSecretEncrypted: encryptBackupSecret(rawSecret),
    includeEnvFile: current.includeEnvFile,
    includeNodeModules: current.includeNodeModules,
    includeNextBuild: current.includeNextBuild,
    includeGitDir: current.includeGitDir,
    compressionLevel: current.compressionLevel,
    cleanupVerifyPasses: current.cleanupVerifyPasses,
    notifyCleanupSummary: current.notifyCleanupSummary,
    lastScheduledUtcDate: current.lastScheduledUtcDate,
  };

  await writeStoredSettings(next);

  await logActivity({
    userId: actorUserId,
    action: "backup.cron_secret.rotate",
    entityType: "settings",
    entityId: BACKUP_SETTINGS_KEY,
  });

  return {
    secret: rawSecret,
    settings: await getPublicBackupSettings(),
  };
}

async function markLastScheduledUtcDate(utcDateStamp: string): Promise<void> {
  const current = await getResolvedBackupSettings();
  const next: BackupSettingsStored = {
    enabled: current.enabled,
    scheduleUtcHour: current.scheduleUtcHour,
    scheduleUtcMinute: current.scheduleUtcMinute,
    transportMode: current.transportMode,
    telegramChatId: current.telegramChatId,
    telegramThreadId: current.telegramThreadId,
    telegramBotTokenEncrypted: current.telegramBotTokenEncrypted,
    telegramApiId: current.telegramApiId,
    telegramApiHashEncrypted: current.telegramApiHashEncrypted,
    telegramApiBaseUrl: current.telegramApiBaseUrl,
    cronSecretEncrypted: current.cronSecretEncrypted,
    includeEnvFile: current.includeEnvFile,
    includeNodeModules: current.includeNodeModules,
    includeNextBuild: current.includeNextBuild,
    includeGitDir: current.includeGitDir,
    compressionLevel: current.compressionLevel,
    cleanupVerifyPasses: current.cleanupVerifyPasses,
    notifyCleanupSummary: current.notifyCleanupSummary,
    lastScheduledUtcDate: utcDateStamp,
  };
  await writeStoredSettings(next);
}

// ============================================================================
// Database Export Engine (Pure-Node MySQL & SQLite — zero shell exec)
// ============================================================================

function quoteSqliteValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "NULL";
  if (typeof val === "bigint") return val.toString();
  if (typeof val === "boolean") return val ? "1" : "0";
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) {
    return `X'${Buffer.from(val).toString("hex")}'`;
  }
  const str = String(val);
  return `'${str.replace(/'/g, "''")}'`;
}

function quoteMysqlIdentifier(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

function quoteSqliteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function exportDatabaseToDirectory(
  outDir: string,
  stagingRoot: string
): Promise<{
  dbEngine: "mysql" | "sqlite";
  sqlFilePath: string;
  binaryCopyPath: string | null;
  tableCount: number;
  totalRows: number;
}> {
  const safeOutDir = assertInsideBackupStaging(outDir, stagingRoot);
  fs.mkdirSync(safeOutDir, { recursive: true });

  const engine = getActiveDbEngine();
  const sqlFilePath = assertInsideBackupStaging(path.join(safeOutDir, "database.sql"), stagingRoot);
  const ws = fs.createWriteStream(sqlFilePath, { encoding: "utf8" });

  let tableCount = 0;
  let totalRows = 0;
  let binaryCopyPath: string | null = null;

  const writeLine = (line: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!ws.write(`${line}\n`)) {
        ws.once("drain", resolve);
        ws.once("error", reject);
      } else {
        resolve();
      }
    });

  try {
    await writeLine(`-- Scienta Automated Database Backup`);
    await writeLine(`-- Engine: ${engine.toUpperCase()}`);
    await writeLine(`-- Generated UTC: ${new Date().toISOString()}`);
    await writeLine("");

    if (engine === "sqlite") {
      await writeLine("PRAGMA foreign_keys = OFF;");
      await writeLine("BEGIN TRANSACTION;");

      const objects = await query<{ type: string; name: string; sql: string | null }>(
        `SELECT type, name, sql FROM sqlite_master
         WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
         ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'index' THEN 2 WHEN 'trigger' THEN 3 ELSE 4 END, name ASC`
      );

      const tables = objects.filter((o) => o.type === "table");
      tableCount = tables.length;

      for (const tbl of tables) {
        await writeLine(`\n-- Table: ${tbl.name}`);
        await writeLine(`DROP TABLE IF EXISTS ${quoteSqliteIdentifier(tbl.name)};`);
        await writeLine(`${tbl.sql};`);

        const rows = await query<Record<string, unknown>>(
          `SELECT * FROM ${quoteSqliteIdentifier(tbl.name)}`
        );
        totalRows += rows.length;
        for (const r of rows) {
          const cols = Object.keys(r);
          if (cols.length === 0) continue;
          const colList = cols.map(quoteSqliteIdentifier).join(", ");
          const valList = cols.map((c) => quoteSqliteValue(r[c])).join(", ");
          await writeLine(
            `INSERT INTO ${quoteSqliteIdentifier(tbl.name)} (${colList}) VALUES (${valList});`
          );
        }
      }

      const extras = objects.filter((o) => o.type !== "table");
      if (extras.length > 0) {
        await writeLine("\n-- Indexes & Triggers");
        for (const extra of extras) {
          await writeLine(`${extra.sql};`);
        }
      }

      await writeLine("\nCOMMIT;");
      await writeLine("PRAGMA foreign_keys = ON;");

      // Also include a consistent binary copy of the active SQLite database file if present
      const sqliteCandidates = [
        process.env.SQLITE_FALLBACK_PATH?.trim(),
        "/tmp/scienta-local.sqlite",
        path.resolve(process.cwd(), "data", "scienta.sqlite"),
      ].filter((p): p is string => Boolean(p));
      const sqlitePath = sqliteCandidates.find((p) =>
        fs.existsSync(/* turbopackIgnore: true */ p)
      );
      if (sqlitePath) {
        binaryCopyPath = assertInsideBackupStaging(
          path.join(safeOutDir, "scienta.sqlite"),
          stagingRoot
        );
        await fs.promises.copyFile(/* turbopackIgnore: true */ sqlitePath, binaryCopyPath);
      }
    } else {
      await writeLine("SET NAMES utf8mb4;");
      await writeLine("SET FOREIGN_KEY_CHECKS = 0;");
      await writeLine("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';");

      const tableRows = await query<Record<string, string>>("SHOW TABLES");
      const tableNames = tableRows
        .map((r) => Object.values(r)[0])
        .filter((n): n is string => typeof n === "string" && n.length > 0);
      tableCount = tableNames.length;

      for (const tableName of tableNames) {
        const quoted = quoteMysqlIdentifier(tableName);
        const createRows = await query<Record<string, string>>(`SHOW CREATE TABLE ${quoted}`);
        const createSql = createRows[0]?.["Create Table"];
        await writeLine(`\n-- Table: ${tableName}`);
        await writeLine(`DROP TABLE IF EXISTS ${quoted};`);
        if (createSql) {
          await writeLine(`${createSql};`);
        }

        const BATCH = 500;
        let offset = 0;
        while (true) {
          const rows = await query<Record<string, unknown>>(
            `SELECT * FROM ${quoted} LIMIT ${BATCH} OFFSET ${offset}`
          );
          if (rows.length === 0) break;
          totalRows += rows.length;
          const cols = Object.keys(rows[0]);
          const colList = cols.map(quoteMysqlIdentifier).join(", ");
          const tuples = rows.map((r) => {
            const vals = cols
              .map((c) => mysql.escape(r[c] as string | number | boolean | Date | Buffer | null))
              .join(", ");
            return `(${vals})`;
          });
          await writeLine(`INSERT INTO ${quoted} (${colList}) VALUES\n${tuples.join(",\n")};`);
          if (rows.length < BATCH) break;
          offset += BATCH;
        }
      }

      await writeLine("\nSET FOREIGN_KEY_CHECKS = 1;");
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      ws.end(() => resolve());
      ws.once("error", reject);
    });
  }

  return {
    dbEngine: engine,
    sqlFilePath,
    binaryCopyPath,
    tableCount,
    totalRows,
  };
}

// ============================================================================
// Streaming Tar.Gz Archive Builder + SHA-256 Checksum
// ============================================================================

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function walkSiteFiles(
  dir: string,
  siteRoot: string,
  filterOpts: {
    includeEnvFile: boolean;
    includeNodeModules: boolean;
    includeNextBuild: boolean;
    includeGitDir: boolean;
  },
  out: Array<{ absPath: string; relPosix: string }>
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const dirent of entries) {
    // Skip symbolic links to avoid infinite loops or escaping site root
    if (dirent.isSymbolicLink()) continue;
    const absPath = path.join(dir, dirent.name);
    const relPosix = path.relative(siteRoot, absPath).replace(/\\/g, "/");
    if (!shouldIncludeSitePath(relPosix, filterOpts)) continue;

    if (dirent.isDirectory()) {
      walkSiteFiles(absPath, siteRoot, filterOpts, out);
    } else if (dirent.isFile()) {
      out.push({ absPath, relPosix });
    }
  }
}

async function createTarGzArchive(params: {
  outputPath: string;
  stagingRoot: string;
  compressionLevel: number;
  entries: Array<
    | { kind: "file"; absPath: string; archiveName: string }
    | { kind: "buffer"; content: string | Buffer; archiveName: string }
  >;
}): Promise<{ sizeBytes: number; sha256: string; fileCount: number }> {
  const safeOut = assertInsideBackupStaging(params.outputPath, params.stagingRoot);
  fs.mkdirSync(path.dirname(safeOut), { recursive: true });

  const nodeRequire = createRequire(import.meta.url);
  const archiverMod = nodeRequire("archiver") as {
    TarArchive?: new (options?: ArchiverTypes.TarOptions) => ArchiverTypes.Archiver;
    default?: (format: "tar", options: ArchiverTypes.TarOptions) => ArchiverTypes.Archiver;
  };
  const tarOptions: ArchiverTypes.TarOptions = {
    gzip: true,
    gzipOptions: { level: Math.max(1, Math.min(9, params.compressionLevel)) },
  };

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(safeOut);
    const archive = archiverMod.TarArchive
      ? new archiverMod.TarArchive(tarOptions)
      : typeof archiverMod === "function"
        ? (archiverMod as unknown as (
            format: "tar",
            options: ArchiverTypes.TarOptions
          ) => ArchiverTypes.Archiver)("tar", tarOptions)
        : archiverMod.default!("tar", tarOptions);

    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);

    for (const item of params.entries) {
      if (item.kind === "file") {
        if (fs.existsSync(item.absPath)) {
          archive.file(item.absPath, { name: item.archiveName });
        }
      } else {
        archive.append(item.content, { name: item.archiveName });
      }
    }

    void archive.finalize();
  });

  const stat = await fs.promises.stat(safeOut);
  const hash = await sha256File(safeOut);
  return {
    sizeBytes: stat.size,
    sha256: hash,
    fileCount: params.entries.length,
  };
}

// ============================================================================
// Main 2-File Backup Pipeline + Multi-Pass Verified Host Cleanup
// ============================================================================

export function isBackupCurrentlyRunning(): boolean {
  return Boolean(globalThis.__scientaBackupActiveRunId);
}

export function getActiveBackupRunId(): string | null {
  return globalThis.__scientaBackupActiveRunId ?? null;
}

export async function executeBackupPipeline(options: {
  trigger: BackupTriggerSource;
  dryRun?: boolean;
  actorUserId?: string | null;
}): Promise<BackupRunRecord> {
  await ensureBackupSchema();

  if (globalThis.__scientaBackupActiveRunId) {
    throw new Error("A backup job is already running. Please wait for it to finish.");
  }

  const runId = uuid();
  globalThis.__scientaBackupActiveRunId = runId;

  const startedDate = new Date();
  const startedMs = Date.now();
  const stamp = formatUtcArchiveStamp(startedDate);
  const dryRun = Boolean(options.dryRun || options.trigger === "dry_run");
  const triggerSource: BackupTriggerSource = dryRun ? "dry_run" : options.trigger;

  const settings = await getResolvedBackupSettings();
  const dbEngine = getActiveDbEngine();
  const appRoot = process.cwd();
  const stagingRoot = getBackupStagingRoot(appRoot);
  const runDir = assertInsideBackupStaging(path.join(stagingRoot, runId), stagingRoot);

  // Record initial running state
  await execute(
    `INSERT INTO backup_runs (id, trigger_source, status, db_engine, triggered_by, started_at)
     VALUES (?, ?, 'running', ?, ?, NOW())`,
    [runId, triggerSource, dbEngine, options.actorUserId ?? null]
  );

  const dbFileName = `scienta-db-${stamp}.tar.gz`;
  const fullFileName = `scienta-full-${stamp}.tar.gz`;
  const dbArchivePath = assertInsideBackupStaging(path.join(runDir, dbFileName), stagingRoot);
  const fullArchivePath = assertInsideBackupStaging(path.join(runDir, fullFileName), stagingRoot);
  const dbTempDir = assertInsideBackupStaging(path.join(runDir, "_db_export"), stagingRoot);

  let dbSizeBytes = 0;
  let dbSha256: string | null = null;
  let dbTableCount = 0;
  let dbTelegramMessageId: string | null = null;
  let dbTransport: TelegramActualTransport | null = null;

  let fullSizeBytes = 0;
  let fullSha256: string | null = null;
  let fullFileCount = 0;
  let fullTelegramMessageId: string | null = null;
  let fullTransport: TelegramActualTransport | null = null;

  let status: BackupRunStatus = dryRun ? "dry_run" : "success";
  let errorMessage: string | null = null;
  let cleanupReport: CleanupVerificationReport | null = null;

  const telegramCreds: TelegramCredentials = {
    botToken: settings.effectiveBotToken,
    chatId: settings.effectiveChatId,
    threadId: settings.telegramThreadId,
    apiId: settings.effectiveApiId,
    apiHash: settings.effectiveApiHash,
    apiBaseUrl: settings.effectiveApiBaseUrl,
    transportMode: settings.transportMode,
  };

  try {
    fs.mkdirSync(runDir, { recursive: true });

    if (!dryRun) {
      if (!telegramCreds.botToken) {
        throw new Error("Telegram Bot Token is not configured.");
      }
      if (!telegramCreds.chatId) {
        throw new Error("Telegram Target Chat / Channel ID is not configured.");
      }
    }

    // ------------------------------------------------------------------------
    // STEP 1: Export Database & Build Artifact #1 (Compressed Database Archive)
    // ------------------------------------------------------------------------
    const dbExport = await exportDatabaseToDirectory(dbTempDir, stagingRoot);
    dbTableCount = dbExport.tableCount;

    const dbManifest = JSON.stringify(
      {
        type: "database_backup",
        runId,
        generatedAtUtc: startedDate.toISOString(),
        engine: dbExport.dbEngine,
        tableCount: dbExport.tableCount,
        totalRows: dbExport.totalRows,
        includesBinarySnapshot: Boolean(dbExport.binaryCopyPath),
      },
      null,
      2
    );

    const dbEntries: Array<
      | { kind: "file"; absPath: string; archiveName: string }
      | { kind: "buffer"; content: string | Buffer; archiveName: string }
    > = [
      { kind: "file", absPath: dbExport.sqlFilePath, archiveName: "database.sql" },
      { kind: "buffer", content: dbManifest, archiveName: "manifest.json" },
    ];
    if (dbExport.binaryCopyPath) {
      dbEntries.push({
        kind: "file",
        absPath: dbExport.binaryCopyPath,
        archiveName: "scienta.sqlite",
      });
    }

    const dbBuilt = await createTarGzArchive({
      outputPath: dbArchivePath,
      stagingRoot,
      compressionLevel: settings.compressionLevel,
      entries: dbEntries,
    });
    dbSizeBytes = dbBuilt.sizeBytes;
    dbSha256 = dbBuilt.sha256;

    // Upload File #1 to Telegram immediately
    if (dryRun) {
      dbTransport = "dry_run";
    } else {
      const dbCaption = [
        `[1/2] Scienta Database Backup`,
        `UTC: ${startedDate.toISOString().replace("T", " ").slice(0, 19)} UTC`,
        `Engine: ${dbExport.dbEngine.toUpperCase()} (${dbExport.tableCount} tables · ${dbExport.totalRows.toLocaleString()} rows)`,
        `Size: ${formatBytes(dbSizeBytes)}`,
        `SHA-256: ${dbSha256.slice(0, 16)}...`,
      ].join("\n");

      const sentDb = await uploadBackupFileToTelegram({
        creds: telegramCreds,
        filePath: dbArchivePath,
        fileName: dbFileName,
        caption: dbCaption,
      });
      dbTelegramMessageId = sentDb.messageId;
      dbTransport = sentDb.transport;
    }

    // ------------------------------------------------------------------------
    // STEP 2: Build Artifact #2 (Complete Full Site + Database Archive)
    // ------------------------------------------------------------------------
    const siteFiles: Array<{ absPath: string; relPosix: string }> = [];
    walkSiteFiles(
      appRoot,
      appRoot,
      {
        includeEnvFile: settings.includeEnvFile,
        includeNodeModules: settings.includeNodeModules,
        includeNextBuild: settings.includeNextBuild,
        includeGitDir: settings.includeGitDir,
      },
      siteFiles
    );

    const fullManifest = JSON.stringify(
      {
        type: "full_site_and_database_backup",
        runId,
        generatedAtUtc: startedDate.toISOString(),
        siteFileCount: siteFiles.length,
        databaseEngine: dbExport.dbEngine,
        databaseTables: dbExport.tableCount,
        databaseRows: dbExport.totalRows,
        options: {
          includeEnvFile: settings.includeEnvFile,
          includeNodeModules: settings.includeNodeModules,
          includeNextBuild: settings.includeNextBuild,
          includeGitDir: settings.includeGitDir,
          compressionLevel: settings.compressionLevel,
        },
      },
      null,
      2
    );

    const fullEntries: Array<
      | { kind: "file"; absPath: string; archiveName: string }
      | { kind: "buffer"; content: string | Buffer; archiveName: string }
    > = [
      ...siteFiles.map((f) => ({
        kind: "file" as const,
        absPath: f.absPath,
        archiveName: `site/${f.relPosix}`,
      })),
      { kind: "file", absPath: dbExport.sqlFilePath, archiveName: "_database_backup/database.sql" },
      { kind: "buffer", content: fullManifest, archiveName: "backup-manifest.json" },
    ];
    if (dbExport.binaryCopyPath) {
      fullEntries.push({
        kind: "file",
        absPath: dbExport.binaryCopyPath,
        archiveName: "_database_backup/scienta.sqlite",
      });
    }

    const fullBuilt = await createTarGzArchive({
      outputPath: fullArchivePath,
      stagingRoot,
      compressionLevel: settings.compressionLevel,
      entries: fullEntries,
    });
    fullSizeBytes = fullBuilt.sizeBytes;
    fullSha256 = fullBuilt.sha256;
    fullFileCount = fullBuilt.fileCount;

    // Upload File #2 to Telegram as a second separate document
    if (dryRun) {
      fullTransport = "dry_run";
    } else {
      const fullCaption = [
        `[2/2] Scienta Full Site + Database Archive`,
        `UTC: ${startedDate.toISOString().replace("T", " ").slice(0, 19)} UTC`,
        `Contents: ${fullFileCount.toLocaleString()} files + DB snapshot`,
        `Size: ${formatBytes(fullSizeBytes)}`,
        `SHA-256: ${fullSha256.slice(0, 16)}...`,
      ].join("\n");

      const sentFull = await uploadBackupFileToTelegram({
        creds: telegramCreds,
        filePath: fullArchivePath,
        fileName: fullFileName,
        caption: fullCaption,
      });
      fullTelegramMessageId = sentFull.messageId;
      fullTransport = sentFull.transport;
    }

    if (options.trigger === "scheduled" || options.trigger === "cron") {
      await markLastScheduledUtcDate(formatUtcDateStamp(startedDate));
    }
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    errorMessage = redactBackupSecrets(rawMsg);
    status = dbTelegramMessageId ? "partial" : "failed";
  } finally {
    // ------------------------------------------------------------------------
    // STEP 3: Multi-Pass Verified Host Cleanup (ALWAYS executes, even on failure)
    // ------------------------------------------------------------------------
    try {
      cleanupReport = await verifyAndPurgeBackupArtifacts({
        stagingRoot,
        runDir,
        artifactPaths: [dbArchivePath, fullArchivePath],
        passes: settings.cleanupVerifyPasses,
        passDelayMs: 350,
      });
    } catch (cleanupErr) {
      const cleanErrMsg = redactBackupSecrets(
        cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)
      );
      errorMessage = errorMessage
        ? `${errorMessage} | Cleanup warning: ${cleanErrMsg}`
        : `Cleanup warning: ${cleanErrMsg}`;
    }

    const durationMs = Date.now() - startedMs;

    // Optional Telegram confirmation that host files were purged & verified across N passes
    if (
      !dryRun &&
      settings.notifyCleanupSummary &&
      status === "success" &&
      cleanupReport &&
      telegramCreds.botToken &&
      telegramCreds.chatId
    ) {
      const summaryLines = [
        `Scienta Backup Complete (${formatDurationMs(durationMs)})`,
        `1) DB: ${dbFileName} (${formatBytes(dbSizeBytes)}) [${dbTransport}]`,
        `2) Full Site+DB: ${fullFileName} (${formatBytes(fullSizeBytes)}) [${fullTransport}]`,
        cleanupReport.verified
          ? `Host Cleanup Verified: ${cleanupReport.passesCompleted}/${cleanupReport.passesPlanned} checks passed · 0 files left on server`
          : `Host Cleanup Warning: ${cleanupReport.remainingFiles} files remaining — check Admin Backups panel`,
      ].join("\n");
      await sendTelegramStatusMessage(telegramCreds, summaryLines).catch(() => {});
    }

    await execute(
      `UPDATE backup_runs
       SET status = ?,
           db_file_name = ?,
           db_size_bytes = ?,
           db_sha256 = ?,
           db_table_count = ?,
           db_telegram_message_id = ?,
           db_transport = ?,
           full_file_name = ?,
           full_size_bytes = ?,
           full_sha256 = ?,
           full_file_count = ?,
           full_telegram_message_id = ?,
           full_transport = ?,
           cleanup_passes = ?,
           cleanup_verified = ?,
           cleanup_remaining_files = ?,
           cleanup_log_json = ?,
           duration_ms = ?,
           error_message = ?,
           finished_at = NOW()
       WHERE id = ?`,
      [
        status,
        dbFileName,
        dbSizeBytes,
        dbSha256,
        dbTableCount,
        dbTelegramMessageId,
        dbTransport,
        fullFileName,
        fullSizeBytes,
        fullSha256,
        fullFileCount,
        fullTelegramMessageId,
        fullTransport,
        cleanupReport?.passesCompleted ?? 0,
        cleanupReport?.verified ? 1 : 0,
        cleanupReport?.remainingFiles ?? 0,
        cleanupReport ? JSON.stringify(cleanupReport) : null,
        durationMs,
        errorMessage,
        runId,
      ]
    );

    await logActivity({
      userId: options.actorUserId ?? null,
      action: `backup.run.${status}`,
      entityType: "backup_run",
      entityId: runId,
      meta: {
        trigger: triggerSource,
        dbSizeBytes,
        fullSizeBytes,
        cleanupVerified: Boolean(cleanupReport?.verified),
        cleanupPasses: cleanupReport?.passesCompleted ?? 0,
        durationMs,
      },
    });

    globalThis.__scientaBackupActiveRunId = null;
  }

  const saved = await getBackupRunById(runId);
  if (!saved) {
    throw new Error("Backup finished but run record could not be reloaded.");
  }
  return saved;
}

// ============================================================================
// Run History Queries, Manual Host Cleanup & Telegram Test
// ============================================================================

interface RawBackupRunRow {
  id: string;
  trigger_source: string;
  status: string;
  db_engine: string;
  db_file_name: string | null;
  db_size_bytes: number;
  db_sha256: string | null;
  db_table_count: number;
  db_telegram_message_id: string | null;
  db_transport: string | null;
  full_file_name: string | null;
  full_size_bytes: number;
  full_sha256: string | null;
  full_file_count: number;
  full_telegram_message_id: string | null;
  full_transport: string | null;
  cleanup_passes: number;
  cleanup_verified: number;
  cleanup_remaining_files: number;
  cleanup_log_json: string | null;
  duration_ms: number;
  error_message: string | null;
  triggered_by: string | null;
  started_at: string;
  finished_at: string | null;
}

function mapRunRow(row: RawBackupRunRow): BackupRunRecord {
  let cleanupLog: CleanupVerificationReport | null = null;
  if (row.cleanup_log_json) {
    try {
      cleanupLog = JSON.parse(row.cleanup_log_json) as CleanupVerificationReport;
    } catch {
      cleanupLog = null;
    }
  }
  return {
    id: row.id,
    triggerSource: row.trigger_source as BackupTriggerSource,
    status: row.status as BackupRunStatus,
    dbEngine: row.db_engine === "mysql" ? "mysql" : "sqlite",
    dbFileName: row.db_file_name,
    dbSizeBytes: Number(row.db_size_bytes ?? 0),
    dbSha256: row.db_sha256,
    dbTableCount: Number(row.db_table_count ?? 0),
    dbTelegramMessageId: row.db_telegram_message_id,
    dbTransport: (row.db_transport as TelegramActualTransport | null) ?? null,
    fullFileName: row.full_file_name,
    fullSizeBytes: Number(row.full_size_bytes ?? 0),
    fullSha256: row.full_sha256,
    fullFileCount: Number(row.full_file_count ?? 0),
    fullTelegramMessageId: row.full_telegram_message_id,
    fullTransport: (row.full_transport as TelegramActualTransport | null) ?? null,
    cleanupPasses: Number(row.cleanup_passes ?? 0),
    cleanupVerified: Boolean(row.cleanup_verified),
    cleanupRemainingFiles: Number(row.cleanup_remaining_files ?? 0),
    cleanupLog,
    durationMs: Number(row.duration_ms ?? 0),
    errorMessage: row.error_message,
    triggeredBy: row.triggered_by,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export async function getBackupRunById(id: string): Promise<BackupRunRecord | null> {
  await ensureBackupSchema();
  const row = await queryOne<RawBackupRunRow>(
    "SELECT * FROM backup_runs WHERE id = ? LIMIT 1",
    [id]
  );
  return row ? mapRunRow(row) : null;
}

export async function listBackupRuns(limit = 30): Promise<BackupRunRecord[]> {
  await ensureBackupSchema();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await query<RawBackupRunRow>(
    `SELECT * FROM backup_runs ORDER BY started_at DESC LIMIT ?`,
    [safeLimit]
  );
  return rows.map(mapRunRow);
}

export function getHostBackupDiskStatus(): BackupDiskInspection {
  return inspectBackupStagingDisk(getBackupStagingRoot());
}

/**
 * Manually sweeps and multi-pass verifies the host staging directory to guarantee
 * zero residual backup archives remain on disk (refuses while a run is active).
 */
export async function manualPurgeBackupStaging(
  passes = 3,
  actorUserId: string | null = null
): Promise<{ report: CleanupVerificationReport; disk: BackupDiskInspection }> {
  if (globalThis.__scientaBackupActiveRunId) {
    throw new Error("Cannot purge staging directory while a backup is actively running.");
  }
  const stagingRoot = getBackupStagingRoot();
  const probeRunDir = assertInsideBackupStaging(path.join(stagingRoot, "_manual-sweep"), stagingRoot);
  const report = await verifyAndPurgeBackupArtifacts({
    stagingRoot,
    runDir: probeRunDir,
    artifactPaths: [],
    passes,
    passDelayMs: 250,
  });
  const disk = inspectBackupStagingDisk(stagingRoot);

  if (actorUserId) {
    await logActivity({
      userId: actorUserId,
      action: "backup.cleanup.manual",
      entityType: "backup_staging",
      meta: {
        verified: report.verified,
        passesCompleted: report.passesCompleted,
        remainingFiles: report.remainingFiles,
      },
    });
  }

  return { report, disk };
}

export interface TelegramConnectionTestInput {
  sendPingMessage: boolean;
  botToken?: string;
  chatId?: string;
  threadId?: string;
  apiId?: string;
  apiHash?: string;
  apiBaseUrl?: string;
  transportMode?: "auto" | "mtproto" | "bot_api";
  clearBotToken?: boolean;
  clearApiHash?: boolean;
}

export async function runTelegramConnectionTest(
  input: boolean | TelegramConnectionTestInput
): Promise<TelegramConnectionTestResult> {
  const opts: TelegramConnectionTestInput =
    typeof input === "boolean" ? { sendPingMessage: input } : input;
  const settings = await getResolvedBackupSettings();

  const resolvedBotToken = settings.envOverrides.botToken
    ? settings.effectiveBotToken
    : opts.botToken && opts.botToken.trim().length > 0
      ? opts.botToken
      : opts.clearBotToken
        ? ""
        : settings.effectiveBotToken;

  const resolvedChatId = settings.envOverrides.chatId
    ? settings.effectiveChatId
    : opts.chatId !== undefined
      ? opts.chatId
      : settings.effectiveChatId;

  const resolvedThreadId =
    opts.threadId !== undefined ? opts.threadId : settings.telegramThreadId;

  const resolvedApiId = settings.envOverrides.apiId
    ? settings.effectiveApiId
    : opts.apiId !== undefined
      ? opts.apiId
      : settings.effectiveApiId;

  const resolvedApiHash = settings.envOverrides.apiHash
    ? settings.effectiveApiHash
    : opts.apiHash && opts.apiHash.trim().length > 0
      ? opts.apiHash
      : opts.clearApiHash
        ? ""
        : settings.effectiveApiHash;

  const resolvedApiBaseUrl = settings.envOverrides.apiBaseUrl
    ? settings.effectiveApiBaseUrl
    : opts.apiBaseUrl !== undefined
      ? opts.apiBaseUrl
      : settings.effectiveApiBaseUrl;

  return testTelegramConnection(
    {
      botToken: resolvedBotToken,
      chatId: resolvedChatId,
      threadId: resolvedThreadId,
      apiId: resolvedApiId,
      apiHash: resolvedApiHash,
      apiBaseUrl: resolvedApiBaseUrl,
      transportMode: opts.transportMode ?? settings.transportMode,
    },
    opts.sendPingMessage
  );
}
