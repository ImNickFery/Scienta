import { z } from "zod";
import { v4 as uuid } from "uuid";
import { execute, queryOne } from "@/lib/db";
import { authenticateV1Request, v1CorsPreflight, v1Error, v1Json } from "@/lib/ai-api-auth";
import { generateSlug, stripHtml } from "@/lib/sanitize";
import { logActivity } from "@/lib/activity-log";

const createTagSchema = z.object({
  slug: z.string().trim().min(1).max(160).optional(),
  nameEn: z.string().trim().min(1).max(160),
  nameFa: z.string().trim().min(1).max(160),
});

export async function OPTIONS() {
  return v1CorsPreflight();
}

export async function POST(req: Request) {
  const auth = await authenticateV1Request(req, "taxonomy:write");
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    return v1Error({
      status: 400,
      code: "validation_error",
      message: "Invalid tag payload.",
      hint: "Provide `nameEn` and `nameFa` (and optional `slug`).",
      details: parsed.error.flatten(),
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const cleanEn = stripHtml(parsed.data.nameEn).slice(0, 160);
  const cleanFa = stripHtml(parsed.data.nameFa).slice(0, 160);
  const slug = parsed.data.slug ? generateSlug(parsed.data.slug, "en") : generateSlug(cleanEn, "en");
  if (!slug) {
    return v1Error({
      status: 400,
      code: "invalid_slug",
      message: "Unable to derive a valid ASCII tag slug.",
      hint: "Provide an explicit lowercase slug such as 'quantum-optics'.",
      requestId: auth.requestId,
      headers: auth.rateHeaders,
    });
  }

  const existing = await queryOne<{ id: string; slug: string; name_fa: string; name_en: string }>(
    `SELECT id, slug, name_fa, name_en FROM tags WHERE slug = ? LIMIT 1`,
    [slug]
  );
  if (existing) {
    return v1Json(
      { tag: existing, created: false },
      { status: 200, requestId: auth.requestId, headers: auth.rateHeaders }
    );
  }

  const id = uuid();
  await execute(`INSERT INTO tags (id, slug, name_fa, name_en) VALUES (?, ?, ?, ?)`, [
    id,
    slug,
    cleanFa,
    cleanEn,
  ]);

  await logActivity({
    userId: auth.key.ownerUserId,
    action: "api.tag.create",
    entityType: "tag",
    entityId: id,
    meta: { apiKeyId: auth.key.id, apiKeyName: auth.key.name, slug },
    ipAddress: auth.ip,
  });

  return v1Json(
    { tag: { id, slug, name_fa: cleanFa, name_en: cleanEn }, created: true },
    { status: 201, requestId: auth.requestId, headers: auth.rateHeaders }
  );
}
