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
    "categories.view",
    "fields.manage",
    "fields.view",
    "tags.manage",
    "authors.manage",
    "authors.view",
    "media.manage",
    "settings.manage",
    "menus.manage",
    "pages.manage",
    "subscribers.manage",
    "messages.manage",
    "comments.manage",
    "logs.view",
    "users.view",
    "dashboard.view",
    "search.use",
    "backup.manage",
    "cache.manage",
    "api_keys.manage",
  ],
  editor: [
    "articles.manage",
    "categories.view",
    "fields.view",
    "tags.manage",
    "authors.view",
    "media.manage",
    "comments.manage",
    "dashboard.view",
    "search.use",
  ],
};

export function can(role: string, permission: string): boolean {
  const perms = PERMISSIONS[role as RoleName];
  if (!perms) return false;
  if (perms.includes("*") || perms.includes(permission)) return true;
  if (permission.endsWith(".view")) {
    const resource = permission.slice(0, -".view".length);
    return perms.includes(`${resource}.manage`);
  }
  return false;
}

export function requireRole(role: string, allowed: RoleName[]): boolean {
  return allowed.includes(role as RoleName);
}
