"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Megaphone,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import type { EmailAudienceSegment, EmailSettingsPublic } from "@/lib/email-core";
import {
  buildPreviewSrcDoc,
  formatEmailDate,
  statusColorClass,
  statusLabel,
  type EmailCampaignRow,
  type EmailOverviewStats,
  type EmailTemplateRow,
} from "./types";

interface Props {
  isFa: boolean;
  stats: EmailOverviewStats;
  settings: EmailSettingsPublic;
  campaigns: EmailCampaignRow[];
  templates: EmailTemplateRow[];
  onRefresh: () => Promise<void>;
}

export function EmailCampaignsTab({
  isFa,
  stats,
  settings,
  campaigns,
  templates,
  onRefresh,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [segment, setSegment] = useState<EmailAudienceSegment>("all");
  const [customRecipients, setCustomRecipients] = useState("");
  const [direction, setDirection] = useState<"rtl" | "ltr">(isFa ? "rtl" : "ltr");
  const [templateId, setTemplateId] = useState<string>("");
  const [htmlBody, setHtmlBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirmSendId, setConfirmSendId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const previewDoc = useMemo(
    () =>
      buildPreviewSrcDoc({
        htmlBody: htmlBody || (isFa ? "<p>محتوای کمپین خبرنامه…</p>" : "<p>Newsletter campaign content…</p>"),
        direction,
        fromName: settings.fromName,
        signatureHtml: settings.signatureHtml,
      }),
    [htmlBody, direction, settings.fromName, settings.signatureHtml, isFa]
  );

  function loadTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setSubject(tpl.subject);
    setPreheader(tpl.preheader ?? "");
    setHtmlBody(tpl.html_body);
    setDirection(tpl.locale === "en" ? "ltr" : "rtl");
  }

  function segmentCount(seg: EmailAudienceSegment): number {
    if (seg === "all") return stats.activeSubscribersAll;
    if (seg === "fa") return stats.activeSubscribersFa;
    if (seg === "en") return stats.activeSubscribersEn;
    return customRecipients
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean).length;
  }

  function segmentLabel(seg: string): string {
    const labels: Record<string, { fa: string; en: string }> = {
      all: { fa: "همه مشترکین فعال", en: "All active subscribers" },
      fa: { fa: "مشترکین فارسی", en: "Persian (FA) subscribers" },
      en: { fa: "مشترکین انگلیسی", en: "English (EN) subscribers" },
      custom: { fa: "لیست سفارشی", en: "Custom recipient list" },
    };
    const item = labels[seg];
    return item ? (isFa ? item.fa : item.en) : seg;
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!name.trim() || !subject.trim() || !htmlBody.trim()) {
      setError(isFa ? "نام کمپین، موضوع و محتوای HTML الزامی است." : "Campaign name, subject, and HTML body are required.");
      return;
    }

    setSubmitting(true);
    try {
      await adminFetch("/api/admin/email/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          subject: subject.trim(),
          preheader: preheader.trim(),
          templateId: templateId || null,
          audienceSegment: segment,
          customRecipients: segment === "custom" ? customRecipients : "",
          htmlBody,
          direction,
        }),
      });
      setCreating(false);
      setName("");
      setSubject("");
      setPreheader("");
      setHtmlBody("");
      setTemplateId("");
      setCustomRecipients("");
      setNotice(isFa ? "پیش‌نویس کمپین ساخته شد و آماده ارسال است." : "Campaign draft created and ready to dispatch.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDispatch(id: string) {
    setError(null);
    setNotice(null);
    setSendingId(id);
    try {
      const res = await adminFetch<{
        totalRecipients: number;
        sentCount: number;
        failedCount: number;
        suppressedCount: number;
        providerMode: string;
      }>(`/api/admin/email/campaigns/${id}/send`, { method: "POST" });
      setConfirmSendId(null);
      setNotice(
        isFa
          ? `کمپین ارسال شد (${res.providerMode === "smtp" ? "SMTP واقعی" : "آزمایشی"}) — موفق: ${res.sentCount} از ${res.totalRecipients}، مسدودشده: ${res.suppressedCount}، ناموفق: ${res.failedCount}`
          : `Campaign dispatched (${res.providerMode}) — Delivered: ${res.sentCount}/${res.totalRecipients}, Suppressed: ${res.suppressedCount}, Failed: ${res.failedCount}`
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send campaign");
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await adminFetch(`/api/admin/email/campaigns/${id}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete campaign");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-(--color-text-primary)">
            {isFa ? "کمپین‌ها و ارسال گروهی خبرنامه" : "Newsletter Campaigns & Broadcasts"}
          </h2>
          <p className="text-xs text-(--color-text-tertiary) tabular-nums">
            {isFa
              ? `مخاطبین فعال: ${stats.activeSubscribersAll} نفر (فارسی: ${stats.activeSubscribersFa} · انگلیسی: ${stats.activeSubscribersEn})`
              : `Active audience: ${stats.activeSubscribersAll} subscribers (FA: ${stats.activeSubscribersFa} · EN: ${stats.activeSubscribersEn})`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreating((v) => !v);
            setError(null);
          }}
          className="flex h-9 items-center gap-2 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
        >
          {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{creating ? (isFa ? "بستن فرم" : "Cancel") : isFa ? "کمپین جدید" : "New Campaign"}</span>
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

      {/* Create Campaign Form */}
      {creating && (
        <form
          onSubmit={handleCreateCampaign}
          className="grid grid-cols-1 gap-6 rounded-xl border border-(--color-border-strong) bg-(--color-bg-secondary) p-5 lg:grid-cols-12"
        >
          <div className="space-y-4 lg:col-span-7">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="camp-name" className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
                  {isFa ? "نام داخلی کمپین" : "Campaign Name"}
                </label>
                <input
                  id="camp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isFa ? "خبرنامه آذر ۱۴۰۵" : "November Science Digest"}
                  className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>

              <div>
                <label htmlFor="camp-template" className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
                  {isFa ? "شروع از قالب آماده" : "Start from Template"}
                </label>
                <select
                  id="camp-template"
                  value={templateId}
                  onChange={(e) => loadTemplate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                >
                  <option value="">{isFa ? "بدون قالب (سفارشی)" : "Blank / custom"}</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
                {isFa ? "گروه مخاطبان هدف" : "Target Audience Segment"}
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["all", "fa", "en", "custom"] as const).map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => setSegment(seg)}
                    className={`rounded-lg border px-3 py-2 text-start text-xs transition-colors ${
                      segment === seg
                        ? "border-(--color-accent-purple) bg-(--color-accent-purple)/15 text-(--color-text-primary)"
                        : "border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) hover:border-(--color-border-strong)"
                    }`}
                  >
                    <span className="block font-medium">{segmentLabel(seg)}</span>
                    <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                      {segmentCount(seg)} {isFa ? "نفر" : "recipients"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {segment === "custom" && (
              <div>
                <label htmlFor="camp-custom" className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
                  {isFa ? "نشانی‌های سفارشی (با ویرگول یا خط جدید)" : "Custom Email List (comma or newline separated)"}
                </label>
                <textarea
                  id="camp-custom"
                  rows={3}
                  value={customRecipients}
                  onChange={(e) => setCustomRecipients(e.target.value)}
                  dir="ltr"
                  placeholder="reader1@example.org, reader2@example.org"
                  className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="camp-subject" className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
                  {isFa ? "موضوع ایمیل" : "Subject Line"}
                </label>
                <input
                  id="camp-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={isFa ? "گزیده علمی هفته در ساینتا" : "Weekly Science Digest"}
                  className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
              <div>
                <label htmlFor="camp-preheader" className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
                  {isFa ? "متن پیش‌نمایش (Preheader)" : "Preheader"}
                </label>
                <input
                  id="camp-preheader"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="camp-html" className="text-xs font-medium text-(--color-text-secondary)">
                  {isFa ? "محتوای HTML کمپین" : "Campaign HTML Content"}
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDirection("rtl")}
                    className={`rounded px-2 py-0.5 text-[11px] ${
                      direction === "rtl"
                        ? "bg-(--color-accent-purple) text-white"
                        : "text-(--color-text-tertiary)"
                    }`}
                  >
                    RTL
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("ltr")}
                    className={`rounded px-2 py-0.5 text-[11px] ${
                      direction === "ltr"
                        ? "bg-(--color-accent-purple) text-white"
                        : "text-(--color-text-tertiary)"
                    }`}
                  >
                    LTR
                  </button>
                </div>
              </div>
              <textarea
                id="camp-html"
                rows={9}
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                dir="ltr"
                className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-3.5 font-[family-name:var(--font-mono)] text-xs leading-relaxed text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="h-9 rounded-lg border border-(--color-border-subtle) px-4 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
              >
                {isFa ? "انصراف" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex h-9 items-center gap-2 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isFa ? "ذخیره پیش‌نویس کمپین" : "Save Campaign Draft"}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-lg border border-(--color-border-subtle) bg-[#090b10] lg:col-span-5">
            <div className="border-b border-(--color-border-subtle) px-3.5 py-2.5 text-xs font-medium text-(--color-text-secondary)">
              {isFa ? "پیش‌نمایش کمپین" : "Campaign Preview"}
            </div>
            <iframe
              title={isFa ? "پیش‌نمایش کمپین" : "Campaign preview"}
              sandbox=""
              srcDoc={previewDoc}
              className="min-h-[380px] w-full flex-1 bg-[#0b0d14]"
            />
          </div>
        </form>
      )}

      {/* Campaigns Ledger */}
      <div className="overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border-subtle) text-start text-xs text-(--color-text-tertiary)">
                <th className="px-5 py-3 text-start font-medium">{isFa ? "کمپین و موضوع" : "Campaign & Subject"}</th>
                <th className="px-4 py-3 text-start font-medium">{isFa ? "مخاطبان" : "Audience"}</th>
                <th className="px-4 py-3 text-start font-medium">{isFa ? "وضعیت" : "Status"}</th>
                <th className="px-4 py-3 text-end font-medium">{isFa ? "آمار تحویل" : "Delivery"}</th>
                <th className="px-5 py-3 text-end font-medium">{isFa ? "عملیات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <Megaphone className="mx-auto h-6 w-6 text-(--color-text-tertiary)/60" />
                    <p className="mt-2 text-sm font-medium text-(--color-text-secondary)">
                      {isFa ? "هنوز کمپینی ایجاد نشده است." : "No campaigns created yet."}
                    </p>
                    <p className="mt-1 text-xs text-(--color-text-tertiary)">
                      {isFa
                        ? "اولین خبرنامه یا اطلاعیه گروهی را برای مشترکین ساینتا بسازید."
                        : "Build your first newsletter broadcast targeting Scienta subscribers."}
                    </p>
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => (
                  <tr
                    key={camp.id}
                    className="border-b border-(--color-border-subtle) last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-(--color-text-primary)">{camp.name}</p>
                      <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                        {camp.subject}
                        <span aria-hidden="true"> · </span>
                        <span className="font-[family-name:var(--font-mono)] tabular-nums">
                          {formatEmailDate(camp.sent_at || camp.created_at, isFa)}
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-(--color-text-secondary) whitespace-nowrap">
                      {segmentLabel(camp.audience_segment)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`text-xs font-medium ${statusColorClass(camp.status)}`}>
                        {statusLabel(camp.status, isFa)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-end font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-secondary) whitespace-nowrap">
                      {camp.sent_count}/{camp.total_recipients}
                      {camp.suppressed_count > 0 ? ` · -${camp.suppressed_count}` : ""}
                      {camp.failed_count > 0 ? ` · !${camp.failed_count}` : ""}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {confirmSendId === camp.id ? (
                          <button
                            type="button"
                            disabled={sendingId === camp.id}
                            onClick={() => handleDispatch(camp.id)}
                            className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 whitespace-nowrap"
                          >
                            {sendingId === camp.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            <span>{isFa ? "تأیید ارسال" : "Confirm Send"}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={sendingId === camp.id}
                            onClick={() => setConfirmSendId(camp.id)}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-(--color-border-strong) px-3 text-xs font-medium text-(--color-text-primary) hover:border-(--color-accent-purple) hover:bg-(--color-accent-purple)/10 whitespace-nowrap"
                          >
                            <Send className="h-3.5 w-3.5 text-(--color-accent-purple)" />
                            <span>
                              {camp.status === "draft"
                                ? isFa
                                  ? "ارسال کمپین"
                                  : "Dispatch"
                                : isFa
                                  ? "ارسال مجدد"
                                  : "Resend"}
                            </span>
                          </button>
                        )}

                        {confirmDeleteId === camp.id ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(camp.id)}
                            className="h-8 rounded-lg bg-rose-600 px-3 text-xs font-medium text-white"
                          >
                            {isFa ? "حذف قطعی" : "Confirm"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(camp.id)}
                            aria-label={`Delete campaign ${camp.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-tertiary) hover:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
