"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FileJson,
  HardDrive,
  Minus,
  Pencil,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { useAdminLocale } from "@/components/admin/admin-locale-context";
import { AnalyticsTimeChart } from "@/components/admin/analytics/analytics-time-chart";
import { AnalyticsDonutCard } from "@/components/admin/analytics/analytics-donut-card";
import { AnalyticsHeatmap } from "@/components/admin/analytics/analytics-heatmap";
import type { DailyTrendPoint, EditorialCoverageSummary } from "@/lib/admin-analytics";
import {
  serializeAnalyticsCsv,
  type HeatmapCell,
  type PeriodDelta,
  type ProWindowDays,
  type SeoMissingKey,
} from "@/lib/admin-analytics-pro";

type LocaleFilter = "all" | "fa" | "en";
type FieldSortKey = "views" | "avgViews" | "articles";
type ArticleHealthFilter = "all" | "needs_seo" | "single_locale" | "featured";
type ArticleSortKey = "views" | "comments" | "words" | "seo" | "published";

interface AnalyticsArticleRow {
  id: string;
  status: "published" | "draft" | "scheduled";
  featured: boolean;
  trending: boolean;
  views: number;
  comments: number;
  words: number;
  readMinutes: number;
  hasCover: boolean;
  isBilingual: boolean;
  hasFa: boolean;
  hasEn: boolean;
  publishedAt: string | null;
  fieldId: string | null;
  fieldNameEn: string | null;
  fieldNameFa: string | null;
  fieldColor: string;
  authorId: string | null;
  authorNameEn: string | null;
  authorNameFa: string | null;
  titleEn: string;
  titleFa: string;
  slugEn: string;
  slugFa: string;
  seoPassed: number;
  seoTotal: number;
  seoMissing: SeoMissingKey[];
}

interface AnalyticsPayload {
  rangeDays: ProWindowDays;
  localeFilter: LocaleFilter;
  generatedAt: string;
  kpis: {
    totalViews: number;
    avgViewsPerEssay: number;
    livePageviewsDelta: PeriodDelta;
    publishedCount: number;
    draftCount: number;
    scheduledCount: number;
    totalArticles: number;
    totalWords: number;
    avgWordsPerEssay: number;
    avgReadMinutes: number;
    activeSubscribers: number;
    unsubscribedCount: number;
    retentionPct: number;
    subscribersDelta: PeriodDelta;
    totalComments: number;
    approvedComments: number;
    pendingComments: number;
    rejectedComments: number;
    approvalRatePct: number;
    totalQuestions: number;
    answeredQuestions: number;
    qaReplyRatePct: number;
    commentsDelta: PeriodDelta;
    activityDelta: PeriodDelta;
    seoFullyReadyCount: number;
    seoReadyPct: number;
    zeroViewPublishedCount: number;
    coverage: EditorialCoverageSummary;
    aiTotalRequests: number;
    aiActiveKeys: number;
  };
  trends: {
    pageviews: DailyTrendPoint[];
    activity: DailyTrendPoint[];
    subscribers: DailyTrendPoint[];
    comments: DailyTrendPoint[];
  };
  audience: {
    livePageviewsInRange: number;
    liveLocales: { fa: number; en: number };
    subscriberLocales: { fa: number; en: number };
    devices: { desktop: number; mobile: number; tablet: number };
    topReferrers: { host: string; count: number; share: number }[];
  };
  fieldsMatrix: {
    id: string;
    slug: string;
    nameEn: string;
    nameFa: string;
    color: string;
    articles: number;
    views: number;
    comments: number;
    words: number;
    avgViews: number;
    viewShare: number;
  }[];
  authorLeaderboard: {
    id: string;
    slug: string;
    nameEn: string;
    nameFa: string;
    articles: number;
    views: number;
    comments: number;
    words: number;
    avgViews: number;
  }[];
  articles: AnalyticsArticleRow[];
  topTags: {
    id: string;
    slug: string;
    nameEn: string;
    nameFa: string;
    articleCount: number;
    totalViews: number;
  }[];
  mediaAudit: {
    totalFiles: number;
    totalBytes: number;
    avgBytes: number;
    formats: { format: string; count: number; bytes: number }[];
  };
  heatmap: {
    cells: HeatmapCell[];
    total: number;
    peak: number;
    activeDays: number;
  };
}

