import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { SEED_ARTICLES, SEED_AUTHORS, SEED_FIELDS, SEED_MEDIA } from "./seed-data";
import {
  LruCache,
  SQLITE_INDEX_STATEMENTS,
  STATEMENT_CACHE_MAX_SIZE,
  type LruCacheStats,
} from "./db-optimizer-core";

type SqliteParam = null | number | bigint | string | Uint8Array;

interface SqliteRunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

interface SqliteStatement {
  all: (...params: SqliteParam[]) => Record<string, unknown>[];
  get: (...params: SqliteParam[]) => Record<string, unknown> | undefined;
  run: (...params: SqliteParam[]) => SqliteRunResult;
}

interface SqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
}

export interface SqliteResultHeader {
  affectedRows: number;
  insertId: number;
}

export interface SqliteConnection {
  query: <T = unknown>(sql: string, params?: unknown[]) => Promise<[T[], unknown[]]>;
  execute: (sql: string, params?: unknown[]) => Promise<[SqliteResultHeader, unknown[]]>;
}

const DEFAULT_DB_PATH = "/tmp/scienta-local.sqlite";

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS roles (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  description TEXT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL,
  avatar_url TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  user_agent TEXT NULL,
  ip_address TEXT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS authors (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NULL,
  slug TEXT NOT NULL UNIQUE,
  name_fa TEXT NOT NULL,
  name_en TEXT NOT NULL,
  title_fa TEXT NULL,
  title_en TEXT NULL,
  bio_fa TEXT NULL,
  bio_en TEXT NULL,
  avatar_url TEXT NULL,
  social_json TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fields (
  id TEXT NOT NULL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_fa TEXT NOT NULL,
  name_en TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#7B3FFB',
  icon TEXT NOT NULL DEFAULT 'atom',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT NOT NULL PRIMARY KEY,
  parent_id TEXT NULL,
  slug TEXT NOT NULL UNIQUE,
  name_fa TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_fa TEXT NULL,
  description_en TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT NOT NULL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_fa TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT NOT NULL PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  path TEXT NOT NULL,
  thumbnail_path TEXT NULL,
  alt_text TEXT NULL,
  uploaded_by TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT NOT NULL PRIMARY KEY,
  field_id TEXT NULL,
  category_id TEXT NULL,
  author_id TEXT NULL,
  cover_media_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  featured INTEGER NOT NULL DEFAULT 0,
  trending INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NULL,
  scheduled_at TEXT NULL,
  created_by TEXT NULL,
  updated_by TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT NULL,
  FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE SET NULL,
  FOREIGN KEY (cover_media_id) REFERENCES media(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS article_translations (
  id TEXT NOT NULL PRIMARY KEY,
  article_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT NULL,
  content TEXT NOT NULL,
  seo_title TEXT NULL,
  seo_description TEXT NULL,
  seo_keywords TEXT NULL,
  canonical_url TEXT NULL,
  og_image_id TEXT NULL,
  twitter_card TEXT NOT NULL DEFAULT 'summary_large_image',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (article_id, locale),
  UNIQUE (locale, slug),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (og_image_id) REFERENCES media(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS article_tags (
  article_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS article_revisions (
  id TEXT NOT NULL PRIMARY KEY,
  article_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  editor_id TEXT NULL,
  note TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (editor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT NOT NULL PRIMARY KEY,
  article_id TEXT NOT NULL,
  parent_id TEXT NULL,
  locale TEXT NOT NULL DEFAULT 'fa',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  content TEXT NOT NULL,
  is_question INTEGER NOT NULL DEFAULT 0,
  admin_reply TEXT NULL,
  replied_at TEXT NULL,
  ip_address TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menus (
  id TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT NOT NULL PRIMARY KEY,
  menu_id TEXT NOT NULL,
  parent_id TEXT NULL,
  label_fa TEXT NOT NULL,
  label_en TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT NOT NULL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_fa TEXT NOT NULL,
  title_en TEXT NOT NULL,
  content_fa TEXT NULL,
  content_en TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL DEFAULT 'fa',
  status TEXT NOT NULL DEFAULT 'subscribed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  ip_address TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  meta_json TEXT NULL,
  ip_address TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  default_author_id TEXT NULL,
  rate_limit_per_min INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'active',
  request_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT NULL,
  last_used_ip TEXT NULL,
  expires_at TEXT NULL,
  revoked_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (default_author_id) REFERENCES authors(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  id TEXT NOT NULL PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  UNIQUE (api_key_id, idempotency_key),
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics_pageviews (
  id TEXT NOT NULL PRIMARY KEY,
  article_id TEXT NULL,
  locale TEXT NOT NULL DEFAULT 'fa',
  path TEXT NOT NULL,
  referrer_host TEXT NOT NULL DEFAULT 'Direct',
  device_type TEXT NOT NULL DEFAULT 'desktop',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function loadSqliteModule(): { DatabaseSync: new (filename: string) => SqliteDatabase } {
  const getter = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
  const mod = getter?.("node:sqlite") as { DatabaseSync?: new (filename: string) => SqliteDatabase } | undefined;
  if (!mod?.DatabaseSync) {
    throw new Error("Built-in node:sqlite is unavailable in this Node.js runtime.");
  }
  return { DatabaseSync: mod.DatabaseSync };
}

/**
 * Translates the subset of MySQL syntax used by this codebase into valid SQLite SQL.
 */
export function translateMysqlToSqlite(sql: string): string {
  let out = sql;

  // DATE_ADD(NOW(), INTERVAL ? SECOND) -> datetime('now', '+' || ? || ' seconds')
  out = out.replace(
    /DATE_ADD\(\s*NOW\(\)\s*,\s*INTERVAL\s+\?\s+SECOND\s*\)/gi,
    "datetime('now', '+' || ? || ' seconds')"
  );

  // NOW() -> datetime('now')
  out = out.replace(/\bNOW\(\)/gi, "datetime('now')");

  // GROUP_CONCAT(a, b, c SEPARATOR 'sep') -> GROUP_CONCAT(a || b || c, 'sep')
  out = out.replace(
    /GROUP_CONCAT\(\s*([^)]+?)\s+SEPARATOR\s+('[^']*')\s*\)/gi,
    (_match, exprList: string, sep: string) => {
      const parts = exprList.split(",").map((p) => p.trim()).filter(Boolean);
      return `GROUP_CONCAT(${parts.join(" || ")}, ${sep})`;
    }
  );

  // INSERT IGNORE INTO -> INSERT OR IGNORE INTO
  out = out.replace(/\bINSERT\s+IGNORE\s+INTO\b/gi, "INSERT OR IGNORE INTO");

  // ON DUPLICATE KEY UPDATE (used by subscribers table)
  out = out.replace(
    /\bON\s+DUPLICATE\s+KEY\s+UPDATE\s+status\s*=\s*'subscribed'/gi,
    "ON CONFLICT(email) DO UPDATE SET status = 'subscribed'"
  );

  // MATCH(col1, col2, col3) AGAINST (? IN NATURAL LANGUAGE MODE)
  out = out.replace(
    /MATCH\(\s*([^)]+)\s*\)\s+AGAINST\s*\(\s*\?\s+IN\s+NATURAL\s+LANGUAGE\s+MODE\s*\)/gi,
    (_match, cols: string) => {
      const parts = cols.split(",").map((c) => `COALESCE(${c.trim()}, '')`);
      return `instr(lower(${parts.join(" || ' ' || ")}), lower(?)) > 0`;
    }
  );

  return out;
}

export function normalizeSqliteParams(params: unknown[]): SqliteParam[] {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    if (typeof p === "number" || typeof p === "bigint" || typeof p === "string") return p;
    if (p instanceof Uint8Array) return p;
    if (p instanceof Date) return p.toISOString().slice(0, 19).replace("T", " ");
    return String(p);
  });
}

function mapSqliteError(err: unknown): Error {
  if (!(err instanceof Error)) return new Error(String(err));
  const msg = err.message ?? "";
  if (msg.includes("UNIQUE constraint failed: article_translations.locale, article_translations.slug")) {
    return new Error(`Duplicate entry for uq_locale_slug (${msg})`);
  }
  if (msg.includes("UNIQUE constraint failed")) {
    return new Error(`Duplicate entry (${msg})`);
  }
  return err;
}

function toPlainRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => ({ ...r })) as T[];
}

function seedIfEmpty(db: SqliteDatabase) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db.prepare(`SELECT COUNT(*) AS count FROM roles`).get() as { count?: number } | undefined;
    if (existing && Number(existing.count) > 0) {
      db.exec("COMMIT");
      return;
    }

    const roleIds = { super_admin: uuid(), admin: uuid(), editor: uuid() };
    const insertRole = db.prepare(`INSERT OR IGNORE INTO roles (id, name, label, description) VALUES (?, ?, ?, ?)`);
    insertRole.run(roleIds.super_admin, "super_admin", "Super Admin", "Full unrestricted access");
    insertRole.run(roleIds.admin, "admin", "Admin", "Manages content, settings, and users (view only)");
    insertRole.run(roleIds.editor, "editor", "Editor", "Manages articles and media");

    const permissionKeys = [
      "articles.manage", "categories.manage", "categories.view", "fields.manage", "fields.view",
      "tags.manage", "authors.manage", "authors.view", "media.manage", "settings.manage",
      "menus.manage", "pages.manage", "subscribers.manage", "messages.manage", "comments.manage", "logs.view",
      "users.view", "users.manage", "dashboard.view", "search.use", "backup.manage", "cache.manage", "api_keys.manage",
    ];
    const insertPerm = db.prepare(`INSERT OR IGNORE INTO permissions (id, "key") VALUES (?, ?)`);
    const permIds: Record<string, string> = {};
    for (const key of permissionKeys) {
      const id = uuid();
      permIds[key] = id;
      insertPerm.run(id, key);
    }

    const insertRolePerm = db.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`);
    const rolePermMap: Record<keyof typeof roleIds, string[]> = {
      super_admin: permissionKeys,
      admin: permissionKeys.filter((k) => k !== "users.manage"),
      editor: ["articles.manage", "categories.view", "fields.view", "tags.manage", "authors.view", "media.manage", "comments.manage", "dashboard.view", "search.use"],
    };
    for (const [roleName, perms] of Object.entries(rolePermMap)) {
      const rId = roleIds[roleName as keyof typeof roleIds];
      for (const permKey of perms) {
        insertRolePerm.run(rId, permIds[permKey]);
      }
    }

    const adminId = uuid();
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@scienta.ir";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe_2026!";
    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    db.prepare(
      `INSERT OR IGNORE INTO users (id, name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, ?, 'active')`
    ).run(adminId, "Super Admin", adminEmail, passwordHash, roleIds.super_admin);

    const fieldIds: Record<string, string> = {};
    const insertField = db.prepare(
      `INSERT OR IGNORE INTO fields (id, slug, name_fa, name_en, color, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    SEED_FIELDS.forEach((f, idx) => {
      const id = uuid();
      fieldIds[f.slug] = id;
      insertField.run(id, f.slug, f.name_fa, f.name_en, f.color, f.icon, idx);
    });

    const categoryId = uuid();
    db.prepare(`INSERT OR IGNORE INTO categories (id, slug, name_fa, name_en) VALUES (?, ?, ?, ?)`).run(
      categoryId,
      "deep-dive",
      "بررسی عمیق",
      "Deep Dive"
    );

    const authorIds: Record<string, string> = {};
    const insertAuthor = db.prepare(
      `INSERT OR IGNORE INTO authors (id, slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of SEED_AUTHORS) {
      const id = uuid();
      authorIds[a.slug] = id;
      insertAuthor.run(id, a.slug, a.name_fa, a.name_en, a.title_fa, a.title_en, a.bio_fa, a.bio_en);
    }

    const mediaIdsByFilename: Record<string, string> = {};
    const insertMedia = db.prepare(
      `INSERT OR IGNORE INTO media (id, filename, original_name, mime_type, size_bytes, width, height, path, thumbnail_path, alt_text, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const m of SEED_MEDIA) {
      const id = uuid();
      mediaIdsByFilename[m.filename] = id;
      insertMedia.run(
        id,
        m.filename,
        m.originalName,
        m.mimeType,
        m.sizeBytes,
        m.width,
        m.height,
        m.path,
        m.thumbnailPath,
        m.altText,
        adminId
      );
    }

    const insertArticle = db.prepare(
      `INSERT OR IGNORE INTO articles (id, field_id, category_id, author_id, cover_media_id, status, featured, trending, views, published_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?)`
    );
    const insertTranslation = db.prepare(
      `INSERT OR IGNORE INTO article_translations (id, article_id, locale, title, slug, excerpt, content, seo_title, seo_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const findTag = db.prepare(`SELECT id FROM tags WHERE slug = ?`);
    const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (id, slug, name_fa, name_en) VALUES (?, ?, ?, ?)`);
    const insertArticleTag = db.prepare(`INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)`);

    for (const article of SEED_ARTICLES) {
      const articleId = uuid();
      insertArticle.run(
        articleId,
        fieldIds[article.field] ?? null,
        categoryId,
        authorIds[article.authorSlug] ?? null,
        mediaIdsByFilename[article.coverFilename] ?? null,
        article.featured ? 1 : 0,
        article.trending ? 1 : 0,
        article.views,
        article.publishedAt,
        adminId,
        adminId
      );

      for (const locale of ["fa", "en"] as const) {
        const t = article[locale];
        insertTranslation.run(uuid(), articleId, locale, t.title, article.slug, t.excerpt, t.content, t.title, t.excerpt);
      }

      for (const tag of article.tags) {
        const existingTag = findTag.get(tag.slug) as { id?: string } | undefined;
        const tagId = existingTag?.id ?? uuid();
        if (!existingTag?.id) {
          insertTag.run(tagId, tag.slug, tag.name_fa, tag.name_en);
        }
        insertArticleTag.run(articleId, tagId);
      }
    }

    const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings ("key", "value") VALUES (?, ?)`);
    const defaultSettings: Record<string, string> = {
      site_title: JSON.stringify({ fa: "Scienta", en: "Scienta" }),
      site_description: JSON.stringify({
        fa: "پلتفرم علمی غوطه‌ور برای روایت‌های عمیق در فیزیک، فضا، هوش مصنوعی و ریاضیات.",
        en: "An immersive scientific platform for deep narratives in physics, space, AI, and mathematics.",
      }),
      logo_url: JSON.stringify(null),
      favicon_url: JSON.stringify(null),
      social_links: JSON.stringify({ twitter: "", instagram: "", telegram: "", linkedin: "" }),
      footer_text: JSON.stringify({ fa: "پلتفرمی برای کنجکاوهای علمی.", en: "A platform for the scientifically curious." }),
      homepage_sections: JSON.stringify(["hero", "featured", "fields", "latest", "trending"]),
    };
    for (const [k, v] of Object.entries(defaultSettings)) {
      insertSetting.run(k, v);
    }

    const insertMenu = db.prepare(`INSERT OR IGNORE INTO menus (id, "key", label) VALUES (?, ?, ?)`);
    insertMenu.run(uuid(), "primary", "Primary Navigation");
    insertMenu.run(uuid(), "footer", "Footer Links");

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function ensureCommentsSchemaAndSeed(db: SqliteDatabase) {
  const cols = db.prepare(`PRAGMA table_info(comments)`).all() as Array<{ name?: string }>;
  const existingCols = new Set(cols.map((c) => c.name));

  const migrations: Array<[string, string]> = [
    ["locale", `ALTER TABLE comments ADD COLUMN locale TEXT NOT NULL DEFAULT 'fa'`],
    ["is_question", `ALTER TABLE comments ADD COLUMN is_question INTEGER NOT NULL DEFAULT 0`],
    ["admin_reply", `ALTER TABLE comments ADD COLUMN admin_reply TEXT NULL`],
    ["replied_at", `ALTER TABLE comments ADD COLUMN replied_at TEXT NULL`],
    ["ip_address", `ALTER TABLE comments ADD COLUMN ip_address TEXT NULL`],
  ];
  for (const [col, ddl] of migrations) {
    if (!existingCols.has(col)) {
      db.exec(ddl);
    }
  }

  // Ensure comments.manage permission exists even on pre-seeded DBs
  const existingPerm = db.prepare(`SELECT id FROM permissions WHERE "key" = 'comments.manage'`).get() as
    | { id?: string }
    | undefined;
  if (!existingPerm?.id) {
    const permId = uuid();
    db.prepare(`INSERT OR IGNORE INTO permissions (id, "key") VALUES (?, 'comments.manage')`).run(permId);
    const roles = db.prepare(`SELECT id FROM roles`).all() as Array<{ id?: string }>;
    const link = db.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`);
    for (const r of roles) {
      if (r.id) link.run(r.id, permId);
    }
  }

  const countRow = db.prepare(`SELECT COUNT(*) AS count FROM comments`).get() as { count?: number } | undefined;
  if (countRow && Number(countRow.count) > 0) return;

  const bhRow = db
    .prepare(
      `SELECT article_id FROM article_translations WHERE slug = 'geometry-of-black-holes' LIMIT 1`
    )
    .get() as { article_id?: string } | undefined;
  if (!bhRow?.article_id) return;

  const insertComment = db.prepare(
    `INSERT OR IGNORE INTO comments (id, article_id, locale, name, email, content, is_question, admin_reply, replied_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertComment.run(
    uuid(),
    bhRow.article_id,
    "fa",
    "دکتر سهراب مرادی",
    "sohrab.moradi@example.edu",
    "آیا در متریک کر، اگر تکانه زاویه‌ای $a = J/(Mc)$ به حد بحرانی $a \\to GM/c^2$ برسد، شعاع افق بیرونی $r_+ = \\frac{GM}{c^2} + \\sqrt{\\left(\\frac{GM}{c^2}\\right)^2 - a^2}$ به نصف شعاع شوارتزشیلد میل می‌کند؟",
    1,
    "دقیقاً! در سیاه‌چاله کر حدی (Extremal Kerr) با $a = r_s / 2$ عبارت زیر رادیکال صفر می‌شود و افق رویداد روی $r_+ = \\frac{GM}{c^2} = \\frac{1}{2} r_s$ قرار می‌گیرد.",
    new Date().toISOString().slice(0, 19).replace("T", " "),
    "approved"
  );

  insertComment.run(
    uuid(),
    bhRow.article_id,
    "en",
    "Dr. Elena Vance",
    "elena.vance@example.edu",
    "Great exposition of the transition from Schwarzschild to Kerr geometry. It is also illuminating to note how the Hawking temperature scales inversely with mass: $$T_H = \\frac{\\hbar c^3}{8\\pi G M k_B}$$",
    0,
    null,
    null,
    "approved"
  );

  insertComment.run(
    uuid(),
    bhRow.article_id,
    "fa",
    "نیما شریفی",
    "nima.sharifi@example.org",
    "برای محاسبه انحراف نور در مجاورت افق، آیا تقریب $\\Delta \\phi \\approx \\frac{4GM}{c^2 b}$ نزدیک کره فوتونی $r_{ph} = 1.5\\,r_s$ هنوز معتبر است؟",
    1,
    null,
    null,
    "pending"
  );
}

function ensureSeedArticleMedia(db: SqliteDatabase) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const findMedia = db.prepare(`SELECT id FROM media WHERE path = ? AND deleted_at IS NULL LIMIT 1`);
    const insertMedia = db.prepare(
      `INSERT OR IGNORE INTO media (id, filename, original_name, mime_type, size_bytes, width, height, path, thumbnail_path, alt_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const mediaIdsByFilename: Record<string, string> = {};
    for (const m of SEED_MEDIA) {
      const existing = findMedia.get(m.path) as { id?: string } | undefined;
      const id = existing?.id ?? uuid();
      if (!existing?.id) {
        insertMedia.run(
          id,
          m.filename,
          m.originalName,
          m.mimeType,
          m.sizeBytes,
          m.width,
          m.height,
          m.path,
          m.thumbnailPath,
          m.altText
        );
      }
      mediaIdsByFilename[m.filename] = id;
    }

    const findAuthor = db.prepare(`SELECT id FROM authors WHERE slug = ? AND deleted_at IS NULL LIMIT 1`);
    const insertAuthor = db.prepare(
      `INSERT OR IGNORE INTO authors (id, slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const authorIdsBySlug: Record<string, string> = {};
    for (const a of SEED_AUTHORS) {
      const existing = findAuthor.get(a.slug) as { id?: string } | undefined;
      const id = existing?.id ?? uuid();
      if (!existing?.id) {
        insertAuthor.run(id, a.slug, a.name_fa, a.name_en, a.title_fa, a.title_en, a.bio_fa, a.bio_en);
      }
      authorIdsBySlug[a.slug] = id;
    }

    const fieldRows = db.prepare(`SELECT id, slug FROM fields WHERE deleted_at IS NULL`).all() as Array<{
      id?: string;
      slug?: string;
    }>;
    const fieldIdsBySlug: Record<string, string> = {};
    for (const f of fieldRows) {
      if (f.slug && f.id) fieldIdsBySlug[f.slug] = f.id;
    }

    const categoryRow = db.prepare(`SELECT id FROM categories WHERE slug = 'deep-dive' LIMIT 1`).get() as
      | { id?: string }
      | undefined;
    const adminRow = db.prepare(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`).get() as
      | { id?: string }
      | undefined;
    const categoryId = categoryRow?.id ?? null;
    const adminId = adminRow?.id ?? null;

    const findArticleBySlug = db.prepare(
      `SELECT a.id, a.cover_media_id
         FROM articles a
         JOIN article_translations t ON t.article_id = a.id
        WHERE t.slug = ?
        LIMIT 1`
    );
    const insertArticle = db.prepare(
      `INSERT OR IGNORE INTO articles (id, field_id, category_id, author_id, cover_media_id, status, featured, trending, views, published_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?)`
    );
    const insertTranslation = db.prepare(
      `INSERT OR IGNORE INTO article_translations (id, article_id, locale, title, slug, excerpt, content, seo_title, seo_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const findTag = db.prepare(`SELECT id FROM tags WHERE slug = ?`);
    const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (id, slug, name_fa, name_en) VALUES (?, ?, ?, ?)`);
    const insertArticleTag = db.prepare(`INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)`);

    const attachCover = db.prepare(`UPDATE articles SET cover_media_id = ? WHERE id = ? AND cover_media_id IS NULL`);
    const getTranslation = db.prepare(
      `SELECT id, content FROM article_translations WHERE article_id = ? AND locale = ? LIMIT 1`
    );
    const updateTranslationContent = db.prepare(`UPDATE article_translations SET content = ? WHERE id = ?`);

    for (const article of SEED_ARTICLES) {
      const existing = findArticleBySlug.get(article.slug) as { id?: string; cover_media_id?: string | null } | undefined;
      const mediaId = mediaIdsByFilename[article.coverFilename] ?? null;

      if (!existing?.id) {
        const articleId = uuid();
        insertArticle.run(
          articleId,
          fieldIdsBySlug[article.field] ?? null,
          categoryId,
          authorIdsBySlug[article.authorSlug] ?? null,
          mediaId,
          article.featured ? 1 : 0,
          article.trending ? 1 : 0,
          article.views,
          article.publishedAt,
          adminId,
          adminId
        );
        for (const locale of ["fa", "en"] as const) {
          const t = article[locale];
          insertTranslation.run(uuid(), articleId, locale, t.title, article.slug, t.excerpt, t.content, t.title, t.excerpt);
        }
        for (const tag of article.tags) {
          const existingTag = findTag.get(tag.slug) as { id?: string } | undefined;
          const tagId = existingTag?.id ?? uuid();
          if (!existingTag?.id) {
            insertTag.run(tagId, tag.slug, tag.name_fa, tag.name_en);
          }
          insertArticleTag.run(articleId, tagId);
        }
        continue;
      }

      if (mediaId && !existing.cover_media_id) {
        attachCover.run(mediaId, existing.id);
      }

      for (const locale of ["fa", "en"] as const) {
        const tr = getTranslation.get(existing.id, locale) as { id?: string; content?: string } | undefined;
        if (tr?.id && typeof tr.content === "string" && !tr.content.includes("/images/articles/")) {
          updateTranslationContent.run(article[locale].content, tr.id);
        }
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function ensureApiKeysSchema(db: SqliteDatabase) {
  const existingPerm = db.prepare(`SELECT id FROM permissions WHERE "key" = 'api_keys.manage'`).get() as
    | { id?: string }
    | undefined;
  if (!existingPerm?.id) {
    const permId = uuid();
    db.prepare(`INSERT OR IGNORE INTO permissions (id, "key") VALUES (?, 'api_keys.manage')`).run(permId);
    const roles = db
      .prepare(`SELECT id FROM roles WHERE name IN ('super_admin', 'admin')`)
      .all() as Array<{ id?: string }>;
    const link = db.prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`);
    for (const r of roles) {
      if (r.id) link.run(r.id, permId);
    }
  }
}

export function resolveSqlitePath(rawPath?: string): string {
  const trimmed = rawPath?.trim();
  if (!trimmed) return DEFAULT_DB_PATH;
  if (trimmed === ":memory:") return ":memory:";
  return path.resolve(trimmed);
}

function tryOpenDatabase(
  DatabaseSync: new (filename: string) => SqliteDatabase,
  targetPath: string
): SqliteDatabase {
  if (targetPath !== ":memory:") {
    const dir = path.dirname(targetPath);
    if (dir && dir !== ".") {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  return new DatabaseSync(targetPath);
}

function openSqliteWithFallback(
  DatabaseSync: new (filename: string) => SqliteDatabase,
  filename: string
): { db: SqliteDatabase; openedPath: string } {
  const primary = resolveSqlitePath(filename);
  const candidates = primary === ":memory:"
    ? [":memory:"]
    : primary === DEFAULT_DB_PATH
      ? [DEFAULT_DB_PATH, ":memory:"]
      : [primary, DEFAULT_DB_PATH, ":memory:"];

  let lastError: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const db = tryOpenDatabase(DatabaseSync, candidate);
      if (i > 0) {
        console.warn(
          `[db] Could not open SQLite database at "${primary}" (${lastError instanceof Error ? lastError.message : String(lastError)}); using "${candidate}" instead.`
        );
      }
      return { db, openedPath: candidate };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

interface CachedPreparedStatement {
  translated: string;
  stmt: SqliteStatement;
  isMutation: boolean;
}

export interface SqlitePragmaDiagnostics {
  journalMode: string;
  synchronous: number;
  cacheSizeKiB: number;
  tempStore: number;
  pageSize: number;
  pageCount: number;
  freelistCount: number;
  estimatedBytes: number;
  indexCount: number;
  statementCache: LruCacheStats;
}

export interface SqliteMaintenanceSummary {
  analyzed: boolean;
  optimized: boolean;
  walCheckpointed: boolean;
  pageCount: number;
  freelistCount: number;
  estimatedBytes: number;
}

const DDL_OR_PRAGMA_RE = /^\s*(CREATE|ALTER|DROP|PRAGMA|ATTACH|DETACH|VACUUM|ANALYZE|REINDEX)\b/i;

function applyPerformancePragmas(db: SqliteDatabase, openedPath: string) {
  const pragmas: string[] = [
    "PRAGMA foreign_keys = ON;",
    "PRAGMA busy_timeout = 5000;",
    "PRAGMA synchronous = NORMAL;",
    "PRAGMA temp_store = MEMORY;",
    "PRAGMA cache_size = -16000;",
  ];
  if (openedPath !== ":memory:") {
    pragmas.unshift("PRAGMA journal_mode = WAL;");
    pragmas.push("PRAGMA mmap_size = 67108864;");
  }
  for (const pragma of pragmas) {
    try {
      db.exec(pragma);
    } catch {
      // Ignore if filesystem/runtime restricts a specific pragma (e.g. WAL/mmap)
    }
  }
}

function ensureSqliteIndexes(db: SqliteDatabase) {
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const ddl of SQLITE_INDEX_STATEMENTS) {
      db.exec(ddl);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export class SqliteFallbackDb {
  private db: SqliteDatabase;
  private readonly stmtCache: LruCache<CachedPreparedStatement>;
  public readonly filePath: string;

  constructor(filename: string = DEFAULT_DB_PATH, statementCacheSize: number = STATEMENT_CACHE_MAX_SIZE) {
    const { DatabaseSync } = loadSqliteModule();
    const { db, openedPath } = openSqliteWithFallback(DatabaseSync, filename);
    this.db = db;
    this.filePath = openedPath;
    this.stmtCache = new LruCache<CachedPreparedStatement>(statementCacheSize);

    applyPerformancePragmas(this.db, openedPath);
    this.db.exec(SCHEMA_SQL);
    seedIfEmpty(this.db);
    ensureCommentsSchemaAndSeed(this.db);
    ensureSeedArticleMedia(this.db);
    ensureApiKeysSchema(this.db);
    ensureSqliteIndexes(this.db);
    try {
      this.db.exec("ANALYZE;");
      this.db.exec("PRAGMA optimize;");
    } catch {
      // Non-fatal if planner statistics cannot be refreshed during startup
    }
  }

  private getOrPrepare(sql: string): CachedPreparedStatement {
    if (DDL_OR_PRAGMA_RE.test(sql)) {
      const translated = translateMysqlToSqlite(sql);
      const stmt = this.db.prepare(translated);
      this.stmtCache.clear();
      return {
        translated,
        stmt,
        isMutation: true,
      };
    }

    const cached = this.stmtCache.get(sql);
    if (cached) return cached;

    const translated = translateMysqlToSqlite(sql);
    const entry: CachedPreparedStatement = {
      translated,
      stmt: this.db.prepare(translated),
      isMutation: /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(translated),
    };
    this.stmtCache.set(sql, entry);
    return entry;
  }

  query<T = unknown>(sql: string, params: unknown[] = []): T[] {
    const normalized = normalizeSqliteParams(params);
    try {
      const { stmt, isMutation } = this.getOrPrepare(sql);
      if (isMutation) {
        stmt.run(...normalized);
        return [];
      }
      return toPlainRows<T>(stmt.all(...normalized));
    } catch (err) {
      throw mapSqliteError(err);
    }
  }

  execute(sql: string, params: unknown[] = []): SqliteResultHeader {
    const normalized = normalizeSqliteParams(params);
    try {
      const { stmt } = this.getOrPrepare(sql);
      const res = stmt.run(...normalized);
      return {
        affectedRows: Number(res.changes ?? 0),
        insertId: Number(res.lastInsertRowid ?? 0),
      };
    } catch (err) {
      throw mapSqliteError(err);
    }
  }

  explainQueryPlan(sql: string, params: unknown[] = []): Array<{ id: number; parent: number; detail: string }> {
    const translated = translateMysqlToSqlite(sql);
    const normalized = normalizeSqliteParams(params);
    const stmt = this.db.prepare(`EXPLAIN QUERY PLAN ${translated}`);
    return toPlainRows<{ id: number; parent: number; detail: string }>(stmt.all(...normalized));
  }

  getStatementCacheStats(): LruCacheStats {
    return this.stmtCache.stats();
  }

  clearStatementCache(): void {
    this.stmtCache.clear();
  }

  getPragmaDiagnostics(): SqlitePragmaDiagnostics {
    const readScalar = <T>(pragma: string, key: string, fallback: T): T => {
      try {
        const row = this.db.prepare(`PRAGMA ${pragma}`).get() as Record<string, unknown> | undefined;
        if (!row) return fallback;
        const val = row[key] ?? Object.values(row)[0];
        return (val as T) ?? fallback;
      } catch {
        return fallback;
      }
    };

    const journalMode = String(readScalar("journal_mode", "journal_mode", "unknown"));
    const synchronous = Number(readScalar("synchronous", "synchronous", 0));
    const rawCacheSize = Number(readScalar("cache_size", "cache_size", 0));
    const tempStore = Number(readScalar("temp_store", "temp_store", 0));
    const pageSize = Number(readScalar("page_size", "page_size", 4096));
    const pageCount = Number(readScalar("page_count", "page_count", 0));
    const freelistCount = Number(readScalar("freelist_count", "freelist_count", 0));
    const cacheSizeKiB = rawCacheSize < 0 ? Math.abs(rawCacheSize) : Math.round((rawCacheSize * pageSize) / 1024);

    const idxRow = this.db
      .prepare(`SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%'`)
      .get() as { count?: number } | undefined;

    return {
      journalMode,
      synchronous,
      cacheSizeKiB,
      tempStore,
      pageSize,
      pageCount,
      freelistCount,
      estimatedBytes: pageSize * pageCount,
      indexCount: Number(idxRow?.count ?? 0),
      statementCache: this.stmtCache.stats(),
    };
  }

  runMaintenance(): SqliteMaintenanceSummary {
    let analyzed = false;
    let optimized = false;
    let walCheckpointed = false;

    ensureSqliteIndexes(this.db);

    try {
      this.db.exec("ANALYZE;");
      analyzed = true;
    } catch {
      analyzed = false;
    }

    try {
      this.db.exec("PRAGMA optimize;");
      optimized = true;
    } catch {
      optimized = false;
    }

    if (this.filePath !== ":memory:") {
      try {
        this.db.exec("PRAGMA wal_checkpoint(PASSIVE);");
        walCheckpointed = true;
      } catch {
        walCheckpointed = false;
      }
    }

    this.stmtCache.clear();
    const diag = this.getPragmaDiagnostics();

    return {
      analyzed,
      optimized,
      walCheckpointed,
      pageCount: diag.pageCount,
      freelistCount: diag.freelistCount,
      estimatedBytes: diag.estimatedBytes,
    };
  }

  async withTransaction<T>(fn: (conn: SqliteConnection) => Promise<T>): Promise<T> {
    const conn: SqliteConnection = {
      query: async <R = unknown>(sql: string, params: unknown[] = []) => [this.query<R>(sql, params), []],
      execute: async (sql: string, params: unknown[] = []) => [this.execute(sql, params), []],
    };
    this.db.exec("BEGIN");
    try {
      const result = await fn(conn);
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  close() {
    this.stmtCache.clear();
    this.db.close();
  }
}

declare global {
  var __scientaSqliteFallback: SqliteFallbackDb | undefined;
}

export function getSqliteFallback(): SqliteFallbackDb {
  if (!globalThis.__scientaSqliteFallback) {
    globalThis.__scientaSqliteFallback = new SqliteFallbackDb(
      resolveSqlitePath(process.env.SQLITE_FALLBACK_PATH)
    );
  }
  return globalThis.__scientaSqliteFallback;
}
