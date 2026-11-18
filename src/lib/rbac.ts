export type RoleName = "super_admin" | "admin" | "editor";

export const ROLES: RoleName[] = ["super_admin", "admin", "editor"];

/**
 * Permission matrix. This mirrors what's seeded into the `permissions` /
 * `role_permissions` tables (see scripts/seed.ts) — the DB rows are the
 * source of truth for the admin UI, this constant is a fast, dependency-free
 * mirror used for in-process authorization so we don't hit the DB on every
 * request.
 */
const PERMISSIONS: Record<RoleName, string[]> = {
  super_admin: ["*"], // wildcard: everything
  admin: [
    "articles.manage",
    "categories.manage",
    "fields.manage",
    "tags.manage",
    "authors.manage",
    "media.manage",
    "settings.manage",
    "menus.manage",
    "pages.manage",
    "subscribers.manage",
    "messages.manage",
    "logs.view",
    "users.view",
    "dashboard.view",
    "search.use",
    "backup.manage",
    "cache.manage",
  ],
  editor: [
    "articles.manage",
    "categories.view",
    "fields.view",
    "tags.manage",
    "authors.view",
    "media.manage",
    "dashboard.view",
    "search.use",
  ],
};

export function can(role: string, permission: string): boolean {
  const perms = PERMISSIONS[role as RoleName];
  if (!perms) return false;
  return perms.includes("*") || perms.includes(permission);
}

export function requireRole(role: string, allowed: RoleName[]): boolean {
  return allowed.includes(role as RoleName);
}
