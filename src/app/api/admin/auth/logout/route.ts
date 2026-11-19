import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { execute } from "@/lib/db";
import { REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE, CSRF_COOKIE, hashToken } from "@/lib/auth";
import { CSRF_HEADER, verifyCsrf } from "@/lib/csrf";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const store = await cookies();
  const csrfCookie = store.get(CSRF_COOKIE)?.value;
  if (csrfCookie && !verifyCsrf(csrfCookie, req.headers.get(CSRF_HEADER))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const session = await getSession();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    const hash = await hashToken(refreshToken);
    await execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?`, [hash]);
  }

  if (session) {
    await logActivity({ userId: session.sub, action: "auth.logout", ipAddress: getClientIp(req) });
  }

  const isProd = process.env.NODE_ENV === "production";
  store.set(ACCESS_TOKEN_COOKIE, "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
  store.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/admin/auth",
    maxAge: 0,
  });
  store.set(CSRF_COOKIE, "", { httpOnly: false, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });

  return NextResponse.json({ ok: true });
}
