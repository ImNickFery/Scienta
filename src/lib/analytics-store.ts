import { execute, query } from "./db";

let analyticsTableReady = false;

interface ColumnMigration {
  name: string;
  mysqlType: string;
  sqliteType: string;
}

const TELEMETRY_COLUMNS: ColumnMigration[] = [
  { name: "country_code", mysqlType: "VARCHAR(8) NOT NULL DEFAULT 'ZZ'", sqliteType: "TEXT NOT NULL DEFAULT 'ZZ'" },
  { name: "country_name", mysqlType: "VARCHAR(80) NOT NULL DEFAULT 'Unknown'", sqliteType: "TEXT NOT NULL DEFAULT 'Unknown'" },
  { name: "city", mysqlType: "VARCHAR(80) NULL", sqliteType: "TEXT NULL" },
  { name: "region_name", mysqlType: "VARCHAR(80) NULL", sqliteType: "TEXT NULL" },
  { name: "timezone", mysqlType: "VARCHAR(64) NULL", sqliteType: "TEXT NULL" },
  { name: "traffic_channel", mysqlType: "VARCHAR(24) NOT NULL DEFAULT 'direct'", sqliteType: "TEXT NOT NULL DEFAULT 'direct'" },
  { name: "search_engine", mysqlType: "VARCHAR(48) NULL", sqliteType: "TEXT NULL" },
  { name: "browser_name", mysqlType: "VARCHAR(48) NOT NULL DEFAULT 'Unknown'", sqliteType: "TEXT NOT NULL DEFAULT 'Unknown'" },
  { name: "browser_version", mysqlType: "VARCHAR(24) NOT NULL DEFAULT ''", sqliteType: "TEXT NOT NULL DEFAULT ''" },
  { name: "os_name", mysqlType: "VARCHAR(48) NOT NULL DEFAULT 'Unknown'", sqliteType: "TEXT NOT NULL DEFAULT 'Unknown'" },
  { name: "os_version", mysqlType: "VARCHAR(24) NOT NULL DEFAULT ''", sqliteType: "TEXT NOT NULL DEFAULT ''" },
  { name: "device_vendor", mysqlType: "VARCHAR(48) NOT NULL DEFAULT 'Unknown'", sqliteType: "TEXT NOT NULL DEFAULT 'Unknown'" },
  { name: "screen_bucket", mysqlType: "VARCHAR(32) NOT NULL DEFAULT 'Unknown'", sqliteType: "TEXT NOT NULL DEFAULT 'Unknown'" },
  { name: "browser_lang", mysqlType: "VARCHAR(16) NOT NULL DEFAULT 'Unknown'", sqliteType: "TEXT NOT NULL DEFAULT 'Unknown'" },
  { name: "utm_source", mysqlType: "VARCHAR(80) NULL", sqliteType: "TEXT NULL" },
  { name: "utm_medium", mysqlType: "VARCHAR(80) NULL", sqliteType: "TEXT NULL" },
  { name: "utm_campaign", mysqlType: "VARCHAR(80) NULL", sqliteType: "TEXT NULL" },
  { name: "visitor_hash", mysqlType: "VARCHAR(32) NULL", sqliteType: "TEXT NULL" },
  { name: "is_bot", mysqlType: "TINYINT(1) NOT NULL DEFAULT 0", sqliteType: "INTEGER NOT NULL DEFAULT 0" },
];

/**
 * Lazily ensures the privacy-first `analytics_pageviews` table and its full
 * visitor-intelligence telemetry columns exist on both MySQL (cPanel production)
 * and SQLite fallback databases without requiring a manual migration step.
 */
