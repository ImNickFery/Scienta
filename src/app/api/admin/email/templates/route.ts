import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { execute, query } from "@/lib/db";
import { requireAdminMutation, requireApiAuth, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import {
  emailTemplateCreateSchema,
  extractTemplateVariables,
  htmlToPlainText,
  sanitizeEmailHtml,
} from "@/lib/email-core";
import { ensureEmailSchema } from "@/lib/email-service";

export async function GET() {
  const { response } = await requireApiAuth("email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const items = await query<{
    id: string;
    slug: string;
    name: string;
    category: string;
    locale: string;
    subject: string;
    preheader: string | null;
    html_body: string;
    text_body: string | null;
    variables_json: string | null;
    is_system: number;
    created_at: string;
    updated_at: string;
  }>(`SELECT * FROM email_templates ORDER BY is_system DESC, updated_at DESC`);

  return NextResponse.json({
    items: items.map((row) => ({
      ...row,
      is_system: Boolean(row.is_system),
      variables: row.variables_json ? (JSON.parse(row.variables_json) as string[]) : [],
    })),
  });
}

function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base ? `${base}-${uuid().slice(0, 6)}` : `template-${uuid().slice(0, 8)}`;
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const body = await req.json().catch(() => null);
  const parsed = emailTemplateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid email template payload", parsed.error.flatten());
  }

  const id = uuid();
  const slug = parsed.data.slug || makeSlug(parsed.data.name);
  const cleanHtml = sanitizeEmailHtml(parsed.data.htmlBody);
  const cleanText = parsed.data.textBody?.trim() || htmlToPlainText(cleanHtml);
  const variables = extractTemplateVariables(`${parsed.data.subject} ${cleanHtml} ${cleanText}`);

  try {
    await execute(
      `INSERT INTO email_templates
       (id, slug, name, category, locale, subject, preheader, html_body, text_body, variables_json, is_system, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        slug,
        parsed.data.name,
        parsed.data.category,
        parsed.data.locale,
        parsed.data.subject,
        parsed.data.preheader || null,
        cleanHtml,
        cleanText,
        JSON.stringify(variables),
        session!.sub,
      ]
    );
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Could not create email template");
  }

  await logActivity({
    userId: session!.sub,
    action: "email.template.create",
    entityType: "email_template",
    entityId: id,
    meta: { name: parsed.data.name, slug },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ id, slug, variables }, { status: 201 });
}
