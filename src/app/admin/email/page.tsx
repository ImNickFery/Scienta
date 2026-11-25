"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  FileCode2,
  Inbox,
  LayoutGrid,
  Loader2,
  Megaphone,
  Send,
  Settings2,
  AlertCircle,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import { useAdminLocale } from "@/components/admin/admin-locale-context";
import { EmailOverviewTab } from "@/components/admin/email/email-overview-tab";
import { EmailComposerTab } from "@/components/admin/email/email-composer-tab";
import { EmailCampaignsTab } from "@/components/admin/email/email-campaigns-tab";
import { EmailTemplatesTab } from "@/components/admin/email/email-templates-tab";
import { EmailInboxTab } from "@/components/admin/email/email-inbox-tab";
import { EmailLogsTab } from "@/components/admin/email/email-logs-tab";
import { EmailSettingsTab } from "@/components/admin/email/email-settings-tab";
import type {
  ComposerDraft,
  EmailCampaignRow,
  EmailOverviewPayload,
  EmailSuppressionRow,
  EmailTemplateRow,
  EmailWorkspaceTab,
} from "@/components/admin/email/types";

const INITIAL_DRAFT: ComposerDraft = {
  to: "",
  cc: "",
  bcc: "",
  replyTo: "",
  subject: "",
  preheader: "",
  htmlBody: "",
  textBody: "",
  direction: "rtl",
  templateId: null,
};

