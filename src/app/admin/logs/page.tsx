"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ShieldAlert } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface ActivityLogRow {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta_json: string | null;
  ip_address: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}

const ACTION_FILTERS = [
  { value: "", label: "All Events" },
  { value: "api.", label: "AI API Calls" },
  { value: "api_key.", label: "API Keys" },
  { value: "auth.", label: "Authentication" },
  { value: "article.", label: "Articles" },
  { value: "media.", label: "Media" },
  { value: "contact.", label: "Contact" },
  { value: "subscriber.", label: "Subscribers" },
];

export default function ActivityLogsAdminPage() {
  const [items, setItems] = useState<ActivityLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: "60" });
      if (actionFilter) params.set("action", actionFilter);
      const data = await adminFetch<{ items: ActivityLogRow[]; total: number }>(
        `/api/admin/logs?${params}`
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount/filter change
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            Activity Logs
          </h1>
          <p className="text-sm text-(--color-text-tertiary)">
            {total} recorded security and editorial audit events
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              onClick={() => setActionFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                actionFilter === f.value
                  ? "bg-(--color-accent-purple) text-white"
                  : "border border-(--color-border-subtle) text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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
                <th className="px-5 py-3 text-start font-medium">Action</th>
                <th className="px-5 py-3 text-start font-medium">Actor</th>
                <th className="px-5 py-3 text-start font-medium">Entity</th>
                <th className="px-5 py-3 text-start font-medium">IP</th>
                <th className="px-5 py-3 text-start font-medium">Timestamp</th>
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
                      <Activity className="h-7 w-7 opacity-60" />
                      <span>No activity logs found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((log) => {
                  const isAlert =
                    log.action.includes("failed") || log.action.includes("reuse_detected");
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-(--color-border-subtle) last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs ${
                            isAlert
                              ? "bg-(--color-accent-red)/15 text-(--color-accent-red)"
                              : "bg-white/5 text-(--color-text-primary)"
                          }`}
                        >
                          {isAlert && <ShieldAlert className="h-3 w-3" />}
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-(--color-text-secondary)">
                        {log.user_name ?? "Public / System"}
                      </td>
                      <td className="px-5 py-3 text-xs text-(--color-text-tertiary)">
                        {log.entity_type ? `${log.entity_type}` : "—"}
                      </td>
                      <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-tertiary)">
                        {log.ip_address ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-xs text-(--color-text-tertiary)">
                        {new Date(log.created_at).toLocaleString()}
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
