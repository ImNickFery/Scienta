import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";
import {
  buildDailyTrend,
  buildSubscriberGrowth30d,
  clampTrendDays,
  computeEditorialCoverage,
  computeFieldAnalytics,
} from "@/lib/admin-analytics";
import { ensureApiTablesReady } from "@/lib/ai-api-auth";
import { recordApiMetric } from "@/lib/performance-telemetry";
import { parseSqlUtcDate } from "@/lib/sql-dates";

export async function GET(req: Request) {
  const startedAt = performance.now();
  const { response } = await requireApiAuth("dashboard.view");
  if (response) return response;

  const url = new URL(req.url);
  const rangeDays = clampTrendDays(url.searchParams.get("days"));

  await ensureApiTablesReady();

  const [
    articlesByStatus,
    totals,
    coverageRow,
    commentCounts,
    subscriberByLocale,
    topArticles,
    byFieldRaw,
    recentActivity,
    activityTimestamps,
    subscriberTimestamps,
    recentMessages,
    pendingCommentsList,
    recentDrafts,
    aiApiSummary,
    aiRecentEvents,
  ] = await Promise.all([
    query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count FROM articles WHERE deleted_at IS NULL GROUP BY status`
    ),
    queryOne<{
      views: number;
      authors: number;
      subscribers: number;
      unsubscribed: number;
      new_messages: number;
      media: number;
    }>(
      `SELECT
        (SELECT COALESCE(SUM(views),0) FROM articles WHERE deleted_at IS NULL) AS views,
        (SELECT COUNT(*) FROM authors WHERE deleted_at IS NULL) AS authors,
        (SELECT COUNT(*) FROM subscribers WHERE status='subscribed') AS subscribers,
        (SELECT COUNT(*) FROM subscribers WHERE status='unsubscribed') AS unsubscribed,
        (SELECT COUNT(*) FROM contact_messages WHERE status='new') AS new_messages,
        (SELECT COUNT(*) FROM media WHERE deleted_at IS NULL) AS media`
    ),
    queryOne<{
      total_articles: number;
      with_cover: number;
      bilingual_count: number;
    }>(
      `SELECT
        COUNT(*) AS total_articles,
        SUM(CASE WHEN cover_media_id IS NOT NULL THEN 1 ELSE 0 END) AS with_cover,
        SUM(CASE WHEN (
          SELECT COUNT(DISTINCT locale) FROM article_translations t WHERE t.article_id = articles.id
        ) >= 2 THEN 1 ELSE 0 END) AS bilingual_count
       FROM articles
       WHERE deleted_at IS NULL`
    ),
    query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count FROM comments GROUP BY status`
    ),
    query<{ locale: string; count: number }>(
      `SELECT locale, COUNT(*) AS count FROM subscribers WHERE status='subscribed' GROUP BY locale`
    ),
    query<{
      id: string;
      title: string;
      title_fa: string | null;
      slug: string;
      views: number;
      published_at: string | null;
      field_name: string | null;
      field_name_fa: string | null;
      field_color: string | null;
    }>(
      `SELECT a.id,
              ten.title AS title,
              tfa.title AS title_fa,
              ten.slug,
              a.views,
              a.published_at,
              f.name_en AS field_name,
              f.name_fa AS field_name_fa,
              f.color AS field_color
       FROM articles a
       JOIN article_translations ten ON ten.article_id = a.id AND ten.locale = 'en'
       LEFT JOIN article_translations tfa ON tfa.article_id = a.id AND tfa.locale = 'fa'
       LEFT JOIN fields f ON f.id = a.field_id
       WHERE a.deleted_at IS NULL AND a.status = 'published'
       ORDER BY a.views DESC LIMIT 6`
    ),
    query<{ name: string; name_fa: string; color: string; count: number; views: number }>(
      `SELECT f.name_en AS name, f.name_fa AS name_fa, f.color, COUNT(a.id) AS count, COALESCE(SUM(a.views), 0) AS views
       FROM fields f
       LEFT JOIN articles a ON a.field_id = f.id AND a.deleted_at IS NULL AND a.status='published'
       WHERE f.deleted_at IS NULL
       GROUP BY f.id
       ORDER BY views DESC, count DESC`
    ),
    query<{ id: string; action: string; entity_type: string | null; created_at: string; user_name: string | null }>(
      `SELECT al.id, al.action, al.entity_type, al.created_at, u.name AS user_name
       FROM activity_logs al LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT 20`
    ),
    query<{ created_at: string }>(
      `SELECT created_at FROM activity_logs ORDER BY created_at DESC LIMIT 1000`
    ),
    query<{ created_at: string; status: string; locale: string }>(
      `SELECT created_at, status, locale FROM subscribers ORDER BY created_at DESC LIMIT 5000`
    ),
    query<{ id: string; name: string; subject: string | null; created_at: string }>(
      `SELECT id, name, subject, created_at FROM contact_messages WHERE status='new' ORDER BY created_at DESC LIMIT 5`
    ),
    query<{
      id: string;
      author_name: string;
      body: string;
      created_at: string;
      article_id: string;
      article_title_en: string | null;
      article_title_fa: string | null;
    }>(
      `SELECT c.id, c.name AS author_name, c.content AS body, c.created_at, c.article_id,
              ten.title AS article_title_en,
              tfa.title AS article_title_fa
       FROM comments c
       LEFT JOIN article_translations ten ON ten.article_id = c.article_id AND ten.locale = 'en'
       LEFT JOIN article_translations tfa ON tfa.article_id = c.article_id AND tfa.locale = 'fa'
       WHERE c.status = 'pending'
       ORDER BY c.created_at DESC LIMIT 5`
    ),
    query<{
      id: string;
      status: "draft" | "scheduled";
      updated_at: string;
      scheduled_at: string | null;
      cover_media_id: string | null;
      title_en: string | null;
      title_fa: string | null;
      field_name_en: string | null;
      field_name_fa: string | null;
    }>(
      `SELECT a.id, a.status, a.updated_at, a.scheduled_at, a.cover_media_id,
              ten.title AS title_en,
              tfa.title AS title_fa,
              f.name_en AS field_name_en,
              f.name_fa AS field_name_fa
       FROM articles a
       LEFT JOIN article_translations ten ON ten.article_id = a.id AND ten.locale = 'en'
       LEFT JOIN article_translations tfa ON tfa.article_id = a.id AND tfa.locale = 'fa'
       LEFT JOIN fields f ON f.id = a.field_id
       WHERE a.deleted_at IS NULL AND a.status IN ('draft', 'scheduled')
       ORDER BY a.updated_at DESC LIMIT 5`
    ),
    queryOne<{
      active_keys: number;
      total_keys: number;
      total_requests: number;
      last_used_at: string | null;
    }>(
      `SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_keys,
        COUNT(*) AS total_keys,
        COALESCE(SUM(request_count), 0) AS total_requests,
        MAX(last_used_at) AS last_used_at
       FROM api_keys`
    ).catch(() => null),
    query<{ action: string; created_at: string }>(
      `SELECT action, created_at FROM activity_logs WHERE action LIKE 'api.%' ORDER BY created_at DESC LIMIT 300`
    ).catch(() => []),
  ]);

  const statusCounts = Object.fromEntries(articlesByStatus.map((r) => [r.status, Number(r.count)]));
  const commentStatus = Object.fromEntries(commentCounts.map((r) => [r.status, Number(r.count)]));
  const localeMap = Object.fromEntries(subscriberByLocale.map((r) => [r.locale, Number(r.count)]));

  const pendingComments = commentStatus.pending ?? 0;
  const approvedComments = commentStatus.approved ?? 0;
  const rejectedComments = commentStatus.rejected ?? 0;

  const cutoffMs = Date.now() - rangeDays * 86_400_000;
  let apiEventsInRange = 0;
  let authFailuresInRange = 0;
  for (const ev of aiRecentEvents) {
    const parsedTs = parseSqlUtcDate(ev.created_at);
    if (parsedTs && parsedTs.getTime() >= cutoffMs) {
      if (ev.action === "api.auth.failed") authFailuresInRange += 1;
      else apiEventsInRange += 1;
    }
  }

  const totalArticles =
    (statusCounts.published ?? 0) + (statusCounts.draft ?? 0) + (statusCounts.scheduled ?? 0);

  recordApiMetric({
    route: "/api/admin/dashboard/stats",
    method: "GET",
    status: 200,
    durationMs: performance.now() - startedAt,
    source: "server",
  });

  return NextResponse.json({
    rangeDays,
    articles: {
      total: totalArticles,
      published: statusCounts.published ?? 0,
      draft: statusCounts.draft ?? 0,
      scheduled: statusCounts.scheduled ?? 0,
    },
    totals: {
      views: Number(totals?.views ?? 0),
      authors: Number(totals?.authors ?? 0),
      subscribers: Number(totals?.subscribers ?? 0),
      unsubscribed: Number(totals?.unsubscribed ?? 0),
      new_messages: Number(totals?.new_messages ?? 0),
      media: Number(totals?.media ?? 0),
      pending_comments: pendingComments,
      approved_comments: approvedComments,
      rejected_comments: rejectedComments,
      total_comments: pendingComments + approvedComments + rejectedComments,
    },
    coverage: computeEditorialCoverage({
      totalArticles: Number(coverageRow?.total_articles ?? totalArticles),
      bilingualCount: Number(coverageRow?.bilingual_count ?? 0),
      withCoverCount: Number(coverageRow?.with_cover ?? 0),
    }),
    aiApi: {
      activeKeys: Number(aiApiSummary?.active_keys ?? 0),
      totalKeys: Number(aiApiSummary?.total_keys ?? 0),
      totalRequests: Number(aiApiSummary?.total_requests ?? 0),
      lastUsedAt: aiApiSummary?.last_used_at ?? null,
      apiEventsInRange,
      authFailuresInRange,
    },
    subscriberLocales: {
      fa: localeMap.fa ?? 0,
      en: localeMap.en ?? 0,
    },
    topArticles: topArticles.map((a) => ({
      ...a,
      views: Number(a.views ?? 0),
    })),
    byField: computeFieldAnalytics(
      byFieldRaw.map((f) => ({
        name: f.name,
        nameFa: f.name_fa,
        color: f.color,
        count: Number(f.count ?? 0),
        views: Number(f.views ?? 0),
      }))
    ),
    activityTrend: buildDailyTrend(
      activityTimestamps.map((r) => r.created_at),
      rangeDays
    ),
    subscriberTrend: buildDailyTrend(
      subscriberTimestamps.map((r) => r.created_at),
      rangeDays
    ),
    subscriberGrowth30d: buildSubscriberGrowth30d(subscriberTimestamps, {
      totalActiveOverride: Number(totals?.subscribers ?? 0),
    }),
    pendingCommentsList,
    recentDrafts: recentDrafts.map((d) => ({
      id: d.id,
      status: d.status,
      updated_at: d.updated_at,
      scheduled_at: d.scheduled_at,
      has_cover: Boolean(d.cover_media_id),
      title_en: d.title_en,
      title_fa: d.title_fa,
      field_name_en: d.field_name_en,
      field_name_fa: d.field_name_fa,
    })),
    recentActivity,
    recentMessages,
  });
}
