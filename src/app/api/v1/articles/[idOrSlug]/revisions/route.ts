import { revalidatePath } from "next/cache";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { query, queryOne, withTransaction } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import {
  authenticateV1Request,
  computeArticleEtag,
  readTextBodyWithLimit,
  v1CorsPreflight,
  v1Error,
  v1Json,
} from "@/lib/ai-api-auth";
import { buildRevisionSnapshotNote, resolveArticleByIdOrSlug } from "@/lib/ai-api-articles";
import { validateMdxCompiles } from "@/lib/ai-api-mdx";

export async function OPTIONS() {
  return v1CorsPreflight();
}

interface RevisionRow {
  id: string;
  locale: "fa" | "en";
  title: string;
  content: string;
  note: string | null;
  editor_name: string | null;
  created_at: string;
}

const restoreRevisionSchema = z.object({
  revisionId: z.string().uuid(),
  note: z.string().max(200).optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const auth = await authenticateV1Request(req, "articles:read");
  if (!auth.ok) return auth.response;

  const { idOrSlug } = await params;
  const article = await resolveArticleByIdOrSlug(idOrSlug);
  if (!article) {
    return v1Error({
      status: 404,
      code: "article_not_found",
      message: `No active article found matching '${idOrSlug}'.`,
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const url = new URL(req.url);
  const includeContent =
    url.searchParams.get("includeContent") === "1" || url.searchParams.get("includeContent") === "true";
  const localeFilter = url.searchParams.get("locale");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 40)));

  const where = ["r.article_id = ?"];
  const sqlParams: unknown[] = [article.id];
  if (localeFilter === "fa" || localeFilter === "en") {
    where.push("r.locale = ?");
    sqlParams.push(localeFilter);
  }

  const rows = await query<RevisionRow>(
    `SELECT r.id, r.locale, r.title, r.content, r.note, u.name AS editor_name, r.created_at
       FROM article_revisions r
       LEFT JOIN users u ON u.id = r.editor_id
      WHERE ${where.join(" AND ")}
      ORDER BY r.created_at DESC
      LIMIT ?`,
    [...sqlParams, limit]
  );

  return v1Json(
    {
      articleId: article.id,
      etag: computeArticleEtag(article.id, article.updated_at),
      items: rows.map((r) => ({
        id: r.id,
        locale: r.locale,
        title: r.title,
        note: r.note,
        editorName: r.editor_name,
        createdAt: r.created_at,
        contentLength: r.content.length,
        ...(includeContent ? { content: r.content } : {}),
      })),
    },
    { requestId: auth.requestId, headers: auth.rateHeaders }
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const auth = await authenticateV1Request(req, "articles:write");
  if (!auth.ok) return auth.response;

  const { idOrSlug } = await params;
  const article = await resolveArticleByIdOrSlug(idOrSlug);
  if (!article) {
    return v1Error({
      status: 404,
      code: "article_not_found",
      message: `No active article found matching '${idOrSlug}'.`,
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const bodyRead = await readTextBodyWithLimit(req, 65_536);
  if (!bodyRead.ok) {
    return v1Error({
      status: 413,
      code: "payload_too_large",
      message: "Request payload too large.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  let body: unknown = null;
  try {
    body = bodyRead.text ? JSON.parse(bodyRead.text) : null;
  } catch {
    return v1Error({
      status: 400,
      code: "invalid_json",
      message: "Request body is not valid JSON.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const parsed = restoreRevisionSchema.safeParse(body);
  if (!parsed.success) {
    return v1Error({
      status: 400,
      code: "validation_error",
      message: "Provide a valid `revisionId` UUID.",
      details: parsed.error.flatten(),
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const targetRevision = await queryOne<RevisionRow>(
    `SELECT id, locale, title, content, note, created_at
       FROM article_revisions
      WHERE id = ? AND article_id = ?
      LIMIT 1`,
    [parsed.data.revisionId, article.id]
  );
  if (!targetRevision) {
    return v1Error({
      status: 404,
      code: "revision_not_found",
      message: `Revision '${parsed.data.revisionId}' does not exist for article '${article.id}'.`,
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  // Ensure restored MDX compiles cleanly under current safety/MDX rules
  const mdxCheck = await validateMdxCompiles({
    content: targetRevision.content,
    locale: targetRevision.locale,
    hasCover: Boolean(article.cover_media_id),
  });
  if (!mdxCheck.ok) {
    return v1Error({
      status: 422,
      code: "mdx_compile_error",
      message: mdxCheck.error?.message ?? "Revision MDX failed compilation check.",
      hint: mdxCheck.error?.hint,
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const currentTr = await queryOne<{ title: string; content: string }>(
    `SELECT title, content FROM article_translations WHERE article_id = ? AND locale = ? LIMIT 1`,
    [article.id, targetRevision.locale]
  );

  const backupNote = buildRevisionSnapshotNote(
    auth.key.name,
    parsed.data.note ?? `Pre-restore backup before restoring revision ${targetRevision.id.slice(0, 8)}`
  );

  await withTransaction(async (conn) => {
    if (currentTr) {
      await conn.execute(
        `INSERT INTO article_revisions (id, article_id, locale, title, content, editor_id, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          article.id,
          targetRevision.locale,
          currentTr.title,
          currentTr.content,
          auth.key.ownerUserId,
          backupNote,
        ]
      );
    }

    await conn.execute(
      `UPDATE article_translations SET title = ?, content = ? WHERE article_id = ? AND locale = ?`,
      [targetRevision.title, targetRevision.content, article.id, targetRevision.locale]
    );

    await conn.execute(`UPDATE articles SET updated_by = ?, updated_at = NOW() WHERE id = ?`, [
      auth.key.ownerUserId,
      article.id,
    ]);
  });

  await logActivity({
    userId: auth.key.ownerUserId,
    action: "api.article.revision_restore",
    entityType: "article",
    entityId: article.id,
    meta: {
      apiKeyId: auth.key.id,
      apiKeyName: auth.key.name,
      restoredRevisionId: targetRevision.id,
      locale: targetRevision.locale,
    },
    ipAddress: auth.ip,
  });

  revalidatePath("/", "layout");

  const updatedRow = await queryOne<{ updated_at: string }>(
    `SELECT updated_at FROM articles WHERE id = ? LIMIT 1`,
    [article.id]
  );
  const nextEtag = computeArticleEtag(article.id, updatedRow?.updated_at ?? new Date().toISOString());

  return v1Json(
    {
      ok: true,
      articleId: article.id,
      etag: nextEtag,
      restored: {
        revisionId: targetRevision.id,
        locale: targetRevision.locale,
        title: targetRevision.title,
        originalCreatedAt: targetRevision.created_at,
      },
      backupNote,
    },
    {
      requestId: auth.requestId,
      headers: { ...auth.rateHeaders, ETag: nextEtag },
    }
  );
}
