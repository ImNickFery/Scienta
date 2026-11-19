import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, verifyAccessToken, type AccessTokenPayload } from "./auth";
import { can } from "./rbac";
import { CSRF_HEADER, verifyCsrf } from "./csrf";
import { verifySameOrigin } from "./security";
import { queryOne } from "./db";

interface LiveUserState {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  deleted_at: string | null;
  role_name: string;
}

export async function getSession(): Promise<AccessTokenPayload | null> {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

/**
 * Verifies the signed JWT AND checks live account status & role in the database,
 * guaranteeing immediate session revocation when a user is suspended, deleted, or
 * demoted (no 15-minute stale-token window).
 */
export async function getVerifiedLiveSession(): Promise<AccessTokenPayload | null> {
  const tokenSession = await getSession();
  if (!tokenSession) return null;

  const live = await queryOne<LiveUserState>(
    `SELECT u.id, u.name, u.email, u.status, u.deleted_at, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? LIMIT 1`,
    [tokenSession.sub]
  );

  if (!live || live.deleted_at !== null || live.status !== "active") {
    return null;
  }

  return {
    sub: live.id,
    email: live.email,
    name: live.name,
    role: live.role_name,
  };
}

export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "You don't have permission to do this") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

/**
 * Guard for API route handlers: verifies the live session (JWT + active DB status)
 * and, if `permission` is given, checks the caller's live role against the RBAC matrix.
 */
export async function requireApiAuth(permission?: string) {
  const session = await getVerifiedLiveSession();
  if (!session) return { session: null, response: unauthorized() } as const;
  if (permission && !can(session.role, permission)) {
    return { session, response: forbidden() } as const;
  }
  return { session, response: null } as const;
}

/**
 * Guard for state-changing (POST/PUT/PATCH/DELETE) admin API requests:
 * enforces Same-Origin, live auth + RBAC permission, AND the CSRF double-submit
 * cookie/header pair.
 */
export async function requireAdminMutation(req: Request, permission?: string) {
  if (!verifySameOrigin(req)) {
    return {
      session: null,
      response: NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 }),
    } as const;
  }

  const auth = await requireApiAuth(permission);
  if (auth.response) return auth;

  const store = await cookies();
  const csrfCookie = store.get(CSRF_COOKIE)?.value;
  const csrfHeader = req.headers.get(CSRF_HEADER);
  if (!verifyCsrf(csrfCookie, csrfHeader)) {
    return {
      session: auth.session,
      response: NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
    } as const;
  }
  return auth;
}
