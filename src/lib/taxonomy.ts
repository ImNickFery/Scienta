import { query, queryOne } from "./db";
import type { Author, FieldSlug } from "@/types";

export interface FieldRecord {
  slug: FieldSlug;
  name: { fa: string; en: string };
  color: string;
  icon: string;
  articleCount?: number;
}

interface FieldRow {
  slug: FieldSlug;
  name_fa: string;
  name_en: string;
  color: string;
  icon: string;
  article_count: number;
}

export async function getFields(): Promise<FieldRecord[]> {
  const rows = await query<FieldRow>(
    `SELECT f.slug, f.name_fa, f.name_en, f.color, f.icon,
            (SELECT COUNT(*) FROM articles a WHERE a.field_id = f.id AND a.status='published' AND a.deleted_at IS NULL) AS article_count
     FROM fields f
     WHERE f.deleted_at IS NULL
     ORDER BY f.sort_order ASC`
  );
  return rows.map((r) => ({
    slug: r.slug,
    name: { fa: r.name_fa, en: r.name_en },
    color: r.color,
    icon: r.icon,
    articleCount: r.article_count,
  }));
}

export async function getFieldBySlug(slug: string): Promise<FieldRecord | null> {
  const row = await queryOne<FieldRow>(
    `SELECT f.slug, f.name_fa, f.name_en, f.color, f.icon,
            (SELECT COUNT(*) FROM articles a WHERE a.field_id = f.id AND a.status='published' AND a.deleted_at IS NULL) AS article_count
     FROM fields f WHERE f.slug = ? AND f.deleted_at IS NULL LIMIT 1`,
    [slug]
  );
  if (!row) return null;
  return {
    slug: row.slug,
    name: { fa: row.name_fa, en: row.name_en },
    color: row.color,
    icon: row.icon,
    articleCount: row.article_count,
  };
}

interface AuthorRow {
  slug: string;
  name_fa: string;
  name_en: string;
  title_fa: string | null;
  title_en: string | null;
  bio_fa: string | null;
  bio_en: string | null;
  avatar_url: string | null;
  social_json: string | null;
}

export function safeParseSocialJson(raw: string | null | undefined): Author["social"] {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return parsed as Author["social"];
  } catch {
    return undefined;
  }
}

function rowToAuthor(row: AuthorRow): Author {
  return {
    slug: row.slug,
    name: { fa: row.name_fa, en: row.name_en },
    title: { fa: row.title_fa ?? "", en: row.title_en ?? "" },
    bio: { fa: row.bio_fa ?? "", en: row.bio_en ?? "" },
    avatar: row.avatar_url ?? "",
    social: safeParseSocialJson(row.social_json),
  };
}

export async function getAuthors(): Promise<Author[]> {
  const rows = await query<AuthorRow>(
    `SELECT slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en, avatar_url, social_json
     FROM authors WHERE deleted_at IS NULL ORDER BY name_en ASC`
  );
  return rows.map(rowToAuthor);
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const row = await queryOne<AuthorRow>(
    `SELECT slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en, avatar_url, social_json
     FROM authors WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
    [slug]
  );
  return row ? rowToAuthor(row) : null;
}
