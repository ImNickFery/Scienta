import { NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { requireAdminMutation } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "media.manage");
  if (response) return response;

  const { id } = await params;
  await execute(`UPDATE media SET deleted_at = NOW() WHERE id = ?`, [id]);
  await logActivity({ userId: session!.sub, action: "media.delete", entityType: "media", entityId: id, ipAddress: getClientIp(req) });
  return NextResponse.json({ ok: true });
}
