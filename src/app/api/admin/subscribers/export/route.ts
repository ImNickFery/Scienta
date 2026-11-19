import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireApiAuth } from "@/lib/session";
import { buildSubscribersCsv, type SubscriberCsvRow } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const { response } = await requireApiAuth("subscribers.manage");
  if (response) return response;

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "";
  const search = (sp.get("search") ?? "").trim();

  const where: string[] = [];
  const params: unknown[] = [];

  if (status === "subscribed" || status === "unsubscribed") {
    where.push("status = ?");
    params.push(status);
  }
  if (search) {
    where.push("email LIKE ?");
    params.push(`%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query<SubscriberCsvRow>(
    `SELECT email, locale, status, created_at FROM subscribers ${whereSql} ORDER BY created_at DESC`,
    params
  );

  const csv = buildSubscribersCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scienta-subscribers-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
