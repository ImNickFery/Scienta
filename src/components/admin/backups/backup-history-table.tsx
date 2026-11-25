"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FolderArchive,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Clock,
} from "lucide-react";
import { formatBytes, formatDurationMs, type BackupRunRecord } from "@/lib/backup-format";

interface BackupHistoryTableProps {
  runs: BackupRunRecord[];
  isFa: boolean;
}

type StatusFilter = "all" | "success" | "dry_run" | "failed";

function formatTimestamp(iso: string | null, isFa: boolean): string {
  if (!iso) return "—";
  const normalized = iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(isFa ? "fa-IR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(d);
}

function statusMeta(status: BackupRunRecord["status"], isFa: boolean) {
  switch (status) {
    case "success":
      return {
        label: isFa ? "موفق (ارسال ۲ فایل)" : "Delivered (2 files)",
        color: "text-emerald-400",
        Icon: CheckCircle2,
      };
    case "dry_run":
      return {
        label: isFa ? "تست محلی موفق" : "Verified Dry-Run",
        color: "text-[#38bdf8]",
        Icon: ShieldCheck,
      };
    case "partial":
      return {
        label: isFa ? "ناقص (ارسال جزئی)" : "Partial Delivery",
        color: "text-amber-400",
        Icon: ShieldAlert,
      };
    case "running":
      return {
        label: isFa ? "در حال اجرا" : "Running",
        color: "text-(--color-accent-purple)",
        Icon: Clock,
      };
    default:
      return {
        label: isFa ? "ناموفق" : "Failed",
        color: "text-(--color-accent-red)",
        Icon: XCircle,
      };
  }
}

function triggerLabel(trigger: BackupRunRecord["triggerSource"], isFa: boolean): string {
  switch (trigger) {
    case "scheduled":
      return isFa ? "خودکار 00:00 UTC" : "Scheduled 00:00 UTC";
    case "cron":
      return isFa ? "کران سرور (UTC)" : "Server Cron (UTC)";
    case "dry_run":
      return isFa ? "آزمایش محلی" : "Dry-Run Check";
    default:
      return isFa ? "اجرای دستی" : "Manual Run";
  }
}

export function BackupHistoryTable({ runs, isFa }: BackupHistoryTableProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(runs[0]?.id ?? null);

  const filtered = runs.filter((r) => {
    if (filter === "all") return true;
    if (filter === "failed") return r.status === "failed" || r.status === "partial";
    return r.status === filter;
  });

  return (
    <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) pb-4">
        <div>
          <h2 className="text-sm font-semibold text-(--color-text-primary)">
            {isFa ? "تاریخچه بکاپ‌ها و گزارش ممیزی پاکسازی هاست" : "Backup Run History & Host Cleanup Audit"}
          </h2>
          <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
            {isFa
              ? "جزئیات هر دو فایل ارسالی به تلگرام به همراه نتیجه بررسی‌های چندباره حذف فایل از روی سرور"
              : "Audit log of both Telegram archives and multi-pass host disk deletion checks for every run"}
          </p>
        </div>

        <div
          role="group"
          aria-label={isFa ? "فیلتر وضعیت بکاپ‌ها" : "Filter backup history"}
          className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-xs"
        >
          {(
            [
              { id: "all", en: "All", fa: "همه" },
              { id: "success", en: "Delivered", fa: "ارسال‌شده" },
              { id: "dry_run", en: "Dry-Run", fa: "تست محلی" },
              { id: "failed", en: "Failed", fa: "ناموفق" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? "bg-white/[0.12] text-(--color-text-primary)"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              {isFa ? tab.fa : tab.en}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-(--color-text-tertiary)">
          {isFa
            ? "هنوز هیچ بکاپی در این دسته ثبت نشده است. از دکمه‌های بالا یک تست یا بکاپ واقعی اجرا کنید."
            : "No backup runs recorded in this view yet. Run a live backup or local verification dry-run above."}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-(--color-border-subtle)">
          {filtered.map((run) => {
            const meta = statusMeta(run.status, isFa);
            const StatusIcon = meta.Icon;
            const expanded = expandedId === run.id;

            return (
              <div key={run.id} className="py-3.5 first:pt-1 last:pb-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${meta.color}`}>
                        <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>{meta.label}</span>
                      </span>
                      <span className="text-(--color-text-tertiary)">·</span>
                      <span className="font-medium text-(--color-text-secondary)">
                        {triggerLabel(run.triggerSource, isFa)}
                      </span>
                      <span className="text-(--color-text-tertiary)">·</span>
                      <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                        {formatTimestamp(run.startedAt, isFa)} UTC · {formatDurationMs(run.durationMs)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                      <span className="inline-flex items-center gap-1.5 text-(--color-text-secondary)">
                        <Database className="h-3 w-3 text-[#38bdf8]" />
                        <span>
                          {isFa ? "فایل ۱ (دیتابیس):" : "File 1 (DB):"} {formatBytes(run.dbSizeBytes)}
                          {run.dbTransport ? ` [${run.dbTransport}]` : ""}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-(--color-text-secondary)">
                        <FolderArchive className="h-3 w-3 text-(--color-accent-purple)" />
                        <span>
                          {isFa ? "فایل ۲ (کل سایت+DB):" : "File 2 (Full Site+DB):"}{" "}
                          {formatBytes(run.fullSizeBytes)} ({run.fullFileCount.toLocaleString()}{" "}
                          {isFa ? "فایل" : "files"})
                        </span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          run.cleanupVerified ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {run.cleanupVerified ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <ShieldAlert className="h-3 w-3" />
                        )}
                        <span>
                          {run.cleanupVerified
                            ? isFa
                              ? `پاکسازی هاست: ${run.cleanupPasses}/${run.cleanupPasses} تأیید (۰ فایل باقی‌مانده)`
                              : `Host Cleanup: ${run.cleanupPasses}/${run.cleanupPasses} verified (0 left)`
                            : isFa
                              ? `هشدار پاکسازی (${run.cleanupRemainingFiles} باقی‌مانده)`
                              : `Cleanup warning (${run.cleanupRemainingFiles} remaining)`}
                        </span>
                      </span>
                    </div>

                    {run.errorMessage && (
                      <p className="mt-1 text-xs text-(--color-accent-red)">{run.errorMessage}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : run.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-2.5 text-xs text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap"
                  >
                    <span>{isFa ? "جزئیات و ممیزی حذف" : "Artifacts & Cleanup Log"}</span>
                    {expanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {expanded && (
                  <div className="mt-3 space-y-3 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-4 text-xs">
                    {/* 2 Artifacts Breakdown */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="font-semibold text-(--color-text-primary)">
                          {isFa ? "۱. آرشیو فشرده دیتابیس" : "1. Compressed Database Archive"}
                        </p>
                        <p className="truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)" dir="ltr">
                          {run.dbFileName || "—"}
                        </p>
                        <p className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                          {run.dbEngine.toUpperCase()} · {run.dbTableCount} {isFa ? "جدول" : "tables"} ·{" "}
                          {formatBytes(run.dbSizeBytes)}
                          {run.dbTelegramMessageId ? ` · TG #${run.dbTelegramMessageId}` : ""}
                        </p>
                        {run.dbSha256 && (
                          <p className="truncate font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary)" dir="ltr">
                            SHA-256: {run.dbSha256}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="font-semibold text-(--color-text-primary)">
                          {isFa ? "۲. آرشیو کامل سایت + دیتابیس" : "2. Full Site + Database Archive"}
                        </p>
                        <p className="truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)" dir="ltr">
                          {run.fullFileName || "—"}
                        </p>
                        <p className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                          {run.fullFileCount.toLocaleString()} {isFa ? "فایل" : "entries"} ·{" "}
                          {formatBytes(run.fullSizeBytes)}
                          {run.fullTelegramMessageId ? ` · TG #${run.fullTelegramMessageId}` : ""}
                        </p>
                        {run.fullSha256 && (
                          <p className="truncate font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary)" dir="ltr">
                            SHA-256: {run.fullSha256}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Multi-pass Host Cleanup Verification Table */}
                    {run.cleanupLog && run.cleanupLog.passes.length > 0 && (
                      <div className="border-t border-(--color-border-subtle) pt-3">
                        <p className="mb-2 text-[11px] font-semibold text-(--color-text-primary)">
                          {isFa
                            ? "گزارش مرحله‌به‌مرحله تأیید حذف فایل‌های بکاپ از روی هاست"
                            : "Step-by-Step Host Cleanup Verification Passes"}
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-start font-[family-name:var(--font-mono)] text-[11px] tabular-nums">
                            <thead>
                              <tr className="border-b border-(--color-border-subtle) text-(--color-text-tertiary)">
                                <th className="py-1.5 pe-3 text-start font-medium">
                                  {isFa ? "مرحله" : "Pass"}
                                </th>
                                <th className="py-1.5 pe-3 text-start font-medium">
                                  {isFa ? "زمان بررسی (UTC)" : "Checked At (UTC)"}
                                </th>
                                <th className="py-1.5 pe-3 text-start font-medium">
                                  {isFa ? "فایل DB" : "DB File"}
                                </th>
                                <th className="py-1.5 pe-3 text-start font-medium">
                                  {isFa ? "فایل کل سایت" : "Full File"}
                                </th>
                                <th className="py-1.5 pe-3 text-start font-medium">
                                  {isFa ? "باقی‌مانده روی هاست" : "Host Leftover"}
                                </th>
                                <th className="py-1.5 text-end font-medium">
                                  {isFa ? "نتیجه" : "Result"}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-(--color-border-subtle)/60">
                              {run.cleanupLog.passes.map((p) => (
                                <tr key={p.pass}>
                                  <td className="py-1.5 pe-3 text-(--color-text-primary)">
                                    #{p.pass}
                                  </td>
                                  <td className="py-1.5 pe-3 text-(--color-text-tertiary)" dir="ltr">
                                    {p.checkedAt.replace("T", " ").slice(0, 19)}Z
                                  </td>
                                  <td className="py-1.5 pe-3 text-emerald-400">
                                    {p.dbArchiveExists
                                      ? isFa
                                        ? "موجود"
                                        : "Present"
                                      : isFa
                                        ? "حذف‌شده"
                                        : "Deleted"}
                                  </td>
                                  <td className="py-1.5 pe-3 text-emerald-400">
                                    {p.fullArchiveExists
                                      ? isFa
                                        ? "موجود"
                                        : "Present"
                                      : isFa
                                        ? "حذف‌شده"
                                        : "Deleted"}
                                  </td>
                                  <td className="py-1.5 pe-3 text-(--color-text-secondary)">
                                    {p.stagingRemainingFiles} {isFa ? "فایل" : "files"} (
                                    {formatBytes(p.stagingRemainingBytes)})
                                  </td>
                                  <td
                                    className={`py-1.5 text-end font-semibold ${
                                      p.passed ? "text-emerald-400" : "text-(--color-accent-red)"
                                    }`}
                                  >
                                    {p.passed ? (isFa ? "پاک و تأییدشده" : "Verified Clean") : isFa ? "ناموفق" : "Failed"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