export async function ensureAnalyticsTableReady(): Promise<void> {
  if (analyticsTableReady) return;
  try {
    const isMysql = Boolean(process.env.DB_HOST?.trim() && !globalThis.__scientaUseSqliteFallback);
    if (isMysql) {
      await execute(
        `CREATE TABLE IF NOT EXISTS analytics_pageviews (
          id CHAR(36) NOT NULL PRIMARY KEY,
          article_id CHAR(36) NULL,
          locale VARCHAR(8) NOT NULL DEFAULT 'fa',
          path VARCHAR(255) NOT NULL,
          referrer_host VARCHAR(120) NOT NULL DEFAULT 'Direct',
          device_type VARCHAR(16) NOT NULL DEFAULT 'desktop',
          country_code VARCHAR(8) NOT NULL DEFAULT 'ZZ',
          country_name VARCHAR(80) NOT NULL DEFAULT 'Unknown',
          city VARCHAR(80) NULL,
          region_name VARCHAR(80) NULL,
          timezone VARCHAR(64) NULL,
          traffic_channel VARCHAR(24) NOT NULL DEFAULT 'direct',
          search_engine VARCHAR(48) NULL,
          browser_name VARCHAR(48) NOT NULL DEFAULT 'Unknown',
          browser_version VARCHAR(24) NOT NULL DEFAULT '',
          os_name VARCHAR(48) NOT NULL DEFAULT 'Unknown',
          os_version VARCHAR(24) NOT NULL DEFAULT '',
          device_vendor VARCHAR(48) NOT NULL DEFAULT 'Unknown',
          screen_bucket VARCHAR(32) NOT NULL DEFAULT 'Unknown',
          browser_lang VARCHAR(16) NOT NULL DEFAULT 'Unknown',
          utm_source VARCHAR(80) NULL,
          utm_medium VARCHAR(80) NULL,
          utm_campaign VARCHAR(80) NULL,
          visitor_hash VARCHAR(32) NULL,
          is_bot TINYINT(1) NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_apv_created (created_at),
          INDEX idx_apv_article (article_id, created_at),
          INDEX idx_apv_country (country_code, created_at),
          INDEX idx_apv_channel (traffic_channel, created_at)
        )`
      );

      const cols = await query<{ Field: string }>(`SHOW COLUMNS FROM analytics_pageviews`).catch(() => []);
      const existing = new Set(cols.map((c) => c.Field.toLowerCase()));
      for (const col of TELEMETRY_COLUMNS) {
        if (!existing.has(col.name)) {
          await execute(`ALTER TABLE analytics_pageviews ADD COLUMN ${col.name} ${col.mysqlType}`).catch(() => {});
        }
      }
    } else {
      await execute(
        `CREATE TABLE IF NOT EXISTS analytics_pageviews (
          id TEXT NOT NULL PRIMARY KEY,
          article_id TEXT NULL,
          locale TEXT NOT NULL DEFAULT 'fa',
          path TEXT NOT NULL,
          referrer_host TEXT NOT NULL DEFAULT 'Direct',
          device_type TEXT NOT NULL DEFAULT 'desktop',
          country_code TEXT NOT NULL DEFAULT 'ZZ',
          country_name TEXT NOT NULL DEFAULT 'Unknown',
          city TEXT NULL,
          region_name TEXT NULL,
          timezone TEXT NULL,
          traffic_channel TEXT NOT NULL DEFAULT 'direct',
          search_engine TEXT NULL,
          browser_name TEXT NOT NULL DEFAULT 'Unknown',
          browser_version TEXT NOT NULL DEFAULT '',
          os_name TEXT NOT NULL DEFAULT 'Unknown',
          os_version TEXT NOT NULL DEFAULT '',
          device_vendor TEXT NOT NULL DEFAULT 'Unknown',
          screen_bucket TEXT NOT NULL DEFAULT 'Unknown',
          browser_lang TEXT NOT NULL DEFAULT 'Unknown',
          utm_source TEXT NULL,
          utm_medium TEXT NULL,
          utm_campaign TEXT NULL,
          visitor_hash TEXT NULL,
          is_bot INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      );

      const cols = await query<{ name: string }>(`PRAGMA table_info(analytics_pageviews)`).catch(() => []);
      const existing = new Set(cols.map((c) => c.name.toLowerCase()));
      for (const col of TELEMETRY_COLUMNS) {
        if (!existing.has(col.name)) {
          await execute(`ALTER TABLE analytics_pageviews ADD COLUMN ${col.name} ${col.sqliteType}`).catch(() => {});
        }
      }

      await execute(`CREATE INDEX IF NOT EXISTS idx_apv_created ON analytics_pageviews (created_at DESC)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_apv_article_created ON analytics_pageviews (article_id, created_at DESC)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_apv_locale_created ON analytics_pageviews (locale, created_at DESC)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_apv_country_created ON analytics_pageviews (country_code, created_at DESC)`);
      await execute(`CREATE INDEX IF NOT EXISTS idx_apv_channel_created ON analytics_pageviews (traffic_channel, created_at DESC)`);
    }
  } catch (err) {
    console.warn(
      "[analytics] table check notice:",
      err instanceof Error ? err.message : String(err)
    );
  }
  analyticsTableReady = true;
}
