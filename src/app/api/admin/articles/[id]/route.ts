import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { generateSlug, stripHtml } from "@/lib/sanitize";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { sanitizeUrl, validateMdxSafety } from "@/lib/security";

const translationSchema = z.object({
  title: z.string().min(3).max(255),
  slug: z.string().min(1).max(255).optional(),
  excerpt: z.string().max(500).optional().default(""),
  content: z.string().min(1).max(250_000),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(320).optional(),
  seoKeywords: z.string().max(500).optional(),
  canonicalUrl: z.string().max(500).optional(),
  twitterCard: z.string().max(30).optional(),
});

const updateArticleSchema = z.object({
  fieldId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  authorId: z.string().uuid().nullable().optional(),
  coverMediaId: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "published", "scheduled"]),
  featured: z.boolean().optional().default(false),
  trending: z.boolean().optional().default(false),
  scheduledAt: z.string().datetime().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional().default([]),
  translations: z.object({ fa: translationSchema, en: translationSchema }),
  revisionNote: z.string().max(255).optional(),
});

interface TranslationRow {
  locale: "fa" | "en";
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  canonical_url: string | null;
  twitter_card: string;
}

async function getFullArticle(id: string) {
  const article = await queryOne<{
    id: string; field_id: string | null; category_id: string | null; author_id: string | null;
    cover_media_id: string | null; cover_path: string | null;
    status: string; featured: number; trending: number; views: number;
    published_at: string | null; scheduled_at: string | null; deleted_at: string | null;
  }>(
    `SELECT a.*, m.path AS cover_path
     FROM articles a
     LEFT JOIN media m ON m.id = a.cover_media_id AND m.deleted_at IS NULL
     WHERE a.id = ?`,
    [id]
  );
  if (!article) return null;

  const translations = await query<TranslationRow>(
    `SELECT locale, title, slug, excerpt, content, seo_title, seo_description, seo_keywords, canonical_url, twitter_card
     FROM article_translations WHERE article_id = ?`,
    [id]
  );
  const tagRows = await query<{ tag_id: string }>(`SELECT tag_id FROM article_tags WHERE article_id = ?`, [id]);

  return {
    ...article,
    translations: Object.fromEntries(translations.map((t) => [t.locale, t])),
    tagIds: tagRows.map((t) => t.tag_id),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireApiAuth("articles.manage");
  if (response) return response;

  const { id } = await params;
  const article = await getFullArticle(id);
  if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
  return NextResponse.json(article);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "articles.manage");
  if (response) return response;

  const { id } = await params;
  const existing = await getFullArticle(id);
  if (!existing) return NextResponse.json({ error: "Article not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateArticleSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid article data", parsed.error.flatten());
  const data = parsed.data;

  const normalizedCanonical: Record<"fa" | "en", string> = { fa: "", en: "" };
  for (const locale of ["fa", "en"] as const) {
    const t = data.translations[locale];
    const safety = validateMdxSafety(t.content);
    if (!safety.safe) {
      return badRequest(`Unsafe MDX content (${locale}): ${safety.reason ?? "Forbidden construct detected."}`);
    }
    if (t.canonicalUrl && t.canonicalUrl.trim()) {
      const safeCanonical = sanitizeUrl(t.canonicalUrl, {
        allowRelative: false,
        allowMailto: false,
        allowHash: false,
      });
      if (!safeCanonical) {
        return badRequest(`Invalid canonical URL (${locale}): must be a valid http(s) URL.`);
      }
      normalizedCanonical[locale] = safeCanonical;
    }
  }

  try {
    await withTransaction(async (conn) => {
      // Snapshot the current content as a revision before overwriting.
      for (const locale of ["fa", "en"] as const) {
        const current = existing.translations[locale];
        if (current) {
          await conn.execute(
            `INSERT INTO article_revisions (id, article_id, locale, title, content, editor_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuid(), id, locale, current.title, current.content, session!.sub, data.revisionNote ?? null]
          );
        }
      }

      const wasPublished = existing.status === "published";
      const nowPublishing = data.status === "published";

      await conn.execute(
        `UPDATE articles SET field_id=?, category_id=?, author_id=?, cover_media_id=?, status=?, featured=?, trending=?, scheduled_at=?,
           published_at = CASE WHEN ? AND NOT ? THEN NOW() ELSE published_at END,
           updated_by=?, updated_at=NOW()
         WHERE id = ?`,
        [
          data.fieldId ?? null, data.categoryId ?? null, data.authorId ?? null,
          data.coverMediaId !== undefined ? data.coverMediaId : existing.cover_media_id,
          data.status,
          data.featured ? 1 : 0, data.trending ? 1 : 0, data.scheduledAt ?? null,
          nowPublishing, wasPublished, session!.sub, id,
        ]
      );

      for (const locale of ["fa", "en"] as const) {
        const t = data.translations[locale];
        const slug = t.slug?.trim() || generateSlug(t.title, locale);
        await conn.execute(
          `UPDATE article_translations SET title=?, slug=?, excerpt=?, content=?, seo_title=?, seo_description=?, seo_keywords=?, canonical_url=?, twitter_card=?
           WHERE article_id = ? AND locale = ?`,
          [
            stripHtml(t.title), slug, t.excerpt ?? "", t.content, t.seoTitle ?? t.title,
            t.seoDescription ?? t.excerpt ?? "", t.seoKeywords ?? "", normalizedCanonical[locale],
            t.twitterCard ?? "summary_large_image", id, locale,
          ]
        );
      }

      await conn.execute(`DELETE FROM article_tags WHERE article_id = ?`, [id]);
      for (const tagId of data.tagIds) {
        await conn.execute(`INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)`, [id, tagId]);
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("uq_locale_slug")) {
      return badRequest("That slug is already in use for one of the locales — please choose a different one.");
    }
    throw err;
  }

  await logActivity({ userId: session!.sub, action: "article.update", entityType: "article", entityId: id, ipAddress: getClientIp(req) });
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "articles.manage");
  if (response) return response;

  const { id } = await params;
  const { execute } = await import("@/lib/db");
  await execute(`UPDATE articles SET deleted_at = NOW() WHERE id = ?`, [id]);
  await logActivity({ userId: session!.sub, action: "article.trash", entityType: "article", entityId: id, ipAddress: getClientIp(req) });
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true });
}
