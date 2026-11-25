import nodemailer from "nodemailer";
import { v4 as uuid } from "uuid";
import { execute, getActiveDbEngine, query, queryOne } from "./db";
import {
  DEFAULT_EMAIL_SETTINGS,
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_SETTINGS_KEY,
  assertNoHeaderInjection,
  decryptEmailSecret,
  encryptEmailSecret,
  extractTemplateVariables,
  htmlToPlainText,
  isValidEmailAddress,
  parseRecipientList,
  renderEmailTemplate,
  sanitizeEmailHtml,
  validateSmtpHost,
  wrapEmailLayout,
  type EmailAudienceSegment,
  type EmailCampaignStatus,
  type EmailLogKind,
  type EmailLogStatus,
  type EmailSettingsPublic,
  type EmailSettingsStored,
} from "./email-core";

let emailSchemaReady = false;
let emailSchemaPromise: Promise<void> | null = null;

/**
 * Ensures email tables exist across both SQLite and MySQL (including already-seeded
 * production databases) and seeds default bilingual templates once.
 */
export async function ensureEmailSchema(): Promise<void> {
  if (emailSchemaReady) return;
  if (emailSchemaPromise) return emailSchemaPromise;

  emailSchemaPromise = (async () => {
    const engine = getActiveDbEngine();
    if (engine === "sqlite") {
      await execute(`
        CREATE TABLE IF NOT EXISTS email_templates (
          id TEXT NOT NULL PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'newsletter',
          locale TEXT NOT NULL DEFAULT 'fa',
          subject TEXT NOT NULL,
          preheader TEXT NULL,
          html_body TEXT NOT NULL,
          text_body TEXT NULL,
          variables_json TEXT NULL,
          is_system INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await execute(`
        CREATE TABLE IF NOT EXISTS email_campaigns (
          id TEXT NOT NULL PRIMARY KEY,
          name TEXT NOT NULL,
          subject TEXT NOT NULL,
          preheader TEXT NULL,
          template_id TEXT NULL,
          audience_segment TEXT NOT NULL DEFAULT 'all',
          custom_recipients_json TEXT NULL,
          html_body TEXT NOT NULL,
          text_body TEXT NULL,
          direction TEXT NOT NULL DEFAULT 'rtl',
          status TEXT NOT NULL DEFAULT 'draft',
          total_recipients INTEGER NOT NULL DEFAULT 0,
          sent_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0,
          suppressed_count INTEGER NOT NULL DEFAULT 0,
          sent_at TEXT NULL,
          created_by TEXT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await execute(`
        CREATE TABLE IF NOT EXISTS email_logs (
          id TEXT NOT NULL PRIMARY KEY,
          campaign_id TEXT NULL,
          template_id TEXT NULL,
          contact_message_id TEXT NULL,
          kind TEXT NOT NULL DEFAULT 'direct',
          recipient_email TEXT NOT NULL,
          cc_json TEXT NULL,
          bcc_json TEXT NULL,
          reply_to TEXT NULL,
          from_email TEXT NOT NULL,
          from_name TEXT NOT NULL,
          subject TEXT NOT NULL,
          html_body TEXT NOT NULL,
          text_body TEXT NULL,
          provider_mode TEXT NOT NULL DEFAULT 'sandbox',
          status TEXT NOT NULL DEFAULT 'sandbox',
          provider_message_id TEXT NULL,
          error_message TEXT NULL,
          sent_by TEXT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await execute(`
        CREATE TABLE IF NOT EXISTS email_suppressions (
          id TEXT NOT NULL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          reason TEXT NOT NULL DEFAULT 'manual',
          note TEXT NULL,
          created_by TEXT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    } else {
      await execute(`
        CREATE TABLE IF NOT EXISTS email_templates (
          id CHAR(36) NOT NULL PRIMARY KEY,
          slug VARCHAR(120) NOT NULL UNIQUE,
          name VARCHAR(160) NOT NULL,
          category VARCHAR(40) NOT NULL DEFAULT 'newsletter',
          locale VARCHAR(16) NOT NULL DEFAULT 'fa',
          subject VARCHAR(255) NOT NULL,
          preheader VARCHAR(255) NULL,
          html_body LONGTEXT NOT NULL,
          text_body LONGTEXT NULL,
          variables_json TEXT NULL,
          is_system TINYINT(1) NOT NULL DEFAULT 0,
          created_by CHAR(36) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await execute(`
        CREATE TABLE IF NOT EXISTS email_campaigns (
          id CHAR(36) NOT NULL PRIMARY KEY,
          name VARCHAR(180) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          preheader VARCHAR(255) NULL,
          template_id CHAR(36) NULL,
          audience_segment VARCHAR(32) NOT NULL DEFAULT 'all',
          custom_recipients_json LONGTEXT NULL,
          html_body LONGTEXT NOT NULL,
          text_body LONGTEXT NULL,
          direction VARCHAR(8) NOT NULL DEFAULT 'rtl',
          status VARCHAR(24) NOT NULL DEFAULT 'draft',
          total_recipients INT NOT NULL DEFAULT 0,
          sent_count INT NOT NULL DEFAULT 0,
          failed_count INT NOT NULL DEFAULT 0,
          suppressed_count INT NOT NULL DEFAULT 0,
          sent_at DATETIME NULL,
          created_by CHAR(36) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await execute(`
        CREATE TABLE IF NOT EXISTS email_logs (
          id CHAR(36) NOT NULL PRIMARY KEY,
          campaign_id CHAR(36) NULL,
          template_id CHAR(36) NULL,
          contact_message_id CHAR(36) NULL,
          kind VARCHAR(24) NOT NULL DEFAULT 'direct',
          recipient_email VARCHAR(190) NOT NULL,
          cc_json TEXT NULL,
          bcc_json TEXT NULL,
          reply_to VARCHAR(190) NULL,
          from_email VARCHAR(190) NOT NULL,
          from_name VARCHAR(120) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          html_body LONGTEXT NOT NULL,
          text_body LONGTEXT NULL,
          provider_mode VARCHAR(16) NOT NULL DEFAULT 'sandbox',
          status VARCHAR(24) NOT NULL DEFAULT 'sandbox',
          provider_message_id VARCHAR(255) NULL,
          error_message TEXT NULL,
          sent_by CHAR(36) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await execute(`
        CREATE TABLE IF NOT EXISTS email_suppressions (
          id CHAR(36) NOT NULL PRIMARY KEY,
          email VARCHAR(190) NOT NULL UNIQUE,
          reason VARCHAR(32) NOT NULL DEFAULT 'manual',
          note VARCHAR(300) NULL,
          created_by CHAR(36) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }

    // Seed default bilingual templates once if table is empty
    const countRow = await queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM email_templates`);
    if (!countRow || Number(countRow.count) === 0) {
      for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
        const vars = extractTemplateVariables(`${tpl.subject} ${tpl.htmlBody} ${tpl.textBody}`);
        await execute(
          `INSERT IGNORE INTO email_templates
           (id, slug, name, category, locale, subject, preheader, html_body, text_body, variables_json, is_system)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            uuid(),
            tpl.slug,
            tpl.name,
            tpl.category,
            tpl.locale,
            tpl.subject,
            tpl.preheader,
            tpl.htmlBody,
            tpl.textBody,
            JSON.stringify(vars),
          ]
        );
      }
    }

    emailSchemaReady = true;
  })().finally(() => {
    emailSchemaPromise = null;
  });

  return emailSchemaPromise;
}

// ============================================================================
// Settings Load & Save (with ENV overrides + AES-256-GCM at-rest encryption)
// ============================================================================

export interface ResolvedEmailSettings extends EmailSettingsStored {
  effectiveHost: string;
  effectivePort: number;
  effectiveSecure: boolean;
  effectiveUser: string;
  effectivePassword: string;
  effectiveFromName: string;
  effectiveFromEmail: string;
  envOverrides: {
    host: boolean;
    user: boolean;
    pass: boolean;
    fromEmail: boolean;
  };
}

export async function getResolvedEmailSettings(): Promise<ResolvedEmailSettings> {
  await ensureEmailSchema();
  const row = await queryOne<{ value: string | null }>(
    "SELECT `value` FROM settings WHERE `key` = ? LIMIT 1",
    [EMAIL_SETTINGS_KEY]
  );

  let stored: EmailSettingsStored = { ...DEFAULT_EMAIL_SETTINGS };
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value) as Partial<EmailSettingsStored>;
      stored = {
        ...DEFAULT_EMAIL_SETTINGS,
        ...parsed,
      };
    } catch {
      stored = { ...DEFAULT_EMAIL_SETTINGS };
    }
  }

  const envHost = process.env.SMTP_HOST?.trim() || "";
  const envPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : NaN;
  const envSecure = process.env.SMTP_SECURE?.trim();
  const envUser = process.env.SMTP_USER?.trim() || "";
  const envPass = process.env.SMTP_PASS?.trim() || "";
  const envFromEmail = process.env.SMTP_FROM_EMAIL?.trim() || "";
  const envFromName = process.env.SMTP_FROM_NAME?.trim() || "";

  const effectiveHost = envHost || stored.smtpHost;
  const effectivePort = Number.isFinite(envPort) && envPort > 0 ? envPort : stored.smtpPort;
  const effectiveSecure =
    envSecure === "true" ? true : envSecure === "false" ? false : stored.smtpSecure;
  const effectiveUser = envUser || stored.smtpUser;
  const effectivePassword = envPass || decryptEmailSecret(stored.smtpPasswordEncrypted);
  const effectiveFromEmail = envFromEmail || stored.fromEmail;
  const effectiveFromName = envFromName || stored.fromName;

  return {
    ...stored,
    effectiveHost,
    effectivePort,
    effectiveSecure,
    effectiveUser,
    effectivePassword,
    effectiveFromName,
    effectiveFromEmail,
    envOverrides: {
      host: Boolean(envHost),
      user: Boolean(envUser),
      pass: Boolean(envPass),
      fromEmail: Boolean(envFromEmail),
    },
  };
}

export function toPublicEmailSettings(resolved: ResolvedEmailSettings): EmailSettingsPublic {
  return {
    mode: resolved.mode,
    smtpHost: resolved.effectiveHost,
    smtpPort: resolved.effectivePort,
    smtpSecure: resolved.effectiveSecure,
    smtpUser: resolved.effectiveUser,
    hasPassword: Boolean(resolved.effectivePassword),
    envOverrides: resolved.envOverrides,
    fromName: resolved.effectiveFromName,
    fromEmail: resolved.effectiveFromEmail,
    replyTo: resolved.replyTo,
    signatureHtml: resolved.signatureHtml,
    batchSize: resolved.batchSize,
    batchDelayMs: resolved.batchDelayMs,
    autoWelcomeSubscriber: resolved.autoWelcomeSubscriber,
    autoReplyContact: resolved.autoReplyContact,
    welcomeTemplateSlug: resolved.welcomeTemplateSlug,
    contactReplyTemplateSlug: resolved.contactReplyTemplateSlug,
  };
}

export async function saveEmailSettings(input: {
  mode: "sandbox" | "smtp";
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword?: string;
  clearPassword?: boolean;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  signatureHtml?: string;
  batchSize: number;
  batchDelayMs: number;
  autoWelcomeSubscriber: boolean;
  autoReplyContact: boolean;
  welcomeTemplateSlug?: string;
  contactReplyTemplateSlug?: string;
}): Promise<EmailSettingsPublic> {
  const existing = await getResolvedEmailSettings();

  if (input.smtpHost.trim()) {
    const check = validateSmtpHost(input.smtpHost);
    if (!check.ok) {
      throw new Error(check.error);
    }
  }

  const fromName = assertNoHeaderInjection(input.fromName, "fromName");
  const fromEmail = assertNoHeaderInjection(input.fromEmail, "fromEmail");
  const replyTo = input.replyTo?.trim()
    ? assertNoHeaderInjection(input.replyTo, "replyTo")
    : "";

  if (replyTo && !isValidEmailAddress(replyTo)) {
    throw new Error("Reply-To must be a valid email address.");
  }

  let smtpPasswordEncrypted = existing.smtpPasswordEncrypted;
  if (input.clearPassword) {
    smtpPasswordEncrypted = "";
  } else if (typeof input.smtpPassword === "string" && input.smtpPassword.length > 0) {
    smtpPasswordEncrypted = encryptEmailSecret(input.smtpPassword);
  }

  const next: EmailSettingsStored = {
    mode: input.mode,
    smtpHost: input.smtpHost.trim(),
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    smtpUser: input.smtpUser.trim(),
    smtpPasswordEncrypted,
    fromName,
    fromEmail,
    replyTo,
    signatureHtml: sanitizeEmailHtml(input.signatureHtml ?? ""),
    batchSize: Math.min(100, Math.max(1, input.batchSize)),
    batchDelayMs: Math.min(5000, Math.max(0, input.batchDelayMs)),
    autoWelcomeSubscriber: input.autoWelcomeSubscriber,
    autoReplyContact: input.autoReplyContact,
    welcomeTemplateSlug: input.welcomeTemplateSlug?.trim() || "welcome-subscriber",
    contactReplyTemplateSlug: input.contactReplyTemplateSlug?.trim() || "contact-auto-receipt",
  };

  const serialized = JSON.stringify(next);
  const updated = await execute(
    "UPDATE settings SET `value` = ?, updated_at = NOW() WHERE `key` = ?",
    [serialized, EMAIL_SETTINGS_KEY]
  );
  if (!updated.affectedRows) {
    await execute("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", [
      EMAIL_SETTINGS_KEY,
      serialized,
    ]);
  }

  return toPublicEmailSettings(await getResolvedEmailSettings());
}

// ============================================================================
// SMTP Transport & Verification
// ============================================================================

function createSmtpTransporter(settings: ResolvedEmailSettings) {
  const hostCheck = validateSmtpHost(settings.effectiveHost);
  if (!hostCheck.ok) {
    throw new Error(hostCheck.error);
  }

  return nodemailer.createTransport({
    host: hostCheck.host,
    port: settings.effectivePort,
    secure: settings.effectiveSecure,
    auth: settings.effectiveUser
      ? {
          user: settings.effectiveUser,
          pass: settings.effectivePassword,
        }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
  });
}

export async function verifySmtpConnection(): Promise<{
  ok: boolean;
  mode: "smtp" | "sandbox";
  message: string;
}> {
  const settings = await getResolvedEmailSettings();
  if (settings.mode === "sandbox") {
    return {
      ok: true,
      mode: "sandbox",
      message: "Sandbox preview mode is active. Outbound emails are rendered, validated, and logged locally without contacting an external SMTP server.",
    };
  }
  if (!settings.effectiveHost) {
    return {
      ok: false,
      mode: "smtp",
      message: "SMTP host is not configured yet.",
    };
  }

  try {
    const transporter = createSmtpTransporter(settings);
    await transporter.verify();
    return {
      ok: true,
      mode: "smtp",
      message: `Connected successfully to ${settings.effectiveHost}:${settings.effectivePort}`,
    };
  } catch (err) {
    return {
      ok: false,
      mode: "smtp",
      message: err instanceof Error ? err.message : "SMTP handshake failed.",
    };
  }
}

// ============================================================================
// Suppression Check & Single Email Dispatch
// ============================================================================

export async function getSuppressedEmailSet(emails?: string[]): Promise<Set<string>> {
  await ensureEmailSchema();
  if (emails && emails.length === 0) return new Set();
  const rows = await query<{ email: string }>(`SELECT email FROM email_suppressions`);
  return new Set(rows.map((r) => r.email.toLowerCase()));
}

export interface SendEmailInput {
  to: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  preheader?: string;
  htmlBody: string;
  textBody?: string;
  direction?: "rtl" | "ltr";
  kind?: EmailLogKind;
  campaignId?: string | null;
  templateId?: string | null;
  contactMessageId?: string | null;
  sentBy?: string | null;
  variables?: Record<string, string | number | null | undefined>;
  skipSuppressionCheck?: boolean;
  suppressedSet?: Set<string>;
}

export interface SendEmailResult {
  logId: string;
  recipient: string;
  status: EmailLogStatus;
  providerMode: "smtp" | "sandbox";
  providerMessageId: string | null;
  errorMessage: string | null;
}

export async function sendSingleEmail(input: SendEmailInput): Promise<SendEmailResult> {
  await ensureEmailSchema();
  const settings = await getResolvedEmailSettings();
  const recipient = assertNoHeaderInjection(input.to.toLowerCase(), "to");
  if (!isValidEmailAddress(recipient)) {
    throw new Error(`Invalid recipient email: ${recipient}`);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://scienta.org";
  const nowStr = new Date().toISOString().slice(0, 10);
  const mergedVars: Record<string, string | number | null | undefined> = {
    site_name: settings.effectiveFromName || "Scienta",
    site_url: siteUrl,
    recipient_email: recipient,
    unsubscribe_url: `${siteUrl.replace(/\/$/, "")}/${input.direction === "ltr" ? "en" : "fa"}`,
    date: nowStr,
    ...(input.variables ?? {}),
  };

  const renderedSubject = assertNoHeaderInjection(
    renderEmailTemplate(input.subject, mergedVars, { escapeForHtml: false }),
    "subject"
  );
  const renderedPreheader = input.preheader
    ? assertNoHeaderInjection(
        renderEmailTemplate(input.preheader, mergedVars, { escapeForHtml: false }),
        "preheader"
      )
    : "";

  const renderedInnerHtml = renderEmailTemplate(input.htmlBody, mergedVars, { escapeForHtml: true });
  const wrappedHtml = wrapEmailLayout({
    bodyHtml: renderedInnerHtml,
    preheader: renderedPreheader,
    direction: input.direction ?? "rtl",
    fromName: settings.effectiveFromName,
    signatureHtml: settings.signatureHtml,
    unsubscribeUrl: input.kind === "campaign" ? String(mergedVars.unsubscribe_url ?? "") : undefined,
    siteUrl,
  });

  const renderedText = input.textBody?.trim()
    ? renderEmailTemplate(input.textBody, mergedVars, { escapeForHtml: false })
    : htmlToPlainText(renderedInnerHtml);

  const replyTo = input.replyTo?.trim()
    ? assertNoHeaderInjection(input.replyTo, "replyTo")
    : settings.replyTo || undefined;

  const ccList = (input.cc ?? []).filter(isValidEmailAddress);
  const bccList = (input.bcc ?? []).filter(isValidEmailAddress);

  const logId = uuid();
  let status: EmailLogStatus = settings.mode === "smtp" ? "sent" : "sandbox";
  let providerMessageId: string | null = null;
  let errorMessage: string | null = null;

  // Enforce suppression list unless explicitly bypassed (e.g. admin test email)
  if (!input.skipSuppressionCheck) {
    const suppressed = input.suppressedSet ?? (await getSuppressedEmailSet([recipient]));
    if (suppressed.has(recipient)) {
      status = "suppressed";
      errorMessage = "Recipient is on the suppression / bounce list.";
    }
  }

  if (status !== "suppressed") {
    if (settings.mode === "sandbox") {
      status = "sandbox";
      providerMessageId = `sandbox-${logId.slice(0, 12)}@scienta.local`;
    } else {
      try {
        const transporter = createSmtpTransporter(settings);
        const info = await transporter.sendMail({
          from: `"${settings.effectiveFromName.replace(/"/g, "'")}" <${settings.effectiveFromEmail}>`,
          to: recipient,
          cc: ccList.length > 0 ? ccList : undefined,
          bcc: bccList.length > 0 ? bccList : undefined,
          replyTo,
          subject: renderedSubject,
          html: wrappedHtml,
          text: renderedText,
          headers:
            input.kind === "campaign" && mergedVars.unsubscribe_url
              ? { "List-Unsubscribe": `<${mergedVars.unsubscribe_url}>` }
              : undefined,
        });
        status = "sent";
        providerMessageId = info.messageId || null;
      } catch (err) {
        status = "failed";
        errorMessage = err instanceof Error ? err.message : "SMTP delivery failed.";
      }
    }
  }

  await execute(
    `INSERT INTO email_logs
     (id, campaign_id, template_id, contact_message_id, kind, recipient_email, cc_json, bcc_json, reply_to,
      from_email, from_name, subject, html_body, text_body, provider_mode, status, provider_message_id, error_message, sent_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      logId,
      input.campaignId ?? null,
      input.templateId ?? null,
      input.contactMessageId ?? null,
      input.kind ?? "direct",
      recipient,
      ccList.length > 0 ? JSON.stringify(ccList) : null,
      bccList.length > 0 ? JSON.stringify(bccList) : null,
      replyTo ?? null,
      settings.effectiveFromEmail,
      settings.effectiveFromName,
      renderedSubject,
      wrappedHtml,
      renderedText,
      settings.mode,
      status,
      providerMessageId,
      errorMessage,
      input.sentBy ?? null,
    ]
  );

  return {
    logId,
    recipient,
    status,
    providerMode: settings.mode,
    providerMessageId,
    errorMessage,
  };
}

// ============================================================================
// Campaign Audience Resolution & Batch Dispatch
// ============================================================================

export async function resolveCampaignAudience(
  segment: EmailAudienceSegment,
  customRecipientsRaw?: string | null
): Promise<string[]> {
  await ensureEmailSchema();
  if (segment === "custom") {
    return parseRecipientList(customRecipientsRaw ?? "").valid;
  }

  const where =
    segment === "fa"
      ? `WHERE status = 'subscribed' AND locale = 'fa'`
      : segment === "en"
        ? `WHERE status = 'subscribed' AND locale = 'en'`
        : `WHERE status = 'subscribed'`;

  const rows = await query<{ email: string }>(`SELECT email FROM subscribers ${where} ORDER BY created_at DESC`);
  return Array.from(new Set(rows.map((r) => r.email.trim().toLowerCase()).filter(isValidEmailAddress)));
}

export async function dispatchCampaign(campaignId: string, actorUserId: string) {
  await ensureEmailSchema();
  const campaign = await queryOne<{
    id: string;
    name: string;
    subject: string;
    preheader: string | null;
    template_id: string | null;
    audience_segment: EmailAudienceSegment;
    custom_recipients_json: string | null;
    html_body: string;
    text_body: string | null;
    direction: "rtl" | "ltr";
    status: EmailCampaignStatus;
  }>(`SELECT * FROM email_campaigns WHERE id = ? LIMIT 1`, [campaignId]);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const customList = campaign.custom_recipients_json
    ? (JSON.parse(campaign.custom_recipients_json) as string[]).join(",")
    : "";
  const recipients = await resolveCampaignAudience(campaign.audience_segment, customList);

  if (recipients.length === 0) {
    throw new Error("No active recipients matched this campaign segment.");
  }

  const settings = await getResolvedEmailSettings();
  const suppressedSet = await getSuppressedEmailSet(recipients);

  await execute(
    `UPDATE email_campaigns SET status = 'sending', total_recipients = ?, updated_at = NOW() WHERE id = ?`,
    [recipients.length, campaign.id]
  );

  let sentCount = 0;
  let failedCount = 0;
  let suppressedCount = 0;

  const batchSize = Math.max(1, settings.batchSize);
  for (let i = 0; i < recipients.length; i += batchSize) {
    const chunk = recipients.slice(i, i + batchSize);
    for (const email of chunk) {
      const res = await sendSingleEmail({
        to: email,
        subject: campaign.subject,
        preheader: campaign.preheader ?? "",
        htmlBody: campaign.html_body,
        textBody: campaign.text_body ?? undefined,
        direction: campaign.direction === "ltr" ? "ltr" : "rtl",
        kind: "campaign",
        campaignId: campaign.id,
        templateId: campaign.template_id,
        sentBy: actorUserId,
        suppressedSet,
      });
      if (res.status === "sent" || res.status === "sandbox") sentCount += 1;
      else if (res.status === "suppressed") suppressedCount += 1;
      else failedCount += 1;
    }

    if (i + batchSize < recipients.length && settings.batchDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000, settings.batchDelayMs)));
    }
  }

  const finalStatus: EmailCampaignStatus =
    sentCount === 0 && failedCount > 0
      ? "failed"
      : failedCount > 0
        ? "partial"
        : "sent";

  await execute(
    `UPDATE email_campaigns
     SET status = ?, total_recipients = ?, sent_count = ?, failed_count = ?, suppressed_count = ?, sent_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [finalStatus, recipients.length, sentCount, failedCount, suppressedCount, campaign.id]
  );

  return {
    campaignId: campaign.id,
    status: finalStatus,
    totalRecipients: recipients.length,
    sentCount,
    failedCount,
    suppressedCount,
    providerMode: settings.mode,
  };
}

// ============================================================================
// Non-Blocking Transactional Automation Triggers (Subscribe / Contact)
// ============================================================================

export async function triggerAutomationEmail(params: {
  event: "welcome_subscriber" | "contact_receipt";
  to: string;
  locale?: "fa" | "en";
  variables?: Record<string, string>;
}): Promise<void> {
  try {
    const settings = await getResolvedEmailSettings();
    if (params.event === "welcome_subscriber" && !settings.autoWelcomeSubscriber) return;
    if (params.event === "contact_receipt" && !settings.autoReplyContact) return;

    const slug =
      params.event === "welcome_subscriber"
        ? settings.welcomeTemplateSlug
        : settings.contactReplyTemplateSlug;

    const tpl = await queryOne<{
      id: string;
      subject: string;
      preheader: string | null;
      html_body: string;
      text_body: string | null;
      locale: string;
    }>(`SELECT id, subject, preheader, html_body, text_body, locale FROM email_templates WHERE slug = ? LIMIT 1`, [
      slug,
    ]);

    if (!tpl) return;

    await sendSingleEmail({
      to: params.to,
      subject: tpl.subject,
      preheader: tpl.preheader ?? "",
      htmlBody: tpl.html_body,
      textBody: tpl.text_body ?? undefined,
      direction: params.locale === "en" || tpl.locale === "en" ? "ltr" : "rtl",
      kind: "automation",
      templateId: tpl.id,
      variables: params.variables,
    });
  } catch (err) {
    console.warn("[email-automation] non-blocking trigger skipped:", err instanceof Error ? err.message : err);
  }
}
