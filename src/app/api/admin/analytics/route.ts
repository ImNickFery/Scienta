import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";
import { buildDailyTrend, computeEditorialCoverage } from "@/lib/admin-analytics";
import {
  buildHeatmapGrid,
  clampProWindowDays,
  computePeriodDelta,
  computeSeoChecklist,
  estimateArticleWords,
  type ProWindowDays,
  type SeoMissingKey,
} from "@/lib/admin-analytics-pro";
import { ensureAnalyticsTableReady } from "@/lib/analytics-store";
import { ensureApiTablesReady } from "@/lib/ai-api-auth";

interface ArticleRawRow {
  id: string;
  status: "published" | "draft" | "scheduled";
  featured: number;
  trending: number;
  views: number;
  cover_media_id: string | null;
  published_at: string | null;
  created_at: string;
  field_id: string | null;
  field_name_en: string | null;
  field_name_fa: string | null;
  field_color: string | null;
  author_id: string | null;
  author_name_en: string | null;
  author_name_fa: string | null;
  title_en: string | null;
  title_fa: string | null;
  slug_en: string | null;
  slug_fa: string | null;
  excerpt_en: string | null;
  excerpt_fa: string | null;
  content_en: string | null;
  content_fa: string | null;
  seo_title_en: string | null;
  seo_title_fa: string | null;
  seo_desc_en: string | null;
  seo_desc_fa: string | null;
}

function toTimestampMs(raw: string | null | undefined): number {
  if (!raw) return Number.NaN;
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  return new Date(normalized).getTime();
}

function countInWindows(
  timestamps: Array<string | null | undefined>,
  days: ProWindowDays,
  nowMs: number
): { current: number; previous: number } {
  const curStart = nowMs - days * 86_400_000;
  const prevStart = nowMs - days * 2 * 86_400_000;
  let current = 0;
  let previous = 0;
  for (const raw of timestamps) {
    const ms = toTimestampMs(raw);
    if (Number.isNaN(ms)) continue;
    if (ms >= curStart && ms <= nowMs) current += 1;
    else if (ms >= prevStart && ms < curStart) previous += 1;
  }
  return { current, previous };
}

