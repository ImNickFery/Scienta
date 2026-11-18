"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Save } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface AuthorRow {
  id: string; slug: string; name_fa: string; name_en: string;
  title_fa: string | null; title_en: string | null; avatar_url: string | null; article_count: number;
}

const emptyForm = { nameFa: "", nameEn: "", titleFa: "", titleEn: "", bioFa: "", bioEn: "" };

export default function AuthorsAdminPage() {
  const [items, setItems] = useState<AuthorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await adminFetch<{ items: AuthorRow[] }>("/api/admin/authors");
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
        await adminFetch(`/api/admin/authors/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await adminFetch("/api/admin/authors", { method: "POST", body: JSON.stringify(form) });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this author?")) return;
    await adminFetch(`/api/admin/authors/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">Authors</h1>
          <p className="text-sm text-(--color-text-tertiary)">Public bylines shown on articles</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }} className="flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-5 text-sm font-medium text-white">
          <Plus className="h-4 w-4" /> New Author
        </button>
      </div>

      {showForm && (
        <div className="card-elevated space-y-4 rounded-2xl p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Name (English)</label><input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="admin-input" /></div>
            <div><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Name (Persian)</label><input dir="rtl" value={form.nameFa} onChange={(e) => setForm({ ...form, nameFa: e.target.value })} className="admin-input" /></div>
            <div><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Title (English)</label><input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} className="admin-input" /></div>
            <div><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Title (Persian)</label><input dir="rtl" value={form.titleFa} onChange={(e) => setForm({ ...form, titleFa: e.target.value })} className="admin-input" /></div>
            <div className="sm:col-span-2"><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Bio (English)</label><textarea value={form.bioEn} onChange={(e) => setForm({ ...form, bioEn: e.target.value })} rows={2} className="admin-input h-auto py-2" /></div>
            <div className="sm:col-span-2"><label className="mb-1.5 block text-xs text-(--color-text-tertiary)">Bio (Persian)</label><textarea dir="rtl" value={form.bioFa} onChange={(e) => setForm({ ...form, bioFa: e.target.value })} rows={2} className="admin-input h-auto py-2" /></div>
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
              <th className="px-5 py-3 text-start font-medium">Author</th>
              <th className="px-5 py-3 text-start font-medium">Title</th>
              <th className="px-5 py-3 text-start font-medium">Articles</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-(--color-text-tertiary)">Loading…</td></tr>
            ) : items.map((a) => (
              <tr key={a.id} className="border-b border-(--color-border-subtle) last:border-0">
                <td className="px-5 py-3 text-(--color-text-primary)">{a.name_en} <span className="text-(--color-text-tertiary)">/ {a.name_fa}</span></td>
                <td className="px-5 py-3 text-(--color-text-tertiary)">{a.title_en}</td>
                <td className="px-5 py-3 text-(--color-text-tertiary)">{a.article_count}</td>
                <td className="px-5 py-3 text-end">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingId(a.id);
                        setForm({ nameFa: a.name_fa, nameEn: a.name_en, titleFa: a.title_fa ?? "", titleEn: a.title_en ?? "", bioFa: "", bioEn: "" });
                        setShowForm(true);
                      }}
                      className="text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                    ><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(a.id)} className="text-(--color-text-tertiary) hover:text-(--color-accent-red)"><Trash2 className="h-4 w-4" /></button>
                  </div>
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
