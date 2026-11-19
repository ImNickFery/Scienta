import GithubSlugger from "github-slugger";
import readingTime from "reading-time";
import { query, queryOne, execute } from "./db";
import type { Article, ArticleFrontmatter, FieldSlug, TocItem } from "@/types";
import type { Locale } from "@/lib/i18n/config";

interface ArticleRow {
  id: string;
  field_slug: FieldSlug | null;
  field_color: string | null;
  category_slug: string | null;
  author_slug: string | null;
  author_name_fa: string | null;
  author_name_en: string | null;
  status: "draft" | "published" | "scheduled";
  featured: number;
  trending: number;
  views: number;
  published_at: string | null;
  updated_at: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  canonical_url: string | null;
  twitter_card: string | null;
  tags: string | null; // comma-joined via GROUP_CONCAT
}

/** Matches published articles as well as scheduled articles whose publish time has arrived. */
const LIVE_STATUS_SQL = "(a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at IS NOT NULL AND a.scheduled_at <= NOW()))";

const BASE_SELECT = `
  SELECT
    a.id, f.slug AS field_slug, f.color AS field_color, c.slug AS category_slug,
    au.slug AS author_slug, au.name_fa AS author_name_fa, au.name_en AS author_name_en,
    a.status, a.featured, a.trending, a.views, a.published_at, a.updated_at,
    t.title, t.slug, t.excerpt, t.content,
    t.seo_title, t.seo_description, t.seo_keywords, t.canonical_url, t.twitter_card,
    (SELECT GROUP_CONCAT(tg.slug, '::', tg.name_fa, '::', tg.name_en SEPARATOR '||')
       FROM article_tags atg JOIN tags tg ON tg.id = atg.tag_id
      WHERE atg.article_id = a.id) AS tags
  FROM articles a
  JOIN article_translations t ON t.article_id = a.id AND t.locale = ?
  LEFT JOIN fields f ON f.id = a.field_id
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN authors au ON au.id = a.author_id
  WHERE a.deleted_at IS NULL
`;

function rowToArticle(row: ArticleRow, locale: Locale): Article {
  const stats = readingTime(row.content);
  const tagItems = row.tags
    ? row.tags
        .split("||")
        .map((entry) => {
          const parts = entry.split("::");
          if (parts.length >= 3) {
            const [slug, fa, en] = parts;
            return { slug, name: locale === "fa" ? fa : en };
          }
          const [fa, en] = parts;
          const label = locale === "fa" ? fa : en;
          return { slug: encodeURIComponent(en || fa), name: label };
        })
        .filter((t) => Boolean(t.slug && t.name))
    : [];
  const tags = tagItems.map((t) => t.name);

  const frontmatter: ArticleFrontmatter = {
    id: row.id,
    slug: row.slug,
    locale,
    title: row.title,
    excerpt: row.excerpt ?? "",
    cover: "", // resolved separately when needed via media join; placeholder gradient used in UI
    field: (row.field_slug ?? "physics") as FieldSlug,
    fieldColor: row.field_color ?? "#7B3FFB",
    tags,
    tagItems,
    authorSlug: row.author_slug ?? "",
    authorName: (locale === "fa" ? row.author_name_fa : row.author_name_en) ?? "",
    publishedAt: row.published_at ?? row.updated_at,
    updatedAt: row.updated_at,
    views: row.views,
    featured: !!row.featured,
    trending: !!row.trending,
    seoTitle: row.seo_title || undefined,
    seoDescription: row.seo_description || undefined,
    seoKeywords: row.seo_keywords || undefined,
    canonicalUrl: row.canonical_url || undefined,
    twitterCard: row.twitter_card === "summary" ? "summary" : "summary_large_image",
  };

  return {
    ...frontmatter,
    content: row.content,
    readingTimeMinutes: Math.max(1, Math.ceil(stats.minutes)),
  };
}

/** Strips heavy MDX body before passing article summaries to Client Components or JSON APIs. */
export function stripArticleContent(article: Article): Article {
  return { ...article, content: "" };
}