export async function GET(req: Request) {
  const { response } = await requireApiAuth("dashboard.view");
  if (response) return response;

  const url = new URL(req.url);
  const rangeDays = clampProWindowDays(url.searchParams.get("days"));
  const localeFilterRaw = url.searchParams.get("locale");
  const localeFilter: "all" | "fa" | "en" =
    localeFilterRaw === "fa" || localeFilterRaw === "en" ? localeFilterRaw : "all";

  await Promise.all([ensureAnalyticsTableReady(), ensureApiTablesReady()]);

  const [
    articlesRaw,
    fieldsRaw,
    authorsRaw,
    commentsRaw,
    subscribersRaw,
    tagsRaw,
    mediaRaw,
    activityRaw,
    pageviewsRaw,
    apiKeysRaw,
  ] = await Promise.all([
    query<ArticleRawRow>(
      `SELECT
        a.id,
        a.status,
        a.featured,
        a.trending,
        a.views,
        a.cover_media_id,
        a.published_at,
        a.created_at,
        a.field_id,
        f.name_en AS field_name_en,
        f.name_fa AS field_name_fa,
        f.color AS field_color,
        a.author_id,
        au.name_en AS author_name_en,
        au.name_fa AS author_name_fa,
        ten.title AS title_en,
        tfa.title AS title_fa,
        ten.slug AS slug_en,
        tfa.slug AS slug_fa,
        ten.excerpt AS excerpt_en,
        tfa.excerpt AS excerpt_fa,
        ten.content AS content_en,
        tfa.content AS content_fa,
        ten.seo_title AS seo_title_en,
        tfa.seo_title AS seo_title_fa,
        ten.seo_description AS seo_desc_en,
        tfa.seo_description AS seo_desc_fa
       FROM articles a
       LEFT JOIN fields f ON f.id = a.field_id
       LEFT JOIN authors au ON au.id = a.author_id
       LEFT JOIN article_translations ten ON ten.article_id = a.id AND ten.locale = 'en'
       LEFT JOIN article_translations tfa ON tfa.article_id = a.id AND tfa.locale = 'fa'
       WHERE a.deleted_at IS NULL
       ORDER BY a.views DESC, a.created_at DESC`
    ),
    query<{ id: string; slug: string; name_en: string; name_fa: string; color: string }>(
      `SELECT id, slug, name_en, name_fa, color FROM fields WHERE deleted_at IS NULL ORDER BY sort_order ASC`
    ),
    query<{ id: string; slug: string; name_en: string; name_fa: string }>(
      `SELECT id, slug, name_en, name_fa FROM authors WHERE deleted_at IS NULL`
    ),
    query<{
      id: string;
      article_id: string;
      locale: string;
      status: string;
      is_question: number;
      admin_reply: string | null;
      created_at: string;
    }>(
      `SELECT id, article_id, locale, status, is_question, admin_reply, created_at
       FROM comments
       ORDER BY created_at DESC LIMIT 2000`
    ),
    query<{ id: string; locale: string; status: string; created_at: string }>(
      `SELECT id, locale, status, created_at FROM subscribers ORDER BY created_at DESC LIMIT 3000`
    ),
    query<{
      id: string;
      slug: string;
      name_en: string;
      name_fa: string;
      article_count: number;
      total_views: number;
    }>(
      `SELECT t.id, t.slug, t.name_en, t.name_fa,
              COUNT(DISTINCT a.id) AS article_count,
              COALESCE(SUM(a.views), 0) AS total_views
       FROM tags t
       LEFT JOIN article_tags at ON at.tag_id = t.id
       LEFT JOIN articles a ON a.id = at.article_id AND a.deleted_at IS NULL AND a.status = 'published'
       GROUP BY t.id
       ORDER BY total_views DESC, article_count DESC
       LIMIT 12`
    ),
    query<{ mime_type: string; size_bytes: number }>(
      `SELECT mime_type, size_bytes FROM media WHERE deleted_at IS NULL`
    ),
    query<{ action: string; created_at: string }>(
      `SELECT action, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 2500`
    ),
    query<{
      article_id: string | null;
      locale: string;
      referrer_host: string;
      device_type: string;
      created_at: string;
    }>(
      `SELECT article_id, locale, referrer_host, device_type, created_at
       FROM analytics_pageviews
       ORDER BY created_at DESC LIMIT 10000`
    ).catch(() => []),
    query<{ status: string; request_count: number }>(
      `SELECT status, request_count FROM api_keys`
    ).catch(() => []),
  ]);

  const now = new Date();
  const nowMs = now.getTime();

  // Filter live pageviews & comments/subscribers when a specific locale is chosen
  const scopedPageviews =
    localeFilter === "all"
      ? pageviewsRaw
      : pageviewsRaw.filter((p) => p.locale === localeFilter);
  const scopedComments =
    localeFilter === "all"
      ? commentsRaw
      : commentsRaw.filter((c) => c.locale === localeFilter);
  const scopedSubscribers =
    localeFilter === "all"
      ? subscribersRaw
      : subscribersRaw.filter((s) => s.locale === localeFilter);

  // Comment count per article
  const commentCountByArticle = new Map<string, number>();
  for (const c of scopedComments) {
    commentCountByArticle.set(c.article_id, (commentCountByArticle.get(c.article_id) ?? 0) + 1);
  }

  // Enrich every article row with real word counts, bilingual parity & deterministic SEO checklist
  let totalViews = 0;
  let totalWords = 0;
  let publishedCount = 0;
  let draftCount = 0;
  let scheduledCount = 0;
  let bilingualCount = 0;
  let withCoverCount = 0;
  let seoFullyReadyCount = 0;
  let zeroViewPublishedCount = 0;

  const articles = articlesRaw.map((row) => {
    const views = Number(row.views || 0);
    const hasEn = Boolean(row.title_en && row.content_en);
    const hasFa = Boolean(row.title_fa && row.content_fa);
    const isBilingual = hasEn && hasFa;
    const hasCover = Boolean(row.cover_media_id);

    const wordsEn = estimateArticleWords(row.content_en);
    const wordsFa = estimateArticleWords(row.content_fa);
    const words =
      localeFilter === "fa"
        ? wordsFa
        : localeFilter === "en"
          ? wordsEn
          : Math.max(wordsEn, wordsFa);
    const readMinutes = Math.max(1, Math.round(words / 200));

    const seoTitle =
      localeFilter === "fa"
        ? row.seo_title_fa || row.title_fa
        : localeFilter === "en"
          ? row.seo_title_en || row.title_en
          : row.seo_title_en || row.seo_title_fa || row.title_en || row.title_fa;

    const seoDesc =
      localeFilter === "fa"
        ? row.seo_desc_fa || row.excerpt_fa
        : localeFilter === "en"
          ? row.seo_desc_en || row.excerpt_en
          : row.seo_desc_en || row.seo_desc_fa || row.excerpt_en || row.excerpt_fa;

    const excerpt =
      localeFilter === "fa"
        ? row.excerpt_fa
        : localeFilter === "en"
          ? row.excerpt_en
          : row.excerpt_en || row.excerpt_fa;

    const seo = computeSeoChecklist({
      seoTitle,
      seoDescription: seoDesc,
      hasCover,
      excerpt,
      isBilingual,
    });

    totalViews += views;
    totalWords += words;
    if (row.status === "published") {
      publishedCount += 1;
      if (views === 0) zeroViewPublishedCount += 1;
    } else if (row.status === "draft") {
      draftCount += 1;
    } else if (row.status === "scheduled") {
      scheduledCount += 1;
    }
    if (isBilingual) bilingualCount += 1;
    if (hasCover) withCoverCount += 1;
    if (seo.passed === seo.total) seoFullyReadyCount += 1;

    return {
      id: row.id,
      status: row.status,
      featured: Boolean(row.featured),
      trending: Boolean(row.trending),
      views,
      comments: commentCountByArticle.get(row.id) ?? 0,
      words,
      readMinutes,
      hasCover,
      isBilingual,
      hasFa,
      hasEn,
      publishedAt: row.published_at,
      fieldId: row.field_id,
      fieldNameEn: row.field_name_en,
      fieldNameFa: row.field_name_fa,
      fieldColor: row.field_color || "#7b3ffb",
      authorId: row.author_id,
      authorNameEn: row.author_name_en,
      authorNameFa: row.author_name_fa,
      titleEn: row.title_en || row.title_fa || "Untitled",
      titleFa: row.title_fa || row.title_en || "بدون عنوان",
      slugEn: row.slug_en || row.slug_fa || "",
      slugFa: row.slug_fa || row.slug_en || "",
      seoPassed: seo.passed,
      seoTotal: seo.total,
      seoMissing: seo.missing as SeoMissingKey[],
    };
  });

  // Scientific fields efficiency matrix
  const fieldMap = new Map<
    string,
    {
      id: string;
      slug: string;
      nameEn: string;
      nameFa: string;
      color: string;
      articles: number;
      views: number;
      comments: number;
      words: number;
    }
  >();

  for (const f of fieldsRaw) {
    fieldMap.set(f.id, {
      id: f.id,
      slug: f.slug,
      nameEn: f.name_en,
      nameFa: f.name_fa,
      color: f.color,
      articles: 0,
      views: 0,
      comments: 0,
      words: 0,
    });
  }
  for (const a of articles) {
    if (a.status !== "published" || !a.fieldId) continue;
    const target = fieldMap.get(a.fieldId);
    if (!target) continue;
    target.articles += 1;
    target.views += a.views;
    target.comments += a.comments;
    target.words += a.words;
  }

  const publishedTotalViews = Math.max(
    1,
    articles.filter((a) => a.status === "published").reduce((s, a) => s + a.views, 0)
  );
  const fieldsMatrix = [...fieldMap.values()]
    .map((f) => ({
      ...f,
      avgViews: f.articles > 0 ? Math.round(f.views / f.articles) : 0,
      viewShare: f.views > 0 ? Math.round((f.views / publishedTotalViews) * 100) : 0,
    }))
    .sort((a, b) => b.views - a.views || b.articles - a.articles);

  // Author impact leaderboard
  const authorMap = new Map<
    string,
    {
      id: string;
      slug: string;
      nameEn: string;
      nameFa: string;
      articles: number;
      views: number;
      comments: number;
      words: number;
    }
  >();
  for (const au of authorsRaw) {
    authorMap.set(au.id, {
      id: au.id,
      slug: au.slug,
      nameEn: au.name_en,
      nameFa: au.name_fa,
      articles: 0,
      views: 0,
      comments: 0,
      words: 0,
    });
  }
  for (const a of articles) {
    if (a.status !== "published" || !a.authorId) continue;
    const target = authorMap.get(a.authorId);
    if (!target) continue;
    target.articles += 1;
    target.views += a.views;
    target.comments += a.comments;
    target.words += a.words;
  }
  const authorLeaderboard = [...authorMap.values()]
    .map((au) => ({
      ...au,
      avgViews: au.articles > 0 ? Math.round(au.views / au.articles) : 0,
    }))
    .sort((a, b) => b.views - a.views || b.articles - a.articles);

  // Comments & Q&A engagement breakdown
  let approvedComments = 0;
  let pendingComments = 0;
  let rejectedComments = 0;
  let totalQuestions = 0;
  let answeredQuestions = 0;
  for (const c of scopedComments) {
    if (c.status === "approved") approvedComments += 1;
    else if (c.status === "pending") pendingComments += 1;
    else if (c.status === "rejected") rejectedComments += 1;
    if (c.is_question) {
      totalQuestions += 1;
      if (c.admin_reply && c.admin_reply.trim().length > 0) answeredQuestions += 1;
    }
  }
  const totalComments = scopedComments.length;
  const approvalRatePct = totalComments > 0 ? Math.round((approvedComments / totalComments) * 100) : 0;
  const qaReplyRatePct = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

  // Subscribers retention & locale split
  const activeSubs = scopedSubscribers.filter((s) => s.status === "subscribed");
  const unsubscribedCount = scopedSubscribers.filter((s) => s.status === "unsubscribed").length;
  const retentionPct =
    scopedSubscribers.length > 0
      ? Math.round((activeSubs.length / scopedSubscribers.length) * 100)
      : 100;
  const subsLocaleFa = subscribersRaw.filter((s) => s.status === "subscribed" && s.locale === "fa").length;
  const subsLocaleEn = subscribersRaw.filter((s) => s.status === "subscribed" && s.locale === "en").length;

  // Live traffic breakdown (locale, device, referrers) within selected window
  const cutoffMs = nowMs - rangeDays * 86_400_000;
  const recentPageviews = scopedPageviews.filter((p) => {
    const ms = toTimestampMs(p.created_at);
    return !Number.isNaN(ms) && ms >= cutoffMs;
  });

  const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };
  const liveLocaleCounts = { fa: 0, en: 0 };
  const referrerMap = new Map<string, number>();

  for (const p of recentPageviews) {
    if (p.device_type === "mobile") deviceCounts.mobile += 1;
    else if (p.device_type === "tablet") deviceCounts.tablet += 1;
    else deviceCounts.desktop += 1;

    if (p.locale === "en") liveLocaleCounts.en += 1;
    else liveLocaleCounts.fa += 1;

    const host = p.referrer_host || "Direct";
    referrerMap.set(host, (referrerMap.get(host) ?? 0) + 1);
  }

  const topReferrers = [...referrerMap.entries()]
    .map(([host, count]) => ({
      host,
      count,
      share: recentPageviews.length > 0 ? Math.round((count / recentPageviews.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Period-over-period deltas
  const pvWin = countInWindows(
    scopedPageviews.map((p) => p.created_at),
    rangeDays,
    nowMs
  );
  const subWin = countInWindows(
    scopedSubscribers.map((s) => s.created_at),
    rangeDays,
    nowMs
  );
  const commentWin = countInWindows(
    scopedComments.map((c) => c.created_at),
    rangeDays,
    nowMs
  );
  const activityWin = countInWindows(
    activityRaw.map((a) => a.created_at),
    rangeDays,
    nowMs
  );

  // Media footprint audit
  let mediaTotalBytes = 0;
  const mediaByFormat: Record<string, { count: number; bytes: number }> = {};
  for (const m of mediaRaw) {
    const bytes = Number(m.size_bytes || 0);
    mediaTotalBytes += bytes;
    const fmt = (m.mime_type || "other").replace(/^image\//, "").toUpperCase();
    if (!mediaByFormat[fmt]) mediaByFormat[fmt] = { count: 0, bytes: 0 };
    mediaByFormat[fmt].count += 1;
    mediaByFormat[fmt].bytes += bytes;
  }

  // AI API totals
  const aiTotalRequests = apiKeysRaw.reduce((sum, k) => sum + Number(k.request_count || 0), 0);
  const aiActiveKeys = apiKeysRaw.filter((k) => k.status === "active").length;

  const coverage = computeEditorialCoverage({
    totalArticles: articles.length,
    bilingualCount,
    withCoverCount,
  });

  // Time-series trends
  const pageviewTrend = buildDailyTrend(
    scopedPageviews.map((p) => p.created_at),
    rangeDays,
    now
  );
  const activityTrend = buildDailyTrend(
    activityRaw.map((a) => a.created_at),
    rangeDays,
    now
  );
  const subscriberTrend = buildDailyTrend(
    scopedSubscribers.map((s) => s.created_at),
    rangeDays,
    now
  );
  const commentTrend = buildDailyTrend(
    scopedComments.map((c) => c.created_at),
    rangeDays,
    now
  );

  // 12-week editorial & activity cadence heatmap
  const heatmap = buildHeatmapGrid(
    [
      ...activityRaw.map((a) => a.created_at),
      ...articlesRaw.map((a) => a.published_at || a.created_at),
    ],
    12,
    now
  );

  return NextResponse.json({
    rangeDays,
    localeFilter,
    generatedAt: now.toISOString(),
    kpis: {
      totalViews,
      avgViewsPerEssay: publishedCount > 0 ? Math.round(totalViews / publishedCount) : 0,
      livePageviewsDelta: computePeriodDelta(pvWin.current, pvWin.previous),
      publishedCount,
      draftCount,
      scheduledCount,
      totalArticles: articles.length,
      totalWords,
      avgWordsPerEssay: articles.length > 0 ? Math.round(totalWords / articles.length) : 0,
      avgReadMinutes: articles.length > 0 ? Math.max(1, Math.round(totalWords / articles.length / 200)) : 0,
      activeSubscribers: activeSubs.length,
      unsubscribedCount,
      retentionPct,
      subscribersDelta: computePeriodDelta(subWin.current, subWin.previous),
      totalComments,
      approvedComments,
      pendingComments,
      rejectedComments,
      approvalRatePct,
      totalQuestions,
      answeredQuestions,
      qaReplyRatePct,
      commentsDelta: computePeriodDelta(commentWin.current, commentWin.previous),
      activityDelta: computePeriodDelta(activityWin.current, activityWin.previous),
      seoFullyReadyCount,
      seoReadyPct: articles.length > 0 ? Math.round((seoFullyReadyCount / articles.length) * 100) : 0,
      zeroViewPublishedCount,
      coverage,
      aiTotalRequests,
      aiActiveKeys,
    },
    trends: {
      pageviews: pageviewTrend,
      activity: activityTrend,
      subscribers: subscriberTrend,
      comments: commentTrend,
    },
    audience: {
      livePageviewsInRange: recentPageviews.length,
      liveLocales: liveLocaleCounts,
      subscriberLocales: { fa: subsLocaleFa, en: subsLocaleEn },
      devices: deviceCounts,
      topReferrers,
    },
    fieldsMatrix,
    authorLeaderboard,
    articles,
    topTags: tagsRaw.map((t) => ({
      id: t.id,
      slug: t.slug,
      nameEn: t.name_en,
      nameFa: t.name_fa,
      articleCount: Number(t.article_count || 0),
      totalViews: Number(t.total_views || 0),
    })),
    mediaAudit: {
      totalFiles: mediaRaw.length,
      totalBytes: mediaTotalBytes,
      avgBytes: mediaRaw.length > 0 ? Math.round(mediaTotalBytes / mediaRaw.length) : 0,
      formats: Object.entries(mediaByFormat)
        .map(([format, stats]) => ({ format, ...stats }))
        .sort((a, b) => b.bytes - a.bytes),
    },
    heatmap,
  });
}
