"use client";

import { useState } from "react";
import {
  MessageSquare,
  HelpCircle,
  Send,
  Sigma,
  Eye,
  Edit3,
  CheckCircle2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { MathRichText } from "./math-rich-text";
import { cn, formatCount, formatDate } from "@/lib/utils";
import { useNumerals } from "@/components/i18n/numerals-provider";
import type { PublicComment } from "@/types";
import type { Locale } from "@/lib/i18n/config";

const COPY = {
  fa: {
    heading: "گفتگو و پرسش علمی",
    subtitle: "دیدگاه، نقد علمی یا پرسش خود را درباره این مقاله مطرح کنید. پشتیبانی کامل از فرمول‌های ریاضی با KaTeX فعال است.",
    empty: "هنوز دیدگاه تأییدشده‌ای برای این مقاله ثبت نشده است. نخستین نفر باشید که پرسش یا نظر علمی خود را می‌نویسد.",
    questionBadge: "پرسش علمی",
    editorialReply: "پاسخ هیئت تحریریه",
    formTitle: "ثبت دیدگاه یا پرسش جدید",
    nameLabel: "نام و نام خانوادگی",
    namePlaceholder: "مثلاً: دکتر سارا احمدی",
    emailLabel: "ایمیل (محرمانه می‌ماند و منتشر نمی‌شود)",
    emailPlaceholder: "you@university.edu",
    bodyLabel: "متن دیدگاه یا پرسش",
    bodyPlaceholder: "پرسش یا تحلیل خود را بنویسید… برای فرمول درون‌خطی از $E = mc^2$ و برای فرمول بلوکی از $$r_s = \\frac{2GM}{c^2}$$ استفاده کنید.",
    writeTab: "نوشتن",
    previewTab: "پیش‌نمایش KaTeX",
    insertMath: "درج فرمول نمونه",
    previewEmpty: "برای دیدن پیش‌نمایش زنده فرمول‌ها، متنی وارد کنید.",
    isQuestionLabel: "این پیام یک پرسش علمی است",
    submit: "ارسال دیدگاه",
    submitting: "در حال ارسال…",
    successTitle: "دیدگاه شما با موفقیت ثبت شد",
    successBody: "پس از بررسی و تأیید توسط هیئت تحریریه، در همین صفحه نمایش داده خواهد شد.",
    genericError: "ارسال دیدگاه ناموفق بود. لطفاً فیلدها را بررسی کنید و دوباره تلاش کنید.",
    mathHint: "فرمول درون‌خطی: $...$  |  فرمول بلوکی: $$...$$",
  },
  en: {
    heading: "Scientific Discussion & Q&A",
    subtitle: "Share an insight, peer critique, or question about this article. Full KaTeX mathematical notation is supported.",
    empty: "No approved comments yet. Be the first to start a scientific discussion on this article.",
    questionBadge: "Scientific Question",
    editorialReply: "Editorial Reply",
    formTitle: "Post a Comment or Question",
    nameLabel: "Your Name",
    namePlaceholder: "e.g. Dr. Sara Ahmadi",
    emailLabel: "Email (kept private, never published)",
    emailPlaceholder: "you@university.edu",
    bodyLabel: "Comment or Question",
    bodyPlaceholder: "Write your note or question… Use $E = mc^2$ for inline math or $$r_s = \\frac{2GM}{c^2}$$ for display equations.",
    writeTab: "Write",
    previewTab: "KaTeX Preview",
    insertMath: "Insert sample formula",
    previewEmpty: "Start typing to preview rendered KaTeX formulas.",
    isQuestionLabel: "Mark this post as a scientific question",
    submit: "Submit Comment",
    submitting: "Submitting…",
    successTitle: "Comment submitted for review",
    successBody: "Your contribution has been queued and will appear here once approved by our editorial team.",
    genericError: "Could not submit your comment. Please review the form and try again.",
    mathHint: "Inline math: $...$  |  Display math: $$...$$",
  },
} as const;

export function ArticleComments({
  articleId,
  locale,
  initialComments,
}: {
  articleId: string;
  locale: Locale;
  initialComments: PublicComment[];
}) {
  const t = COPY[locale];
  const dir = locale === "fa" ? "rtl" : "ltr";
  const { numerals } = useNumerals();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [isQuestion, setIsQuestion] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [previewMode, setPreviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleInsertSampleMath() {
    const snippet = locale === "fa" ? " $E = mc^2$ " : " $E = mc^2$ ";
    setContent((prev) => `${prev}${prev.endsWith(" ") || !prev ? "" : " "}${snippet.trim()} `);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitted(false);
    setSubmitting(true);

    try {
      const res = await fetch("/api/public/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          locale,
          name,
          email,
          content,
          isQuestion,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t.genericError);
        return;
      }
      setSubmitted(true);
      setName("");
      setEmail("");
      setContent("");
      setIsQuestion(false);
      setPreviewMode(false);
    } catch {
      setError(t.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="discussion"
      aria-labelledby="discussion-heading"
      className="min-w-0 w-full scroll-mt-28 space-y-8 border-t border-(--color-border-subtle) pt-12 print:hidden"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--color-accent-purple)/15 text-(--color-accent-purple)">
              <MessageSquare className="h-4 w-4" />
            </span>
            <h2
              id="discussion-heading"
              className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)"
            >
              {t.heading}
            </h2>
            <span className="rounded-full border border-(--color-border-subtle) bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium text-(--color-text-secondary)">
              {formatCount(initialComments.length, locale, numerals)}
            </span>
          </div>
          <p className="mt-2 text-sm text-(--color-text-tertiary)">{t.subtitle}</p>
        </div>
      </div>

      {/* Approved comments list */}
      {initialComments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-(--color-border-subtle) bg-white/[0.015] px-6 py-10 text-center text-sm text-(--color-text-tertiary)">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-4">
          {initialComments.map((comment) => (
            <article
              key={comment.id}
              className="card-elevated min-w-0 rounded-2xl p-5 sm:p-6"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-(--color-accent-purple)/30 to-(--color-accent-orange)/30 text-sm font-bold text-(--color-text-primary)">
                    {comment.name.trim()[0] ?? "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-(--color-text-primary)">
                      {comment.name}
                    </p>
                    <p className="text-xs text-(--color-text-tertiary)">
                      {formatDate(comment.createdAt, locale, numerals)}
                    </p>
                  </div>
                </div>
                {comment.isQuestion && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-(--color-accent-orange)/40 bg-(--color-accent-orange)/10 px-2.5 py-1 text-[11px] font-medium text-(--color-accent-orange)">
                    <HelpCircle className="h-3 w-3" />
                    {t.questionBadge}
                  </span>
                )}
              </div>

              <MathRichText text={comment.content} dir={dir} />

              {comment.adminReply && (
                <div className="mt-4 rounded-xl border border-(--color-accent-purple)/30 bg-(--color-accent-purple)/[0.07] p-4">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-(--color-accent-purple)">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t.editorialReply}
                    </span>
                    {comment.repliedAt && (
                      <span className="text-(--color-text-tertiary)">
                        {formatDate(comment.repliedAt, locale, numerals)}
                      </span>
                    )}
                  </div>
                  <MathRichText text={comment.adminReply} dir={dir} className="text-(--color-text-primary)/90" />
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Submission form */}
      <form
        onSubmit={handleSubmit}
        className="card-elevated min-w-0 space-y-5 rounded-2xl p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-(--color-text-primary)">{t.formTitle}</h3>
          <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-(--color-text-tertiary)">
            <Sigma className="h-3.5 w-3.5 text-(--color-accent-purple)" />
            <span>
              {locale === "fa" ? "فرمول درون‌خطی:" : "Inline:"}{" "}
              <code dir="ltr" className="rounded bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)">
                $...$
              </code>
              {" · "}
              {locale === "fa" ? "بلوکی:" : "Display:"}{" "}
              <code dir="ltr" className="rounded bg-white/[0.06] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)">
                $$...$$
              </code>
            </span>
          </span>
        </div>

        {/* Honeypot anti-spam field */}
        <div className="sr-only" aria-hidden="true">
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="comment-name" className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
              {t.nameLabel}
            </label>
            <input
              id="comment-name"
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              className="h-10 w-full rounded-xl border border-(--color-border-subtle) bg-black/25 px-3.5 text-sm text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple)"
            />
          </div>
          <div>
            <label htmlFor="comment-email" className="mb-1.5 block text-xs font-medium text-(--color-text-secondary)">
              {t.emailLabel}
            </label>
            <input
              id="comment-email"
              type="email"
              required
              dir="ltr"
              maxLength={190}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className="h-10 w-full rounded-xl border border-(--color-border-subtle) bg-black/25 px-3.5 text-sm text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple)"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="comment-body" className="text-xs font-medium text-(--color-text-secondary)">
              {t.bodyLabel}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleInsertSampleMath}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-(--color-border-subtle) px-2.5 text-[11px] text-(--color-text-secondary) transition-colors hover:border-(--color-accent-purple)/50 hover:text-(--color-text-primary)"
              >
                <Sigma className="h-3 w-3 text-(--color-accent-purple)" />
                {t.insertMath}
              </button>
              <div className="inline-flex rounded-full border border-(--color-border-subtle) bg-black/20 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors",
                    !previewMode
                      ? "bg-(--color-accent-purple) text-white"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  )}
                >
                  <Edit3 className="h-3 w-3" />
                  {t.writeTab}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(true)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors",
                    previewMode
                      ? "bg-(--color-accent-purple) text-white"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  )}
                >
                  <Eye className="h-3 w-3" />
                  {t.previewTab}
                </button>
              </div>
            </div>
          </div>

          {previewMode ? (
            <div className="min-h-[120px] w-full rounded-xl border border-(--color-border-subtle) bg-black/25 p-4">
              {content.trim() ? (
                <MathRichText text={content} dir={dir} />
              ) : (
                <p className="text-xs text-(--color-text-tertiary)">{t.previewEmpty}</p>
              )}
            </div>
          ) : (
            <textarea
              id="comment-body"
              required
              minLength={5}
              maxLength={2500}
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t.bodyPlaceholder}
              className="w-full resize-y rounded-xl border border-(--color-border-subtle) bg-black/25 p-3.5 text-sm leading-relaxed text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple)"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-(--color-text-secondary)">
            <input
              type="checkbox"
              checked={isQuestion}
              onChange={(e) => setIsQuestion(e.target.checked)}
              className="h-4 w-4 rounded border-(--color-border-strong) accent-(--color-accent-purple)"
            />
            {t.isQuestionLabel}
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-5 text-xs font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {submitting ? t.submitting : t.submit}
          </button>
        </div>

        {error && (
          <p className="rounded-xl border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-4 py-2.5 text-xs text-(--color-accent-red)">
            {error}
          </p>
        )}

        {submitted && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">{t.successTitle}</p>
              <p className="mt-0.5 text-emerald-200/80">{t.successBody}</p>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
