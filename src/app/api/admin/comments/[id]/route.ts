import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { execute, query, queryOne } from "@/lib/db";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { sanitizeMathComment } from "@/lib/security";

const patchSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  adminReply: z.string().max(2500).nullable().optional(),
});

async function revalidateArticlePaths(articleId: string) {
  const translations = await query<{ locale: string; slug: string }>(
    `SELECT locale, slug FROM article_translations WHERE article_id = ?`,
    [articleId]
  );
  for (const tr of translations) {
    revalidatePath(`/${tr.locale}/articles/${tr.slug}`);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "comments.manage");
  if (response) return response;

  const { id } = await params;
  const existing = await queryOne<{ id: string; article_id: string; status: string }>(
    `SELECT id, article_id, status FROM comments WHERE id = ?`,
    [id]
  );
  if (!existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid moderation payload", parsed.error.flatten());
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (parsed.data.status !== undefined) {
    updates.push("status = ?");
    values.push(parsed.data.status);
  }
  if (parsed.data.adminReply !== undefined) {
    const cleaned = parsed.data.adminReply ? sanitizeMathComment(parsed.data.adminReply) : "";
    updates.push("admin_reply = ?");
    values.push(cleaned || null);
    updates.push("replied_at = ?");
    values.push(cleaned ? new Date().toISOString().slice(0, 19).replace("T", " ") : null);
  }

  if (updates.length === 0) {
    return badRequest("Nothing to update");
  }

  await execute(`UPDATE comments SET ${updates.join(", ")} WHERE id = ?`, [...values, id]);
  await revalidateArticlePaths(existing.article_id);

  await logActivity({
    userId: session!.sub,
    action: "comment.moderate",
    entityType: "comment",
    entityId: id,
    meta: {
      status: parsed.data.status ?? existing.status,
      hasReply: parsed.data.adminReply !== undefined ? Boolean(parsed.data.adminReply?.trim()) : undefined,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "comments.manage");
  if (response) return response;

  const { id } = await params;
  const existing = await queryOne<{ id: string; article_id: string }>(
    `SELECT id, article_id FROM comments WHERE id = ?`,
    [id]
  );
  if (!existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  await execute(`DELETE FROM comments WHERE id = ?`, [id]);
  await revalidateArticlePaths(existing.article_id);

  await logActivity({
    userId: session!.sub,
    action: "comment.delete",
    entityType: "comment",
    entityId: id,
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}
