"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import {
  formatEmailDate,
  kindLabel,
  statusColorClass,
  statusLabel,
  type EmailLogRow,
} from "./types";

interface Props {
  isFa: boolean;
  refreshSignal: number;
  onRetried: () => Promise<void>;
}

export function EmailLogsTab({ isFa, refreshSignal, onRetried }: Props) {
  const [items, setItems] = useState<EmailLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [inspectLog, setInspectLog] = useState<EmailLogRow | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ pageSize: "40" });
      if (statusFilter) params.set("status", statusFilter);
      if (kindFilter) params.set("kind", kindFilter);
      if (search.trim()) params.set("search", search.trim());
      const data = await adminFetch<{ items: EmailLogRow[]; total: number }>(
        `/api/admin/email/logs?${params}`
      );
      setError(null);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load delivery logs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, kindFilter, search]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const params = new URLSearchParams({ pageSize: "40" });
        if (statusFilter) params.set("status", statusFilter);
        if (kindFilter) params.set("kind", kindFilter);
        if (search.trim()) params.set("search", search.trim());
        const data = await adminFetch<{ items: EmailLogRow[]; total: number }>(
          `/api/admin/email/logs?${params}`
        );
        if (cancelled) return;
        setError(null);
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load delivery logs");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [statusFilter, kindFilter, search, refreshSignal]);

  async function handleRetry(log: EmailLogRow) {
    setRetryingId(log.id);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch<{ status: string; providerMode: string }>(
        `/api/admin/email/logs/${log.id}/retry`,
        { method: "POST" }
      );
      setNotice(
        isFa
          ? `ارسال مجدد به ${log.recipient_email} انجام شد — وضعیت: ${statusLabel(res.status, true)}`
          : `Retried delivery to ${log.recipient_email} — Status: ${statusLabel(res.status, false)}`
      );
      await Promise.all([loadLogs(), onRetried()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-(--color-text-tertiary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isFa ? "جستجو بر اساس ایمیل گیرنده یا موضوع…" : "Search recipient email or subject…"}
            aria-label={isFa ? "جستجو در گزارش ارسال‌ها" : "Search email logs"}
            className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) ps-9 pe-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={isFa ? "فیلتر وضعیت" : "Filter by status"}
          className="h-9 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
        >
          <option value="">{isFa ? "همه وضعیت‌ها" : "All statuses"}</option>
          <option value="sent">{isFa ? "ارسال واقعی (Delivered)" : "Delivered"}</option>
          <option value="sandbox">{isFa ? "آزمایشی (Sandbox)" : "Sandbox"}</option>
          <option value="failed">{isFa ? "ناموفق (Failed)" : "Failed"}</option>
          <option value="suppressed">{isFa ? "مسدودشده (Suppressed)" : "Suppressed"}</option>
        </select>

        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          aria-label={isFa ? "فیلتر نوع ایمیل" : "Filter by type"}
          className="h-9 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
        >
          <option value="">{isFa ? "همه نوع‌ها" : "All types"}</option>
          <option value="direct">{isFa ? "مستقیم" : "Direct"}</option>
          <option value="campaign">{isFa ? "کمپین" : "Campaign"}</option>
          <option value="reply">{isFa ? "پاسخ تماس" : "Inbox Reply"}</option>
          <option value="automation">{isFa ? "خودکار" : "Automation"}</option>
          <option value="test">{isFa ? "تست" : "Test"}</option>
        </select>

        <button
          type="button"
          onClick={() => void loadLogs()}
          aria-label={isFa ? "بروزرسانی گزارش‌ها" : "Refresh logs"}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary) whitespace-nowrap"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="font-[family-name:var(--font-mono)] tabular-nums">{total}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Delivery Ledger Table */}
      <div className="overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border-subtle) text-start text-xs text-(--color-text-tertiary)">
                <th className="px-5 py-3 text-start font-medium">{isFa ? "گیرنده و موضوع" : "Recipient & Subject"}</th>
                <th className="px-4 py-3 text-start font-medium">{isFa ? "نوع" : "Type"}</th>
                <th className="px-4 py-3 text-start font-medium">{isFa ? "وضعیت" : "Status"}</th>
                <th className="px-4 py-3 text-end font-medium">{isFa ? "زمان ارسال" : "Timestamp"}</th>
                <th className="px-5 py-3 text-end font-medium">{isFa ? "عملیات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-xs text-(--color-text-tertiary)">
                    {isFa ? "در حال بارگذاری گزارش ارسال‌ها…" : "Loading delivery logs…"}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-xs text-(--color-text-tertiary)">
                    {isFa ? "هیچ رکورد ارسالی با این فیلتر یافت نشد." : "No email logs match the current filters."}
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-(--color-border-subtle) last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3">
                      <p className="max-w-[320px] truncate text-xs font-medium text-(--color-text-primary)">
                        {log.subject}
                      </p>
                      <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary)">
                        {log.recipient_email}
                      </p>
                      {log.error_message && (
                        <p className="mt-0.5 max-w-[340px] truncate text-[11px] text-rose-400">
                          {log.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-(--color-text-secondary) whitespace-nowrap">
                      {kindLabel(log.kind, isFa)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-medium ${statusColorClass(log.status)}`}>
                        {statusLabel(log.status, isFa)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary) whitespace-nowrap">
                      {formatEmailDate(log.created_at, isFa)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectLog(log)}
                          aria-label={`Inspect email to ${log.recipient_email}`}
                          className="flex h-8 items-center gap-1 rounded-lg border border-(--color-border-subtle) px-2.5 text-xs text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>{isFa ? "مشاهده" : "Inspect"}</span>
                        </button>
                        <button
                          type="button"
                          disabled={retryingId === log.id}
                          onClick={() => handleRetry(log)}
                          aria-label={`Retry email to ${log.recipient_email}`}
                          className="flex h-8 items-center gap-1 rounded-lg border border-(--color-border-subtle) px-2.5 text-xs text-(--color-text-secondary) hover:border-(--color-accent-purple) hover:text-(--color-text-primary) disabled:opacity-50 whitespace-nowrap"
                        >
                          {retryingId === log.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="h-3.5 w-3.5" />
                          )}
                          <span>{isFa ? "ارسال مجدد" : "Retry"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Inspection Modal */}
      {inspectLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setInspectLog(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isFa ? "جزئیات ایمیل ارسال‌شده" : "Email log inspector"}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-(--color-border-strong) bg-(--color-bg-secondary)"
          >
            <div className="flex items-center justify-between border-b border-(--color-border-subtle) px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-(--color-text-primary)">
                  {inspectLog.subject}
                </h3>
                <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                  <span className="font-[family-name:var(--font-mono)]">{inspectLog.recipient_email}</span>
                  <span aria-hidden="true"> · </span>
                  <span className={statusColorClass(inspectLog.status)}>
                    {statusLabel(inspectLog.status, isFa)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                aria-label="Close inspector"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 border-b border-(--color-border-subtle) bg-(--color-bg-deep)/60 px-5 py-3 text-xs sm:grid-cols-2">
              <p className="text-(--color-text-tertiary)">
                {isFa ? "فرستنده: " : "From: "}
                <span className="text-(--color-text-secondary)">
                  {inspectLog.from_name} &lt;{inspectLog.from_email}&gt;
                </span>
              </p>
              <p className="text-(--color-text-tertiary)">
                {isFa ? "شناسه پیام: " : "Message ID: "}
                <span className="font-[family-name:var(--font-mono)] text-(--color-text-secondary)">
                  {inspectLog.provider_message_id || "—"}
                </span>
              </p>
              {inspectLog.error_message && (
                <p className="text-rose-400 sm:col-span-2">
                  {isFa ? "خطا: " : "Error: "}
                  {inspectLog.error_message}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto bg-[#090b10] p-4">
              <iframe
                title="Logged email preview"
                sandbox=""
                srcDoc={inspectLog.html_body || "<p>(empty)</p>"}
                className="h-[420px] w-full rounded-lg border border-(--color-border-subtle) bg-[#0b0d14]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
