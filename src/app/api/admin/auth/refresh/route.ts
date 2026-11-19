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
} from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";

interface RefreshRow {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  name: string;
  email: string;
  status: "active" | "suspended";
  role_name: string;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = rateLimit(`refresh:${ip}`, 30, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many refresh requests. Try again later." }, { status: 429 });
  }

  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return NextResponse.json({ error: "No refresh token" }, { status: 401 });

  const hash = await hashToken(refreshToken);
  const row = await queryOne<RefreshRow>(
    `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.name, u.email, u.status, r.name AS role_name
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE rt.token_hash = ? LIMIT 1`,
    [hash]
  );

  const isProd = process.env.NODE_ENV === "production";

  const clearAuthCookies = () => {
    store.set(ACCESS_TOKEN_COOKIE, "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
    store.set(REFRESH_TOKEN_COOKIE, "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/api/admin/auth",
      maxAge: 0,
    });
    store.set(CSRF_COOKIE, "", { httpOnly: false, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
  };

  if (!row || row.revoked_at || new Date(row.expires_at) < new Date() || row.status !== "active") {
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

  // Rotate inside a transaction: revoke old refresh token and issue a new one.
  const newRefreshToken = randomToken();
  const newHash = await hashToken(newRefreshToken);
  await withTransaction(async (conn) => {
    await conn.execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?`, [row.id]);
    await conn.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at)
       VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
      [uuid(), row.user_id, newHash, req.headers.get("user-agent") ?? null, ip, REFRESH_TOKEN_TTL_SECONDS]
    );
  });

  const accessToken = await signAccessToken({
    sub: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role_name,
  });
  const csrfToken = generateCsrfToken();

  store.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  store.set(REFRESH_TOKEN_COOKIE, newRefreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/admin/auth",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  store.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
