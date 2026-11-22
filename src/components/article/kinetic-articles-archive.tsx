"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Eye,
  FileText,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  Sigma,
  X,
} from "lucide-react";
import {
  computeArchiveStats,
  filterAndSortArchiveArticles,
  type ArchiveDepthFilter,
  type ArchiveSortKey,
} from "@/lib/article-telemetry";
import { formatCount, formatDate, formatNumber } from "@/lib/utils";
import { resolveArticleCardImage } from "@/lib/image-delivery";
import { sanitizeUrl } from "@/lib/security";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Numerals } from "@/lib/i18n/numerals";
import type { FieldRecord } from "@/lib/taxonomy";

export interface KineticArchiveArticleItem {
  slug: string;
  title: string;
  excerpt: string;
  cover?: string;
  field: string;
  fieldColor: string;
  fieldLabel: string;
  authorName?: string;
  tags: string[];
  readingTimeMinutes: number;
  views: number;
  publishedAt: string;
  specimenCode: string;
  wordCount: number;
  displayEquationCount: number;
  figureCount: number;
}

type ViewMode = "grid" | "ledger";

export function KineticArticlesArchive({
  locale,
  dict,
  numerals,
  articles,
  fields,
  initialField = "all",
  initialSort = "latest",
}: {
  locale: Locale;
  dict: Dictionary;
  numerals: Numerals;
  articles: KineticArchiveArticleItem[];
  fields: FieldRecord[];
  initialField?: string;
  initialSort?: ArchiveSortKey;
}) {
  const isFa = locale === "fa";
  const ForwardArrow = isFa ? ArrowLeft : ArrowRight;

  const [selectedField, setSelectedField] = useState<string>(initialField || "all");
  const [depth, setDepth] = useState<ArchiveDepthFilter>("all");
  const [sortBy, setSortBy] = useState<ArchiveSortKey>(initialSort);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");

  const totalStats = useMemo(() => computeArchiveStats(articles), [articles]);

  const populatedFields = useMemo(() => {
    return fields
      .map((f) => ({ ...f, count: totalStats.fieldCounts[f.slug] ?? 0 }))
      .filter((f) => f.count > 0);
  }, [fields, totalStats.fieldCounts]);

  const filtered = useMemo(
    () =>
      filterAndSortArchiveArticles(articles, {
        field: selectedField,
        depth,
        query,
        sort: sortBy,
      }),
    [articles, selectedField, depth, query, sortBy]
  );

  const visibleStats = useMemo(() => computeArchiveStats(filtered), [filtered]);
  const totalEquations = useMemo(
    () => filtered.reduce((acc, item) => acc + item.displayEquationCount, 0),
    [filtered]
  );

  const hasActiveFilters =
    selectedField !== "all" || depth !== "all" || query.trim().length > 0;

  const resetFilters = () => {
    setSelectedField("all");
    setDepth("all");
    setQuery("");
  };

  const depthOptions: { id: ArchiveDepthFilter; labelFa: string; labelEn: string }[] = [
    { id: "all", labelFa: "همه", labelEn: "All" },
    { id: "quick", labelFa: "سریع ≤۳د", labelEn: "Quick ≤3m" },
    { id: "deep", labelFa: "عمیق ≥۴د", labelEn: "Deep ≥4m" },
  ];

  const sortOptions: { id: ArchiveSortKey; labelFa: string; labelEn: string }[] = [
    { id: "latest", labelFa: "جدیدترین", labelEn: "Latest" },
    { id: "views", labelFa: "پربازدیدترین", labelEn: "Most read" },
    { id: "quickest", labelFa: "کوتاه‌ترین", labelEn: "Shortest" },
    { id: "longest", labelFa: "عمیق‌ترین", labelEn: "Longest" },
  ];

  const [lead, ...rest] = filtered;

  return (
    <div className="space-y-8" data-kinetic-archive>
      {/* Architectural Archive Header */}
      <header className="space-y-6 border-b border-(--color-border-subtle) pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2 text-xs text-(--color-text-tertiary)">
              <span
                dir="ltr"
                className="font-[family-name:var(--font-mono)] font-medium text-(--color-accent-purple)"
              >
                01 / ARCHIVE
              </span>
              <span aria-hidden="true">·</span>
              <span>{isFa ? "آرشیو تحلیلی ساینتا" : "SCIENTA SCIENTIFIC INDEX"}</span>
            </div>

            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-(--color-text-primary) sm:text-5xl">
              {dict.nav.articles}
            </h1>

            <p className="text-sm leading-relaxed text-(--color-text-secondary) sm:text-base">
              {isFa
                ? "مجموعه مقالات پژوهشی و تحلیلی ساینتا با نمایه‌سازی دقیق معادلات، زمان مطالعه کالیبره‌شده و فیلتر لحظه‌ای بر اساس حوزه و عمق مطلب."
                : "Scienta's peer-curated essay library with indexed equations, calibrated reading telemetry, and live filtering by discipline and reading depth."}
            </p>
          </div>

          <div
            dir="ltr"
            className="hidden font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary) sm:block"
          >
            {String(filtered.length).padStart(2, "0")} /{" "}
            {String(articles.length).padStart(2, "0")} SPECIMENS
          </div>
        </div>

        {/* 4-Cell Precision Telemetry Strip */}
        <div className="grid grid-cols-2 divide-x divide-y divide-(--color-border-subtle) overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) sm:grid-cols-4 sm:divide-y-0 rtl:divide-x-reverse">
          <div className="px-4 py-3.5">
            <p className="text-[11px] text-(--color-text-tertiary)">
              {isFa ? "مقالات نمایان" : "Indexed Essays"}
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-lg font-medium tabular-nums text-(--color-text-primary)">
              {formatCount(visibleStats.totalArticles, locale, numerals)}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <p className="text-[11px] text-(--color-text-tertiary)">
              {isFa ? "معادلات نمایه‌شده" : "Indexed Equations"}
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-lg font-medium tabular-nums text-(--color-text-primary)">
              {formatCount(totalEquations, locale, numerals)}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <p className="text-[11px] text-(--color-text-tertiary)">
              {isFa ? "میانگین مطالعه" : "Avg. Reading Time"}
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-lg font-medium tabular-nums text-(--color-text-primary)">
              {formatCount(Math.round(visibleStats.avgReadingMinutes || 0), locale, numerals)}{" "}
              <span className="font-sans text-xs font-normal text-(--color-text-tertiary)">
                {dict.common.minutes}
              </span>
            </p>
          </div>

          <div className="px-4 py-3.5">
            <p className="text-[11px] text-(--color-text-tertiary)">
              {isFa ? "مجموع بازدیدها" : "Total Reads"}
            </p>
            <p className="mt-1 font-[family-name:var(--font-mono)] text-lg font-medium tabular-nums text-(--color-text-primary)">
              {formatNumber(visibleStats.totalViews, locale, numerals)}
            </p>
          </div>
        </div>
      </header>

      {/* Precision Filter, Search, Depth, Sort & View Controls */}
      <section
        aria-label={isFa ? "ابزار فیلتر و جستجوی آرشیو" : "Archive filter and search controls"}
        className="space-y-3 border-b border-(--color-border-subtle) pb-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Instant Search */}
          <div className="relative w-full sm:w-80">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--color-text-tertiary)"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-kinetic-archive-search
              placeholder={
                isFa
                  ? "جستجو در عنوان، برچسب، نویسنده یا چکیده…"
                  : "Search title, tag, author, or abstract…"
              }
              aria-label={isFa ? "جستجوی آنی در مقالات" : "Instant article search"}
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

          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start">
            {/* Reading Depth Filter */}
            <div
              role="group"
              aria-label={isFa ? "فیلتر عمق مطالعه" : "Reading depth filter"}
              className="inline-flex items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1"
            >
              {depthOptions.map((opt) => {
                const active = depth === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    data-kinetic-archive-depth={opt.id}
                    onClick={() => setDepth(opt.id)}
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

            {/* Grid / Swiss Ledger Toggle (paired with depth on mobile, end on sm+) */}
            <div
              role="group"
              aria-label={isFa ? "حالت نمایش آرشیو" : "Archive layout view"}
              className="inline-flex items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1 sm:order-3"
            >
              <button
                type="button"
                aria-pressed={viewMode === "grid"}
                data-kinetic-archive-view="grid"
                onClick={() => setViewMode("grid")}
                aria-label={isFa ? "نمای کارت‌های معماری" : "Specimen grid view"}
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
                data-kinetic-archive-view="ledger"
                onClick={() => setViewMode("ledger")}
                aria-label={isFa ? "نمای جدول آزمایشگاهی" : "Swiss specimen ledger"}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  viewMode === "ledger"
                    ? "bg-(--color-bg-elevated) text-(--color-text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                <List className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Sort Selector */}
            <div
              role="group"
              aria-label={isFa ? "مرتب‌سازی مقالات" : "Sort articles"}
              className="inline-flex w-full items-center justify-between gap-1 overflow-x-auto rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:order-2 sm:w-auto sm:justify-start"
            >
              {sortOptions.map((opt) => {
                const active = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    data-kinetic-archive-sort={opt.id}
                    onClick={() => setSortBy(opt.id)}
                    className={`shrink-0 flex-1 rounded-md px-2.5 py-1 text-center text-xs font-medium transition-colors duration-150 sm:flex-initial ${
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
          </div>
        </div>

        {/* Crisp Rectangular Field Tabs — horizontal swipe strip on mobile, wrapped on md+ */}
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div
            role="tablist"
            aria-label={isFa ? "فیلتر بر اساس حوزه علمی" : "Filter by scientific discipline"}
            className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible md:pb-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedField === "all"}
              data-kinetic-archive-field="all"
              onClick={() => setSelectedField("all")}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-medium transition-colors duration-150 ${
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
                  data-kinetic-archive-field={field.slug}
                  onClick={() => setSelectedField(field.slug)}
                  className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-medium transition-colors duration-150 ${
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

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-elevated) px-2.5 text-xs text-(--color-text-tertiary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>{isFa ? "پاک کردن فیلترها" : "Reset"}</span>
            </button>
          )}
        </div>
      </section>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-(--color-border-strong) bg-(--color-bg-elevated) px-6 py-16 text-center">
          <BookOpen className="h-6 w-6 text-(--color-text-tertiary)" strokeWidth={1.5} />
          <p className="text-sm font-medium text-(--color-text-primary)">
            {isFa
              ? "مقاله‌ای مطابق با فیلترهای انتخابی پیدا نشد."
              : "No essays match the selected filters."}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--color-text-primary) px-4 text-xs font-medium text-(--color-bg-deep) transition-colors hover:bg-(--color-accent-purple) hover:text-white"
          >
            {isFa ? "نمایش کل آرشیو" : "Show full archive"}
          </button>
        </div>
      ) : viewMode === "ledger" ? (
        /* Swiss Specimen Ledger Table */
        <div
          data-kinetic-archive-ledger
          className="overflow-hidden rounded-2xl border border-(--color-border-subtle) bg-(--color-bg-elevated)"
        >
          <div className="hidden grid-cols-12 items-center gap-3 border-b border-(--color-border-subtle) bg-(--color-bg-secondary) px-6 py-2.5 text-[11px] font-medium text-(--color-text-tertiary) md:grid">
            <span className="col-span-5">{isFa ? "شناسه و عنوان مقاله" : "Specimen & Title"}</span>
            <span className="col-span-2">{isFa ? "حوزه علمی" : "Discipline"}</span>
            <span className="col-span-2">{isFa ? "واژه / معادله" : "Words / Eqs"}</span>
            <span className="col-span-3 text-end">{isFa ? "مطالعه · بازدید · تاریخ" : "Time · Views · Date"}</span>
          </div>

          <div className="divide-y divide-(--color-border-subtle)">
            {filtered.map((article, idx) => (
              <Link
                key={article.slug}
                href={`/${locale}/articles/${article.slug}`}
                className="group grid items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-(--color-bg-secondary) md:grid-cols-12 md:px-6"
              >
                <div className="flex items-start gap-3 md:col-span-5">
                  <div className="flex shrink-0 flex-col items-start pt-0.5">
                    <span
                      dir="ltr"
                      className={`font-[family-name:var(--font-mono)] text-xs tabular-nums ${
                        idx === 0
                          ? "font-medium text-(--color-accent-purple)"
                          : "text-(--color-text-tertiary)"
                      }`}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary)"
                    >
                      {article.specimenCode}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate font-[family-name:var(--font-display)] text-base font-medium text-(--color-text-primary) transition-colors group-hover:text-(--color-accent-purple)">
                      {article.title}
                    </h2>
                    <p className="mt-0.5 line-clamp-1 text-xs text-(--color-text-tertiary)">
                      {article.excerpt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-(--color-text-secondary) md:col-span-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-xs"
                    style={{ backgroundColor: article.fieldColor }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{article.fieldLabel}</span>
                </div>

                <div className="flex items-center gap-3 text-xs tabular-nums text-(--color-text-tertiary) md:col-span-2">
                  <span className="inline-flex items-center gap-1" title={isFa ? "تعداد واژگان" : "Word count"}>
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {formatNumber(article.wordCount, locale, numerals)}
                  </span>
                  {article.displayEquationCount > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded border border-(--color-border-subtle) bg-(--color-bg-secondary) px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-(--color-accent-purple)"
                      title={isFa ? "تعداد معادلات نمایشی" : "Display equations"}
                    >
                      <Sigma className="h-3 w-3" strokeWidth={1.5} />
                      {formatCount(article.displayEquationCount, locale, numerals)}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums text-(--color-text-tertiary) md:col-span-3 md:justify-end">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {formatCount(article.readingTimeMinutes, locale, numerals)}
                    {isFa ? "د" : "m"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {formatNumber(article.views, locale, numerals)}
                  </span>
                  <span>{formatDate(article.publishedAt, locale, numerals)}</span>
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
        /* Architectural Specimen Grid (Featured Lead + 3-Col Cards) */
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
                <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-(--color-border-subtle) bg-(--color-bg-secondary) lg:col-span-6 lg:aspect-auto lg:min-h-[320px] lg:border-b-0 lg:border-e">
                  {leadImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={leadImage.src}
                      srcSet={leadImage.srcSet}
                      sizes={leadImage.sizes}
                      width={leadImage.width}
                      height={leadImage.height}
                      alt={lead.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-95"
                    />
                  )}
                </div>

                <div className="flex flex-col justify-between gap-6 p-6 sm:p-8 lg:col-span-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-(--color-text-tertiary)">
                      <span className="inline-flex items-center gap-2 font-medium text-(--color-text-secondary)">
                        <span
                          className="h-2 w-2 rounded-xs"
                          style={{ backgroundColor: lead.fieldColor }}
                          aria-hidden="true"
                        />
                        {lead.fieldLabel}
                      </span>

                      <div className="flex items-center gap-2">
                        {lead.displayEquationCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded border border-(--color-border-subtle) bg-(--color-bg-secondary) px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-accent-purple)">
                            <Sigma className="h-3 w-3" strokeWidth={1.5} />
                            {formatCount(lead.displayEquationCount, locale, numerals)}
                          </span>
                        )}
                        <span
                          dir="ltr"
                          className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums"
                        >
                          {lead.specimenCode}
                        </span>
                      </div>
                    </div>

                    <h2 className="font-[family-name:var(--font-display)] text-2xl font-medium text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple) sm:text-3xl">
                      {lead.title}
                    </h2>

                    <p className="line-clamp-3 text-sm leading-relaxed text-(--color-text-secondary) sm:text-base">
                      {lead.excerpt}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border-subtle) pt-4 text-xs text-(--color-text-tertiary)">
                    <div className="flex flex-wrap items-center gap-4 tabular-nums">
                      <span>{formatDate(lead.publishedAt, locale, numerals)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {formatCount(lead.readingTimeMinutes, locale, numerals)}{" "}
                        {dict.common.minutes}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {formatNumber(lead.wordCount, locale, numerals)}{" "}
                        {isFa ? "واژه" : "words"}
                      </span>
                      <span className="inline-flex items-center gap-1">
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
                            <span className="truncate">{article.fieldLabel}</span>
                          </span>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {article.displayEquationCount > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded border border-(--color-border-subtle) bg-(--color-bg-secondary) px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-(--color-accent-purple)"
                                title={isFa ? "معادلات مقاله" : "Display equations"}
                              >
                                <Sigma className="h-2.5 w-2.5" strokeWidth={1.6} />
                                {formatCount(article.displayEquationCount, locale, numerals)}
                              </span>
                            )}
                            <span
                              dir="ltr"
                              className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums"
                            >
                              {String(idx + 2).padStart(2, "0")}
                            </span>
                          </div>
                        </div>

                        <h3 className="mt-2.5 line-clamp-2 font-[family-name:var(--font-display)] text-base font-medium text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple)">
                          {article.title}
                        </h3>

                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-(--color-text-secondary)">
                          {article.excerpt}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-(--color-border-subtle) pt-3 text-xs tabular-nums text-(--color-text-tertiary)">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {formatCount(article.readingTimeMinutes, locale, numerals)}{" "}
                          {dict.common.minutes}
                        </span>
                        <span dir="ltr" className="font-[family-name:var(--font-mono)] text-[10px]">
                          {article.specimenCode}
                        </span>
                        <span className="inline-flex items-center gap-1">
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
