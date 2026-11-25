import crypto from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

export type EmailDeliveryMode = "sandbox" | "smtp";
export type EmailTemplateCategory = "newsletter" | "transactional" | "announcement" | "reply" | "system";
export type EmailLocaleMode = "fa" | "en" | "bilingual";
export type EmailAudienceSegment = "all" | "fa" | "en" | "custom";
export type EmailLogKind = "direct" | "campaign" | "test" | "reply" | "automation";
export type EmailLogStatus = "sent" | "sandbox" | "failed" | "suppressed";
export type EmailCampaignStatus = "draft" | "sending" | "sent" | "partial" | "failed";
export type SuppressionReason = "bounce" | "complaint" | "unsubscribed" | "manual";

export interface EmailSettingsStored {
  mode: EmailDeliveryMode;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPasswordEncrypted: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  signatureHtml: string;
  batchSize: number;
  batchDelayMs: number;
  autoWelcomeSubscriber: boolean;
  autoReplyContact: boolean;
  welcomeTemplateSlug: string;
  contactReplyTemplateSlug: string;
}

export interface EmailSettingsPublic {
  mode: EmailDeliveryMode;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  hasPassword: boolean;
  envOverrides: {
    host: boolean;
    user: boolean;
    pass: boolean;
    fromEmail: boolean;
  };
  fromName: string;
  fromEmail: string;
  replyTo: string;
  signatureHtml: string;
  batchSize: number;
  batchDelayMs: number;
  autoWelcomeSubscriber: boolean;
  autoReplyContact: boolean;
  welcomeTemplateSlug: string;
  contactReplyTemplateSlug: string;
}

export const EMAIL_SETTINGS_KEY = "email_settings";

export const DEFAULT_EMAIL_SETTINGS: EmailSettingsStored = {
  mode: "sandbox",
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPasswordEncrypted: "",
  fromName: "Scienta Editorial",
  fromEmail: "editorial@scienta.org",
  replyTo: "editorial@scienta.org",
  signatureHtml:
    '<p style="margin:0;color:#64748b;font-size:12px;">Scienta Scientific Journal · Independent Research &amp; Science Communication</p>',
  batchSize: 25,
  batchDelayMs: 250,
  autoWelcomeSubscriber: false,
  autoReplyContact: false,
  welcomeTemplateSlug: "welcome-subscriber",
  contactReplyTemplateSlug: "contact-auto-receipt",
};

export interface SmtpProviderPreset {
  id: string;
  labelEn: string;
  labelFa: string;
  host: string;
  port: number;
  secure: boolean;
  hintEn: string;
  hintFa: string;
}

export const SMTP_PROVIDER_PRESETS: SmtpProviderPreset[] = [
  {
    id: "cpanel",
    labelEn: "cPanel / Hosting Mail",
    labelFa: "ایمیل هاست (cPanel)",
    host: "mail.yourdomain.com",
    port: 465,
    secure: true,
    hintEn: "Use your domain mail server (port 465 SSL/TLS) and full mailbox address as username.",
    hintFa: "آدرس سرور ایمیل دامنه (پورت ۴۶۵ SSL) و ایمیل کامل را به‌عنوان نام کاربری وارد کنید.",
  },
  {
    id: "gmail",
    labelEn: "Gmail / Google Workspace",
    labelFa: "جیمیل / گوگل ورک‌اسپیس",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    hintEn: "Enable 2-Step Verification and generate a 16-character App Password.",
    hintFa: "تأیید دومرحله‌ای را فعال کنید و یک App Password ۱۶ کاراکتری بسازید.",
  },
  {
    id: "resend",
    labelEn: "Resend SMTP",
    labelFa: "Resend SMTP",
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    hintEn: "Username is always 'resend' and password is your Resend API key.",
    hintFa: "نام کاربری همیشه resend و رمز عبور کلید API شما در Resend است.",
  },
  {
    id: "mailgun",
    labelEn: "Mailgun SMTP",
    labelFa: "Mailgun SMTP",
    host: "smtp.mailgun.org",
    port: 587,
    secure: false,
    hintEn: "Use STARTTLS on port 587 with your Mailgun domain SMTP credentials.",
    hintFa: "پورت ۵۸۷ با STARTTLS و اطلاعات SMTP دامنه در Mailgun.",
  },
  {
    id: "postmark",
    labelEn: "Postmark SMTP",
    labelFa: "Postmark SMTP",
    host: "smtp.postmarkapp.com",
    port: 587,
    secure: false,
    hintEn: "Use your Postmark Server API Token for both username and password.",
    hintFa: "توکن سرور Postmark را به‌عنوان نام کاربری و رمز عبور وارد کنید.",
  },
  {
    id: "custom",
    labelEn: "Custom SMTP Server",
    labelFa: "سرور SMTP سفارشی",
    host: "",
    port: 587,
    secure: false,
    hintEn: "Configure any RFC-compliant SMTP relay (STARTTLS on 587 or SSL/TLS on 465).",
    hintFa: "اتصال به هر سرور SMTP استاندارد با پورت ۵۸۷ یا ۴۶۵.",
  },
];

