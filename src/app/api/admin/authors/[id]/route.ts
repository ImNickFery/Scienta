import { NextResponse } from "next/server";
import { z } from "zod";
import { execute } from "@/lib/db";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { stripHtml } from "@/lib/sanitize";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  nameFa: z.string().min(1).max(160),
  nameEn: z.string().min(1).max(160),
  titleFa: z.string().max(200).optional(),
  titleEn: z.string().max(200).optional(),
  bioFa: z.string().max(2000).optional(),
  bioEn: z.string().max(2000).optional(),
  avatarUrl: z.string().max(500).optional(),
  social: z.record(z.string(), z.string()).optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "authors.manage");
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid author data", parsed.error.flatten());
  const d = parsed.data;

  await execute(
    `UPDATE authors SET name_fa=?, name_en=?, title_fa=?, title_en=?, bio_fa=?, bio_en=?, avatar_url=?, social_json=? WHERE id=?`,
    [
      stripHtml(d.nameFa), stripHtml(d.nameEn), d.titleFa ?? null, d.titleEn ?? null,
      d.bioFa ?? null, d.bioEn ?? null, d.avatarUrl ?? null, d.social ? JSON.stringify(d.social) : null, id,
    ]
  );
  await logActivity({ userId: session!.sub, action: "author.update", entityType: "author", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "authors.manage");
  if (response) return response;

  const { id } = await params;
  await execute(`UPDATE authors SET deleted_at = NOW() WHERE id = ?`, [id]);
  await logActivity({ userId: session!.sub, action: "author.delete", entityType: "author", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ ok: true });
}
