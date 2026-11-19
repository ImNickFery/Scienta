import { revalidatePath } from "next/cache";
import { v4 as uuid } from "uuid";
import { hashToken } from "@/lib/auth";
import { query, queryOne, withTransaction } from "@/lib/db";
import { stripHtml } from "@/lib/sanitize";
import { logActivity } from "@/lib/activity-log";
import {
  authenticateV1Request,
  computeArticleEtag,
  getPublicOrigin,
  hasScope,
  readIdempotencyRecord,
  readTextBodyWithLimit,
  v1CorsPreflight,
  v1Error,
  v1Json,
  writeIdempotencyRecord,
} from "@/lib/ai-api-auth";
import {
  aiCreateArticleSchema,
  buildArticleMetrics,
  normalizeAiArticleTranslations,
  resolveAndCreateTagIds,
  resolveAuthorId,
  resolveCategoryId,
  resolveFieldId,
  resolveUniqueSlug,
} from "@/lib/ai-api-articles";
import { fetchSafeRemoteImage, ingestImageBuffer, validateExternalImageUrl } from "@/lib/ai-api-media";
import { validateMdxCompiles } from "@/lib/ai-api-mdx";

export async function OPTIONS() {
  return v1CorsPreflight();
}

interface ArticleListRow {
  id: string;
  status: string;
  featured: number;
  trending: number;
  views: number;
  published_at: string | null;
  updated_at: string;
  title_en: string | null;
  slug_en: string | null;
  title_fa: string | null;
  slug_fa: string | null;
  field_slug: string | null;
  category_slug: string | null;
  author_slug: string | null;
  cover_path: string | null;
}