export default function AdminEmailCenterPage() {
  const { isFa } = useAdminLocale();
  const [activeTab, setActiveTab] = useState<EmailWorkspaceTab>("overview");
  const [overview, setOverview] = useState<EmailOverviewPayload | null>(null);
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaignRow[]>([]);
  const [suppressions, setSuppressions] = useState<EmailSuppressionRow[]>([]);
  const [draft, setDraft] = useState<ComposerDraft>(INITIAL_DRAFT);
  const [logsRefreshSignal, setLogsRefreshSignal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [ov, tplRes, campRes, supRes] = await Promise.all([
        adminFetch<EmailOverviewPayload>("/api/admin/email/overview"),
        adminFetch<{ items: EmailTemplateRow[] }>("/api/admin/email/templates"),
        adminFetch<{ items: EmailCampaignRow[] }>("/api/admin/email/campaigns"),
        adminFetch<{ items: EmailSuppressionRow[] }>("/api/admin/email/suppression"),
      ]);
      setError(null);
      setOverview(ov);
      setTemplates(tplRes.items ?? []);
      setCampaigns(campRes.items ?? []);
      setSuppressions(supRes.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Email Center");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const [ov, tplRes, campRes, supRes] = await Promise.all([
          adminFetch<EmailOverviewPayload>("/api/admin/email/overview"),
          adminFetch<{ items: EmailTemplateRow[] }>("/api/admin/email/templates"),
          adminFetch<{ items: EmailCampaignRow[] }>("/api/admin/email/campaigns"),
          adminFetch<{ items: EmailSuppressionRow[] }>("/api/admin/email/suppression"),
        ]);
        if (cancelled) return;
        setError(null);
        setOverview(ov);
        setTemplates(tplRes.items ?? []);
        setCampaigns(campRes.items ?? []);
        setSuppressions(supRes.items ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Email Center");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleUseTemplateInComposer(tpl: EmailTemplateRow) {
    setDraft({
      ...draft,
      templateId: tpl.id,
      subject: tpl.subject,
      preheader: tpl.preheader ?? "",
      htmlBody: tpl.html_body,
      textBody: tpl.text_body ?? "",
      direction: tpl.locale === "en" ? "ltr" : "rtl",
    });
    setActiveTab("compose");
  }

  async function handleRefreshAfterDispatch() {
    setLogsRefreshSignal((n) => n + 1);
    await loadAll();
  }

  const tabs: Array<{
    id: EmailWorkspaceTab;
    labelFa: string;
    labelEn: string;
    icon: typeof LayoutGrid;
    count?: number;
  }> = [
    { id: "overview", labelFa: "نمای کلی", labelEn: "Overview", icon: LayoutGrid },
    { id: "compose", labelFa: "ارسال ایمیل", labelEn: "Compose", icon: Send },
    {
      id: "campaigns",
      labelFa: "کمپین‌ها",
      labelEn: "Campaigns",
      icon: Megaphone,
      count: overview?.stats.campaignsCount,
    },
    {
      id: "templates",
      labelFa: "قالب‌ها",
      labelEn: "Templates",
      icon: FileCode2,
      count: overview?.stats.templatesCount,
    },
    {
      id: "inbox",
      labelFa: "صندوق پاسخ",
      labelEn: "Inbox & Reply",
      icon: Inbox,
      count: overview?.stats.unreadMessagesCount,
    },
    {
      id: "logs",
      labelFa: "گزارش ارسال‌ها",
      labelEn: "Delivery Logs",
      icon: Activity,
      count: overview?.stats.totalLogged,
    },
    { id: "settings", labelFa: "تنظیمات SMTP و مسدودها", labelEn: "SMTP & Suppression", icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header — Single clear primary action, zero pill clutter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-(--color-text-primary)">
            {isFa ? "مرکز مدیریت ایمیل" : "Email Operations Center"}
          </h1>
          <p className="mt-1 text-sm text-(--color-text-tertiary)">
            {isFa
              ? "ارسال مستقیم، کمپین‌های خبرنامه، قالب‌های HTML، پاسخ به پیام‌ها، گزارش تحویل و تنظیمات SMTP"
              : "Direct dispatches, subscriber campaigns, reusable templates, inbox replies, delivery logs, and SMTP controls"}
          </p>
        </div>

        {activeTab !== "compose" && (
          <button
            type="button"
            onClick={() => setActiveTab("compose")}
            className="flex h-10 items-center gap-2 rounded-lg bg-(--color-accent-purple) px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
          >
            <Send className="h-4 w-4" />
            <span>{isFa ? "ارسال ایمیل جدید" : "Compose Email"}</span>
          </button>
        )}
      </div>

      {/* Segmented Workspace Tabs */}
      <div
        role="tablist"
        aria-label={isFa ? "بخش‌های مرکز ایمیل" : "Email Center sections"}
        className="flex items-center gap-1 overflow-x-auto border-b border-(--color-border-subtle) pb-px"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`flex h-10 items-center gap-2 border-b-2 px-3.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? "border-(--color-accent-purple) text-(--color-text-primary)"
                  : "border-transparent text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "text-(--color-accent-purple)" : ""}`} />
              <span>{isFa ? tab.labelFa : tab.labelEn}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading || !overview ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)">
          <div className="flex items-center gap-2.5 text-xs text-(--color-text-tertiary)">
            <Loader2 className="h-4 w-4 animate-spin text-(--color-accent-purple)" />
            <span>{isFa ? "در حال بارگذاری مرکز ایمیل…" : "Loading Email Operations Center…"}</span>
          </div>
        </div>
      ) : (
        <div>
          {activeTab === "overview" && (
            <EmailOverviewTab isFa={isFa} data={overview} onNavigate={setActiveTab} />
          )}

          {activeTab === "compose" && (
            <EmailComposerTab
              isFa={isFa}
              settings={overview.settings}
              templates={templates}
              recentArticles={overview.recentArticles}
              draft={draft}
              onDraftChange={setDraft}
              onSentSuccess={() => void handleRefreshAfterDispatch()}
            />
          )}

          {activeTab === "campaigns" && (
            <EmailCampaignsTab
              isFa={isFa}
              stats={overview.stats}
              settings={overview.settings}
              campaigns={campaigns}
              templates={templates}
              onRefresh={handleRefreshAfterDispatch}
            />
          )}

          {activeTab === "templates" && (
            <EmailTemplatesTab
              isFa={isFa}
              settings={overview.settings}
              templates={templates}
              onRefresh={loadAll}
              onUseInComposer={handleUseTemplateInComposer}
            />
          )}

          {activeTab === "inbox" && (
            <EmailInboxTab isFa={isFa} onReplySent={handleRefreshAfterDispatch} />
          )}

          {activeTab === "logs" && (
            <EmailLogsTab
              isFa={isFa}
              refreshSignal={logsRefreshSignal}
              onRetried={handleRefreshAfterDispatch}
            />
          )}

          {activeTab === "settings" && (
            <EmailSettingsTab
              isFa={isFa}
              settings={overview.settings}
              templates={templates}
              suppressions={suppressions}
              onRefresh={handleRefreshAfterDispatch}
            />
          )}
        </div>
      )}
    </div>
  );
}
