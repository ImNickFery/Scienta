"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";

export function ContactForm({ locale }: { locale: Locale }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          subject: data.get("subject"),
          message: data.get("message"),
          website: data.get("website"), // honeypot
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong");
      }

      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-(--color-accent-purple)/15 text-(--color-accent-purple)">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)">
          {locale === "fa" ? "پیام شما ارسال شد" : "Your message is on its way"}
        </h2>
        <p className="max-w-sm text-sm text-(--color-text-tertiary)">
          {locale === "fa"
            ? "ممنون که وقت گذاشتید. در اسرع وقت پاسخ خواهیم داد."
            : "Thanks for reaching out — we'll get back to you soon."}
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-2 text-xs text-(--color-accent-orange) hover:underline"
        >
          {locale === "fa" ? "ارسال پیام دیگر" : "Send another message"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel space-y-5 rounded-2xl p-8">
      {/* Honeypot — hidden from real users, bots tend to fill every field */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs text-(--color-text-tertiary)">
            {locale === "fa" ? "نام" : "Name"}
          </label>
          <input
            name="name"
            required
            maxLength={160}
            disabled={status === "loading"}
            className="h-12 w-full rounded-xl border border-(--color-border-subtle) bg-black/20 px-4 text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-accent-purple) disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs text-(--color-text-tertiary)">
            {locale === "fa" ? "ایمیل" : "Email"}
          </label>
          <input
            type="email"
            name="email"
            required
            maxLength={190}
            disabled={status === "loading"}
            className="h-12 w-full rounded-xl border border-(--color-border-subtle) bg-black/20 px-4 text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-accent-purple) disabled:opacity-50"
          />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-xs text-(--color-text-tertiary)">
          {locale === "fa" ? "موضوع (اختیاری)" : "Subject (optional)"}
        </label>
        <input
          name="subject"
          maxLength={255}
          disabled={status === "loading"}
          className="h-12 w-full rounded-xl border border-(--color-border-subtle) bg-black/20 px-4 text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-accent-purple) disabled:opacity-50"
        />
      </div>
      <div>
        <label className="mb-2 block text-xs text-(--color-text-tertiary)">
          {locale === "fa" ? "پیام" : "Message"}
        </label>
        <textarea
          name="message"
          required
          maxLength={5000}
          rows={5}
          disabled={status === "loading"}
          className="w-full resize-none rounded-xl border border-(--color-border-subtle) bg-black/20 px-4 py-3 text-sm text-(--color-text-primary) outline-none transition-colors focus:border-(--color-accent-purple) disabled:opacity-50"
        />
      </div>

      {status === "error" && (
        <p className="flex items-center gap-2 rounded-lg border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-3 py-2 text-xs text-(--color-accent-red)">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {errorMessage}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={status === "loading"}>
        {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        {locale === "fa" ? "ارسال پیام" : "Send message"}
      </Button>
    </form>
  );
}
