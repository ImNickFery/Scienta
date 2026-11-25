import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";
import { queryOne, execute, withTransaction } from "@/lib/db";
import {
  signAccessToken,
  randomToken,
  hashToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  CSRF_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  buildAuthCookieOptions,
} from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { verifySameOrigin } from "@/lib/security";
import { parseSqlUtcDate } from "@/lib/sql-dates";

interface RefreshRow {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  name: string;
  email: string;
  status: "active" | "suspended";
  deleted_at: string | null;
  role_name: string;
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const ip = getClientIp(req);
  const limit = rateLimit(`refresh:${ip}`, 30, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many refresh requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return NextResponse.json({ error: "No refresh token" }, { status: 401 });

  const hash = await hashToken(refreshToken);
  const row = await queryOne<RefreshRow>(
    `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.name, u.email, u.status, u.deleted_at, r.name AS role_name
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE rt.token_hash = ? LIMIT 1`,
    [hash]
  );

  const clearAuthCookies = () => {
    store.set(ACCESS_TOKEN_COOKIE, "", buildAuthCookieOptions(req, { httpOnly: true, path: "/", maxAge: 0 }));
    store.set(
      REFRESH_TOKEN_COOKIE,
      "",
      buildAuthCookieOptions(req, { httpOnly: true, path: "/api/admin/auth", maxAge: 0 })
    );
    store.set(CSRF_COOKIE, "", buildAuthCookieOptions(req, { httpOnly: false, path: "/", maxAge: 0 }));
  };

  const expiresAtDate = row ? parseSqlUtcDate(row.expires_at) : null;

  if (
    !row ||
    row.revoked_at ||
    row.deleted_at !== null ||
    !expiresAtDate ||
    expiresAtDate < new Date() ||
    row.status !== "active"
  ) {
    // Reuse detection: if an already-revoked refresh token is replayed, revoke all
    // active refresh tokens for that account to contain potential token theft.
    if (row?.revoked_at) {
      await execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`, [
        row.user_id,
      ]);
      await logActivity({
        userId: row.user_id,
        action: "auth.refresh_reuse_detected",
        ipAddress: ip,
      });
    }
    clearAuthCookies();
    return NextResponse.json({ error: "Refresh token invalid or expired" }, { status: 401 });
  }

  // Rotate atomically inside a transaction: ensure only ONE concurrent caller can revoke
  // and rotate a given refresh token (prevents parallel-refresh token multiplication).
  const newRefreshToken = randomToken();
  const newHash = await hashToken(newRefreshToken);
  const rotated = await withTransaction(async (conn) => {
    const [revokeResult] = (await conn.execute(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL`,
      [row.id]
    )) as [{ affectedRows?: number }, unknown];
    if (!revokeResult?.affectedRows) {
      return false;
    }
    await conn.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at)
       VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
      [uuid(), row.user_id, newHash, req.headers.get("user-agent") ?? null, ip, REFRESH_TOKEN_TTL_SECONDS]
    );
    return true;
  });

  if (!rotated) {
    await execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`, [
      row.user_id,
    ]);
    await logActivity({
      userId: row.user_id,
      action: "auth.refresh_reuse_detected",
      ipAddress: ip,
    });
    clearAuthCookies();
    return NextResponse.json({ error: "Refresh token already rotated" }, { status: 401 });
  }

  const accessToken = await signAccessToken({
    sub: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role_name,
  });
  const csrfToken = generateCsrfToken();

  store.set(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    buildAuthCookieOptions(req, {
      httpOnly: true,
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    })
  );
  store.set(
    REFRESH_TOKEN_COOKIE,
    newRefreshToken,
    buildAuthCookieOptions(req, {
      httpOnly: true,
      path: "/api/admin/auth",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    })
  );
  store.set(
    CSRF_COOKIE,
    csrfToken,
    buildAuthCookieOptions(req, {
      httpOnly: false,
      path: "/",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    })
  );

  return NextResponse.json({ ok: true });
}
