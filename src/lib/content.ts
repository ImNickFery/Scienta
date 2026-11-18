import GithubSlugger from "github-slugger";
import readingTime from "reading-time";
import { query, queryOne } from "./db";
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
  tags: string | null; // comma-joined via GROUP_CONCAT
}

const BASE_SELECT = `
  SELECT
    a.id, f.slug AS field_slug, f.color AS field_color, c.slug AS category_slug,
    au.slug AS author_slug, au.name_fa AS author_name_fa, au.name_en AS author_name_en,
    a.status, a.featured, a.trending, a.views, a.published_at, a.updated_at,
    t.title, t.slug, t.excerpt, t.content,
    (SELECT GROUP_CONCAT(tg.name_fa, '::', tg.name_en SEPARATOR '||')
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
  const tags = row.tags
    ? row.tags.split("||").map((pair) => {
        const [fa, en] = pair.split("::");
        return locale === "fa" ? fa : en;
      })
    : [];

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
    authorSlug: row.author_slug ?? "",
    authorName: (locale === "fa" ? row.author_name_fa : row.author_name_en) ?? "",
    publishedAt: row.published_at ?? row.updated_at,
    views: row.views,
    featured: !!row.featured,
    trending: !!row.trending,
  };

  return {
    ...frontmatter,
    content: row.content,
    readingTimeMinutes: Math.max(1, Math.ceil(stats.minutes)),
  };
}

export async function getAllArticles(locale: Locale, opts: { includeUnpublished?: boolean } = {}): Promise<Article[]> {
  const statusClause = opts.includeUnpublished ? "" : "AND a.status = 'published'";
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} ${statusClause} ORDER BY a.published_at DESC, a.created_at DESC`,
    [locale]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getArticle(locale: Locale, slug: string): Promise<Article | null> {
  const row = await queryOne<ArticleRow>(
    `${BASE_SELECT} AND a.status = 'published' AND t.slug = ? LIMIT 1`,
    [locale, slug]
  );
  return row ? rowToArticle(row, locale) : null;
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
    `${BASE_SELECT} AND a.status = 'published' AND a.featured = 1 ORDER BY a.published_at DESC LIMIT 6`,
    [locale]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getTrendingArticles(locale: Locale): Promise<Article[]> {
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND a.status = 'published' AND a.trending = 1 ORDER BY a.views DESC LIMIT 6`,
    [locale]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getArticlesByField(locale: Locale, field: FieldSlug): Promise<Article[]> {
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND a.status = 'published' AND f.slug = ? ORDER BY a.published_at DESC`,
    [locale, field]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getRelatedArticles(locale: Locale, current: Article, limit = 3): Promise<Article[]> {
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND a.status = 'published' AND f.slug = ? AND t.slug != ? ORDER BY a.published_at DESC LIMIT ?`,
    [locale, current.field, current.slug, limit]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getMostViewedArticles(locale: Locale, limit = 5): Promise<Article[]> {
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND a.status = 'published' ORDER BY a.views DESC LIMIT ?`,
    [locale, limit]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function searchArticles(locale: Locale, search: string): Promise<Article[]> {
  const q = search.trim();
  if (!q) return [];
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND a.status = 'published' AND MATCH(t.title, t.excerpt, t.content) AGAINST (? IN NATURAL LANGUAGE MODE)
     ORDER BY a.published_at DESC LIMIT 30`,
    [locale, q]
  );
  return rows.map((r) => rowToArticle(r, locale));
}

export async function getAllTags(locale: Locale): Promise<{ tag: string; count: number }[]> {
  const rows = await query<{ name: string; count: number }>(
    `SELECT ${locale === "fa" ? "tg.name_fa" : "tg.name_en"} AS name, COUNT(*) AS count
     FROM article_tags atg
     JOIN tags tg ON tg.id = atg.tag_id
     JOIN articles a ON a.id = atg.article_id AND a.status = 'published' AND a.deleted_at IS NULL
     GROUP BY tg.id
     ORDER BY count DESC`
  );
  return rows.map((r) => ({ tag: r.name, count: r.count }));
}

export async function getArticlesByTag(locale: Locale, tag: string): Promise<Article[]> {
  const nameCol = locale === "fa" ? "tg.name_fa" : "tg.name_en";
  const rows = await query<ArticleRow>(
    `${BASE_SELECT} AND a.status = 'published' AND a.id IN (
       SELECT atg.article_id FROM article_tags atg JOIN tags tg ON tg.id = atg.tag_id WHERE ${nameCol} = ?
     ) ORDER BY a.published_at DESC`,
    [locale, tag]
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
  await query(`UPDATE articles SET views = views + 1 WHERE id = ?`, [articleId]);
}