export async function getAllArticles(locale: Locale, opts: { includeUnpublished?: boolean } = {}): Promise<Article[]> {
  const statusClause = opts.includeUnpublished ? "" : `AND ${LIVE_STATUS_SQL}`;
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} ${statusClause} ORDER BY a.published_at DESC, a.created_at DESC`,
    [locale]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getArticle(locale: Locale, slug: string): Promise<Article | null> {
  const row = await queryOne<ArticleRow>(
    `${BASE_SELECT} AND ${LIVE_STATUS_SQL} AND t.slug = ? LIMIT 1`,
    [locale, slug]
  );
  return row ? rowToArticle(row, locale) : null;
}

/** Returns the per-locale slugs for a given article id (used for hreflang SEO & locale switching). */
export async function getArticleLocaleSlugs(articleId: string): Promise<Partial<Record<Locale, string>>> {
  const rows = await query<{ locale: Locale; slug: string }>(
    `SELECT locale, slug FROM article_translations WHERE article_id = ?`,
    [articleId]
  );
  const result: Partial<Record<Locale, string>> = {};
  for (const row of rows) {
    result[row.locale] = row.slug;
  }
  return result;
}

export interface AdjacentArticleLink {
  slug: string;
  title: string;
}

/** Fetches only the immediate previous and next article links without loading all MDX bodies. */
export async function getAdjacentArticles(
  locale: Locale,
  articleId: string
): Promise<{ prev: AdjacentArticleLink | null; next: AdjacentArticleLink | null }> {
  const rows = await query<{ id: string; slug: string; title: string }>(
    `SELECT a.id, t.slug, t.title
     FROM articles a
     JOIN article_translations t ON t.article_id = a.id AND t.locale = ?
     WHERE a.deleted_at IS NULL AND ${LIVE_STATUS_SQL}
     ORDER BY a.published_at DESC, a.created_at DESC`,
    [locale]
  );
  const idx = rows.findIndex((r) => r.id === articleId);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? { slug: rows[idx - 1].slug, title: rows[idx - 1].title } : null,
    next: idx < rows.length - 1 ? { slug: rows[idx + 1].slug, title: rows[idx + 1].title } : null,
  };
}

/** Used by the admin panel — fetches regardless of status, keyed by article id. */
export async function getArticleByIdAnyStatus(locale: Locale, articleId: string): Promise<Article | null> {
  const row = await queryOne<ArticleRow>(
    `${BASE_SELECT.replace("WHERE a.deleted_at IS NULL", "WHERE a.deleted_at IS NULL AND a.id = ?")} LIMIT 1`,
    [locale, articleId]
  );
  return row ? rowToArticle(row, locale) : null;
}

export async function getFeaturedArticles(locale: Locale): Promise<Article[]> {
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND ${LIVE_STATUS_SQL} AND a.featured = 1 ORDER BY a.published_at DESC LIMIT 6`,
    [locale]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getTrendingArticles(locale: Locale): Promise<Article[]> {
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND ${LIVE_STATUS_SQL} AND a.trending = 1 ORDER BY a.views DESC LIMIT 6`,
    [locale]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getArticlesByField(locale: Locale, field: FieldSlug): Promise<Article[]> {
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND ${LIVE_STATUS_SQL} AND f.slug = ? ORDER BY a.published_at DESC`,
    [locale, field]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getRelatedArticles(locale: Locale, current: Article, limit = 3): Promise<Article[]> {
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND ${LIVE_STATUS_SQL} AND f.slug = ? AND t.slug != ? ORDER BY a.published_at DESC LIMIT ?`,
    [locale, current.field, current.slug, limit]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getMostViewedArticles(locale: Locale, limit = 5): Promise<Article[]> {
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND ${LIVE_STATUS_SQL} ORDER BY a.views DESC LIMIT ?`,
    [locale, limit]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function searchArticles(locale: Locale, search: string): Promise<Article[]> {
  const q = search.trim();
  if (!q) return [];
  const like = `%${q}%`;
  const authorCol = locale === "fa" ? "au.name_fa" : "au.name_en";
  const tagCol = locale === "fa" ? "tg.name_fa" : "tg.name_en";
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND ${LIVE_STATUS_SQL} AND (
       t.title LIKE ? OR t.excerpt LIKE ? OR t.content LIKE ? OR ${authorCol} LIKE ? OR EXISTS (
         SELECT 1 FROM article_tags atg2 JOIN tags tg ON tg.id = atg2.tag_id
         WHERE atg2.article_id = a.id AND ${tagCol} LIKE ?
       )
     )
     ORDER BY a.published_at DESC LIMIT 30`,
    [locale, like, like, like, like, like]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getAllTags(locale: Locale): Promise<{ tag: string; count: number }[]> {
  const rows = await query<{ name: string; count: number }>(
    `SELECT ${locale === "fa" ? "tg.name_fa" : "tg.name_en"} AS name, COUNT(*) AS count
     FROM article_tags atg
     JOIN tags tg ON tg.id = atg.tag_id
     JOIN articles a ON a.id = atg.article_id AND ${LIVE_STATUS_SQL} AND a.deleted_at IS NULL
     GROUP BY tg.id
     ORDER BY count DESC`
  );
  return rows.map((r) => ({ tag: r.name, count: r.count }));
}

export async function getArticlesByTag(locale: Locale, tag: string): Promise<Article[]> {
  const nameCol = locale === "fa" ? "tg.name_fa" : "tg.name_en";
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND ${LIVE_STATUS_SQL} AND a.id IN (
       SELECT atg.article_id FROM article_tags atg JOIN tags tg ON tg.id = atg.tag_id WHERE ${nameCol} = ? OR tg.slug = ?
     ) ORDER BY a.published_at DESC`,
    [locale, tag, tag]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export interface TagRecord {
  slug: string;
  name: { fa: string; en: string };
  count: number;
}

export async function getAllTagRecords(): Promise<TagRecord[]> {
  const rows = await query<{ slug: string; name_fa: string; name_en: string; count: number }>(
    `SELECT tg.slug, tg.name_fa, tg.name_en, COUNT(a.id) AS count
     FROM tags tg
     LEFT JOIN article_tags atg ON atg.tag_id = tg.id
     LEFT JOIN articles a ON a.id = atg.article_id AND ${LIVE_STATUS_SQL} AND a.deleted_at IS NULL
     GROUP BY tg.id, tg.slug, tg.name_fa, tg.name_en
     ORDER BY count DESC, tg.name_en ASC`
  );
  return rows.map((r) => ({
    slug: r.slug,
    name: { fa: r.name_fa, en: r.name_en },
    count: Number(r.count ?? 0),
  }));
}

export async function getTagBySlug(slug: string): Promise<TagRecord | null> {
  const row = await queryOne<{ slug: string; name_fa: string; name_en: string; count: number }>(
    `SELECT tg.slug, tg.name_fa, tg.name_en, COUNT(a.id) AS count
     FROM tags tg
     LEFT JOIN article_tags atg ON atg.tag_id = tg.id
     LEFT JOIN articles a ON a.id = atg.article_id AND ${LIVE_STATUS_SQL} AND a.deleted_at IS NULL
     WHERE tg.slug = ?
     GROUP BY tg.id, tg.slug, tg.name_fa, tg.name_en
     LIMIT 1`,
    [slug]
  );
  if (!row) return null;
  return {
    slug: row.slug,
    name: { fa: row.name_fa, en: row.name_en },
    count: Number(row.count ?? 0),
  };
}

export async function getArticlesByTagSlug(locale: Locale, slug: string): Promise<Article[]> {
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND ${LIVE_STATUS_SQL} AND a.id IN (
       SELECT atg.article_id FROM article_tags atg JOIN tags tg ON tg.id = atg.tag_id WHERE tg.slug = ?
     ) ORDER BY a.published_at DESC`,
    [locale, slug]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

/** Extracts a table of contents from MDX markdown headings (## / ###), matching rehype-slug's id algorithm. */
export function extractToc(content: string): TocItem[] {
  const slugger = new GithubSlugger();
  const lines = content.split("\n");
  const items: TocItem[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (match) {
      const depth = match[1].length;
      const text = match[2].replace(/[*_`]/g, "").trim();
      items.push({ id: slugger.slug(text), text, depth });
    }
  }
  return items;
}

export async function incrementArticleViews(articleId: string): Promise<void> {
  await execute(`UPDATE articles SET views = views + 1 WHERE id = ?`, [articleId]);
}
