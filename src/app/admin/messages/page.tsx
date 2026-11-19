"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, CheckCircle2, Archive, Trash2, MailOpen } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: "new" | "read" | "archived";
  ip_address: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<ContactMessage["status"], string> = {
  new: "bg-(--color-accent-orange)/20 text-(--color-accent-orange)",
  read: "bg-(--color-accent-purple)/20 text-(--color-accent-purple)",
  archived: "bg-white/10 text-(--color-text-tertiary)",
};

export default function MessagesAdminPage() {
  const [items, setItems] = useState<ContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await adminFetch<{ items: ContactMessage[]; total: number }>(
        `/api/admin/messages?${params}`
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount/filter change
    load();
  }, [load]);

  const selected = items.find((m) => m.id === selectedId) ?? items[0] ?? null;

  async function updateStatus(id: string, status: ContactMessage["status"]) {
    setError(null);
    try {
      await adminFetch(`/api/admin/messages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function deleteMessage(id: string) {
    setError(null);
    try {
      await adminFetch(`/api/admin/messages/${id}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete message");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            Contact Messages
          </h1>
          <p className="text-sm text-(--color-text-tertiary)">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          {(["", "new", "read", "archived"] as const).map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-(--color-accent-purple) text-white"
                  : "border border-(--color-border-subtle) text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-4 py-2 text-sm text-(--color-accent-red)">
          {error}
        </p>
      )}

      {loading ? (
        <div className="card-elevated h-64 animate-pulse rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="card-elevated flex flex-col items-center gap-2 rounded-2xl py-16 text-(--color-text-tertiary)">
          <Inbox className="h-8 w-8" />
          <p className="text-sm">No contact messages found.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="card-elevated divide-y divide-(--color-border-subtle) overflow-hidden rounded-2xl">
            {items.map((m) => {
              const active = selected?.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`flex w-full flex-col gap-1.5 p-4 text-start transition-colors ${
                    active ? "bg-(--color-accent-purple)/10" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-(--color-text-primary)">
                      {m.name}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] capitalize ${STATUS_BADGE[m.status]}`}>
                      {m.status}
                    </span>
                  </div>
                  <p className="truncate text-xs text-(--color-text-secondary)">
                    {m.subject || "(no subject)"}
                  </p>
                  <p className="text-[11px] text-(--color-text-tertiary)">
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="card-elevated flex flex-col justify-between gap-6 rounded-2xl p-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-(--color-border-subtle) pb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-(--color-text-primary)">
                      {selected.subject || "(no subject)"}
                    </h2>
                    <p className="mt-1 text-xs text-(--color-text-secondary)">
                      From <span className="font-medium text-(--color-text-primary)">{selected.name}</span>{" "}
                      &lt;{selected.email}&gt;
                    </p>
                    <p className="mt-0.5 text-[11px] text-(--color-text-tertiary)">
                      {new Date(selected.created_at).toLocaleString()}
                      {selected.ip_address ? ` · IP: ${selected.ip_address}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs capitalize ${STATUS_BADGE[selected.status]}`}>
                    {selected.status}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-(--color-text-secondary)">
                  {selected.message}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-(--color-border-subtle) pt-4">
                {selected.status !== "read" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, "read")}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-(--color-accent-purple) px-4 text-xs font-medium text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Read
                  </button>
                )}
                {selected.status !== "new" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, "new")}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
                  >
                    <MailOpen className="h-3.5 w-3.5" /> Mark as New
                  </button>
                )}
                {selected.status !== "archived" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, "archived")}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
                  >
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </button>
                )}
                {confirmDeleteId === selected.id ? (
                  <div className="ms-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => deleteMessage(selected.id)}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-(--color-accent-red) px-4 text-xs font-medium text-white"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex h-9 items-center rounded-full border border-(--color-border-subtle) px-3 text-xs text-(--color-text-tertiary)"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(selected.id)}
                    className="ms-auto flex h-9 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs text-(--color-accent-red) hover:border-(--color-accent-red)/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
