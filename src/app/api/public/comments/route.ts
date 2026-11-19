import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { execute, queryOne } from "@/lib/db";
import { stripHtml } from "@/lib/sanitize";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { validateCommentSubmission } from "@/lib/comments";
import { getApprovedCommentsForArticle } from "@/lib/comments-server";
import { isValidLocale } from "@/lib/i18n/config";
import { sanitizeMathComment, verifySameOrigin } from "@/lib/security";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const articleId = url.searchParams.get("articleId")?.trim() ?? "";
  const rawLocale = url.searchParams.get("locale") ?? "fa";
  const locale = isValidLocale(rawLocale) ? rawLocale : "fa";

  if (!articleId) {
    return NextResponse.json({ error: "articleId is required" }, { status: 400 });
  }

  const items = await getApprovedCommentsForArticle(articleId, locale);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const limit = rateLimit(`comment:${ip}`, 8, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait a few minutes before posting again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const validated = validateCommentSubmission(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { articleId, locale, name, email, content, isQuestion } = validated.data;

  // Verify the target article exists and is publicly accessible
  const article = await queryOne<{ id: string }>(
    `SELECT id FROM articles
     WHERE id = ? AND deleted_at IS NULL
       AND (status = 'published' OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()))
     LIMIT 1`,
    [articleId]
  );
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const id = uuid();
  await execute(
    `INSERT INTO comments (id, article_id, locale, name, email, content, is_question, status, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [id, articleId, locale, stripHtml(name), email, sanitizeMathComment(content), isQuestion ? 1 : 0, ip]
  );

  await logActivity({
    userId: null,
    action: "comment.submit",
    entityType: "comment",
    entityId: id,
    meta: { articleId, locale, isQuestion },
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, id, status: "pending" }, { status: 201 });
}
