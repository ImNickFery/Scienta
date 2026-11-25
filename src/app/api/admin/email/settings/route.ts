import { NextResponse } from "next/server";
import { requireAdminMutation, requireApiAuth, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { emailSettingsUpdateSchema } from "@/lib/email-core";
import {
  getResolvedEmailSettings,
  saveEmailSettings,
  toPublicEmailSettings,
} from "@/lib/email-service";

export async function GET() {
  const { response } = await requireApiAuth("email.manage");
  if (response) return response;

  const resolved = await getResolvedEmailSettings();
  return NextResponse.json({ settings: toPublicEmailSettings(resolved) });
}

export async function PUT(req: Request) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = emailSettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid email settings payload", parsed.error.flatten());
  }

  try {
    const saved = await saveEmailSettings(parsed.data);

    await logActivity({
      userId: session!.sub,
      action: "email.settings.update",
      entityType: "settings",
      entityId: "email_settings",
      meta: {
        mode: saved.mode,
        smtpHost: saved.smtpHost,
        smtpPort: saved.smtpPort,
        fromEmail: saved.fromEmail,
        autoWelcomeSubscriber: saved.autoWelcomeSubscriber,
        autoReplyContact: saved.autoReplyContact,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ settings: saved });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Failed to save email settings");
  }
}
