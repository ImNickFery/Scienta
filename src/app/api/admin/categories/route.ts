import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { query, execute } from "@/lib/db";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { generateSlug, stripHtml } from "@/lib/sanitize";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  slug: z.string().max(160).optional(),
  nameFa: z.string().min(1).max(160),
  nameEn: z.string().min(1).max(160),
  descriptionFa: z.string().max(500).optional(),
  descriptionEn: z.string().max(500).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const { response } = await requireApiAuth("categories.view");
  if (response) return response;

  const rows = await query(
    `SELECT c.id, c.slug, c.name_fa, c.name_en, c.description_fa, c.description_en, c.parent_id,
            (SELECT COUNT(*) FROM articles a WHERE a.category_id = c.id AND a.deleted_at IS NULL) AS article_count
     FROM categories c WHERE c.deleted_at IS NULL ORDER BY c.name_en ASC`
  );
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "categories.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid category data", parsed.error.flatten());
  const d = parsed.data;

  const id = uuid();
  const slug = d.slug?.trim() || generateSlug(d.nameEn, "en");
  try {
    await execute(
      `INSERT INTO categories (id, slug, name_fa, name_en, description_fa, description_en, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, slug, stripHtml(d.nameFa), stripHtml(d.nameEn), d.descriptionFa ?? null, d.descriptionEn ?? null, d.parentId ?? null]
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Duplicate")) return badRequest("A category with that slug already exists");
    throw err;
  }

  await logActivity({ userId: session!.sub, action: "category.create", entityType: "category", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ id }, { status: 201 });
}
