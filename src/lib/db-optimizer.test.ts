import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteFallbackDb } from "./sqlite-fallback";
import {
  analyzeQueryPlan,
  formatSqlUtcCutoff,
  LruCache,
  SQLITE_INDEX_STATEMENTS,
} from "./db-optimizer-core";
import { deriveHomeCollections } from "./content";
import type { Article } from "@/types";

test("LruCache promotes recently used entries and strictly enforces max capacity", () => {
  const cache = new LruCache<number>(3);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);

  // Touch "a" so "b" becomes the least-recently-used key
  assert.equal(cache.get("a"), 1);
  cache.set("d", 4);

  assert.equal(cache.size, 3);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.get("d"), 4);

  const stats = cache.stats();
  assert.equal(stats.maxSize, 3);
  assert.equal(stats.evictions, 1);
  assert.equal(stats.hits, 4);
  assert.equal(stats.misses, 1);
  assert.equal(stats.hitRatePct, 80);
});

test("SqliteFallbackDb creates all secondary indexes, tunes PRAGMAs, and uses indexes in EXPLAIN QUERY PLAN", () => {
  const db = new SqliteFallbackDb(":memory:");
  try {
    const diag = db.getPragmaDiagnostics();
    assert.ok(
      diag.indexCount >= SQLITE_INDEX_STATEMENTS.length,
      `Expected at least ${SQLITE_INDEX_STATEMENTS.length} custom indexes, got ${diag.indexCount}`
    );
    assert.equal(diag.synchronous, 1, "PRAGMA synchronous should be NORMAL (1)");
    assert.equal(diag.tempStore, 2, "PRAGMA temp_store should be MEMORY (2)");
    assert.ok(diag.cacheSizeKiB >= 16000, `Expected >= 16000 KiB cache, got ${diag.cacheSizeKiB}`);

    const probes: Array<{ name: string; sql: string; params: unknown[]; allowTempBtree?: boolean }> = [
      {
        name: "live_articles_feed",
        sql: `SELECT a.id FROM articles a WHERE a.deleted_at IS NULL AND a.status = 'published' ORDER BY a.published_at DESC, a.created_at DESC LIMIT 20`,
        params: [],
      },
      {
        name: "article_by_locale_slug",
        sql: `SELECT article_id FROM article_translations WHERE locale = ? AND slug = ? LIMIT 1`,
        params: ["fa", "geometry-of-black-holes"],
      },
      {
        name: "articles_by_field",
        sql: `SELECT id FROM articles WHERE deleted_at IS NULL AND status = 'published' AND field_id = ? ORDER BY published_at DESC`,
        params: ["00000000-0000-0000-0000-000000000000"],
      },
      {
        name: "reverse_tag_lookup",
        sql: `SELECT article_id FROM article_tags WHERE tag_id = ?`,
        params: ["00000000-0000-0000-0000-000000000000"],
      },
      {
        name: "approved_article_comments",
        sql: `SELECT id FROM comments WHERE article_id = ? AND locale = ? AND status = 'approved' ORDER BY created_at DESC`,
        params: ["00000000-0000-0000-0000-000000000000", "fa"],
      },
      {
        name: "analytics_pageviews_range",
        sql: `SELECT id FROM analytics_pageviews WHERE created_at >= ? ORDER BY created_at DESC LIMIT 100`,
        params: ["2026-01-01 00:00:00"],
      },
      {
        name: "activity_logs_recent",
        sql: `SELECT id FROM activity_logs WHERE created_at >= ? ORDER BY created_at DESC LIMIT 100`,
        params: ["2026-01-01 00:00:00"],
      },
      {
        name: "fields_left_join_counts",
        sql: `SELECT f.slug, COUNT(a.id) AS article_count
              FROM fields f
              LEFT JOIN articles a ON a.field_id = f.id AND a.status = 'published' AND a.deleted_at IS NULL
              WHERE f.deleted_at IS NULL
              GROUP BY f.id, f.slug, f.sort_order
              ORDER BY f.sort_order ASC`,
        params: [],
        allowTempBtree: true,
      },
    ];

    for (const probe of probes) {
      const planRows = db.explainQueryPlan(probe.sql, probe.params);
      const analysis = analyzeQueryPlan(planRows);
      assert.equal(
        analysis.usesIndex,
        true,
        `Query "${probe.name}" should use an index. Plan: ${analysis.details.join(" | ")}`
      );
      assert.equal(
        analysis.hasFullTableScan,
        false,
        `Query "${probe.name}" should not perform a full table scan. Plan: ${analysis.details.join(" | ")}`
      );
      if (!probe.allowTempBtree) {
        assert.equal(
          analysis.hasTempBtree,
          false,
          `Query "${probe.name}" should avoid TEMP B-TREE sorting. Plan: ${analysis.details.join(" | ")}`
        );
      }
    }

    // Verify LEFT JOIN field article counts match actual published articles
    const fieldCounts = db.query<{ slug: string; article_count: number }>(
      `SELECT f.slug, COUNT(a.id) AS article_count
       FROM fields f
       LEFT JOIN articles a ON a.field_id = f.id AND a.status = 'published' AND a.deleted_at IS NULL
       WHERE f.deleted_at IS NULL
       GROUP BY f.id, f.slug, f.sort_order
       ORDER BY f.sort_order ASC`
    );
    assert.equal(fieldCounts.length, 10);
    assert.ok(fieldCounts.some((f) => Number(f.article_count) > 0));
  } finally {
    db.close();
  }
});

