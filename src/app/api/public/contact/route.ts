import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { execute } from "@/lib/db";
import { stripHtml } from "@/lib/sanitize";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { verifySameOrigin } from "@/lib/security";

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(190),
  subject: z.string().trim().max(255).optional(),
  message: z.string().trim().min(1).max(5000),
  // Honeypot field: real users never fill this in; bots usually do.
  website: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const limit = rateLimit(`contact:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many messages sent. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }
  const { name, email, subject, message } = parsed.data;

  await execute(
    `INSERT INTO contact_messages (id, name, email, subject, message, ip_address) VALUES (?, ?, ?, ?, ?, ?)`,
    [uuid(), stripHtml(name), email, subject ? stripHtml(subject) : null, stripHtml(message), ip]
  );

  await logActivity({ userId: null, action: "contact.submit", ipAddress: ip });

  return NextResponse.json({ ok: true });
}
