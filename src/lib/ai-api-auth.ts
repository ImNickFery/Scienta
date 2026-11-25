import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { execute, queryOne } from "./db";
import { parseSqlUtcDate } from "./sql-dates";
import { hashToken, randomToken } from "./auth";
import { getClientIp, rateLimit, type RateLimitResult } from "./rate-limit";
import { logActivity } from "./activity-log";

export const API_SCOPES = [
  "articles:read",
  "articles:write",
  "articles:publish",
  "media:read",
  "media:write",
  "taxonomy:read",
  "taxonomy:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export interface ScopeDescriptor {
  scope: ApiScope;
  label: string;
  description: string;
  risk: "low" | "medium" | "high";
}

export const SCOPE_CATALOG: ScopeDescriptor[] = [
  {
    scope: "taxonomy:read",
    label: "Read Taxonomy & Schema",
    description: "Inspect scientific fields, categories, authors, tags, and MDX schema guides.",
    risk: "low",
  },
  {
    scope: "taxonomy:write",
    label: "Create Tags",
    description: "Create new bilingual tags or auto-register tags while uploading articles.",
    risk: "medium",
  },
  {
    scope: "media:read",
    label: "Read Media Library",
    description: "List uploaded images and inspect cover media metadata.",
    risk: "low",
  },
  {
    scope: "media:write",
    label: "Upload Media",
    description: "Upload cover/article images via multipart, base64, or verified HTTPS URL.",
    risk: "medium",
  },
  {
    scope: "articles:read",
    label: "Read Articles",
    description: "List and read articles including drafts, scheduled posts, and translations.",
    risk: "low",
  },
  {
    scope: "articles:write",
    label: "Create & Edit Drafts",
    description: "Create/update draft or scheduled articles, run dry-run validation, or move to trash.",
    risk: "medium",
  },
  {
    scope: "articles:publish",
    label: "Publish & Feature Live",
    description: "Publish articles directly onto the live site or mark them featured/trending.",
    risk: "high",
  },
];

export const SCOPE_PRESETS: Record<string, { label: string; scopes: ApiScope[] }> = {
  draft_agent: {
    label: "AI Draft Writer (Human Review)",
    scopes: ["taxonomy:read", "taxonomy:write", "media:read", "media:write", "articles:read", "articles:write"],
  },
  full_publisher: {
    label: "Full Autonomous Publisher",
    scopes: [...API_SCOPES],
  },
  read_only: {
    label: "Read-Only Research Agent",
    scopes: ["taxonomy:read", "media:read", "articles:read"],
  },
};

export interface AuthenticatedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiScope[];
  ownerUserId: string;
  ownerName: string;
  ownerRole: string;
  defaultAuthorId: string | null;
  rateLimitPerMin: number;
  requestCount: number;
  expiresAt: string | null;
}

interface ApiKeyDbRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes_json: string;
  owner_user_id: string;
  default_author_id: string | null;
  rate_limit_per_min: number;
  status: string;
  request_count: number;
  expires_at: string | null;
  user_name: string;
  user_status: string;
  user_deleted_at: string | null;
  role_name: string;
}

let mysqlApiTablesReady = false;

export async function ensureApiTablesReady(): Promise<void> {
  if (mysqlApiTablesReady || !process.env.DB_HOST?.trim()) {
    mysqlApiTablesReady = true;
    return;
  }
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS api_keys (
        id CHAR(36) NOT NULL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        description VARCHAR(500) NULL,
        key_prefix VARCHAR(32) NOT NULL,
        key_hash CHAR(64) NOT NULL UNIQUE,
        scopes_json TEXT NOT NULL,
        owner_user_id CHAR(36) NOT NULL,
        default_author_id CHAR(36) NULL,
        rate_limit_per_min INT NOT NULL DEFAULT 60,
        status ENUM('active','revoked') NOT NULL DEFAULT 'active',
        request_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        last_used_at DATETIME NULL,
        last_used_ip VARCHAR(64) NULL,
        expires_at DATETIME NULL,
        revoked_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await execute(
      `CREATE TABLE IF NOT EXISTS api_idempotency_keys (
        id CHAR(36) NOT NULL PRIMARY KEY,
        api_key_id CHAR(36) NOT NULL,
        idempotency_key VARCHAR(128) NOT NULL,
        method VARCHAR(16) NOT NULL,
        path VARCHAR(255) NOT NULL,
        request_hash CHAR(64) NOT NULL,
        status_code INT NOT NULL,
        response_json LONGTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        UNIQUE KEY uq_apikey_idempotency (api_key_id, idempotency_key)
      )`
    );
  } catch (err) {
    // SQLite or constrained MySQL user where schema was already migrated.
    console.warn("[api-keys] table check notice:", err instanceof Error ? err.message : String(err));
  }
  mysqlApiTablesReady = true;
}

