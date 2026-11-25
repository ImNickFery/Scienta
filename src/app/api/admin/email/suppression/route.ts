import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { execute, query } from "@/lib/db";
import { requireAdminMutation, requireApiAuth, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { emailSuppressionCreateSchema } from "@/lib/email-core";
import { ensureEmailSchema } from "@/lib/email-service";

export async function GET() {
  const { response } = await requireApiAuth("email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const items = await query<{
    id: string;
    email: string;
    reason: string;
    note: string | null;
    created_at: string;
  }>(`SELECT id, email, reason, note, created_at FROM email_suppressions ORDER BY created_at DESC LIMIT 200`);

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const body = await req.json().catch(() => null);
  const parsed = emailSuppressionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Please enter a valid email address.", parsed.error.flatten());
  }

  const email = parsed.data.email.toLowerCase();
  const id = uuid();

  try {
    await execute(
      `INSERT INTO email_suppressions (id, email, reason, note, created_by) VALUES (?, ?, ?, ?, ?)`,
      [id, email, parsed.data.reason, parsed.data.note || null, session!.sub]
    );
  } catch {
    return badRequest("This email address is already on the suppression list.");
  }

  await logActivity({
    userId: session!.sub,
    action: "email.suppression.add",
    entityType: "email_suppression",
    entityId: id,
    meta: { email, reason: parsed.data.reason },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ id, email }, { status: 201 });
}
