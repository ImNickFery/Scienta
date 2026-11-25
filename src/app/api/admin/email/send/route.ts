import { NextResponse } from "next/server";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import {
  emailDirectSendSchema,
  isValidEmailAddress,
  parseRecipientList,
} from "@/lib/email-core";
import { getSuppressedEmailSet, sendSingleEmail } from "@/lib/email-service";

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = emailDirectSendSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Please check recipient emails, subject, and body.", parsed.error.flatten());
  }

  const toParsed = parseRecipientList(parsed.data.to);
  if (toParsed.invalid.length > 0) {
    return badRequest(`Invalid recipient email(s): ${toParsed.invalid.slice(0, 5).join(", ")}`);
  }
  if (toParsed.valid.length === 0) {
    return badRequest("At least one valid recipient email is required.");
  }
  if (toParsed.valid.length > 50) {
    return badRequest("Direct send supports up to 50 recipients at once. Use Campaigns for larger broadcasts.");
  }

  const ccParsed = parseRecipientList(parsed.data.cc);
  const bccParsed = parseRecipientList(parsed.data.bcc);
  if (ccParsed.invalid.length > 0 || bccParsed.invalid.length > 0) {
    return badRequest("One or more CC/BCC addresses are invalid.");
  }

  const replyTo = parsed.data.replyTo?.trim() || undefined;
  if (replyTo && !isValidEmailAddress(replyTo)) {
    return badRequest("Reply-To must be a valid email address.");
  }

  const suppressedSet = await getSuppressedEmailSet(toParsed.valid);
  const results = [];

  for (const recipient of toParsed.valid) {
    const res = await sendSingleEmail({
      to: recipient,
      cc: ccParsed.valid,
      bcc: bccParsed.valid,
      replyTo,
      subject: parsed.data.subject,
      preheader: parsed.data.preheader,
      htmlBody: parsed.data.htmlBody,
      textBody: parsed.data.textBody,
      direction: parsed.data.direction,
      kind: "direct",
      templateId: parsed.data.templateId ?? null,
      sentBy: session!.sub,
      variables: parsed.data.variables,
      suppressedSet,
    });
    results.push(res);
  }

  const sentCount = results.filter((r) => r.status === "sent" || r.status === "sandbox").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  const suppressedCount = results.filter((r) => r.status === "suppressed").length;

  await logActivity({
    userId: session!.sub,
    action: "email.direct.send",
    entityType: "email_log",
    entityId: results[0]?.logId ?? null,
    meta: {
      recipients: toParsed.valid.length,
      sentCount,
      failedCount,
      suppressedCount,
      subject: parsed.data.subject,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({
    ok: failedCount === 0,
    summary: {
      total: results.length,
      sentCount,
      failedCount,
      suppressedCount,
      providerMode: results[0]?.providerMode ?? "sandbox",
    },
    results,
  });
}
