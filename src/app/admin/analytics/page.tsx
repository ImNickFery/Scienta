"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileJson,
  Filter,
  Globe2,
  Layers,
  Minus,
  MonitorSmartphone,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { useAdminLocale } from "@/components/admin/admin-locale-context";
import { VisitorTrafficChart } from "@/components/admin/analytics/visitor-traffic-chart";
import { VisitorGeoMap } from "@/components/admin/analytics/visitor-geo-map";
import { VisitorAcquisitionPanel } from "@/components/admin/analytics/visitor-acquisition-panel";
import { VisitorTechPanel } from "@/components/admin/analytics/visitor-tech-panel";
import { AnalyticsDonutCard } from "@/components/admin/analytics/analytics-donut-card";
import {
  EditorialContentPanel,
  type AnalyticsArticleRow,
} from "@/components/admin/analytics/editorial-content-panel";
import type { DailyTrendPoint, EditorialCoverageSummary } from "@/lib/admin-analytics";
import {
  serializeAnalyticsCsv,
  type HeatmapCell,
  type PeriodDelta,
  type ProWindowDays,
} from "@/lib/admin-analytics-pro";
import type {
  VisitorFilterCriteria,
  VisitorIntelligenceSummary,
} from "@/lib/visitor-telemetry";

type LocaleFilter = "all" | "fa" | "en";
type WorkspaceTab = "overview" | "geography" | "technology" | "editorial";

