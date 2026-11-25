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
  descriptionFa: z.string().max(500).optional(),
  descriptionEn: z.string().max(500).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "categories.manage");
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid category data", parsed.error.flatten());
  const d = parsed.data;
  if (d.parentId && d.parentId === id) {
    return badRequest("A category cannot be its own parent.");
  }

  await execute(
    `UPDATE categories SET name_fa=?, name_en=?, description_fa=?, description_en=?, parent_id=? WHERE id=?`,
    [stripHtml(d.nameFa), stripHtml(d.nameEn), d.descriptionFa ?? null, d.descriptionEn ?? null, d.parentId ?? null, id]
  );
  await logActivity({ userId: session!.sub, action: "category.update", entityType: "category", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "categories.manage");
  if (response) return response;

  const { id } = await params;
  await execute(`UPDATE categories SET deleted_at = NOW() WHERE id = ?`, [id]);
  await logActivity({ userId: session!.sub, action: "category.delete", entityType: "category", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ ok: true });
}
