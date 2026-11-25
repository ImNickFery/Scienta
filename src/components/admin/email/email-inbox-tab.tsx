"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Loader2,
  Reply,
  Send,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { formatEmailDate, type ContactInboxRow } from "./types";

interface Props {
  isFa: boolean;
  onReplySent: () => Promise<void>;
}

export function EmailInboxTab({ isFa, onReplySent }: Props) {
  const [items, setItems] = useState<ContactInboxRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | "new" | "read" | "archived">("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContactInboxRow | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyDir, setReplyDir] = useState<"rtl" | "ltr">(isFa ? "rtl" : "ltr");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const qs = statusFilter ? `?status=${statusFilter}&pageSize=40` : "?pageSize=40";
      const data = await adminFetch<{ items: ContactInboxRow[] }>(`/api/admin/messages${qs}`);
      setError(null);
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contact messages");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const qs = statusFilter ? `?status=${statusFilter}&pageSize=40` : "?pageSize=40";
        const data = await adminFetch<{ items: ContactInboxRow[] }>(`/api/admin/messages${qs}`);
        if (cancelled) return;
        setError(null);
        setItems(data.items ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load contact messages");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  function openMessage(msg: ContactInboxRow) {
    setSelected(msg);
    setReplySubject(
      msg.subject
        ? isFa
          ? `پاسخ: ${msg.subject}`
          : `Re: ${msg.subject}`
        : isFa
          ? "پاسخ تحریریه ساینتا"
          : "Reply from Scienta Editorial"
    );
    setReplyBody("");
    setError(null);
    setNotice(null);
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!replySubject.trim() || !replyBody.trim()) {
      setError(isFa ? "موضوع و متن پاسخ را بنویسید." : "Please write a subject and reply body.");
      return;
    }

    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch<{ status: string; providerMode: string }>(
        "/api/admin/email/reply-message",
        {
          method: "POST",
          body: JSON.stringify({
            messageId: selected.id,
            subject: replySubject.trim(),
            replyBody: replyBody.trim(),
            direction: replyDir,
          }),
        }
      );
      setNotice(
        isFa
          ? `پاسخ به ${selected.email} ارسال و در گزارش ایمیل ثبت شد (${res.providerMode === "smtp" ? "SMTP واقعی" : "آزمایشی"}).`
          : `Reply dispatched to ${selected.email} (${res.providerMode}) and logged.`
      );
      setReplyBody("");
      await Promise.all([loadMessages(), onReplySent()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left 5 cols: Incoming Contact Messages */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) lg:col-span-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--color-border-subtle) px-4 py-3">
          <h2 className="text-sm font-semibold text-(--color-text-primary)">
            {isFa ? "صندوق پیام‌های ورودی" : "Contact Inbox"}
          </h2>
          <div className="flex items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5">
            {(["", "new", "read"] as const).map((st) => (
              <button
                key={st || "all"}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? "bg-white/10 text-(--color-text-primary)"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                {st === ""
                  ? isFa
                    ? "همه"
                    : "All"
                  : st === "new"
                    ? isFa
                      ? "جدید"
                      : "Unread"
                    : isFa
                      ? "خوانده‌شده"
                      : "Read"}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[560px] divide-y divide-(--color-border-subtle) overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-(--color-text-tertiary)">
              {isFa ? "در حال بارگذاری پیام‌ها…" : "Loading messages…"}
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <Inbox className="mx-auto h-6 w-6 text-(--color-text-tertiary)/60" />
              <p className="mt-2 text-xs text-(--color-text-tertiary)">
                {isFa ? "هیچ پیام تماسی یافت نشد." : "No contact messages found."}
              </p>
            </div>
          ) : (
            items.map((msg) => {
              const active = selected?.id === msg.id;
              return (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => openMessage(msg)}
                  className={`block w-full px-4 py-3.5 text-start transition-colors ${
                    active ? "bg-(--color-accent-purple)/12" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-(--color-text-primary)">
                      {msg.name}
                    </span>
                    <span
                      className={`text-[11px] font-medium whitespace-nowrap ${
                        msg.status === "new" ? "text-amber-400" : "text-(--color-text-tertiary)"
                      }`}
                    >
                      {msg.status === "new"
                        ? isFa
                          ? "جدید"
                          : "Unread"
                        : isFa
                          ? "خوانده‌شده"
                          : msg.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary)">
                    {msg.email}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-(--color-text-secondary)">
                    {msg.subject || msg.message}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right 7 cols: Message Detail + Direct Email Reply */}
      <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5 lg:col-span-7">
        {!selected ? (
          <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
            <Reply className="h-7 w-7 text-(--color-text-tertiary)/60" />
            <p className="mt-3 text-sm font-medium text-(--color-text-secondary)">
              {isFa ? "یک پیام را از ستون کنار انتخاب کنید" : "Select an inquiry to inspect and reply"}
            </p>
            <p className="mt-1 max-w-sm text-xs text-(--color-text-tertiary)">
              {isFa
                ? "می‌توانید مستقیماً از همین‌جا به ایمیل فرستنده پاسخ ارسال کنید و نسخه آن در گزارش ایمیل‌ها ثبت می‌شود."
                : "Send branded email replies directly from here; every reply is logged and automatically marks unread inquiries as read."}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="border-b border-(--color-border-subtle) pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-(--color-text-primary)">
                  {selected.subject || (isFa ? "بدون موضوع" : "No subject")}
                </h3>
                <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                  {formatEmailDate(selected.created_at, isFa)}
                </span>
              </div>
              <p className="mt-1 text-xs text-(--color-text-tertiary)">
                <span>{selected.name}</span>
                <span aria-hidden="true"> · </span>
                <span className="font-[family-name:var(--font-mono)] text-(--color-text-secondary)">
                  {selected.email}
                </span>
              </p>
              <div className="mt-3 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-3.5 text-sm leading-relaxed whitespace-pre-wrap text-(--color-text-secondary)">
                {selected.message}
              </div>
            </div>

            <form onSubmit={handleSendReply} className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-(--color-text-primary)">
                  {isFa ? "پاسخ مستقیم ایمیلی" : "Send Email Reply"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setReplyDir("rtl")}
                    className={`rounded px-2 py-0.5 text-[11px] ${
                      replyDir === "rtl"
                        ? "bg-(--color-accent-purple) text-white"
                        : "text-(--color-text-tertiary)"
                    }`}
                  >
                    RTL
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyDir("ltr")}
                    className={`rounded px-2 py-0.5 text-[11px] ${
                      replyDir === "ltr"
                        ? "bg-(--color-accent-purple) text-white"
                        : "text-(--color-text-tertiary)"
                    }`}
                  >
                    LTR
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reply-subject" className="mb-1 block text-xs text-(--color-text-tertiary)">
                  {isFa ? "موضوع پاسخ" : "Reply Subject"}
                </label>
                <input
                  id="reply-subject"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>

              <div>
                <label htmlFor="reply-body" className="mb-1 block text-xs text-(--color-text-tertiary)">
                  {isFa ? "متن پاسخ" : "Message"}
                </label>
                <textarea
                  id="reply-body"
                  rows={6}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  dir={replyDir}
                  placeholder={isFa ? "پاسخ تحریریه را اینجا بنویسید…" : "Write your reply here…"}
                  className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-3 text-sm leading-relaxed text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sending}
                  className="flex h-9 items-center gap-2 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>{isFa ? "ارسال پاسخ ایمیلی" : "Send Reply"}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
