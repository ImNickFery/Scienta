import type {
  EmailAudienceSegment,
  EmailCampaignStatus,
  EmailLocaleMode,
  EmailLogKind,
  EmailLogStatus,
  EmailSettingsPublic,
  EmailTemplateCategory,
  SuppressionReason,
} from "@/lib/email-core";

export type EmailWorkspaceTab =
  | "overview"
  | "compose"
  | "campaigns"
  | "templates"
  | "inbox"
  | "logs"
  | "settings";

export interface EmailOverviewStats {
  sent: number;
  sandbox: number;
  failed: number;
  suppressed: number;
  totalDelivered: number;
  totalLogged: number;
  deliveryRate: number;
  activeSubscribersAll: number;
  activeSubscribersFa: number;
  activeSubscribersEn: number;
  unsubscribedCount: number;
  suppressionsCount: number;
  templatesCount: number;
  campaignsCount: number;
  unreadMessagesCount: number;
}

export interface EmailRecentArticle {
  id: string;
  slug_fa: string | null;
  title_fa: string | null;
  excerpt_fa: string | null;
  slug_en: string | null;
  title_en: string | null;
  excerpt_en: string | null;
}

export interface EmailLogRow {
  id: string;
  campaign_id?: string | null;
  template_id?: string | null;
  contact_message_id?: string | null;
  kind: EmailLogKind | string;
  recipient_email: string;
  cc_json?: string | null;
  bcc_json?: string | null;
  reply_to?: string | null;
  from_email?: string;
  from_name?: string;
  subject: string;
  html_body?: string;
  text_body?: string | null;
  provider_mode: string;
  status: EmailLogStatus | string;
  provider_message_id?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface EmailOverviewPayload {
  settings: EmailSettingsPublic;
  stats: EmailOverviewStats;
  recentLogs: EmailLogRow[];
  recentArticles: EmailRecentArticle[];
}

export interface EmailTemplateRow {
  id: string;
  slug: string;
  name: string;
  category: EmailTemplateCategory;
  locale: EmailLocaleMode;
  subject: string;
  preheader: string | null;
  html_body: string;
  text_body: string | null;
  variables: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaignRow {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  template_id: string | null;
  audience_segment: EmailAudienceSegment;
  custom_recipients: string[];
  html_body: string;
  text_body: string | null;
  direction: "rtl" | "ltr";
  status: EmailCampaignStatus;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  suppressed_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailSuppressionRow {
  id: string;
  email: string;
  reason: SuppressionReason;
  note: string | null;
  created_at: string;
}

export interface ContactInboxRow {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: "new" | "read" | "archived";
  ip_address: string | null;
  created_at: string;
}

export interface ComposerDraft {
  to: string;
  cc: string;
  bcc: string;
  replyTo: string;
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;
  direction: "rtl" | "ltr";
  templateId: string | null;
}

export function formatEmailDate(raw: string | null | undefined, isFa: boolean): string {
  if (!raw) return "—";
  const parsed = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString(isFa ? "fa-IR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusColorClass(status: string): string {
  switch (status) {
    case "sent":
      return "text-emerald-400";
    case "sandbox":
      return "text-sky-400";
    case "sending":
    case "partial":
      return "text-amber-400";
    case "failed":
      return "text-rose-400";
    case "suppressed":
      return "text-amber-300";
    default:
      return "text-(--color-text-tertiary)";
  }
}

export function statusLabel(status: string, isFa: boolean): string {
  const map: Record<string, { fa: string; en: string }> = {
    sent: { fa: "ارسال شد", en: "Delivered" },
    sandbox: { fa: "آزمایشی (Sandbox)", en: "Sandbox" },
    failed: { fa: "ناموفق", en: "Failed" },
    suppressed: { fa: "مسدودشده", en: "Suppressed" },
    draft: { fa: "پیش‌نویس", en: "Draft" },
    sending: { fa: "در حال ارسال", en: "Sending" },
    partial: { fa: "ارسال ناقص", en: "Partial" },
  };
  const entry = map[status];
  return entry ? (isFa ? entry.fa : entry.en) : status;
}

export function kindLabel(kind: string, isFa: boolean): string {
  const map: Record<string, { fa: string; en: string }> = {
    direct: { fa: "مستقیم", en: "Direct" },
    campaign: { fa: "کمپین", en: "Campaign" },
    test: { fa: "تست", en: "Test" },
    reply: { fa: "پاسخ تماس", en: "Inbox Reply" },
    automation: { fa: "خودکار", en: "Automation" },
  };
  const entry = map[kind];
  return entry ? (isFa ? entry.fa : entry.en) : kind;
}

export function buildPreviewSrcDoc(params: {
  htmlBody: string;
  direction: "rtl" | "ltr";
  fromName: string;
  signatureHtml?: string;
  variables?: Record<string, string>;
}): string {
  const dir = params.direction;
  const align = dir === "rtl" ? "right" : "left";
  const vars: Record<string, string> = {
    site_name: params.fromName || "Scienta",
    site_url: typeof window !== "undefined" ? window.location.origin : "https://scienta.org",
    recipient_email: "reader@example.org",
    recipient_name: dir === "rtl" ? "پژوهشگر گرامی" : "Dr. Reader",
    date: new Date().toISOString().slice(0, 10),
    issue_title: dir === "rtl" ? "شماره ۴۲ · کیهان‌شناسی و هوش مصنوعی" : "Issue #42 · Cosmology & AI",
    article_title: dir === "rtl" ? "هندسه افق رویداد در سیاه‌چاله‌ها" : "Geometry of Black Hole Event Horizons",
    article_excerpt:
      dir === "rtl"
        ? "بررسی دقیق متریک شوارتزشیلد و کر در نسبیت عام با نمایش‌های ریاضی."
        : "An exact exploration of Schwarzschild and Kerr metrics in general relativity.",
    article_url: "https://scienta.org/articles/geometry-of-black-holes",
    original_subject: dir === "rtl" ? "همکاری تحریریه" : "Editorial collaboration",
    reply_message: dir === "rtl" ? "پاسخ شما در این بخش قرار می‌گیرد." : "Your editorial reply appears here.",
    ...(params.variables ?? {}),
  };

  const escapeText = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Strip script tags & inline event handlers defensively in client preview too (iframe is also sandbox="")
  const interpolated = params.htmlBody
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, k: string) => escapeText(vars[k] ?? `{{${k}}}`));

  const safeBrand = escapeText(params.fromName || "Scienta");
  const safeSig = (params.signatureHtml || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${dir === "rtl" ? "fa" : "en"}">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px 14px; background: #0b0d14; color: #e2e8f0; font-family: Vazirmatn, -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, sans-serif; }
    a { color: #a78bfa; }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#131722;border:1px solid #242b3d;border-radius:10px;">
          <tr>
            <td align="${align}" style="padding:18px 24px;border-bottom:1px solid #242b3d;color:#f8fafc;font-weight:700;font-size:15px;">
              ${safeBrand}
            </td>
          </tr>
          <tr>
            <td align="${align}" dir="${dir}" style="padding:24px;font-size:14px;line-height:1.8;color:#e2e8f0;">
              ${interpolated}
            </td>
          </tr>
          <tr>
            <td align="${align}" dir="${dir}" style="padding:14px 24px;border-top:1px solid #242b3d;background:#0f131d;border-radius:0 0 10px 10px;font-size:12px;color:#94a3b8;">
              ${safeSig || safeBrand}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
