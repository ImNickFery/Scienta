import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { execute, query, queryOne } from "@/lib/db";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import {
  API_SCOPES,
  SCOPE_CATALOG,
  SCOPE_PRESETS,
  ensureApiTablesReady,
  generateApiKeyToken,
  parseScopesJson,
} from "@/lib/ai-api-auth";
import { stripHtml } from "@/lib/sanitize";

const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(""),
  scopes: z.array(z.enum(API_SCOPES)).min(1, "Select at least one permission scope"),
  defaultAuthorId: z.string().uuid().nullable().optional(),
  rateLimitPerMin: z.number().int().min(5).max(600).optional().default(60),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
});

interface ApiKeyListRow {
  id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  scopes_json: string;
  owner_user_id: string;
  owner_name: string | null;
  default_author_id: string | null;
  default_author_name: string | null;
  rate_limit_per_min: number;
  status: "active" | "revoked";
  request_count: number;
  last_used_at: string | null;
  last_used_ip: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export async function GET() {
  const { response } = await requireApiAuth("api_keys.manage");
  if (response) return response;

  await ensureApiTablesReady();

  const rows = await query<ApiKeyListRow>(
    `SELECT ak.id, ak.name, ak.description, ak.key_prefix, ak.scopes_json,
            ak.owner_user_id, u.name AS owner_name,
            ak.default_author_id, au.name_en AS default_author_name,
            ak.rate_limit_per_min, ak.status, ak.request_count,
            ak.last_used_at, ak.last_used_ip, ak.expires_at, ak.revoked_at, ak.created_at
       FROM api_keys ak
       LEFT JOIN users u ON u.id = ak.owner_user_id
       LEFT JOIN authors au ON au.id = ak.default_author_id
      ORDER BY ak.created_at DESC`
  );

  const authors = await query<{ id: string; slug: string; name_en: string; name_fa: string }>(
    `SELECT id, slug, name_en, name_fa FROM authors WHERE deleted_at IS NULL ORDER BY name_en ASC`
  );

  const items = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    keyPrefix: row.key_prefix,
    scopes: parseScopesJson(row.scopes_json),
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    defaultAuthorId: row.default_author_id,
    defaultAuthorName: row.default_author_name,
    rateLimitPerMin: Number(row.rate_limit_per_min),
    status: row.status,
    requestCount: Number(row.request_count ?? 0),
    lastUsedAt: row.last_used_at,
    lastUsedIp: row.last_used_ip,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));

  return NextResponse.json({
    items,
    authors,
    scopeCatalog: SCOPE_CATALOG,
    scopePresets: SCOPE_PRESETS,
  });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "api_keys.manage");
  if (response) return response;

  await ensureApiTablesReady();

  const body = await req.json().catch(() => null);
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid API key parameters", parsed.error.flatten());
  }

  const data = parsed.data;
  if (data.defaultAuthorId) {
    const author = await queryOne<{ id: string }>(
      `SELECT id FROM authors WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [data.defaultAuthorId]
    );
    if (!author) return badRequest("Selected default author does not exist.");
  }

  const { token, keyPrefix, keyHash } = await generateApiKeyToken();
  const id = uuid();
  const expiresAt = data.expiresInDays
    ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ")
    : null;

  const cleanName = stripHtml(data.name).slice(0, 120);
  const cleanDescription = stripHtml(data.description).slice(0, 500);
  const uniqueScopes = Array.from(new Set(data.scopes));

  await execute(
    `INSERT INTO api_keys
       (id, name, description, key_prefix, key_hash, scopes_json, owner_user_id, default_author_id, rate_limit_per_min, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      id,
      cleanName,
      cleanDescription || null,
      keyPrefix,
      keyHash,
      JSON.stringify(uniqueScopes),
      session!.sub,
      data.defaultAuthorId ?? null,
      data.rateLimitPerMin,
      expiresAt,
    ]
  );

  await logActivity({
    userId: session!.sub,
    action: "api_key.create",
    entityType: "api_key",
    entityId: id,
    meta: { name: cleanName, prefix: keyPrefix, scopes: uniqueScopes },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(
    {
      id,
      name: cleanName,
      keyPrefix,
      plaintextToken: token,
      scopes: uniqueScopes,
      rateLimitPerMin: data.rateLimitPerMin,
      expiresAt,
    },
    { status: 201 }
  );
}
