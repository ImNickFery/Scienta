import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";
import { isValidCommentStatus } from "@/lib/comments";

interface AdminCommentRow {
  id: string;
  article_id: string;
  article_title: string | null;
  article_slug: string | null;
  locale: string;
  name: string;
  email: string;
  content: string;
  is_question: number;
  admin_reply: string | null;
  replied_at: string | null;
  ip_address: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export async function GET(req: Request) {
  const { response } = await requireApiAuth("comments.manage");
  if (response) return response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 30)));
  const status = url.searchParams.get("status");
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: unknown[] = [];

  if (status && isValidCommentStatus(status)) {
    where.push("c.status = ?");
    params.push(status);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const items = await query<AdminCommentRow>(
    `SELECT c.id, c.article_id, c.locale, c.name, c.email, c.content,
            c.is_question, c.admin_reply, c.replied_at, c.ip_address, c.status, c.created_at,
            COALESCE(t.title, t_fallback.title) AS article_title,
            COALESCE(t.slug, t_fallback.slug) AS article_slug
     FROM comments c
     LEFT JOIN article_translations t ON t.article_id = c.article_id AND t.locale = c.locale
     LEFT JOIN article_translations t_fallback ON t_fallback.article_id = c.article_id AND t_fallback.locale = 'en'
     ${whereSql}
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const countRows = await query<{ status: string; count: number }>(
    `SELECT status, COUNT(*) AS count FROM comments GROUP BY status`
  );
  const counts = { all: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of countRows) {
    const n = Number(row.count ?? 0);
    counts.all += n;
    if (row.status === "pending" || row.status === "approved" || row.status === "rejected") {
      counts[row.status] = n;
    }
  }

  const totalRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM comments c ${whereSql}`,
    params
  );

  return NextResponse.json({
    items,
    counts,
    page,
    pageSize,
    total: Number(totalRow?.count ?? 0),
  });
}
