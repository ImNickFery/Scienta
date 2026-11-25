import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";
import { computeEmailStats } from "@/lib/email-core";
import {
  ensureEmailSchema,
  getResolvedEmailSettings,
  toPublicEmailSettings,
} from "@/lib/email-service";

export async function GET() {
  const { response } = await requireApiAuth("email.manage");
  if (response) return response;

  await ensureEmailSchema();

  const [
    settingsResolved,
    statusCounts,
    subscriberCounts,
    suppressionRow,
    templateRow,
    campaignRow,
    unreadMsgRow,
    recentLogs,
    recentArticles,
  ] = await Promise.all([
    getResolvedEmailSettings(),
    query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) AS count FROM email_logs GROUP BY status`
    ),
    query<{ locale: string; status: string; count: number }>(
      `SELECT locale, status, COUNT(*) AS count FROM subscribers GROUP BY locale, status`
    ),
    queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM email_suppressions`),
    queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM email_templates`),
    queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM email_campaigns`),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM contact_messages WHERE status = 'new'`
    ),
    query<{
      id: string;
      kind: string;
      recipient_email: string;
      subject: string;
      status: string;
      provider_mode: string;
      created_at: string;
    }>(
      `SELECT id, kind, recipient_email, subject, status, provider_mode, created_at
       FROM email_logs ORDER BY created_at DESC LIMIT 8`
    ),
    query<{
      id: string;
      slug_fa: string | null;
      title_fa: string | null;
      excerpt_fa: string | null;
      slug_en: string | null;
      title_en: string | null;
      excerpt_en: string | null;
    }>(
      `SELECT a.id,
              tfa.slug AS slug_fa, tfa.title AS title_fa, tfa.excerpt AS excerpt_fa,
              ten.slug AS slug_en, ten.title AS title_en, ten.excerpt AS excerpt_en
       FROM articles a
       LEFT JOIN article_translations tfa ON tfa.article_id = a.id AND tfa.locale = 'fa'
       LEFT JOIN article_translations ten ON ten.article_id = a.id AND ten.locale = 'en'
       WHERE a.deleted_at IS NULL AND a.status = 'published'
       ORDER BY COALESCE(a.published_at, a.created_at) DESC
       LIMIT 12`
    ),
  ]);

  const byStatus = { sent: 0, sandbox: 0, failed: 0, suppressed: 0 };
  for (const row of statusCounts) {
    if (row.status in byStatus) {
      byStatus[row.status as keyof typeof byStatus] = Number(row.count) || 0;
    }
  }

  let activeSubscribersAll = 0;
  let activeSubscribersFa = 0;
  let activeSubscribersEn = 0;
  let unsubscribedCount = 0;
  for (const row of subscriberCounts) {
    const n = Number(row.count) || 0;
    if (row.status === "subscribed") {
      activeSubscribersAll += n;
      if (row.locale === "fa") activeSubscribersFa += n;
      if (row.locale === "en") activeSubscribersEn += n;
    } else {
      unsubscribedCount += n;
    }
  }

  const metrics = computeEmailStats(byStatus);

  return NextResponse.json({
    settings: toPublicEmailSettings(settingsResolved),
    stats: {
      ...byStatus,
      ...metrics,
      activeSubscribersAll,
      activeSubscribersFa,
      activeSubscribersEn,
      unsubscribedCount,
      suppressionsCount: Number(suppressionRow?.count ?? 0),
      templatesCount: Number(templateRow?.count ?? 0),
      campaignsCount: Number(campaignRow?.count ?? 0),
      unreadMessagesCount: Number(unreadMsgRow?.count ?? 0),
    },
    recentLogs,
    recentArticles,
  });
}
