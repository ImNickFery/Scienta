import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { queryOne, execute } from "@/lib/db";
import {
  signAccessToken,
  verifyPassword,
  randomToken,
  hashToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  CSRF_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { badRequest } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  status: "active" | "suspended";
  role_name: string;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = rateLimit(`login:${ip}`, 8, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid credentials format", parsed.error.flatten());

  const { email, password } = parsed.data;

  const user = await queryOne<UserRow>(
    `SELECT u.id, u.name, u.email, u.password_hash, u.status, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.email = ? AND u.deleted_at IS NULL LIMIT 1`,
    [email]
  );

  // Constant-shape response whether the user exists or not, to avoid
  // leaking which emails are registered.
  if (!user || user.status !== "active" || !(await verifyPassword(password, user.password_hash))) {
    await logActivity({ userId: null, action: "auth.login_failed", meta: { email }, ipAddress: ip });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role_name,
  });

  const refreshToken = randomToken();
  const refreshHash = await hashToken(refreshToken);
  await execute(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [uuid(), user.id, refreshHash, req.headers.get("user-agent") ?? null, ip, REFRESH_TOKEN_TTL_SECONDS]
  );

  await execute(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);
  await logActivity({ userId: user.id, action: "auth.login", ipAddress: ip });

  const csrfToken = generateCsrfToken();
  const store = await cookies();
  const isProd = process.env.NODE_ENV === "production";

  store.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/admin/auth",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  store.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false, // must be readable by client JS for the double-submit pattern
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role_name },
  });
}
