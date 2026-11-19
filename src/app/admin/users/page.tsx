"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Shield, Trash2, Pencil, Save, X, CheckCircle2, Ban } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { can, type RoleName } from "@/lib/rbac";

interface UserRow {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  last_login_at: string | null;
  created_at: string;
  role_id: string;
  role_name: RoleName;
  role_label: string;
}

interface RoleRow {
  id: string;
  name: RoleName;
  label: string;
  description: string | null;
}

const ROLE_STYLES: Record<RoleName, string> = {
  super_admin: "bg-(--color-accent-purple)/20 text-(--color-accent-purple)",
  admin: "bg-(--color-accent-orange)/20 text-(--color-accent-orange)",
  editor: "bg-white/10 text-(--color-text-secondary)",
};

const emptyCreateForm = {
  name: "",
  email: "",
  password: "",
  role: "editor" as RoleName,
};

export default function UsersAdminPage() {
  const { user: currentUser } = useAdminAuth();
  const canManage = Boolean(currentUser && can(currentUser.role, "users.manage"));

  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    role: RoleName;
    status: "active" | "suspended";
    password: string;
  }>({ name: "", role: "editor", status: "active", password: "" });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<{ items: UserRow[]; roles: RoleRow[] }>("/api/admin/users");
      setUsers(data.items);
      setRoles(data.roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await adminFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      setCreateForm(emptyCreateForm);
      setShowCreate(false);
      setNotice("User account created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setEditForm({ name: u.name, role: u.role_name, status: u.status, password: "" });
    setConfirmDeleteId(null);
    setError(null);
    setNotice(null);
  }

  async function handleSaveEdit(id: string) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const payload: Record<string, string> = {
        name: editForm.name,
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      await adminFetch(`/api/admin/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setEditingId(null);
      setNotice("User updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await adminFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      setNotice("User removed and active sessions revoked.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            Users &amp; Roles
          </h1>
          <p className="text-sm text-(--color-text-tertiary)">
            Manage CMS team accounts, RBAC roles, and session access
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowCreate((v) => !v);
              setError(null);
            }}
            className="flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> New User
          </button>
        )}
      </div>

      {!canManage && !loading && (
        <div className="rounded-xl border border-(--color-border-subtle) bg-white/[0.02] px-4 py-3 text-xs text-(--color-text-tertiary)">
          Read-only view — only <span className="font-semibold text-(--color-text-primary)">Super Admin</span> accounts can create, modify, or suspend team users.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-4 py-2.5 text-sm text-(--color-accent-red)">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {showCreate && canManage && (
        <div className="card-elevated space-y-4 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">Create Team Account</h2>
            <button type="button" onClick={() => setShowCreate(false)} className="text-(--color-text-tertiary) hover:text-(--color-text-primary)">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Full Name</label>
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Dr. Sara Ahmadi"
                className="admin-input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Email</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="editor@scienta.ir"
                className="admin-input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Initial Password (min 8 chars)</label>
              <input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="••••••••••••"
                className="admin-input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Role</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as RoleName })}
                className="admin-input"
              >
                {(roles.length ? roles : [
                  { id: "1", name: "super_admin" as RoleName, label: "Super Admin", description: null },
                  { id: "2", name: "admin" as RoleName, label: "Admin", description: null },
                  { id: "3", name: "editor" as RoleName, label: "Editor", description: null },
                ]).map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={handleCreate}
              className="flex items-center gap-1.5 rounded-full bg-(--color-accent-purple) px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Create Account
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="flex items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 py-2 text-xs text-(--color-text-secondary)"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border-subtle) text-xs text-(--color-text-tertiary)">
                <th className="px-5 py-3 text-start font-medium">User</th>
                <th className="px-5 py-3 text-start font-medium">Role</th>
                <th className="px-5 py-3 text-start font-medium">Status</th>
                <th className="px-5 py-3 text-start font-medium">Last Login</th>
                <th className="px-5 py-3 text-end font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-(--color-text-tertiary)">
                    Loading…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-(--color-text-tertiary)">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isEditing = editingId === u.id;
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="border-b border-(--color-border-subtle) last:border-0">
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="admin-input h-8 text-xs"
                            />
                            <input
                              type="password"
                              value={editForm.password}
                              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                              placeholder="New password (optional)"
                              className="admin-input h-8 text-xs"
                            />
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-(--color-text-primary)">
                              {u.name}
                              {isSelf && (
                                <span className="ms-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-(--color-text-secondary)">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-(--color-text-tertiary)">{u.email}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as RoleName })}
                            className="admin-input h-8 text-xs"
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="admin">Admin</option>
                            <option value="editor">Editor</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[u.role_name]}`}>
                            <Shield className="h-3 w-3" />
                            {u.role_label || u.role_name}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <select
                            value={editForm.status}
                            onChange={(e) =>
                              setEditForm({ ...editForm, status: e.target.value as "active" | "suspended" })
                            }
                            className="admin-input h-8 text-xs"
                          >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        ) : u.status === "active" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-(--color-accent-red)/15 px-2.5 py-0.5 text-xs text-(--color-accent-red)">
                            <Ban className="h-3 w-3" /> Suspended
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-(--color-text-tertiary)">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        {canManage ? (
                          isEditing ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleSaveEdit(u.id)}
                                className="rounded-full bg-(--color-accent-purple) px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-full border border-(--color-border-subtle) px-3 py-1 text-xs text-(--color-text-secondary)"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : confirmDeleteId === u.id ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleDelete(u.id)}
                                className="rounded-full bg-(--color-accent-red) px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-full border border-(--color-border-subtle) px-3 py-1 text-xs text-(--color-text-secondary)"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(u)}
                                aria-label={`Edit ${u.name}`}
                                className="text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(u.id)}
                                  aria-label={`Delete ${u.name}`}
                                  className="text-(--color-text-tertiary) hover:text-(--color-accent-red)"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-(--color-text-tertiary)">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
