import { execute } from "./db";

let analyticsTableReady = false;

/**
 * Lazily ensures the privacy-first `analytics_pageviews` table exists on both
 * MySQL (cPanel production) and SQLite fallback databases without requiring a
 * manual schema migration step during deploys.
 */
export async function ensureAnalyticsTableReady(): Promise<void> {
  if (analyticsTableReady) return;
  try {
    if (process.env.DB_HOST?.trim() && !globalThis.__scientaUseSqliteFallback) {
      await execute(
        `CREATE TABLE IF NOT EXISTS analytics_pageviews (
          id CHAR(36) NOT NULL PRIMARY KEY,
          article_id CHAR(36) NULL,
          locale VARCHAR(8) NOT NULL DEFAULT 'fa',
          path VARCHAR(255) NOT NULL,
          referrer_host VARCHAR(120) NOT NULL DEFAULT 'Direct',
          device_type VARCHAR(16) NOT NULL DEFAULT 'desktop',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_apv_created (created_at),
          INDEX idx_apv_article (article_id, created_at)
        )`
      );
    } else {
      await execute(
        `CREATE TABLE IF NOT EXISTS analytics_pageviews (
          id TEXT NOT NULL PRIMARY KEY,
          article_id TEXT NULL,
          locale TEXT NOT NULL DEFAULT 'fa',
          path TEXT NOT NULL,
          referrer_host TEXT NOT NULL DEFAULT 'Direct',
          device_type TEXT NOT NULL DEFAULT 'desktop',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      );
    }
  } catch (err) {
    console.warn(
      "[analytics] table check notice:",
      err instanceof Error ? err.message : String(err)
    );
  }
  analyticsTableReady = true;
}
