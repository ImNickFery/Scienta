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
  buildAuthCookieOptions,
} from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { badRequest } from "@/lib/session";
import { verifySameOrigin } from "@/lib/security";

const loginSchema = z.object({
  email: z.string().trim().email().max(190),
  password: z.string().min(1).max(128),
});

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  status: "active" | "suspended";
  role_name: string;
}

// Precomputed bcrypt hash (cost 12) used when the email does not exist so
// invalid-email requests take comparable time to wrong-password requests.
const DUMMY_PASSWORD_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO9uM/7i7R4q4c8m2yR7d4hK8J/e2m2W.";

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const ip = getClientIp(req);
  const ipLimit = rateLimit(`login:ip:${ip}`, 8, 15 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid credentials format", parsed.error.flatten());

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  // Dual-key rate limit prevents distributed credential stuffing against a single account.
  const acctLimit = rateLimit(`login:acct:${email}`, 10, 15 * 60 * 1000);
  if (!acctLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts for this account. Try again later." },
      { status: 429, headers: { "Retry-After": String(acctLimit.retryAfterSeconds) } }
    );
  }

  const user = await queryOne<UserRow>(
    `SELECT u.id, u.name, u.email, u.password_hash, u.status, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE LOWER(u.email) = ? AND u.deleted_at IS NULL LIMIT 1`,
    [email]
  );

  // Constant-shape & constant-time verification whether the user exists or not,
  // to avoid leaking which emails are registered.
  const passwordValid = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || user.status !== "active" || !passwordValid) {
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
    refreshToken,
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
      httpOnly: false, // must be readable by client JS for the double-submit pattern
      path: "/",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    })
  );

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role_name },
  });
}
