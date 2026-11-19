import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { execute } from "@/lib/db";
import {
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  hashToken,
  buildAuthCookieOptions,
} from "@/lib/auth";
import { CSRF_HEADER, verifyCsrf } from "@/lib/csrf";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { verifySameOrigin } from "@/lib/security";

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const store = await cookies();
  const csrfCookie = store.get(CSRF_COOKIE)?.value;
  const session = await getSession();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if ((csrfCookie || session || refreshToken) && !verifyCsrf(csrfCookie, req.headers.get(CSRF_HEADER))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  if (refreshToken) {
    const hash = await hashToken(refreshToken);
    await execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?`, [hash]);
  }

  if (session) {
    await logActivity({ userId: session.sub, action: "auth.logout", ipAddress: getClientIp(req) });
  }

  store.set(ACCESS_TOKEN_COOKIE, "", buildAuthCookieOptions(req, { httpOnly: true, path: "/", maxAge: 0 }));
  store.set(
    REFRESH_TOKEN_COOKIE,
    "",
    buildAuthCookieOptions(req, { httpOnly: true, path: "/api/admin/auth", maxAge: 0 })
  );
  store.set(CSRF_COOKIE, "", buildAuthCookieOptions(req, { httpOnly: false, path: "/", maxAge: 0 }));

  return NextResponse.json({ ok: true });
}
