"use client";

import { useEffect, useState } from "react";
import { X, Copy, Check, Download, Quote } from "lucide-react";
import { buildAllCitations, type CitationInput } from "@/lib/citations";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

type FormatTab = "bibtex" | "apa" | "ieee";

const LABELS = {
  fa: {
    title: "استناد به این مقاله",
    subtitle: "قالب مورد نظر را انتخاب کنید یا فایل BibTeX را دانلود کنید.",
    copy: "کپی استناد",
    copied: "کپی شد",
    downloadBib: "دانلود فایل .bib",
    close: "بستن",
  },
  en: {
    title: "Cite this article",
    subtitle: "Choose a citation format to copy or download as BibTeX.",
    copy: "Copy citation",
    copied: "Copied",
    downloadBib: "Download .bib",
    close: "Close",
  },
} as const;

export function CiteModal({
  input,
  locale,
  onClose,
}: {
  input: CitationInput;
  locale: Locale;
  onClose: () => void;
}) {
  const t = LABELS[locale];
  const [tab, setTab] = useState<FormatTab>("bibtex");
  const [copied, setCopied] = useState(false);

  const citations = buildAllCitations(input);
  const activeText = citations[tab];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleCopy() {
    const ok = await copyToClipboard(activeText);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownloadBib() {
    const blob = new Blob([`${citations.bibtex}\n`], { type: "application/x-bibtex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${citations.key}.bib`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: FormatTab; label: string }[] = [
    { id: "bibtex", label: "BibTeX" },
    { id: "apa", label: "APA 7th" },
    { id: "ieee", label: "IEEE" },
  ];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-2xl overflow-hidden rounded-2xl bg-(--color-bg-elevated) shadow-[0_30px_100px_-20px_rgba(var(--color-accent-glow-rgb),0.45)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-(--color-border-subtle) px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-accent-purple)/15 text-(--color-accent-purple)">
              <Quote className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-(--color-text-primary)">
                {t.title}
              </h2>
              <p className="text-xs text-(--color-text-tertiary)">{t.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="flex h-8 w-8 items-center justify-center rounded-full text-(--color-text-tertiary) transition-colors hover:bg-white/10 hover:text-(--color-text-primary)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist">
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(item.id);
                    setCopied(false);
                  }}
                  className={cn(
                    "rounded-full px-4 py-1.5 font-[family-name:var(--font-mono)] text-xs font-medium transition-colors",
                    active
                      ? "bg-(--color-accent-purple) text-white"
                      : "border border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <pre
            dir="ltr"
            className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-(--color-border-subtle) bg-black/35 p-4 font-[family-name:var(--font-mono)] text-xs leading-relaxed text-(--color-text-secondary)"
          >
            {activeText}
          </pre>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleDownloadBib}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-(--color-border-subtle) px-4 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
            >
              <Download className="h-3.5 w-3.5" />
              {t.downloadBib}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-5 text-xs font-semibold text-white transition-opacity hover:opacity-95"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t.copied : t.copy}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