export async function generateApiKeyToken(): Promise<{
  token: string;
  keyPrefix: string;
  keyHash: string;
}> {
  const secretHex = randomToken(24); // 48 hex chars = 192 bits entropy
  const token = `sci_live_${secretHex}`;
  const keyPrefix = token.slice(0, 17); // e.g. sci_live_a1b2c3d4
  const keyHash = await hashToken(token);
  return { token, keyPrefix, keyHash };
}

export function extractApiToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const match = /^Bearer\s+([^\s]+)$/i.exec(auth.trim());
    if (match?.[1]) return match[1].trim();
  }
  const xApiKey = req.headers.get("x-api-key")?.trim();
  if (xApiKey) return xApiKey;
  return null;
}

export function parseScopesJson(raw: string | null | undefined): ApiScope[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set<string>(API_SCOPES);
    return parsed.filter((item): item is ApiScope => typeof item === "string" && allowed.has(item));
  } catch {
    return [];
  }
}

export function hasScope(granted: readonly string[], required: ApiScope): boolean {
  if (granted.includes(required)) return true;
  if (required === "articles:read" && granted.includes("articles:write")) return true;
  if (required === "articles:read" && granted.includes("articles:publish")) return true;
  if (required === "media:read" && granted.includes("media:write")) return true;
  if (required === "taxonomy:read" && granted.includes("taxonomy:write")) return true;
  return false;
}

export function getPublicOrigin(req: Request): string {
  const fallback = (() => {
    try {
      return new URL(req.url).origin;
    } catch {
      return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    }
  })();

  const rawProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const rawHost =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.trim();

  if (!rawHost || !/^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(rawHost)) {
    return fallback;
  }

  const proto = rawProto === "https" || rawProto === "http" ? rawProto : fallback.startsWith("https:") ? "https" : "http";
  return `${proto}://${rawHost}`;
}

function resolveAllowedCorsOrigin(req?: Request): string | null {
  const origin = req?.headers.get("origin")?.trim();
  if (!origin) return null;
  const rawAllowlist = process.env.API_ALLOWED_ORIGINS?.trim();
  if (!rawAllowlist) return null;
  const allowed = rawAllowlist
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry && entry !== "*");
  return allowed.includes(origin) ? origin : null;
}

export function v1Headers(
  extra?: Record<string, string>,
  options?: { publicCors?: boolean; req?: Request }
): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key, Idempotency-Key, If-Match, Mcp-Session-Id",
    "Access-Control-Expose-Headers":
      "X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Idempotency-Replayed, ETag, Location",
    ...extra,
  });

  if (options?.publicCors) {
    headers.set("Access-Control-Allow-Origin", "*");
  } else {
    const matchedOrigin = resolveAllowedCorsOrigin(options?.req);
    if (matchedOrigin) {
      headers.set("Access-Control-Allow-Origin", matchedOrigin);
      headers.set("Vary", "Origin");
    }
  }
  return headers;
}

export function v1CorsPreflight(req?: Request, options?: { publicCors?: boolean }) {
  return new NextResponse(null, { status: 204, headers: v1Headers(undefined, { req, publicCors: options?.publicCors }) });
}

export async function readTextBodyWithLimit(
  req: Request,
  maxBytes = 1_048_576
): Promise<{ ok: true; text: string } | { ok: false; tooLarge: true }> {
  const declaredLen = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
    return { ok: false, tooLarge: true };
  }

  const reader = req.body?.getReader();
  if (!reader) {
    const text = await req.text().catch(() => "");
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      return { ok: false, tooLarge: true };
    }
    return { ok: true, text };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
  }
  return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
}

export function computeArticleEtag(articleId: string, updatedAt: string): string {
  const normalized = `${articleId}:${updatedAt}`;
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `W/"${(hash >>> 0).toString(16)}-${updatedAt.replace(/[^0-9]/g, "")}"`;
}

export function matchesIfMatchHeader(ifMatch: string | null, currentEtag: string): boolean {
  if (!ifMatch || !ifMatch.trim()) return true;
  const raw = ifMatch.trim();
  if (raw === "*") return true;
  const stripWeak = (v: string) => v.trim().replace(/^W\//i, "");
  const expected = stripWeak(currentEtag);
  return raw.split(",").some((candidate) => stripWeak(candidate) === expected);
}

export function v1Json(
  payload: unknown,
  options: { status?: number; requestId?: string; headers?: Record<string, string> } = {}
) {
  const requestId = options.requestId ?? uuid();
  const headers = v1Headers({
    "X-Request-Id": requestId,
    ...(options.headers ?? {}),
  });
  return NextResponse.json(
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...payload, requestId }
      : { data: payload, requestId },
    { status: options.status ?? 200, headers }
  );
}

