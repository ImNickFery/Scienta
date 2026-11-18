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
  titleFa: z.string().max(200).optional(),
  titleEn: z.string().max(200).optional(),
  bioFa: z.string().max(2000).optional(),
  bioEn: z.string().max(2000).optional(),
  avatarUrl: z.string().max(500).optional(),
  social: z.record(z.string(), z.string()).optional(),
});

export async function GET() {
  const { response } = await requireApiAuth("authors.view");
  if (response) return response;

  const rows = await query(
    `SELECT a.id, a.slug, a.name_fa, a.name_en, a.title_fa, a.title_en, a.avatar_url,
            (SELECT COUNT(*) FROM articles ar WHERE ar.author_id = a.id AND ar.deleted_at IS NULL) AS article_count
     FROM authors a WHERE a.deleted_at IS NULL ORDER BY a.name_en ASC`
  );
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "authors.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid author data", parsed.error.flatten());
  const d = parsed.data;

  const id = uuid();
  const slug = d.slug?.trim() || generateSlug(d.nameEn, "en");
  try {
    await execute(
      `INSERT INTO authors (id, slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en, avatar_url, social_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, slug, stripHtml(d.nameFa), stripHtml(d.nameEn), d.titleFa ?? null, d.titleEn ?? null,
        d.bioFa ?? null, d.bioEn ?? null, d.avatarUrl ?? null, d.social ? JSON.stringify(d.social) : null,
      ]
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Duplicate")) return badRequest("An author with that slug already exists");
    throw err;
  }

  await logActivity({ userId: session!.sub, action: "author.create", entityType: "author", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ id }, { status: 201 });
}