interface AnalyticsPayload {
  rangeDays: ProWindowDays;
  localeFilter: LocaleFilter;
  activeFilters?: VisitorFilterCriteria;
  generatedAt: string;
  kpis: {
    totalViews: number;
    avgViewsPerEssay: number;
    livePageviewsDelta: PeriodDelta;
    uniqueVisitorsDelta: PeriodDelta;
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
    visitors: DailyTrendPoint[];
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
  visitorIntelligence: VisitorIntelligenceSummary;
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

const EMPTY_FILTERS: VisitorFilterCriteria = {
  country: null,
  channel: null,
  searchEngine: null,
  browser: null,
  os: null,
  device: null,
};

export default function AdminAnalyticsPage() {
  const { isFa } = useAdminLocale();
  const [workspace, setWorkspace] = useState<WorkspaceTab>("overview");
  const [rangeDays, setRangeDays] = useState<ProWindowDays>(30);
  const [localeFilter, setLocaleFilter] = useState<LocaleFilter>("all");
  const [filters, setFilters] = useState<VisitorFilterCriteria>(EMPTY_FILTERS);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const loadAnalytics = useCallback(
    async (days: ProWindowDays, locale: LocaleFilter, f: VisitorFilterCriteria) => {
      const qs = new URLSearchParams({ days: String(days), locale });
      if (f.country) qs.set("country", f.country);
      if (f.channel) qs.set("channel", f.channel);
      if (f.searchEngine) qs.set("searchEngine", f.searchEngine);
      if (f.browser) qs.set("browser", f.browser);
      if (f.os) qs.set("os", f.os);
      if (f.device) qs.set("device", f.device);
      return adminFetch<AnalyticsPayload>(`/api/admin/analytics?${qs.toString()}`);
    },
    []
  );

  const { country, channel, searchEngine, browser, os, device } = filters;

  useEffect(() => {
    let cancelled = false;
    loadAnalytics(rangeDays, localeFilter, {
      country,
      channel,
      searchEngine,
      browser,
      os,
      device,
    })
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
  }, [rangeDays, localeFilter, country, channel, searchEngine, browser, os, device, loadAnalytics]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await loadAnalytics(rangeDays, localeFilter, filters);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh analytics");
    } finally {
      setRefreshing(false);
    }
  }

  function updateFilter<K extends keyof VisitorFilterCriteria>(key: K, value: string | null) {
    setRefreshing(true);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearAllFilters() {
    setRefreshing(true);
    setFilters(EMPTY_FILTERS);
  }

  function handleExportCsv() {
    if (!data) return;
    const csv = serializeAnalyticsCsv(
      data.articles.map((a) => ({
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
    triggerFileDownload(`\uFEFF${csv}`, `scienta-analytics-${rangeDays}d-${stamp}.csv`, "text/csv;charset=utf-8");
    setExportNotice(isFa ? "فایل CSV گزارش آماده و دانلود شد." : "CSV analytics report downloaded.");
  }

  function handleExportJson() {
    if (!data) return;
    const stamp = new Date().toISOString().slice(0, 10);
    triggerFileDownload(
      JSON.stringify(data, null, 2),
      `scienta-analytics-intelligence-${rangeDays}d-${stamp}.json`,
      "application/json;charset=utf-8"
    );
    setExportNotice(
      isFa ? "گزارش کامل JSON (شامل جغرافیا، مرورگرها و موتورهای جستجو) دانلود شد." : "Full JSON intelligence report downloaded."
    );
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

  const vi = data.visitorIntelligence;
  const topCountry = vi.countries[0] ?? null;
  const topBrowser = vi.browsers[0] ?? null;
  const topOs = vi.operatingSystems[0] ?? null;
  const topEngine = vi.searchEngines[0] ?? null;

  const activeFilterEntries: Array<{ key: keyof VisitorFilterCriteria; label: string; value: string }> = [];
  if (filters.country) {
    const match = vi.countries.find((c) => c.code === filters.country);
    activeFilterEntries.push({
      key: "country",
      label: isFa ? "کشور" : "Country",
      value: match ? `${isFa ? match.nameFa : match.nameEn} (${match.code})` : filters.country,
    });
  }
  if (filters.channel) {
    activeFilterEntries.push({
      key: "channel",
      label: isFa ? "کانال" : "Channel",
      value: filters.channel,
    });
  }
  if (filters.searchEngine) {
    activeFilterEntries.push({
      key: "searchEngine",
      label: isFa ? "موتور جستجو" : "Search Engine",
      value: filters.searchEngine,
    });
  }
  if (filters.browser) {
    activeFilterEntries.push({
      key: "browser",
      label: isFa ? "مرورگر" : "Browser",
      value: filters.browser,
    });
  }
  if (filters.os) {
    activeFilterEntries.push({
      key: "os",
      label: isFa ? "سیستم‌عامل" : "OS",
      value: filters.os,
    });
  }
  if (filters.device) {
    activeFilterEntries.push({
      key: "device",
      label: isFa ? "دستگاه" : "Device",
      value: filters.device,
    });
  }

  const deviceDonutItems = [
    { id: "desktop", label: isFa ? "دسکتاپ" : "Desktop", value: data.audience.devices.desktop, color: "#38bdf8" },
    { id: "mobile", label: isFa ? "موبایل" : "Mobile", value: data.audience.devices.mobile, color: "#8b5cf6" },
    { id: "tablet", label: isFa ? "تبلت" : "Tablet", value: data.audience.devices.tablet, color: "#ff7a00" },
  ];

  const maxOverviewCountry = Math.max(1, ...vi.countries.slice(0, 6).map((c) => c.pageviews));
  const maxOverviewEngine = Math.max(1, ...vi.searchEngines.slice(0, 6).map((e) => e.pageviews));
  const maxOverviewBrowser = Math.max(1, ...vi.browsers.slice(0, 5).map((b) => b.pageviews));
  const maxOverviewOs = Math.max(1, ...vi.operatingSystems.slice(0, 5).map((o) => o.pageviews));

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-4 xl:flex-nowrap">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-(--color-text-primary)">
            {isFa ? "مرکز آمار و هوش مخاطبان" : "Audience Intelligence & Analytics"}
          </h1>
          <p className="mt-1 text-xs text-(--color-text-tertiary)">
            {isFa
              ? "تفکیک دقیق کشورها، موتورهای جستجو و AI، مرورگرها، سیستم‌عامل، دستگاه‌ها و عملکرد محتوا"
              : "Real-time country geo-attribution, search & AI engines, browsers, OS, devices & content telemetry"}
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
                onClick={() => {
                  if (days !== rangeDays) {
                    setRefreshing(true);
                    setRangeDays(days);
                  }
                }}
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
                onClick={() => {
                  if (opt.id !== localeFilter) {
                    setRefreshing(true);
                    setLocaleFilter(opt.id);
                  }
                }}
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
            <span>{isFa ? "CSV" : "CSV"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            aria-label={isFa ? "دانلود گزارش JSON" : "Export JSON report"}
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

      {/* Workspace Navigation Tabs + Active Cross-Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) pb-3">
        <div
          role="tablist"
          aria-label={isFa ? "بخش‌های تحلیلی" : "Analytics workspaces"}
          className="flex flex-wrap items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1 text-xs"
        >
          {(
            [
              { id: "overview", en: "Overview & Traffic", fa: "نمای کلی و ترافیک", Icon: TrendingUp },
              { id: "geography", en: "Geography & Search", fa: "کشورها و موتورهای جستجو", Icon: Globe2 },
              { id: "technology", en: "Browsers, OS & Devices", fa: "مرورگر، سیستم‌عامل و دستگاه", Icon: MonitorSmartphone },
              { id: "editorial", en: "Content, Authors & SEO", fa: "محتوا، نویسندگان و سئو", Icon: Layers },
            ] as const
          ).map(({ id, en, fa, Icon }) => {
            const active = workspace === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setWorkspace(id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{isFa ? fa : en}</span>
              </button>
            );
          })}
        </div>

        {vi.botHitsExcluded > 0 && (
          <p className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `${vi.botHitsExcluded.toLocaleString()} درخواست خزنده/ربات فیلتر شد`
              : `${vi.botHitsExcluded.toLocaleString()} bot/crawler hits filtered`}
          </p>
        )}
      </div>

      {/* Active Interactive Cross-Filter Strip */}
      {activeFilterEntries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--color-accent-purple)/35 bg-(--color-accent-purple)/10 px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-(--color-text-primary)">
              <Filter className="h-3.5 w-3.5 text-(--color-accent-purple)" />
              {isFa ? "فیلترهای فعال:" : "Active slice:"}
            </span>
            {activeFilterEntries.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => updateFilter(entry.key, null)}
                className="inline-flex items-center gap-1.5 rounded-md border border-(--color-accent-purple)/40 bg-(--color-bg-deep) px-2.5 py-1 font-medium text-(--color-text-primary) transition-colors hover:border-(--color-accent-purple)"
              >
                <span className="text-(--color-text-tertiary)">{entry.label}:</span>
                <span>{entry.value}</span>
                <X className="h-3 w-3 text-(--color-text-tertiary)" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clearAllFilters}
            className="font-medium text-(--color-accent-purple) hover:underline whitespace-nowrap"
          >
            {isFa ? "حذف همه فیلترها" : "Reset all filters"}
          </button>
        </div>
      )}

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

      {/* Row 1: Unified 4-Cell Executive Visitor Intelligence KPI Strip */}
      <section className="grid divide-y divide-(--color-border-subtle) overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x rtl:lg:divide-x-reverse">
        {/* Cell 1: Live Visitors & Pageviews */}
        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? `کاربران یکتا و بازدید (${rangeDays} روز)` : `Unique Visitors & Views (${rangeDays}D)`}
            </p>
            <DeltaIndicator delta={data.kpis.uniqueVisitorsDelta} isFa={isFa} />
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {vi.uniqueVisitors.toLocaleString()}
            <span className="ms-2 text-sm font-normal text-(--color-text-tertiary)">
              / {vi.totalPageviews.toLocaleString()} {isFa ? "بازدید" : "views"}
            </span>
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `${vi.viewsPerVisitor} صفحه/کاربر · تک‌صفحه‌ای ${vi.singlePageRatePct}%`
              : `${vi.viewsPerVisitor} pages/visitor · ${vi.singlePageRatePct}% single-page`}
          </p>
        </div>

        {/* Cell 2: Geography & Search Discovery */}
        <div className="border-t border-(--color-border-subtle) p-5 sm:border-t-0 sm:border-s lg:border-s-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "جغرافیا و جستجوی ارگانیک" : "Geography & Search Share"}
            </p>
            <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
              {vi.countriesCount} {isFa ? "کشور" : "countries"}
            </span>
          </div>
          <p className="mt-2 truncate font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {topCountry ? (isFa ? topCountry.nameFa : topCountry.nameEn) : "—"}
            {topCountry && (
              <span className="ms-2 text-sm font-normal text-(--color-text-tertiary)">
                ({topCountry.share}%)
              </span>
            )}
          </p>
          <p className="mt-1.5 truncate font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `جستجو ${vi.organicSearchSharePct}% · AI ${vi.aiSearchSharePct}%${topEngine ? ` · ${topEngine.label}` : ""}`
              : `Search ${vi.organicSearchSharePct}% · AI ${vi.aiSearchSharePct}%${topEngine ? ` · ${topEngine.label}` : ""}`}
          </p>
        </div>

        {/* Cell 3: Browser, OS & Device Mix */}
        <div className="border-t border-(--color-border-subtle) p-5 lg:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "مرورگر، سیستم‌عامل و موبایل" : "Client Stack & Mobile Share"}
            </p>
            <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[#38bdf8]">
              {vi.mobileSharePct}% {isFa ? "موبایل" : "mobile"}
            </span>
          </div>
          <p className="mt-2 truncate font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {topBrowser ? topBrowser.label : "—"}
            {topBrowser && (
              <span className="ms-2 text-sm font-normal text-(--color-text-tertiary)">
                ({topBrowser.share}%)
              </span>
            )}
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {topOs
              ? isFa
                ? `سیستم‌عامل برتر: ${topOs.label} (${topOs.share}%)`
                : `Top OS: ${topOs.label} (${topOs.share}%)`
              : isFa
                ? "در انتظار ثبت نشست‌های زنده"
                : "Awaiting live client sessions"}
          </p>
        </div>

        {/* Cell 4: Editorial Reach & SEO Health */}
        <div className="border-t border-(--color-border-subtle) p-5 sm:border-s lg:border-t-0 lg:border-s-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "بازدید کل مقالات و سلامت سئو" : "Total Essay Reach & SEO"}
            </p>
            <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-emerald-400">
              {data.kpis.seoReadyPct}% SEO
            </span>
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {data.kpis.totalViews.toLocaleString()}
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `${data.kpis.publishedCount} مقاله منتشرشده · ${data.kpis.activeSubscribers} مشترک فعال`
              : `${data.kpis.publishedCount} published · ${data.kpis.activeSubscribers} active subscribers`}
          </p>
        </div>
      </section>

      {/* WORKSPACE 1: OVERVIEW & TRAFFIC */}
      {workspace === "overview" && (
        <div className="space-y-6">
          <VisitorTrafficChart trends={data.trends} rangeDays={data.rangeDays} isFa={isFa} />

          {/* 4-Panel High-Signal Visitor Intelligence Snapshot Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Snapshot 1: Top Countries */}
            <section className="flex min-w-0 flex-col justify-between rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-(--color-accent-purple)" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-(--color-text-primary)">
                      {isFa ? "کشورهای برتر بازدیدکنندگان" : "Top Visitor Countries"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorkspace("geography")}
                    className="inline-flex items-center gap-1 text-xs font-medium text-(--color-accent-purple) hover:underline whitespace-nowrap"
                  >
                    <span>{isFa ? "نقشه و جزئیات" : "Map & details"}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {vi.countries.length === 0 ? (
                  <p className="mt-6 py-6 text-center text-xs text-(--color-text-tertiary)">
                    {isFa ? "هنوز بازدیدی در این بازه ثبت نشده است." : "No country data recorded in this window yet."}
                  </p>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {vi.countries.slice(0, 6).map((c) => {
                      const pct = Math.max(4, Math.round((c.pageviews / maxOverviewCountry) * 100));
                      const active = filters.country === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => updateFilter("country", active ? null : c.code)}
                          className={`block w-full rounded-lg border px-2.5 py-2 text-start transition-colors ${
                            active
                              ? "border-(--color-accent-purple) bg-(--color-accent-purple)/10"
                              : "border-transparent hover:bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="w-6 shrink-0 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-(--color-text-tertiary)">
                                {c.code}
                              </span>
                              <span className="truncate font-medium text-(--color-text-primary)">
                                {isFa ? c.nameFa : c.nameEn}
                              </span>
                              {c.topCity && (
                                <span className="hidden truncate text-[11px] text-(--color-text-tertiary) sm:inline">
                                  · {c.topCity}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                              {c.visitors.toLocaleString()} / {c.pageviews.toLocaleString()} ({c.share}%)
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-(--color-accent-purple)"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Snapshot 2: Search Engines & Acquisition Channels */}
            <section className="flex min-w-0 flex-col justify-between rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-(--color-text-primary)">
                      {isFa ? "موتورهای جستجو و کانال‌های ورودی" : "Search Engines & Traffic Sources"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorkspace("geography")}
                    className="inline-flex items-center gap-1 text-xs font-medium text-(--color-accent-purple) hover:underline whitespace-nowrap"
                  >
                    <span>{isFa ? "تحلیل منابع" : "All sources"}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {vi.searchEngines.length > 0 ? (
                  <div className="mt-4 space-y-2.5">
                    {vi.searchEngines.slice(0, 6).map((eng) => {
                      const pct = Math.max(4, Math.round((eng.pageviews / maxOverviewEngine) * 100));
                      const active = filters.searchEngine === eng.key;
                      return (
                        <button
                          key={eng.key}
                          type="button"
                          onClick={() => updateFilter("searchEngine", active ? null : eng.key)}
                          className={`block w-full rounded-lg border px-2.5 py-2 text-start transition-colors ${
                            active
                              ? "border-(--color-accent-purple) bg-(--color-accent-purple)/10"
                              : "border-transparent hover:bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-(--color-text-primary)">
                              {eng.label}
                              {eng.sublabel && (
                                <span className="ms-1.5 font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary)">
                                  · {eng.sublabel}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                              {eng.pageviews.toLocaleString()} ({eng.share}%)
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-[#38bdf8]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : vi.channels.length > 0 ? (
                  <div className="mt-4 space-y-2.5">
                    {vi.channels.slice(0, 6).map((ch) => (
                      <button
                        key={ch.key}
                        type="button"
                        onClick={() => updateFilter("channel", filters.channel === ch.key ? null : ch.key)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-white/[0.03]"
                      >
                        <span className="font-medium text-(--color-text-primary)">
                          {isFa ? ch.labelFa || ch.label : ch.label}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-secondary)">
                          {ch.pageviews.toLocaleString()} ({ch.share}%)
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-6 py-6 text-center text-xs text-(--color-text-tertiary)">
                    {isFa
                      ? "هنوز ورودی از موتورهای جستجو یا منابع خارجی ثبت نشده است."
                      : "No search engine or referrer visits recorded yet."}
                  </p>
                )}
              </div>
            </section>

            {/* Snapshot 3: Browsers & Operating Systems */}
            <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-(--color-text-primary)">
                  {isFa ? "مرورگرها و سیستم‌عامل‌ها" : "Browsers & Operating Systems"}
                </h2>
                <button
                  type="button"
                  onClick={() => setWorkspace("technology")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-(--color-accent-purple) hover:underline whitespace-nowrap"
                >
                  <span>{isFa ? "نسخه‌ها و جزئیات" : "Versions & stack"}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                {/* Browsers column */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-(--color-text-tertiary)">
                    {isFa ? "مرورگر" : "Browser"}
                  </p>
                  {vi.browsers.length === 0 ? (
                    <p className="text-xs text-(--color-text-tertiary)">—</p>
                  ) : (
                    vi.browsers.slice(0, 5).map((b) => {
                      const pct = Math.max(4, Math.round((b.pageviews / maxOverviewBrowser) * 100));
                      return (
                        <button
                          key={b.key}
                          type="button"
                          onClick={() => updateFilter("browser", filters.browser === b.key ? null : b.key)}
                          className="block w-full text-start hover:opacity-90"
                        >
                          <div className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-(--color-text-primary)">{b.label}</span>
                            <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                              {b.share}%
                            </span>
                          </div>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="h-full rounded-full bg-[#8b5cf6]" style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* OS column */}
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-(--color-text-tertiary)">
                    {isFa ? "سیستم‌عامل" : "Operating System"}
                  </p>
                  {vi.operatingSystems.length === 0 ? (
                    <p className="text-xs text-(--color-text-tertiary)">—</p>
                  ) : (
                    vi.operatingSystems.slice(0, 5).map((o) => {
                      const pct = Math.max(4, Math.round((o.pageviews / maxOverviewOs) * 100));
                      return (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => updateFilter("os", filters.os === o.key ? null : o.key)}
                          className="block w-full text-start hover:opacity-90"
                        >
                          <div className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-(--color-text-primary)">{o.label}</span>
                            <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                              {o.share}%
                            </span>
                          </div>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="h-full rounded-full bg-[#38bdf8]" style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            {/* Snapshot 4: Devices & Top Pages */}
            <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-(--color-text-primary)">
                  {isFa ? "دستگاه‌ها و پربازدیدترین صفحات" : "Devices & Top Pages"}
                </h2>
                <button
                  type="button"
                  onClick={() => setWorkspace("technology")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-(--color-accent-purple) hover:underline whitespace-nowrap"
                >
                  <span>{isFa ? "جزئیات دستگاه‌ها" : "Device details"}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <AnalyticsDonutCard
                  title=""
                  items={deviceDonutItems}
                  centerLabel={isFa ? "بازدید" : "views"}
                  emptyText={isFa ? "هنوز داده‌ای ثبت نشده است." : "No device views yet."}
                  isFa={isFa}
                />

                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-(--color-text-tertiary)">
                    {isFa ? "مسیرهای پربازدید" : "Top Paths"}
                  </p>
                  {vi.topPages.length === 0 ? (
                    <p className="text-xs text-(--color-text-tertiary)">—</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {vi.topPages.slice(0, 5).map((p) => (
                        <li key={p.path} className="flex items-center justify-between gap-2">
                          <span
                            dir="ltr"
                            className="truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)"
                            title={p.path}
                          >
                            {p.path}
                          </span>
                          <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-primary)">
                            {p.pageviews.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* WORKSPACE 2: GEOGRAPHY & ACQUISITION */}
      {workspace === "geography" && (
        <div className="space-y-6">
          <VisitorGeoMap
            countries={vi.countries}
            regions={vi.regions}
            activeCountry={filters.country ?? null}
            onSelectCountry={(code) => updateFilter("country", code)}
            isFa={isFa}
          />
          <VisitorAcquisitionPanel
            channels={vi.channels}
            searchEngines={vi.searchEngines}
            referrers={vi.referrers}
            utmCampaigns={vi.utmCampaigns}
            activeChannel={filters.channel ?? null}
            activeSearchEngine={filters.searchEngine ?? null}
            onSelectChannel={(ch) => updateFilter("channel", ch)}
            onSelectSearchEngine={(eng) => updateFilter("searchEngine", eng)}
            isFa={isFa}
          />
        </div>
      )}

      {/* WORKSPACE 3: BROWSERS, OS & DEVICES */}
      {workspace === "technology" && (
        <VisitorTechPanel
          browsers={vi.browsers}
          browserVersions={vi.browserVersions}
          operatingSystems={vi.operatingSystems}
          osVersions={vi.osVersions}
          devices={vi.devices}
          deviceVendors={vi.deviceVendors}
          screenBuckets={vi.screenBuckets}
          languages={vi.languages}
          topPages={vi.topPages}
          hourlyDistribution={vi.hourlyDistribution}
          recentHits={vi.recentHits}
          activeBrowser={filters.browser ?? null}
          activeOs={filters.os ?? null}
          activeDevice={filters.device ?? null}
          onSelectBrowser={(b) => updateFilter("browser", b)}
          onSelectOs={(o) => updateFilter("os", o)}
          onSelectDevice={(d) => updateFilter("device", d)}
          isFa={isFa}
        />
      )}

      {/* WORKSPACE 4: CONTENT, AUTHORS & SEO */}
      {workspace === "editorial" && (
        <EditorialContentPanel
          fieldsMatrix={data.fieldsMatrix}
          authorLeaderboard={data.authorLeaderboard}
          articles={data.articles}
          topTags={data.topTags}
          mediaAudit={data.mediaAudit}
          heatmap={data.heatmap}
          aiTotalRequests={data.kpis.aiTotalRequests}
          aiActiveKeys={data.kpis.aiActiveKeys}
          isFa={isFa}
        />
      )}
    </div>
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
      <div className="h-10 w-[520px] max-w-full rounded-lg bg-white/[0.05]" />
      <div className="grid h-28 grid-cols-1 gap-px overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-border-subtle) sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-(--color-bg-secondary) p-5" />
        ))}
      </div>
      <div className="h-80 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
        <div className="h-64 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
      </div>
    </div>
  );
}
