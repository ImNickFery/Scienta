"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Clock, Eye } from "lucide-react";
import { formatCount, formatNumber } from "@/lib/utils";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { FieldRecord } from "@/lib/taxonomy";
import type { Numerals } from "@/lib/i18n/numerals";

/**
 * Interactive Scientific Disciplines Index + Live Specimen Preview Panel.
 * Clicking or hovering any discipline bar immediately displays its live essay count,
 * total readership, average reading duration, and direct article links.
 */
export function UnslopKineticDisciplines({
  locale,
  dict,
  numerals,
  articles,
  fields,
}: {
  locale: Locale;
  dict: Dictionary;
  numerals: Numerals;
  articles: Article[];
  fields: FieldRecord[];
}) {
  const isFa = locale === "fa";
  const ForwardArrow = isFa ? ArrowLeft : ArrowRight;

  const enriched = useMemo(() => {
    const list = fields.map((field) => {
      const matched = articles.filter((a) => a.field === field.slug);
      const totalViews = matched.reduce((sum, a) => sum + a.views, 0);
      const avgMinutes = matched.length
        ? Math.round(
            matched.reduce((sum, a) => sum + a.readingTimeMinutes, 0) / matched.length
          )
        : 0;
      return {
        ...field,
        articles: matched,
        count: matched.length,
        totalViews,
        avgMinutes,
      };
    });
    return list.sort((a, b) => b.count - a.count || b.totalViews - a.totalViews);
  }, [articles, fields]);

  const [activeSlug, setActiveSlug] = useState<string>(() => enriched[0]?.slug ?? "");

  const maxCount = Math.max(1, ...enriched.map((f) => f.count));
  const selected =
    enriched.find((f) => f.slug === activeSlug) ?? enriched[0] ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      {/* Proportional Discipline Share Matrix (7 cols) */}
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:col-span-7">
        {enriched.map((field, idx) => {
          const pct = Math.max(6, Math.round((field.count / maxCount) * 100));
          const isActive = selected?.slug === field.slug;
          return (
            <button
              key={field.slug}
              type="button"
              data-kinetic-discipline={field.slug}
              aria-pressed={isActive}
              onClick={() => setActiveSlug(field.slug)}
              onMouseEnter={() => setActiveSlug(field.slug)}
              className={`group flex w-full items-center gap-3.5 border-b py-3.5 text-start transition-colors duration-150 ${
                isActive
                  ? "border-(--color-text-primary)"
                  : "border-(--color-border-subtle) hover:border-(--color-border-strong)"
              }`}
            >
              <span
                dir="ltr"
                className={`w-6 shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums ${
                  isActive
                    ? "font-medium text-(--color-accent-purple)"
                    : "text-(--color-text-tertiary)"
                }`}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`truncate text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? "text-(--color-text-primary)"
                        : "text-(--color-text-secondary) group-hover:text-(--color-text-primary)"
                    }`}
                  >
                    {field.name[locale]}
                  </span>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                    {formatCount(field.count, locale, numerals)}
                  </span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-(--color-border-subtle)">
                  <div
                    className="h-full rounded-full transition-[width,background-color] duration-200"
                    style={{
                      width: `${field.count > 0 ? pct : 0}%`,
                      backgroundColor: isActive
                        ? "var(--color-accent-purple)"
                        : "var(--color-text-tertiary)",
                    }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Selected Discipline Telemetry & Essays Drawer (5 cols) */}
      {selected && (
        <aside
          aria-live="polite"
          data-kinetic-discipline-preview={selected.slug}
          className="flex flex-col justify-between gap-6 rounded-2xl border border-(--color-border-strong) bg-(--color-bg-elevated) p-6 lg:col-span-5"
        >
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-(--color-border-subtle) pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-(--color-text-tertiary)">
                  <span
                    className="h-2 w-2 rounded-xs"
                    style={{ backgroundColor: selected.color }}
                    aria-hidden="true"
                  />
                  <span dir="ltr" className="font-[family-name:var(--font-mono)] uppercase">
                    {selected.slug}
                  </span>
                </div>
                <h3 className="mt-1.5 font-[family-name:var(--font-display)] text-xl font-medium text-(--color-text-primary)">
                  {selected.name[locale]}
                </h3>
              </div>

              <Link
                href={`/${locale}/fields/${selected.slug}`}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3 text-xs font-medium text-(--color-text-primary) transition-colors hover:border-(--color-text-primary) hover:text-(--color-accent-purple)"
              >
                <span>{isFa ? "آرشیو حوزه" : "Open field"}</span>
                <ForwardArrow className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Link>
            </div>

            {/* Discipline Real Telemetry Trio */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                <div className="text-[11px] text-(--color-text-tertiary)">
                  {isFa ? "مقالات" : "Essays"}
                </div>
                <div className="mt-0.5 font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-text-primary)">
                  {formatCount(selected.count, locale, numerals)}
                </div>
              </div>
              <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                <div className="text-[11px] text-(--color-text-tertiary)">
                  {isFa ? "بازدید کل" : "Views"}
                </div>
                <div className="mt-0.5 font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-accent-purple)">
                  {formatNumber(selected.totalViews, locale, numerals)}
                </div>
              </div>
              <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 py-2">
                <div className="text-[11px] text-(--color-text-tertiary)">
                  {isFa ? "میانگین مطالعه" : "Avg read"}
                </div>
                <div className="mt-0.5 font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-text-primary)">
                  {selected.avgMinutes > 0
                    ? `${formatCount(selected.avgMinutes, locale, numerals)} ${dict.common.minutes}`
                    : "—"}
                </div>
              </div>
            </div>

            {/* Direct Published Essays Inside Selected Discipline */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-(--color-text-tertiary)">
                {isFa ? "مقالات منتشرشده در این حوزه" : "Published essays in this discipline"}
              </p>

              {selected.articles.length > 0 ? (
                <div className="divide-y divide-(--color-border-subtle) rounded-xl border border-(--color-border-subtle) bg-(--color-bg-deep)">
                  {selected.articles.slice(0, 3).map((article) => (
                    <Link
                      key={article.slug}
                      href={`/${locale}/articles/${article.slug}`}
                      className="group flex flex-col gap-1.5 px-3.5 py-3 transition-colors hover:bg-(--color-bg-secondary)"
                    >
                      <span className="text-sm font-medium text-(--color-text-primary) transition-colors group-hover:text-(--color-accent-purple)">
                        {article.title}
                      </span>
                      <span className="flex items-center gap-3 text-[11px] tabular-nums text-(--color-text-tertiary)">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" strokeWidth={1.5} />
                          {formatCount(article.readingTimeMinutes, locale, numerals)}{" "}
                          {dict.common.minutes}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" strokeWidth={1.5} />
                          {formatNumber(article.views, locale, numerals)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-(--color-border-strong) bg-(--color-bg-deep) px-4 py-4 text-xs text-(--color-text-tertiary)">
                  <BookOpen className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>
                    {isFa
                      ? "هنوز مقاله‌ای در این حوزه منتشر نشده است — به‌زودی نخستین پژوهش‌ها اضافه می‌شوند."
                      : "No published essays in this discipline yet — new studies are queued."}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-(--color-border-subtle) pt-3 text-[11px] text-(--color-text-tertiary)">
            <span>
              {isFa
                ? "روی هر حوزه کلیک یا اشاره کنید"
                : "Select or hover any discipline to inspect"}
            </span>
            <span dir="ltr" className="font-[family-name:var(--font-mono)] tabular-nums">
              {String(enriched.findIndex((f) => f.slug === selected.slug) + 1).padStart(2, "0")} /{" "}
              {String(enriched.length).padStart(2, "0")}
            </span>
          </div>
        </aside>
      )}
    </div>
  );
}
