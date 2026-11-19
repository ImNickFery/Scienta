"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Newspaper,
  Eye,
  Users,
  Mail,
  Image as ImageIcon,
  FileEdit,
  CalendarClock,
  Activity,
  MessageSquare,
  Plus,
  Download,
  ArrowUpRight,
  BarChart3,
  Layers,
  Globe,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { computePipelineShares, type DailyTrendPoint, type FieldAnalyticsItem } from "@/lib/admin-analytics";

interface DashboardStats {
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
  subscriberLocales: { fa: number; en: number };
  topArticles: {
    id: string;
    title: string;
    slug: string;
    views: number;
    field_name: string | null;
    field_color: string | null;
  }[];
  byField: FieldAnalyticsItem[];
  activityTrend: DailyTrendPoint[];
  subscriberTrend: DailyTrendPoint[];
  recentActivity: { id: string; action: string; entity_type: string | null; created_at: string; user_name: string | null }[];
  recentMessages: { id: string; name: string; subject: string | null; created_at: string }[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  href,
  sublabel,
}: {
  icon: typeof Newspaper;
  label: string;
  value: string | number;
  accent: string;
  href?: string;
  sublabel?: string;
}) {
  const inner = (
    <div className="card-elevated group h-full rounded-2xl p-5 transition-colors hover:border-(--color-border-strong)">
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${accent}22`, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </span>
        {href && (
          <ArrowUpRight className="h-4 w-4 text-(--color-text-tertiary) transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-(--color-text-primary)" />
        )}
      </div>
      <p className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
        {value}
      </p>
      <p className="text-xs text-(--color-text-tertiary)">{label}</p>
      {sublabel && <p className="mt-1 text-[11px] text-(--color-text-secondary)">{sublabel}</p>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none">
        {inner}
      </Link>
    );
  }
  return inner;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldMetric, setFieldMetric] = useState<"views" | "count">("views");

  useEffect(() => {
    adminFetch<DashboardStats>("/api/admin/dashboard/stats")
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-(--color-accent-red)">{error}</p>;
  if (!stats) return <DashboardSkeleton />;

  const maxArticleViews = Math.max(1, ...stats.topArticles.map((a) => a.views));
  const maxActivity = Math.max(1, ...stats.activityTrend.map((d) => d.count));
  const totalActivity14d = stats.activityTrend.reduce((sum, d) => sum + d.count, 0);
  const pipeline = computePipelineShares(stats.articles);
  const totalLocaleSubs = stats.subscriberLocales.fa + stats.subscriberLocales.en;
  const faPct = totalLocaleSubs > 0 ? Math.round((stats.subscriberLocales.fa / totalLocaleSubs) * 100) : 0;
  const enPct = totalLocaleSubs > 0 ? 100 - faPct : 0;

  return (
    <div className="space-y-8">
      {/* Header + Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            Analytics Dashboard
          </h1>
          <p className="text-sm text-(--color-text-tertiary)">
            Editorial performance, scientific field reach, and community moderation overview
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/articles/new"
            className="flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-4 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New Article
          </Link>
          <Link
            href="/admin/comments"
            className="flex h-10 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-accent-purple) hover:text-(--color-text-primary)"
          >
            <MessageSquare className="h-3.5 w-3.5 text-(--color-accent-purple)" />
            Moderate Comments
            {stats.totals.pending_comments > 0 && (
              <span className="rounded-full bg-(--color-accent-orange)/20 px-1.5 py-0.5 text-[10px] font-semibold text-(--color-accent-orange)">
                {stats.totals.pending_comments}
              </span>
            )}
          </Link>
          <a
            href="/api/admin/subscribers/export"
            download
            className="flex h-10 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
          >
            <Download className="h-3.5 w-3.5" /> Export Subscribers CSV
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Newspaper}
          label="Published Articles"
          value={stats.articles.published}
          sublabel={`${stats.articles.total} total in library`}
          accent="#7B3FFB"
          href="/admin/articles"
        />
        <StatCard
          icon={Eye}
          label="Total Article Views"
          value={stats.totals.views.toLocaleString()}
          sublabel={
            stats.articles.published > 0
              ? `~${Math.round(stats.totals.views / stats.articles.published).toLocaleString()} avg / article`
              : undefined
          }
          accent="#FF7A00"
        />
        <StatCard
          icon={MessageSquare}
          label="Pending Comments"
          value={stats.totals.pending_comments}
          sublabel={`${stats.totals.approved_comments} approved · ${stats.totals.total_comments} total`}
          accent="#FF3C5A"
          href="/admin/comments"
        />
        <StatCard
          icon={Users}
          label="Active Subscribers"
          value={stats.totals.subscribers}
          sublabel={`FA: ${stats.subscriberLocales.fa} · EN: ${stats.subscriberLocales.en}`}
          accent="#7B3FFB"
          href="/admin/subscribers"
        />
        <StatCard
          icon={FileEdit}
          label="Drafts"
          value={stats.articles.draft}
          accent="#FF7A00"
          href="/admin/articles"
        />
        <StatCard
          icon={CalendarClock}
          label="Scheduled"
          value={stats.articles.scheduled}
          accent="#FF3C5A"
          href="/admin/articles"
        />
        <StatCard
          icon={Mail}
          label="New Messages"
          value={stats.totals.new_messages}
          accent="#7B3FFB"
          href="/admin/messages"
        />
        <StatCard
          icon={ImageIcon}
          label="Media Assets"
          value={stats.totals.media}
          sublabel={`${stats.totals.authors} active authors`}
          accent="#FF7A00"
          href="/admin/media"
        />
      </div>

      {/* Primary Visual Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Articles Horizontal Bar Chart */}
        <div className="card-elevated rounded-2xl p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-(--color-text-primary)">
                <BarChart3 className="h-4 w-4 text-(--color-accent-purple)" />
                Top Articles by Views
              </h2>
              <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                Most read published essays across Scienta
              </p>
            </div>
            <Link
              href="/admin/articles"
              className="text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            >
              Manage all
            </Link>
          </div>
          <div className="space-y-4">
            {stats.topArticles.map((article, index) => {
              const widthPct = Math.max(6, Math.round((article.views / maxArticleViews) * 100));
              const accent = article.field_color || "#7B3FFB";
              return (
                <div key={article.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/articles/${article.id}`}
                      className="flex min-w-0 items-center gap-2 text-sm text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary)"
                    >
                      <span className="font-[family-name:var(--font-mono)] text-xs text-(--color-text-tertiary)">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate font-medium">{article.title}</span>
                      {article.field_name && (
                        <span className="hidden shrink-0 rounded-md border border-(--color-border-subtle) px-1.5 py-0.5 text-[10px] text-(--color-text-tertiary) sm:inline">
                          {article.field_name}
                        </span>
                      )}
                    </Link>
                    <span className="shrink-0 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary)">
                      {article.views.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        background: `linear-gradient(90deg, ${accent}, #FF7A00)`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {stats.topArticles.length === 0 && (
              <p className="py-6 text-center text-sm text-(--color-text-tertiary)">
                No published articles yet.
              </p>
            )}
          </div>
        </div>

        {/* Scientific Fields Distribution */}
        <div className="card-elevated rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-(--color-text-primary)">
              <Layers className="h-4 w-4 text-(--color-accent-orange)" />
              By Scientific Field
            </h2>
            <div className="flex rounded-lg border border-(--color-border-subtle) bg-black/25 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setFieldMetric("views")}
                className={`rounded-md px-2 py-0.5 transition-colors ${
                  fieldMetric === "views"
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                Views
              </button>
              <button
                type="button"
                onClick={() => setFieldMetric("count")}
                className={`rounded-md px-2 py-0.5 transition-colors ${
                  fieldMetric === "count"
                    ? "bg-(--color-accent-purple) text-white"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                Articles
              </button>
            </div>
          </div>

          <div className="max-h-[300px] space-y-3.5 overflow-y-auto pe-1">
            {stats.byField.map((f) => {
              const pct = fieldMetric === "views" ? f.viewShare : f.articleShare;
              return (
                <div key={f.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />
                      <span className="truncate text-(--color-text-secondary)">{f.name}</span>
                    </span>
                    <span className="shrink-0 font-[family-name:var(--font-mono)] text-(--color-text-tertiary)">
                      {fieldMetric === "views"
                        ? `${f.views.toLocaleString()} (${pct}%)`
                        : `${f.count} (${pct}%)`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(pct > 0 ? 5 : 0, pct)}%`,
                        background: f.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {stats.byField.length === 0 && (
              <p className="text-xs text-(--color-text-tertiary)">No fields configured.</p>
            )}
          </div>
        </div>
      </div>

      {/* 14-Day Activity Chart + Pipeline & Community Health */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 14-Day Platform Activity Chart */}
        <div className="card-elevated rounded-2xl p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-(--color-text-primary)">
                <Activity className="h-4 w-4 text-(--color-accent-purple)" />
                14-Day Editorial &amp; Platform Activity
              </h2>
              <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                Daily recorded CMS &amp; moderation events over the last two weeks
              </p>
            </div>
            <span className="rounded-lg border border-(--color-border-subtle) bg-black/25 px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs text-(--color-text-secondary)">
              {totalActivity14d} events
            </span>
          </div>

          <div
            className="flex h-40 items-end gap-1.5 rounded-xl border border-(--color-border-subtle) bg-black/20 px-3 pt-6 pb-2"
            aria-label="14-day activity bar chart"
          >
            {stats.activityTrend.map((point) => {
              const heightPct = point.count > 0 ? Math.max(12, Math.round((point.count / maxActivity) * 100)) : 4;
              return (
                <div
                  key={point.date}
                  title={`${point.label}: ${point.count} events`}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                >
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary) opacity-0 transition-opacity group-hover:opacity-100">
                    {point.count}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        point.count > 0
                          ? "bg-gradient-to-t from-(--color-accent-purple) to-(--color-accent-orange) opacity-85 group-hover:opacity-100"
                          : "bg-white/[0.07]"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-(--color-text-tertiary)">
            <span>{stats.activityTrend[0]?.label}</span>
            <span>{stats.activityTrend[Math.floor(stats.activityTrend.length / 2)]?.label}</span>
            <span>{stats.activityTrend[stats.activityTrend.length - 1]?.label}</span>
          </div>
        </div>

        {/* Editorial Pipeline & Audience Health */}
        <div className="card-elevated flex flex-col justify-between gap-6 rounded-2xl p-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-(--color-text-primary)">Editorial Pipeline</h2>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
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
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-(--color-text-tertiary)">Published</p>
                <p className="font-semibold text-(--color-accent-purple)">
                  {stats.articles.published} ({pipeline.publishedPct}%)
                </p>
              </div>
              <div>
                <p className="text-(--color-text-tertiary)">Draft</p>
                <p className="font-semibold text-(--color-accent-orange)">
                  {stats.articles.draft} ({pipeline.draftPct}%)
                </p>
              </div>
              <div>
                <p className="text-(--color-text-tertiary)">Scheduled</p>
                <p className="font-semibold text-(--color-accent-red)">
                  {stats.articles.scheduled} ({pipeline.scheduledPct}%)
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-(--color-border-subtle) pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-(--color-text-primary)">
                <MessageSquare className="h-3.5 w-3.5 text-(--color-accent-purple)" />
                Discussion Moderation
              </h3>
              <Link href="/admin/comments" className="text-[11px] text-(--color-accent-purple) hover:underline">
                Open Queue
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-(--color-border-subtle) bg-black/20 p-2">
                <p className="font-bold text-(--color-accent-orange)">{stats.totals.pending_comments}</p>
                <p className="text-[10px] text-(--color-text-tertiary)">Pending</p>
              </div>
              <div className="rounded-lg border border-(--color-border-subtle) bg-black/20 p-2">
                <p className="font-bold text-(--color-accent-purple)">{stats.totals.approved_comments}</p>
                <p className="text-[10px] text-(--color-text-tertiary)">Approved</p>
              </div>
              <div className="rounded-lg border border-(--color-border-subtle) bg-black/20 p-2">
                <p className="font-bold text-(--color-text-secondary)">{stats.totals.rejected_comments}</p>
                <p className="text-[10px] text-(--color-text-tertiary)">Rejected</p>
              </div>
            </div>
          </div>

          <div className="border-t border-(--color-border-subtle) pt-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-(--color-text-primary)">
              <Globe className="h-3.5 w-3.5 text-(--color-accent-orange)" />
              Subscriber Language Split
            </h3>
            <div className="flex items-center justify-between text-xs text-(--color-text-secondary)">
              <span>Persian (FA): {stats.subscriberLocales.fa} ({faPct}%)</span>
              <span>English (EN): {stats.subscriberLocales.en} ({enPct}%)</span>
            </div>
            <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              {faPct > 0 && <div className="h-full bg-(--color-accent-orange)" style={{ width: `${faPct}%` }} />}
              {enPct > 0 && <div className="h-full bg-(--color-accent-purple)" style={{ width: `${enPct}%` }} />}
            </div>
          </div>
        </div>
      </div>

      {/* Activity Feed & Messages */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-elevated rounded-2xl p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-(--color-text-primary)">
            <Activity className="h-4 w-4" /> Recent Activity
          </h2>
          <div className="space-y-3">
            {stats.recentActivity.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-(--color-border-subtle) pb-2.5 text-xs text-(--color-text-tertiary) last:border-0 last:pb-0"
              >
                <div>
                  <span className="font-medium text-(--color-text-secondary)">{log.user_name ?? "System"}</span>
                  <span className="mx-1.5 opacity-40">·</span>
                  <span>{log.action}</span>
                </div>
                <span className="font-[family-name:var(--font-mono)] text-[11px] opacity-65">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
            {stats.recentActivity.length === 0 && (
              <p className="text-sm text-(--color-text-tertiary)">No activity yet.</p>
            )}
          </div>
        </div>

        <div className="card-elevated rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">New Contact Messages</h2>
            <Link href="/admin/messages" className="text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary)">
              View inbox
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recentMessages.map((m) => (
              <Link
                key={m.id}
                href="/admin/messages"
                className="flex items-center justify-between gap-2 border-b border-(--color-border-subtle) pb-2.5 text-xs text-(--color-text-tertiary) last:border-0 last:pb-0 hover:text-(--color-text-primary)"
              >
                <span className="truncate">
                  <span className="font-medium text-(--color-text-secondary)">{m.name}</span> —{" "}
                  {m.subject ?? "(no subject)"}
                </span>
                <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] opacity-65">
                  {new Date(m.created_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
            {stats.recentMessages.length === 0 && (
              <p className="text-sm text-(--color-text-tertiary)">No new messages.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card-elevated h-28 animate-pulse rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-elevated h-64 animate-pulse rounded-2xl lg:col-span-2" />
        <div className="card-elevated h-64 animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
