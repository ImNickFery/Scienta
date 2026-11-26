"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Star, Eye, Trash2, RotateCcw } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { useAdminLocale } from "@/components/admin/admin-locale-context";

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
  const { isFa } = useAdminLocale();
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleTrash(id: string) {
    await adminFetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    setConfirmTrashId(null);
    load();
  }

  function statusLabel(s: ArticleRow["status"]): string {
    if (!isFa) return s;
    if (s === "published") return "منتشرشده";
    if (s === "scheduled") return "زمان‌بندی";
    return "پیش‌نویس";
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-(--color-text-primary) sm:text-2xl">
            {isFa ? "مقالات" : "Articles"}
          </h1>
          <p className="text-xs text-(--color-text-tertiary) sm:text-sm">
            {isFa ? `${total.toLocaleString()} مقاله` : `${total.toLocaleString()} total`}
          </p>
        </div>
        <Link
          href="/admin/articles/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap sm:h-10 sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>{isFa ? "مقاله جدید" : "New Article"}</span>
        </Link>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="relative w-full sm:min-w-[220px] sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-(--color-text-tertiary)" />
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder={isFa ? "جستجوی عنوان مقاله…" : "Search articles…"}
            className="h-10 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) ps-9 pe-4 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
            className="h-10 flex-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3.5 text-xs font-medium text-(--color-text-primary) outline-none focus:border-(--color-accent-purple) sm:flex-none sm:text-sm"
          >
            <option value="">{isFa ? "همه وضعیت‌ها" : "All statuses"}</option>
            <option value="published">{isFa ? "منتشرشده" : "Published"}</option>
            <option value="draft">{isFa ? "پیش‌نویس" : "Draft"}</option>
            <option value="scheduled">{isFa ? "زمان‌بندی‌شده" : "Scheduled"}</option>
          </select>
          <Link
            href="/admin/trash"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) px-3.5 text-xs font-medium text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary) whitespace-nowrap sm:text-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{isFa ? "سطل بازیافت" : "Recycle Bin"}</span>
          </Link>
        </div>
      </div>

      {/* Mobile Card List (< md) — Zero horizontal clipping */}
      <div className="divide-y divide-(--color-border-subtle) overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) md:hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-xs text-(--color-text-tertiary)">
            {isFa ? "در حال بارگذاری…" : "Loading…"}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-(--color-text-tertiary)">
            {isFa ? "مقاله‌ای یافت نشد." : "No articles found."}
          </div>
        ) : (
          items.map((a) => {
            const displayTitle = isFa
              ? a.title_fa || a.title_en || "(بدون عنوان)"
              : a.title_en || a.title_fa || "(untitled)";
            return (
              <div key={a.id} className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="flex min-w-0 items-start gap-1.5 text-sm font-semibold leading-snug text-(--color-text-primary) hover:text-(--color-accent-purple)"
                  >
                    {!!a.featured && <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--color-accent-orange)" />}
                    <span className="line-clamp-2">{displayTitle}</span>
                  </Link>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[a.status]}`}>
                    {statusLabel(a.status)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--color-text-tertiary)">
                  <span>{a.field_name ?? "—"}</span>
                  <span aria-hidden="true">·</span>
                  <span>{a.author_name ?? "—"}</span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5 text-xs text-(--color-text-tertiary)">
                  <div className="flex items-center gap-3 font-[family-name:var(--font-mono)] text-[11px] tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {a.views.toLocaleString()}
                    </span>
                    <span>{new Date(a.updated_at).toLocaleDateString(isFa ? "fa-IR" : "en-US")}</span>
                  </div>

                  {confirmTrashId === a.id ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTrash(a.id)}
                        className="rounded-md bg-(--color-accent-red) px-2.5 py-1 text-[11px] font-medium text-white"
                      >
                        {isFa ? "حذف" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmTrashId(null)}
                        className="rounded-md border border-(--color-border-subtle) px-2.5 py-1 text-[11px] text-(--color-text-tertiary)"
                      >
                        {isFa ? "انصراف" : "Cancel"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmTrashId(a.id)}
                      aria-label={`Move "${displayTitle}" to trash`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-(--color-border-subtle) text-(--color-text-tertiary) hover:border-(--color-accent-red)/40 hover:text-(--color-accent-red)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Data Table (>= md) */}
      <div className="hidden overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border-subtle) text-start text-xs text-(--color-text-tertiary)">
                <th className="px-5 py-3 text-start font-medium">{isFa ? "عنوان" : "Title"}</th>
                <th className="px-5 py-3 text-start font-medium">{isFa ? "حوزه" : "Field"}</th>
                <th className="px-5 py-3 text-start font-medium">{isFa ? "نویسنده" : "Author"}</th>
                <th className="px-5 py-3 text-start font-medium">{isFa ? "وضعیت" : "Status"}</th>
                <th className="px-5 py-3 text-start font-medium">{isFa ? "بازدید" : "Views"}</th>
                <th className="px-5 py-3 text-start font-medium">{isFa ? "بروزرسانی" : "Updated"}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-(--color-text-tertiary)">
                    {isFa ? "در حال بارگذاری…" : "Loading…"}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-(--color-text-tertiary)">
                    {isFa ? "مقاله‌ای یافت نشد." : "No articles found."}
                  </td>
                </tr>
              ) : (
                items.map((a) => {
                  const displayTitle = isFa
                    ? a.title_fa || a.title_en || "(بدون عنوان)"
                    : a.title_en || a.title_fa || "(untitled)";
                  return (
                    <tr key={a.id} className="border-b border-(--color-border-subtle) last:border-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/articles/${a.id}`}
                          className="flex items-center gap-2 font-medium text-(--color-text-primary) hover:text-(--color-accent-orange)"
                        >
                          {!!a.featured && <Star className="h-3.5 w-3.5 shrink-0 text-(--color-accent-orange)" />}
                          <span>{displayTitle}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-(--color-text-tertiary)">{a.field_name ?? "—"}</td>
                      <td className="px-5 py-3 text-(--color-text-tertiary)">{a.author_name ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[a.status]}`}>
                          {statusLabel(a.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {a.views.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                        {new Date(a.updated_at).toLocaleDateString(isFa ? "fa-IR" : "en-US")}
                      </td>
                      <td className="px-5 py-3 text-end">
                        {confirmTrashId === a.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTrash(a.id)}
                              className="rounded-md bg-(--color-accent-red) px-2.5 py-1 text-xs font-medium text-white"
                            >
                              {isFa ? "تأیید" : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmTrashId(null)}
                              className="rounded-md border border-(--color-border-subtle) px-2.5 py-1 text-xs text-(--color-text-tertiary)"
                            >
                              {isFa ? "انصراف" : "Cancel"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmTrashId(a.id)}
                            aria-label={`Move "${displayTitle}" to trash`}
                            className="text-(--color-text-tertiary) hover:text-(--color-accent-red)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-(--color-border-subtle) px-3.5 py-2 text-xs text-(--color-text-secondary) disabled:opacity-40"
          >
            {isFa ? "قبلی" : "Previous"}
          </button>
          <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `صفحه ${page} از ${Math.ceil(total / 20)}`
              : `Page ${page} of ${Math.ceil(total / 20)}`}
          </span>
          <button
            disabled={page >= Math.ceil(total / 20)}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-(--color-border-subtle) px-3.5 py-2 text-xs text-(--color-text-secondary) disabled:opacity-40"
          >
            {isFa ? "بعدی" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
