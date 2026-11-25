"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PlugZap,
  Plus,
  Save,
  Send,
  ShieldBan,
  Trash2,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import {
  SMTP_PROVIDER_PRESETS,
  type EmailSettingsPublic,
  type SuppressionReason,
} from "@/lib/email-core";
import { formatEmailDate, type EmailSuppressionRow, type EmailTemplateRow } from "./types";

interface Props {
  isFa: boolean;
  settings: EmailSettingsPublic;
  templates: EmailTemplateRow[];
  suppressions: EmailSuppressionRow[];
  onRefresh: () => Promise<void>;
}

export function EmailSettingsTab({
  isFa,
  settings,
  templates,
  suppressions,
  onRefresh,
}: Props) {
  const [mode, setMode] = useState<"sandbox" | "smtp">(settings.mode);
  const [smtpHost, setSmtpHost] = useState(settings.smtpHost);
  const [smtpPort, setSmtpPort] = useState(String(settings.smtpPort));
  const [smtpSecure, setSmtpSecure] = useState(settings.smtpSecure);
  const [smtpUser, setSmtpUser] = useState(settings.smtpUser);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [fromName, setFromName] = useState(settings.fromName);
  const [fromEmail, setFromEmail] = useState(settings.fromEmail);
  const [replyTo, setReplyTo] = useState(settings.replyTo);
  const [signatureHtml, setSignatureHtml] = useState(settings.signatureHtml);
  const [batchSize, setBatchSize] = useState(String(settings.batchSize));
  const [batchDelayMs, setBatchDelayMs] = useState(String(settings.batchDelayMs));
  const [autoWelcome, setAutoWelcome] = useState(settings.autoWelcomeSubscriber);
  const [autoReplyContact, setAutoReplyContact] = useState(settings.autoReplyContact);
  const [welcomeSlug, setWelcomeSlug] = useState(settings.welcomeTemplateSlug);
  const [contactSlug, setContactSlug] = useState(settings.contactReplyTemplateSlug);

  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Suppression list form
  const [supEmail, setSupEmail] = useState("");
  const [supReason, setSupReason] = useState<SuppressionReason>("manual");
  const [supNote, setSupNote] = useState("");
  const [addingSup, setAddingSup] = useState(false);

  function applyPreset(presetId: string) {
    const preset = SMTP_PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setMode("smtp");
    if (preset.host) setSmtpHost(preset.host);
    setSmtpPort(String(preset.port));
    setSmtpSecure(preset.secure);
    setNotice(isFa ? preset.hintFa : preset.hintEn);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await adminFetch("/api/admin/email/settings", {
        method: "PUT",
        body: JSON.stringify({
          mode,
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort) || 587,
          smtpSecure,
          smtpUser: smtpUser.trim(),
          smtpPassword: smtpPassword || undefined,
          fromName: fromName.trim(),
          fromEmail: fromEmail.trim(),
          replyTo: replyTo.trim(),
          signatureHtml,
          batchSize: Number(batchSize) || 25,
          batchDelayMs: Number(batchDelayMs) || 250,
          autoWelcomeSubscriber: autoWelcome,
          autoReplyContact,
          welcomeTemplateSlug: welcomeSlug,
          contactReplyTemplateSlug: contactSlug,
        }),
      });
      setSmtpPassword("");
      setNotice(isFa ? "تنظیمات ایمیل و SMTP با موفقیت ذخیره شد." : "Email & SMTP settings saved.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save email settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyConnection() {
    setVerifying(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch<{ ok: boolean; message: string }>("/api/admin/email/test", {
        method: "POST",
        body: JSON.stringify({ action: "verify" }),
      });
      setNotice(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "SMTP verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSendTestEmail() {
    setTestingEmail(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch<{ recipient: string; status: string; providerMode: string }>(
        "/api/admin/email/test",
        {
          method: "POST",
          body: JSON.stringify({
            action: "send_test",
            to: testRecipient.trim() || undefined,
            locale: isFa ? "fa" : "en",
          }),
        }
      );
      setNotice(
        isFa
          ? `ایمیل آزمایشی به ${res.recipient} ثبت شد (${res.providerMode === "smtp" ? "SMTP واقعی" : "Sandbox"})`
          : `Test email dispatched to ${res.recipient} (${res.providerMode})`
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setTestingEmail(false);
    }
  }

  async function handleAddSuppression(e: React.FormEvent) {
    e.preventDefault();
    if (!supEmail.trim()) return;
    setAddingSup(true);
    setError(null);
    try {
      await adminFetch("/api/admin/email/suppression", {
        method: "POST",
        body: JSON.stringify({
          email: supEmail.trim(),
          reason: supReason,
          note: supNote.trim(),
        }),
      });
      setSupEmail("");
      setSupNote("");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add suppression entry");
    } finally {
      setAddingSup(false);
    }
  }

  async function handleRemoveSuppression(id: string) {
    setError(null);
    try {
      await adminFetch(`/api/admin/email/suppression/${id}`, { method: "DELETE" });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove entry");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 7 cols: SMTP Transport, Sender Identity & Automations */}
        <form
          onSubmit={handleSaveSettings}
          className="space-y-6 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5 lg:col-span-7"
        >
          <div>
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              {isFa ? "پیکربندی سرور ارسال ایمیل (SMTP)" : "Outbound Transport & SMTP"}
            </h2>
            <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
              {isFa
                ? "رمز عبور SMTP به‌صورت رمزنگاری‌شده ذخیره می‌شود و می‌توانید مقادیر را از متغیرهای محیطی سرور (SMTP_HOST و …) هم تزریق کنید."
                : "SMTP credentials are encrypted at rest with AES-256-GCM and can also be overridden securely via server environment variables."}
            </p>
          </div>

          {/* Delivery Mode Switch */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("sandbox")}
              className={`rounded-lg border p-3.5 text-start transition-colors ${
                mode === "sandbox"
                  ? "border-(--color-accent-purple) bg-(--color-accent-purple)/12"
                  : "border-(--color-border-subtle) bg-(--color-bg-deep) hover:border-(--color-border-strong)"
              }`}
            >
              <span className="block text-xs font-semibold text-(--color-text-primary)">
                {isFa ? "حالت آزمایشی (Sandbox)" : "Sandbox Preview Mode"}
              </span>
              <span className="mt-1 block text-[11px] text-(--color-text-tertiary)">
                {isFa
                  ? "بدون ارسال خارجی؛ رندر کامل و ذخیره در گزارش ایمیل‌ها برای تست امن"
                  : "Validates, renders, and logs emails locally without external SMTP."}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("smtp")}
              className={`rounded-lg border p-3.5 text-start transition-colors ${
                mode === "smtp"
                  ? "border-(--color-accent-purple) bg-(--color-accent-purple)/12"
                  : "border-(--color-border-subtle) bg-(--color-bg-deep) hover:border-(--color-border-strong)"
              }`}
            >
              <span className="block text-xs font-semibold text-(--color-text-primary)">
                {isFa ? "ارسال واقعی (Live SMTP)" : "Live SMTP Relay"}
              </span>
              <span className="mt-1 block text-[11px] text-(--color-text-tertiary)">
                {isFa
                  ? "اتصال مستقیم به میل‌سرور cPanel، جیمیل، Resend، Mailgun یا Postmark"
                  : "Dispatches real mail through cPanel, Gmail, Resend, Mailgun, or Postmark."}
              </span>
            </button>
          </div>

          {/* Provider Presets */}
          <div>
            <span className="mb-2 block text-xs text-(--color-text-tertiary)">
              {isFa ? "پریست سریع سرویس‌دهنده:" : "Quick provider presets:"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SMTP_PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="h-8 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-secondary) hover:border-(--color-accent-purple) hover:text-(--color-text-primary) whitespace-nowrap"
                >
                  {isFa ? preset.labelFa : preset.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* SMTP Fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <label htmlFor="smtp-host" className="mb-1 block text-xs text-(--color-text-secondary)">
                {isFa ? "آدرس سرور (SMTP Host)" : "SMTP Host"}
              </label>
              <input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                dir="ltr"
                placeholder="mail.scienta.ir"
                className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="smtp-port" className="mb-1 block text-xs text-(--color-text-secondary)">
                {isFa ? "پورت" : "Port"}
              </label>
              <input
                id="smtp-port"
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                dir="ltr"
                className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
              />
            </div>
            <div className="flex items-end sm:col-span-3">
              <label className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-secondary)">
                <input
                  type="checkbox"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="accent-(--color-accent-purple)"
                />
                <span>SSL/TLS (465)</span>
              </label>
            </div>
            <div className="sm:col-span-6">
              <label htmlFor="smtp-user" className="mb-1 block text-xs text-(--color-text-secondary)">
                {isFa ? "نام کاربری SMTP" : "SMTP Username"}
              </label>
              <input
                id="smtp-user"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                dir="ltr"
                placeholder="noreply@scienta.ir"
                className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
              />
            </div>
            <div className="sm:col-span-6">
              <label htmlFor="smtp-pass" className="mb-1 block text-xs text-(--color-text-secondary)">
                {isFa ? "رمز عبور / App Password" : "SMTP Password / Token"}
                {settings.hasPassword && (
                  <span className="ms-1.5 text-[11px] text-emerald-400">
                    ({isFa ? "ذخیره‌شده" : "configured"})
                  </span>
                )}
              </label>
              <input
                id="smtp-pass"
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                dir="ltr"
                autoComplete="new-password"
                placeholder={
                  settings.hasPassword
                    ? isFa
                      ? "برای حفظ رمز فعلی خالی بگذارید"
                      : "Leave blank to keep saved password"
                    : "••••••••••••"
                }
                className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
              />
            </div>
          </div>

          {/* Sender Identity & Batch Limits */}
          <div className="space-y-3 border-t border-(--color-border-subtle) pt-5">
            <h3 className="text-xs font-semibold text-(--color-text-primary)">
              {isFa ? "هویت فرستنده و محدودیت ارسال گروهی" : "Sender Identity & Rate Throttling"}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="from-name" className="mb-1 block text-xs text-(--color-text-secondary)">
                  {isFa ? "نام فرستنده" : "From Name"}
                </label>
                <input
                  id="from-name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
              <div>
                <label htmlFor="from-email" className="mb-1 block text-xs text-(--color-text-secondary)">
                  {isFa ? "ایمیل فرستنده" : "From Email"}
                </label>
                <input
                  id="from-email"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  dir="ltr"
                  className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
              <div>
                <label htmlFor="reply-to" className="mb-1 block text-xs text-(--color-text-secondary)">
                  {isFa ? "ایمیل پاسخ پیش‌فرض (Reply-To)" : "Default Reply-To"}
                </label>
                <input
                  id="reply-to"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  dir="ltr"
                  className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="batch-size" className="mb-1 block text-xs text-(--color-text-secondary)">
                  {isFa ? "تعداد ارسال در هر بسته کمپین" : "Campaign Batch Size"}
                </label>
                <input
                  id="batch-size"
                  type="number"
                  min={1}
                  max={100}
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
              <div>
                <label htmlFor="batch-delay" className="mb-1 block text-xs text-(--color-text-secondary)">
                  {isFa ? "مکث بین بسته‌ها (میلی‌ثانیه)" : "Delay Between Batches (ms)"}
                </label>
                <input
                  id="batch-delay"
                  type="number"
                  min={0}
                  max={5000}
                  value={batchDelayMs}
                  onChange={(e) => setBatchDelayMs(e.target.value)}
                  className="h-9 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sig-html" className="mb-1 block text-xs text-(--color-text-secondary)">
                {isFa ? "امضای فوتر ایمیل‌ها (HTML امن)" : "Email Footer Signature (Safe HTML)"}
              </label>
              <textarea
                id="sig-html"
                rows={2}
                value={signatureHtml}
                onChange={(e) => setSignatureHtml(e.target.value)}
                dir="ltr"
                className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-2.5 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
              />
            </div>
          </div>

          {/* Automations */}
          <div className="space-y-3 border-t border-(--color-border-subtle) pt-5">
            <h3 className="text-xs font-semibold text-(--color-text-primary)">
              {isFa ? "اتوماسیون ایمیل‌های تراکنشی سایت" : "Transactional Automations"}
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-3.5">
                <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-(--color-text-primary)">
                  <span>{isFa ? "خوش‌آمدگویی عضویت خبرنامه" : "Welcome new subscribers"}</span>
                  <input
                    type="checkbox"
                    checked={autoWelcome}
                    onChange={(e) => setAutoWelcome(e.target.checked)}
                    className="accent-(--color-accent-purple)"
                  />
                </label>
                <select
                  aria-label="Welcome email template"
                  value={welcomeSlug}
                  onChange={(e) => setWelcomeSlug(e.target.value)}
                  className="h-8 w-full rounded-md border border-(--color-border-subtle) bg-(--color-bg-secondary) px-2 text-xs text-(--color-text-secondary)"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-3.5">
                <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-(--color-text-primary)">
                  <span>{isFa ? "تأییدیه خودکار فرم تماس" : "Auto-receipt on contact form"}</span>
                  <input
                    type="checkbox"
                    checked={autoReplyContact}
                    onChange={(e) => setAutoReplyContact(e.target.checked)}
                    className="accent-(--color-accent-purple)"
                  />
                </label>
                <select
                  aria-label="Contact auto-receipt template"
                  value={contactSlug}
                  onChange={(e) => setContactSlug(e.target.value)}
                  className="h-8 w-full rounded-md border border-(--color-border-subtle) bg-(--color-bg-secondary) px-2 text-xs text-(--color-text-secondary)"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex h-10 items-center gap-2 rounded-lg bg-(--color-accent-purple) px-5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{isFa ? "ذخیره تنظیمات ایمیل" : "Save Email Settings"}</span>
            </button>
          </div>
        </form>

        {/* Right 5 cols: Connection Testing + Suppression List */}
        <div className="space-y-6 lg:col-span-5">
          {/* SMTP Verification & Test Email */}
          <section className="space-y-4 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
            <div>
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {isFa ? "تست اتصال و ایمیل آزمایشی" : "Connection Check & Test Send"}
              </h2>
              <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                {isFa
                  ? "ابتدا تنظیمات را ذخیره کنید، سپس اتصال SMTP یا ارسال ایمیل آزمایشی را امتحان کنید."
                  : "Save changes first, then verify your SMTP handshake or dispatch a test message."}
              </p>
            </div>

            <button
              type="button"
              disabled={verifying}
              onClick={handleVerifyConnection}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-(--color-border-strong) bg-white/[0.03] px-4 text-xs font-medium text-(--color-text-primary) hover:border-(--color-accent-purple) disabled:opacity-50"
            >
              {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5 text-(--color-accent-purple)" />}
              <span>{isFa ? "بررسی اتصال سرور SMTP" : "Verify SMTP Connection"}</span>
            </button>

            <div className="flex gap-2">
              <input
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                dir="ltr"
                type="email"
                placeholder={isFa ? "ایمیل گیرنده تست (اختیاری)" : "Test recipient email (optional)"}
                aria-label={isFa ? "ایمیل گیرنده تست" : "Test recipient email"}
                className="h-9 flex-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
              />
              <button
                type="button"
                disabled={testingEmail}
                onClick={handleSendTestEmail}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-(--color-accent-purple) px-3.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {testingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>{isFa ? "ارسال تست" : "Send Test"}</span>
              </button>
            </div>
          </section>

          {/* Suppression / Bounce List */}
          <section className="space-y-4 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-(--color-text-primary)">
                  {isFa ? "لیست مسدود و برگشتی‌ها (Suppression)" : "Suppression & Bounce List"}
                </h2>
                <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
                  {isFa
                    ? "ایمیل‌های این لیست در ارسال‌های مستقیم و کمپین‌ها به‌طور خودکار رد می‌شوند."
                    : "Addresses listed here are automatically skipped across direct sends and campaigns."}
                </p>
              </div>
              <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                {suppressions.length}
              </span>
            </div>

            <form onSubmit={handleAddSuppression} className="space-y-2.5">
              <div className="flex gap-2">
                <input
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  type="email"
                  dir="ltr"
                  placeholder="bounced@example.org"
                  aria-label={isFa ? "افزودن ایمیل به لیست مسدود" : "Email to suppress"}
                  className="h-9 flex-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
                <select
                  value={supReason}
                  onChange={(e) => setSupReason(e.target.value as SuppressionReason)}
                  aria-label={isFa ? "دلیل مسدودسازی" : "Suppression reason"}
                  className="h-9 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-2.5 text-xs text-(--color-text-primary) outline-none"
                >
                  <option value="bounce">{isFa ? "برگشت‌خورده (Bounce)" : "Bounce"}</option>
                  <option value="complaint">{isFa ? "گزارش اسپم" : "Complaint"}</option>
                  <option value="unsubscribed">{isFa ? "لغو عضویت" : "Unsubscribed"}</option>
                  <option value="manual">{isFa ? "دستی" : "Manual"}</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  value={supNote}
                  onChange={(e) => setSupNote(e.target.value)}
                  placeholder={isFa ? "توضیح کوتاه (اختیاری)…" : "Optional note…"}
                  className="h-9 flex-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs text-(--color-text-primary) outline-none focus:border-(--color-accent-purple)"
                />
                <button
                  type="submit"
                  disabled={addingSup}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-(--color-border-strong) px-3 text-xs font-medium text-(--color-text-primary) hover:border-(--color-accent-purple) whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isFa ? "افزودن" : "Block"}</span>
                </button>
              </div>
            </form>

            <div className="max-h-64 divide-y divide-(--color-border-subtle) overflow-y-auto border-t border-(--color-border-subtle)">
              {suppressions.length === 0 ? (
                <div className="py-8 text-center">
                  <ShieldBan className="mx-auto h-5 w-5 text-(--color-text-tertiary)/60" />
                  <p className="mt-1.5 text-xs text-(--color-text-tertiary)">
                    {isFa ? "لیست مسدود خالی است." : "No suppressed addresses."}
                  </p>
                </div>
              ) : (
                suppressions.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-[family-name:var(--font-mono)] text-xs text-(--color-text-primary)">
                        {item.email}
                      </p>
                      <p className="text-[11px] text-(--color-text-tertiary)">
                        <span>{item.reason}</span>
                        {item.note ? (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span>{item.note}</span>
                          </>
                        ) : null}
                        <span aria-hidden="true"> · </span>
                        <span className="font-[family-name:var(--font-mono)] tabular-nums">
                          {formatEmailDate(item.created_at, isFa)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSuppression(item.id)}
                      aria-label={`Remove ${item.email} from suppression list`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-(--color-text-tertiary) hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
