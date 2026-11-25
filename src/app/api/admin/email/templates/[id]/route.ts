import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import {
  emailTemplateCreateSchema,
  extractTemplateVariables,
  htmlToPlainText,
  sanitizeEmailHtml,
} from "@/lib/email-core";
import { ensureEmailSchema } from "@/lib/email-service";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const { id } = await context.params;
  const existing = await queryOne<{ id: string; slug: string }>(
    `SELECT id, slug FROM email_templates WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = emailTemplateCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid template update payload", parsed.error.flatten());
  }

  const current = await queryOne<{
    name: string;
    category: string;
    locale: string;
    subject: string;
    preheader: string | null;
    html_body: string;
    text_body: string | null;
  }>(`SELECT name, category, locale, subject, preheader, html_body, text_body FROM email_templates WHERE id = ?`, [
    id,
  ]);
  if (!current) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const nextName = parsed.data.name ?? current.name;
  const nextCategory = parsed.data.category ?? current.category;
  const nextLocale = parsed.data.locale ?? current.locale;
  const nextSubject = parsed.data.subject ?? current.subject;
  const nextPreheader = parsed.data.preheader !== undefined ? parsed.data.preheader : current.preheader ?? "";
  const nextHtml =
    parsed.data.htmlBody !== undefined ? sanitizeEmailHtml(parsed.data.htmlBody) : current.html_body;
  const nextText =
    parsed.data.textBody !== undefined
      ? parsed.data.textBody.trim() || htmlToPlainText(nextHtml)
      : current.text_body ?? htmlToPlainText(nextHtml);
  const variables = extractTemplateVariables(`${nextSubject} ${nextHtml} ${nextText}`);

  await execute(
    `UPDATE email_templates
     SET name = ?, category = ?, locale = ?, subject = ?, preheader = ?, html_body = ?, text_body = ?, variables_json = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      nextName,
      nextCategory,
      nextLocale,
      nextSubject,
      nextPreheader || null,
      nextHtml,
      nextText,
      JSON.stringify(variables),
      id,
    ]
  );

  await logActivity({
    userId: session!.sub,
    action: "email.template.update",
    entityType: "email_template",
    entityId: id,
    meta: { name: nextName },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true, id, variables });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { session, response } = await requireAdminMutation(req, "email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const { id } = await context.params;
  const existing = await queryOne<{ id: string; name: string; is_system: number }>(
    `SELECT id, name, is_system FROM email_templates WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (existing.is_system) {
    return badRequest("Built-in system templates cannot be deleted; you can customize them instead.");
  }

  await execute(`DELETE FROM email_templates WHERE id = ?`, [id]);

  await logActivity({
    userId: session!.sub,
    action: "email.template.delete",
    entityType: "email_template",
    entityId: id,
    meta: { name: existing.name },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}
