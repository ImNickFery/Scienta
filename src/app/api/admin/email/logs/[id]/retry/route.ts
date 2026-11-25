import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAdminMutation } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { ensureEmailSchema, sendSingleEmail } from "@/lib/email-service";
import { extractEmailBodyFromLayout, type EmailLogKind } from "@/lib/email-core";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const { id } = await context.params;

  const log = await queryOne<{
    id: string;
    campaign_id: string | null;
    template_id: string | null;
    contact_message_id: string | null;
    kind: EmailLogKind;
    recipient_email: string;
    cc_json: string | null;
    bcc_json: string | null;
    reply_to: string | null;
    subject: string;
    html_body: string;
    text_body: string | null;
  }>(`SELECT * FROM email_logs WHERE id = ? LIMIT 1`, [id]);

  if (!log) {
    return NextResponse.json({ error: "Email log entry not found" }, { status: 404 });
  }

  const extracted = extractEmailBodyFromLayout(log.html_body);

  const res = await sendSingleEmail({
    to: log.recipient_email,
    cc: log.cc_json ? (JSON.parse(log.cc_json) as string[]) : undefined,
    bcc: log.bcc_json ? (JSON.parse(log.bcc_json) as string[]) : undefined,
    replyTo: log.reply_to ?? undefined,
    subject: log.subject,
    htmlBody: extracted.innerHtml,
    textBody: log.text_body ?? undefined,
    direction: extracted.direction,
    kind: log.kind,
    campaignId: log.campaign_id,
    templateId: log.template_id,
    contactMessageId: log.contact_message_id,
    sentBy: session!.sub,
  });

  await logActivity({
    userId: session!.sub,
    action: "email.log.retry",
    entityType: "email_log",
    entityId: res.logId,
    meta: { retriedFrom: log.id, recipient: log.recipient_email, status: res.status },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(res, { status: res.status === "failed" ? 502 : 200 });
}
