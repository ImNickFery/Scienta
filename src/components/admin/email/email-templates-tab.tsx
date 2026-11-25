"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import type { EmailLocaleMode, EmailSettingsPublic, EmailTemplateCategory } from "@/lib/email-core";
import { buildPreviewSrcDoc, type EmailTemplateRow } from "./types";

interface Props {
  isFa: boolean;
  settings: EmailSettingsPublic;
  templates: EmailTemplateRow[];
  onRefresh: () => Promise<void>;
  onUseInComposer: (tpl: EmailTemplateRow) => void;
}

export function EmailTemplatesTab({
  isFa,
  settings,
  templates,
  onRefresh,
  onUseInComposer,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | "new">(templates[0]?.id ?? "new");
  const selected = useMemo(
    () => (selectedId === "new" ? null : templates.find((t) => t.id === selectedId) ?? null),
    [selectedId, templates]
  );

  const [name, setName] = useState(selected?.name ?? "");
  const [category, setCategory] = useState<EmailTemplateCategory>(selected?.category ?? "newsletter");
  const [locale, setLocale] = useState<EmailLocaleMode>(selected?.locale ?? "fa");
  const [subject, setSubject] = useState(selected?.subject ?? "");
  const [preheader, setPreheader] = useState(selected?.preheader ?? "");
  const [htmlBody, setHtmlBody] = useState(selected?.html_body ?? "");
  const [textBody, setTextBody] = useState(selected?.text_body ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function selectTemplate(tpl: EmailTemplateRow) {
    setSelectedId(tpl.id);
    setName(tpl.name);
    setCategory(tpl.category);
    setLocale(tpl.locale);
    setSubject(tpl.subject);
    setPreheader(tpl.preheader ?? "");
    setHtmlBody(tpl.html_body);
    setTextBody(tpl.text_body ?? "");
    setError(null);
    setNotice(null);
  }

  function startNewTemplate() {
    setSelectedId("new");
    setName("");
    setCategory("newsletter");
    setLocale(isFa ? "fa" : "en");
    setSubject("");
    setPreheader("");
    setHtmlBody(
      isFa
        ? `<h2 style="margin:0 0 12px;font-size:20px;color:#f8fafc;">عنوان قالب جدید</h2>\n<p style="margin:0;color:#cbd5e1;">متن ایمیل را اینجا بنویسید…</p>`
        : `<h2 style="margin:0 0 12px;font-size:20px;color:#f8fafc;">New Template Heading</h2>\n<p style="margin:0;color:#cbd5e1;">Write your reusable template body here…</p>`
    );
    setTextBody("");
    setError(null);
    setNotice(null);
  }

  const previewDoc = useMemo(
    () =>
      buildPreviewSrcDoc({
        htmlBody: htmlBody || "<p></p>",
        direction: locale === "en" ? "ltr" : "rtl",
        fromName: settings.fromName,
        signatureHtml: settings.signatureHtml,
      }),
    [htmlBody, locale, settings.fromName, settings.signatureHtml]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!name.trim() || !subject.trim() || !htmlBody.trim()) {
      setError(isFa ? "نام قالب، موضوع و محتوای HTML الزامی است." : "Name, subject, and HTML body are required.");
      return;
    }

    setSaving(true);
    try {
      if (selectedId === "new") {
        const created = await adminFetch<{ id: string }>("/api/admin/email/templates", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            category,
            locale,
            subject: subject.trim(),
            preheader: preheader.trim(),
            htmlBody,
            textBody,
          }),
        });
        await onRefresh();
        setSelectedId(created.id);
        setNotice(isFa ? "قالب جدید با موفقیت ذخیره شد." : "New template created.");
      } else {
        await adminFetch(`/api/admin/email/templates/${selectedId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            category,
            locale,
            subject: subject.trim(),
            preheader: preheader.trim(),
            htmlBody,
            textBody,
          }),
        });
        await onRefresh();
        setNotice(isFa ? "تغییرات قالب ذخیره شد." : "Template updated.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected || selected.is_system) return;
    setDeleting(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/email/templates/${selected.id}`, { method: "DELETE" });
      await onRefresh();
      const fallback = templates.find((t) => t.id !== selected.id);
      if (fallback) selectTemplate(fallback);
      else startNewTemplate();
      setNotice(isFa ? "قالب حذف شد." : "Template deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left 4 cols: Template Library List */}
      <aside className="flex flex-col overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) lg:col-span-4">
        <div className="flex items-center justify-between border-b border-(--color-border-subtle) px-4 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "کتابخانه قالب‌ها" : "Template Library"}
            </h2>
            <p className="text-xs text-(--color-text-tertiary) tabular-nums">
              {templates.length} {isFa ? "قالب" : "templates"}
            </p>
          </div>
          <button
            type="button"
            onClick={startNewTemplate}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-(--color-accent-purple) px-3 text-xs font-medium text-white hover:opacity-90 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isFa ? "قالب جدید" : "New"}</span>
          </button>
        </div>

        <div className="divide-y divide-(--color-border-subtle) overflow-y-auto">
          {templates.map((tpl) => {
            const active = selectedId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => selectTemplate(tpl)}
                className={`block w-full px-4 py-3.5 text-start transition-colors ${
                  active ? "bg-(--color-accent-purple)/12" : "hover:bg-white/[0.03]"
                }`}
              >
                <p className="truncate text-xs font-semibold text-(--color-text-primary)">{tpl.name}</p>
                <p className="mt-1 truncate text-[11px] text-(--color-text-tertiary)">{tpl.subject}</p>
                <p className="mt-1.5 text-[11px] text-(--color-text-tertiary)">
                  <span>{tpl.category}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="uppercase">{tpl.locale}</span>
                  {tpl.is_system ? (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span>{isFa ? "سیستمی" : "Built-in"}</span>
                    </>
                  ) : null}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Right 8 cols: Template Editor + Live Preview */}
      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5 lg:col-span-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) pb-3.5">
          <h3 className="text-sm font-semibold text-(--color-text-primary)">
            {selectedId === "new"
              ? isFa
                ? "ساخت قالب ایمیل جدید"
                : "Create Email Template"
              : isFa
                ? "ویرایش قالب انتخاب‌شده"
                : "Edit Template"}
          </h3>

          <div className="flex items-center gap-2">
            {selected && (
              <button
                type="button"
                onClick={() => onUseInComposer(selected)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-(--color-border-strong) px-3 text-xs font-medium text-(--color-text-primary) hover:border-(--color-accent-purple) whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5 text-(--color-accent-purple)" />
                <span>{isFa ? "استفاده در ارسال سریع" : "Use in Composer"}</span>
              </button>
            )}
            {selected && !selected.is_system && (
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                aria-label={`Delete template ${selected.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border-subtle) text-(--color-text-tertiary) hover:border-rose-500/40 hover:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label htmlFor="tpl-name" className="mb-1 block text-xs text-(--color-text-secondary)">
              {isFa ? "نام قالب" : "Template Name"}
            </label>
            <input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            />
          </div>
          <div>
            <label htmlFor="tpl-category" className="mb-1 block text-xs text-(--color-text-secondary)">
              {isFa ? "دسته" : "Category"}
            </label>
            <select
              id="tpl-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as EmailTemplateCategory)}
              className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            >
              <option value="newsletter">{isFa ? "خبرنامه" : "Newsletter"}</option>
              <option value="transactional">{isFa ? "تراکنشی / خودکار" : "Transactional"}</option>
              <option value="announcement">{isFa ? "اطلاعیه" : "Announcement"}</option>
              <option value="reply">{isFa ? "پاسخ تحریریه" : "Editorial Reply"}</option>
              <option value="system">{isFa ? "سیستمی" : "System"}</option>
            </select>
          </div>
          <div>
            <label htmlFor="tpl-locale" className="mb-1 block text-xs text-(--color-text-secondary)">
              {isFa ? "زبان و جهت" : "Locale & Direction"}
            </label>
            <select
              id="tpl-locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value as EmailLocaleMode)}
              className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            >
              <option value="fa">{isFa ? "فارسی (RTL)" : "Persian (RTL)"}</option>
              <option value="en">{isFa ? "انگلیسی (LTR)" : "English (LTR)"}</option>
              <option value="bilingual">{isFa ? "دوزبانه (RTL)" : "Bilingual"}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="tpl-subject" className="mb-1 block text-xs text-(--color-text-secondary)">
              {isFa ? "موضوع ایمیل" : "Subject"}
            </label>
            <input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            />
          </div>
          <div>
            <label htmlFor="tpl-preheader" className="mb-1 block text-xs text-(--color-text-secondary)">
              {isFa ? "متن پیش‌نمایش" : "Preheader"}
            </label>
            <input
              id="tpl-preheader"
              value={preheader}
              onChange={(e) => setPreheader(e.target.value)}
              className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div>
            <label htmlFor="tpl-html" className="mb-1 block text-xs text-(--color-text-secondary)">
              {isFa ? "کد HTML قالب (پشتیبانی از متغیرهای {{name}})" : "Template HTML (supports {{variable}} tokens)"}
            </label>
            <textarea
              id="tpl-html"
              rows={11}
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              dir="ltr"
              className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-3 font-[family-name:var(--font-mono)] text-xs leading-relaxed text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
            />
          </div>

          <div className="flex flex-col overflow-hidden rounded-lg border border-(--color-border-subtle) bg-[#090b10]">
            <div className="border-b border-(--color-border-subtle) px-3 py-2 text-[11px] font-medium text-(--color-text-tertiary)">
              {isFa ? "پیش‌نمایش قالب" : "Rendered Preview"}
            </div>
            <iframe
              title={isFa ? "پیش‌نمایش قالب" : "Template preview"}
              sandbox=""
              srcDoc={previewDoc}
              className="min-h-[245px] w-full flex-1 bg-[#0b0d14]"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex h-9 items-center gap-2 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>{isFa ? "ذخیره قالب" : "Save Template"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
