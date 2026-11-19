import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";

interface LogRow {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta_json: string | null;
  ip_address: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}

export async function GET(req: Request) {
  const { response } = await requireApiAuth("logs.view");
  if (response) return response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 40)));
  const action = url.searchParams.get("action")?.trim();
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: unknown[] = [];

  if (action) {
    where.push("al.action LIKE ?");
    params.push(`${action}%`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const items = await query<LogRow>(
    `SELECT al.id, al.action, al.entity_type, al.entity_id, al.meta_json, al.ip_address, al.created_at,
            u.name AS user_name, u.email AS user_email
     FROM activity_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereSql}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM activity_logs al ${whereSql}`,
    params
  );

  return NextResponse.json({
    items,
    page,
    pageSize,
    total: totalRow?.count ?? 0,
  });
}
