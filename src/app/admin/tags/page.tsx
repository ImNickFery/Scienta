"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X, Save } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface TagRow { id: string; slug: string; name_fa: string; name_en: string; article_count: number }

export default function TagsAdminPage() {
  const [items, setItems] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nameFa: "", nameEn: "" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await adminFetch<{ items: TagRow[] }>("/api/admin/tags");
    setItems(data.items);
    setLoading(false);
  }, []);

  // Initial data fetch on mount — the standard, safe "load on mount" pattern;
  // the rule below is written for effects that synchronize derived UI state,
  // not async data loading.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    setError(null);
    try {
      await adminFetch("/api/admin/tags", { method: "POST", body: JSON.stringify(form) });
      setForm({ nameFa: "", nameEn: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this tag?")) return;
    await adminFetch(`/api/admin/tags/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">Tags</h1>
          <p className="text-sm text-(--color-text-tertiary)">Free-form topic labels attached to articles</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-5 text-sm font-medium text-white">
          <Plus className="h-4 w-4" /> New Tag
        </button>
      </div>

      {showForm && (
        <div className="card-elevated space-y-4 rounded-2xl p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Name (English)</label><input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="admin-input" /></div>
            <div><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Name (Persian)</label><input dir="rtl" value={form.nameFa} onChange={(e) => setForm({ ...form, nameFa: e.target.value })} className="admin-input" /></div>
          </div>
          {error && <p className="text-xs text-(--color-accent-red)">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex items-center gap-1.5 rounded-full bg-(--color-accent-purple) px-4 py-2 text-xs font-medium text-white"><Save className="h-3.5 w-3.5" /> Save</button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 py-2 text-xs text-(--color-text-secondary)"><X className="h-3.5 w-3.5" /> Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {loading ? (
          <p className="text-sm text-(--color-text-tertiary)">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-(--color-text-tertiary)">No tags yet.</p>
        ) : items.map((t) => (
          <span key={t.id} className="card-elevated flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <span className="text-(--color-text-primary)">{t.name_en}</span>
            <span className="text-(--color-text-tertiary)">({t.article_count})</span>
            <button onClick={() => handleDelete(t.id)} className="text-(--color-text-tertiary) hover:text-(--color-accent-red)"><Trash2 className="h-3.5 w-3.5" /></button>
          </span>
        ))}
      </div>
    </div>
  );
}
