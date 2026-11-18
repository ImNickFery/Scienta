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
});

export async function GET() {
  const { response } = await requireApiAuth("tags.manage");
  if (response) return response;

  const rows = await query(
    `SELECT t.id, t.slug, t.name_fa, t.name_en,
            (SELECT COUNT(*) FROM article_tags at WHERE at.tag_id = t.id) AS article_count
     FROM tags t ORDER BY t.name_en ASC`
  );
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "tags.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid tag data", parsed.error.flatten());
  const d = parsed.data;

  const id = uuid();
  const slug = d.slug?.trim() || generateSlug(d.nameEn, "en");
  try {
    await execute(`INSERT INTO tags (id, slug, name_fa, name_en) VALUES (?, ?, ?, ?)`, [id, slug, stripHtml(d.nameFa), stripHtml(d.nameEn)]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Duplicate")) return badRequest("A tag with that slug already exists");
    throw err;
  }

  await logActivity({ userId: session!.sub, action: "tag.create", entityType: "tag", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ id }, { status: 201 });
}
