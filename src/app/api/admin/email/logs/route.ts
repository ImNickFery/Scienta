import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";
import { ensureEmailSchema } from "@/lib/email-service";

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function GET(req: Request) {
  const { response } = await requireApiAuth("email.manage");
  if (response) return response;

  await ensureEmailSchema();
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));
  const status = url.searchParams.get("status")?.trim() || "";
  const kind = url.searchParams.get("kind")?.trim() || "";
  const search = url.searchParams.get("search")?.trim() || "";
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: unknown[] = [];

  if (status && ["sent", "sandbox", "failed", "suppressed"].includes(status)) {
    where.push("status = ?");
    params.push(status);
  }
  if (kind && ["direct", "campaign", "test", "reply", "automation"].includes(kind)) {
    where.push("kind = ?");
    params.push(kind);
  }
  if (search) {
    const like = `%${escapeLike(search)}%`;
    where.push("(recipient_email LIKE ? ESCAPE '\\\\' OR subject LIKE ? ESCAPE '\\\\')");
    params.push(like, like);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const [items, totalRow] = await Promise.all([
    query<{
      id: string;
      campaign_id: string | null;
      template_id: string | null;
      contact_message_id: string | null;
      kind: string;
      recipient_email: string;
      cc_json: string | null;
      bcc_json: string | null;
      reply_to: string | null;
      from_email: string;
      from_name: string;
      subject: string;
      html_body: string;
      text_body: string | null;
      provider_mode: string;
      status: string;
      provider_message_id: string | null;
      error_message: string | null;
      created_at: string;
    }>(
      `SELECT * FROM email_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM email_logs ${whereSql}`,
      params
    ),
  ]);

  return NextResponse.json({
    items,
    page,
    pageSize,
    total: Number(totalRow?.count ?? 0),
  });
}
