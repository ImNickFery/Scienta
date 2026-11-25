import { revalidatePath } from "next/cache";
import { execute, query, queryOne, withTransaction } from "@/lib/db";
import { stripHtml } from "@/lib/sanitize";
import { sanitizeUrl } from "@/lib/security";
import { logActivity } from "@/lib/activity-log";
import { isArticleSlugConflictError, toSqlUtcDateTime } from "@/lib/sql-dates";
import {
  authenticateV1Request,
  computeArticleEtag,
  getPublicOrigin,
  hasScope,
  matchesIfMatchHeader,
  readTextBodyWithLimit,
  v1CorsPreflight,
  v1Error,
  v1Json,
} from "@/lib/ai-api-auth";
import {
  aiPatchArticleSchema,
  buildArticleMetrics,
  buildRevisionSnapshotNote,
  recordArticleRevisions,
  resolveAndCreateTagIds,
  resolveArticleByIdOrSlug,
  resolveAuthorId,
  resolveCategoryId,
  resolveFieldId,
} from "@/lib/ai-api-articles";
import { fetchSafeRemoteImage, ingestImageBuffer, validateExternalImageUrl } from "@/lib/ai-api-media";
import { validateMdxCompiles } from "@/lib/ai-api-mdx";

export async function OPTIONS() {
  return v1CorsPreflight();
}

interface FullTranslationRow {
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

