import { NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { requireAdminMutation } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "articles.manage");
  if (response) return response;

  const { id } = await params;
  // Cascades to article_translations, article_tags, article_revisions via FK ON DELETE CASCADE.
  await execute(`DELETE FROM articles WHERE id = ? AND deleted_at IS NOT NULL`, [id]);
  await logActivity({ userId: session!.sub, action: "article.purge", entityType: "article", entityId: id, ipAddress: getClientIp(req) });

  return NextResponse.json({ ok: true });
}
