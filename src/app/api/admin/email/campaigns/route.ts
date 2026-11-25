import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { execute, query } from "@/lib/db";
import { requireAdminMutation, requireApiAuth, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import {
  emailCampaignCreateSchema,
  htmlToPlainText,
  parseRecipientList,
  sanitizeEmailHtml,
} from "@/lib/email-core";
import { ensureEmailSchema, resolveCampaignAudience } from "@/lib/email-service";

export async function GET() {
  const { response } = await requireApiAuth("email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const items = await query<{
    id: string;
    name: string;
    subject: string;
    preheader: string | null;
    template_id: string | null;
    audience_segment: string;
    custom_recipients_json: string | null;
    html_body: string;
    text_body: string | null;
    direction: string;
    status: string;
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    suppressed_count: number;
    sent_at: string | null;
    created_at: string;
    updated_at: string;
  }>(`SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT 60`);

  return NextResponse.json({
    items: items.map((c) => ({
      ...c,
      custom_recipients: c.custom_recipients_json
        ? (JSON.parse(c.custom_recipients_json) as string[])
        : [],
    })),
  });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const body = await req.json().catch(() => null);
  const parsed = emailCampaignCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid campaign payload", parsed.error.flatten());
  }

  let customRecipients: string[] = [];
  if (parsed.data.audienceSegment === "custom") {
    const p = parseRecipientList(parsed.data.customRecipients);
    if (p.invalid.length > 0) {
      return badRequest(`Invalid custom email(s): ${p.invalid.slice(0, 5).join(", ")}`);
    }
    if (p.valid.length === 0) {
      return badRequest("Provide at least one valid email for a custom campaign audience.");
    }
    customRecipients = p.valid;
  }

  const matchedAudience = await resolveCampaignAudience(
    parsed.data.audienceSegment,
    customRecipients.join(",")
  );

  const id = uuid();
  const cleanHtml = sanitizeEmailHtml(parsed.data.htmlBody);
  const cleanText = parsed.data.textBody?.trim() || htmlToPlainText(cleanHtml);

  await execute(
    `INSERT INTO email_campaigns
     (id, name, subject, preheader, template_id, audience_segment, custom_recipients_json, html_body, text_body, direction, status, total_recipients, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [
      id,
      parsed.data.name,
      parsed.data.subject,
      parsed.data.preheader || null,
      parsed.data.templateId ?? null,
      parsed.data.audienceSegment,
      customRecipients.length > 0 ? JSON.stringify(customRecipients) : null,
      cleanHtml,
      cleanText,
      parsed.data.direction,
      matchedAudience.length,
      session!.sub,
    ]
  );

  await logActivity({
    userId: session!.sub,
    action: "email.campaign.create",
    entityType: "email_campaign",
    entityId: id,
    meta: {
      name: parsed.data.name,
      segment: parsed.data.audienceSegment,
      matchedRecipients: matchedAudience.length,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ id, totalRecipients: matchedAudience.length }, { status: 201 });
}
