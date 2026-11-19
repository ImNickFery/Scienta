"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  HelpCircle,
  ExternalLink,
  Send,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { MathRichText } from "@/components/article/math-rich-text";

interface AdminComment {
  id: string;
  article_id: string;
  article_title: string | null;
  article_slug: string | null;
  locale: "fa" | "en";
  name: string;
  email: string;
  content: string;
  is_question: number;
  admin_reply: string | null;
  replied_at: string | null;
  ip_address: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface Counts {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
}

const STATUS_BADGE: Record<AdminComment["status"], string> = {
  pending: "bg-(--color-accent-orange)/20 text-(--color-accent-orange)",
  approved: "bg-emerald-500/20 text-emerald-300",
  rejected: "bg-(--color-accent-red)/20 text-(--color-accent-red)",
};

export default function CommentsAdminPage() {
  const [items, setItems] = useState<AdminComment[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [statusFilter, setStatusFilter] = useState<"" | "pending" | "approved" | "rejected">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReply, setSavingReply] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await adminFetch<{ items: AdminComment[]; counts: Counts }>(
        `/api/admin/comments?${params}`
      );
      setItems(data.items);
      setCounts(data.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch moderation queue on mount and status filter changes
    load();
  }, [load]);

  const selected = items.find((c) => c.id === selectedId) ?? items[0] ?? null;
  const replyDraft = selected ? (replyDrafts[selected.id] ?? selected.admin_reply ?? "") : "";

  async function updateStatus(id: string, status: AdminComment["status"]) {
    setError(null);
    try {
      await adminFetch(`/api/admin/comments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update comment status");
    }
  }

  async function saveReply(id: string, alsoApprove: boolean) {
    setSavingReply(true);
    setError(null);
    try {
      const payload: { adminReply: string; status?: "approved" } = {
        adminReply: replyDraft,
      };
      if (alsoApprove) payload.status = "approved";
      await adminFetch(`/api/admin/comments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save editorial reply");
    } finally {
      setSavingReply(false);
    }
  }

  async function deleteComment(id: string) {
    setError(null);
    try {
      await adminFetch(`/api/admin/comments/${id}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment");
    }
  }

  const tabs: Array<{ value: "" | "pending" | "approved" | "rejected"; label: string; count: number }> = [
    { value: "", label: "All", count: counts.all },
    { value: "pending", label: "Pending", count: counts.pending },
    { value: "approved", label: "Approved", count: counts.approved },
    { value: "rejected", label: "Rejected", count: counts.rejected },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
            Comments &amp; Scientific Q&amp;A
          </h1>
          <p className="text-sm text-(--color-text-tertiary)">
            Moderate reader comments with live KaTeX formula rendering and post editorial replies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? "bg-(--color-accent-purple) text-white"
                  : "border border-(--color-border-subtle) text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px]">
                {tab.count}
              </span>
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
          <MessageSquare className="h-8 w-8" />
          <p className="text-sm">No comments in this queue.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="card-elevated divide-y divide-(--color-border-subtle) overflow-hidden rounded-2xl">
            {items.map((c) => {
              const active = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                    setConfirmDeleteId(null);
                  }}
                  className={`flex w-full flex-col gap-1.5 p-4 text-start transition-colors ${
                    active ? "bg-(--color-accent-purple)/10" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-(--color-text-primary)">
                      {c.name}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] capitalize ${STATUS_BADGE[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-(--color-text-tertiary)">
                    <span className="uppercase">{c.locale}</span>
                    {Boolean(c.is_question) && (
                      <span className="inline-flex items-center gap-0.5 text-(--color-accent-orange)">
                        <HelpCircle className="h-3 w-3" /> Q&amp;A
                      </span>
                    )}
                    <span className="truncate">· {c.article_title ?? c.article_id}</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-(--color-text-secondary)" dir={c.locale === "fa" ? "rtl" : "ltr"}>
                    {c.content}
                  </p>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="card-elevated flex min-w-0 flex-col justify-between gap-6 rounded-2xl p-6">
              <div className="min-w-0 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-(--color-border-subtle) pb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-(--color-text-primary)">
                        {selected.name}
                      </h2>
                      <span className="rounded-full border border-(--color-border-subtle) px-2 py-0.5 text-[10px] uppercase text-(--color-text-tertiary)">
                        {selected.locale}
                      </span>
                      {Boolean(selected.is_question) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-(--color-accent-orange)/15 px-2.5 py-0.5 text-[11px] text-(--color-accent-orange)">
                          <HelpCircle className="h-3 w-3" /> Scientific Question
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-(--color-text-secondary)">
                      {selected.email}
                      {selected.ip_address ? ` · IP: ${selected.ip_address}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-(--color-text-tertiary)">
                      <span>{new Date(selected.created_at).toLocaleString()}</span>
                      {selected.article_slug && (
                        <Link
                          href={`/${selected.locale}/articles/${selected.article_slug}#discussion`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-(--color-accent-purple) hover:underline"
                        >
                          {selected.article_title ?? selected.article_slug}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs capitalize ${STATUS_BADGE[selected.status]}`}>
                    {selected.status}
                  </span>
                </div>

                {/* Rendered KaTeX comment body */}
                <div className="rounded-xl border border-(--color-border-subtle) bg-black/20 p-4">
                  <MathRichText
                    text={selected.content}
                    dir={selected.locale === "fa" ? "rtl" : "ltr"}
                    className="text-(--color-text-primary)"
                  />
                </div>

                {/* Editorial reply box */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-medium text-(--color-text-secondary)">
                    Editorial Reply (supports KaTeX $...$ / $$...$$)
                  </label>
                  <textarea
                    rows={3}
                    dir={selected.locale === "fa" ? "rtl" : "ltr"}
                    value={replyDraft}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [selected.id]: e.target.value }))
                    }
                    placeholder="Write an optional scientific answer or editorial note…"
                    className="w-full resize-y rounded-xl border border-(--color-border-subtle) bg-black/25 p-3 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                  />
                  {replyDraft.trim() && (
                    <div className="rounded-xl border border-(--color-accent-purple)/25 bg-(--color-accent-purple)/[0.05] p-3">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-(--color-accent-purple)">
                        Reply KaTeX Preview
                      </p>
                      <MathRichText
                        text={replyDraft}
                        dir={selected.locale === "fa" ? "rtl" : "ltr"}
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={savingReply}
                      onClick={() => saveReply(selected.id, selected.status === "pending")}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-(--color-accent-purple) px-4 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {selected.status === "pending" ? "Save Reply & Approve" : "Save Reply"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Moderation actions */}
              <div className="flex flex-wrap items-center gap-2 border-t border-(--color-border-subtle) pt-4">
                {selected.status !== "approved" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, "approved")}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-xs font-medium text-white hover:bg-emerald-500"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                )}
                {selected.status !== "rejected" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, "rejected")}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs text-(--color-text-secondary) hover:border-(--color-accent-red)/50 hover:text-(--color-accent-red)"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                )}
                {selected.status !== "pending" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(selected.id, "pending")}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
                  >
                    <Clock className="h-3.5 w-3.5" /> Move to Pending
                  </button>
                )}

                {confirmDeleteId === selected.id ? (
                  <div className="ms-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => deleteComment(selected.id)}
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
