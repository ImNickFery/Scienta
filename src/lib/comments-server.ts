import { query } from "./db";
import type { PublicComment } from "@/types";
import type { Locale } from "@/lib/i18n/config";

interface PublicCommentRow {
  id: string;
  article_id: string;
  locale: string | null;
  name: string;
  content: string;
  is_question: number | null;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

export async function getApprovedCommentsForArticle(
  articleId: string,
  locale: Locale
): Promise<PublicComment[]> {
  const rows = await query<PublicCommentRow>(
    `SELECT id, article_id, locale, name, content, is_question, admin_reply, replied_at, created_at
     FROM comments
     WHERE article_id = ? AND status = 'approved' AND locale = ?
     ORDER BY created_at DESC`,
    [articleId, locale]
  );

  return rows.map((r) => ({
    id: r.id,
    articleId: r.article_id,
    locale: r.locale === "en" ? "en" : "fa",
    name: r.name,
    content: r.content,
    isQuestion: Boolean(r.is_question),
    adminReply: r.admin_reply ?? null,
    repliedAt: r.replied_at ?? null,
    createdAt: r.created_at,
  }));
}
