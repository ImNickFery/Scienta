import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";
import { buildDailyTrend, computeFieldAnalytics } from "@/lib/admin-analytics";

export async function GET() {
  const { response } = await requireApiAuth("dashboard.view");
  if (response) return response;

  const [
    articlesByStatus,
    totals,
    commentCounts,
    subscriberByLocale,
    topArticles,
    byFieldRaw,
    recentActivity,
    activityTimestamps,
    subscriberTimestamps,
    recentMessages,
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
    query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count FROM comments GROUP BY status`
    ),
    query<{ locale: string; count: number }>(
      `SELECT locale, COUNT(*) AS count FROM subscribers WHERE status='subscribed' GROUP BY locale`
    ),
    query<{
      id: string;
      title: string;
      slug: string;
      views: number;
      locale: string;
      field_name: string | null;
      field_color: string | null;
    }>(
      `SELECT a.id, t.title, t.slug, a.views, t.locale, f.name_en AS field_name, f.color AS field_color
       FROM articles a
       JOIN article_translations t ON t.article_id = a.id AND t.locale = 'en'
       LEFT JOIN fields f ON f.id = a.field_id
       WHERE a.deleted_at IS NULL AND a.status = 'published'
       ORDER BY a.views DESC LIMIT 6`
    ),
    query<{ name: string; color: string; count: number; views: number }>(
      `SELECT f.name_en AS name, f.color, COUNT(a.id) AS count, COALESCE(SUM(a.views), 0) AS views
       FROM fields f
       LEFT JOIN articles a ON a.field_id = f.id AND a.deleted_at IS NULL AND a.status='published'
       WHERE f.deleted_at IS NULL
       GROUP BY f.id
       ORDER BY views DESC, count DESC`
    ),
    query<{ id: string; action: string; entity_type: string | null; created_at: string; user_name: string | null }>(
      `SELECT al.id, al.action, al.entity_type, al.created_at, u.name AS user_name
       FROM activity_logs al LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT 10`
    ),
    query<{ created_at: string }>(
      `SELECT created_at FROM activity_logs ORDER BY created_at DESC LIMIT 500`
    ),
    query<{ created_at: string }>(
      `SELECT created_at FROM subscribers ORDER BY created_at DESC LIMIT 500`
    ),
    query<{ id: string; name: string; subject: string | null; created_at: string }>(
      `SELECT id, name, subject, created_at FROM contact_messages WHERE status='new' ORDER BY created_at DESC LIMIT 5`
    ),
  ]);

  const statusCounts = Object.fromEntries(articlesByStatus.map((r) => [r.status, Number(r.count)]));
  const commentStatus = Object.fromEntries(commentCounts.map((r) => [r.status, Number(r.count)]));
  const localeMap = Object.fromEntries(subscriberByLocale.map((r) => [r.locale, Number(r.count)]));

  const pendingComments = commentStatus.pending ?? 0;
  const approvedComments = commentStatus.approved ?? 0;
  const rejectedComments = commentStatus.rejected ?? 0;

  return NextResponse.json({
    articles: {
      total: (statusCounts.published ?? 0) + (statusCounts.draft ?? 0) + (statusCounts.scheduled ?? 0),
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
        color: f.color,
        count: Number(f.count ?? 0),
        views: Number(f.views ?? 0),
      }))
    ),
    activityTrend: buildDailyTrend(
      activityTimestamps.map((r) => r.created_at),
      14
    ),
    subscriberTrend: buildDailyTrend(
      subscriberTimestamps.map((r) => r.created_at),
      14
    ),
    recentActivity,
    recentMessages,
  });
}
