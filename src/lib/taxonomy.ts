import { cache } from "react";
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

const LIVE_STATUS_SQL =
  "(a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at IS NOT NULL AND a.scheduled_at <= NOW()))";

export const getFields = cache(async (): Promise<FieldRecord[]> => {
  const rows = await query<FieldRow>(
    `SELECT f.slug, f.name_fa, f.name_en, f.color, f.icon,
            COUNT(a.id) AS article_count
     FROM fields f
     LEFT JOIN articles a
       ON a.field_id = f.id
      AND ${LIVE_STATUS_SQL}
      AND a.deleted_at IS NULL
     WHERE f.deleted_at IS NULL
     GROUP BY f.id, f.slug, f.name_fa, f.name_en, f.color, f.icon, f.sort_order
     ORDER BY f.sort_order ASC`
  );
  return rows.map((r) => ({
    slug: r.slug,
    name: { fa: r.name_fa, en: r.name_en },
    color: r.color,
    icon: r.icon,
    articleCount: Number(r.article_count ?? 0),
  }));
});

export const getFieldBySlug = cache(async (slug: string): Promise<FieldRecord | null> => {
  const row = await queryOne<FieldRow>(
    `SELECT f.slug, f.name_fa, f.name_en, f.color, f.icon,
            COUNT(a.id) AS article_count
     FROM fields f
     LEFT JOIN articles a
       ON a.field_id = f.id
      AND ${LIVE_STATUS_SQL}
      AND a.deleted_at IS NULL
     WHERE f.slug = ? AND f.deleted_at IS NULL
     GROUP BY f.id, f.slug, f.name_fa, f.name_en, f.color, f.icon
     LIMIT 1`,
    [slug]
  );
  if (!row) return null;
  return {
    slug: row.slug,
    name: { fa: row.name_fa, en: row.name_en },
    color: row.color,
    icon: row.icon,
    articleCount: Number(row.article_count ?? 0),
  };
});

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

export const getAuthors = cache(async (): Promise<Author[]> => {
  const rows = await query<AuthorRow>(
    `SELECT slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en, avatar_url, social_json
     FROM authors WHERE deleted_at IS NULL ORDER BY name_en ASC`
  );
  return rows.map(rowToAuthor);
});

export const getAuthorBySlug = cache(async (slug: string): Promise<Author | null> => {
  const row = await queryOne<AuthorRow>(
    `SELECT slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en, avatar_url, social_json
     FROM authors WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
    [slug]
  );
  return row ? rowToAuthor(row) : null;
});
