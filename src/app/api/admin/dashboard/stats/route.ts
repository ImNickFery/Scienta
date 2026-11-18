import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";

export async function GET() {
  const { response } = await requireApiAuth("dashboard.view");
  if (response) return response;

  const [articlesByStatus, totals, topArticles, byField, recentActivity, recentMessages] = await Promise.all([
    query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count FROM articles WHERE deleted_at IS NULL GROUP BY status`
    ),
    queryOne<{ views: number; authors: number; subscribers: number; new_messages: number; media: number }>(
      `SELECT
        (SELECT COALESCE(SUM(views),0) FROM articles WHERE deleted_at IS NULL) AS views,
        (SELECT COUNT(*) FROM authors WHERE deleted_at IS NULL) AS authors,
        (SELECT COUNT(*) FROM subscribers WHERE status='subscribed') AS subscribers,
        (SELECT COUNT(*) FROM contact_messages WHERE status='new') AS new_messages,
        (SELECT COUNT(*) FROM media WHERE deleted_at IS NULL) AS media`
    ),
    query<{ title: string; slug: string; views: number; locale: string }>(
      `SELECT t.title, t.slug, a.views, t.locale FROM articles a
       JOIN article_translations t ON t.article_id = a.id AND t.locale = 'en'
       WHERE a.deleted_at IS NULL AND a.status = 'published'
       ORDER BY a.views DESC LIMIT 6`
    ),
    query<{ name: string; color: string; count: number }>(
      `SELECT f.name_en AS name, f.color, COUNT(a.id) AS count
       FROM fields f LEFT JOIN articles a ON a.field_id = f.id AND a.deleted_at IS NULL AND a.status='published'
       WHERE f.deleted_at IS NULL GROUP BY f.id ORDER BY count DESC`
    ),
    query<{ id: string; action: string; entity_type: string | null; created_at: string; user_name: string | null }>(
      `SELECT al.id, al.action, al.entity_type, al.created_at, u.name AS user_name
       FROM activity_logs al LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT 10`
    ),
    query<{ id: string; name: string; subject: string | null; created_at: string }>(
      `SELECT id, name, subject, created_at FROM contact_messages WHERE status='new' ORDER BY created_at DESC LIMIT 5`
    ),
  ]);

  const statusCounts = Object.fromEntries(articlesByStatus.map((r) => [r.status, r.count]));

  return NextResponse.json({
    articles: {
      total: (statusCounts.published ?? 0) + (statusCounts.draft ?? 0) + (statusCounts.scheduled ?? 0),
      published: statusCounts.published ?? 0,
      draft: statusCounts.draft ?? 0,
      scheduled: statusCounts.scheduled ?? 0,
    },
    totals,
    topArticles,
    byField,
    recentActivity,
    recentMessages,
  });
}
