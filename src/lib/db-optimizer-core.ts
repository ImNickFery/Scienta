/**
 * Pure database optimization primitives:
 * - Comprehensive SQLite secondary & composite index definitions
 * - Bounded LRU cache for compiled prepared statements & SQL translations
 * - Query plan analyzer for EXPLAIN QUERY PLAN verification
 * - Static whitelisted table names for safe ANALYZE & diagnostics
 */

export const STATEMENT_CACHE_MAX_SIZE = 256;

export const CORE_TABLES = [
  "roles",
  "permissions",
  "role_permissions",
  "users",
  "refresh_tokens",
  "authors",
  "fields",
  "categories",
  "tags",
  "media",
  "articles",
  "article_translations",
  "article_tags",
  "article_revisions",
  "comments",
  "settings",
  "menus",
  "menu_items",
  "pages",
  "subscribers",
  "contact_messages",
  "activity_logs",
  "api_keys",
  "api_idempotency_keys",
  "analytics_pageviews",
] as const;

export type CoreTableName = (typeof CORE_TABLES)[number];

/**
 * Idempotent SQLite secondary & composite indexes designed specifically for
 * Scienta's real query patterns (live article listing, locale+slug lookups,
 * discipline filtering, tag reverse lookups, comment moderation, analytics
 * range scans, and token/idempotency expiry pruning).
 */
export const SQLITE_INDEX_STATEMENTS: readonly string[] = [
  // Users & auth tokens
  `CREATE INDEX IF NOT EXISTS idx_users_deleted_role ON users (deleted_at, role_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rt_user_expires ON refresh_tokens (user_id, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_rt_expires ON refresh_tokens (expires_at)`,

  // Taxonomy & media
  `CREATE INDEX IF NOT EXISTS idx_authors_deleted_name ON authors (deleted_at, name_en)`,
  `CREATE INDEX IF NOT EXISTS idx_fields_deleted_order ON fields (deleted_at, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_categories_deleted_parent ON categories (deleted_at, parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_media_deleted_created ON media (deleted_at, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_media_path_deleted ON media (path, deleted_at)`,

  // Articles — composite covering indexes for every public & admin feed query
  `CREATE INDEX IF NOT EXISTS idx_articles_live_published ON articles (deleted_at, status, published_at DESC, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_articles_live_field ON articles (deleted_at, status, field_id, published_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_articles_live_featured ON articles (deleted_at, status, featured, published_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_articles_live_trending ON articles (deleted_at, status, trending, views DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_articles_live_views ON articles (deleted_at, status, views DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_articles_live_scheduled ON articles (deleted_at, status, scheduled_at)`,
  `CREATE INDEX IF NOT EXISTS idx_articles_author ON articles (author_id, deleted_at)`,

  // Translations, tags (reverse lookup!), and revisions
  `CREATE INDEX IF NOT EXISTS idx_at_locale_article ON article_translations (locale, article_id)`,
  `CREATE INDEX IF NOT EXISTS idx_atags_tag_article ON article_tags (tag_id, article_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rev_article_created ON article_revisions (article_id, created_at DESC)`,

  // Comments & moderation
  `CREATE INDEX IF NOT EXISTS idx_comments_article_locale_status ON comments (article_id, locale, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_status_created ON comments (status, created_at DESC)`,

  // Navigation, audience & audit logs
  `CREATE INDEX IF NOT EXISTS idx_menuitems_menu_order ON menu_items (menu_id, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_subscribers_status_created ON subscribers (status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_contact_status_created ON contact_messages (status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs (entity_type, entity_id)`,

  // API keys & idempotency
  `CREATE INDEX IF NOT EXISTS idx_apikeys_status_owner ON api_keys (status, owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON api_idempotency_keys (expires_at)`,

  // Privacy-first pageview analytics
  `CREATE INDEX IF NOT EXISTS idx_apv_created ON analytics_pageviews (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_apv_article_created ON analytics_pageviews (article_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_apv_locale_created ON analytics_pageviews (locale, created_at DESC)`,
] as const;

export interface LruCacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRatePct: number;
}

/**
 * Bounded O(1) LRU cache backed by JavaScript Map insertion order.
 * Keeps memory usage strictly capped while eliminating redundant SQL
 * regex translations and prepared-statement compilations on hot paths.
 */
export class LruCache<V> {
  private readonly store = new Map<string, V>();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxSize: number = STATEMENT_CACHE_MAX_SIZE) {
    this.maxSize = Math.max(1, Math.floor(maxSize));
  }

  get(key: string): V | undefined {
    const value = this.store.get(key);
    if (value === undefined) {
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    // Refresh recency
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
        this.evictions += 1;
      }
    }
    this.store.set(key, value);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  stats(): LruCacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRatePct: total > 0 ? Math.round((this.hits / total) * 1000) / 10 : 0,
    };
  }
}

export interface QueryPlanAnalysis {
  usesIndex: boolean;
  hasFullTableScan: boolean;
  hasTempBtree: boolean;
  details: string[];
}

/**
 * Inspects SQLite `EXPLAIN QUERY PLAN` output rows to verify index usage
 * and flag full table scans or temporary B-tree sorts.
 */
export function analyzeQueryPlan(
  rows: ReadonlyArray<{ detail?: unknown }>
): QueryPlanAnalysis {
  const details = rows
    .map((r) => (typeof r.detail === "string" ? r.detail : ""))
    .filter(Boolean);

  const usesIndex = details.some(
    (d) =>
      /\bUSING\s+(COVERING\s+)?INDEX\b/i.test(d) ||
      /\bUSING\s+INTEGER\s+PRIMARY\s+KEY\b/i.test(d) ||
      /\bSEARCH\b.*\bUSING\s+PRIMARY\s+KEY\b/i.test(d)
  );
  const hasFullTableScan = details.some(
    (d) => /\bSCAN\b/i.test(d) && !/\bUSING\s+(COVERING\s+)?INDEX\b/i.test(d)
  );
  const hasTempBtree = details.some((d) => /\bUSE\s+TEMP\s+B-TREE\b/i.test(d));

  return {
    usesIndex,
    hasFullTableScan,
    hasTempBtree,
    details,
  };
}

/**
 * Formats a UTC cutoff timestamp (`YYYY-MM-DD HH:MM:SS`) compatible with both
 * MySQL DATETIME and SQLite `datetime('now')` string ordering.
 */
export function formatSqlUtcCutoff(daysAgo: number, now: Date = new Date()): string {
  const safeDays = Math.max(1, Math.min(3650, Math.floor(daysAgo)));
  const cutoff = new Date(now.getTime() - safeDays * 86_400_000);
  return cutoff.toISOString().slice(0, 19).replace("T", " ");
}