export function v1Error(params: {
  status: number;
  code: string;
  message: string;
  hint?: string;
  details?: unknown;
  requestId?: string;
  headers?: Record<string, string>;
}) {
  const requestId = params.requestId ?? uuid();
  return NextResponse.json(
    {
      error: {
        code: params.code,
        message: params.message,
        ...(params.hint ? { hint: params.hint } : {}),
        ...(params.details !== undefined ? { details: params.details } : {}),
      },
      requestId,
    },
    {
      status: params.status,
      headers: v1Headers({
        "X-Request-Id": requestId,
        ...(params.headers ?? {}),
      }),
    }
  );
}

function formatRateHeaders(rl: RateLimitResult, limitPerMin: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limitPerMin),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
  };
}

export async function authenticateV1Request(
  req: Request,
  requiredScope?: ApiScope
): Promise<
  | { ok: true; key: AuthenticatedApiKey; requestId: string; ip: string; rateHeaders: Record<string, string> }
  | { ok: false; response: NextResponse }
> {
  const requestId = uuid();
  const ip = getClientIp(req);

  await ensureApiTablesReady();

  const authFailBucketKey = `apikey-authfail:${ip}`;
  const token = extractApiToken(req);
  if (!token || !token.startsWith("sci_live_") || token.length < 32) {
    const failLimit = rateLimit(authFailBucketKey, 30, 15 * 60_000);
    if (!failLimit.allowed) {
      return {
        ok: false,
        response: v1Error({
          status: 429,
          code: "too_many_auth_failures",
          message: "Too many failed API authentication attempts from this IP.",
          hint: `Wait ${failLimit.retryAfterSeconds} seconds and supply a valid Bearer sci_live_... token.`,
          requestId,
          headers: { "Retry-After": String(failLimit.retryAfterSeconds) },
        }),
      };
    }
    return {
      ok: false,
      response: v1Error({
        status: 401,
        code: "unauthorized",
        message: "Missing or malformed API key.",
        hint: "Provide your API key via 'Authorization: Bearer sci_live_...' or the 'X-API-Key' header.",
        requestId,
      }),
    };
  }

  const tokenHash = await hashToken(token);
  const row = await queryOne<ApiKeyDbRow>(
    `SELECT ak.id, ak.name, ak.key_prefix, ak.scopes_json, ak.owner_user_id,
            ak.default_author_id, ak.rate_limit_per_min, ak.status, ak.request_count, ak.expires_at,
            u.name AS user_name, u.status AS user_status, u.deleted_at AS user_deleted_at,
            r.name AS role_name
       FROM api_keys ak
       JOIN users u ON u.id = ak.owner_user_id
       JOIN roles r ON r.id = u.role_id
      WHERE ak.key_hash = ?
      LIMIT 1`,
    [tokenHash]
  );

  if (!row) {
    const failLimit = rateLimit(authFailBucketKey, 30, 15 * 60_000);
    await logActivity({
      userId: null,
      action: "api.auth.failed",
      entityType: "api_key",
      meta: { reason: "invalid_api_key", prefix: token.slice(0, 17) },
      ipAddress: ip,
    });
    if (!failLimit.allowed) {
      return {
        ok: false,
        response: v1Error({
          status: 429,
          code: "too_many_auth_failures",
          message: "Too many failed API authentication attempts from this IP.",
          requestId,
          headers: { "Retry-After": String(failLimit.retryAfterSeconds) },
        }),
      };
    }
    return {
      ok: false,
      response: v1Error({
        status: 401,
        code: "invalid_api_key",
        message: "The supplied API key does not exist.",
        hint: "Generate a valid key in /admin/api-keys and verify there are no extra spaces or truncated characters.",
        requestId,
      }),
    };
  }

  if (row.status !== "active") {
    rateLimit(authFailBucketKey, 30, 15 * 60_000);
    await logActivity({
      userId: row.owner_user_id,
      action: "api.auth.failed",
      entityType: "api_key",
      entityId: row.id,
      meta: { reason: "revoked_api_key", name: row.name, prefix: row.key_prefix },
      ipAddress: ip,
    });
    return {
      ok: false,
      response: v1Error({
        status: 401,
        code: "revoked_api_key",
        message: "This API key has been revoked.",
        hint: "Create or rotate a key in /admin/api-keys to obtain an active token.",
        requestId,
      }),
    };
  }

  if (row.user_deleted_at !== null || row.user_status !== "active") {
    return {
      ok: false,
      response: v1Error({
        status: 401,
        code: "owner_inactive",
        message: "The CMS user owning this API key is suspended or removed.",
        requestId,
      }),
    };
  }

  if (row.expires_at) {
    const expDate = parseSqlUtcDate(row.expires_at);
    if (expDate && expDate.getTime() < Date.now()) {
      await logActivity({
        userId: row.owner_user_id,
        action: "api.auth.failed",
        entityType: "api_key",
        entityId: row.id,
        meta: { reason: "expired_api_key", name: row.name, prefix: row.key_prefix },
        ipAddress: ip,
      });
      return {
        ok: false,
        response: v1Error({
          status: 401,
          code: "expired_api_key",
          message: "This API key has expired.",
          hint: "Generate a fresh API key in /admin/api-keys.",
          requestId,
        }),
      };
    }
  }

  const limitPerMin = Math.max(1, Number(row.rate_limit_per_min || 60));
  const rl = rateLimit(`apikey:${row.id}`, limitPerMin, 60_000);
  const rateHeaders = formatRateHeaders(rl, limitPerMin);

  if (!rl.allowed) {
    return {
      ok: false,
      response: v1Error({
        status: 429,
        code: "rate_limit_exceeded",
        message: `API key rate limit exceeded (${limitPerMin} requests/minute).`,
        hint: `Wait ${rl.retryAfterSeconds} seconds before retrying, or increase the key rate limit in /admin/api-keys.`,
        requestId,
        headers: {
          ...rateHeaders,
          "Retry-After": String(rl.retryAfterSeconds),
        },
      }),
    };
  }

  const scopes = parseScopesJson(row.scopes_json);
  if (requiredScope && !hasScope(scopes, requiredScope)) {
    return {
      ok: false,
      response: v1Error({
        status: 403,
        code: "insufficient_scope",
        message: `API key '${row.name}' lacks the required '${requiredScope}' scope.`,
        hint: `Grant '${requiredScope}' to this key in /admin/api-keys, or call an endpoint within your granted scopes (${scopes.join(", ") || "none"}).`,
        requestId,
        headers: rateHeaders,
      }),
    };
  }

  // Record usage stats cleanly without failing the API call if DB is busy
  try {
    await execute(
      `UPDATE api_keys SET request_count = request_count + 1, last_used_at = NOW(), last_used_ip = ? WHERE id = ?`,
      [ip, row.id]
    );
  } catch {
    // Non-fatal telemetry update
  }

  return {
    ok: true,
    requestId,
    ip,
    rateHeaders,
    key: {
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      scopes,
      ownerUserId: row.owner_user_id,
      ownerName: row.user_name,
      ownerRole: row.role_name,
      defaultAuthorId: row.default_author_id,
      rateLimitPerMin: limitPerMin,
      requestCount: Number(row.request_count ?? 0) + 1,
      expiresAt: row.expires_at,
    },
  };
}

