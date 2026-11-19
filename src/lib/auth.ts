import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

export const ACCESS_TOKEN_COOKIE = "aurora_at";
export const REFRESH_TOKEN_COOKIE = "aurora_rt";
export const CSRF_COOKIE = "aurora_csrf";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  name: string;
  role: string; // role name: super_admin | admin | editor
}

const DEV_FALLBACK_JWT_SECRET = "scienta-local-dev-jwt-secret-change-in-production-2026";
const JWT_ISSUER = "scienta";
const JWT_AUDIENCE = "scienta-admin";
const VALID_ROLES = new Set(["super_admin", "admin", "editor"]);

function isPreviewRuntime(): boolean {
  return Boolean(process.env.CSP_HEADER_VALUE?.trim() || process.env.K_SERVICE?.trim());
}

function getSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  const minLength = process.env.NODE_ENV === "production" ? 32 : 16;
  if (secret && secret.length >= minLength) {
    return new TextEncoder().encode(secret);
  }
  if (process.env.NODE_ENV !== "production" || isPreviewRuntime()) {
    return new TextEncoder().encode(DEV_FALLBACK_JWT_SECRET);
  }
  throw new Error(
    "JWT_SECRET is missing or too short (minimum 32 characters required in production). Set a long random value in your .env file."
  );
}

/**
 * Detects whether the incoming request arrived over HTTPS (either directly or
 * behind a TLS-terminating reverse proxy / Cloud Run ingress).
 */
export function isHttpsRequest(req: Request): boolean {
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto === "https") return true;
  if (forwardedProto === "http") return false;

  const origin = req.headers.get("origin")?.trim().toLowerCase();
  if (origin?.startsWith("https://")) return true;

  const referer = req.headers.get("referer")?.trim().toLowerCase();
  if (referer?.startsWith("https://")) return true;

  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

/**
 * Builds cookie attributes that work both in standalone tabs and inside
 * cross-site HTTPS preview iframes (`SameSite=None; Secure; Partitioned`),
 * while falling back to `SameSite=Lax; Secure=false` on plain `http://localhost`.
 */
export function buildAuthCookieOptions(
  req: Request,
  options: { httpOnly: boolean; path: string; maxAge: number }
) {
  const https = isHttpsRequest(req);
  if (https) {
    return {
      httpOnly: options.httpOnly,
      secure: true,
      sameSite: "none" as const,
      partitioned: true,
      path: options.path,
      maxAge: options.maxAge,
    };
  }
  return {
    httpOnly: options.httpOnly,
    secure: false,
    sameSite: "lax" as const,
    path: options.path,
    maxAge: options.maxAge,
  };
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .setSubject(payload.sub)
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.email !== "string" ||
      !payload.email ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string" ||
      !VALID_ROLES.has(payload.role)
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Generate a cryptographically random opaque token (used for refresh tokens & CSRF). */
export function randomToken(bytes = 48): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
