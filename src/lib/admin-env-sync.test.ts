import test from "node:test";
import assert from "node:assert/strict";
import { SqliteFallbackDb } from "./sqlite-fallback";
import { verifyPassword } from "./auth";
import {
  resolveEnvAdminCredentials,
  syncEnvSuperAdminWithDb,
  type AdminSyncDb,
} from "./admin-env-sync";

function wrapSqlite(db: SqliteFallbackDb): AdminSyncDb {
  return {
    async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
      const rows = db.query<T>(sql, params);
      return rows[0] ?? null;
    },
    async execute(sql: string, params: unknown[] = []) {
      return db.execute(sql, params);
    },
  };
}

test("resolveEnvAdminCredentials handles SEED_ADMIN_*, ADMIN_* fallback, whitespace, and empty strings", () => {
  assert.equal(resolveEnvAdminCredentials({}), null);
  assert.equal(
    resolveEnvAdminCredentials({ SEED_ADMIN_EMAIL: "", SEED_ADMIN_PASSWORD: "" }),
    null
  );
  assert.equal(
    resolveEnvAdminCredentials({ SEED_ADMIN_EMAIL: "   ", SEED_ADMIN_PASSWORD: "secret" }),
    null
  );
  assert.equal(
    resolveEnvAdminCredentials({ SEED_ADMIN_EMAIL: "not-an-email", SEED_ADMIN_PASSWORD: "secret" }),
    null
  );

  assert.deepEqual(
    resolveEnvAdminCredentials({
      SEED_ADMIN_EMAIL: "  Owner@Scienta.IR ",
      SEED_ADMIN_PASSWORD: " MyStrongPass_2026! ",
    }),
    { email: "owner@scienta.ir", password: "MyStrongPass_2026!" }
  );

  assert.deepEqual(
    resolveEnvAdminCredentials({
      SEED_ADMIN_EMAIL: "",
      SEED_ADMIN_PASSWORD: "",
      ADMIN_EMAIL: "boss@example.com",
      ADMIN_PASSWORD: "AliasPassword_99!",
    }),
    { email: "boss@example.com", password: "AliasPassword_99!" }
  );
});

