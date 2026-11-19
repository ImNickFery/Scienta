"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Mail, Search, Trash2, UserCheck, UserX } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface SubscriberRow {
  id: string;
  email: string;
  locale: "fa" | "en";
  status: "subscribed" | "unsubscribed";
  created_at: string;
}

export default function SubscribersAdminPage() {
  const [items, setItems] = useState<SubscriberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: "50" });
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const data = await adminFetch<{ items: SubscriberRow[]; total: number }>(
        `/api/admin/subscribers?${params}`
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount/filter change
    load();
  }, [load]);

  async function toggleStatus(sub: SubscriberRow) {
    const next = sub.status === "subscribed" ? "unsubscribed" : "subscribed";
    try {
      await adminFetch(`/api/admin/subscribers/${sub.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subscriber");
    }
  }

  async function removeSubscriber(id: string) {
    try {
      await adminFetch(`/api/admin/subscribers/${id}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete subscriber");
    }
  }

  const exportHref = (() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    const qs = params.toString();
    return qs ? `/api/admin/subscribers/export?${qs}` : "/api/admin/subscribers/export";
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            Subscribers
          </h1>
          <p className="text-sm text-(--color-text-tertiary)">{total} newsletter subscribers</p>
        </div>
        <a
          href={exportHref}
          download
          className="flex h-10 items-center gap-2 rounded-full border border-(--color-border-strong) bg-white/[0.04] px-4 text-xs font-medium text-(--color-text-primary) transition-colors hover:border-(--color-accent-purple) hover:bg-(--color-accent-purple)/15"
        >
          <Download className="h-3.5 w-3.5 text-(--color-accent-purple)" />
          Export CSV
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-(--color-text-tertiary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            aria-label="Search subscribers"
            className="h-10 w-full rounded-full border border-(--color-border-subtle) bg-black/20 ps-9 pe-4 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="h-10 rounded-full border border-(--color-border-subtle) bg-black/20 px-4 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
        >
          <option value="">All statuses</option>
          <option value="subscribed">Subscribed</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
      </div>

      {error && (
        <p className="rounded-lg border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-4 py-2 text-sm text-(--color-accent-red)">
          {error}
        </p>
      )}

      <div className="card-elevated overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border-subtle) text-start text-xs text-(--color-text-tertiary)">
                <th className="px-5 py-3 text-start font-medium">Email</th>
                <th className="px-5 py-3 text-start font-medium">Locale</th>
                <th className="px-5 py-3 text-start font-medium">Status</th>
                <th className="px-5 py-3 text-start font-medium">Subscribed</th>
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
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-(--color-text-tertiary)">
                    <div className="flex flex-col items-center gap-2">
                      <Mail className="h-7 w-7 opacity-60" />
                      <span>No subscribers yet.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-(--color-border-subtle) last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3 font-medium text-(--color-text-primary)">{sub.email}</td>
                    <td className="px-5 py-3 uppercase text-(--color-text-tertiary)">{sub.locale}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs capitalize ${
                          sub.status === "subscribed"
                            ? "bg-(--color-accent-purple)/20 text-(--color-accent-purple)"
                            : "bg-white/10 text-(--color-text-tertiary)"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-(--color-text-tertiary)">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStatus(sub)}
                          aria-label={
                            sub.status === "subscribed"
                              ? `Unsubscribe ${sub.email}`
                              : `Resubscribe ${sub.email}`
                          }
                          className="flex h-8 items-center gap-1 rounded-full border border-(--color-border-subtle) px-3 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
                        >
                          {sub.status === "subscribed" ? (
                            <>
                              <UserX className="h-3.5 w-3.5" /> Unsubscribe
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" /> Resubscribe
                            </>
                          )}
                        </button>
                        {confirmDeleteId === sub.id ? (
                          <button
                            type="button"
                            onClick={() => removeSubscriber(sub.id)}
                            className="h-8 rounded-full bg-(--color-accent-red) px-3 text-xs font-medium text-white"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(sub.id)}
                            aria-label={`Delete ${sub.email}`}
                            className="p-1.5 text-(--color-text-tertiary) hover:text-(--color-accent-red)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
