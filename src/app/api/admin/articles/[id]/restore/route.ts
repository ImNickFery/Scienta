import { NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { requireAdminMutation } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "articles.manage");
  if (response) return response;

  const { id } = await params;
  await execute(`UPDATE articles SET deleted_at = NULL WHERE id = ?`, [id]);
  await logActivity({ userId: session!.sub, action: "article.restore", entityType: "article", entityId: id, ipAddress: getClientIp(req) });

  return NextResponse.json({ ok: true });
}
