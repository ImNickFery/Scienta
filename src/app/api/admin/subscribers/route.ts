import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";

interface SubscriberRow {
  id: string;
  email: string;
  locale: "fa" | "en";
  status: "subscribed" | "unsubscribed";
  created_at: string;
}

export async function GET(req: Request) {
  const { response } = await requireApiAuth("subscribers.manage");
  if (response) return response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 30)));
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim();
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: unknown[] = [];

  if (status && ["subscribed", "unsubscribed"].includes(status)) {
    where.push("status = ?");
    params.push(status);
  }
  if (search) {
    where.push("email LIKE ?");
    params.push(`%${search}%`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const items = await query<SubscriberRow>(
    `SELECT id, email, locale, status, created_at
     FROM subscribers ${whereSql}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM subscribers ${whereSql}`,
    params
  );

  return NextResponse.json({
    items,
    page,
    pageSize,
    total: totalRow?.count ?? 0,
  });
}
