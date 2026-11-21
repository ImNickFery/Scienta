"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Eye,
  LayoutGrid,
  List,
  Search,
  X,
} from "lucide-react";
import { formatCount, formatDate, formatNumber } from "@/lib/utils";
import { resolveArticleCardImage } from "@/lib/image-delivery";
import { sanitizeUrl } from "@/lib/security";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { FieldRecord } from "@/lib/taxonomy";
import type { Numerals } from "@/lib/i18n/numerals";

type SortKey = "latest" | "popular" | "quickest";
type ViewMode = "grid" | "ledger";

/**
 * Interactive filterable, searchable & sortable essay specimen deck for Unslop Kinetic.
 * Supports instant live keyword search, discipline filtering, sort switching,
 * and a Grid vs Swiss Specimen Ledger view toggle without leaving the homepage.
 */
export function UnslopKineticExplorer({
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

  const [selectedField, setSelectedField] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("latest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");

  const populatedFields = useMemo(() => {
    const counts = new Map<string, number>();
    for (const art of articles) {
      counts.set(art.field, (counts.get(art.field) ?? 0) + 1);
    }
    return fields
      .map((f) => ({ ...f, count: counts.get(f.slug) ?? 0 }))
      .filter((f) => f.count > 0);
  }, [articles, fields]);

  const fieldNames = dict.fields;

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    let base =
      selectedField === "all"
        ? [...articles]
        : articles.filter((a) => a.field === selectedField);

    if (trimmed) {
      base = base.filter(
        (a) =>
          a.title.toLowerCase().includes(trimmed) ||
          a.excerpt.toLowerCase().includes(trimmed) ||
          (fieldNames[a.field as keyof typeof fieldNames] ?? "")
            .toLowerCase()
            .includes(trimmed)
      );
    }

    if (sortBy === "popular") {
      base.sort((a, b) => b.views - a.views);
    } else if (sortBy === "quickest") {
      base.sort((a, b) => a.readingTimeMinutes - b.readingTimeMinutes);
    } else {
      base.sort((a, b) => (b.publishedAt > a.publishedAt ? 1 : -1));
    }
    return base;
  }, [articles, selectedField, sortBy, query, fieldNames]);

  const lead = filtered[0];
  const rest = filtered.slice(1, 7);

  const sortOptions: { id: SortKey; labelFa: string; labelEn: string }[] = [
    { id: "latest", labelFa: "جدیدترین", labelEn: "Latest" },
    { id: "popular", labelFa: "پربازدیدترین", labelEn: "Most read" },
    { id: "quickest", labelFa: "مطالعه سریع", labelEn: "Shortest" },
  ];

  const resetFilters = () => {
    setSelectedField("all");
    setQuery("");
  };

  return (
    <div className="space-y-6">
      {/* Live Discipline Filter, Instant Search, Sort & Layout Switcher */}
      <div className="space-y-3 border-b border-(--color-border-subtle) pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Instant Search Input */}
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--color-text-tertiary)"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-kinetic-search
              placeholder={
                isFa
                  ? "جستجوی آنی در عنوان یا چکیده…"
                  : "Instant filter by title or topic…"
              }
              aria-label={isFa ? "جستجوی آنی مقالات" : "Filter essays instantly"}
              className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-elevated) pe-8 ps-9 text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={isFa ? "پاک کردن جستجو" : "Clear search"}
                className="absolute end-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Sort + View Mode Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label={isFa ? "مرتب‌سازی مقالات" : "Sort essays"}
              className="inline-flex items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1"
            >
              {sortOptions.map((opt) => {
                const active = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    data-kinetic-sort={opt.id}
                    onClick={() => setSortBy(opt.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                      active
                        ? "bg-(--color-bg-elevated) text-(--color-text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                        : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                    }`}
                  >
                    {isFa ? opt.labelFa : opt.labelEn}
                  </button>
                );
              })}
            </div>

            <div
              role="group"
              aria-label={isFa ? "حالت نمایش مقالات" : "Essay view layout"}
              className="inline-flex items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1"
            >
              <button
                type="button"
                aria-pressed={viewMode === "grid"}
                data-kinetic-view="grid"
                onClick={() => setViewMode("grid")}
                aria-label={isFa ? "نمای کارت‌ها" : "Card grid view"}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  viewMode === "grid"
                    ? "bg-(--color-bg-elevated) text-(--color-text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "ledger"}
                data-kinetic-view="ledger"
                onClick={() => setViewMode("ledger")}
                aria-label={isFa ? "نمای فهرست آزمایشگاهی" : "Specimen ledger view"}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  viewMode === "ledger"
                    ? "bg-(--color-bg-elevated) text-(--color-text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                <List className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Discipline Filter Tabs */}
        <div
          role="tablist"
          aria-label={isFa ? "فیلتر بر اساس حوزه علمی" : "Filter essays by scientific field"}
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedField === "all"}
            data-kinetic-field="all"
            onClick={() => setSelectedField("all")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors duration-150 ${
              selectedField === "all"
                ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-bg-deep)"
                : "border-(--color-border-subtle) bg-(--color-bg-elevated) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
            }`}
          >
            <span>{isFa ? "همه حوزه‌ها" : "All fields"}</span>
            <span
              dir="ltr"
              className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums opacity-75"
            >
              {formatCount(articles.length, locale, numerals)}
            </span>
          </button>

          {populatedFields.map((field) => {
            const active = selectedField === field.slug;
            return (
              <button
                key={field.slug}
                type="button"
                role="tab"
                aria-selected={active}
                data-kinetic-field={field.slug}
                onClick={() => setSelectedField(field.slug)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors duration-150 ${
                  active
                    ? "border-(--color-text-primary) bg-(--color-text-primary) text-(--color-bg-deep)"
                    : "border-(--color-border-subtle) bg-(--color-bg-elevated) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-xs"
                  style={{ backgroundColor: active ? "currentColor" : field.color }}
                  aria-hidden="true"
                />
                <span>{field.name[locale]}</span>
                <span
                  dir="ltr"
                  className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums opacity-75"
                >
                  {formatCount(field.count, locale, numerals)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-(--color-border-strong) bg-(--color-bg-elevated) px-6 py-14 text-center">
          <p className="text-sm font-medium text-(--color-text-primary)">
            {isFa
              ? "مقاله‌ای مطابق با فیلتر یا عبارت جستجوی شما پیدا نشد."
              : "No essays match the active filter or search term."}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--color-text-primary) px-4 text-xs font-medium text-(--color-bg-deep) transition-colors hover:bg-(--color-accent-purple) hover:text-white"
          >
            {isFa ? "نمایش همه مقالات" : "Reset filters"}
          </button>
        </div>
      ) : viewMode === "ledger" ? (
        /* Swiss Specimen Ledger View — ultra-scannable precision index */
        <div
          data-kinetic-ledger
          className="overflow-hidden rounded-2xl border border-(--color-border-subtle) bg-(--color-bg-elevated)"
        >
          <div className="divide-y divide-(--color-border-subtle)">
            {filtered.map((article, idx) => (
              <Link
                key={article.slug}
                href={`/${locale}/articles/${article.slug}`}
                className="group grid items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-(--color-bg-secondary) sm:grid-cols-12 sm:px-6"
              >
                <div className="flex items-center gap-3 sm:col-span-6">
                  <span
                    dir="ltr"
                    className={`w-6 shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums ${
                      idx === 0
                        ? "font-medium text-(--color-accent-purple)"
                        : "text-(--color-text-tertiary)"
                    }`}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-[family-name:var(--font-display)] text-base font-medium text-(--color-text-primary) transition-colors group-hover:text-(--color-accent-purple)">
                      {article.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-xs text-(--color-text-tertiary)">
                      {article.excerpt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-(--color-text-secondary) sm:col-span-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-xs"
                    style={{ backgroundColor: article.fieldColor }}
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {dict.fields[article.field as keyof typeof dict.fields]}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums text-(--color-text-tertiary) sm:col-span-4 sm:justify-end">
                  <span>{formatDate(article.publishedAt, locale, numerals)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {formatCount(article.readingTimeMinutes, locale, numerals)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {formatNumber(article.views, locale, numerals)}
                  </span>
                  <ForwardArrow
                    className="h-4 w-4 text-(--color-text-tertiary) transition-colors group-hover:text-(--color-accent-purple)"
                    strokeWidth={1.5}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        /* Architectural Card Grid View (Wide Lead + 3-Col Grid) */
        <div className="space-y-6">
          {lead && (() => {
            const leadCover = sanitizeUrl(lead.cover, {
              allowRelative: true,
              allowHash: false,
            });
            const leadImage = leadCover ? resolveArticleCardImage(leadCover, "large") : null;
            return (
              <Link
                href={`/${locale}/articles/${lead.slug}`}
                className="group grid overflow-hidden rounded-2xl border border-(--color-border-subtle) bg-(--color-bg-elevated) transition-colors duration-150 hover:border-(--color-border-strong) lg:grid-cols-12"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-(--color-bg-secondary) lg:col-span-6 lg:aspect-auto lg:min-h-[300px]">
                  {leadImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={leadImage.src}
                      srcSet={leadImage.srcSet}
                      sizes={leadImage.sizes}
                      width={leadImage.width}
                      height={leadImage.height}
                      alt={lead.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95"
                    />
                  )}
                </div>

                <div className="flex flex-col justify-between gap-6 p-6 sm:p-8 lg:col-span-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-(--color-text-tertiary)">
                      <span className="inline-flex items-center gap-2 font-medium text-(--color-text-secondary)">
                        <span
                          className="h-2 w-2 rounded-xs"
                          style={{ backgroundColor: lead.fieldColor }}
                          aria-hidden="true"
                        />
                        {dict.fields[lead.field as keyof typeof dict.fields]}
                      </span>
                      <span dir="ltr" className="font-[family-name:var(--font-mono)] tabular-nums">
                        01 / {String(filtered.length).padStart(2, "0")}
                      </span>
                    </div>

                    <h3 className="font-[family-name:var(--font-display)] text-2xl font-medium text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple) sm:text-3xl">
                      {lead.title}
                    </h3>

                    <p className="line-clamp-3 text-sm leading-relaxed text-(--color-text-secondary) sm:text-base">
                      {lead.excerpt}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border-subtle) pt-4 text-xs text-(--color-text-tertiary)">
                    <div className="flex flex-wrap items-center gap-4">
                      <span>{formatDate(lead.publishedAt, locale, numerals)}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {formatCount(lead.readingTimeMinutes, locale, numerals)}{" "}
                        {dict.common.minutes}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {formatNumber(lead.views, locale, numerals)}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 font-medium text-(--color-accent-purple)">
                      <span>{isFa ? "مطالعه مقاله" : "Read essay"}</span>
                      <ForwardArrow className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })()}

          {rest.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((article, idx) => {
                const coverSrc = sanitizeUrl(article.cover, {
                  allowRelative: true,
                  allowHash: false,
                });
                const cardImage = coverSrc ? resolveArticleCardImage(coverSrc, "default") : null;
                return (
                  <Link
                    key={article.slug}
                    href={`/${locale}/articles/${article.slug}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) transition-colors duration-150 hover:border-(--color-border-strong)"
                  >
                    <div className="aspect-[16/10] w-full overflow-hidden border-b border-(--color-border-subtle) bg-(--color-bg-secondary)">
                      {cardImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cardImage.src}
                          srcSet={cardImage.srcSet}
                          sizes={cardImage.sizes}
                          width={cardImage.width}
                          height={cardImage.height}
                          alt={article.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-92"
                        />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-(--color-text-tertiary)">
                          <span className="inline-flex items-center gap-1.5 truncate">
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-xs"
                              style={{ backgroundColor: article.fieldColor }}
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              {dict.fields[article.field as keyof typeof dict.fields]}
                            </span>
                          </span>
                          <span
                            dir="ltr"
                            className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums"
                          >
                            {String(idx + 2).padStart(2, "0")}
                          </span>
                        </div>

                        <h4 className="mt-2 line-clamp-2 font-[family-name:var(--font-display)] text-base font-medium text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple)">
                          {article.title}
                        </h4>

                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-(--color-text-secondary)">
                          {article.excerpt}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-(--color-border-subtle) pt-3 text-xs text-(--color-text-tertiary)">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {formatCount(article.readingTimeMinutes, locale, numerals)}{" "}
                          {dict.common.minutes}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {formatNumber(article.views, locale, numerals)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
