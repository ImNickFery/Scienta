import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { query, execute } from "@/lib/db";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { generateSlug, stripHtml } from "@/lib/sanitize";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

const fieldSchema = z.object({
  slug: z.string().max(100).optional(),
  nameFa: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  color: z.string().max(20).default("#7B3FFB"),
  icon: z.string().max(60).default("atom"),
  sortOrder: z.number().int().optional().default(0),
});

export async function GET() {
  const { response } = await requireApiAuth("fields.view");
  if (response) return response;

  const rows = await query(
    `SELECT f.id, f.slug, f.name_fa, f.name_en, f.color, f.icon, f.sort_order,
            (SELECT COUNT(*) FROM articles a WHERE a.field_id = f.id AND a.deleted_at IS NULL) AS article_count
     FROM fields f WHERE f.deleted_at IS NULL ORDER BY f.sort_order ASC`
  );
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "fields.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = fieldSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid field data", parsed.error.flatten());
  const data = parsed.data;

  const id = uuid();
  const slug = data.slug?.trim() || generateSlug(data.nameEn, "en");
  try {
    await execute(
      `INSERT INTO fields (id, slug, name_fa, name_en, color, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, slug, stripHtml(data.nameFa), stripHtml(data.nameEn), data.color, data.icon, data.sortOrder]
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Duplicate")) return badRequest("A field with that slug already exists");
    throw err;
  }

  await logActivity({ userId: session!.sub, action: "field.create", entityType: "field", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ id }, { status: 201 });
}