export const EMAIL_REGEX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function isValidEmailAddress(raw: string): boolean {
  const email = raw.trim();
  if (!email || email.length > 190) return false;
  if (/[\r\n\0]/.test(email)) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Parses comma, semicolon, or newline separated email lists into deduplicated
 * normalized lowercase emails plus any invalid entries for clear validation errors.
 */
export function parseRecipientList(input: string | string[] | null | undefined): {
  valid: string[];
  invalid: string[];
} {
  if (!input) return { valid: [], invalid: [] };
  const rawTokens = Array.isArray(input)
    ? input
    : input.split(/[\n,;]+/g);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of rawTokens) {
    const cleaned = token.trim();
    if (!cleaned) continue;
    // Support "Display Name <email@domain.com>" format cleanly
    const angleMatch = cleaned.match(/<([^<>]+)>$/);
    const candidate = (angleMatch ? angleMatch[1] : cleaned).trim().toLowerCase();
    if (isValidEmailAddress(candidate)) {
      if (!seen.has(candidate)) {
        seen.add(candidate);
        valid.push(candidate);
      }
    } else {
      invalid.push(cleaned);
    }
  }
  return { valid, invalid };
}

/**
 * Prevents SMTP/MIME header injection (CRLF or NUL bytes in Subject/From/Reply-To).
 */
export function assertNoHeaderInjection(value: string, fieldName: string): string {
  if (/[\r\n\0]/.test(value)) {
    throw new Error(`Invalid control characters in ${fieldName}`);
  }
  return value.trim();
}

export function stripHeaderControlChars(value: string): string {
  return value.replace(/[\r\n\0]+/g, " ").trim();
}

/**
 * Validates SMTP host to block cloud metadata addresses and malformed hostnames.
 */
export function validateSmtpHost(host: string): { ok: true; host: string } | { ok: false; error: string } {
  const normalized = host.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, error: "SMTP host is required." };
  }
  if (normalized.length > 253 || /[\s/\\@:?#]/.test(normalized)) {
    return { ok: false, error: "SMTP host must be a valid hostname or IP address without protocol or spaces." };
  }

  // Block cloud metadata endpoints & unspecified addresses
  const blockedHosts = new Set([
    "0.0.0.0",
    "::",
    "169.254.169.254",
    "metadata.google.internal",
    "metadata",
    "instance-data",
  ]);
  if (
    blockedHosts.has(normalized) ||
    normalized.startsWith("169.254.") ||
    normalized.startsWith("fd00:ec2:")
  ) {
    return { ok: false, error: "This SMTP host address is restricted for security reasons." };
  }

  const isValidHostname = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(
    normalized
  );
  if (!isValidHostname) {
    return { ok: false, error: "SMTP host contains invalid characters." };
  }
  return { ok: true, host: normalized };
}

