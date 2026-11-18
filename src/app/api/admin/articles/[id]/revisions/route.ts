import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";

interface RevisionRow {
  id: string;
  locale: "fa" | "en";
  title: string;
  content: string;
  note: string | null;
  created_at: string;
  editor_name: string | null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireApiAuth("articles.manage");
  if (response) return response;

  const { id } = await params;
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") ?? "en";

  const rows = await query<RevisionRow>(
    `SELECT r.id, r.locale, r.title, r.content, r.note, r.created_at, u.name AS editor_name
     FROM article_revisions r LEFT JOIN users u ON u.id = r.editor_id
     WHERE r.article_id = ? AND r.locale = ?
     ORDER BY r.created_at DESC LIMIT 50`,
    [id, locale]
  );

  return NextResponse.json({ items: rows });
}
