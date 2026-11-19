import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { execute, query, queryOne } from "@/lib/db";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { stripHtml } from "@/lib/sanitize";

interface UserListRow {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  last_login_at: string | null;
  created_at: string;
  role_id: string;
  role_name: "super_admin" | "admin" | "editor";
  role_label: string;
}

interface RoleRow {
  id: string;
  name: "super_admin" | "admin" | "editor";
  label: string;
  description: string | null;
}

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190),
  password: z.string().min(8).max(128),
  role: z.enum(["super_admin", "admin", "editor"]),
});

export async function GET() {
  const { response } = await requireApiAuth("users.view");
  if (response) return response;

  const [users, roles] = await Promise.all([
    query<UserListRow>(
      `SELECT u.id, u.name, u.email, u.status, u.last_login_at, u.created_at,
              r.id AS role_id, r.name AS role_name, r.label AS role_label
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.deleted_at IS NULL
       ORDER BY u.created_at ASC`
    ),
    query<RoleRow>(`SELECT id, name, label, description FROM roles ORDER BY created_at ASC`),
  ]);

  return NextResponse.json({ items: users, roles });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "users.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid user data", parsed.error.flatten());

  const { name, password, role } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const existing = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const roleRow = await queryOne<{ id: string }>(`SELECT id FROM roles WHERE name = ?`, [role]);
  if (!roleRow) {
    return badRequest("Selected role does not exist.");
  }

  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 12);

  await execute(
    `INSERT INTO users (id, name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, ?, 'active')`,
    [id, stripHtml(name), email, passwordHash, roleRow.id]
  );

  await logActivity({
    userId: session!.sub,
    action: "user.create",
    entityType: "user",
    entityId: id,
    meta: { email, role },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ id }, { status: 201 });
}
