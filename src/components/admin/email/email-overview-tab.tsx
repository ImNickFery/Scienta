"use client";

import {
  ArrowUpRight,
  Inbox,
  Megaphone,
  Send,
  Settings2,
  ShieldAlert,
  CheckCircle2,
  FlaskConical,
} from "lucide-react";
import type { EmailOverviewPayload, EmailWorkspaceTab } from "./types";
import { formatEmailDate, kindLabel, statusColorClass, statusLabel } from "./types";

interface Props {
  isFa: boolean;
  data: EmailOverviewPayload;
  onNavigate: (tab: EmailWorkspaceTab) => void;
}

export function EmailOverviewTab({ isFa, data, onNavigate }: Props) {
  const { settings, stats, recentLogs } = data;
  const isSmtpLive = settings.mode === "smtp" && Boolean(settings.smtpHost);

  return (
    <div className="space-y-6">
      {/* Transport Readiness Banner — flat single-elevation, zero decorative dots */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {isSmtpLive ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
          )}
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-(--color-text-primary)">
              {isSmtpLive
                ? isFa
                  ? "حالت ارسال واقعی SMTP فعال است"
                  : "Live SMTP Transport Active"
                : isFa
                  ? "حالت آزمایشی (Sandbox) فعال است"
                  : "Sandbox Preview Mode Active"}
            </p>
            <p className="text-xs text-(--color-text-tertiary)">
              {isSmtpLive ? (
                <>
                  <span className="font-[family-name:var(--font-mono)] text-(--color-text-secondary)">
                    {settings.smtpHost}:{settings.smtpPort}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {settings.fromName} &lt;{settings.fromEmail}&gt;
                  </span>
                </>
              ) : isFa ? (
                "تمام ایمیل‌ها رندر، بررسی و در گزارش ارسال‌ها ثبت می‌شوند؛ برای ارسال واقعی به صندوق کاربران، اطلاعات SMTP را تنظیم کنید."
              ) : (
                "Emails are validated, rendered, and logged locally. Configure SMTP credentials in Settings whenever you are ready to send live."
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("settings")}
          className="flex h-9 items-center gap-2 rounded-lg border border-(--color-border-strong) bg-white/[0.03] px-3.5 text-xs font-medium text-(--color-text-primary) transition-colors hover:border-(--color-accent-purple) hover:bg-(--color-accent-purple)/10 whitespace-nowrap shrink-0"
        >
          <Settings2 className="h-3.5 w-3.5 text-(--color-text-tertiary)" />
          <span>{isFa ? "پیکربندی SMTP" : "Configure SMTP"}</span>
        </button>
      </section>

      {/* 4-Column KPI Strip — flat grid with hairline dividers, tabular numerals */}
      <section className="grid grid-cols-1 divide-y divide-(--color-border-subtle) overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x rtl:lg:divide-x-reverse">
        <div className="p-5">
          <p className="text-xs text-(--color-text-tertiary)">
            {isFa ? "مجموع ایمیل‌های ارسال‌شده" : "Total Dispatched"}
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {stats.totalDelivered.toLocaleString(isFa ? "fa-IR" : "en-US")}
          </p>
          <p className="mt-1.5 text-xs text-(--color-text-tertiary) tabular-nums">
            {isFa
              ? `واقعی: ${stats.sent} · آزمایشی: ${stats.sandbox}`
              : `Live: ${stats.sent} · Sandbox: ${stats.sandbox}`}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs text-(--color-text-tertiary)">
            {isFa ? "نرخ موفقیت تحویل" : "Delivery Rate"}
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-emerald-400">
            {stats.deliveryRate}%
          </p>
          <p className="mt-1.5 text-xs text-(--color-text-tertiary) tabular-nums">
            {isFa
              ? `ناموفق: ${stats.failed} · مسدودشده: ${stats.suppressed}`
              : `Failed: ${stats.failed} · Suppressed: ${stats.suppressed}`}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs text-(--color-text-tertiary)">
            {isFa ? "مشترکین فعال خبرنامه" : "Active Subscribers"}
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {stats.activeSubscribersAll.toLocaleString(isFa ? "fa-IR" : "en-US")}
          </p>
          <p className="mt-1.5 text-xs text-(--color-text-tertiary) tabular-nums">
            {isFa
              ? `فارسی: ${stats.activeSubscribersFa} · انگلیسی: ${stats.activeSubscribersEn}`
              : `FA: ${stats.activeSubscribersFa} · EN: ${stats.activeSubscribersEn}`}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs text-(--color-text-tertiary)">
            {isFa ? "صندوق پیام و لیست مسدود" : "Inbox & Suppression"}
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-bold tabular-nums text-(--color-text-primary)">
            {stats.unreadMessagesCount.toLocaleString(isFa ? "fa-IR" : "en-US")}
          </p>
          <p className="mt-1.5 text-xs text-(--color-text-tertiary) tabular-nums">
            {isFa
              ? `پیام خوانده‌نشده · ${stats.suppressionsCount} ایمیل مسدود`
              : `Unread messages · ${stats.suppressionsCount} suppressed`}
          </p>
        </div>
      </section>

      {/* Main Split: Quick Workflows + Recent Outbound Ledger */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Operational Shortcuts & Automation Status */}
        <section className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "دسترسی سریع عملیات ایمیل" : "Quick Workflows"}
            </h2>
            <div className="mt-4 divide-y divide-(--color-border-subtle)">
              <button
                type="button"
                onClick={() => onNavigate("compose")}
                className="flex w-full items-center justify-between gap-3 py-3 text-start transition-colors hover:text-(--color-accent-purple)"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-(--color-text-primary)">
                  <Send className="h-4 w-4 text-(--color-accent-purple)" />
                  {isFa ? "ارسال ایمیل مستقیم" : "Compose Direct Email"}
                </span>
                <ArrowUpRight className="h-4 w-4 text-(--color-text-tertiary)" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("campaigns")}
                className="flex w-full items-center justify-between gap-3 py-3 text-start transition-colors hover:text-(--color-accent-purple)"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-(--color-text-primary)">
                  <Megaphone className="h-4 w-4 text-(--color-text-tertiary)" />
                  {isFa ? "ساخت کمپین خبرنامه" : "Launch Newsletter Campaign"}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                  {stats.campaignsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("inbox")}
                className="flex w-full items-center justify-between gap-3 py-3 text-start transition-colors hover:text-(--color-accent-purple)"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-(--color-text-primary)">
                  <Inbox className="h-4 w-4 text-(--color-text-tertiary)" />
                  {isFa ? "پاسخ به پیام‌های تماس" : "Reply to Contact Inbox"}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                  {stats.unreadMessagesCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate("settings")}
                className="flex w-full items-center justify-between gap-3 pt-3 text-start transition-colors hover:text-(--color-accent-purple)"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-(--color-text-primary)">
                  <ShieldAlert className="h-4 w-4 text-(--color-text-tertiary)" />
                  {isFa ? "لیست مسدود و اتوماسیون" : "Suppression & Automations"}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                  {stats.suppressionsCount}
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "وضعیت اتوماسیون‌های سایت" : "Site Automations"}
            </h2>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-(--color-text-secondary)">
                  {isFa ? "خوش‌آمدگویی عضویت خبرنامه" : "Newsletter welcome email"}
                </dt>
                <dd
                  className={
                    settings.autoWelcomeSubscriber
                      ? "font-medium text-emerald-400"
                      : "text-(--color-text-tertiary)"
                  }
                >
                  {settings.autoWelcomeSubscriber
                    ? isFa
                      ? "فعال"
                      : "Enabled"
                    : isFa
                      ? "غیرفعال"
                      : "Paused"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-(--color-text-secondary)">
                  {isFa ? "تأییدیه خودکار فرم تماس" : "Contact form auto-receipt"}
                </dt>
                <dd
                  className={
                    settings.autoReplyContact
                      ? "font-medium text-emerald-400"
                      : "text-(--color-text-tertiary)"
                  }
                >
                  {settings.autoReplyContact
                    ? isFa
                      ? "فعال"
                      : "Enabled"
                    : isFa
                      ? "غیرفعال"
                      : "Paused"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-(--color-border-subtle) pt-2.5">
                <dt className="text-(--color-text-secondary)">
                  {isFa ? "قالب‌های آماده" : "Saved templates"}
                </dt>
                <dd className="font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-primary)">
                  {stats.templatesCount}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Right: Recent Delivery Ledger */}
        <section className="overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) lg:col-span-8">
          <div className="flex items-center justify-between border-b border-(--color-border-subtle) px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "آخرین ارسال‌های ثبت‌شده" : "Recent Outbound Activity"}
              </h2>
              <p className="text-xs text-(--color-text-tertiary)">
                {isFa
                  ? "گزارش لحظه‌ای ایمیل‌های مستقیم، کمپین‌ها و پاسخ‌ها"
                  : "Live ledger of direct dispatches, campaigns, tests, and replies"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("logs")}
              className="text-xs font-medium text-(--color-accent-purple) hover:underline whitespace-nowrap shrink-0"
            >
              {isFa ? "مشاهده همه گزارش‌ها" : "View all logs"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--color-border-subtle) text-start text-xs text-(--color-text-tertiary)">
                  <th className="px-5 py-3 text-start font-medium">
                    {isFa ? "گیرنده و موضوع" : "Recipient & Subject"}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">{isFa ? "نوع" : "Type"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isFa ? "وضعیت" : "Status"}</th>
                  <th className="px-5 py-3 text-end font-medium">{isFa ? "زمان" : "Timestamp"}</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center">
                      <p className="text-sm font-medium text-(--color-text-secondary)">
                        {isFa ? "هنوز ایمیلی ارسال نشده است." : "No emails dispatched yet."}
                      </p>
                      <p className="mt-1 text-xs text-(--color-text-tertiary)">
                        {isFa
                          ? "اولین ایمیل مستقیم یا آزمایشی خود را از بخش ارسال سریع بفرستید."
                          : "Send a test or direct message to populate your delivery ledger."}
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigate("compose")}
                        className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-medium text-white transition-opacity hover:opacity-90"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {isFa ? "ارسال اولین ایمیل" : "Send First Email"}
                      </button>
                    </td>
                  </tr>
                ) : (
                  recentLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-(--color-border-subtle) last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3">
                        <p className="max-w-[280px] truncate text-xs font-medium text-(--color-text-primary)">
                          {log.subject}
                        </p>
                        <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary)">
                          {log.recipient_email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-(--color-text-secondary) whitespace-nowrap">
                        {kindLabel(log.kind, isFa)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-medium ${statusColorClass(log.status)}`}>
                          {statusLabel(log.status, isFa)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-end font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary) whitespace-nowrap">
                        {formatEmailDate(log.created_at, isFa)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
