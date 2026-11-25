import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { requireAdminMutation } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { ensureEmailSchema } from "@/lib/email-service";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const { id } = await context.params;
  const existing = await queryOne<{ id: string; name: string }>(
    `SELECT id, name FROM email_campaigns WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  await execute(`DELETE FROM email_campaigns WHERE id = ?`, [id]);

  await logActivity({
    userId: session!.sub,
    action: "email.campaign.delete",
    entityType: "email_campaign",
    entityId: id,
    meta: { name: existing.name },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}
