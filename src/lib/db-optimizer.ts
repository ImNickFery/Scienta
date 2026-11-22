import { execute, getActiveDbEngine, getDbPoolConfig, query } from "./db";
import { getSqliteFallback, type SqliteMaintenanceSummary, type SqlitePragmaDiagnostics } from "./sqlite-fallback";
import {
  analyzeQueryPlan,
  CORE_TABLES,
  type CoreTableName,
  type QueryPlanAnalysis,
} from "./db-optimizer-core";

export * from "./db-optimizer-core";

export interface QueryPlanCheck {
  name: string;
  usesIndex: boolean;
  hasFullTableScan: boolean;
  hasTempBtree: boolean;
  details: string[];
}

export interface DatabaseDiagnostics {
  engine: "sqlite" | "mysql";
  checkedAt: string;
  tableCounts: Partial<Record<CoreTableName, number>>;
  totalRows: number;
  sqlite?: SqlitePragmaDiagnostics;
  mysql?: {
    pool: ReturnType<typeof getDbPoolConfig>;
    indexCount: number;
  };
  queryPlanChecks?: QueryPlanCheck[];
}

export interface DatabaseMaintenanceResult {
  engine: "sqlite" | "mysql";
  ranAt: string;
  prunedExpiredRefreshTokens: number;
  prunedExpiredIdempotencyKeys: number;
  sqlite?: SqliteMaintenanceSummary;
  mysql?: {
    analyzedTables: number;
  };
}

/** Whitelisted, static probe queries used to verify SQLite index usage via EXPLAIN QUERY PLAN. */
const SQLITE_PLAN_PROBES: ReadonlyArray<{ name: string; sql: string; params: unknown[] }> = [
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
];

async function collectTableCounts(): Promise<{
  tableCounts: Partial<Record<CoreTableName, number>>;
  totalRows: number;
}> {
  const tableCounts: Partial<Record<CoreTableName, number>> = {};
  let totalRows = 0;

  // CORE_TABLES is a static compile-time whitelist (zero user input)
  const results = await Promise.all(
    CORE_TABLES.map(async (table) => {
      try {
        const rows = await query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
        return [table, Number(rows[0]?.count ?? 0)] as const;
      } catch {
        return [table, null] as const;
      }
    })
  );

  for (const [table, count] of results) {
    if (count !== null) {
      tableCounts[table] = count;
      totalRows += count;
    }
  }

  return { tableCounts, totalRows };
}

/**
 * Returns safe, non-sensitive database health & query-optimization diagnostics
 * for admin monitoring (never exposes disk paths, credentials, or raw params).
 */
export async function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics> {
  const engine = getActiveDbEngine();
  const { tableCounts, totalRows } = await collectTableCounts();

  if (engine === "sqlite") {
    const sqlite = getSqliteFallback();
    const diag = sqlite.getPragmaDiagnostics();
    const queryPlanChecks: QueryPlanCheck[] = SQLITE_PLAN_PROBES.map((probe) => {
      const plan: QueryPlanAnalysis = analyzeQueryPlan(
        sqlite.explainQueryPlan(probe.sql, probe.params)
      );
      return {
        name: probe.name,
        ...plan,
      };
    });

    return {
      engine,
      checkedAt: new Date().toISOString(),
      tableCounts,
      totalRows,
      sqlite: diag,
      queryPlanChecks,
    };
  }

  let indexCount = 0;
  try {
    const idxRows = await query<{ count: number }>(
      `SELECT COUNT(DISTINCT INDEX_NAME) AS count
         FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME != 'PRIMARY'`
    );
    indexCount = Number(idxRows[0]?.count ?? 0);
  } catch {
    indexCount = 0;
  }

  return {
    engine,
    checkedAt: new Date().toISOString(),
    tableCounts,
    totalRows,
    mysql: {
      pool: getDbPoolConfig(),
      indexCount,
    },
  };
}

/**
 * Executes safe, idempotent database maintenance:
 * 1. Prunes expired refresh tokens and expired API idempotency records.
 * 2. Refreshes query planner statistics (ANALYZE + PRAGMA optimize + WAL checkpoint on SQLite,
 *    or whitelisted ANALYZE TABLE on MySQL).
 */
export async function runDatabaseMaintenance(): Promise<DatabaseMaintenanceResult> {
  const engine = getActiveDbEngine();

  let prunedExpiredRefreshTokens = 0;
  let prunedExpiredIdempotencyKeys = 0;

  try {
    const rtRes = await execute(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);
    prunedExpiredRefreshTokens = Number(rtRes.affectedRows ?? 0);
  } catch {
    prunedExpiredRefreshTokens = 0;
  }

  try {
    const idempRes = await execute(`DELETE FROM api_idempotency_keys WHERE expires_at < NOW()`);
    prunedExpiredIdempotencyKeys = Number(idempRes.affectedRows ?? 0);
  } catch {
    prunedExpiredIdempotencyKeys = 0;
  }

  if (engine === "sqlite") {
    const sqliteSummary = getSqliteFallback().runMaintenance();
    return {
      engine,
      ranAt: new Date().toISOString(),
      prunedExpiredRefreshTokens,
      prunedExpiredIdempotencyKeys,
      sqlite: sqliteSummary,
    };
  }

  let analyzedTables = 0;
  for (const table of CORE_TABLES) {
    try {
      await query(`ANALYZE TABLE ${table}`);
      analyzedTables += 1;
    } catch {
      // Skip optional tables that may not exist in older MySQL deployments
    }
  }

  return {
    engine,
    ranAt: new Date().toISOString(),
    prunedExpiredRefreshTokens,
    prunedExpiredIdempotencyKeys,
    mysql: {
      analyzedTables,
    },
  };
}
