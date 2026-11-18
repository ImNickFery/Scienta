"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface ArticleRow {
  id: string;
  title_en: string | null;
  title_fa: string | null;
  updated_at: string;
}

export default function TrashPage() {
  const [items, setItems] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await adminFetch<{ items: ArticleRow[] }>("/api/admin/articles?trashed=1&pageSize=50");
    setItems(data.items);
    setLoading(false);
  }, []);

  // Initial data fetch on mount — the standard, safe "load on mount" pattern;
  // the rule below is written for effects that synchronize derived UI state,
  // not async data loading.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function restore(id: string) {
    await adminFetch(`/api/admin/articles/${id}/restore`, { method: "POST" });
    load();
  }

  async function purge(id: string) {
    if (!confirm("Permanently delete this article? This cannot be undone.")) return;
    await adminFetch(`/api/admin/articles/${id}/permanent`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">Recycle Bin</h1>
        <p className="text-sm text-(--color-text-tertiary)">Articles moved to trash. Restore them or delete permanently.</p>
      </div>

      <div className="card-elevated overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-border-subtle) text-xs text-(--color-text-tertiary)">
              <th className="px-5 py-3 text-start font-medium">Title</th>
              <th className="px-5 py-3 text-start font-medium">Deleted</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-5 py-10 text-center text-(--color-text-tertiary)">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={3} className="px-5 py-10 text-center text-(--color-text-tertiary)">Recycle bin is empty.</td></tr>
            ) : (
              items.map((a) => (
                <tr key={a.id} className="border-b border-(--color-border-subtle) last:border-0">
                  <td className="px-5 py-3 text-(--color-text-primary)">{a.title_en || a.title_fa || "(untitled)"}</td>
                  <td className="px-5 py-3 text-(--color-text-tertiary)">{new Date(a.updated_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-end">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => restore(a.id)} className="flex items-center gap-1 rounded-full border border-(--color-border-subtle) px-3 py-1.5 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)">
                        <RotateCcw className="h-3 w-3" /> Restore
                      </button>
                      <button onClick={() => purge(a.id)} className="flex items-center gap-1 rounded-full border border-(--color-border-subtle) px-3 py-1.5 text-xs text-(--color-accent-red) hover:border-(--color-accent-red)/50">
                        <Trash2 className="h-3 w-3" /> Delete Forever
                      </button>
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
