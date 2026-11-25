import { NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryOne } from "@/lib/db";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { API_SCOPES, ensureApiTablesReady, generateApiKeyToken } from "@/lib/ai-api-auth";
import { stripHtml } from "@/lib/sanitize";

const patchApiKeySchema = z.object({
  action: z.enum(["update", "revoke", "activate", "rotate"]).optional().default("update"),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  scopes: z.array(z.enum(API_SCOPES)).min(1).optional(),
  defaultAuthorId: z.string().uuid().nullable().optional(),
  rateLimitPerMin: z.number().int().min(5).max(600).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "api_keys.manage");
  if (response) return response;

  await ensureApiTablesReady();
  const { id } = await params;

  const existing = await queryOne<{
    id: string;
    name: string;
    description: string | null;
    key_prefix: string;
    scopes_json: string;
    default_author_id: string | null;
    rate_limit_per_min: number;
    status: string;
  }>(`SELECT * FROM api_keys WHERE id = ? LIMIT 1`, [id]);

  if (!existing) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid update payload", parsed.error.flatten());
  }

  const data = parsed.data;
  const ip = getClientIp(req);

  if (data.action === "revoke") {
    await execute(`UPDATE api_keys SET status = 'revoked', revoked_at = NOW() WHERE id = ?`, [id]);
    await logActivity({
      userId: session!.sub,
      action: "api_key.revoke",
      entityType: "api_key",
      entityId: id,
      meta: { name: existing.name, prefix: existing.key_prefix },
      ipAddress: ip,
    });
    return NextResponse.json({ ok: true, status: "revoked" });
  }

  if (data.action === "activate") {
    await execute(`UPDATE api_keys SET status = 'active', revoked_at = NULL WHERE id = ?`, [id]);
    await logActivity({
      userId: session!.sub,
      action: "api_key.activate",
      entityType: "api_key",
      entityId: id,
      meta: { name: existing.name, prefix: existing.key_prefix },
      ipAddress: ip,
    });
    return NextResponse.json({ ok: true, status: "active" });
  }

  if (data.action === "rotate") {
    const { token, keyPrefix, keyHash } = await generateApiKeyToken();
    await execute(
      `UPDATE api_keys SET key_prefix = ?, key_hash = ?, status = 'active', revoked_at = NULL WHERE id = ?`,
      [keyPrefix, keyHash, id]
    );
    await logActivity({
      userId: session!.sub,
      action: "api_key.rotate",
      entityType: "api_key",
      entityId: id,
      meta: { name: existing.name, newPrefix: keyPrefix },
      ipAddress: ip,
    });
    return NextResponse.json({
      ok: true,
      id,
      keyPrefix,
      plaintextToken: token,
    });
  }

  const nextName = data.name ? stripHtml(data.name).slice(0, 120) : existing.name;
  const nextDesc =
    data.description !== undefined ? stripHtml(data.description).slice(0, 500) || null : existing.description;
  const nextScopes = data.scopes ? JSON.stringify(Array.from(new Set(data.scopes))) : existing.scopes_json;
  const nextAuthor =
    data.defaultAuthorId !== undefined ? data.defaultAuthorId : existing.default_author_id;
  if (data.defaultAuthorId) {
    const author = await queryOne<{ id: string }>(
      `SELECT id FROM authors WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [data.defaultAuthorId]
    );
    if (!author) return badRequest("Selected default author does not exist.");
  }
  const nextRate = data.rateLimitPerMin ?? existing.rate_limit_per_min;

  await execute(
    `UPDATE api_keys SET name = ?, description = ?, scopes_json = ?, default_author_id = ?, rate_limit_per_min = ? WHERE id = ?`,
    [nextName, nextDesc, nextScopes, nextAuthor, nextRate, id]
  );

  await logActivity({
    userId: session!.sub,
    action: "api_key.update",
    entityType: "api_key",
    entityId: id,
    meta: { name: nextName },
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "api_keys.manage");
  if (response) return response;

  await ensureApiTablesReady();
  const { id } = await params;

  const existing = await queryOne<{ name: string; key_prefix: string }>(
    `SELECT name, key_prefix FROM api_keys WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!existing) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  await execute(`DELETE FROM api_keys WHERE id = ?`, [id]);
  await logActivity({
    userId: session!.sub,
    action: "api_key.delete",
    entityType: "api_key",
    entityId: id,
    meta: { name: existing.name, prefix: existing.key_prefix },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}
