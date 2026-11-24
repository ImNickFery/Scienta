"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  ArrowUpRight,
  Check,
  X,
  Download,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { useAdminLocale } from "@/components/admin/admin-locale-context";
import { DashboardTrendChart } from "@/components/admin/dashboard-trend-chart";
import { DashboardPerformanceMonitor } from "@/components/admin/dashboard-performance-monitor";
import {
  classifyActivitySource,
  computePipelineShares,
  type ActivityCategory,
  type DailyTrendPoint,
  type EditorialCoverageSummary,
  type FieldAnalyticsItem,
  type TrendWindowDays,
} from "@/lib/admin-analytics";

interface DashboardStats {
  rangeDays: TrendWindowDays;
  articles: { total: number; published: number; draft: number; scheduled: number };
  totals: {
    views: number;
    authors: number;
    subscribers: number;
    unsubscribed: number;
    new_messages: number;
    media: number;
    pending_comments: number;
    approved_comments: number;
    rejected_comments: number;
    total_comments: number;
  };
  coverage: EditorialCoverageSummary;
  aiApi: {
    activeKeys: number;
    totalKeys: number;
    totalRequests: number;
    lastUsedAt: string | null;
    apiEventsInRange: number;
    authFailuresInRange: number;
  };
  subscriberLocales: { fa: number; en: number };
  topArticles: {
    id: string;
    title: string;
    title_fa: string | null;
    slug: string;
    views: number;
    published_at: string | null;
    field_name: string | null;
    field_name_fa: string | null;
    field_color: string | null;
  }[];
  byField: FieldAnalyticsItem[];
  activityTrend: DailyTrendPoint[];
  subscriberTrend: DailyTrendPoint[];
  pendingCommentsList: {
    id: string;
    author_name: string;
    body: string;
    created_at: string;
    article_id: string;
    article_title_en: string | null;
    article_title_fa: string | null;
  }[];
  recentDrafts: {
    id: string;
    status: "draft" | "scheduled";
    updated_at: string;
    scheduled_at: string | null;
    has_cover: boolean;
    title_en: string | null;
    title_fa: string | null;
    field_name_en: string | null;
    field_name_fa: string | null;
  }[];
  recentActivity: {
    id: string;
    action: string;
    entity_type: string | null;
    created_at: string;
    user_name: string | null;
  }[];
  recentMessages: { id: string; name: string; subject: string | null; created_at: string }[];
}

type QueueTab = "comments" | "drafts" | "messages";
type ActivityFilter = "all" | ActivityCategory;

