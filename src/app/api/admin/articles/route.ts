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

const createArticleSchema = z.object({
  fieldId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  authorId: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  featured: z.boolean().optional().default(false),
  trending: z.boolean().optional().default(false),
  scheduledAt: z.string().datetime().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional().default([]),
  translations: z.object({
    fa: translationSchema,
    en: translationSchema,
  }),
});

interface ArticleListRow {
  id: string;
  status: string;
  featured: number;
  views: number;
  published_at: string | null;
  updated_at: string;
  title_en: string | null;
  title_fa: string | null;
  field_name: string | null;
  author_name: string | null;
}

export async function GET(req: Request) {
  const { response } = await requireApiAuth("articles.manage");
  if (response) return response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
  const status = url.searchParams.get("status");
  const fieldSlug = url.searchParams.get("field");
  const search = url.searchParams.get("search")?.trim();
  const sort = url.searchParams.get("sort") ?? "updated_desc";
  const trashed = url.searchParams.get("trashed") === "1";

  const where: string[] = [trashed ? "a.deleted_at IS NOT NULL" : "a.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (status && ["draft", "published", "scheduled"].includes(status)) {
    where.push("a.status = ?");
    params.push(status);
  }
  if (fieldSlug) {
    where.push("f.slug = ?");
    params.push(fieldSlug);
  }
  if (search) {
    where.push("(ten.title LIKE ? OR tfa.title LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const sortMap: Record<string, string> = {
    updated_desc: "a.updated_at DESC",
    updated_asc: "a.updated_at ASC",
    views_desc: "a.views DESC",
    title_asc: "ten.title ASC",
  };
  const orderBy = sortMap[sort] ?? sortMap.updated_desc;

  const whereClause = where.join(" AND ");
  const offset = (page - 1) * pageSize;

  const rows = await query<ArticleListRow>(
    `SELECT a.id, a.status, a.featured, a.views, a.published_at, a.updated_at,
            ten.title AS title_en, tfa.title AS title_fa,
            f.name_en AS field_name, au.name_en AS author_name
     FROM articles a
     LEFT JOIN article_translations ten ON ten.article_id = a.id AND ten.locale = 'en'
     LEFT JOIN article_translations tfa ON tfa.article_id = a.id AND tfa.locale = 'fa'
     LEFT JOIN fields f ON f.id = a.field_id
     LEFT JOIN authors au ON au.id = a.author_id
     WHERE ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM articles a
     LEFT JOIN article_translations ten ON ten.article_id = a.id AND ten.locale = 'en'
     LEFT JOIN article_translations tfa ON tfa.article_id = a.id AND tfa.locale = 'fa'
     LEFT JOIN fields f ON f.id = a.field_id
     WHERE ${whereClause}`,
    params
  );

  return NextResponse.json({
    items: rows,
    page,
    pageSize,
    total: totalRow?.count ?? 0,
    totalPages: Math.ceil((totalRow?.count ?? 0) / pageSize),
  });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "articles.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createArticleSchema.safeParse(body);
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

  const articleId = uuid();

  try {
    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO articles (id, field_id, category_id, author_id, status, featured, trending, scheduled_at, published_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          articleId,
          data.fieldId ?? null,
          data.categoryId ?? null,
          data.authorId ?? null,
          data.status,
          data.featured ? 1 : 0,
          data.trending ? 1 : 0,
          data.scheduledAt ?? null,
          data.status === "published" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null,
          session!.sub,
          session!.sub,
        ]
      );

      for (const locale of ["fa", "en"] as const) {
        const t = data.translations[locale];
        const slug = t.slug?.trim() || generateSlug(t.title, locale);
        await conn.execute(
          `INSERT INTO article_translations
             (id, article_id, locale, title, slug, excerpt, content, seo_title, seo_description, seo_keywords, canonical_url, twitter_card)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(), articleId, locale, stripHtml(t.title), slug, t.excerpt ?? "", t.content,
            t.seoTitle ?? t.title, t.seoDescription ?? t.excerpt ?? "", t.seoKeywords ?? "",
            normalizedCanonical[locale], t.twitterCard ?? "summary_large_image",
          ]
        );
      }

      for (const tagId of data.tagIds) {
        await conn.execute(`INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)`, [articleId, tagId]);
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("uq_locale_slug")) {
      return badRequest("That slug is already in use for one of the locales — please choose a different one.");
    }
    throw err;
  }

  await logActivity({ userId: session!.sub, action: "article.create", entityType: "article", entityId: articleId, ipAddress: getClientIp(req) });
  revalidatePath("/", "layout");

  return NextResponse.json({ id: articleId }, { status: 201 });
}