test("syncEnvSuperAdminWithDb migrates pre-existing default admin to configured cPanel env credentials", async () => {
  const db = new SqliteFallbackDb(":memory:");
  try {
    const adapter = wrapSqlite(db);
    const before = db.query<{ email: string }>(`SELECT email FROM users`);
    assert.equal(before.length, 1);
    assert.equal(before[0].email, "admin@scienta.ir");

    const res = await syncEnvSuperAdminWithDb(adapter, {
      SEED_ADMIN_EMAIL: "Mahdi@Scienta.ir",
      SEED_ADMIN_PASSWORD: "NewCpanelPassword!2026",
    });
    assert.equal(res, "migrated");

    // Default admin@scienta.ir row is replaced in place (retired)
    const users = db.query<{ email: string; password_hash: string; status: string }>(
      `SELECT email, password_hash, status FROM users`
    );
    assert.equal(users.length, 1);
    assert.equal(users[0].email, "mahdi@scienta.ir");
    assert.equal(users[0].status, "active");
    assert.equal(await verifyPassword("NewCpanelPassword!2026", users[0].password_hash), true);
    assert.equal(await verifyPassword("ChangeMe_2026!", users[0].password_hash), false);

    // Repeating with same credentials is a fast no-op ("unchanged")
    const second = await syncEnvSuperAdminWithDb(adapter, {
      SEED_ADMIN_EMAIL: "mahdi@scienta.ir",
      SEED_ADMIN_PASSWORD: "NewCpanelPassword!2026",
    });
    assert.equal(second, "unchanged");

    // Changing password updates existing user cleanly
    const updated = await syncEnvSuperAdminWithDb(adapter, {
      SEED_ADMIN_EMAIL: "mahdi@scienta.ir",
      SEED_ADMIN_PASSWORD: "RotatedPassword#99",
    });
    assert.equal(updated, "updated");

    const refreshed = db.query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE LOWER(email) = ?`,
      ["mahdi@scienta.ir"]
    );
    assert.equal(await verifyPassword("RotatedPassword#99", refreshed[0].password_hash), true);
  } finally {
    db.close();
  }
});

test("syncEnvSuperAdminWithDb heals legacy corrupted empty-email super_admin rows from blank .env templates", async () => {
  const db = new SqliteFallbackDb(":memory:");
  try {
    const adapter = wrapSqlite(db);
    // Simulate the old `.env` bug where SEED_ADMIN_EMAIL="" seeded a row with email=''
    db.execute(`UPDATE users SET email = '', password_hash = ''`);

    // Case 1: With cPanel env vars configured, heals directly to configured credentials
    const healed = await syncEnvSuperAdminWithDb(adapter, {
      SEED_ADMIN_EMAIL: "admin@mydomain.com",
      SEED_ADMIN_PASSWORD: "FixedPassword_2026!",
    });
    assert.equal(healed, "migrated");

    const row = db.query<{ email: string; password_hash: string }>(
      `SELECT email, password_hash FROM users LIMIT 1`
    )[0];
    assert.equal(row.email, "admin@mydomain.com");
    assert.equal(await verifyPassword("FixedPassword_2026!", row.password_hash), true);

    // Case 2: Without env vars, heals broken empty-email row back to default admin
    db.execute(`UPDATE users SET email = '', password_hash = ''`);
    const repaired = await syncEnvSuperAdminWithDb(adapter, {});
    assert.equal(repaired, "repaired_empty");
    const defaultRow = db.query<{ email: string; password_hash: string }>(
      `SELECT email, password_hash FROM users LIMIT 1`
    )[0];
    assert.equal(defaultRow.email, "admin@scienta.ir");
    assert.equal(await verifyPassword("ChangeMe_2026!", defaultRow.password_hash), true);
  } finally {
    db.close();
  }
});

test("syncEnvSuperAdminWithDb reactivates soft-deleted or suspended admin matching env credentials", async () => {
  const db = new SqliteFallbackDb(":memory:");
  try {
    const adapter = wrapSqlite(db);
    db.execute(
      `UPDATE users SET email = ?, status = 'suspended', deleted_at = datetime('now')`,
      ["locked@scienta.ir"]
    );

    const res = await syncEnvSuperAdminWithDb(adapter, {
      SEED_ADMIN_EMAIL: "locked@scienta.ir",
      SEED_ADMIN_PASSWORD: "RecoveredPass_2026!",
    });
    assert.equal(res, "updated");

    const user = db.query<{ status: string; deleted_at: string | null; password_hash: string }>(
      `SELECT status, deleted_at, password_hash FROM users WHERE LOWER(email) = ?`,
      ["locked@scienta.ir"]
    )[0];
    assert.equal(user.status, "active");
    assert.equal(user.deleted_at, null);
    assert.equal(await verifyPassword("RecoveredPass_2026!", user.password_hash), true);
  } finally {
    db.close();
  }
});

test("SqliteFallbackDb ignores empty SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD strings on fresh seed", async () => {
  const prevEmail = process.env.SEED_ADMIN_EMAIL;
  const prevPass = process.env.SEED_ADMIN_PASSWORD;
  process.env.SEED_ADMIN_EMAIL = "";
  process.env.SEED_ADMIN_PASSWORD = "   ";
  try {
    const db = new SqliteFallbackDb(":memory:");
    try {
      const user = db.query<{ email: string; password_hash: string }>(
        `SELECT email, password_hash FROM users LIMIT 1`
      )[0];
      assert.equal(user.email, "admin@scienta.ir");
      assert.equal(await verifyPassword("ChangeMe_2026!", user.password_hash), true);
    } finally {
      db.close();
    }
  } finally {
    if (prevEmail === undefined) delete process.env.SEED_ADMIN_EMAIL;
    else process.env.SEED_ADMIN_EMAIL = prevEmail;
    if (prevPass === undefined) delete process.env.SEED_ADMIN_PASSWORD;
    else process.env.SEED_ADMIN_PASSWORD = prevPass;
  }
});
