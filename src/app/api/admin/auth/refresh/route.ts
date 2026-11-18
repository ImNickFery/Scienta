import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";
import { queryOne, execute } from "@/lib/db";
import {
  signAccessToken,
  randomToken,
  hashToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";

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

  if (!row || row.revoked_at || new Date(row.expires_at) < new Date() || row.status !== "active") {
    store.delete(ACCESS_TOKEN_COOKIE);
    store.delete(REFRESH_TOKEN_COOKIE);
    return NextResponse.json({ error: "Refresh token invalid or expired" }, { status: 401 });
  }

  // Rotate: revoke the old refresh token, issue a new one.
  await execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?`, [row.id]);
  const newRefreshToken = randomToken();
  const newHash = await hashToken(newRefreshToken);
  await execute(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [uuid(), row.user_id, newHash, req.headers.get("user-agent") ?? null, getClientIp(req), REFRESH_TOKEN_TTL_SECONDS]
  );

  const accessToken = await signAccessToken({
    sub: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role_name,
  });

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

  return NextResponse.json({ ok: true });
}
