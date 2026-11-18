import mysql from "mysql2/promise";

declare global {
  var __auroraDbPool: mysql.Pool | undefined;
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
    dateStrings: true,
    charset: "utf8mb4_unicode_ci",
  });
}

// Reuse a single pool across hot reloads in dev and across route invocations in prod.
export const pool = globalThis.__auroraDbPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__auroraDbPool = pool;
}

/** Run a parameterized query. Always use placeholders — never string-concat user input. */
export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

/** Run a single-row query, returning null if not found. */
export async function queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Execute an INSERT/UPDATE/DELETE and return the result metadata. */
export async function execute(sql: string, params: unknown[] = []) {
  const [result] = await (pool.execute as (sql: string, params: unknown[]) => Promise<[mysql.ResultSetHeader, mysql.FieldPacket[]]>)(sql, params);
  return result as mysql.ResultSetHeader;
}

/** Run multiple statements inside a transaction. */
export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
