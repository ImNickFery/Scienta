export type TelegramTransportPreference = "auto" | "mtproto" | "bot_api";
export type TelegramActualTransport = "mtproto" | "bot_api" | "dry_run";
export type BackupTriggerSource = "scheduled" | "manual" | "cron" | "dry_run";
export type BackupRunStatus = "running" | "success" | "partial" | "failed" | "dry_run";

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

export interface TelegramConnectionTestResult {
  ok: boolean;
  botUsername: string | null;
  botFirstName: string | null;
  botApiOk: boolean;
  mtprotoTested: boolean;
  mtprotoOk: boolean;
  messageSent: boolean;
  messageId: string | null;
  warnings: string[];
  error?: string;
}

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
