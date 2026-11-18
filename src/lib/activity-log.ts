import { v4 as uuid } from "uuid";
import { execute } from "./db";

export async function logActivity(params: {
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  try {
    await execute(
      `INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, meta_json, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuid(),
        params.userId,
        params.action,
        params.entityType ?? null,
        params.entityId ?? null,
        params.meta ? JSON.stringify(params.meta) : null,
        params.ipAddress ?? null,
      ]
    );
  } catch (err) {
    // Activity logging must never break the primary request.
    console.error("[activity-log] failed to write log entry:", err);
  }
}
