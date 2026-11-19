import test from "node:test";
import assert from "node:assert/strict";
import { SEED_ARTICLES } from "./seed-data";
import {
  SqliteFallbackDb,
  translateMysqlToSqlite,
  normalizeSqliteParams,
} from "./sqlite-fallback";

test("translateMysqlToSqlite handles NOW, DATE_ADD, GROUP_CONCAT, INSERT IGNORE, ON DUPLICATE KEY, and MATCH AGAINST", () => {
  assert.equal(
    translateMysqlToSqlite("UPDATE users SET last_login_at = NOW() WHERE id = ?"),
    "UPDATE users SET last_login_at = datetime('now') WHERE id = ?"
  );

  assert.equal(
    translateMysqlToSqlite("VALUES (?, DATE_ADD(NOW(), INTERVAL ? SECOND))"),
    "VALUES (?, datetime('now', '+' || ? || ' seconds'))"
  );

  assert.equal(
    translateMysqlToSqlite(
      "SELECT GROUP_CONCAT(tg.name_fa, '::', tg.name_en SEPARATOR '||') FROM tags tg"
    ),
    "SELECT GROUP_CONCAT(tg.name_fa || '::' || tg.name_en, '||') FROM tags tg"
  );

  assert.equal(
    translateMysqlToSqlite("INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)"),
    "INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)"
  );

  assert.equal(
    translateMysqlToSqlite(
      "INSERT INTO subscribers (id, email, locale, status) VALUES (?, ?, ?, 'subscribed') ON DUPLICATE KEY UPDATE status = 'subscribed'"
    ),
    "INSERT INTO subscribers (id, email, locale, status) VALUES (?, ?, ?, 'subscribed') ON CONFLICT(email) DO UPDATE SET status = 'subscribed'"
  );

  assert.equal(
    translateMysqlToSqlite("WHERE MATCH(t.title, t.excerpt, t.content) AGAINST (? IN NATURAL LANGUAGE MODE)"),
    "WHERE instr(lower(COALESCE(t.title, '') || ' ' || COALESCE(t.excerpt, '') || ' ' || COALESCE(t.content, '')), lower(?)) > 0"
  );
});

test("normalizeSqliteParams converts booleans and undefined into SQLite-safe primitives", () => {
  assert.deepEqual(normalizeSqliteParams([true, false, undefined, null, "hi", 42]), [
    1,
    0,
    null,
    null,
    "hi",
    42,
  ]);
});

