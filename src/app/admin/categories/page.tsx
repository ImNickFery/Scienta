"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Save } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface CategoryRow {
  id: string; slug: string; name_fa: string; name_en: string;
  description_fa: string | null; description_en: string | null; article_count: number;
}

const emptyForm = { nameFa: "", nameEn: "", descriptionFa: "", descriptionEn: "" };

export default function CategoriesAdminPage() {
  const [items, setItems] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await adminFetch<{ items: CategoryRow[] }>("/api/admin/categories");
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
      if (editingId) {
        await adminFetch(`/api/admin/categories/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await adminFetch("/api/admin/categories", { method: "POST", body: JSON.stringify(form) });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    await adminFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    setConfirmingId(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">Categories</h1>
          <p className="text-sm text-(--color-text-tertiary)">Editorial sections used to group articles</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}
          className="flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> New Category
        </button>
      </div>

      {showForm && (
        <div className="card-elevated space-y-4 rounded-2xl p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Name (English)</label><input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="admin-input" /></div>
            <div><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Name (Persian)</label><input dir="rtl" value={form.nameFa} onChange={(e) => setForm({ ...form, nameFa: e.target.value })} className="admin-input" /></div>
            <div><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Description (English)</label><input value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} className="admin-input" /></div>
            <div><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Description (Persian)</label><input dir="rtl" value={form.descriptionFa} onChange={(e) => setForm({ ...form, descriptionFa: e.target.value })} className="admin-input" /></div>
          </div>
          {error && <p className="text-xs text-(--color-accent-red)">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex items-center gap-1.5 rounded-full bg-(--color-accent-purple) px-4 py-2 text-xs font-medium text-white"><Save className="h-3.5 w-3.5" /> Save</button>
            <button onClick={() => setShowForm(false)} className="flex items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 py-2 text-xs text-(--color-text-secondary)"><X className="h-3.5 w-3.5" /> Cancel</button>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-border-subtle) text-xs text-(--color-text-tertiary)">
              <th className="px-5 py-3 text-start font-medium">Category</th>
              <th className="px-5 py-3 text-start font-medium">Slug</th>
              <th className="px-5 py-3 text-start font-medium">Articles</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-(--color-text-tertiary)">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-(--color-text-tertiary)">No categories yet.</td></tr>
            ) : items.map((c) => (
              <tr key={c.id} className="border-b border-(--color-border-subtle) last:border-0">
                <td className="px-5 py-3 text-(--color-text-primary)">{c.name_en} <span className="text-(--color-text-tertiary)">/ {c.name_fa}</span></td>
                <td className="px-5 py-3 text-(--color-text-tertiary)">{c.slug}</td>
                <td className="px-5 py-3 text-(--color-text-tertiary)">{c.article_count}</td>
                <td className="px-5 py-3 text-end">
                  {confirmingId === c.id ? (
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="rounded-full bg-(--color-accent-red) px-3 py-1 text-xs font-medium text-white"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-full border border-(--color-border-subtle) px-3 py-1 text-xs text-(--color-text-secondary)"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setForm({ nameFa: c.name_fa, nameEn: c.name_en, descriptionFa: c.description_fa ?? "", descriptionEn: c.description_en ?? "" });
                          setShowForm(true);
                        }}
                        className="text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                      ><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setConfirmingId(c.id)} className="text-(--color-text-tertiary) hover:text-(--color-accent-red)"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
