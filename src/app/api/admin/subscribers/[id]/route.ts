import { NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryOne } from "@/lib/db";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

const patchSchema = z.object({
  status: z.enum(["subscribed", "unsubscribed"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "subscribers.manage");
  if (response) return response;

  const { id } = await params;
  const existing = await queryOne<{ id: string }>(`SELECT id FROM subscribers WHERE id = ?`, [id]);
  if (!existing) return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid status", parsed.error.flatten());

  await execute(`UPDATE subscribers SET status = ? WHERE id = ?`, [parsed.data.status, id]);
  await logActivity({
    userId: session!.sub,
    action: "subscriber.status_update",
    entityType: "subscriber",
    entityId: id,
    meta: { status: parsed.data.status },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true, status: parsed.data.status });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "subscribers.manage");
  if (response) return response;

  const { id } = await params;
  await execute(`DELETE FROM subscribers WHERE id = ?`, [id]);
  await logActivity({
    userId: session!.sub,
    action: "subscriber.delete",
    entityType: "subscriber",
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}