test("SqliteFallbackDb seeds fields, authors, bilingual articles, and supports queries & mutations", async () => {
  const db = new SqliteFallbackDb(":memory:");
  try {
    const fields = db.query<{ slug: string; article_count: number }>(
      `SELECT f.slug,
              (SELECT COUNT(*) FROM articles a WHERE a.field_id = f.id AND a.status='published' AND a.deleted_at IS NULL) AS article_count
       FROM fields f
       WHERE f.deleted_at IS NULL
       ORDER BY f.sort_order ASC`
    );
    assert.equal(fields.length, 10);
    assert.equal(fields[0].slug, "physics");
    assert.equal(Object.getPrototypeOf(fields[0]), Object.prototype);

    const enArticles = db.query<{ id: string; slug: string; title: string; tags: string | null }>(
      `SELECT a.id, t.slug, t.title,
              (SELECT GROUP_CONCAT(tg.name_fa, '::', tg.name_en SEPARATOR '||')
                 FROM article_tags atg JOIN tags tg ON tg.id = atg.tag_id
                WHERE atg.article_id = a.id) AS tags
       FROM articles a
       JOIN article_translations t ON t.article_id = a.id AND t.locale = ?
       WHERE a.deleted_at IS NULL AND a.status = 'published'
       ORDER BY a.published_at DESC`,
      ["en"]
    );
    assert.equal(enArticles.length, SEED_ARTICLES.length);
    assert.ok(enArticles[0].tags && enArticles[0].tags.includes("::"));
    assert.ok(enArticles.some((a) => a.slug === "crispr-gene-editing"));

    // Simulate pre-existing DB missing a seeded article; re-opening should restore it idempotently
    db.execute(`DELETE FROM articles WHERE id = ?`, [enArticles[0].id]);
    const deletedSlug = enArticles[0].slug;
    const afterDelete = db.query<{ slug: string }>(
      `SELECT t.slug FROM article_translations t WHERE t.locale = 'en' AND t.slug = ?`,
      [deletedSlug]
    );
    assert.equal(afterDelete.length, 0);

    // Fulltext search translation
    const searchHits = db.query<{ slug: string }>(
      `SELECT t.slug FROM article_translations t
       WHERE t.locale = ? AND MATCH(t.title, t.excerpt, t.content) AGAINST (? IN NATURAL LANGUAGE MODE)`,
      ["en", "Schwarzschild"]
    );
    assert.equal(searchHits.length, 1);
    assert.equal(searchHits[0].slug, "geometry-of-black-holes");

    // View increment via query()
    const targetId = enArticles[1].id;
    db.query("UPDATE articles SET views = views + 1 WHERE id = ?", [targetId]);

    // Subscriber upsert with ON DUPLICATE KEY UPDATE
    db.execute(
      `INSERT INTO subscribers (id, email, locale, status) VALUES (?, ?, ?, 'subscribed')
       ON DUPLICATE KEY UPDATE status = 'subscribed'`,
      ["sub-1", "reader@scienta.ir", "en"]
    );
    db.execute(
      `INSERT INTO subscribers (id, email, locale, status) VALUES (?, ?, ?, 'subscribed')
       ON DUPLICATE KEY UPDATE status = 'subscribed'`,
      ["sub-2", "reader@scienta.ir", "en"]
    );
    const subs = db.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM subscribers WHERE email = ?",
      ["reader@scienta.ir"]
    );
    assert.equal(Number(subs[0].count), 1);

    // Transaction rollback
    await assert.rejects(
      db.withTransaction(async (conn) => {
        await conn.execute(
          `INSERT INTO contact_messages (id, name, email, message) VALUES (?, ?, ?, ?)`,
          ["msg-rollback", "Test", "t@example.com", "Hello"]
        );
        throw new Error("boom");
      }),
      /boom/
    );
    const msgs = db.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM contact_messages WHERE id = ?",
      ["msg-rollback"]
    );
    assert.equal(Number(msgs[0].count), 0);

    // Duplicate slug error maps to uq_locale_slug for route handler compatibility
    assert.throws(
      () =>
        db.execute(
          `INSERT INTO article_translations (id, article_id, locale, title, slug, content) VALUES (?, ?, ?, ?, ?, ?)`,
          ["dup-1", targetId, "en", "Dup", "geometry-of-black-holes", "body"]
        ),
      /uq_locale_slug|Duplicate/
    );
  } finally {
    db.close();
  }
});

test("SqliteFallbackDb incrementally seeds newly added articles on pre-existing database files", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const tmpFile = path.join(os.tmpdir(), `scienta-inc-${Date.now()}.sqlite`);

  try {
    const first = new SqliteFallbackDb(tmpFile);
    first.execute(
      `DELETE FROM articles WHERE id IN (SELECT article_id FROM article_translations WHERE slug IN ('crispr-gene-editing', 'riemann-zeta-prime-music'))`
    );
    const before = first.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM articles WHERE deleted_at IS NULL AND status = 'published'`
    );
    assert.equal(Number(before[0].count), SEED_ARTICLES.length - 2);
    first.close();

    const reopened = new SqliteFallbackDb(tmpFile);
    const after = reopened.query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM articles WHERE deleted_at IS NULL AND status = 'published'`
    );
    assert.equal(Number(after[0].count), SEED_ARTICLES.length);
    reopened.close();
  } finally {
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(`${tmpFile}${suffix}`);
      } catch {
        // Ignore cleanup miss
      }
    }
  }
});