const EMAIL_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "b",
    "blockquote",
    "br",
    "caption",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "small",
    "span",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel", "style", "title"],
    img: ["src", "alt", "width", "height", "style"],
    table: ["width", "cellpadding", "cellspacing", "border", "align", "role", "style"],
    td: ["width", "height", "align", "valign", "colspan", "rowspan", "style"],
    th: ["width", "height", "align", "valign", "colspan", "rowspan", "style"],
    "*": ["style", "dir", "align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)$/i],
      "background-color": [
        /^#[0-9a-f]{3,8}$/i,
        /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)$/i,
        /^transparent$/i,
      ],
      background: [/^#[0-9a-f]{3,8}$/i],
      "font-size": [/^\d+(?:\.\d+)?(px|rem|em|%)$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/i],
      "font-family": [/^[a-z0-9\s,'"-]+$/i],
      "line-height": [/^\d+(?:\.\d+)?(px|rem|em|%)?$/],
      "letter-spacing": [/^-?\d+(?:\.\d+)?(px|em)$/],
      "text-align": [/^(left|right|center|justify|start|end)$/i],
      "text-decoration": [/^(none|underline)$/i],
      padding: [/^\d+(px|em|rem|%)(?:\s+\d+(px|em|rem|%)){0,3}$/],
      "padding-top": [/^\d+(px|em|rem|%)$/],
      "padding-right": [/^\d+(px|em|rem|%)$/],
      "padding-bottom": [/^\d+(px|em|rem|%)$/],
      "padding-left": [/^\d+(px|em|rem|%)$/],
      margin: [/^(?:\d+(px|em|rem|%)|auto)(?:\s+(?:\d+(px|em|rem|%)|auto)){0,3}$/],
      "margin-top": [/^\d+(px|em|rem|%)$/],
      "margin-bottom": [/^\d+(px|em|rem|%)$/],
      border: [/^\d+px\s+(solid|dashed|dotted)\s+#[0-9a-f]{3,8}$/i, /^none$/i],
      "border-top": [/^\d+px\s+(solid|dashed|dotted)\s+#[0-9a-f]{3,8}$/i],
      "border-bottom": [/^\d+px\s+(solid|dashed|dotted)\s+#[0-9a-f]{3,8}$/i],
      "border-radius": [/^\d+(px|%)$/],
      width: [/^\d+(px|%)$/, /^auto$/i],
      "max-width": [/^\d+(px|%)$/],
      display: [/^(block|inline-block|inline|table)$/i],
    },
  },
  disallowedTagsMode: "discard",
};

/**
 * Sanitizes HTML email content to strip scripts, event handlers, iframes, and
 * unsafe URL schemes while keeping safe email-client layout styles.
 */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html ?? "", EMAIL_SANITIZE_OPTIONS).trim();
}

export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Extracts unique `{{variable_name}}` placeholders from subject/body templates.
 */
export function extractTemplateVariables(source: string): string[] {
  const matches = source.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g);
  const found = new Set<string>();
  for (const m of matches) {
    if (m[1]) found.add(m[1]);
  }
  return Array.from(found);
}

/**
 * Renders `{{variable}}` tokens inside a template string.
 * When `escapeForHtml` is true, variable values are HTML-escaped so untrusted
 * recipient names or subjects can never inject HTML/script markup.
 */
export function renderEmailTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>,
  options: { escapeForHtml?: boolean } = {}
): string {
  const { escapeForHtml = true } = options;
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_full, key: string) => {
    const raw = variables[key];
    if (raw === undefined || raw === null) return "";
    const str = String(raw);
    return escapeForHtml ? escapeHtmlText(str) : stripHeaderControlChars(str);
  });
}

/**
 * Converts HTML email content into a readable plain-text fallback body.
 */
export function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    .replace(/<[^>]+>/g, "");

  return withBreaks
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Wraps sanitized inner HTML inside Scienta's clean, responsive email shell
 * supporting both RTL (Persian) and LTR (English) readers.
 */
