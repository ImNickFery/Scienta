import crypto from "node:crypto";
import { v4 as uuid } from "uuid";
import { queryOne, execute, getActiveDbEngine } from "./db";
import { hashPassword, verifyPassword } from "./auth";

const DEFAULT_ADMIN_EMAIL = "admin@scienta.ir";
const DEFAULT_ADMIN_PASSWORD = "ChangeMe_2026!";
const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EnvAdminCredentials {
  email: string;
  password: string;
}

export interface AdminSyncDb {
  queryOne: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | null>;
  execute: (sql: string, params?: unknown[]) => Promise<unknown>;
}

export type AdminSyncResult =
  | "skipped"
  | "unchanged"
  | "updated"
  | "migrated"
  | "created"
  | "repaired_empty";

interface RoleRow {
  id: string;
}

interface UserSyncRow {
  id: string;
  email: string;
  password_hash: string;
  role_id: string;
  status: string;
  deleted_at: string | null;
}

/**
 * Extracts and validates operator-configured admin credentials from server
 * environment variables (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, with
 * `ADMIN_EMAIL` / `ADMIN_PASSWORD` accepted as aliases). Empty strings from
 * template `.env` files are ignored safely.
 */
export function resolveEnvAdminCredentials(
  env: Record<string, string | undefined> = process.env
): EnvAdminCredentials | null {
  const rawEmail = env.SEED_ADMIN_EMAIL?.trim() || env.ADMIN_EMAIL?.trim() || "";
  const rawPassword = env.SEED_ADMIN_PASSWORD?.trim() || env.ADMIN_PASSWORD?.trim() || "";

  if (!rawEmail || !rawPassword) return null;

  const email = rawEmail.toLowerCase();
  if (email.length > 190 || !BASIC_EMAIL_RE.test(email)) return null;
  if (rawPassword.length > 128) return null;

  return { email, password: rawPassword };
}

async function ensureSuperAdminRoleId(db: AdminSyncDb): Promise<string | null> {
  const existing = await db.queryOne<RoleRow>(
    `SELECT id FROM roles WHERE name = ? LIMIT 1`,
    ["super_admin"]
  );
  if (existing?.id) return existing.id;

  const newRoleId = uuid();
  await db.execute(
    `INSERT IGNORE INTO roles (id, name, label, description) VALUES (?, ?, ?, ?)`,
    [newRoleId, "super_admin", "Super Admin", "Full unrestricted access"]
  );

  const resolved = await db.queryOne<RoleRow>(
    `SELECT id FROM roles WHERE name = ? LIMIT 1`,
    ["super_admin"]
  );
  return resolved?.id ?? null;
}

/**
 * Synchronizes the super_admin user in either SQLite or MySQL with environment
 * variables configured on the host (e.g. cPanel Environment Variables).
 *
 * - If `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` are set:
 *   1. Updates the matching user's password/role/active status if it already exists.
 *   2. Otherwise migrates a legacy default (`admin@scienta.ir`) or corrupted
 *      empty-email super admin row in place (retiring default credentials and
 *      preserving foreign keys on seeded articles/media).
 *   3. Otherwise inserts a fresh active `super_admin` user.
 * - If no env credentials are set:
 *   - Self-heals a corrupted empty-email row created by older `.env` copies ONLY
 *     when no valid active super admin exists.
 */
