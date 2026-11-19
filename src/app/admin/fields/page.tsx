"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Save } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";

interface FieldRow {
  id: string; slug: string; name_fa: string; name_en: string; color: string; icon: string; sort_order: number; article_count: number;
}

const emptyForm = { nameFa: "", nameEn: "", color: "#7B3FFB", icon: "atom", sortOrder: 0 };

export default function FieldsAdminPage() {
  const [items, setItems] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await adminFetch<{ items: FieldRow[] }>("/api/admin/fields");
    setItems(data.items);
    setLoading(false);
  }, []);

  // Initial data fetch on mount — the standard, safe "load on mount" pattern;
  // the rule below is written for effects that synchronize derived UI state,
  // not async data loading.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function startEdit(f: FieldRow) {
    setEditingId(f.id);
    setForm({ nameFa: f.name_fa, nameEn: f.name_en, color: f.color, icon: f.icon, sortOrder: f.sort_order });
    setShowForm(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSubmit() {
    setError(null);
    try {
      if (editingId) {
        await adminFetch(`/api/admin/fields/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await adminFetch("/api/admin/fields", { method: "POST", body: JSON.stringify(form) });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    await adminFetch(`/api/admin/fields/${id}`, { method: "DELETE" });
    setConfirmingId(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">Scientific Fields</h1>
          <p className="text-sm text-(--color-text-tertiary)">Taxonomy shown in the navbar, homepage, and article badges</p>
        </div>
        <button onClick={startCreate} className="flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-5 text-sm font-medium text-white">
          <Plus className="h-4 w-4" /> New Field
        </button>
      </div>

      {showForm && (
        <div className="card-elevated space-y-4 rounded-2xl p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name (English)"><input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="admin-input" /></Field>
            <Field label="Name (Persian)"><input dir="rtl" value={form.nameFa} onChange={(e) => setForm({ ...form, nameFa: e.target.value })} className="admin-input" /></Field>
            <Field label="Color"><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-black/20" /></Field>
            <Field label="Sort Order"><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="admin-input" /></Field>
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
              <th className="px-5 py-3 text-start font-medium">Field</th>
              <th className="px-5 py-3 text-start font-medium">Slug</th>
              <th className="px-5 py-3 text-start font-medium">Articles</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-(--color-text-tertiary)">Loading…</td></tr>
            ) : items.map((f) => (
              <tr key={f.id} className="border-b border-(--color-border-subtle) last:border-0">
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
                    <span className="text-(--color-text-primary)">{f.name_en}</span>
                    <span className="text-(--color-text-tertiary)">/ {f.name_fa}</span>
                  </span>
                </td>
                <td className="px-5 py-3 text-(--color-text-tertiary)">{f.slug}</td>
                <td className="px-5 py-3 text-(--color-text-tertiary)">{f.article_count}</td>
                <td className="px-5 py-3 text-end">
                  {confirmingId === f.id ? (
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(f.id)}
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
                      <button type="button" onClick={() => startEdit(f)} className="text-(--color-text-tertiary) hover:text-(--color-text-primary)"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setConfirmingId(f.id)} className="text-(--color-text-tertiary) hover:text-(--color-accent-red)"><Trash2 className="h-4 w-4" /></button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-(--color-text-tertiary)">{label}</label>
      {children}
    </div>
  );
}