function formatShortDate(raw: string, isFa: boolean) {
  const d = new Date(raw.includes("T") ? raw : `${raw}Z`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(isFa ? "fa-IR" : "en-US", { month: "short", day: "numeric" });
}

function formatDateTime(raw: string, isFa: boolean) {
  const d = new Date(raw.includes("T") ? raw : `${raw}Z`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(isFa ? "fa-IR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatActionLabel(action: string, isFa: boolean): string {
  const map: Record<string, [string, string]> = {
    "article.create": ["Created article", "ایجاد مقاله"],
    "article.update": ["Updated article", "ویرایش مقاله"],
    "article.delete": ["Moved article to trash", "انتقال مقاله به سطل بازیافت"],
    "comment.moderate": ["Moderated comment", "بررسی دیدگاه"],
    "comment.delete": ["Deleted comment", "حذف دیدگاه"],
    "api.article.create": ["AI API created draft", "ایجاد پیش‌نویس با AI API"],
    "api.article.publish": ["AI API published article", "انتشار مقاله با AI API"],
    "api.article.update": ["AI API updated article", "ویرایش مقاله با AI API"],
    "api.article.revision_restore": ["AI API restored revision", "بازگردانی نسخه با AI API"],
    "api.media.upload": ["AI API uploaded media", "آپلود تصویر با AI API"],
    "api.auth.failed": ["Failed API key auth", "تلاش ناموفق احراز کلید API"],
    "api_key.create": ["Created API key", "ساخت کلید API"],
    "api_key.rotate": ["Rotated API key", "چرخش کلید API"],
    "api_key.revoke": ["Revoked API key", "لغو کلید API"],
    "auth.login": ["Admin signed in", "ورود مدیر"],
  };
  const found = map[action];
  if (found) return isFa ? found[1] : found[0];
  return action.replaceAll(".", " · ");
}

export default function DashboardPage() {
  const { isFa } = useAdminLocale();
  const [rangeDays, setRangeDays] = useState<TrendWindowDays>(14);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fieldMetric, setFieldMetric] = useState<"views" | "count">("views");
  const [queueTab, setQueueTab] = useState<QueueTab>("comments");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [perfRefreshNonce, setPerfRefreshNonce] = useState(0);

  const fetchStats = useCallback(async (days: TrendWindowDays) => {
    return adminFetch<DashboardStats>(`/api/admin/dashboard/stats?days=${days}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchStats(rangeDays)
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
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
  }, [rangeDays, fetchStats]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    setPerfRefreshNonce((n) => n + 1);
    try {
      const data = await fetchStats(rangeDays);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh dashboard");
    } finally {
      setRefreshing(false);
    }
  }

  function handleSelectRange(days: TrendWindowDays) {
    if (days === rangeDays) return;
    setRefreshing(true);
    setRangeDays(days);
  }

  async function handleQuickModerate(commentId: string, status: "approved" | "rejected") {
    setModeratingId(commentId);
    setNotice(null);
    try {
      await adminFetch(`/api/admin/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          totals: {
            ...prev.totals,
            pending_comments: Math.max(0, prev.totals.pending_comments - 1),
            approved_comments:
              status === "approved" ? prev.totals.approved_comments + 1 : prev.totals.approved_comments,
            rejected_comments:
              status === "rejected" ? prev.totals.rejected_comments + 1 : prev.totals.rejected_comments,
          },
          pendingCommentsList: prev.pendingCommentsList.filter((c) => c.id !== commentId),
        };
      });
      setNotice(
        status === "approved"
          ? isFa
            ? "دیدگاه تایید و منتشر شد."
            : "Comment approved and published."
          : isFa
            ? "دیدگاه رد شد."
            : "Comment rejected."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update comment");
    } finally {
      setModeratingId(null);
    }
  }

  const filteredActivity = useMemo(() => {
    if (!stats) return [];
    if (activityFilter === "all") return stats.recentActivity;
    return stats.recentActivity.filter((log) => classifyActivitySource(log.action) === activityFilter);
  }, [stats, activityFilter]);

  if (loading && !stats) return <DashboardSkeleton />;

  if (error && !stats) {
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

  if (!stats) return null;

  const avgViewsPerArticle =
    stats.articles.published > 0 ? Math.round(stats.totals.views / stats.articles.published) : 0;
  const maxArticleViews = Math.max(1, ...stats.topArticles.map((a) => a.views));
  const pipeline = computePipelineShares(stats.articles);
  const totalLocaleSubs = stats.subscriberLocales.fa + stats.subscriberLocales.en;
  const faPct = totalLocaleSubs > 0 ? Math.round((stats.subscriberLocales.fa / totalLocaleSubs) * 100) : 0;
  const enPct = totalLocaleSubs > 0 ? 100 - faPct : 0;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-(--color-text-primary)">
            {isFa ? "نمای کلی تحریریه و سامانه" : "Editorial Overview"}
          </h1>
          <p className="mt-1 text-xs text-(--color-text-tertiary)">
            {isFa
              ? "عملکرد مقالات، صف بررسی دیدگاه‌ها، پوشش دوزبانه و وضعیت API هوش مصنوعی"
              : "Live article reach, moderation triage, bilingual coverage, and AI publishing activity"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Timeframe Selector */}
          <div
            role="group"
            aria-label={isFa ? "بازه زمانی نمودار" : "Timeframe window"}
            className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-0.5 text-xs"
          >
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => handleSelectRange(days)}
                className={`rounded-md px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums transition-colors whitespace-nowrap ${
                  rangeDays === days
                    ? "bg-white/[0.1] text-(--color-text-primary)"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                {isFa ? `${days} روز` : `${days}D`}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={isFa ? "بروزرسانی آمار" : "Refresh dashboard"}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{isFa ? "بروزرسانی" : "Refresh"}</span>
          </button>

          <Link
            href="/admin/analytics"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap"
          >
            <BarChart3 className="h-3.5 w-3.5 text-(--color-accent-purple)" />
            <span>{isFa ? "آمار پیشرفته" : "Deep Analytics"}</span>
          </Link>

          <Link
            href="/admin/articles/new"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isFa ? "مقاله جدید" : "New Article"}</span>
          </Link>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
            className="opacity-70 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-4 py-2.5 text-xs text-(--color-accent-red)">
          {error}
        </div>
      )}

      {/* Row 1: Unified 4-Cell Primary KPI Strip (single elevation, hairline dividers) */}
      <section className="grid divide-y divide-(--color-border-subtle) overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x rtl:lg:divide-x-reverse">
        {/* KPI 1: Views */}
        <div className="p-5">
          <p className="text-xs font-medium text-(--color-text-tertiary)">
            {isFa ? "مجموع بازدید مقالات" : "Total Article Views"}
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {stats.totals.views.toLocaleString()}
          </p>
          <p className="mt-1.5 text-xs text-(--color-text-tertiary)">
            {isFa
              ? `میانگین ${avgViewsPerArticle.toLocaleString()} بازدید در هر مقاله`
              : `${avgViewsPerArticle.toLocaleString()} avg per published essay`}
          </p>
        </div>

        {/* KPI 2: Published Library */}
        <Link
          href="/admin/articles"
          className="group block border-t border-(--color-border-subtle) p-5 transition-colors hover:bg-white/[0.02] sm:border-t-0 sm:border-s lg:border-s-0"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "کتابخانه مقالات" : "Published Library"}
            </p>
            <ArrowUpRight className="h-3.5 w-3.5 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-(--color-text-primary)" />
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {stats.articles.published.toLocaleString()}
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `${stats.articles.draft} پیش‌نویس · ${stats.articles.scheduled} زمان‌بندی`
              : `${stats.articles.draft} drafts · ${stats.articles.scheduled} scheduled`}
          </p>
        </Link>

        {/* KPI 3: Active Subscribers */}
        <Link
          href="/admin/subscribers"
          className="group block border-t border-(--color-border-subtle) p-5 transition-colors hover:bg-white/[0.02] lg:border-t-0"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "مشترکین فعال خبرنامه" : "Active Subscribers"}
            </p>
            <ArrowUpRight className="h-3.5 w-3.5 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-(--color-text-primary)" />
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {stats.totals.subscribers.toLocaleString()}
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa ? `فارسی ${faPct}% · انگلیسی ${enPct}%` : `FA ${faPct}% · EN ${enPct}%`}
          </p>
        </Link>

        {/* KPI 4: AI & MCP Publishing API */}
        <Link
          href="/admin/api-keys"
          className="group block border-t border-(--color-border-subtle) p-5 transition-colors hover:bg-white/[0.02] sm:border-s lg:border-t-0 lg:border-s-0"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "درخواست‌های AI & MCP API" : "AI & MCP API Requests"}
            </p>
            <ArrowUpRight className="h-3.5 w-3.5 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-(--color-text-primary)" />
          </div>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {stats.aiApi.totalRequests.toLocaleString()}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-(--color-text-tertiary)">
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {isFa
                ? `${stats.aiApi.activeKeys} کلید فعال`
                : `${stats.aiApi.activeKeys} active keys`}
            </span>
            {stats.aiApi.authFailuresInRange > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.aiApi.authFailuresInRange} {isFa ? "خطای احراز" : "auth alerts"}
                </span>
              </>
            )}
          </p>
        </Link>
      </section>

      {/* Row 2: Focal Trend Chart (2 cols) + Live Editorial Triage Queue (1 col) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <DashboardTrendChart
            activityTrend={stats.activityTrend}
            subscriberTrend={stats.subscriberTrend}
            rangeDays={stats.rangeDays}
            isFa={isFa}
          />
        </div>

        {/* Live Action Queue */}
        <section className="flex min-w-0 flex-col rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "صف کارهای فوری" : "Action Queue"}
            </h2>
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
              {stats.totals.pending_comments + stats.totals.new_messages + stats.articles.draft}{" "}
              {isFa ? "مورد" : "open"}
            </span>
          </div>

          {/* Queue Tabs */}
          <div
            role="tablist"
            aria-label="Action queue tabs"
            className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={queueTab === "comments"}
              onClick={() => setQueueTab("comments")}
              className={`rounded-md px-2 py-1.5 font-medium transition-colors whitespace-nowrap ${
                queueTab === "comments"
                  ? "bg-white/[0.1] text-(--color-text-primary)"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              {isFa ? "دیدگاه‌ها" : "Comments"}{" "}
              <span className="font-[family-name:var(--font-mono)] tabular-nums opacity-75">
                {stats.totals.pending_comments}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={queueTab === "drafts"}
              onClick={() => setQueueTab("drafts")}
              className={`rounded-md px-2 py-1.5 font-medium transition-colors whitespace-nowrap ${
                queueTab === "drafts"
                  ? "bg-white/[0.1] text-(--color-text-primary)"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              {isFa ? "پیش‌نویس" : "Drafts"}{" "}
              <span className="font-[family-name:var(--font-mono)] tabular-nums opacity-75">
                {stats.articles.draft + stats.articles.scheduled}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={queueTab === "messages"}
              onClick={() => setQueueTab("messages")}
              className={`rounded-md px-2 py-1.5 font-medium transition-colors whitespace-nowrap ${
                queueTab === "messages"
                  ? "bg-white/[0.1] text-(--color-text-primary)"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              {isFa ? "پیام‌ها" : "Inbox"}{" "}
              <span className="font-[family-name:var(--font-mono)] tabular-nums opacity-75">
                {stats.totals.new_messages}
              </span>
            </button>
          </div>

          <div className="mt-4 flex-1 divide-y divide-(--color-border-subtle)">
            {queueTab === "comments" && (
              <>
                {stats.pendingCommentsList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-xs font-medium text-(--color-text-secondary)">
                      {isFa ? "همه دیدگاه‌ها بررسی شده‌اند." : "Moderation queue is clear."}
                    </p>
                    <Link
                      href="/admin/comments"
                      className="mt-2 text-xs text-(--color-accent-purple) hover:underline"
                    >
                      {isFa ? "مشاهده آرشیو دیدگاه‌ها" : "View all comments"}
                    </Link>
                  </div>
                ) : (
                  stats.pendingCommentsList.map((c) => (
                    <div key={c.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-(--color-text-primary)">
                            {c.author_name}
                          </p>
                          <p className="truncate text-[11px] text-(--color-text-tertiary)">
                            {isFa
                              ? c.article_title_fa || c.article_title_en || "مقاله"
                              : c.article_title_en || c.article_title_fa || "Article"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={moderatingId === c.id}
                            onClick={() => handleQuickModerate(c.id, "approved")}
                            aria-label={isFa ? `تایید دیدگاه ${c.author_name}` : `Approve comment by ${c.author_name}`}
                            title={isFa ? "تایید" : "Approve"}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-(--color-border-subtle) text-emerald-400 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 disabled:opacity-40"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={moderatingId === c.id}
                            onClick={() => handleQuickModerate(c.id, "rejected")}
                            aria-label={isFa ? `رد دیدگاه ${c.author_name}` : `Reject comment by ${c.author_name}`}
                            title={isFa ? "رد" : "Reject"}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-(--color-border-subtle) text-(--color-accent-red) transition-colors hover:border-(--color-accent-red)/50 hover:bg-(--color-accent-red)/10 disabled:opacity-40"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p
                        dir="auto"
                        className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-(--color-text-secondary)"
                      >
                        {c.body}
                      </p>
                    </div>
                  ))
                )}
              </>
            )}

            {queueTab === "drafts" && (
              <>
                {stats.recentDrafts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-xs font-medium text-(--color-text-secondary)">
                      {isFa ? "پیش‌نویس یا مقاله زمان‌بندی‌شده‌ای نیست." : "No pending drafts or scheduled posts."}
                    </p>
                    <Link
                      href="/admin/articles/new"
                      className="mt-2 text-xs text-(--color-accent-purple) hover:underline"
                    >
                      {isFa ? "ساخت مقاله جدید" : "Start a new article"}
                    </Link>
                  </div>
                ) : (
                  stats.recentDrafts.map((d) => (
                    <Link
                      key={d.id}
                      href={`/admin/articles/${d.id}`}
                      className="block py-3 transition-colors first:pt-0 last:pb-0 hover:text-(--color-text-primary)"
                    >
                      <p className="truncate text-xs font-medium text-(--color-text-primary)">
                        {isFa ? d.title_fa || d.title_en || "بدون عنوان" : d.title_en || d.title_fa || "Untitled"}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-(--color-text-tertiary)">
                        <span
                          className={
                            d.status === "scheduled" ? "text-amber-400" : "text-(--color-text-secondary)"
                          }
                        >
                          {d.status === "scheduled"
                            ? isFa
                              ? "زمان‌بندی‌شده"
                              : "Scheduled"
                            : isFa
                              ? "پیش‌نویس"
                              : "Draft"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {isFa
                            ? d.field_name_fa || d.field_name_en || "عمومی"
                            : d.field_name_en || d.field_name_fa || "General"}
                        </span>
                        {!d.has_cover && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-400">{isFa ? "بدون کاور" : "No cover"}</span>
                          </>
                        )}
                      </p>
                    </Link>
                  ))
                )}
              </>
            )}

            {queueTab === "messages" && (
              <>
                {stats.recentMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-xs font-medium text-(--color-text-secondary)">
                      {isFa ? "پیام خوانده‌نشده‌ای وجود ندارد." : "Inbox is caught up."}
                    </p>
                    <Link
                      href="/admin/messages"
                      className="mt-2 text-xs text-(--color-accent-purple) hover:underline"
                    >
                      {isFa ? "مشاهده صندوق پیام" : "Open message inbox"}
                    </Link>
                  </div>
                ) : (
                  stats.recentMessages.map((m) => (
                    <Link
                      key={m.id}
                      href="/admin/messages"
                      className="flex items-center justify-between gap-2 py-3 text-xs transition-colors first:pt-0 last:pb-0 hover:text-(--color-text-primary)"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-(--color-text-primary)">{m.name}</p>
                        <p className="truncate text-[11px] text-(--color-text-tertiary)">
                          {m.subject || (isFa ? "(بدون موضوع)" : "(no subject)")}
                        </p>
                      </div>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                        {formatShortDate(m.created_at, isFa)}
                      </span>
                    </Link>
                  ))
                )}
              </>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-(--color-border-subtle) pt-3 text-xs">
            <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
              {queueTab === "comments"
                ? isFa
                  ? `${stats.totals.approved_comments.toLocaleString()} تاییدشده · ${stats.totals.rejected_comments.toLocaleString()} ردشده`
                  : `${stats.totals.approved_comments.toLocaleString()} approved · ${stats.totals.rejected_comments.toLocaleString()} rejected`
                : queueTab === "drafts"
                  ? isFa
                    ? `${stats.articles.published.toLocaleString()} منتشرشده`
                    : `${stats.articles.published.toLocaleString()} published total`
                  : isFa
                    ? `${stats.totals.new_messages.toLocaleString()} خوانده‌نشده`
                    : `${stats.totals.new_messages.toLocaleString()} unread`}
            </span>
            <Link
              href={
                queueTab === "comments"
                  ? "/admin/comments"
                  : queueTab === "drafts"
                    ? "/admin/articles"
                    : "/admin/messages"
              }
              className="font-medium text-(--color-accent-purple) transition-opacity hover:opacity-80"
            >
              {queueTab === "comments"
                ? isFa
                  ? "همه دیدگاه‌ها"
                  : "All comments"
                : queueTab === "drafts"
                  ? isFa
                    ? "همه مقالات"
                    : "All articles"
                  : isFa
                    ? "صندوق پیام"
                    : "Open inbox"}
            </Link>
          </div>
        </section>
      </div>

      {/* Row 2.5: Live Performance Monitoring (API Response Times & Page Load Telemetry) */}
      <DashboardPerformanceMonitor isFa={isFa} refreshNonce={perfRefreshNonce} />

      {/* Row 3: Top Articles Data Table (2 cols) + Field Share & Library Coverage (1 col) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Articles Compact Data Table */}
        <section className="min-w-0 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) lg:col-span-2">
          <div className="flex items-center justify-between border-b border-(--color-border-subtle) px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "پربازدیدترین مقالات منتشرشده" : "Top Published Articles"}
              </h2>
              <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                {isFa ? "رتبه‌بندی بر اساس مجموع بازدید خوانندگان" : "Ranked by cumulative reader views"}
              </p>
            </div>
            <Link
              href="/admin/articles"
              className="text-xs font-medium text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary) whitespace-nowrap"
            >
              {isFa ? "مدیریت همه مقالات" : "Manage all"}
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--color-border-subtle) text-[11px] font-medium text-(--color-text-tertiary)">
                  <th className="w-10 px-5 py-2.5 text-start font-medium">#</th>
                  <th className="px-3 py-2.5 text-start font-medium">{isFa ? "عنوان مقاله" : "Article"}</th>
                  <th className="hidden px-3 py-2.5 text-start font-medium sm:table-cell">
                    {isFa ? "حوزه علمی" : "Field"}
                  </th>
                  <th className="w-40 px-5 py-2.5 text-end font-medium">{isFa ? "بازدید" : "Views"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border-subtle)">
                {stats.topArticles.map((article, idx) => {
                  const pct = Math.max(4, Math.round((article.views / maxArticleViews) * 100));
                  const title = isFa ? article.title_fa || article.title : article.title;
                  const fieldLabel = isFa
                    ? article.field_name_fa || article.field_name
                    : article.field_name;
                  return (
                    <tr key={article.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="max-w-xs px-3 py-3">
                        <Link
                          href={`/admin/articles/${article.id}`}
                          className="block truncate text-[13px] font-medium text-(--color-text-primary) hover:text-(--color-accent-purple)"
                        >
                          {title}
                        </Link>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-xs text-(--color-text-tertiary) sm:table-cell">
                        {fieldLabel ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-end">
                        <div className="flex items-center justify-end gap-3">
                          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.07] sm:block">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: article.field_color || "#7b3ffb",
                              }}
                            />
                          </div>
                          <span className="font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-text-primary)">
                            {article.views.toLocaleString()}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {stats.topArticles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-xs text-(--color-text-tertiary)">
                      {isFa ? "هنوز مقاله منتشرشده‌ای وجود ندارد." : "No published articles yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Scientific Field Distribution + Editorial Coverage */}
        <section className="flex min-w-0 flex-col justify-between gap-6 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "سهم حوزه‌های علمی" : "By Scientific Field"}
              </h2>
              <div className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFieldMetric("views")}
                  className={`rounded-md px-2 py-1 font-medium transition-colors ${
                    fieldMetric === "views"
                      ? "bg-white/[0.1] text-(--color-text-primary)"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {isFa ? "بازدید" : "Views"}
                </button>
                <button
                  type="button"
                  onClick={() => setFieldMetric("count")}
                  className={`rounded-md px-2 py-1 font-medium transition-colors ${
                    fieldMetric === "count"
                      ? "bg-white/[0.1] text-(--color-text-primary)"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {isFa ? "مقالات" : "Articles"}
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {stats.byField.slice(0, 6).map((f) => {
                const pct = fieldMetric === "views" ? f.viewShare : f.articleShare;
                return (
                  <div key={f.name} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-(--color-text-secondary)">
                        {isFa ? f.nameFa || f.name : f.name}
                      </span>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                        {fieldMetric === "views"
                          ? `${f.views.toLocaleString()} · ${pct}%`
                          : `${f.count} · ${pct}%`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%`, backgroundColor: f.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Editorial Pipeline & Real DB Coverage Metrics */}
          <div className="space-y-3 border-t border-(--color-border-subtle) pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-(--color-text-primary)">
                {isFa ? "پوشش و سلامت آرشیو" : "Library Coverage"}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                {isFa
                  ? `${stats.totals.media} رسانه · ${stats.totals.authors} نویسنده`
                  : `${stats.totals.media} media · ${stats.totals.authors} authors`}
              </span>
            </div>

            <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              {pipeline.publishedPct > 0 && (
                <div
                  className="h-full bg-(--color-accent-purple)"
                  style={{ width: `${pipeline.publishedPct}%` }}
                  title={`Published: ${stats.articles.published}`}
                />
              )}
              {pipeline.draftPct > 0 && (
                <div
                  className="h-full bg-(--color-accent-orange)"
                  style={{ width: `${pipeline.draftPct}%` }}
                  title={`Draft: ${stats.articles.draft}`}
                />
              )}
              {pipeline.scheduledPct > 0 && (
                <div
                  className="h-full bg-(--color-accent-red)"
                  style={{ width: `${pipeline.scheduledPct}%` }}
                  title={`Scheduled: ${stats.articles.scheduled}`}
                />
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 text-xs">
              <div>
                <dt className="text-(--color-text-tertiary)">
                  {isFa ? "پوشش دوزبانه (FA/EN)" : "Bilingual Parity"}
                </dt>
                <dd className="mt-0.5 font-[family-name:var(--font-mono)] font-semibold tabular-nums text-(--color-text-primary)">
                  {stats.coverage.bilingualPct}%
                </dd>
              </div>
              <div>
                <dt className="text-(--color-text-tertiary)">
                  {isFa ? "مقالات دارای تصویر کاور" : "Cover Imagery"}
                </dt>
                <dd className="mt-0.5 font-[family-name:var(--font-mono)] font-semibold tabular-nums text-(--color-text-primary)">
                  {stats.coverage.coverPct}%
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      {/* Row 4: Filterable Audit Activity Feed + Exports */}
      <section className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "رویدادهای اخیر سامانه" : "Recent Activity"}
            </h2>
            <div
              role="tablist"
              aria-label="Filter activity stream"
              className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-[11px]"
            >
              {(
                [
                  { id: "all", en: "All", fa: "همه" },
                  { id: "editorial", en: "Editorial", fa: "تحریریه" },
                  { id: "ai_api", en: "AI API", fa: "AI API" },
                  { id: "moderation", en: "Moderation", fa: "تعاملات" },
                  { id: "security", en: "Security", fa: "امنیت" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activityFilter === tab.id}
                  onClick={() => setActivityFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                    activityFilter === tab.id
                      ? "bg-white/[0.1] text-(--color-text-primary)"
                      : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                  }`}
                >
                  {isFa ? tab.fa : tab.en}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <a
              href="/api/admin/subscribers/export"
              download
              className="inline-flex items-center gap-1.5 text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary) whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isFa ? "خروجی CSV مشترکین" : "Export Subscribers CSV"}</span>
            </a>
            <span className="text-(--color-border-strong)" aria-hidden="true">
              |
            </span>
            <Link
              href="/admin/logs"
              className="font-medium text-(--color-accent-purple) hover:underline whitespace-nowrap"
            >
              {isFa ? "گزارش کامل" : "Full audit log"}
            </Link>
          </div>
        </div>

        <div className="divide-y divide-(--color-border-subtle)">
          {filteredActivity.slice(0, 8).map((log) => {
            const cat = classifyActivitySource(log.action);
            const catText =
              cat === "ai_api"
                ? "AI API"
                : cat === "security"
                  ? isFa
                    ? "امنیت"
                    : "Security"
                  : cat === "moderation"
                    ? isFa
                      ? "تعاملات"
                      : "Moderation"
                    : isFa
                      ? "تحریریه"
                      : "Editorial";
            return (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-(--color-text-primary)">
                    {log.user_name ?? (isFa ? "سامانه" : "System")}
                  </span>
                  <span className="text-(--color-text-tertiary)" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-(--color-text-secondary)">
                    {formatActionLabel(log.action, isFa)}
                  </span>
                  <span className="text-(--color-text-tertiary)" aria-hidden="true">
                    ·
                  </span>
                  <span
                    className={
                      cat === "security"
                        ? "text-amber-400"
                        : cat === "ai_api"
                          ? "text-(--color-accent-purple)"
                          : "text-(--color-text-tertiary)"
                    }
                  >
                    {catText}
                  </span>
                </div>
                <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                  {formatDateTime(log.created_at, isFa)}
                </span>
              </div>
            );
          })}
          {filteredActivity.length === 0 && (
            <p className="px-5 py-8 text-center text-xs text-(--color-text-tertiary)">
              {isFa
                ? "رویدادی در این فیلتر ثبت نشده است."
                : "No recent events match this filter."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-9 w-64 animate-pulse rounded-lg bg-white/[0.06]" />
      </div>
      <div className="grid h-28 animate-pulse rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) lg:grid-cols-4" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)" />
      </div>
    </div>
  );
}
