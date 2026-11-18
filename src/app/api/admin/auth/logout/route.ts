import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { execute } from "@/lib/db";
import { REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE, CSRF_COOKIE, hashToken } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getSession();
  const store = await cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    const hash = await hashToken(refreshToken);
    await execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?`, [hash]);
  }

  if (session) {
    await logActivity({ userId: session.sub, action: "auth.logout", ipAddress: getClientIp(req) });
  }

  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
  store.delete(CSRF_COOKIE);

  return NextResponse.json({ ok: true });
}