test("SqliteFallbackDb prepared-statement cache hits on hot queries, stays bounded, and clears on DDL", () => {
  const db = new SqliteFallbackDb(":memory:", 4);
  try {
    const sql = `SELECT slug FROM fields WHERE deleted_at IS NULL AND slug = ? LIMIT 1`;
    db.query(sql, ["physics"]);
    db.query(sql, ["astronomy"]);
    db.query(sql, ["ai"]);

    let stats = db.getStatementCacheStats();
    assert.equal(stats.size, 1);
    assert.equal(stats.misses, 1);
    assert.equal(stats.hits, 2);

    // Run 6 distinct queries against a cache bounded to 4 entries
    for (let i = 0; i < 6; i += 1) {
      db.query(`SELECT COUNT(*) AS c FROM fields WHERE sort_order >= ${i}`);
    }
    stats = db.getStatementCacheStats();
    assert.equal(stats.size, 4);
    assert.ok(stats.evictions >= 3);

    // Executing DDL clears the prepared statement cache
    db.execute(`CREATE INDEX IF NOT EXISTS idx_test_temp_fields ON fields (slug)`);
    assert.equal(db.getStatementCacheStats().size, 0);
  } finally {
    db.close();
  }
});

test("SqliteFallbackDb disk-backed DB enables WAL, runs maintenance, and prunes expired tokens without touching active ones", () => {
  const tmpFile = path.join(os.tmpdir(), `scienta-opt-${Date.now()}.sqlite`);
  try {
    const db = new SqliteFallbackDb(tmpFile);
    try {
      const diag = db.getPragmaDiagnostics();
      assert.equal(diag.journalMode.toLowerCase(), "wal");

      const admin = db.query<{ id: string }>(`SELECT id FROM users LIMIT 1`)[0];
      assert.ok(admin?.id);

      // Insert one expired and one future refresh token
      db.execute(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
        ["rt-expired", admin.id, "hash-expired", "2020-01-01 00:00:00"]
      );
      db.execute(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
        ["rt-active", admin.id, "hash-active", "2099-01-01 00:00:00"]
      );

      const pruned = db.execute(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);
      assert.equal(pruned.affectedRows, 1);

      const remaining = db.query<{ id: string }>(`SELECT id FROM refresh_tokens`);
      assert.deepEqual(
        remaining.map((r) => r.id),
        ["rt-active"]
      );

      const summary = db.runMaintenance();
      assert.equal(summary.analyzed, true);
      assert.equal(summary.optimized, true);
      assert.equal(summary.walCheckpointed, true);
      assert.ok(summary.estimatedBytes > 0);
    } finally {
      db.close();
    }
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

test("deriveHomeCollections derives featured, trending, and mostViewed without mutating input", () => {
  const mk = (id: string, views: number, featured: boolean, trending: boolean): Article => ({
    id,
    slug: id,
    locale: "en",
    title: id,
    excerpt: "",
    cover: "",
    field: "physics",
    fieldColor: "#7B3FFB",
    tags: [],
    authorSlug: "author",
    authorName: "Author",
    publishedAt: "2026-01-01",
    updatedAt: "2026-01-01",
    views,
    featured,
    trending,
    content: "",
    readingTimeMinutes: 3,
  });

  const input = [
    mk("a1", 100, true, false),
    mk("a2", 900, true, true),
    mk("a3", 500, false, true),
    mk("a4", 1200, false, false),
    mk("a5", 700, true, true),
  ];

  const { featured, trending, mostViewed } = deriveHomeCollections(input);

  // Featured preserves publishedAt DESC input order
  assert.deepEqual(
    featured.map((a) => a.id),
    ["a1", "a2", "a5"]
  );
  // Trending sorted by views DESC
  assert.deepEqual(
    trending.map((a) => a.id),
    ["a2", "a5", "a3"]
  );
  // Most viewed capped at 4, sorted by views DESC
  assert.deepEqual(
    mostViewed.map((a) => a.id),
    ["a4", "a2", "a5", "a3"]
  );
  // Input array was not mutated
  assert.equal(input[0].id, "a1");
});

test("formatSqlUtcCutoff produces SQL-sortable UTC timestamps and clamps extreme inputs", () => {
  const fixedNow = new Date("2026-05-10T12:30:45.000Z");
  assert.equal(formatSqlUtcCutoff(10, fixedNow), "2026-04-30 12:30:45");
  assert.equal(formatSqlUtcCutoff(0, fixedNow), "2026-05-09 12:30:45");
});