  const [translations, tags, coverMedia, fieldRow, categoryRow, authorRow] = await Promise.all([
    query<FullTranslationRow>(
      `SELECT locale, title, slug, excerpt, content, seo_title, seo_description, seo_keywords, canonical_url, twitter_card
         FROM article_translations WHERE article_id = ?`,
      [article.id]
    ),
    query<{ id: string; slug: string; name_fa: string; name_en: string }>(
      `SELECT tg.id, tg.slug, tg.name_fa, tg.name_en
         FROM article_tags atg JOIN tags tg ON tg.id = atg.tag_id
        WHERE atg.article_id = ?`,
      [article.id]
    ),
    article.cover_media_id
      ? queryOne<{ id: string; path: string; thumbnail_path: string | null }>(
          `SELECT id, path, thumbnail_path FROM media WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
          [article.cover_media_id]
        )
      : null,
    article.field_id
      ? queryOne<{ id: string; slug: string; name_en: string; name_fa: string }>(
          `SELECT id, slug, name_en, name_fa FROM fields WHERE id = ? LIMIT 1`,
          [article.field_id]
        )
      : null,
    article.category_id
      ? queryOne<{ id: string; slug: string; name_en: string; name_fa: string }>(
          `SELECT id, slug, name_en, name_fa FROM categories WHERE id = ? LIMIT 1`,
          [article.category_id]
        )
      : null,
    article.author_id
      ? queryOne<{ id: string; slug: string; name_en: string; name_fa: string }>(
          `SELECT id, slug, name_en, name_fa FROM authors WHERE id = ? LIMIT 1`,
          [article.author_id]
        )
      : null,
  ]);

  const origin = getPublicOrigin(req);
  const trMap = Object.fromEntries(
    translations.map((t) => [
      t.locale,
      {
        title: t.title,
        slug: t.slug,
        excerpt: t.excerpt ?? "",
        content: t.content,
        seoTitle: t.seo_title,
        seoDescription: t.seo_description,
        seoKeywords: t.seo_keywords,
        canonicalUrl: t.canonical_url,
        twitterCard: t.twitter_card,
        url: `${origin}/${t.locale}/articles/${encodeURIComponent(t.slug)}`,
        metrics: buildArticleMetrics(t.content),
      },
    ])
  );

  const etag = computeArticleEtag(article.id, article.updated_at);

  return v1Json(
    {
      article: {
        id: article.id,
        etag,
        status: article.status,
        featured: Boolean(article.featured),
        trending: Boolean(article.trending),
        views: Number(article.views ?? 0),
        publishedAt: article.published_at,
        scheduledAt: article.scheduled_at,
        createdAt: article.created_at,
        updatedAt: article.updated_at,
        field: fieldRow,
        category: categoryRow,
        author: authorRow,
        cover: coverMedia
          ? {
              id: coverMedia.id,
              path: coverMedia.path,
              url: `${origin}${coverMedia.path}`,
              thumbnailUrl: coverMedia.thumbnail_path ? `${origin}${coverMedia.thumbnail_path}` : null,
            }
          : null,
        tags,
        translations: trMap,
      },
    },
    {
      requestId: auth.requestId,
      headers: {
        ...auth.rateHeaders,
        ETag: etag,
      },
    }
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const auth = await authenticateV1Request(req, "articles:write");
  if (!auth.ok) return auth.response;

  const { idOrSlug } = await params;
  const existing = await resolveArticleByIdOrSlug(idOrSlug);
  if (!existing) {
    return v1Error({
      status: 404,
      code: "article_not_found",
      message: `No active article found matching '${idOrSlug}'.`,
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const currentEtag = computeArticleEtag(existing.id, existing.updated_at);
  const ifMatch = req.headers.get("if-match");
  if (!matchesIfMatchHeader(ifMatch, currentEtag)) {
    return v1Error({
      status: 412,
      code: "precondition_failed",
      message: "Article was modified since the ETag provided in If-Match.",
      hint: "Fetch the latest version with GET /api/v1/articles/{idOrSlug} and retry using the updated ETag.",
      details: { currentEtag },
      requestId: auth.requestId,
      headers: { ...auth.rateHeaders, ETag: currentEtag },
    });
  }

  const bodyRead = await readTextBodyWithLimit(req, 1_048_576);
  if (!bodyRead.ok) {
    return v1Error({
      status: 413,
      code: "payload_too_large",
      message: "PATCH payload exceeds the 1 MB JSON size limit.",
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

  const parsed = aiPatchArticleSchema.safeParse(body);
  if (!parsed.success) {
    return v1Error({
      status: 400,
      code: "validation_error",
      message: "Invalid PATCH payload.",
      details: parsed.error.flatten(),
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }
  const data = parsed.data;

  const wantsPublishAction =
    data.status === "published" || data.featured === true || data.trending === true;
  if (wantsPublishAction && !hasScope(auth.key.scopes, "articles:publish")) {
    return v1Error({
      status: 403,
      code: "insufficient_scope",
      message: "Setting status='published', featured=true, or trending=true requires 'articles:publish' scope.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const currentTranslations = await query<FullTranslationRow>(
    `SELECT locale, title, slug, excerpt, content, seo_title, seo_description, seo_keywords, canonical_url, twitter_card
       FROM article_translations WHERE article_id = ?`,
    [existing.id]
  );

  // Validate any supplied translation updates before DB transaction
  const updatedTranslations: Record<"fa" | "en", FullTranslationRow | undefined> = {
    fa: currentTranslations.find((t) => t.locale === "fa"),
    en: currentTranslations.find((t) => t.locale === "en"),
  };

  const warnings: string[] = [];
  const hasCoverAfterPatch = Boolean(
    data.coverMediaId !== undefined ? data.coverMediaId : data.coverMediaUrl?.trim() || existing.cover_media_id
  );

  for (const locale of ["fa", "en"] as const) {
    const patch = data.translations?.[locale];
    const base = updatedTranslations[locale];
    if (!patch || !base) continue;

    if (patch.content !== undefined) {
      const mdxCheck = await validateMdxCompiles({
        content: patch.content,
        locale,
        excerpt: patch.excerpt ?? base.excerpt ?? "",
        hasCover: hasCoverAfterPatch,
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

    let nextCanonical = base.canonical_url ?? "";
    if (patch.canonicalUrl !== undefined) {
      if (!patch.canonicalUrl.trim()) {
        nextCanonical = "";
      } else {
        const safeCanonical = sanitizeUrl(patch.canonicalUrl, {
          allowRelative: false,
          allowMailto: false,
          allowHash: false,
        });
        if (!safeCanonical) {
          return v1Error({
            status: 400,
            code: "content_validation_failed",
            message: `Invalid canonicalUrl in '${locale}'.`,
            requestId: auth.requestId,
            headers: auth.rateHeaders,
          });
        }
        nextCanonical = safeCanonical;
      }
    }

    const nextTitle = patch.title ? stripHtml(patch.title) : base.title;
    // Preserve live SEO slug unless caller explicitly passes a new `slug`
    const nextSlug = patch.slug?.trim() || base.slug;
    updatedTranslations[locale] = {
      ...base,
      title: nextTitle,
      slug: nextSlug,
      excerpt: patch.excerpt ?? base.excerpt ?? "",
      content: patch.content ?? base.content,
      seo_title: patch.seoTitle ?? base.seo_title ?? nextTitle,
      seo_description: patch.seoDescription ?? base.seo_description ?? patch.excerpt ?? base.excerpt ?? "",
      seo_keywords: patch.seoKeywords ?? base.seo_keywords ?? "",
      canonical_url: nextCanonical,
      twitter_card: patch.twitterCard ?? base.twitter_card,
    };
  }

  let nextFieldId = existing.field_id;
  let nextCategoryId = existing.category_id;
  let nextAuthorId = existing.author_id;
  try {
    if (data.fieldId !== undefined || data.field !== undefined) {
      nextFieldId = await resolveFieldId(data.fieldId, data.field);
    }
    if (data.categoryId !== undefined || data.category !== undefined) {
      nextCategoryId = await resolveCategoryId(data.categoryId, data.category);
    }
    if (data.authorId !== undefined || data.author !== undefined) {
      nextAuthorId = await resolveAuthorId(data.authorId, data.author, existing.author_id);
    }
  } catch (err) {
    return v1Error({
      status: 400,
      code: "taxonomy_resolution_failed",
      message: err instanceof Error ? err.message : "Taxonomy lookup failed.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  let nextCoverMediaId = existing.cover_media_id;
  if (data.coverMediaId !== undefined) {
    if (data.coverMediaId !== null) {
      const found = await queryOne<{ id: string }>(
        `SELECT id FROM media WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
        [data.coverMediaId]
      );
      if (!found) {
        return v1Error({
          status: 400,
          code: "media_not_found",
          message: `Media ID '${data.coverMediaId}' was not found.`,
          hint: "Upload media via POST /api/v1/media or pass a valid media UUID.",
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }
    }
    nextCoverMediaId = data.coverMediaId;
  } else if (data.coverMediaUrl?.trim()) {
    const candidate = data.coverMediaUrl.trim();
    if (candidate.startsWith("/uploads/")) {
      const found = await queryOne<{ id: string }>(
        `SELECT id FROM media WHERE path = ? AND deleted_at IS NULL LIMIT 1`,
        [candidate]
      );
      if (!found) {
        return v1Error({
          status: 400,
          code: "media_not_found",
          message: `Media path '${candidate}' not found.`,
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }
      nextCoverMediaId = found.id;
    } else {
      if (!hasScope(auth.key.scopes, "media:write")) {
        return v1Error({
          status: 403,
          code: "insufficient_scope",
          message: "Fetching a remote `coverMediaUrl` requires 'media:write' scope.",
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }
      const check = validateExternalImageUrl(candidate);
      if (!check.ok) {
        return v1Error({
          status: 400,
          code: "invalid_media_url",
          message: check.reason,
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }
      try {
        const fetched = await fetchSafeRemoteImage(candidate);
        const ingested = await ingestImageBuffer({
          buffer: fetched.buffer,
          originalName: fetched.filename,
          altText: data.coverAltText ?? updatedTranslations.en?.title ?? "Article cover",
          uploadedByUserId: auth.key.ownerUserId,
          ipAddress: auth.ip,
          auditMeta: { apiKeyId: auth.key.id, apiKeyName: auth.key.name, via: "article_patch" },
        });
        nextCoverMediaId = ingested.id;
      } catch (err) {
        return v1Error({
          status: 400,
          code: "media_ingest_failed",
          message: err instanceof Error ? err.message : "Failed to fetch coverMediaUrl.",
          hint: "Verify the remote HTTPS URL returns a valid PNG/JPEG/WebP/GIF image <= 8 MB.",
          requestId: auth.requestId,
          headers: auth.rateHeaders,
        });
      }
    }
  }

  let nextTagIds: string[] | null = null;
  if (data.tagIds !== undefined || data.tags !== undefined) {
    try {
      const res = await resolveAndCreateTagIds({
        tagIds: data.tagIds,
        tags: data.tags,
        autoCreateTags: data.autoCreateTags,
        canWriteTaxonomy: hasScope(auth.key.scopes, "taxonomy:write"),
      });
      nextTagIds = res.ids;
    } catch (err) {
      return v1Error({
        status: 400,
        code: "tag_resolution_failed",
        message: err instanceof Error ? err.message : "Failed to resolve tags.",
        requestId: auth.requestId,
        headers: auth.rateHeaders,
      });
    }
  }

  const nextStatus = data.status ?? existing.status;
  const nextFeatured = data.featured !== undefined ? (data.featured ? 1 : 0) : existing.featured;
  const nextTrending = data.trending !== undefined ? (data.trending ? 1 : 0) : existing.trending;
  const nextScheduledAt =
    data.scheduledAt !== undefined ? toSqlUtcDateTime(data.scheduledAt) : existing.scheduled_at;
  if (nextStatus === "scheduled" && !nextScheduledAt) {
    return v1Error({
      status: 400,
      code: "validation_error",
      message: "Articles with status='scheduled' require a valid ISO-8601 `scheduledAt` timestamp.",
      hint: "Include `scheduledAt` alongside `status: 'scheduled'`.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }
  const wasPublished = existing.status === "published";
  const nowPublishing = nextStatus === "published";
  const revisionNote = buildRevisionSnapshotNote(auth.key.name, data.revisionNote);

  try {
    await withTransaction(async (conn) => {
      await recordArticleRevisions(conn, existing.id, currentTranslations, auth.key.ownerUserId, revisionNote);

      await conn.execute(
        `UPDATE articles
            SET field_id = ?, category_id = ?, author_id = ?, cover_media_id = ?,
                status = ?, featured = ?, trending = ?, scheduled_at = ?,
                published_at = CASE WHEN ? AND NOT ? THEN NOW() ELSE published_at END,
                updated_by = ?, updated_at = NOW()
          WHERE id = ?`,
        [
          nextFieldId,
          nextCategoryId,
          nextAuthorId,
          nextCoverMediaId,
          nextStatus,
          nextFeatured,
          nextTrending,
          nextScheduledAt,
          nowPublishing,
          wasPublished,
          auth.key.ownerUserId,
          existing.id,
        ]
      );

      for (const locale of ["fa", "en"] as const) {
        if (!data.translations?.[locale]) continue;
        const tr = updatedTranslations[locale];
        if (!tr) continue;
        await conn.execute(
          `UPDATE article_translations
              SET title = ?, slug = ?, excerpt = ?, content = ?,
                  seo_title = ?, seo_description = ?, seo_keywords = ?, canonical_url = ?, twitter_card = ?, updated_at = NOW()
            WHERE article_id = ? AND locale = ?`,
          [
            tr.title,
            tr.slug,
            tr.excerpt ?? "",
            tr.content,
            tr.seo_title ?? tr.title,
            tr.seo_description ?? tr.excerpt ?? "",
            tr.seo_keywords ?? "",
            tr.canonical_url ?? "",
            tr.twitter_card,
            existing.id,
            locale,
          ]
        );
      }

      if (nextTagIds !== null) {
        await conn.execute(`DELETE FROM article_tags WHERE article_id = ?`, [existing.id]);
        for (const tagId of nextTagIds) {
          await conn.execute(`INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)`, [
            existing.id,
            tagId,
          ]);
        }
      }
    });
  } catch (err) {
    if (isArticleSlugConflictError(err)) {
      return v1Error({
        status: 409,
        code: "slug_conflict",
        message: "Updated slug conflicts with an existing article.",
        requestId: auth.requestId,
        headers: auth.rateHeaders,
      });
    }
    throw err;
  }

  await logActivity({
    userId: auth.key.ownerUserId,
    action: "api.article.update",
    entityType: "article",
    entityId: existing.id,
    meta: {
      apiKeyId: auth.key.id,
      apiKeyName: auth.key.name,
      status: nextStatus,
      revisionNote,
    },
    ipAddress: auth.ip,
  });

  revalidatePath("/", "layout");

  const updatedRow = await queryOne<{ updated_at: string }>(
    `SELECT updated_at FROM articles WHERE id = ? LIMIT 1`,
    [existing.id]
  );
  const nextEtag = computeArticleEtag(existing.id, updatedRow?.updated_at ?? new Date().toISOString());

  const origin = getPublicOrigin(req);
  return v1Json(
    {
      ok: true,
      id: existing.id,
      etag: nextEtag,
      status: nextStatus,
      revisionNote,
      slugs: {
        fa: updatedTranslations.fa?.slug ?? null,
        en: updatedTranslations.en?.slug ?? null,
      },
      urls: {
        fa: updatedTranslations.fa ? `${origin}/fa/articles/${encodeURIComponent(updatedTranslations.fa.slug)}` : null,
        en: updatedTranslations.en ? `${origin}/en/articles/${encodeURIComponent(updatedTranslations.en.slug)}` : null,
      },
      warnings,
    },
    {
      requestId: auth.requestId,
      headers: {
        ...auth.rateHeaders,
        ETag: nextEtag,
      },
    }
  );
}

export async function DELETE(req: Request, { params }: { params: Promise<{ idOrSlug: string }> }) {
  const auth = await authenticateV1Request(req, "articles:write");
  if (!auth.ok) return auth.response;

  const { idOrSlug } = await params;
  const existing = await resolveArticleByIdOrSlug(idOrSlug);
  if (!existing) {
    return v1Error({
      status: 404,
      code: "article_not_found",
      message: `No active article found matching '${idOrSlug}'.`,
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  await execute(`UPDATE articles SET deleted_at = NOW(), updated_by = ? WHERE id = ?`, [
    auth.key.ownerUserId,
    existing.id,
  ]);

  await logActivity({
    userId: auth.key.ownerUserId,
    action: "api.article.trash",
    entityType: "article",
    entityId: existing.id,
    meta: { apiKeyId: auth.key.id, apiKeyName: auth.key.name },
    ipAddress: auth.ip,
  });

  revalidatePath("/", "layout");

  return v1Json(
    { ok: true, id: existing.id, trashed: true },
    { requestId: auth.requestId, headers: auth.rateHeaders }
  );
}
