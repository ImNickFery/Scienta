import mysql from "mysql2/promise";
import { getSqliteFallback, type SqliteConnection } from "./sqlite-fallback";

declare global {
  var __auroraDbPool: mysql.Pool | undefined;
  var __scientaUseSqliteFallback: boolean | undefined;
}

export interface DbConnection {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
}

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EHOSTUNREACH",
  "PROTOCOL_CONNECTION_LOST",
]);

function isMysqlConfigured(): boolean {
  return Boolean(process.env.DB_HOST && process.env.DB_HOST.trim().length > 0);
}

function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message ?? "";
  return Boolean(
    (code && CONNECTION_ERROR_CODES.has(code)) ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND")
  );
}

function shouldUseSqlite(): boolean {
  if (globalThis.__scientaUseSqliteFallback) return true;
  if (!isMysqlConfigured()) {
    globalThis.__scientaUseSqliteFallback = true;
    return true;
  }
  return false;
}

function activateFallback(err: unknown) {
  if (!globalThis.__scientaUseSqliteFallback) {
    console.warn(
      "[db] MySQL connection unavailable, switching to built-in seeded SQLite database:",
      err instanceof Error ? err.message : String(err)
    );
    globalThis.__scientaUseSqliteFallback = true;
  }
}

function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "aurora_science",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
    queueLimit: 0,
    connectTimeout: 2000,
    dateStrings: true,
    charset: "utf8mb4_unicode_ci",
  });
}

function getMysqlPool(): mysql.Pool {
  if (!globalThis.__auroraDbPool) {
    globalThis.__auroraDbPool = createPool();
  }
  return globalThis.__auroraDbPool;
}

/** Run a parameterized query. Always use placeholders — never string-concat user input. */
export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (shouldUseSqlite()) {
    return getSqliteFallback().query<T>(sql, params);
  }
  try {
    const [rows] = await getMysqlPool().query(sql, params);
    return rows as T[];
  } catch (err) {
    if (isConnectionError(err)) {
      activateFallback(err);
      return getSqliteFallback().query<T>(sql, params);
    }
    throw err;
  }
}

/** Run a single-row query, returning null if not found. */
export async function queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Execute an INSERT/UPDATE/DELETE and return the result metadata. */
export async function execute(sql: string, params: unknown[] = []) {
  if (shouldUseSqlite()) {
    return getSqliteFallback().execute(sql, params) as unknown as mysql.ResultSetHeader;
  }
  try {
    const [result] = await (
      getMysqlPool().execute as (
        sql: string,
        params: unknown[]
      ) => Promise<[mysql.ResultSetHeader, mysql.FieldPacket[]]>
    )(sql, params);
    return result as mysql.ResultSetHeader;
  } catch (err) {
    if (isConnectionError(err)) {
      activateFallback(err);
      return getSqliteFallback().execute(sql, params) as unknown as mysql.ResultSetHeader;
    }
    throw err;
  }
}

/** Run multiple statements inside a transaction. */
export async function withTransaction<T>(fn: (conn: DbConnection) => Promise<T>): Promise<T> {
  if (shouldUseSqlite()) {
    return getSqliteFallback().withTransaction((conn: SqliteConnection) => fn(conn));
  }
  let conn: mysql.PoolConnection;
  try {
    conn = await getMysqlPool().getConnection();
  } catch (err) {
    if (isConnectionError(err)) {
      activateFallback(err);
      return getSqliteFallback().withTransaction((c: SqliteConnection) => fn(c));
    }
    throw err;
  }
  try {
    await conn.beginTransaction();
    const result = await fn(conn as unknown as DbConnection);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