export async function GET(req: Request) {
  const auth = await authenticateV1Request(req, "articles:read");
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
  const status = url.searchParams.get("status");
  const fieldSlug = url.searchParams.get("field");
  const search = url.searchParams.get("search")?.trim();
  const offset = (page - 1) * pageSize;

  const where: string[] = ["a.deleted_at IS NULL"];
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
    where.push("(ten.title LIKE ? OR tfa.title LIKE ? OR ten.slug LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = where.join(" AND ");
  const rows = await query<ArticleListRow>(
    `SELECT a.id, a.status, a.featured, a.trending, a.views, a.published_at, a.updated_at,
            ten.title AS title_en, ten.slug AS slug_en,
            tfa.title AS title_fa, tfa.slug AS slug_fa,
            f.slug AS field_slug, c.slug AS category_slug, au.slug AS author_slug,
            m.path AS cover_path
       FROM articles a
       LEFT JOIN article_translations ten ON ten.article_id = a.id AND ten.locale = 'en'
       LEFT JOIN article_translations tfa ON tfa.article_id = a.id AND tfa.locale = 'fa'
       LEFT JOIN fields f ON f.id = a.field_id
       LEFT JOIN categories c ON c.id = a.category_id
       LEFT JOIN authors au ON au.id = a.author_id
       LEFT JOIN media m ON m.id = a.cover_media_id AND m.deleted_at IS NULL
      WHERE ${whereClause}
      ORDER BY a.updated_at DESC
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

  const origin = getPublicOrigin(req);
  const total = Number(totalRow?.count ?? 0);

  return v1Json(
    {
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        featured: Boolean(r.featured),
        trending: Boolean(r.trending),
        views: Number(r.views ?? 0),
        field: r.field_slug,
        category: r.category_slug,
        author: r.author_slug,
        coverUrl: r.cover_path ? `${origin}${r.cover_path}` : null,
        publishedAt: r.published_at,
        updatedAt: r.updated_at,
        translations: {
          en: {
            title: r.title_en,
            slug: r.slug_en,
            url: r.slug_en ? `${origin}/en/articles/${encodeURIComponent(r.slug_en)}` : null,
          },
          fa: {
            title: r.title_fa,
            slug: r.slug_fa,
            url: r.slug_fa ? `${origin}/fa/articles/${encodeURIComponent(r.slug_fa)}` : null,
          },
        },
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    { requestId: auth.requestId, headers: auth.rateHeaders }
  );
}

export async function POST(req: Request) {
  const auth = await authenticateV1Request(req, "articles:write");
  if (!auth.ok) return auth.response;

  const bodyRead = await readTextBodyWithLimit(req, 1_048_576);
  if (!bodyRead.ok) {
    return v1Error({
      status: 413,
      code: "payload_too_large",
      message: "Article payload exceeds the 1 MB JSON size limit.",
      hint: "Upload large images separately via POST /api/v1/media and reference them by coverMediaId or /uploads/... URL.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }
  const rawText = bodyRead.text;
  let body: unknown = null;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    return v1Error({
      status: 400,
      code: "invalid_json",
      message: "Request body is not valid JSON.",
      hint: "Send a valid application/json payload. See GET /api/v1/openapi.json for schema details.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const idempotencyKey = req.headers.get("idempotency-key")?.trim();
  const requestHash = await hashToken(rawText || "{}");

  if (idempotencyKey) {
    const cached = await readIdempotencyRecord(
      auth.key.id,
      idempotencyKey,
      "POST",
      "/api/v1/articles",
      requestHash
    );
    if (cached.hit) {
      if (cached.conflict) {
        return v1Error({
          status: 409,
          code: "idempotency_conflict",
          message: "This Idempotency-Key was already used with a different request payload.",
          hint: "Generate a fresh Idempotency-Key UUID for a new article payload.",
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }
      return v1Json(cached.body, {
        status: cached.statusCode,
        requestId: auth.requestId,
        headers: {
          ...auth.rateHeaders,
          "X-Idempotency-Replayed": "true",
        },
      });
    }
  }

  const parsed = aiCreateArticleSchema.safeParse(body);
  if (!parsed.success) {
    return v1Error({
      status: 400,
      code: "validation_error",
      message: "Invalid article payload.",
      hint: "Check required fields (`title` >= 3 chars, `content` non-empty, valid `status` or UUID formats).",
      details: parsed.error.flatten(),
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }
  const data = parsed.data;

  if ((data.status === "published" || data.featured || data.trending) && !hasScope(auth.key.scopes, "articles:publish")) {
    return v1Error({
      status: 403,
      code: "insufficient_scope",
      message: "Publishing articles directly or marking featured/trending requires the 'articles:publish' scope.",
      hint: "Set `status: 'draft'` and `featured: false, trending: false` for editorial review, or grant `articles:publish` to this API key.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  if (data.status === "scheduled" && !data.scheduledAt) {
    return v1Error({
      status: 400,
      code: "validation_error",
      message: "Articles with status='scheduled' require a valid ISO-8601 `scheduledAt` timestamp.",
      hint: "Example: \"scheduledAt\": \"2026-12-01T12:00:00Z\"",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const normalized = normalizeAiArticleTranslations(data);
  if (!normalized.ok) {
    return v1Error({
      status: 400,
      code: "content_validation_failed",
      message: normalized.message,
      hint: normalized.hint,
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const { fa, en, warnings } = normalized.value;
  const hasCoverInput = Boolean(data.coverMediaId || data.coverMediaUrl?.trim());

  // Compile-time MDX preflight validation (catches broken JSX / unclosed tags BEFORE DB write)
  for (const [locale, tr] of [
    ["fa", fa],
    ["en", en],
  ] as const) {
    const mdxCheck = await validateMdxCompiles({
      content: tr.content,
      locale,
      excerpt: tr.excerpt,
      hasCover: hasCoverInput,
    });
    if (!mdxCheck.ok) {
      return v1Error({
        status: 422,
        code: "mdx_compile_error",
        message: mdxCheck.error?.message ?? `MDX compilation failed for '${locale}'.`,
        hint: mdxCheck.error?.hint,
        details: {
          locale,
          ...(mdxCheck.error?.line !== undefined ? { line: mdxCheck.error.line } : {}),
          ...(mdxCheck.error?.column !== undefined ? { column: mdxCheck.error.column } : {}),
        },
        requestId: auth.requestId,
        headers: auth.rateHeaders,
      });
    }
    warnings.push(...mdxCheck.qualityWarnings);
  }

  let resolvedFieldId: string | null = null;
  let resolvedCategoryId: string | null = null;
  let resolvedAuthorId: string | null = null;
  try {
    resolvedFieldId = await resolveFieldId(data.fieldId, data.field);
    resolvedCategoryId = await resolveCategoryId(data.categoryId, data.category);
    resolvedAuthorId = await resolveAuthorId(data.authorId, data.author, auth.key.defaultAuthorId);
  } catch (err) {
    return v1Error({
      status: 400,
      code: "taxonomy_resolution_failed",
      message: err instanceof Error ? err.message : "Taxonomy lookup failed.",
      hint: "Call GET /api/v1/taxonomy to fetch valid field, category, and author slugs.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  // Check slug collisions early (and auto-suffix when conflictStrategy === "suffix")
  for (const [locale, tr] of [
    ["fa", fa],
    ["en", en],
  ] as const) {
    const slugRes = await resolveUniqueSlug(locale, tr.slug!, data.conflictStrategy);
    if (!slugRes.ok) {
      return v1Error({
        status: 409,
        code: "slug_conflict",
        message: `Slug '${slugRes.conflictingSlug}' is already in use for locale '${locale}'.`,
        hint: "Provide a unique `slug`, or pass `conflictStrategy: \"suffix\"` to auto-generate a unique slug.",
        requestId: auth.requestId,
        headers: auth.rateHeaders,
      });
    }
    if (slugRes.suffixed) {
      warnings.push(`[${locale}] Slug '${tr.slug}' was already taken; auto-resolved to '${slugRes.slug}'.`);
      tr.slug = slugRes.slug;
    }
  }

  // Cover media validation / resolution / optional remote fetch
  let resolvedCoverMediaId: string | null = data.coverMediaId ?? null;
  let resolvedCoverPath: string | null = null;

  if (resolvedCoverMediaId) {
    const existingMedia = await queryOne<{ id: string; path: string }>(
      `SELECT id, path FROM media WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [resolvedCoverMediaId]
    );
    if (!existingMedia) {
      return v1Error({
        status: 400,
        code: "media_not_found",
        message: `coverMediaId '${resolvedCoverMediaId}' was not found.`,
        hint: "Upload media first with POST /api/v1/media or pass a valid coverMediaUrl.",
        requestId: auth.requestId,
        headers: auth.rateHeaders,
      });
    }
    resolvedCoverPath = existingMedia.path;
  } else if (data.coverMediaUrl?.trim()) {
    const candidate = data.coverMediaUrl.trim();
    if (candidate.startsWith("/uploads/")) {
      const localMedia = await queryOne<{ id: string; path: string }>(
        `SELECT id, path FROM media WHERE path = ? AND deleted_at IS NULL LIMIT 1`,
        [candidate]
      );
      if (!localMedia) {
        return v1Error({
          status: 400,
          code: "media_not_found",
          message: `Local media path '${candidate}' was not found in the media library.`,
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }
      resolvedCoverMediaId = localMedia.id;
      resolvedCoverPath = localMedia.path;
    } else {
      if (!hasScope(auth.key.scopes, "media:write")) {
        return v1Error({
          status: 403,
          code: "insufficient_scope",
          message: "Fetching a remote `coverMediaUrl` requires the 'media:write' scope.",
          hint: "Pass an existing `coverMediaId`, an already uploaded `/uploads/...` path, or grant `media:write`.",
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }
      const urlCheck = validateExternalImageUrl(candidate);
      if (!urlCheck.ok) {
        return v1Error({
          status: 400,
          code: "invalid_media_url",
          message: urlCheck.reason,
          hint: "Pass a public HTTPS image URL or upload via POST /api/v1/media.",
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }
      if (!data.dryRun) {
        try {
          const fetched = await fetchSafeRemoteImage(candidate);
          const ingested = await ingestImageBuffer({
            buffer: fetched.buffer,
            originalName: fetched.filename,
            altText: data.coverAltText ?? en.title,
            uploadedByUserId: auth.key.ownerUserId,
            ipAddress: auth.ip,
            auditMeta: { apiKeyId: auth.key.id, apiKeyName: auth.key.name, via: "article_create" },
          });
          resolvedCoverMediaId = ingested.id;
          resolvedCoverPath = ingested.path;
        } catch (err) {
          return v1Error({
            status: 400,
            code: "media_ingest_failed",
            message: err instanceof Error ? err.message : "Failed to fetch coverMediaUrl.",
            requestId: auth.requestId,
            headers: auth.rateHeaders,
          });
        }
      }
    }
  }

  const metrics = {
    en: buildArticleMetrics(en.content),
    fa: buildArticleMetrics(fa.content),
  };
  const origin = getPublicOrigin(req);

  if (data.dryRun) {
    return v1Json(
      {
        dryRun: true,
        valid: true,
        status: data.status,
        slugs: { fa: fa.slug!, en: en.slug! },
        previewUrls: {
          fa: `${origin}/fa/articles/${encodeURIComponent(fa.slug!)}`,
          en: `${origin}/en/articles/${encodeURIComponent(en.slug!)}`,
        },
        resolved: {
          fieldId: resolvedFieldId,
          categoryId: resolvedCategoryId,
          authorId: resolvedAuthorId,
          coverMediaId: resolvedCoverMediaId,
          coverPath: resolvedCoverPath,
        },
        metrics,
        warnings,
      },
      { status: 200, requestId: auth.requestId, headers: auth.rateHeaders }
    );
  }

  // Resolve and optionally auto-create tags only on non-dryRun requests
  let resolvedTagIds: string[] = [];
  let createdTags: string[] = [];
  try {
    const tagRes = await resolveAndCreateTagIds({
      tagIds: data.tagIds,
      tags: data.tags,
      autoCreateTags: data.autoCreateTags,
      canWriteTaxonomy: hasScope(auth.key.scopes, "taxonomy:write"),
    });
    resolvedTagIds = tagRes.ids;
    createdTags = tagRes.createdSlugs;
  } catch (err) {
    return v1Error({
      status: 400,
      code: "tag_resolution_failed",
      message: err instanceof Error ? err.message : "Failed to resolve tags.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const articleId = uuid();
  const publishedAt =
    data.status === "published" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;

  try {
    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO articles
           (id, field_id, category_id, author_id, cover_media_id, status, featured, trending, scheduled_at, published_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          articleId,
          resolvedFieldId,
          resolvedCategoryId,
          resolvedAuthorId,
          resolvedCoverMediaId,
          data.status,
          data.featured ? 1 : 0,
          data.trending ? 1 : 0,
          data.scheduledAt ?? null,
          publishedAt,
          auth.key.ownerUserId,
          auth.key.ownerUserId,
        ]
      );

      for (const [locale, t] of [
        ["fa", fa],
        ["en", en],
      ] as const) {
        await conn.execute(
          `INSERT INTO article_translations
             (id, article_id, locale, title, slug, excerpt, content, seo_title, seo_description, seo_keywords, canonical_url, twitter_card)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(),
            articleId,
            locale,
            stripHtml(t.title),
            t.slug!,
            t.excerpt ?? "",
            t.content,
            t.seoTitle ? stripHtml(t.seoTitle) : stripHtml(t.title),
            t.seoDescription ? stripHtml(t.seoDescription) : t.excerpt ?? "",
            t.seoKeywords ?? "",
            t.canonicalUrl ?? "",
            t.twitterCard ?? "summary_large_image",
          ]
        );
      }

      for (const tagId of resolvedTagIds) {
        await conn.execute(`INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)`, [
          articleId,
          tagId,
        ]);
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    if (message.includes("uq_locale_slug")) {
      return v1Error({
        status: 409,
        code: "slug_conflict",
        message: "That slug is already in use for one of the locales.",
        requestId: auth.requestId,
        headers: auth.rateHeaders,
      });
    }
    throw err;
  }

  await logActivity({
    userId: auth.key.ownerUserId,
    action: data.status === "published" ? "api.article.publish" : "api.article.create",
    entityType: "article",
    entityId: articleId,
    meta: {
      apiKeyId: auth.key.id,
      apiKeyName: auth.key.name,
      apiKeyPrefix: auth.key.keyPrefix,
      status: data.status,
      slugs: { fa: fa.slug!, en: en.slug! },
      createdTags,
    },
    ipAddress: auth.ip,
  });

  revalidatePath("/", "layout");

  const createdRow = await queryOne<{ updated_at: string }>(
    `SELECT updated_at FROM articles WHERE id = ? LIMIT 1`,
    [articleId]
  );
  const etag = computeArticleEtag(articleId, createdRow?.updated_at ?? new Date().toISOString());

  const responseBody = {
    article: {
      id: articleId,
      etag,
      status: data.status,
      featured: data.featured,
      trending: data.trending,
      slugs: { fa: fa.slug!, en: en.slug! },
      urls: {
        fa: `${origin}/fa/articles/${encodeURIComponent(fa.slug!)}`,
        en: `${origin}/en/articles/${encodeURIComponent(en.slug!)}`,
        admin: `${origin}/admin/articles/${articleId}`,
        api: `${origin}/api/v1/articles/${articleId}`,
      },
      cover: resolvedCoverMediaId
        ? { id: resolvedCoverMediaId, path: resolvedCoverPath, url: resolvedCoverPath ? `${origin}${resolvedCoverPath}` : null }
        : null,
      createdTags,
      metrics,
    },
    warnings,
  };

  if (idempotencyKey) {
    await writeIdempotencyRecord({
      apiKeyId: auth.key.id,
      idempotencyKey,
      method: "POST",
      path: "/api/v1/articles",
      requestHash,
      statusCode: 201,
      body: responseBody,
    });
  }

  return v1Json(responseBody, {
    status: 201,
    requestId: auth.requestId,
    headers: {
      ...auth.rateHeaders,
      Location: `${origin}/api/v1/articles/${articleId}`,
      ETag: etag,
    },
  });
}
