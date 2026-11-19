import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";

interface MessageRow {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: "new" | "read" | "archived";
  ip_address: string | null;
  created_at: string;
}

export async function GET(req: Request) {
  const { response } = await requireApiAuth("messages.manage");
  if (response) return response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));
  const status = url.searchParams.get("status");
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: unknown[] = [];

  if (status && ["new", "read", "archived"].includes(status)) {
    where.push("status = ?");
    params.push(status);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const items = await query<MessageRow>(
    `SELECT id, name, email, subject, message, status, ip_address, created_at
     FROM contact_messages ${whereSql}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM contact_messages ${whereSql}`,
    params
  );

  return NextResponse.json({
    items,
    page,
    pageSize,
    total: totalRow?.count ?? 0,
  });
}
