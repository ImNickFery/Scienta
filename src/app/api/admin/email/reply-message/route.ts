import { NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryOne } from "@/lib/db";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { escapeHtmlText } from "@/lib/email-core";
import { sendSingleEmail } from "@/lib/email-service";

const replySchema = z.object({
  messageId: z.string().uuid(),
  subject: z.string().trim().min(1).max(255),
  replyBody: z.string().trim().min(1).max(20000),
  direction: z.enum(["rtl", "ltr"]).default("rtl"),
});

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid reply payload", parsed.error.flatten());
  }

  const msg = await queryOne<{
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    status: string;
  }>(`SELECT id, name, email, subject, message, status FROM contact_messages WHERE id = ? LIMIT 1`, [
    parsed.data.messageId,
  ]);

  if (!msg) {
    return NextResponse.json({ error: "Contact message not found" }, { status: 404 });
  }

  const formattedReply = escapeHtmlText(parsed.data.replyBody).replace(/\n/g, "<br/>");
  const isRtl = parsed.data.direction === "rtl";
  const htmlBody = isRtl
    ? `<p style="margin:0 0 14px;color:#f8fafc;font-weight:600;">سلام ${escapeHtmlText(msg.name)} عزیز،</p>
<div style="margin:0 0 18px;color:#e2e8f0;line-height:1.85;">${formattedReply}</div>
<div style="padding:14px 16px;background-color:#1a2030;border:1px solid #2b344b;border-radius:8px;color:#94a3b8;font-size:13px;">
  <p style="margin:0 0 6px;font-weight:600;color:#cbd5e1;">پیام اصلی شما:</p>
  <p style="margin:0;">${escapeHtmlText(msg.message).replace(/\n/g, "<br/>")}</p>
</div>`
    : `<p style="margin:0 0 14px;color:#f8fafc;font-weight:600;">Hello ${escapeHtmlText(msg.name)},</p>
<div style="margin:0 0 18px;color:#e2e8f0;line-height:1.75;">${formattedReply}</div>
<div style="padding:14px 16px;background-color:#1a2030;border:1px solid #2b344b;border-radius:8px;color:#94a3b8;font-size:13px;">
  <p style="margin:0 0 6px;font-weight:600;color:#cbd5e1;">Your original message:</p>
  <p style="margin:0;">${escapeHtmlText(msg.message).replace(/\n/g, "<br/>")}</p>
</div>`;

  const result = await sendSingleEmail({
    to: msg.email,
    subject: parsed.data.subject,
    htmlBody,
    textBody: parsed.data.replyBody,
    direction: parsed.data.direction,
    kind: "reply",
    contactMessageId: msg.id,
    sentBy: session!.sub,
  });

  if (result.status === "sent" || result.status === "sandbox") {
    await execute(`UPDATE contact_messages SET status = 'read' WHERE id = ? AND status = 'new'`, [
      msg.id,
    ]);
  }

  await logActivity({
    userId: session!.sub,
    action: "email.contact.reply",
    entityType: "contact_message",
    entityId: msg.id,
    meta: { recipient: msg.email, status: result.status, logId: result.logId },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200 });
}