const SEO_MISSING_LABELS: Record<SeoMissingKey, { en: string; fa: string }> = {
  seo_title: { en: "SEO title", fa: "عنوان سئو" },
  seo_description: { en: "Meta desc", fa: "توضیحات متا" },
  cover: { en: "Cover", fa: "کاور" },
  excerpt: { en: "Excerpt", fa: "چکیده" },
  bilingual: { en: "2nd locale", fa: "دوزبانه" },
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateShort(raw: string | null, isFa: boolean): string {
  if (!raw) return "—";
  const d = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(isFa ? "fa-IR" : "en-US", {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function triggerFileDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DeltaIndicator({ delta, isFa }: { delta: PeriodDelta; isFa: boolean }) {
  if (delta.direction === "up") {
    const label = delta.deltaPct === null ? (isFa ? "جدید" : "New") : `+${delta.deltaPct}%`;
    return (
      <span className="inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-emerald-400">
        <TrendingUp className="h-3 w-3 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (delta.direction === "down") {
    return (
      <span className="inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-(--color-accent-red)">
        <TrendingDown className="h-3 w-3 shrink-0" />
        <span>{delta.deltaPct}%</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-(--color-text-tertiary)">
      <Minus className="h-3 w-3 shrink-0" />
      <span>0%</span>
    </span>
  );
}

export default function AdminAnalyticsPage() {
  const { isFa } = useAdminLocale();
  const [rangeDays, setRangeDays] = useState<ProWindowDays>(30);
  const [localeFilter, setLocaleFilter] = useState<LocaleFilter>("all");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive breakdown states
  const [fieldSort, setFieldSort] = useState<FieldSortKey>("views");
  const [searchQuery, setSearchQuery] = useState("");
  const [fieldFilter, setFieldFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState<ArticleHealthFilter>("all");
  const [sortKey, setSortKey] = useState<ArticleSortKey>("views");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (days: ProWindowDays, locale: LocaleFilter) => {
    return adminFetch<AnalyticsPayload>(`/api/admin/analytics?days=${days}&locale=${locale}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAnalytics(rangeDays, localeFilter)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rangeDays, localeFilter, loadAnalytics]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await loadAnalytics(rangeDays, localeFilter);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh analytics");
    } finally {
      setRefreshing(false);
    }
  }

  function handleSelectRange(days: ProWindowDays) {
    if (days === rangeDays) return;
    setRefreshing(true);
    setRangeDays(days);
  }

  function handleSelectLocale(next: LocaleFilter) {
    if (next === localeFilter) return;
    setRefreshing(true);
    setLocaleFilter(next);
  }

  function handleSortColumn(key: ArticleSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedFields = useMemo(() => {
    if (!data) return [];
    return [...data.fieldsMatrix].sort((a, b) => {
      if (fieldSort === "avgViews") return b.avgViews - a.avgViews || b.views - a.views;
      if (fieldSort === "articles") return b.articles - a.articles || b.views - a.views;
      return b.views - a.views || b.articles - a.articles;
    });
  }, [data, fieldSort]);

  const filteredArticles = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    const list = data.articles.filter((a) => {
      if (fieldFilter !== "all" && a.fieldId !== fieldFilter) return false;
      if (healthFilter === "needs_seo" && a.seoPassed === a.seoTotal) return false;
      if (healthFilter === "single_locale" && a.isBilingual) return false;
      if (healthFilter === "featured" && !a.featured) return false;
      if (q) {
        const match =
          a.titleEn.toLowerCase().includes(q) ||
          a.titleFa.toLowerCase().includes(q) ||
          a.slugEn.toLowerCase().includes(q) ||
          a.slugFa.toLowerCase().includes(q) ||
          (a.authorNameEn?.toLowerCase().includes(q) ?? false) ||
          (a.authorNameFa?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let diff = 0;
      if (sortKey === "views") diff = a.views - b.views;
      else if (sortKey === "comments") diff = a.comments - b.comments;
      else if (sortKey === "words") diff = a.words - b.words;
      else if (sortKey === "seo") diff = a.seoPassed - b.seoPassed;
      else if (sortKey === "published") {
        const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        diff = ta - tb;
      }
      return sortDir === "desc" ? -diff : diff;
    });

    return list;
  }, [data, searchQuery, fieldFilter, healthFilter, sortKey, sortDir]);

  function handleExportCsv() {
    if (!data) return;
    const csv = serializeAnalyticsCsv(
      filteredArticles.map((a) => ({
        slug: a.slugEn || a.slugFa,
        titleEn: a.titleEn,
        titleFa: a.titleFa,
        field: a.fieldNameEn || a.fieldNameFa || "",
        author: a.authorNameEn || a.authorNameFa || "",
        status: a.status,
        views: a.views,
        comments: a.comments,
        words: a.words,
        bilingual: a.isBilingual,
        seoPassed: a.seoPassed,
        seoTotal: a.seoTotal,
        publishedAt: a.publishedAt,
      }))
    );
    const stamp = new Date().toISOString().slice(0, 10);
    // Prefix UTF-8 BOM so Persian text opens cleanly in Excel
    triggerFileDownload(`\uFEFF${csv}`, `scienta-analytics-${rangeDays}d-${stamp}.csv`, "text/csv;charset=utf-8");
    setExportNotice(isFa ? "فایل CSV گزارش آماده و دانلود شد." : "CSV analytics report downloaded.");
  }

  function handleExportJson() {
    if (!data) return;
    const stamp = new Date().toISOString().slice(0, 10);
    triggerFileDownload(
      JSON.stringify(data, null, 2),
      `scienta-analytics-${rangeDays}d-${stamp}.json`,
      "application/json;charset=utf-8"
    );
    setExportNotice(isFa ? "فایل JSON کامل آمار دانلود شد." : "Full JSON analytics snapshot downloaded.");
  }

  if (loading && !data) return <AnalyticsSkeleton />;

  if (error && !data) {
    return (
      <div className="rounded-xl border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 p-6">
        <p className="text-sm font-medium text-(--color-accent-red)">{error}</p>
        <button
          type="button"
          onClick={handleRefresh}
          className="mt-3 rounded-lg border border-(--color-border-strong) px-3.5 py-2 text-xs font-medium text-(--color-text-primary) hover:bg-white/[0.05]"
        >
          {isFa ? "تلاش مجدد" : "Retry"}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const maxFieldMetric = Math.max(
    1,
    ...sortedFields.map((f) => (fieldSort === "avgViews" ? f.avgViews : fieldSort === "articles" ? f.articles : f.views))
  );
  const maxArticleViews = Math.max(1, ...data.articles.map((a) => a.views));
  const maxTagViews = Math.max(1, ...data.topTags.map((t) => t.totalViews));

  const useLiveLocaleDonut = data.audience.livePageviewsInRange > 0;
  const localeDonutItems = useLiveLocaleDonut
    ? [
        { id: "fa", label: isFa ? "نسخه فارسی (FA)" : "Persian (FA)", value: data.audience.liveLocales.fa, color: "#7b3ffb" },
        { id: "en", label: isFa ? "نسخه انگلیسی (EN)" : "English (EN)", value: data.audience.liveLocales.en, color: "#ff7a00" },
      ]
    : [
        { id: "fa", label: isFa ? "مشترکین فارسی" : "Persian Subs", value: data.audience.subscriberLocales.fa, color: "#7b3ffb" },
        { id: "en", label: isFa ? "مشترکین انگلیسی" : "English Subs", value: data.audience.subscriberLocales.en, color: "#ff7a00" },
      ];

  const deviceDonutItems = [
    { id: "desktop", label: isFa ? "دسکتاپ" : "Desktop", value: data.audience.devices.desktop, color: "#38bdf8" },
    { id: "mobile", label: isFa ? "موبایل" : "Mobile", value: data.audience.devices.mobile, color: "#7b3ffb" },
    { id: "tablet", label: isFa ? "تبلت" : "Tablet", value: data.audience.devices.tablet, color: "#ff7a00" },
  ];

  const hasActiveTableFilters = searchQuery.trim().length > 0 || fieldFilter !== "all" || healthFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-4 xl:flex-nowrap">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-(--color-text-primary)">
            {isFa ? "مرکز آمار و تحلیل پیشرفته" : "Analytics & Intelligence"}
          </h1>
          <p className="mt-1 text-xs text-(--color-text-tertiary)">
            {isFa
              ? "پایش ترافیک زنده، کارایی حوزه‌های علمی، اثرگذاری نویسندگان و ممیزی سئو"
              : "Live reader telemetry, field efficiency, author impact & real SEO audit"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Timeframe Selector */}
          <div
            role="group"
            aria-label={isFa ? "انتخاب بازه زمانی" : "Analytics timeframe"}
            className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-0.5"
          >
            {([7, 14, 30, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={rangeDays === days}
                onClick={() => handleSelectRange(days)}
                className={`rounded-md px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums transition-colors whitespace-nowrap ${
                  rangeDays === days
                    ? "bg-white/[0.12] text-(--color-text-primary)"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                {isFa ? `${days} روز` : `${days}D`}
              </button>
            ))}
          </div>

          {/* Locale Scope Selector */}
          <div
            role="group"
            aria-label={isFa ? "فیلتر زبان" : "Locale scope"}
            className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-0.5"
          >
            {(
              [
                { id: "all", en: "All", fa: "همه" },
                { id: "fa", en: "FA", fa: "فارسی" },
                { id: "en", en: "EN", fa: "EN" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={localeFilter === opt.id}
                onClick={() => handleSelectLocale(opt.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  localeFilter === opt.id
                    ? "bg-white/[0.12] text-(--color-text-primary)"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                {isFa ? opt.fa : opt.en}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isFa ? "خروجی CSV" : "Export CSV"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            aria-label={isFa ? "دانلود گزارش JSON" : "Export JSON report"}
            title={isFa ? "دانلود گزارش JSON" : "Download full JSON"}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap"
          >
            <FileJson className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={isFa ? "بروزرسانی داده‌ها" : "Refresh analytics"}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-(--color-accent-purple) px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{isFa ? "بروزرسانی" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {exportNotice}
          </span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-xs opacity-75 hover:opacity-100"
          >
            {isFa ? "بستن" : "Dismiss"}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-4 py-2.5 text-xs text-(--color-accent-red)">
          {error}
        </div>
      )}

      {/* Row 1: Unified 4-Cell Executive KPI Strip */}
      <section className="grid divide-y divide-(--color-border-subtle) overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x rtl:lg:divide-x-reverse">
        {/* Cell 1: Reach & Live Views */}
        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "مجموع بازدید و ترافیک زنده" : "Cumulative & Live Reach"}
            </p>
            <DeltaIndicator delta={data.kpis.livePageviewsDelta} isFa={isFa} />
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {data.kpis.totalViews.toLocaleString()}
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `میانگین ${data.kpis.avgViewsPerEssay.toLocaleString()} · زنده ${rangeDays} روز: ${data.kpis.livePageviewsDelta.current.toLocaleString()}`
              : `${data.kpis.avgViewsPerEssay.toLocaleString()} avg/essay · ${data.kpis.livePageviewsDelta.current.toLocaleString()} live (${rangeDays}D)`}
          </p>
        </div>

        {/* Cell 2: Editorial Depth */}
        <div className="border-t border-(--color-border-subtle) p-5 sm:border-t-0 sm:border-s lg:border-s-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "عمق و حجم محتوای علمی" : "Editorial Depth"}
            </p>
            <DeltaIndicator delta={data.kpis.activityDelta} isFa={isFa} />
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            <span dir="ltr" className="inline-block">
              {data.kpis.publishedCount.toLocaleString()}{" "}
              <span className="text-sm font-normal text-(--color-text-tertiary)">
                / {data.kpis.totalArticles.toLocaleString()}
              </span>
            </span>
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `${data.kpis.totalWords.toLocaleString()} واژه · میانگین ${data.kpis.avgReadMinutes} دقیقه مطالعه`
              : `${data.kpis.totalWords.toLocaleString()} words · ${data.kpis.avgReadMinutes}m avg read`}
          </p>
        </div>

        {/* Cell 3: Audience & Community */}
        <div className="border-t border-(--color-border-subtle) p-5 lg:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "مخاطبان و تعامل دیدگاه‌ها" : "Audience & Engagement"}
            </p>
            <DeltaIndicator delta={data.kpis.subscribersDelta} isFa={isFa} />
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {data.kpis.activeSubscribers.toLocaleString()}
            {data.kpis.activeSubscribers + data.kpis.unsubscribedCount > 0 && (
              <span className="ms-1.5 text-sm font-normal text-(--color-text-tertiary)">
                ({data.kpis.retentionPct}%)
              </span>
            )}
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `${data.kpis.totalComments} دیدگاه (${data.kpis.approvalRatePct}% تایید) · پاسخ پرسش ${data.kpis.qaReplyRatePct}%`
              : `${data.kpis.totalComments} comments (${data.kpis.approvalRatePct}% ok) · Q&A ${data.kpis.qaReplyRatePct}%`}
          </p>
        </div>

        {/* Cell 4: Real SEO & Content Health */}
        <div className="border-t border-(--color-border-subtle) p-5 sm:border-s lg:border-t-0 lg:border-s-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "سلامت سئو و پوشش دوزبانه" : "SEO & Metadata Health"}
            </p>
            <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-(--color-text-secondary)">
              {data.kpis.seoReadyPct}%
            </span>
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            <span dir="ltr" className="inline-block">
              {data.kpis.seoFullyReadyCount.toLocaleString()}{" "}
              <span className="text-sm font-normal text-(--color-text-tertiary)">
                / {data.kpis.totalArticles.toLocaleString()}
              </span>
            </span>
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `دوزبانه ${data.kpis.coverage.bilingualPct}% · تصویر کاور ${data.kpis.coverage.coverPct}%`
              : `Bilingual ${data.kpis.coverage.bilingualPct}% · Cover ${data.kpis.coverage.coverPct}%`}
          </p>
        </div>
      </section>

      {/* Row 2: Interactive Time-Series Chart (2 cols) + Audience / Device / Referrer Breakdown (1 col) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <AnalyticsTimeChart trends={data.trends} rangeDays={data.rangeDays} isFa={isFa} />
        </div>

        <section className="flex min-w-0 flex-col justify-between gap-5 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
          <AnalyticsDonutCard
            title={
              useLiveLocaleDonut
                ? isFa
                  ? `تفکیک زبان بازدیدهای ${rangeDays} روزه`
                  : `Reader Locale Split (${rangeDays}D)`
                : isFa
                  ? "تفکیک زبان مشترکین خبرنامه"
                  : "Subscriber Language Split"
            }
            subtitle={
              useLiveLocaleDonut
                ? isFa
                  ? "بر اساس بازدیدهای ثبت‌شده واقعی"
                  : "Based on live tracked article reads"
                : isFa
                  ? "تا زمان ثبت بازدید زنده، بر اساس مشترکین فعال"
                  : "Showing active subscribers until live views arrive"
            }
            items={localeDonutItems}
            centerLabel={useLiveLocaleDonut ? (isFa ? "بازدید" : "views") : isFa ? "مشترک" : "subs"}
            emptyText={isFa ? "هنوز داده‌ای ثبت نشده است." : "No locale data recorded yet."}
            isFa={isFa}
          />

          <div className="border-t border-(--color-border-subtle) pt-4">
            <AnalyticsDonutCard
              title={isFa ? "تفکیک دستگاه خوانندگان" : "Reader Device Split"}
              items={deviceDonutItems}
              centerLabel={isFa ? "نشست" : "reads"}
              emptyText={
                isFa
                  ? "به محض باز شدن مقالات، سهم موبایل و دسکتاپ اینجا نمایش داده می‌شود."
                  : "Mobile vs. desktop breakdown populates automatically as articles are read."
              }
              isFa={isFa}
            />
          </div>

          <div className="border-t border-(--color-border-subtle) pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-(--color-text-primary)">
                {isFa ? "منابع ورودی ترافیک" : "Top Traffic Referrers"}
              </h3>
              <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                {data.audience.livePageviewsInRange.toLocaleString()}
              </span>
            </div>
            {data.audience.topReferrers.length === 0 ? (
              <p className="mt-2 text-xs text-(--color-text-tertiary)">
                {isFa
                  ? "هنوز ورودی زنده‌ای در این بازه ثبت نشده است."
                  : "No live referrers recorded in this window yet."}
              </p>
            ) : (
              <ul className="mt-2.5 space-y-2 text-xs">
                {data.audience.topReferrers.map((ref) => (
                  <li key={ref.host} className="flex items-center justify-between gap-2">
                    <span className="truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)">
                      {ref.host}
                    </span>
                    <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-primary)">
                      {ref.count.toLocaleString()}{" "}
                      <span className="text-(--color-text-tertiary)">({ref.share}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Row 3: Scientific Fields Efficiency Matrix + Author Impact Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scientific Fields Efficiency Matrix */}
        <section className="flex min-w-0 flex-col rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "کارایی حوزه‌های علمی" : "Scientific Fields Efficiency"}
              </h2>
              <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                {isFa
                  ? "مقایسه بازدید کل، میانگین بازدهی هر مقاله و حجم انتشار"
                  : "Compare total reach, average views per essay, and publication volume"}
              </p>
            </div>
            <div
              role="tablist"
              aria-label={isFa ? "مرتب‌سازی حوزه‌های علمی" : "Sort scientific fields"}
              className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-[11px]"
            >
              {(
                [
                  { id: "views", en: "Views", fa: "بازدید کل" },
                  { id: "avgViews", en: "Avg / Essay", fa: "میانگین مقاله" },
                  { id: "articles", en: "Essays", fa: "تعداد مقاله" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={fieldSort === tab.id}
                  onClick={() => setFieldSort(tab.id)}
                  className={`rounded-md px-2 py-1 font-medium transition-colors whitespace-nowrap ${
                    fieldSort === tab.id
                      ? "bg-white/[0.12] text-(--color-text-primary)"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {isFa ? tab.fa : tab.en}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {sortedFields.map((field) => {
              const currentMetric =
                fieldSort === "avgViews"
                  ? field.avgViews
                  : fieldSort === "articles"
                    ? field.articles
                    : field.views;
              const barPct =
                currentMetric > 0 ? Math.max(4, Math.round((currentMetric / maxFieldMetric) * 100)) : 0;

              return (
                <div key={field.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: field.color }}
                      />
                      <span className="truncate font-medium text-(--color-text-primary)">
                        {isFa ? field.nameFa || field.nameEn : field.nameEn}
                      </span>
                    </span>
                    <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                      {field.views.toLocaleString()} {isFa ? "بازدید" : "views"} ·{" "}
                      <span className="text-(--color-text-tertiary)">
                        {field.avgViews.toLocaleString()} {isFa ? "میانگین" : "avg"} · {field.articles}{" "}
                        {isFa ? "مقاله" : "essays"} ({field.viewShare}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${barPct}%`, backgroundColor: field.color }}
                    />
                  </div>
                </div>
              );
            })}
            {sortedFields.length === 0 && (
              <p className="py-8 text-center text-xs text-(--color-text-tertiary)">
                {isFa ? "هنوز حوزه علمی ثبت نشده است." : "No scientific fields found."}
              </p>
            )}
          </div>
        </section>

        {/* Author Impact Leaderboard */}
        <section className="flex min-w-0 flex-col rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)">
          <div className="flex items-center justify-between gap-2 border-b border-(--color-border-subtle) px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "جدول اثرگذاری نویسندگان" : "Author Impact Leaderboard"}
              </h2>
              <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                {isFa
                  ? "رتبه‌بندی نویسندگان بر اساس مجموع بازدید و بازدهی مقالات منتشرشده"
                  : "Ranked by cumulative views, average reach per essay, and discussion"}
              </p>
            </div>
            <Link
              href="/admin/authors"
              className="flex items-center gap-1 text-xs font-medium text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary) whitespace-nowrap"
            >
              <span>{isFa ? "نویسندگان" : "Authors"}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--color-border-subtle) text-[11px] font-medium text-(--color-text-tertiary)">
                  <th className="w-10 px-5 py-2.5 text-start font-medium">#</th>
                  <th className="px-3 py-2.5 text-start font-medium">{isFa ? "نویسنده" : "Author"}</th>
                  <th className="px-3 py-2.5 text-end font-medium">{isFa ? "مقالات" : "Essays"}</th>
                  <th className="hidden px-3 py-2.5 text-end font-medium sm:table-cell">
                    {isFa ? "میانگین" : "Avg"}
                  </th>
                  <th className="px-5 py-2.5 text-end font-medium">{isFa ? "مجموع بازدید" : "Total Views"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border-subtle)">
                {data.authorLeaderboard.slice(0, 8).map((author, idx) => (
                  <tr key={author.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-3">
                      <p className="truncate text-[13px] font-medium text-(--color-text-primary)">
                        {isFa ? author.nameFa || author.nameEn : author.nameEn}
                      </p>
                      <p className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                        {author.words.toLocaleString()} {isFa ? "واژه" : "words"} · {author.comments}{" "}
                        {isFa ? "دیدگاه" : "comments"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-end font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-secondary)">
                      {author.articles}
                    </td>
                    <td className="hidden px-3 py-3 text-end font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary) sm:table-cell">
                      {author.avgViews.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-end font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums text-(--color-text-primary)">
                      {author.views.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {data.authorLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-xs text-(--color-text-tertiary)">
                      {isFa ? "هنوز نویسنده‌ای ثبت نشده است." : "No authors recorded yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Row 4: Full-Width High-Density Article Performance & Real SEO Audit Table */}
      <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "ماتریس عملکرد مقالات و ممیزی سئو" : "Article Performance & SEO Audit Matrix"}
            </h2>
            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
              {isFa
                ? `نمایش ${filteredArticles.length} از ${data.articles.length} مقاله · بررسی ۵ فیلد واقعی پایگاه‌داده (عنوان سئو، توضیحات متا، کاور، چکیده، دوزبانه)`
                : `Showing ${filteredArticles.length} of ${data.articles.length} essays · Auditing 5 real DB fields (SEO title, meta description, cover, excerpt, bilingual)`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--color-text-tertiary)" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={isFa ? "جستجو در مقالات" : "Filter articles by title or author"}
                placeholder={isFa ? "جستجوی عنوان یا نویسنده…" : "Search title, slug, author…"}
                className="h-8 w-48 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) pe-3 ps-8 text-xs text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) focus:outline-none sm:w-56"
              />
            </div>

            {/* Scientific Field Select */}
            <select
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
              aria-label={isFa ? "فیلتر حوزه علمی" : "Filter by scientific field"}
              className="h-8 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-2.5 text-xs text-(--color-text-secondary) focus:border-(--color-accent-purple) focus:outline-none"
            >
              <option value="all">{isFa ? "همه حوزه‌ها" : "All fields"}</option>
              {data.fieldsMatrix.map((f) => (
                <option key={f.id} value={f.id}>
                  {isFa ? f.nameFa || f.nameEn : f.nameEn}
                </option>
              ))}
            </select>

            {/* Health Segmented Filter */}
            <div
              role="group"
              aria-label={isFa ? "فیلتر سلامت مقاله" : "Filter by content health"}
              className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-[11px]"
            >
              {(
                [
                  { id: "all", en: "All", fa: "همه" },
                  { id: "needs_seo", en: "Needs SEO", fa: "نیاز به سئو" },
                  { id: "single_locale", en: "Single-Locale", fa: "تک‌زبانه" },
                  { id: "featured", en: "Featured", fa: "برگزیده" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={healthFilter === f.id}
                  onClick={() => setHealthFilter(f.id)}
                  className={`rounded-md px-2 py-1 font-medium transition-colors whitespace-nowrap ${
                    healthFilter === f.id
                      ? "bg-white/[0.12] text-(--color-text-primary)"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {isFa ? f.fa : f.en}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border-subtle) text-[11px] font-medium text-(--color-text-tertiary)">
                <th className="px-5 py-2.5 text-start font-medium">{isFa ? "مقاله و حوزه" : "Article & Field"}</th>
                <th className="px-3 py-2.5 text-end font-medium">
                  <SortHeaderButton
                    label={isFa ? "بازدید" : "Views"}
                    active={sortKey === "views"}
                    dir={sortDir}
                    onClick={() => handleSortColumn("views")}
                  />
                </th>
                <th className="hidden px-3 py-2.5 text-end font-medium md:table-cell">
                  <SortHeaderButton
                    label={isFa ? "دیدگاه" : "Comments"}
                    active={sortKey === "comments"}
                    dir={sortDir}
                    onClick={() => handleSortColumn("comments")}
                  />
                </th>
                <th className="hidden px-3 py-2.5 text-end font-medium lg:table-cell">
                  <SortHeaderButton
                    label={isFa ? "واژه / مطالعه" : "Words"}
                    active={sortKey === "words"}
                    dir={sortDir}
                    onClick={() => handleSortColumn("words")}
                  />
                </th>
                <th className="px-3 py-2.5 text-start font-medium">
                  <SortHeaderButton
                    label={isFa ? "چک‌لیست سئو" : "SEO Audit"}
                    active={sortKey === "seo"}
                    dir={sortDir}
                    onClick={() => handleSortColumn("seo")}
                  />
                </th>
                <th className="hidden px-3 py-2.5 text-end font-medium xl:table-cell">
                  <SortHeaderButton
                    label={isFa ? "انتشار" : "Published"}
                    active={sortKey === "published"}
                    dir={sortDir}
                    onClick={() => handleSortColumn("published")}
                  />
                </th>
                <th className="w-24 px-5 py-2.5 text-end font-medium">{isFa ? "عملیات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border-subtle)">
              {filteredArticles.map((article) => {
                const title = isFa ? article.titleFa : article.titleEn;
                const fieldLabel = isFa
                  ? article.fieldNameFa || article.fieldNameEn || "—"
                  : article.fieldNameEn || article.fieldNameFa || "—";
                const authorLabel = isFa
                  ? article.authorNameFa || article.authorNameEn
                  : article.authorNameEn || article.authorNameFa;
                const barPct =
                  article.views > 0 ? Math.max(4, Math.round((article.views / maxArticleViews) * 100)) : 0;
                const liveSlug = isFa ? article.slugFa : article.slugEn;
                const liveHref = `/${isFa ? "fa" : "en"}/articles/${liveSlug}`;
                const statusLabel =
                  article.status === "published"
                    ? isFa
                      ? "منتشرشده"
                      : "Published"
                    : article.status === "scheduled"
                      ? isFa
                        ? "زمان‌بندی"
                        : "Scheduled"
                      : isFa
                        ? "پیش‌نویس"
                        : "Draft";
                const seoComplete = article.seoPassed === article.seoTotal;

                return (
                  <tr key={article.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="max-w-xs px-5 py-3">
                      <Link
                        href={`/admin/articles/${article.id}`}
                        className="block truncate text-[13px] font-medium text-(--color-text-primary) hover:text-(--color-accent-purple)"
                      >
                        {title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-(--color-text-tertiary)">
                        <span>{fieldLabel}</span>
                        {authorLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{authorLabel}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            article.status === "published"
                              ? "text-emerald-400"
                              : article.status === "scheduled"
                                ? "text-amber-400"
                                : "text-(--color-text-tertiary)"
                          }
                        >
                          {statusLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-[family-name:var(--font-mono)]">
                          {article.isBilingual ? "FA/EN" : article.hasFa ? "FA" : "EN"}
                        </span>
                      </p>
                    </td>

                    <td className="px-3 py-3 text-end">
                      <div className="flex items-center justify-end gap-2.5">
                        <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${barPct}%`, backgroundColor: article.fieldColor }}
                          />
                        </div>
                        <span className="font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums text-(--color-text-primary)">
                          {article.views.toLocaleString()}
                        </span>
                      </div>
                    </td>

                    <td className="hidden px-3 py-3 text-end font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-secondary) md:table-cell">
                      {article.comments.toLocaleString()}
                    </td>

                    <td className="hidden px-3 py-3 text-end font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary) lg:table-cell">
                      {article.words.toLocaleString()}{" "}
                      <span className="opacity-70">
                        ({article.readMinutes} {isFa ? "دقیقه" : "m"})
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          dir="ltr"
                          className={`font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums ${
                            seoComplete
                              ? "text-emerald-400"
                              : article.seoPassed >= 3
                                ? "text-amber-400"
                                : "text-(--color-accent-red)"
                          }`}
                        >
                          {article.seoPassed}/{article.seoTotal}
                        </span>
                        <span className="max-w-[190px] truncate text-[11px] text-(--color-text-tertiary)">
                          {seoComplete
                            ? isFa
                              ? "تکمیل"
                              : "Complete"
                            : article.seoMissing
                                .map((k) => (isFa ? SEO_MISSING_LABELS[k].fa : SEO_MISSING_LABELS[k].en))
                                .join(" · ")}
                        </span>
                      </div>
                    </td>

                    <td className="hidden whitespace-nowrap px-3 py-3 text-end font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary) xl:table-cell">
                      {formatDateShort(article.publishedAt, isFa)}
                    </td>

                    <td className="px-5 py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/articles/${article.id}`}
                          aria-label={isFa ? `ویرایش ${title}` : `Edit ${title}`}
                          title={isFa ? "ویرایش مقاله" : "Edit article"}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        {article.status === "published" && liveSlug && (
                          <Link
                            href={liveHref}
                            aria-label={isFa ? `مشاهده ${title}` : `Open live ${title}`}
                            title={isFa ? "مشاهده در سایت" : "View live"}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredArticles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <p className="text-xs font-medium text-(--color-text-secondary)">
                      {isFa
                        ? "مقاله‌ای با این فیلترها پیدا نشد."
                        : "No articles match the current filters."}
                    </p>
                    {hasActiveTableFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setFieldFilter("all");
                          setHealthFilter("all");
                        }}
                        className="mt-2 text-xs font-medium text-(--color-accent-purple) hover:underline"
                      >
                        {isFa ? "پاک کردن فیلترها" : "Reset filters"}
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Row 5: 12-Week Cadence Heatmap (7 cols) + Top Tags & Media Storage Audit (5 cols) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <AnalyticsHeatmap
            cells={data.heatmap.cells}
            total={data.heatmap.total}
            peak={data.heatmap.peak}
            activeDays={data.heatmap.activeDays}
            isFa={isFa}
          />
        </div>

        <section className="flex min-w-0 flex-col justify-between gap-5 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5 lg:col-span-5">
          {/* Top Tags Velocity */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "پربازدیدترین برچسب‌های موضوعی" : "Top Topic Tags by Reach"}
              </h2>
              <Link
                href="/admin/tags"
                className="text-xs font-medium text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              >
                {isFa ? "مدیریت" : "Manage"}
              </Link>
            </div>

            {data.topTags.length === 0 ? (
              <p className="mt-3 text-xs text-(--color-text-tertiary)">
                {isFa ? "هنوز برچسبی به مقالات متصل نشده است." : "No tags linked to published essays yet."}
              </p>
            ) : (
              <div className="mt-3.5 space-y-2.5">
                {data.topTags.slice(0, 5).map((tag) => {
                  const pct =
                    tag.totalViews > 0 ? Math.max(5, Math.round((tag.totalViews / maxTagViews) * 100)) : 0;
                  return (
                    <div key={tag.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-(--color-text-secondary)">
                          #{isFa ? tag.nameFa || tag.nameEn : tag.nameEn}
                        </span>
                        <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                          {tag.totalViews.toLocaleString()} · {tag.articleCount} {isFa ? "مقاله" : "essays"}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-(--color-accent-purple)"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Media Storage Footprint + AI API Summary */}
          <div className="space-y-3 border-t border-(--color-border-subtle) pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-(--color-text-primary)">
                <HardDrive className="h-3.5 w-3.5 text-(--color-text-tertiary)" />
                {isFa ? "مصرف فضای رسانه" : "Media Storage Audit"}
              </span>
              <span className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                <span dir="ltr">{formatBytes(data.mediaAudit.totalBytes)}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {data.mediaAudit.totalFiles} {isFa ? "فایل" : "files"}
                </span>
              </span>
            </div>

            {data.mediaAudit.formats.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                {data.mediaAudit.formats.slice(0, 4).map((f) => (
                  <span key={f.format} dir="ltr" className="inline-block">
                    <strong className="font-medium text-(--color-text-secondary)">{f.format}</strong>{" "}
                    {f.count} ({formatBytes(f.bytes)})
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-(--color-text-tertiary)">
                {isFa ? "هنوز رسانه‌ای بارگذاری نشده است." : "No media files uploaded yet."}
              </p>
            )}

            <div className="flex items-center justify-between border-t border-(--color-border-subtle) pt-3 text-[11px] text-(--color-text-tertiary)">
              <span>{isFa ? "درخواست‌های AI & MCP API" : "AI & MCP API Requests"}</span>
              <span className="font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-secondary)">
                {data.kpis.aiTotalRequests.toLocaleString()} · {data.kpis.aiActiveKeys}{" "}
                {isFa ? "کلید فعال" : "active keys"}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SortHeaderButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-medium transition-colors hover:text-(--color-text-primary) ${
        active ? "text-(--color-text-primary)" : "text-(--color-text-tertiary)"
      }`}
    >
      <span>{label}</span>
      {active ? (
        dir === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUp className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded-lg bg-white/[0.06]" />
          <div className="h-3.5 w-96 max-w-full rounded bg-white/[0.04]" />
        </div>
        <div className="h-9 w-80 max-w-full rounded-lg bg-white/[0.06]" />
      </div>
      <div className="grid h-28 grid-cols-1 gap-px overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-border-subtle) sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-(--color-bg-secondary) p-5" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-96 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) lg:col-span-2" />
        <div className="h-96 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
        <div className="h-72 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
      </div>
      <div className="h-80 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
    </div>
  );
}
