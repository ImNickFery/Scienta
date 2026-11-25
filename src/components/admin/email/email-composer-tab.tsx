"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Code2,
  FileText,
  Loader2,
  Monitor,
  Newspaper,
  Send,
  Smartphone,
  AlertCircle,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import type { EmailSettingsPublic } from "@/lib/email-core";
import {
  buildPreviewSrcDoc,
  type ComposerDraft,
  type EmailRecentArticle,
  type EmailTemplateRow,
} from "./types";

interface Props {
  isFa: boolean;
  settings: EmailSettingsPublic;
  templates: EmailTemplateRow[];
  recentArticles: EmailRecentArticle[];
  draft: ComposerDraft;
  onDraftChange: (next: ComposerDraft) => void;
  onSentSuccess: () => void;
}

const QUICK_VARIABLES = [
  { token: "{{recipient_email}}", labelEn: "Recipient Email", labelFa: "ایمیل گیرنده" },
  { token: "{{site_name}}", labelEn: "Site Name", labelFa: "نام سایت" },
  { token: "{{site_url}}", labelEn: "Site URL", labelFa: "آدرس سایت" },
  { token: "{{date}}", labelEn: "Today Date", labelFa: "تاریخ امروز" },
];

export function EmailComposerTab({
  isFa,
  settings,
  templates,
  recentArticles,
  draft,
  onDraftChange,
  onSentSuccess,
}: Props) {
  const [editorMode, setEditorMode] = useState<"html" | "text">("html");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [showAdvancedHeaders, setShowAdvancedHeaders] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const previewDoc = useMemo(
    () =>
      buildPreviewSrcDoc({
        htmlBody: draft.htmlBody || (isFa ? "<p>متن ایمیل را اینجا بنویسید…</p>" : "<p>Write your email body here…</p>"),
        direction: draft.direction,
        fromName: settings.fromName,
        signatureHtml: settings.signatureHtml,
      }),
    [draft.htmlBody, draft.direction, settings.fromName, settings.signatureHtml, isFa]
  );

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    onDraftChange({
      ...draft,
      templateId: tpl.id,
      subject: tpl.subject,
      preheader: tpl.preheader ?? "",
      htmlBody: tpl.html_body,
      textBody: tpl.text_body ?? "",
      direction: tpl.locale === "en" ? "ltr" : "rtl",
    });
  }

  function insertSnippet(snippet: string) {
    if (editorMode === "html") {
      onDraftChange({ ...draft, htmlBody: `${draft.htmlBody}${draft.htmlBody ? "\n" : ""}${snippet}` });
    } else {
      onDraftChange({ ...draft, textBody: `${draft.textBody}${draft.textBody ? "\n" : ""}${snippet}` });
    }
  }

  function insertArticleCard(articleId: string) {
    const art = recentArticles.find((a) => a.id === articleId);
    if (!art) return;
    const isRtl = draft.direction === "rtl";
    const title = isRtl ? art.title_fa || art.title_en || "Untitled" : art.title_en || art.title_fa || "Untitled";
    const excerpt = isRtl ? art.excerpt_fa || art.excerpt_en || "" : art.excerpt_en || art.excerpt_fa || "";
    const slug = isRtl ? art.slug_fa || art.slug_en : art.slug_en || art.slug_fa;
    const localePath = isRtl ? "fa" : "en";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://scienta.org";
    const url = slug ? `${origin}/${localePath}/articles/${slug}` : origin;

    const cardHtml = `<div style="padding:18px;background-color:#1a2030;border:1px solid #2b344b;border-radius:10px;margin:16px 0;">
  <h2 style="margin:0 0 8px;font-size:17px;color:#f8fafc;">${title}</h2>
  <p style="margin:0 0 12px;color:#cbd5e1;font-size:14px;">${excerpt}</p>
  <a href="${url}" style="color:#a78bfa;font-size:14px;font-weight:600;text-decoration:none;">${
    isRtl ? "مطالعه کامل مقاله ←" : "Read Full Article →"
  }</a>
</div>`;
    insertSnippet(cardHtml);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (!draft.to.trim()) {
      setError(isFa ? "حداقل یک نشانی ایمیل گیرنده وارد کنید." : "Please enter at least one recipient email.");
      return;
    }
    if (!draft.subject.trim() || !draft.htmlBody.trim()) {
      setError(isFa ? "موضوع و متن ایمیل الزامی است." : "Subject and email body are required.");
      return;
    }

    setSending(true);
    try {
      const res = await adminFetch<{
        ok: boolean;
        summary: {
          total: number;
          sentCount: number;
          failedCount: number;
          suppressedCount: number;
          providerMode: string;
        };
      }>("/api/admin/email/send", {
        method: "POST",
        body: JSON.stringify({
          to: draft.to,
          cc: draft.cc || undefined,
          bcc: draft.bcc || undefined,
          replyTo: draft.replyTo || undefined,
          subject: draft.subject,
          preheader: draft.preheader,
          htmlBody: draft.htmlBody,
          textBody: draft.textBody || undefined,
          direction: draft.direction,
          templateId: draft.templateId,
        }),
      });

      const s = res.summary;
      setSuccessMsg(
        isFa
          ? `ارسال انجام شد (${s.providerMode === "smtp" ? "SMTP واقعی" : "حالت آزمایشی"}) — موفق: ${s.sentCount}، ناموفق: ${s.failedCount}، مسدودشده: ${s.suppressedCount}`
          : `Dispatch finished (${s.providerMode}) — Delivered: ${s.sentCount}, Failed: ${s.failedCount}, Suppressed: ${s.suppressedCount}`
      );
      onSentSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : isFa ? "ارسال ایمیل با خطا مواجه شد." : "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSend} className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left 7 cols: Composer Workspace */}
      <div className="space-y-4 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) pb-4">
          <div>
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "ویرایشگر و ارسال مستقیم ایمیل" : "Direct Email Studio"}
            </h2>
            <p className="text-xs text-(--color-text-tertiary)">
              {isFa
                ? `فرستنده: ${settings.fromName} <${settings.fromEmail}>`
                : `From: ${settings.fromName} <${settings.fromEmail}>`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={isFa ? "بارگذاری از قالب" : "Load template"}
              value={draft.templateId ?? ""}
              onChange={(e) => applyTemplate(e.target.value)}
              className="h-9 max-w-[230px] truncate rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            >
              <option value="">{isFa ? "انتخاب قالب آماده…" : "Load template…"}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>

            <div className="flex items-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5">
              <button
                type="button"
                onClick={() => onDraftChange({ ...draft, direction: "rtl" })}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  draft.direction === "rtl"
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                RTL
              </button>
              <button
                type="button"
                onClick={() => onDraftChange({ ...draft, direction: "ltr" })}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  draft.direction === "ltr"
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                LTR
              </button>
            </div>
          </div>
        </div>

        {/* Recipients */}
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="compose-to" className="text-xs font-medium text-(--color-text-secondary)">
                {isFa ? "گیرندگان (با ویرگول یا خط جدید جدا کنید، حداکثر ۵۰ نفر)" : "Recipients (comma or newline separated, up to 50)"}
              </label>
              <button
                type="button"
                onClick={() => setShowAdvancedHeaders((v) => !v)}
                className="text-xs text-(--color-accent-purple) hover:underline whitespace-nowrap"
              >
                {showAdvancedHeaders
                  ? isFa
                    ? "بستن CC / BCC / Reply-To"
                    : "Hide CC / BCC / Reply-To"
                  : isFa
                    ? "+ CC / BCC / Reply-To"
                    : "+ CC / BCC / Reply-To"}
              </button>
            </div>
            <input
              id="compose-to"
              value={draft.to}
              onChange={(e) => onDraftChange({ ...draft, to: e.target.value })}
              placeholder="researcher@university.edu, editor@scienta.org"
              dir="ltr"
              className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            />
          </div>

          {showAdvancedHeaders && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="compose-cc" className="mb-1 block text-xs text-(--color-text-tertiary)">
                  CC
                </label>
                <input
                  id="compose-cc"
                  value={draft.cc}
                  onChange={(e) => onDraftChange({ ...draft, cc: e.target.value })}
                  placeholder="cc@example.org"
                  dir="ltr"
                  className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
              <div>
                <label htmlFor="compose-bcc" className="mb-1 block text-xs text-(--color-text-tertiary)">
                  BCC
                </label>
                <input
                  id="compose-bcc"
                  value={draft.bcc}
                  onChange={(e) => onDraftChange({ ...draft, bcc: e.target.value })}
                  placeholder="bcc@example.org"
                  dir="ltr"
                  className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
              <div>
                <label htmlFor="compose-replyto" className="mb-1 block text-xs text-(--color-text-tertiary)">
                  Reply-To
                </label>
                <input
                  id="compose-replyto"
                  value={draft.replyTo}
                  onChange={(e) => onDraftChange({ ...draft, replyTo: e.target.value })}
                  placeholder={settings.replyTo || settings.fromEmail}
                  dir="ltr"
                  className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="compose-subject" className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
                {isFa ? "موضوع ایمیل (Subject)" : "Subject Line"}
              </label>
              <input
                id="compose-subject"
                value={draft.subject}
                onChange={(e) => onDraftChange({ ...draft, subject: e.target.value })}
                placeholder={isFa ? "عنوان حرفه‌ای ایمیل…" : "Concise, clear email subject…"}
                className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
              />
            </div>
            <div>
              <label htmlFor="compose-preheader" className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
                {isFa ? "متن پیش‌نمایش صندوق (Preheader)" : "Inbox Preheader Text"}
              </label>
              <input
                id="compose-preheader"
                value={draft.preheader}
                onChange={(e) => onDraftChange({ ...draft, preheader: e.target.value })}
                placeholder={isFa ? "خلاصه یک‌خطی زیر عنوان در اینباکس…" : "One-line preview snippet in inbox…"}
                className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3.5 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
              />
            </div>
          </div>
        </div>

        {/* Formatting & Insert Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-(--color-border-subtle) py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditorMode("html")}
              className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                editorMode === "html"
                  ? "bg-white/10 text-(--color-text-primary)"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              HTML
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("text")}
              className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                editorMode === "text"
                  ? "bg-white/10 text-(--color-text-primary)"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              {isFa ? "متن ساده" : "Plain Text"}
            </button>

            <span className="mx-1 h-4 w-px bg-(--color-border-subtle)" aria-hidden="true" />

            <button
              type="button"
              onClick={() =>
                insertSnippet(
                  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;"><tr><td style="background-color:#7c3aed;border-radius:8px;padding:11px 22px;"><a href="{{site_url}}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">${
                    draft.direction === "rtl" ? "مشاهده در ساینتا" : "Explore on Scienta"
                  }</a></td></tr></table>`
                )
              }
              className="h-8 rounded-md border border-(--color-border-subtle) px-2.5 text-xs text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap"
            >
              {isFa ? "+ دکمه CTA" : "+ CTA Button"}
            </button>

            <button
              type="button"
              onClick={() =>
                insertSnippet(
                  `<div style="padding:14px 16px;background-color:#1a2030;border:1px solid #2b344b;border-radius:8px;margin:14px 0;color:#cbd5e1;font-size:14px;">${
                    draft.direction === "rtl" ? "نکته برجسته تحریریه…" : "Editorial highlight box…"
                  }</div>`
                )
              }
              className="h-8 rounded-md border border-(--color-border-subtle) px-2.5 text-xs text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap"
            >
              {isFa ? "+ کادر نکته" : "+ Callout"}
            </button>
          </div>

          {recentArticles.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Newspaper className="h-3.5 w-3.5 text-(--color-text-tertiary)" />
              <select
                aria-label={isFa ? "درج کارت مقاله از سایت" : "Insert published article card"}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    insertArticleCard(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="h-8 max-w-[200px] rounded-md border border-(--color-border-subtle) bg-(--color-bg-deep) px-2 text-xs text-(--color-text-secondary) outline-none focus:border-(--color-accent-purple)"
              >
                <option value="">{isFa ? "درج کارت مقاله…" : "Insert article card…"}</option>
                {recentArticles.map((art) => (
                  <option key={art.id} value={art.id}>
                    {isFa ? art.title_fa || art.title_en : art.title_en || art.title_fa}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Variable Tokens */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-(--color-text-tertiary)">{isFa ? "متغیرهای پویا:" : "Variables:"}</span>
          {QUICK_VARIABLES.map((v) => (
            <button
              key={v.token}
              type="button"
              onClick={() => insertSnippet(v.token)}
              title={isFa ? v.labelFa : v.labelEn}
              className="rounded-md border border-(--color-border-subtle) bg-(--color-bg-deep) px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary) hover:border-(--color-accent-purple) hover:text-(--color-text-primary)"
            >
              {v.token}
            </button>
          ))}
        </div>

        {/* Body Textarea */}
        {editorMode === "html" ? (
          <div>
            <label htmlFor="compose-html-body" className="sr-only">
              {isFa ? "محتوای HTML ایمیل" : "Email HTML body"}
            </label>
            <textarea
              id="compose-html-body"
              rows={12}
              value={draft.htmlBody}
              onChange={(e) => onDraftChange({ ...draft, htmlBody: e.target.value })}
              dir="ltr"
              placeholder={
                isFa
                  ? "<h2 style=\"margin:0 0 12px;color:#f8fafc;\">سلام!</h2>\n<p>متن ایمیل خود را اینجا بنویسید…</p>"
                  : "<h2 style=\"margin:0 0 12px;color:#f8fafc;\">Hello!</h2>\n<p>Write your email content here…</p>"
              }
              className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-3.5 font-[family-name:var(--font-mono)] text-xs leading-relaxed text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="compose-text-body" className="sr-only">
              {isFa ? "نسخه متن ساده ایمیل" : "Plain text fallback"}
            </label>
            <textarea
              id="compose-text-body"
              rows={12}
              value={draft.textBody}
              onChange={(e) => onDraftChange({ ...draft, textBody: e.target.value })}
              dir={draft.direction}
              placeholder={
                isFa
                  ? "اگر خالی بماند به‌صورت خودکار از نسخه HTML تولید می‌شود."
                  : "Optional — automatically generated from HTML when left empty."
              }
              className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-3.5 text-sm leading-relaxed text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-xs text-(--color-text-tertiary)">
            {settings.mode === "smtp"
              ? isFa
                ? "ارسال از طریق سرور SMTP تنظیم‌شده"
                : "Will send via configured SMTP server"
              : isFa
                ? "ارسال در حالت آزمایشی Sandbox (ثبت کامل در گزارش‌ها)"
                : "Will send in Sandbox mode (logged with full preview)"}
          </span>

          <button
            type="submit"
            disabled={sending}
            className="flex h-10 items-center gap-2 rounded-lg bg-(--color-accent-purple) px-5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>{sending ? (isFa ? "در حال ارسال…" : "Sending…") : isFa ? "ارسال ایمیل" : "Send Email"}</span>
          </button>
        </div>
      </div>

      {/* Right 5 cols: Live Sandboxed Preview */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) lg:col-span-5">
        <div className="flex items-center justify-between gap-2 border-b border-(--color-border-subtle) px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-(--color-text-primary)">
              {isFa ? "پیش‌نمایش زنده ایمیل" : "Live Email Preview"}
            </p>
            <p className="truncate text-[11px] text-(--color-text-tertiary)">
              {draft.subject || (isFa ? "(بدون موضوع)" : "(No subject)")}
            </p>
          </div>
          <div className="flex items-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              aria-label={isFa ? "پیش‌نمایش دسکتاپ" : "Desktop preview"}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                previewDevice === "desktop"
                  ? "bg-white/10 text-(--color-text-primary)"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              aria-label={isFa ? "پیش‌نمایش موبایل" : "Mobile preview"}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                previewDevice === "mobile"
                  ? "bg-white/10 text-(--color-text-primary)"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 justify-center bg-[#090b10] p-4">
          <iframe
            title={isFa ? "پیش‌نمایش ایمیل" : "Email live preview"}
            sandbox=""
            srcDoc={previewDoc}
            className={`min-h-[480px] rounded-lg border border-(--color-border-subtle) bg-[#0b0d14] transition-[width] duration-200 ${
              previewDevice === "mobile" ? "w-[360px]" : "w-full"
            }`}
          />
        </div>
      </div>
    </form>
  );
}
