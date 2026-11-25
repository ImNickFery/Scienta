import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { sendSingleEmail, verifySmtpConnection } from "@/lib/email-service";

const testSchema = z.object({
  action: z.enum(["verify", "send_test"]).default("verify"),
  to: z.string().trim().email().max(190).optional(),
  locale: z.enum(["fa", "en"]).default("fa"),
});

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid test email request", parsed.error.flatten());
  }

  if (parsed.data.action === "verify") {
    const result = await verifySmtpConnection();
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }

  const recipient = parsed.data.to || session!.email;
  const isFa = parsed.data.locale === "fa";

  const result = await sendSingleEmail({
    to: recipient,
    subject: isFa ? "ایمیل آزمایشی مرکز ایمیل ساینتا" : "Scienta Email Center — Delivery Test",
    preheader: isFa
      ? "این ایمیل برای بررسی صحت تنظیمات ارسال ساینتا فرستاده شده است."
      : "This email verifies your Scienta outbound delivery configuration.",
    htmlBody: isFa
      ? `<h2 style="margin:0 0 12px;font-size:20px;color:#f8fafc;">تست ارسال ایمیل با موفقیت انجام شد</h2>
<p style="margin:0 0 12px;color:#cbd5e1;">این پیام آزمایشی توسط <strong>مرکز ایمیل ساینتا</strong> برای تأیید تنظیمات فرستنده و سرور ارسال شده است.</p>
<p style="margin:0;color:#94a3b8;font-size:13px;">گیرنده: {{recipient_email}} · تاریخ: {{date}}</p>`
      : `<h2 style="margin:0 0 12px;font-size:20px;color:#f8fafc;">Email Delivery Test Succeeded</h2>
<p style="margin:0 0 12px;color:#cbd5e1;">This test message was dispatched from <strong>Scienta Email Center</strong> to verify your sender identity and transport configuration.</p>
<p style="margin:0;color:#94a3b8;font-size:13px;">Recipient: {{recipient_email}} · Date: {{date}}</p>`,
    direction: isFa ? "rtl" : "ltr",
    kind: "test",
    sentBy: session!.sub,
    skipSuppressionCheck: true,
  });

  await logActivity({
    userId: session!.sub,
    action: "email.test.send",
    entityType: "email_log",
    entityId: result.logId,
    meta: { recipient, status: result.status, mode: result.providerMode },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200 });
}
