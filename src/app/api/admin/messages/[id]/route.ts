import { NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryOne } from "@/lib/db";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

const patchSchema = z.object({
  status: z.enum(["new", "read", "archived"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "messages.manage");
  if (response) return response;

  const { id } = await params;
  const existing = await queryOne<{ id: string }>(`SELECT id FROM contact_messages WHERE id = ?`, [id]);
  if (!existing) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid status", parsed.error.flatten());

  await execute(`UPDATE contact_messages SET status = ? WHERE id = ?`, [parsed.data.status, id]);
  await logActivity({
    userId: session!.sub,
    action: "message.status_update",
    entityType: "contact_message",
    entityId: id,
    meta: { status: parsed.data.status },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true, status: parsed.data.status });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "messages.manage");
  if (response) return response;

  const { id } = await params;
  await execute(`DELETE FROM contact_messages WHERE id = ?`, [id]);
  await logActivity({
    userId: session!.sub,
    action: "message.delete",
    entityType: "contact_message",
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}
