import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { execute, queryOne } from "@/lib/db";
import { requireAdminMutation, badRequest } from "@/lib/session";
import { validateUserMutation } from "@/lib/admin-users";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { stripHtml } from "@/lib/sanitize";
import type { RoleName } from "@/lib/rbac";

interface TargetUserRow {
  id: string;
  email: string;
  status: "active" | "suspended";
  role_name: RoleName;
}

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["super_admin", "admin", "editor"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  password: z.string().min(8).max(128).optional(),
});

async function countActiveSuperAdmins(): Promise<number> {
  const row = await queryOne<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.deleted_at IS NULL AND u.status = 'active' AND r.name = 'super_admin'`
  );
  return Number(row?.c ?? 0);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "users.manage");
  if (response) return response;

  const { id } = await params;
  const target = await queryOne<TargetUserRow>(
    `SELECT u.id, u.email, u.status, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.deleted_at IS NULL`,
    [id]
  );
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid user update", parsed.error.flatten());
  const data = parsed.data;

  const activeSuperAdminCount = await countActiveSuperAdmins();
  const guard = validateUserMutation({
    actorId: session!.sub,
    actorRole: session!.role,
    targetId: target.id,
    targetCurrentRole: target.role_name,
    targetCurrentStatus: target.status,
    nextRole: data.role,
    nextStatus: data.status,
    activeSuperAdminCount,
  });

  if (!guard.allowed) {
    return badRequest(guard.reason ?? "Operation not allowed");
  }

  let nextRoleId: string | null = null;
  if (data.role) {
    const roleRow = await queryOne<{ id: string }>(`SELECT id FROM roles WHERE name = ?`, [data.role]);
    if (!roleRow) return badRequest("Selected role does not exist.");
    nextRoleId = roleRow.id;
  }

  const sets: string[] = [];
  const paramsList: unknown[] = [];

  if (data.name !== undefined) {
    sets.push("name = ?");
    paramsList.push(stripHtml(data.name));
  }
  if (nextRoleId) {
    sets.push("role_id = ?");
    paramsList.push(nextRoleId);
  }
  if (data.status !== undefined) {
    sets.push("status = ?");
    paramsList.push(data.status);
  }
  if (data.password) {
    sets.push("password_hash = ?");
    paramsList.push(await bcrypt.hash(data.password, 12));
  }

  if (sets.length > 0) {
    sets.push("updated_at = NOW()");
    await execute(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, [...paramsList, id]);
  }

  // Revoke active sessions immediately if the user was suspended or had password reset.
  if (data.status === "suspended" || data.password) {
    await execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`, [id]);
  }

  await logActivity({
    userId: session!.sub,
    action: "user.update",
    entityType: "user",
    entityId: id,
    meta: { role: data.role, status: data.status, passwordChanged: Boolean(data.password) },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdminMutation(req, "users.manage");
  if (response) return response;

  const { id } = await params;
  const target = await queryOne<TargetUserRow>(
    `SELECT u.id, u.email, u.status, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.deleted_at IS NULL`,
    [id]
  );
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const activeSuperAdminCount = await countActiveSuperAdmins();
  const guard = validateUserMutation({
    actorId: session!.sub,
    actorRole: session!.role,
    targetId: target.id,
    targetCurrentRole: target.role_name,
    targetCurrentStatus: target.status,
    deleting: true,
    activeSuperAdminCount,
  });

  if (!guard.allowed) {
    return badRequest(guard.reason ?? "Operation not allowed");
  }

  await execute(`UPDATE users SET deleted_at = NOW(), status = 'suspended', updated_at = NOW() WHERE id = ?`, [id]);
  await execute(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`, [id]);

  await logActivity({
    userId: session!.sub,
    action: "user.delete",
    entityType: "user",
    entityId: id,
    meta: { email: target.email },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ ok: true });
}
