"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FolderArchive,
  HardDriveDownload,
  History,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { useAdminLocale } from "@/components/admin/admin-locale-context";
import {
  formatBytes,
  formatDurationMs,
  formatUtcClock,
  type BackupDiskInspection,
  type BackupRunRecord,
  type BackupSettingsPublic,
  type CleanupVerificationReport,
} from "@/lib/backup-format";
import {
  BackupSettingsForm,
  type BackupSettingsFormHandle,
} from "./backup-settings-form";
import { BackupHistoryTable } from "./backup-history-table";

type BackupWorkspaceTab = "overview" | "settings" | "history";

interface BackupOverviewPayload {
  settings: BackupSettingsPublic;
  runs: BackupRunRecord[];
  disk: BackupDiskInspection;
  dbEngine: "mysql" | "sqlite";
  running: boolean;
  activeRunId: string | null;
  serverUtcNow: string;
}

function formatCountdown(targetIso: string, nowMs: number): string {
  const diff = Math.max(0, new Date(targetIso).getTime() - nowMs);
  const totalSec = Math.floor(diff / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function BackupCenter() {
  const { isFa } = useAdminLocale();
  const [tab, setTab] = useState<BackupWorkspaceTab>("overview");
  const [data, setData] = useState<BackupOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [executing, setExecuting] = useState<"live" | "dry_run" | null>(null);
  const [purging, setPurging] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const settingsFormRef = useRef<BackupSettingsFormHandle | null>(null);

  const loadOverview = useCallback(async () => {
    return adminFetch<BackupOverviewPayload>("/api/admin/backups/runs?limit=30");
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadOverview()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load backup center.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadOverview]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await loadOverview();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh backups.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleTriggerBackup(dryRun: boolean) {
    setExecuting(dryRun ? "dry_run" : "live");
    setNotice(null);
    setError(null);
    try {
      let activeSettings = data?.settings ?? null;

      // If the admin typed Telegram settings without clicking Save yet, automatically
      // save them first so "Run Full Backup Now" never fails with stale/empty DB config.
      if (!dryRun && settingsFormRef.current?.hasUnsavedChanges()) {
        const saved = await settingsFormRef.current.saveNow();
        if (!saved) {
          setTab("settings");
          setNotice({
            ok: false,
            text: isFa
              ? "ذخیره تنظیمات تلگرام ناموفق بود — خطای فیلدها را در تب تنظیمات بررسی و اصلاح کنید."
              : "Could not save your pending Telegram settings — please fix the highlighted validation error first.",
          });
          return;
        }
        activeSettings = saved;
      }

      if (!dryRun && activeSettings && (!activeSettings.hasBotToken || !activeSettings.telegramChatId)) {
        setTab("settings");
        setNotice({
          ok: false,
          text: !activeSettings.hasBotToken
            ? isFa
              ? "توکن ربات تلگرام هنوز ثبت نشده است. توکن را وارد کرده و روی «ذخیره تنظیمات» کلیک کنید."
              : "Telegram Bot Token is not saved yet. Enter your Bot Token and click Save Settings."
            : isFa
              ? "شناسه چت یا کانال مقصد (Chat ID) هنوز ثبت نشده است."
              : "Target Telegram Chat / Channel ID is not saved yet.",
        });
        return;
      }

      const res = await adminFetch<{ run: BackupRunRecord; disk: BackupDiskInspection }>(
        "/api/admin/backups/run",
        {
          method: "POST",
          body: JSON.stringify({ dryRun }),
        }
      );
      const updated = await loadOverview();
      setData(updated);

      if (res.run.status === "success" || res.run.status === "dry_run") {
        setNotice({
          ok: true,
          text: dryRun
            ? isFa
              ? `آزمایش کامل انجام شد: فایل دیتابیس (${formatBytes(res.run.dbSizeBytes)}) و فایل کامل سایت+دیتابیس (${formatBytes(res.run.fullSizeBytes)}) ساخته و پس از ${res.run.cleanupPasses} بار بررسی کاملاً از هاست پاک شدند.`
              : `Verification dry-run complete: DB (${formatBytes(res.run.dbSizeBytes)}) + Full Site+DB (${formatBytes(res.run.fullSizeBytes)}) built and verified purged (${res.run.cleanupPasses}/${res.run.cleanupPasses} passes, 0 files left).`
            : isFa
              ? `هر ۲ فایل بکاپ با موفقیت به تلگرام ارسال شدند و پس از ${res.run.cleanupPasses} بار بررسی، هیچ فایلی روی هاست باقی نماند.`
              : `Both backup files delivered to Telegram and verified purged from host (${res.run.cleanupPasses}/${res.run.cleanupPasses} checks passed, 0 left).`,
        });
      } else {
        setNotice({
          ok: false,
          text:
            res.run.errorMessage ||
            (isFa
              ? "عملیات بکاپ با خطا مواجه شد، اما فایل‌های موقت از هاست پاکسازی شدند."
              : "Backup encountered an error; temporary host files were still purged."),
        });
      }
    } catch (err) {
      setNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Backup execution failed.",
      });
    } finally {
      setExecuting(null);
    }
  }

  async function handleManualCleanup() {
    setPurging(true);
    setNotice(null);
    try {
      const passes = data?.settings.cleanupVerifyPasses ?? 3;
      const res = await adminFetch<{
        report: CleanupVerificationReport;
        disk: BackupDiskInspection;
      }>("/api/admin/backups/cleanup", {
        method: "POST",
        body: JSON.stringify({ passes }),
      });
      setData((prev) => (prev ? { ...prev, disk: res.disk } : prev));
      setNotice({
        ok: res.report.verified,
        text: res.report.verified
          ? isFa
            ? `بررسی ${res.report.passesCompleted} مرحله‌ای تکمیل شد: پوشه بکاپ روی هاست کاملاً پاک است (۰ فایل / ۰ بایت).`
            : `${res.report.passesCompleted}-pass host verification complete: staging disk is completely clean (0 files / 0 B).`
          : isFa
            ? `هشدار: هنوز ${res.report.remainingFiles} فایل روی هاست باقی مانده است.`
            : `Warning: ${res.report.remainingFiles} files still remain on host.`,
      });
    } catch (err) {
      setNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Cleanup verification failed.",
      });
    } finally {
      setPurging(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-14 animate-pulse rounded-xl bg-(--color-bg-secondary)" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-(--color-bg-secondary)" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-(--color-bg-secondary)" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 p-6">
        <p className="text-sm font-medium text-(--color-accent-red)">{error}</p>
        <button
          type="button"
          onClick={handleRefresh}
          className="mt-3 rounded-lg border border-(--color-border-strong) px-3.5 py-2 text-xs font-medium text-(--color-text-primary)"
        >
          {isFa ? "تلاش مجدد" : "Retry"}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { settings, runs, disk, dbEngine } = data;
  const latestRun = runs[0] ?? null;
  const nextClock = formatUtcClock(settings.scheduleUtcHour, settings.scheduleUtcMinute);
  const countdown = formatCountdown(settings.nextScheduledRunUtc, nowMs);

  const transportTitle = settings.mtprotoReady
    ? "MTProto (2 GB)"
    : settings.botApiReady
      ? "Bot API (50 MB)"
      : isFa
        ? "پیکربندی نشده"
        : "Not Configured";

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col gap-3.5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-(--color-text-primary) sm:text-2xl">
            {isFa ? "مرکز پشتیبان‌گیری خودکار به تلگرام" : "Automated Telegram Backup Center"}
          </h1>
          <p className="mt-1 text-xs text-(--color-text-tertiary)">
            {isFa
              ? "بکاپ شبانه ساعت 00:00 UTC شامل ۲ فایل جداگانه (دیتابیس فشرده + کل سایت همراه دیتابیس) با پشتیبانی MTProto تا ۲ گیگابایت و پاکسازی چندمرحله‌ای هاست"
              : "Nightly 00:00 UTC 2-file archive pipeline (Database + Complete Site & DB) via Telegram MTProto (up to 2 GB) with multi-pass host cleanup"}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:shrink-0">
          <button
            type="button"
            disabled={Boolean(executing) || data.running}
            onClick={() => handleTriggerBackup(true)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) disabled:opacity-50 whitespace-nowrap sm:flex-none"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#38bdf8]" />
            <span>
              {executing === "dry_run"
                ? isFa
                  ? "در حال تست..."
                  : "Running dry-run..."
                : isFa
                  ? "تست ساخت و پاکسازی"
                  : "Verification Dry-Run"}
            </span>
          </button>

          <button
            type="button"
            disabled={Boolean(executing) || data.running}
            onClick={() => handleTriggerBackup(false)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-(--color-accent-purple) px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap sm:flex-none sm:px-4"
          >
            {executing === "live" ? (
              <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {executing === "live"
                ? isFa
                  ? "در حال ارسال..."
                  : "Backing up..."
                : isFa
                  ? "اجرای بکاپ الان"
                  : "Run Full Backup Now"}
            </span>
          </button>

          <button
            type="button"
            disabled={refreshing}
            onClick={handleRefresh}
            aria-label={isFa ? "بروزرسانی وضعیت" : "Refresh backup status"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="flex flex-col gap-2 border-b border-(--color-border-subtle) pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label={isFa ? "بخش‌های پشتیبان‌گیری" : "Backup workspaces"}
          className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1 text-xs"
        >
          {(
            [
              { id: "overview", en: "Overview & Pipeline", fa: "نمای کلی و چرخه اجرا", Icon: HardDriveDownload },
              { id: "settings", en: "Telegram, MTProto & Schedule", fa: "تنظیمات تلگرام و زمان‌بندی", Icon: Settings2 },
              { id: "history", en: "History & Cleanup Audit", fa: "تاریخچه و ممیزی پاکسازی", Icon: History },
            ] as const
          ).map(({ id, en, fa, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{isFa ? fa : en}</span>
              </button>
            );
          })}
        </div>

        <p className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
          {isFa ? `موتور دیتابیس فعال: ${dbEngine.toUpperCase()}` : `Active DB Engine: ${dbEngine.toUpperCase()}`}
        </p>
      </div>

      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs ${
            notice.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-(--color-accent-red)/30 bg-(--color-accent-red)/10 text-(--color-accent-red)"
          }`}
        >
          <span className="flex items-center gap-2">
            {notice.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 opacity-75 hover:opacity-100"
          >
            {isFa ? "بستن" : "Dismiss"}
          </button>
        </div>
      )}

      {/* 4-Cell Unified Executive KPI Strip */}
      <section className="grid divide-y divide-(--color-border-subtle) overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x rtl:lg:divide-x-reverse">
        {/* Cell 1: Nightly UTC Schedule */}
        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "زمان‌بندی خودکار شبانه" : "Nightly UTC Schedule"}
            </p>
            <span
              className={`font-[family-name:var(--font-mono)] text-[11px] font-medium ${
                settings.enabled ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {settings.enabled ? (isFa ? "فعال" : "Active") : isFa ? "متوقف" : "Paused"}
            </span>
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)" dir="ltr">
            {nextClock}
          </p>
          <p className="mt-1.5 truncate font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa ? `اجرای بعدی تا ${countdown} دیگر` : `Next run in ${countdown}`}
          </p>
        </div>

        {/* Cell 2: Telegram Transport & Limit */}
        <div className="border-t border-(--color-border-subtle) p-5 sm:border-t-0 sm:border-s lg:border-s-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "کانال ارسال تلگرام" : "Telegram Delivery Engine"}
            </p>
            <span
              className={`font-[family-name:var(--font-mono)] text-[11px] font-medium ${
                settings.mtprotoReady
                  ? "text-emerald-400"
                  : settings.botApiReady
                    ? "text-[#38bdf8]"
                    : "text-amber-400"
              }`}
            >
              {settings.mtprotoReady
                ? isFa
                  ? "فایل حجیم فعال"
                  : "2 GB Ready"
                : settings.botApiReady
                  ? "50 MB Max"
                  : isFa
                    ? "نیاز به تنظیم"
                    : "Setup Needed"}
            </span>
          </div>
          <p className="mt-2 truncate font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {transportTitle}
          </p>
          <p className="mt-1.5 truncate font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {settings.telegramChatId
              ? `${isFa ? "مقصد:" : "Target:"} ${settings.telegramChatId}`
              : isFa
                ? "توکن و api_id / api_hash را وارد کنید"
                : "Set Bot Token + api_id / api_hash"}
          </p>
        </div>

        {/* Cell 3: Latest 2-File Backup */}
        <div className="border-t border-(--color-border-subtle) p-5 lg:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "آخرین بکاپ ۲ فایلی" : "Latest 2-File Snapshot"}
            </p>
            <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
              {latestRun ? formatDurationMs(latestRun.durationMs) : "—"}
            </span>
          </div>
          <p
            dir="ltr"
            className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary) rtl:text-right"
          >
            {latestRun ? formatBytes(latestRun.dbSizeBytes + latestRun.fullSizeBytes) : "—"}
          </p>
          <p className="mt-1.5 truncate font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {latestRun
              ? `DB ${formatBytes(latestRun.dbSizeBytes)} · Full ${formatBytes(latestRun.fullSizeBytes)}`
              : isFa
                ? "هنوز هیچ بکاپی اجرا نشده است"
                : "No backup executed yet"}
          </p>
        </div>

        {/* Cell 4: Host Disk Cleanliness */}
        <div className="border-t border-(--color-border-subtle) p-5 sm:border-s lg:border-t-0 lg:border-s-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "وضعیت پاکسازی روی هاست" : "Host Staging Disk"}
            </p>
            <span
              className={`font-[family-name:var(--font-mono)] text-[11px] font-medium ${
                disk.clean ? "text-emerald-400" : "text-(--color-accent-red)"
              }`}
            >
              {disk.clean ? (isFa ? "کاملاً پاک" : "Verified Clean") : isFa ? "دارای فایل" : "Files Found"}
            </span>
          </div>
          <p
            dir="ltr"
            className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary) rtl:text-right"
          >
            {formatBytes(disk.totalBytes)}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-(--color-text-tertiary)">
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {disk.fileCount} {isFa ? "فایل" : "files"} · {settings.cleanupVerifyPasses}x{" "}
              {isFa ? "چک حذف" : "verify"}
            </span>
            <button
              type="button"
              disabled={purging || Boolean(executing)}
              onClick={handleManualCleanup}
              className="inline-flex items-center gap-1 font-medium text-(--color-accent-purple) hover:underline disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              <span>{purging ? "..." : isFa ? "چک و پاکسازی" : "Verify & Purge"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* WORKSPACE 1: OVERVIEW & 3-STAGE PIPELINE */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* 3-Stage Nightly Execution Pipeline Architecture */}
          <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--color-border-subtle) pb-4">
              <div>
                <h2 className="text-sm font-semibold text-(--color-text-primary)">
                  {isFa
                    ? "معماری اجرای شبانه (هر شب ساعت 00:00 UTC — ۲ فایل مجزا + پاکسازی تضمینی)"
                    : "Nightly Backup Pipeline (00:00 UTC — 2 Separate Files + Verified Host Purge)"}
                </h2>
                <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                  {isFa
                    ? "تمامی مراحل به‌صورت متوالی و ایزوله در پوشه موقت انجام شده و در بلوک نهایی حتی در صورت خطا پاکسازی می‌شوند."
                    : "Each stage runs sequentially inside an isolated staging folder and always executes multi-pass deletion in a guaranteed finally block."}
                </p>
              </div>
              {!settings.botApiReady && (
                <button
                  type="button"
                  onClick={() => setTab("settings")}
                  className="text-xs font-medium text-(--color-accent-purple) hover:underline whitespace-nowrap"
                >
                  {isFa ? "تنظیم ربات تلگرام و api_id / api_hash ←" : "Configure Telegram & MTProto →"}
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              {/* Stage 1 */}
              <div className="space-y-2 border-b border-(--color-border-subtle) pb-4 lg:border-b-0 lg:border-e lg:pe-5 lg:pb-0">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-(--color-text-primary)">
                    <Database className="h-4 w-4 text-[#38bdf8]" />
                    <span>{isFa ? "۰۱. فایل اول: بکاپ فشرده دیتابیس" : "01. File 1: Compressed Database"}</span>
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary)">
                    .tar.gz
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-(--color-text-tertiary)">
                  {isFa
                    ? "خروجی کامل SQL از تمام جداول (MySQL یا SQLite) + اسنپ‌شات باینری و هش SHA-256 فشرده شده و بلافاصله به تلگرام ارسال می‌شود."
                    : "Exports full SQL schema & rows (MySQL or SQLite) plus manifest & SHA-256 checksum, compresses to .tar.gz, and uploads to Telegram first."}
                </p>
                {latestRun && (
                  <p className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                    {isFa ? "آخرین حجم:" : "Last size:"} {formatBytes(latestRun.dbSizeBytes)} ·{" "}
                    {latestRun.dbTableCount} {isFa ? "جدول" : "tables"}
                  </p>
                )}
              </div>

              {/* Stage 2 */}
              <div className="space-y-2 border-b border-(--color-border-subtle) pb-4 lg:border-b-0 lg:border-e lg:pe-5 lg:pb-0">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-(--color-text-primary)">
                    <FolderArchive className="h-4 w-4 text-(--color-accent-purple)" />
                    <span>{isFa ? "۰۲. فایل دوم: کل سایت + دیتابیس" : "02. File 2: Full Site + DB"}</span>
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary)">
                    {settings.mtprotoReady ? "MTProto 2GB" : "Bot API 50MB"}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-(--color-text-tertiary)">
                  {isFa
                    ? "آرشیو کامل تمام فایل‌های سایت (کدها، تصاویر، آپلودها، تنظیمات) همراه نسخه تازه دیتابیس در یک فایل جداگانه فشرده و به تلگرام ارسال می‌شود."
                    : "Packages the entire site directory (source, media, uploads, configs) together with the fresh DB backup into a 2nd separate archive and sends via Telegram."}
                </p>
                {latestRun && (
                  <p className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                    {isFa ? "آخرین حجم:" : "Last size:"} {formatBytes(latestRun.fullSizeBytes)} ·{" "}
                    {latestRun.fullFileCount.toLocaleString()} {isFa ? "فایل" : "entries"}
                  </p>
                )}
              </div>

              {/* Stage 3 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-(--color-text-primary)">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>
                      {isFa
                        ? `۰۳. پاکسازی و ${settings.cleanupVerifyPasses} بار چک روی هاست`
                        : `03. ${settings.cleanupVerifyPasses}x Verified Host Cleanup`}
                    </span>
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-emerald-400">
                    {disk.clean ? "0 B" : formatBytes(disk.totalBytes)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-(--color-text-tertiary)">
                  {isFa
                    ? `پس از اتمام ارسال، هر دو فایل و پوشه موقت حذف شده و سیستم به‌صورت مستقل ${settings.cleanupVerifyPasses} بار پیاپی وجود نداشتن هیچ فایل بکاپی روی هاست را راستی‌آزمایی می‌کند.`
                    : `After delivery completes (or on error), both archives and temp folders are purged and independently re-verified ${settings.cleanupVerifyPasses} consecutive times to guarantee 0 bytes remain on the host.`}
                </p>
                <p className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-emerald-400">
                  {disk.clean
                    ? isFa
                      ? "وضعیت فعلی هاست: ۰ فایل باقی‌مانده"
                      : "Current host disk: 0 leftover files"
                    : isFa
                      ? `${disk.fileCount} فایل موقت شناسایی شد`
                      : `${disk.fileCount} temp files detected`}
                </p>
              </div>
            </div>
          </section>

          {/* Recent Runs Summary */}
          <BackupHistoryTable runs={runs.slice(0, 10)} isFa={isFa} />
        </div>
      )}

      {/* WORKSPACE 2: SETTINGS (kept mounted so tab switches never discard unsaved inputs) */}
      <div className={tab === "settings" ? "" : "hidden"}>
        <BackupSettingsForm
          ref={settingsFormRef}
          settings={settings}
          isFa={isFa}
          onSaved={(nextSettings) => {
            setData((prev) => (prev ? { ...prev, settings: nextSettings } : prev));
          }}
        />
      </div>

      {/* WORKSPACE 3: FULL HISTORY & AUDIT */}
      {tab === "history" && <BackupHistoryTable runs={runs} isFa={isFa} />}
    </div>
  );
}