export async function syncEnvSuperAdminWithDb(
  db: AdminSyncDb,
  env: Record<string, string | undefined> = process.env
): Promise<AdminSyncResult> {
  const creds = resolveEnvAdminCredentials(env);

  if (!creds) {
    // Self-heal legacy installations where an empty `SEED_ADMIN_EMAIL=` line in `.env`
    // caused the initial seed to create a super_admin row with `email = ''`.
    const superAdminRoleId = await db.queryOne<RoleRow>(
      `SELECT id FROM roles WHERE name = ? LIMIT 1`,
      ["super_admin"]
    );
    if (!superAdminRoleId?.id) return "skipped";

    const validSuperAdmin = await db.queryOne<{ id: string }>(
      `SELECT id FROM users
       WHERE role_id = ? AND TRIM(email) <> '' AND status = 'active' AND deleted_at IS NULL
       LIMIT 1`,
      [superAdminRoleId.id]
    );
    if (validSuperAdmin) return "skipped";

    const brokenEmpty = await db.queryOne<{ id: string }>(
      `SELECT id FROM users WHERE role_id = ? AND TRIM(email) = '' LIMIT 1`,
      [superAdminRoleId.id]
    );
    if (!brokenEmpty) return "skipped";

    const fallbackHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    await db.execute(
      `UPDATE users SET email = ?, password_hash = ?, status = 'active', deleted_at = NULL WHERE id = ?`,
      [DEFAULT_ADMIN_EMAIL, fallbackHash, brokenEmpty.id]
    );
    return "repaired_empty";
  }

  const superAdminRoleId = await ensureSuperAdminRoleId(db);
  if (!superAdminRoleId) return "skipped";

  const existing = await db.queryOne<UserSyncRow>(
    `SELECT id, email, password_hash, role_id, status, deleted_at
     FROM users
     WHERE LOWER(email) = ?
     LIMIT 1`,
    [creds.email]
  );

  if (existing) {
    const passwordMatches = existing.password_hash
      ? await verifyPassword(creds.password, existing.password_hash).catch(() => false)
      : false;
    const needsUpdate =
      !passwordMatches ||
      existing.email !== creds.email ||
      existing.role_id !== superAdminRoleId ||
      existing.status !== "active" ||
      existing.deleted_at !== null;

    if (!needsUpdate) return "unchanged";

    const passwordHash = passwordMatches
      ? existing.password_hash
      : await hashPassword(creds.password);
    await db.execute(
      `UPDATE users
       SET email = ?, password_hash = ?, role_id = ?, status = 'active', deleted_at = NULL
       WHERE id = ?`,
      [creds.email, passwordHash, superAdminRoleId, existing.id]
    );
    return "updated";
  }

  // Migrate legacy default or broken empty-email super admin in place so
  // default credentials are immediately retired and FK references stay intact.
  const legacySuperAdmin = await db.queryOne<UserSyncRow>(
    `SELECT id, email, password_hash, role_id, status, deleted_at
     FROM users
     WHERE role_id = ? AND (LOWER(email) = ? OR TRIM(email) = '')
     LIMIT 1`,
    [superAdminRoleId, DEFAULT_ADMIN_EMAIL]
  );

  const passwordHash = await hashPassword(creds.password);

  if (legacySuperAdmin) {
    await db.execute(
      `UPDATE users
       SET email = ?, password_hash = ?, role_id = ?, status = 'active', deleted_at = NULL
       WHERE id = ?`,
      [creds.email, passwordHash, superAdminRoleId, legacySuperAdmin.id]
    );
    return "migrated";
  }

  await db.execute(
    `INSERT INTO users (id, name, email, password_hash, role_id, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [uuid(), "Super Admin", creds.email, passwordHash, superAdminRoleId]
  );
  return "created";
}

declare global {
  var __scientaEnvAdminSyncKey: string | undefined;
  var __scientaEnvAdminSyncPromise: Promise<AdminSyncResult> | undefined;
}

function computeSyncFingerprint(creds: EnvAdminCredentials | null): string {
  const engine = getActiveDbEngine();
  if (!creds) return `${engine}:none`;
  const pwdDigest = crypto.createHash("sha256").update(creds.password).digest("hex");
  return `${engine}:${creds.email}:${pwdDigest}`;
}

export function resetEnvSuperAdminSyncCache() {
  globalThis.__scientaEnvAdminSyncKey = undefined;
  globalThis.__scientaEnvAdminSyncPromise = undefined;
}

/**
 * Process-memoized entry point called before admin login so cPanel / server
 * environment variables take effect automatically on restart for both SQLite
 * and MySQL without incurring per-request bcrypt work.
 */
export async function syncEnvSuperAdmin(): Promise<AdminSyncResult> {
  const creds = resolveEnvAdminCredentials(process.env);
  const fingerprint = computeSyncFingerprint(creds);

  if (
    globalThis.__scientaEnvAdminSyncKey === fingerprint &&
    globalThis.__scientaEnvAdminSyncPromise
  ) {
    return globalThis.__scientaEnvAdminSyncPromise;
  }

  const promise = syncEnvSuperAdminWithDb({ queryOne, execute }, process.env).catch((err) => {
    if (globalThis.__scientaEnvAdminSyncPromise === promise) {
      globalThis.__scientaEnvAdminSyncKey = undefined;
      globalThis.__scientaEnvAdminSyncPromise = undefined;
    }
    throw err;
  });

  globalThis.__scientaEnvAdminSyncKey = fingerprint;
  globalThis.__scientaEnvAdminSyncPromise = promise;
  return promise;
}