export function wrapEmailLayout(params: {
  bodyHtml: string;
  preheader?: string;
  direction?: "rtl" | "ltr";
  fromName?: string;
  signatureHtml?: string;
  unsubscribeUrl?: string;
  siteUrl?: string;
}): string {
  const dir = params.direction ?? "rtl";
  const align = dir === "rtl" ? "right" : "left";
  const fontFamily =
    dir === "rtl"
      ? "Vazirmatn, Tahoma, Arial, sans-serif"
      : "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  const safePreheader = params.preheader ? escapeHtmlText(params.preheader) : "";
  const safeBrand = escapeHtmlText(params.fromName || "Scienta");
  const safeBody = sanitizeEmailHtml(params.bodyHtml);
  const safeSignature = params.signatureHtml ? sanitizeEmailHtml(params.signatureHtml) : "";
  const safeUnsub =
    params.unsubscribeUrl && /^https?:\/\//i.test(params.unsubscribeUrl)
      ? escapeHtmlText(params.unsubscribeUrl)
      : "";
  const safeSiteUrl =
    params.siteUrl && /^https?:\/\//i.test(params.siteUrl) ? escapeHtmlText(params.siteUrl) : "";

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${dir === "rtl" ? "fa" : "en"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#0b0d14;color:#e2e8f0;font-family:${fontFamily};">
  ${safePreheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b0d14;padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#131722;border:1px solid #242b3d;border-radius:12px;">
          <tr>
            <td align="${align}" style="padding:22px 28px;border-bottom:1px solid #242b3d;">
              ${
                safeSiteUrl
                  ? `<a href="${safeSiteUrl}" style="color:#f8fafc;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:-0.01em;">${safeBrand}</a>`
                  : `<span style="color:#f8fafc;font-size:16px;font-weight:700;letter-spacing:-0.01em;">${safeBrand}</span>`
              }
            </td>
          </tr>
          <tr>
            <td align="${align}" dir="${dir}" style="padding:28px;color:#e2e8f0;font-size:15px;line-height:1.8;">
              <!-- SCIENTA_EMAIL_BODY_START -->${safeBody}<!-- SCIENTA_EMAIL_BODY_END -->
            </td>
          </tr>
          <tr>
            <td align="${align}" dir="${dir}" style="padding:18px 28px;border-top:1px solid #242b3d;background-color:#0f131d;border-radius:0 0 12px 12px;">
              ${safeSignature || `<p style="margin:0;color:#94a3b8;font-size:12px;">${safeBrand}</p>`}
              ${
                safeUnsub
                  ? `<p style="margin:10px 0 0;color:#64748b;font-size:11px;"><a href="${safeUnsub}" style="color:#94a3b8;text-decoration:underline;">${
                      dir === "rtl" ? "لغو عضویت از خبرنامه" : "Unsubscribe from newsletter"
                    }</a></p>`
                  : ""
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function extractEmailBodyFromLayout(wrappedHtml: string): {
  innerHtml: string;
  direction: "rtl" | "ltr";
} {
  const dirMatch = wrappedHtml.match(/<html[^>]*dir="(rtl|ltr)"/i);
  const direction: "rtl" | "ltr" = dirMatch?.[1]?.toLowerCase() === "ltr" ? "ltr" : "rtl";
  const bodyMatch = wrappedHtml.match(
    /<!-- SCIENTA_EMAIL_BODY_START -->([\s\S]*?)<!-- SCIENTA_EMAIL_BODY_END -->/
  );
  return {
    innerHtml: bodyMatch ? bodyMatch[1] : wrappedHtml,
    direction,
  };
}

// ============================================================================
// AES-256-GCM Encryption for stored SMTP passwords
// ============================================================================

function deriveEncryptionKey(secretMaterial?: string): Buffer {
  const source =
    secretMaterial ||
    process.env.SMTP_ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "scienta-local-ephemeral-email-key-v1";
  return crypto.createHash("sha256").update(source).digest();
}

export function encryptEmailSecret(plaintext: string, secretMaterial?: string): string {
  if (!plaintext) return "";
  const key = deriveEncryptionKey(secretMaterial);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptEmailSecret(ciphertext: string, secretMaterial?: string): string {
  if (!ciphertext) return "";
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return "";
  try {
    const key = deriveEncryptionKey(secretMaterial);
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const data = Buffer.from(parts[3], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function computeEmailStats(counts: {
  sent: number;
  sandbox: number;
  failed: number;
  suppressed: number;
}) {
  const totalAttempts = counts.sent + counts.sandbox + counts.failed;
  const successful = counts.sent + counts.sandbox;
  const deliveryRate = totalAttempts > 0 ? Math.round((successful / totalAttempts) * 1000) / 10 : 100;
  return {
    totalDelivered: successful,
    totalLogged: totalAttempts + counts.suppressed,
    deliveryRate,
  };
}

// ============================================================================
// Validation Schemas
// ============================================================================

export const emailSettingsUpdateSchema = z.object({
  mode: z.enum(["sandbox", "smtp"]),
  smtpHost: z.string().trim().max(253).default(""),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().trim().max(190).default(""),
  smtpPassword: z.string().max(512).optional(),
  clearPassword: z.boolean().optional(),
  fromName: z.string().trim().min(1).max(120),
  fromEmail: z.string().trim().email().max(190),
  replyTo: z.string().trim().max(190).optional().default(""),
  signatureHtml: z.string().max(4000).optional().default(""),
  batchSize: z.coerce.number().int().min(1).max(100).default(25),
  batchDelayMs: z.coerce.number().int().min(0).max(5000).default(250),
  autoWelcomeSubscriber: z.boolean().default(false),
  autoReplyContact: z.boolean().default(false),
  welcomeTemplateSlug: z.string().trim().max(120).optional().default("welcome-subscriber"),
  contactReplyTemplateSlug: z.string().trim().max(120).optional().default("contact-auto-receipt"),
});

export const emailTemplateCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  category: z.enum(["newsletter", "transactional", "announcement", "reply", "system"]).default("newsletter"),
  locale: z.enum(["fa", "en", "bilingual"]).default("fa"),
  subject: z.string().trim().min(1).max(255),
  preheader: z.string().trim().max(255).optional().default(""),
  htmlBody: z.string().min(1).max(100000),
  textBody: z.string().max(50000).optional().default(""),
});

export const emailDirectSendSchema = z.object({
  to: z.union([z.string().min(3), z.array(z.string().email()).min(1).max(50)]),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  replyTo: z.string().trim().max(190).optional(),
  subject: z.string().trim().min(1).max(255),
  preheader: z.string().trim().max(255).optional().default(""),
  htmlBody: z.string().min(1).max(100000),
  textBody: z.string().max(50000).optional(),
  direction: z.enum(["rtl", "ltr"]).default("rtl"),
  templateId: z.string().uuid().optional().nullable(),
  variables: z.record(z.string(), z.string()).optional(),
});

export const emailCampaignCreateSchema = z.object({
  name: z.string().trim().min(2).max(180),
  subject: z.string().trim().min(1).max(255),
  preheader: z.string().trim().max(255).optional().default(""),
  templateId: z.string().uuid().optional().nullable(),
  audienceSegment: z.enum(["all", "fa", "en", "custom"]).default("all"),
  customRecipients: z.string().max(20000).optional().default(""),
  htmlBody: z.string().min(1).max(100000),
  textBody: z.string().max(50000).optional().default(""),
  direction: z.enum(["rtl", "ltr"]).default("rtl"),
});

export const emailSuppressionCreateSchema = z.object({
  email: z.string().trim().email().max(190),
  reason: z.enum(["bounce", "complaint", "unsubscribed", "manual"]).default("manual"),
  note: z.string().trim().max(300).optional().default(""),
});

export interface SeedEmailTemplate {
  slug: string;
  name: string;
  category: EmailTemplateCategory;
  locale: EmailLocaleMode;
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;
}

export const DEFAULT_EMAIL_TEMPLATES: SeedEmailTemplate[] = [
  {
    slug: "welcome-subscriber",
    name: "خوش‌آمدگویی خبرنامه (فارسی) / Welcome Subscriber",
    category: "transactional",
    locale: "fa",
    subject: "به خبرنامه علمی ساینتا خوش آمدید",
    preheader: "گزیده‌ای از عمیق‌ترین مقالات فیزیک، فضا، ریاضیات و هوش مصنوعی در صندوق ایمیل شما.",
    htmlBody: `<h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#f8fafc;">به جامعه علمی ساینتا خوش آمدید</h1>
<p style="margin:0 0 14px;color:#cbd5e1;">از عضویت شما در خبرنامه علمی <strong>{{site_name}}</strong> سپاسگزاریم. از این پس مهم‌ترین پژوهش‌ها، تحلیل‌های علمی و مقالات تازه را به‌صورت منظم دریافت خواهید کرد.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
  <tr>
    <td style="background-color:#7c3aed;border-radius:8px;padding:12px 22px;">
      <a href="{{site_url}}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">مشاهده تازه‌ترین مقالات</a>
    </td>
  </tr>
</table>
<p style="margin:0;color:#94a3b8;font-size:13px;">تاریخ عضویت: {{date}}</p>`,
    textBody: "به خبرنامه علمی ساینتا خوش آمدید.\nاز عضویت شما سپاسگزاریم. برای مطالعه تازه‌ترین مقالات به {{site_url}} سر بزنید.",
  },
  {
    slug: "weekly-science-digest",
    name: "خبرنامه هفتگی علمی / Weekly Science Digest",
    category: "newsletter",
    locale: "fa",
    subject: "گزیده علمی هفته در ساینتا — {{issue_title}}",
    preheader: "مروری بر برگزیده‌ترین مقالات تحریریه ساینتا در هفته گذشته.",
    htmlBody: `<p style="margin:0 0 8px;color:#a78bfa;font-size:12px;font-weight:600;">شماره ویژه خبرنامه · {{date}}</p>
<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#f8fafc;">{{issue_title}}</h1>
<p style="margin:0 0 18px;color:#cbd5e1;">سلام! در این شماره از خبرنامه علمی <strong>{{site_name}}</strong>، تازه‌ترین تحلیل‌ها و مقاله‌های برگزیده تحریریه را برای شما گردآوری کرده‌ایم:</p>
<div style="padding:18px;background-color:#1a2030;border:1px solid #2b344b;border-radius:10px;margin:0 0 20px;">
  <h2 style="margin:0 0 8px;font-size:17px;color:#f8fafc;">{{article_title}}</h2>
  <p style="margin:0 0 14px;color:#cbd5e1;font-size:14px;">{{article_excerpt}}</p>
  <a href="{{article_url}}" style="color:#a78bfa;font-size:14px;font-weight:600;text-decoration:none;">مطالعه کامل مقاله ←</a>
</div>
<p style="margin:0;color:#94a3b8;font-size:13px;">اگر موضوع علمی خاصی برای بررسی پیشنهاد دارید، کافی است به همین ایمیل پاسخ دهید.</p>`,
    textBody: "خبرنامه علمی ساینتا — {{issue_title}}\n\n{{article_title}}\n{{article_excerpt}}\n{{article_url}}",
  },
  {
    slug: "new-article-announcement-en",
    name: "New Article Publication Alert (EN)",
    category: "announcement",
    locale: "en",
    subject: "New in Scienta: {{article_title}}",
    preheader: "A new peer-reviewed style deep dive is now live on Scienta.",
    htmlBody: `<p style="margin:0 0 8px;color:#a78bfa;font-size:12px;font-weight:600;">New Publication · {{date}}</p>
<h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#f8fafc;">{{article_title}}</h1>
<p style="margin:0 0 18px;color:#cbd5e1;">{{article_excerpt}}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
  <tr>
    <td style="background-color:#7c3aed;border-radius:8px;padding:11px 22px;">
      <a href="{{article_url}}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">Read Full Article</a>
    </td>
  </tr>
</table>`,
    textBody: "New in Scienta: {{article_title}}\n\n{{article_excerpt}}\nRead more: {{article_url}}",
  },
  {
    slug: "contact-auto-receipt",
    name: "تأییدیه دریافت پیام تماس / Contact Auto-Receipt",
    category: "transactional",
    locale: "fa",
    subject: "پیام شما به تحریریه ساینتا رسید",
    preheader: "تیم تحریریه ساینتا پیام شما را دریافت کرده و به‌زودی پاسخ می‌دهد.",
    htmlBody: `<h2 style="margin:0 0 14px;font-size:19px;font-weight:700;color:#f8fafc;">سلام {{recipient_name}} عزیز،</h2>
<p style="margin:0 0 14px;color:#cbd5e1;">پیام شما با موضوع <strong>«{{original_subject}}»</strong> با موفقیت در سامانه <strong>{{site_name}}</strong> ثبت شد.</p>
<p style="margin:0;color:#cbd5e1;">کارشناسان و تحریریه ما پیام شما را بررسی کرده و در کوتاه‌ترین زمان به همین نشانی ایمیل پاسخ خواهند داد.</p>`,
    textBody: "سلام {{recipient_name}} عزیز،\nپیام شما با موضوع «{{original_subject}}» دریافت شد و به‌زودی پاسخ داده می‌شود.",
  },
  {
    slug: "editorial-direct-reply",
    name: "پاسخ مستقیم تحریریه / Direct Editorial Reply",
    category: "reply",
    locale: "bilingual",
    subject: "پاسخ تحریریه ساینتا: {{original_subject}}",
    preheader: "پاسخ رسمی تیم تحریریه ساینتا به پیام شما.",
    htmlBody: `<p style="margin:0 0 14px;color:#f8fafc;font-weight:600;">سلام {{recipient_name}} عزیز،</p>
<p style="margin:0 0 16px;color:#cbd5e1;">در پاسخ به پیام شما درباره <strong>{{original_subject}}</strong>:</p>
<div style="padding:16px;background-color:#1a2030;border:1px solid #2b344b;border-radius:8px;margin:0 0 18px;color:#e2e8f0;">
  {{reply_message}}
</div>
<p style="margin:0;color:#94a3b8;font-size:13px;">با احترام،<br/>تیم تحریریه {{site_name}}</p>`,
    textBody: "سلام {{recipient_name}} عزیز،\n\nدر پاسخ به پیام شما درباره {{original_subject}}:\n{{reply_message}}\n\nبا احترام، تیم تحریریه {{site_name}}",
  },
];