export async function readIdempotencyRecord(
  apiKeyId: string,
  idempotencyKey: string,
  method: string,
  path: string,
  requestHash: string
): Promise<
  | { hit: false }
  | { hit: true; conflict: true }
  | { hit: true; conflict: false; statusCode: number; body: Record<string, unknown> }
> {
  const row = await queryOne<{
    method: string;
    path: string;
    request_hash: string;
    status_code: number;
    response_json: string;
    expires_at: string;
  }>(
    `SELECT method, path, request_hash, status_code, response_json, expires_at
       FROM api_idempotency_keys
      WHERE api_key_id = ? AND idempotency_key = ?
      LIMIT 1`,
    [apiKeyId, idempotencyKey]
  );

  if (!row) return { hit: false };

  const expDate = parseSqlUtcDate(row.expires_at);
  if (expDate && expDate.getTime() < Date.now()) {
    await execute(`DELETE FROM api_idempotency_keys WHERE api_key_id = ? AND idempotency_key = ?`, [
      apiKeyId,
      idempotencyKey,
    ]);
    return { hit: false };
  }

  if (row.method !== method || row.path !== path || row.request_hash !== requestHash) {
    return { hit: true, conflict: true };
  }

  try {
    return {
      hit: true,
      conflict: false,
      statusCode: Number(row.status_code),
      body: JSON.parse(row.response_json) as Record<string, unknown>,
    };
  } catch {
    return { hit: false };
  }
}

export async function writeIdempotencyRecord(params: {
  apiKeyId: string;
  idempotencyKey: string;
  method: string;
  path: string;
  requestHash: string;
  statusCode: number;
  body: Record<string, unknown>;
  ttlHours?: number;
}) {
  const expiresAt = new Date(Date.now() + (params.ttlHours ?? 24) * 3600 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  try {
    await execute(
      `INSERT IGNORE INTO api_idempotency_keys
         (id, api_key_id, idempotency_key, method, path, request_hash, status_code, response_json, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        params.apiKeyId,
        params.idempotencyKey.slice(0, 128),
        params.method,
        params.path,
        params.requestHash,
        params.statusCode,
        JSON.stringify(params.body),
        expiresAt,
      ]
    );
  } catch {
    // Non-fatal idempotency write
  }
}
