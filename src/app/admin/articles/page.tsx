"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Star, Eye, Trash2, RotateCcw } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface ArticleRow {
  id: string;
  status: "draft" | "published" | "scheduled";
  featured: number;
  views: number;
  updated_at: string;
  title_en: string | null;
  title_fa: string | null;
  field_name: string | null;
  author_name: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  published: "bg-(--color-accent-purple)/20 text-(--color-accent-purple)",
  draft: "bg-white/10 text-(--color-text-tertiary)",
  scheduled: "bg-(--color-accent-orange)/20 text-(--color-accent-orange)",
};

export default function ArticlesListPage() {
  const [items, setItems] = useState<ArticleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [confirmTrashId, setConfirmTrashId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const data = await adminFetch<{ items: ArticleRow[]; total: number }>(`/api/admin/articles?${params}`);
    setItems(data.items);
    setTotal(data.total);
    setLoading(false);
  }, [page, status, search]);

  // Initial data fetch on mount — the standard, safe "load on mount" pattern;
  // the rule below is written for effects that synchronize derived UI state,
  // not async data loading.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleTrash(id: string) {
    await adminFetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    setConfirmTrashId(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">Articles</h1>
          <p className="text-sm text-(--color-text-tertiary)">{total} total</p>
        </div>
        <Link href="/admin/articles/new" className="flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-5 text-sm font-medium text-white">
          <Plus className="h-4 w-4" /> New Article
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-(--color-text-tertiary)" />
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Search articles…"
            className="h-10 w-full rounded-full border border-(--color-border-subtle) bg-black/20 ps-9 pe-4 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          className="h-10 rounded-full border border-(--color-border-subtle) bg-black/20 px-4 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <Link href="/admin/trash" className="flex h-10 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-sm text-(--color-text-tertiary) hover:text-(--color-text-primary)">
          <RotateCcw className="h-3.5 w-3.5" /> Recycle Bin
        </Link>
      </div>

      <div className="card-elevated overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-border-subtle) text-start text-xs text-(--color-text-tertiary)">
              <th className="px-5 py-3 text-start font-medium">Title</th>
              <th className="px-5 py-3 text-start font-medium">Field</th>
              <th className="px-5 py-3 text-start font-medium">Author</th>
              <th className="px-5 py-3 text-start font-medium">Status</th>
              <th className="px-5 py-3 text-start font-medium">Views</th>
              <th className="px-5 py-3 text-start font-medium">Updated</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-(--color-text-tertiary)">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-(--color-text-tertiary)">No articles found.</td></tr>
            ) : (
              items.map((a) => (
                <tr key={a.id} className="border-b border-(--color-border-subtle) last:border-0 hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <Link href={`/admin/articles/${a.id}`} className="flex items-center gap-2 font-medium text-(--color-text-primary) hover:text-(--color-accent-orange)">
                      {!!a.featured && <Star className="h-3.5 w-3.5 shrink-0 text-(--color-accent-orange)" />}
                      {a.title_en || a.title_fa || "(untitled)"}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-(--color-text-tertiary)">{a.field_name ?? "—"}</td>
                  <td className="px-5 py-3 text-(--color-text-tertiary)">{a.author_name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                  </td>
                  <td className="px-5 py-3 text-(--color-text-tertiary)">
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{a.views.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-3 text-(--color-text-tertiary)">{new Date(a.updated_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-end">
                    {confirmTrashId === a.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTrash(a.id)}
                          className="rounded-full bg-(--color-accent-red) px-2.5 py-1 text-xs font-medium text-white"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmTrashId(null)}
                          className="rounded-full border border-(--color-border-subtle) px-2.5 py-1 text-xs text-(--color-text-tertiary)"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmTrashId(a.id)}
                        aria-label={`Move "${a.title_en || a.title_fa || "article"}" to trash`}
                        className="text-(--color-text-tertiary) hover:text-(--color-accent-red)"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-(--color-border-subtle) px-4 py-2 text-xs text-(--color-text-secondary) disabled:opacity-40">Previous</button>
          <span className="text-xs text-(--color-text-tertiary)">Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-(--color-border-subtle) px-4 py-2 text-xs text-(--color-text-secondary) disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
