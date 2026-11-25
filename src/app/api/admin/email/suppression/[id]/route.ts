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
  const existing = await queryOne<{ id: string; email: string }>(
    `SELECT id, email FROM email_suppressions WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!existing) {
    return NextResponse.json({ error: "Suppression entry not found" }, { status: 404 });
  }

  await execute(`DELETE FROM email_suppressions WHERE id = ?`, [id]);

  await logActivity({
    userId: session!.sub,
    action: "email.suppression.remove",
    entityType: "email_suppression",
    entityId: id,
    meta: { email: existing.email },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}
