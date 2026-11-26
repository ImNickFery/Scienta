"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Terminal,
  AlertTriangle,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import type {
  BackupSettingsPublic,
  TelegramConnectionTestResult,
  TelegramTransportPreference,
} from "@/lib/backup-format";

export interface BackupSettingsFormHandle {
  hasUnsavedChanges: () => boolean;
  saveNow: () => Promise<BackupSettingsPublic | null>;
}

interface BackupSettingsFormProps {
  settings: BackupSettingsPublic;
  isFa: boolean;
  onSaved: (next: BackupSettingsPublic) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

function localizeTelegramHint(hint: string, isFa: boolean): string {
  if (!isFa) return hint;
  const lower = hint.toLowerCase();
  if (lower.includes("could not reach api.telegram.org directly")) {
    return "سرور هاست شما نمی‌تواند به‌طور مستقیم به api.telegram.org متصل شود (در هاست‌های ایران و سرورهای دارای محدودیت شبکه رایج است). آدرس یک پروکسی HTTPS (مثلاً یک Cloudflare Worker رایگان) را در فیلد «آدرس پروکسی اختصاصی Bot API» وارد کرده و دوباره تست کنید.";
  }
  if (lower.includes("could not reach the custom telegram api proxy")) {
    return "سرور هاست نتوانست به آدرس پروکسی اختصاصی متصل شود. مطمئن شوید آدرس Cloudflare Worker یا پروکسی آنلاین است، گواهی HTTPS معتبر دارد و از روی سرور قابل دسترس است.";
  }
  if (lower.includes("401 unauthorized") || lower.includes("rejected the bot token")) {
    return "تلگرام توکن ربات را رد کرد (خطای 401). توکن دقیق را از @BotFather بدون فاصله اضافی و بدون پیشوند bot کپی و جای‌گذاری کنید.";
  }
  if (lower.includes("404 not found")) {
    return "پاسخ 404 دریافت شد. فرمت توکن ربات (مانند 123456789:AAH...) و در صورت استفاده از پروکسی، صحت آدرس آن را بررسی کنید.";
  }
  if (lower.includes("could not find the target chat")) {
    return "شناسه چت یا کانال مقصد در تلگرام پیدا نشد. برای کانال/سوپرگروه خصوصی شناسه عددی با پیشوند -100 وارد کنید و ربات را ادمین کنید؛ برای چت خصوصی ابتدا در ربات دستور /start را بزنید.";
  }
  if (lower.includes("does not have permission to post")) {
    return "ربات مجوز ارسال پیام در این کانال/گروه را ندارد. ربات را با دسترسی ارسال پیام (Post Messages) ادمین کنید یا اگر بلاک شده آن را رفع بلاک کنید.";
  }
  if (lower.includes("mtproto connects directly over tcp")) {
    return "حالت MTProto به‌طور مستقیم از طریق TCP به تلگرام متصل می‌شود و از پروکسی HTTP عبور نمی‌کند. اگر هاست شما پورت تلگرام را مسدود کرده، حالت ارسال را روی «خودکار» یا «فقط Bot API» بگذارید و آدرس پروکسی HTTPS را تنظیم کنید.";
  }
  if (lower.includes("paste the bot token")) {
    return "ابتدا توکن ربات دریافتی از @BotFather را در فیلد «توکن ربات تلگرام» وارد کرده و سپس دوباره دکمه تست را بزنید.";
  }
  if (lower.includes("private, loopback, or reserved")) {
    return "آدرس‌های داخلی، localhost و IPهای خصوصی برای پروکسی مجاز نیستند؛ فقط یک دامنه عمومی با HTTPS معتبر وارد کنید.";
  }
  if (lower.includes("must use https")) {
    return "آدرس پروکسی اختصاصی باید حتماً با https:// شروع شود.";
  }
  return hint;
}

export const BackupSettingsForm = forwardRef<
  BackupSettingsFormHandle,
  BackupSettingsFormProps
>(function BackupSettingsForm({ settings, isFa, onSaved, onDirtyChange }, ref) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [scheduleUtcHour, setScheduleUtcHour] = useState(settings.scheduleUtcHour);
  const [scheduleUtcMinute, setScheduleUtcMinute] = useState(settings.scheduleUtcMinute);
  const [transportMode, setTransportMode] = useState<TelegramTransportPreference>(
    settings.transportMode
  );
  const [telegramChatId, setTelegramChatId] = useState(settings.telegramChatId);
  const [telegramThreadId, setTelegramThreadId] = useState(settings.telegramThreadId);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [clearBotToken, setClearBotToken] = useState(false);
  const [telegramApiId, setTelegramApiId] = useState(settings.telegramApiId);
  const [telegramApiHash, setTelegramApiHash] = useState("");
  const [clearApiHash, setClearApiHash] = useState(false);
  const [telegramApiBaseUrl, setTelegramApiBaseUrl] = useState(settings.telegramApiBaseUrl || "");

  const [includeEnvFile, setIncludeEnvFile] = useState(settings.includeEnvFile);
  const [includeNodeModules, setIncludeNodeModules] = useState(settings.includeNodeModules);
  const [includeNextBuild, setIncludeNextBuild] = useState(settings.includeNextBuild);
  const [includeGitDir, setIncludeGitDir] = useState(settings.includeGitDir);
  const [compressionLevel, setCompressionLevel] = useState(settings.compressionLevel);
  const [cleanupVerifyPasses, setCleanupVerifyPasses] = useState(settings.cleanupVerifyPasses);
  const [notifyCleanupSummary, setNotifyCleanupSummary] = useState(settings.notifyCleanupSummary);

  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TelegramConnectionTestResult | null>(null);

  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [revealedCronSecret, setRevealedCronSecret] = useState<string | null>(null);
  const [copiedCron, setCopiedCron] = useState(false);

  const isDirty =
    telegramBotToken.trim().length > 0 ||
    telegramApiHash.trim().length > 0 ||
    clearBotToken ||
    clearApiHash ||
    telegramChatId !== settings.telegramChatId ||
    telegramThreadId !== settings.telegramThreadId ||
    telegramApiId !== settings.telegramApiId ||
    telegramApiBaseUrl.trim() !== (settings.telegramApiBaseUrl || "") ||
    transportMode !== settings.transportMode ||
    enabled !== settings.enabled ||
    scheduleUtcHour !== settings.scheduleUtcHour ||
    scheduleUtcMinute !== settings.scheduleUtcMinute ||
    includeEnvFile !== settings.includeEnvFile ||
    includeNodeModules !== settings.includeNodeModules ||
    includeNextBuild !== settings.includeNextBuild ||
    includeGitDir !== settings.includeGitDir ||
    compressionLevel !== settings.compressionLevel ||
    cleanupVerifyPasses !== settings.cleanupVerifyPasses ||
    notifyCleanupSummary !== settings.notifyCleanupSummary;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com";
  const cronCommand = `${scheduleUtcMinute} ${scheduleUtcHour} * * * curl -fsS -X POST -H "Authorization: Bearer ${
    revealedCronSecret || "<YOUR_BACKUP_CRON_SECRET>"
  }" "${origin}/api/cron/backup" >/dev/null 2>&1`;

  async function persistSettings(): Promise<BackupSettingsPublic | null> {
    setSaving(true);
    setSaveFeedback(null);
    try {
      const res = await adminFetch<{ settings: BackupSettingsPublic }>(
        "/api/admin/backups/settings",
        {
          method: "PUT",
          body: JSON.stringify({
            enabled,
            scheduleUtcHour,
            scheduleUtcMinute,
            transportMode,
            telegramChatId,
            telegramThreadId,
            telegramBotToken: telegramBotToken.trim() || undefined,
            clearBotToken,
            telegramApiId,
            telegramApiHash: telegramApiHash.trim() || undefined,
            clearApiHash,
            telegramApiBaseUrl: telegramApiBaseUrl.trim(),
            includeEnvFile,
            includeNodeModules,
            includeNextBuild,
            includeGitDir,
            compressionLevel,
            cleanupVerifyPasses,
            notifyCleanupSummary,
          }),
        }
      );
      setTelegramBotToken("");
      setTelegramApiHash("");
      setClearBotToken(false);
      setClearApiHash(false);
      setTelegramChatId(res.settings.telegramChatId);
      setTelegramThreadId(res.settings.telegramThreadId);
      setTelegramApiId(res.settings.telegramApiId);
      setTelegramApiBaseUrl(res.settings.telegramApiBaseUrl || "");
      onSaved(res.settings);
      setSaveFeedback({
        ok: true,
        text: isFa
          ? "تنظیمات پشتیبان‌گیری و تلگرام با رمزنگاری AES-256-GCM ذخیره شد."
          : "Backup & Telegram settings saved with AES-256-GCM encryption.",
      });
      return res.settings;
    } catch (err) {
      setSaveFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Failed to save settings.",
      });
      return null;
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => isDirty,
    saveNow: () => persistSettings(),
  }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await persistSettings();
  }

  async function handleTestTelegram(sendPingMessage: boolean) {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminFetch<TelegramConnectionTestResult>(
        "/api/admin/backups/test-telegram",
        {
          method: "POST",
          body: JSON.stringify({
            sendPingMessage,
            botToken: telegramBotToken.trim() || undefined,
            chatId: telegramChatId,
            threadId: telegramThreadId,
            apiId: telegramApiId,
            apiHash: telegramApiHash.trim() || undefined,
            apiBaseUrl: telegramApiBaseUrl,
            transportMode,
            clearBotToken,
            clearApiHash,
          }),
        }
      );
      setTestResult(res);
    } catch (err) {
      setTestResult({
        ok: false,
        botUsername: null,
        botFirstName: null,
        botApiOk: false,
        mtprotoTested: false,
        mtprotoOk: false,
        messageSent: false,
        messageId: null,
        warnings: [],
        error: err instanceof Error ? err.message : "Connection test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleRotateCronSecret() {
    setRotatingSecret(true);
    try {
      const res = await adminFetch<{ secret: string; settings: BackupSettingsPublic }>(
        "/api/admin/backups/settings",
        {
          method: "POST",
          body: JSON.stringify({ action: "rotate_cron_secret" }),
        }
      );
      setRevealedCronSecret(res.secret);
      onSaved(res.settings);
    } catch (err) {
      setSaveFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Failed to rotate cron secret.",
      });
    } finally {
      setRotatingSecret(false);
    }
  }

  async function handleCopyCron() {
    try {
      await navigator.clipboard.writeText(cronCommand);
      setCopiedCron(true);
      setTimeout(() => setCopiedCron(false), 2000);
    } catch {
      // Fallback ignored
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {isDirty && !saving && (
        <div
          data-testid="backup-unsaved-banner"
          className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              {isFa
                ? "تغییرات شما هنوز ذخیره نشده‌اند — پیش از اجرای بکاپ، ذخیره را بزنید (یا هنگام کلیک روی «اجرای بکاپ الان» خودکار ذخیره می‌شود)."
                : "You have unsaved settings changes — click Save before running a backup (or Run Full Backup Now will auto-save first)."}
            </span>
          </span>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isFa ? "ذخیره تغییرات" : "Save Changes"}</span>
          </button>
        </div>
      )}

      {saveFeedback && (
        <div
          data-testid="backup-save-feedback"
          className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-xs ${
            saveFeedback.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-(--color-accent-red)/30 bg-(--color-accent-red)/10 text-(--color-accent-red)"
          }`}
        >
          {saveFeedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span className="break-words">{saveFeedback.text}</span>
        </div>
      )}

      {/* Section 1: Telegram Bot + MTProto Large-File Credentials */}
      <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-4 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-(--color-border-subtle) pb-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa
                ? "اتصال ربات تلگرام و MTProto (ارسال فایل‌های حجیم تا ۲ گیگابایت)"
                : "Telegram Bot & MTProto Credentials (Large Files up to 2 GB)"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-(--color-text-tertiary)">
              {isFa
                ? "با وارد کردن اطلاعات زیر می‌توانید پیش از ذخیره نیز دکمه تست اتصال را بزنید. برای هاست‌های داخلی که به api.telegram.org دسترسی مستقیم ندارند، آدرس پروکسی HTTPS (مثل Cloudflare Worker) را وارد کنید."
                : "You can test the values below before saving. If your host blocks api.telegram.org directly, enter a custom HTTPS reverse-proxy URL (e.g. a Cloudflare Worker)."}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              type="button"
              disabled={testing}
              onClick={() => handleTestTelegram(true)}
              data-testid="telegram-test-btn"
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3.5 text-xs font-medium text-(--color-text-primary) transition-colors hover:bg-white/[0.05] disabled:opacity-50 sm:flex-none whitespace-nowrap"
            >
              <Send className="h-3.5 w-3.5 text-(--color-accent-purple)" />
              <span>
                {testing
                  ? isFa
                    ? "در حال بررسی..."
                    : "Testing..."
                  : isFa
                    ? "تست اتصال و ارسال پیام"
                    : "Test Connection & Ping"}
              </span>
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="backup-save-top-btn"
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-(--color-accent-purple) px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:flex-none whitespace-nowrap"
            >
              <Save className="h-3.5 w-3.5" />
              <span>
                {saving
                  ? isFa
                    ? "در حال ذخیره..."
                    : "Saving..."
                  : isFa
                    ? "ذخیره تنظیمات"
                    : "Save Settings"}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {/* Bot Token */}
          <div>
            <label
              htmlFor="backup-bot-token"
              className="block text-xs font-medium text-(--color-text-secondary)"
            >
              {isFa ? "توکن ربات تلگرام (Bot Token)" : "Telegram Bot Token"}
            </label>
            <input
              id="backup-bot-token"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={telegramBotToken}
              onChange={(e) => {
                setTelegramBotToken(e.target.value);
                if (clearBotToken) setClearBotToken(false);
              }}
              disabled={settings.envOverrides.botToken}
              placeholder={
                settings.hasBotToken
                  ? "•••••••••••••••••••••• (stored encrypted — enter to replace)"
                  : "123456789:AAH_xxxxxxxxxxxxxxxxxxxxxxxx"
              }
              className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none disabled:opacity-60"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-(--color-text-tertiary)">
              <span>
                {settings.envOverrides.botToken
                  ? isFa
                    ? "از متغیر محیطی TELEGRAM_BOT_TOKEN خوانده می‌شود"
                    : "Locked via TELEGRAM_BOT_TOKEN env var"
                  : settings.hasBotToken
                    ? isFa
                      ? "ذخیره‌شده به‌صورت رمزنگاری‌شده"
                      : "Stored encrypted at rest"
                    : isFa
                      ? "از @BotFather دریافت کنید"
                      : "Obtain from @BotFather"}
              </span>
              {settings.hasBotToken && !settings.envOverrides.botToken && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-(--color-accent-red)">
                  <input
                    type="checkbox"
                    checked={clearBotToken}
                    onChange={(e) => setClearBotToken(e.target.checked)}
                    className="rounded border-(--color-border-strong)"
                  />
                  <span>{isFa ? "حذف توکن" : "Clear token"}</span>
                </label>
              )}
            </div>
          </div>

          {/* Chat / Channel ID */}
          <div>
            <label
              htmlFor="backup-chat-id"
              className="block text-xs font-medium text-(--color-text-secondary)"
            >
              {isFa ? "شناسه چت یا کانال مقصد (Chat / Channel ID)" : "Target Chat / Channel ID"}
            </label>
            <input
              id="backup-chat-id"
              type="text"
              dir="ltr"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              disabled={settings.envOverrides.chatId}
              placeholder="-1001234567890 or @scienta_backups"
              className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none disabled:opacity-60"
            />
            <p className="mt-1.5 text-[11px] text-(--color-text-tertiary)">
              {isFa
                ? "ربات باید ادمین کانال/گروه باشد یا حداقل یک‌بار با آن چت کرده باشید."
                : "Add the bot as channel/group admin (or send /start in private chat)."}
            </p>
          </div>

          {/* MTProto API ID */}
          <div>
            <label
              htmlFor="backup-api-id"
              className="block text-xs font-medium text-(--color-text-secondary)"
            >
              {isFa ? "شناسه برنامه تلگرام (api_id — برای فایل‌های تا ۲GB)" : "Telegram API ID (api_id — up to 2 GB)"}
            </label>
            <input
              id="backup-api-id"
              type="text"
              dir="ltr"
              inputMode="numeric"
              value={telegramApiId}
              onChange={(e) => setTelegramApiId(e.target.value)}
              disabled={settings.envOverrides.apiId}
              placeholder="e.g. 24819204"
              className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none disabled:opacity-60"
            />
            <p className="mt-1.5 text-[11px] text-(--color-text-tertiary)">
              {settings.envOverrides.apiId
                ? isFa
                  ? "تنظیم‌شده از طریق TELEGRAM_API_ID"
                  : "Configured via TELEGRAM_API_ID env var"
                : isFa
                  ? "شناسه عددی از my.telegram.org/apps"
                  : "Numeric API ID from my.telegram.org/apps"}
            </p>
          </div>

          {/* MTProto API Hash */}
          <div>
            <label
              htmlFor="backup-api-hash"
              className="block text-xs font-medium text-(--color-text-secondary)"
            >
              {isFa ? "هش برنامه تلگرام (api_hash — برای فایل‌های تا ۲GB)" : "Telegram API Hash (api_hash — up to 2 GB)"}
            </label>
            <input
              id="backup-api-hash"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={telegramApiHash}
              onChange={(e) => {
                setTelegramApiHash(e.target.value);
                if (clearApiHash) setClearApiHash(false);
              }}
              disabled={settings.envOverrides.apiHash}
              placeholder={
                settings.hasApiHash
                  ? "•••••••••••••••••••••••••••••••• (stored encrypted — enter to replace)"
                  : "32-character hex api_hash from my.telegram.org"
              }
              className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none disabled:opacity-60"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-(--color-text-tertiary)">
              <span>
                {settings.envOverrides.apiHash
                  ? isFa
                    ? "تنظیم‌شده از طریق TELEGRAM_API_HASH"
                    : "Configured via TELEGRAM_API_HASH env var"
                  : settings.hasApiHash
                    ? isFa
                      ? "ذخیره‌شده به‌صورت رمزنگاری‌شده"
                      : "Stored encrypted at rest"
                    : isFa
                      ? "کد ۳۲ کاراکتری از my.telegram.org/apps"
                      : "32-char hash from my.telegram.org/apps"}
              </span>
              {settings.hasApiHash && !settings.envOverrides.apiHash && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-(--color-accent-red)">
                  <input
                    type="checkbox"
                    checked={clearApiHash}
                    onChange={(e) => setClearApiHash(e.target.checked)}
                    className="rounded border-(--color-border-strong)"
                  />
                  <span>{isFa ? "حذف api_hash" : "Clear api_hash"}</span>
                </label>
              )}
            </div>
          </div>

          {/* Transport Mode */}
          <div>
            <label
              htmlFor="backup-transport-mode"
              className="block text-xs font-medium text-(--color-text-secondary)"
            >
              {isFa ? "حالت ارسال فایل به تلگرام" : "Upload Transport Mode"}
            </label>
            <select
              id="backup-transport-mode"
              value={transportMode}
              onChange={(e) => setTransportMode(e.target.value as TelegramTransportPreference)}
              className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 text-xs text-(--color-text-primary) focus:border-(--color-accent-purple) focus:outline-none"
            >
              <option value="auto">
                {isFa
                  ? "خودکار (MTProto تا ۲GB در صورت تنظیم api_id/hash، وگرنه Bot API تا ۵۰MB)"
                  : "Auto (MTProto up to 2 GB when api_id/hash set, else Bot API 50 MB)"}
              </option>
              <option value="mtproto">
                {isFa ? "فقط MTProto (نیازمند api_id و api_hash — تا ۲ گیگابایت)" : "MTProto Only (requires api_id & api_hash — up to 2 GB)"}
              </option>
              <option value="bot_api">
                {isFa ? "فقط Bot API استاندارد (محدودیت ۵۰ مگابایت)" : "Standard Bot API Only (50 MB max)"}
              </option>
            </select>
          </div>

          {/* Optional Forum Topic / Thread ID */}
          <div>
            <label
              htmlFor="backup-thread-id"
              className="block text-xs font-medium text-(--color-text-secondary)"
            >
              {isFa ? "شناسه تاپیک گروه (اختیاری — Message Thread ID)" : "Forum Topic / Thread ID (Optional)"}
            </label>
            <input
              id="backup-thread-id"
              type="text"
              dir="ltr"
              inputMode="numeric"
              value={telegramThreadId}
              onChange={(e) => setTelegramThreadId(e.target.value)}
              placeholder={isFa ? "خالی بگذارید اگر کانال یا چت عادی است" : "Leave empty for channels or direct chats"}
              className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none"
            />
          </div>

          {/* Optional Custom Bot API Base URL / Cloudflare Worker Proxy */}
          <div className="md:col-span-2">
            <label
              htmlFor="backup-api-base-url"
              className="block text-xs font-medium text-(--color-text-secondary)"
            >
              {isFa
                ? "آدرس پروکسی اختصاصی Bot API (اختیاری — ویژه هاست‌های ایران/فیلترشده)"
                : "Custom Telegram Bot API Proxy URL (Optional — for restricted hosts)"}
            </label>
            <input
              id="backup-api-base-url"
              type="text"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={telegramApiBaseUrl}
              onChange={(e) => setTelegramApiBaseUrl(e.target.value)}
              disabled={settings.envOverrides.apiBaseUrl}
              placeholder="https://my-tg-proxy.workers.dev (خالی = اتصال مستقیم به api.telegram.org)"
              className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none disabled:opacity-60"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-(--color-text-tertiary)">
              {settings.envOverrides.apiBaseUrl
                ? isFa
                  ? "تنظیم‌شده از طریق متغیر محیطی TELEGRAM_API_BASE_URL"
                  : "Configured via TELEGRAM_API_BASE_URL env var"
                : isFa
                  ? "اگر سرور هاست شما در ایران است یا اتصال مستقیم به api.telegram.org تایم‌اوت می‌دهد، آدرس یک Cloudflare Worker یا پروکسی HTTPS را وارد کنید (فقط HTTPS معتبر)."
                  : "Leave blank to connect directly to https://api.telegram.org. If your hosting provider blocks Telegram, enter an HTTPS reverse proxy (e.g. Cloudflare Worker)."}
            </p>
          </div>
        </div>

        {/* Live Connection Test Output */}
        {testResult && (
          <div
            data-testid="telegram-test-result"
            className={`mt-5 rounded-lg border p-3.5 sm:p-4 text-xs ${
              testResult.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-(--color-accent-red)/30 bg-(--color-accent-red)/10 text-(--color-accent-red)"
            }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between font-medium">
              <span
                dir={testResult.ok ? undefined : "ltr"}
                className="break-words rtl:text-right"
              >
                {testResult.ok
                  ? isFa
                    ? `اتصال موفق — ربات @${testResult.botUsername ?? "bot"}`
                    : `Connected — @${testResult.botUsername ?? "bot"}`
                  : testResult.error || (isFa ? "خطا در اتصال به تلگرام" : "Telegram connection failed")}
              </span>
              <span
                dir="ltr"
                className="font-[family-name:var(--font-mono)] text-[11px] opacity-90 break-words rtl:text-right"
              >
                Bot API: {testResult.botApiOk ? "OK" : "FAIL"} · MTProto:{" "}
                {testResult.mtprotoTested ? (testResult.mtprotoOk ? "OK (2GB)" : "FAIL") : "N/A"} ·
                Ping: {testResult.messageSent ? `Msg #${testResult.messageId}` : "Not sent"}
              </span>
            </div>
            {testResult.endpointUsed && (
              <p
                dir="ltr"
                className="mt-1.5 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary) break-all rtl:text-right"
              >
                Endpoint: {testResult.endpointUsed}
              </p>
            )}
            {testResult.networkHint && (
              <p className="mt-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-(--color-text-secondary)">
                {localizeTelegramHint(testResult.networkHint, isFa)}
              </p>
            )}
            {testResult.warnings.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 ps-5 text-[11px] text-amber-300">
                {testResult.warnings.map((w, idx) => (
                  <li key={idx} className="break-words">{w}</li>
                ))}
              </ul>
            )}
            {testResult.ok && isDirty && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-500/20 pt-2.5">
                <span className="text-[11px] text-emerald-200/90">
                  {isFa
                    ? "برای استفاده از این اطلاعات در بکاپ‌ها، آن‌ها را ذخیره کنید:"
                    : "Save these verified credentials so backups can use them:"}
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-500 px-3 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isFa ? "ذخیره همین اطلاعات" : "Save Credentials"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 2: Nightly 00:00 UTC Schedule & Archive + Cleanup Policy */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        {/* UTC Schedule */}
        <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) pb-3">
            <div>
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "زمان‌بندی خودکار شبانه (ساعت UTC)" : "Automated Nightly UTC Schedule"}
              </h2>
              <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                {isFa
                  ? "پیش‌فرض دقیقاً ساعت 00:00 UTC هر شب — ارسال ۲ فایل جداگانه"
                  : "Default 00:00 UTC every night — delivers 2 separate compressed archives"}
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-(--color-text-primary)">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-(--color-border-strong) accent-(--color-accent-purple)"
              />
              <span>{enabled ? (isFa ? "فعال" : "Enabled") : isFa ? "متوقف" : "Paused"}</span>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="backup-utc-hour"
                className="block text-xs font-medium text-(--color-text-secondary)"
              >
                {isFa ? "ساعت UTC (۰ تا ۲۳)" : "UTC Hour (0–23)"}
              </label>
              <input
                id="backup-utc-hour"
                type="number"
                min={0}
                max={23}
                value={scheduleUtcHour}
                onChange={(e) => setScheduleUtcHour(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-primary) focus:border-(--color-accent-purple) focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="backup-utc-minute"
                className="block text-xs font-medium text-(--color-text-secondary)"
              >
                {isFa ? "دقیقه UTC (۰ تا ۵۹)" : "UTC Minute (0–59)"}
              </label>
              <input
                id="backup-utc-minute"
                type="number"
                min={0}
                max={59}
                value={scheduleUtcMinute}
                onChange={(e) => setScheduleUtcMinute(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-primary) focus:border-(--color-accent-purple) focus:outline-none"
              />
            </div>
          </div>

          {/* Host Cleanup Verification Policy */}
          <div className="mt-5 border-t border-(--color-border-subtle) pt-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-(--color-text-primary)">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>
                {isFa ? "سیاست پاکسازی چندمرحله‌ای روی هاست" : "Multi-Pass Host Cleanup Verification"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="backup-cleanup-passes"
                  className="block text-xs font-medium text-(--color-text-secondary)"
                >
                  {isFa ? "تعداد دفعات چک مجدد پس از حذف" : "Independent Re-Check Passes"}
                </label>
                <select
                  id="backup-cleanup-passes"
                  value={cleanupVerifyPasses}
                  onChange={(e) => setCleanupVerifyPasses(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) focus:border-(--color-accent-purple) focus:outline-none"
                >
                  <option value={2}>{isFa ? "۲ بار بررسی مستقل" : "2 verification passes"}</option>
                  <option value={3}>{isFa ? "۳ بار بررسی مستقل (پیشنهادی)" : "3 verification passes (Recommended)"}</option>
                  <option value={4}>{isFa ? "۴ بار بررسی مستقل" : "4 verification passes"}</option>
                  <option value={5}>{isFa ? "۵ بار بررسی مستقل (سخت‌گیرانه)" : "5 verification passes (Strict)"}</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="backup-compression-level"
                  className="block text-xs font-medium text-(--color-text-secondary)"
                >
                  {isFa ? "سطح فشرده‌سازی Gzip (۱ تا ۹)" : "Gzip Compression Level (1–9)"}
                </label>
                <select
                  id="backup-compression-level"
                  value={compressionLevel}
                  onChange={(e) => setCompressionLevel(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) focus:border-(--color-accent-purple) focus:outline-none"
                >
                  <option value={3}>{isFa ? "۳ — سریع (کم‌مصرف CPU)" : "3 — Fast (low CPU)"}</option>
                  <option value={6}>{isFa ? "۶ — متعادل (پیشنهادی)" : "6 — Balanced (Recommended)"}</option>
                  <option value={9}>{isFa ? "۹ — حداکثر فشرده‌سازی" : "9 — Maximum compression"}</option>
                </select>
              </div>
            </div>

            <label className="mt-3.5 flex cursor-pointer items-center gap-2.5 text-xs text-(--color-text-secondary)">
              <input
                type="checkbox"
                checked={notifyCleanupSummary}
                onChange={(e) => setNotifyCleanupSummary(e.target.checked)}
                className="h-4 w-4 rounded border-(--color-border-strong) accent-(--color-accent-purple)"
              />
              <span>
                {isFa
                  ? "پس از پایان، گزارش تأیید پاکسازی کامل از هاست نیز در تلگرام ارسال شود"
                  : "Send a Telegram confirmation message verifying 0 bytes remain on host"}
              </span>
            </label>
          </div>
        </section>

        {/* Full Site Archive Contents Scope */}
        <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-4 sm:p-6">
          <div className="border-b border-(--color-border-subtle) pb-3">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "محتوای فایل دوم (آرشیو کامل سایت + دیتابیس)" : "Archive #2 Scope (Full Site + Database)"}
            </h2>
            <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
              {isFa
                ? "تمامی کدها، مقالات، تصاویر، آپلودها، تنظیمات و نسخه کامل دیتابیس همیشه در فایل دوم گنجانده می‌شوند."
                : "All source code, public assets, media uploads, data, configs, and a fresh DB dump are always included."}
            </p>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep)/60 p-3">
              <input
                type="checkbox"
                checked={includeEnvFile}
                onChange={(e) => setIncludeEnvFile(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-(--color-accent-purple)"
              />
              <div>
                <p className="font-medium text-(--color-text-primary)">
                  {isFa ? "شامل فایل تنظیمات محیطی (.env)" : "Include .env environment configuration"}
                </p>
                <p className="mt-0.5 text-[11px] text-(--color-text-tertiary)">
                  {isFa
                    ? "برای بازیابی سریع‌تر سایت توصیه می‌شود (فقط در کانال خصوصی تلگرام استفاده کنید)."
                    : "Recommended for turnkey restoration (use only with a private Telegram channel)."}
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep)/60 p-3">
              <input
                type="checkbox"
                checked={includeNodeModules}
                onChange={(e) => setIncludeNodeModules(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-(--color-accent-purple)"
              />
              <div>
                <p className="font-medium text-(--color-text-primary)">
                  {isFa ? "شامل پوشه node_modules" : "Include node_modules directory"}
                </p>
                <p className="mt-0.5 text-[11px] text-(--color-text-tertiary)">
                  {isFa
                    ? "معمولاً غیرفعال است (حجم بالا؛ با npm install قابل بازسازی است)."
                    : "Usually off (large size; reproducible via npm ci from package.json)."}
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep)/60 p-3">
              <input
                type="checkbox"
                checked={includeNextBuild}
                onChange={(e) => setIncludeNextBuild(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-(--color-accent-purple)"
              />
              <div>
                <p className="font-medium text-(--color-text-primary)">
                  {isFa ? "شامل خروجی بیلد کش (.next)" : "Include .next build cache"}
                </p>
                <p className="mt-0.5 text-[11px] text-(--color-text-tertiary)">
                  {isFa
                    ? "با دستور npm run build قابل بازسازی است."
                    : "Reproducible with npm run build."}
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep)/60 p-3">
              <input
                type="checkbox"
                checked={includeGitDir}
                onChange={(e) => setIncludeGitDir(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-(--color-accent-purple)"
              />
              <div>
                <p className="font-medium text-(--color-text-primary)">
                  {isFa ? "شامل تاریخچه گیت (.git)" : "Include Git history (.git)"}
                </p>
                <p className="mt-0.5 text-[11px] text-(--color-text-tertiary)">
                  {isFa
                    ? "در صورت نیاز به تاریخچه کامل کامیت‌ها فعال کنید."
                    : "Enable if you want full commit history inside the archive."}
                </p>
              </div>
            </label>
          </div>
        </section>
      </div>

      {/* Section 3: External cPanel Cron Job Integration */}
      <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 shrink-0 text-(--color-accent-purple)" />
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa
                  ? "کران جاب تضمینی cPanel (برای اجرای دقیق 00:00 UTC)"
                  : "Guaranteed cPanel Cron Trigger (Exact 00:00 UTC)"}
              </h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-(--color-text-tertiary)">
              {isFa
                ? "زمان‌بند داخلی نود به‌طور خودکار فعال است؛ اما در هاست‌های اشتراکی cPanel افزودن این خط در بخش Cron Jobs اجرای دقیق ساعت 00:00 UTC را تضمین می‌کند."
                : "The built-in Node scheduler runs automatically; on shared cPanel hosts where idle processes sleep, add this line in cPanel Cron Jobs."}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              type="button"
              disabled={rotatingSecret || settings.envOverrides.cronSecret}
              onClick={handleRotateCronSecret}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) disabled:opacity-50 sm:flex-none whitespace-nowrap"
            >
              {rotatingSecret ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              <span>
                {settings.hasCronSecret
                  ? isFa
                    ? "تولید کلید جدید Cron"
                    : "Rotate Cron Secret"
                  : isFa
                    ? "ساخت کلید Cron"
                    : "Generate Cron Secret"}
              </span>
            </button>
            <button
              type="button"
              onClick={handleCopyCron}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) sm:flex-none whitespace-nowrap"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>{copiedCron ? (isFa ? "کپی شد" : "Copied") : isFa ? "کپی دستور" : "Copy Command"}</span>
            </button>
          </div>
        </div>

        <pre
          dir="ltr"
          className="mt-3 overflow-x-auto rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 py-3 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)"
        >
          {cronCommand}
        </pre>

        {revealedCronSecret && (
          <p className="mt-2 text-[11px] text-amber-300">
            {isFa
              ? "این کلید جدید فقط یک‌بار نمایش داده می‌شود — همین الان دستور بالا را در Cron Jobs کپی کنید."
              : "This new cron secret is shown once only — copy the command above into cPanel Cron Jobs now."}
          </p>
        )}
      </section>

      {/* Primary Save Footer + Inline Feedback */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {saveFeedback && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs ${
                saveFeedback.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-(--color-accent-red)/30 bg-(--color-accent-red)/10 text-(--color-accent-red)"
              }`}
            >
              {saveFeedback.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span className="break-words">{saveFeedback.text}</span>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-(--color-accent-purple) px-5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          <Save className="h-4 w-4" />
          <span>
            {saving
              ? isFa
                ? "در حال ذخیره..."
                : "Saving..."
              : isFa
                ? "ذخیره تنظیمات بکاپ"
                : "Save Backup Settings"}
          </span>
        </button>
      </div>
    </form>
  );
});
