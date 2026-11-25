import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { execute } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { verifySameOrigin } from "@/lib/security";
import { triggerAutomationEmail } from "@/lib/email-service";

const schema = z.object({
  email: z.string().trim().email().max(190),
  locale: z.enum(["fa", "en"]).default("fa"),
});

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const limit = rateLimit(`subscribe:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const { locale } = parsed.data;

  await execute(
    `INSERT INTO subscribers (id, email, locale, status) VALUES (?, ?, ?, 'subscribed')
     ON DUPLICATE KEY UPDATE status = 'subscribed'`,
    [uuid(), email, locale]
  );

  await logActivity({ userId: null, action: "subscriber.subscribe", ipAddress: ip });
  void triggerAutomationEmail({ event: "welcome_subscriber", to: email, locale });

  return NextResponse.json({ ok: true });
}
