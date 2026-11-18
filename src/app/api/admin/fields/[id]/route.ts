import { NextResponse } from "next/server";
import { z } from "zod";
import { execute } from "@/lib/db";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { stripHtml } from "@/lib/sanitize";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

const fieldSchema = z.object({
  nameFa: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  color: z.string().max(20),
  icon: z.string().max(60),
  sortOrder: z.number().int().optional().default(0),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "fields.manage");
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = fieldSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid field data", parsed.error.flatten());
  const d = parsed.data;

  await execute(
    `UPDATE fields SET name_fa=?, name_en=?, color=?, icon=?, sort_order=? WHERE id=?`,
    [stripHtml(d.nameFa), stripHtml(d.nameEn), d.color, d.icon, d.sortOrder, id]
  );
  await logActivity({ userId: session!.sub, action: "field.update", entityType: "field", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "fields.manage");
  if (response) return response;

  const { id } = await params;
  await execute(`UPDATE fields SET deleted_at = NOW() WHERE id = ?`, [id]);
  await logActivity({ userId: session!.sub, action: "field.delete", entityType: "field", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ ok: true });
}
