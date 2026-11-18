import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, verifyAccessToken, type AccessTokenPayload } from "./auth";
import { can } from "./rbac";
import { CSRF_COOKIE } from "./auth";
import { CSRF_HEADER, verifyCsrf } from "./csrf";

export async function getSession(): Promise<AccessTokenPayload | null> {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
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
 * Guard for API route handlers: verifies the session and, if `permission`
 * is given, checks the caller's role against the RBAC matrix. Returns the
 * session on success, or a ready-to-return NextResponse on failure.
 */
export async function requireApiAuth(permission?: string) {
  const session = await getSession();
  if (!session) return { session: null, response: unauthorized() } as const;
  if (permission && !can(session.role, permission)) {
    return { session, response: forbidden() } as const;
  }
  return { session, response: null } as const;
}

/**
 * Guard for state-changing (POST/PUT/PATCH/DELETE) admin API requests:
 * verifies auth + permission (via requireApiAuth) AND the CSRF
 * double-submit cookie/header pair.
 */
export async function requireAdminMutation(req: Request, permission?: string) {
  const auth = await requireApiAuth(permission);
  if (auth.response) return auth;

  const store = await cookies();
  const csrfCookie = store.get(CSRF_COOKIE)?.value;
  const csrfHeader = req.headers.get(CSRF_HEADER);
  if (!verifyCsrf(csrfCookie, csrfHeader)) {
    return { session: auth.session, response: NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }) } as const;
  }
  return auth;
}
