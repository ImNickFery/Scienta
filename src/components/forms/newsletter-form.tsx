"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function NewsletterForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email");
    setStatus("loading");
    try {
      const res = await fetch("/api/public/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      e.currentTarget.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="flex items-center gap-2 text-sm text-(--color-accent-orange)">
        <Check className="h-4 w-4" />
        {locale === "fa" ? "با موفقیت عضو شدید!" : "You're subscribed!"}
      </p>
    );
  }

  return (
    // min-w-0 on the input matters: an <input> defaults to size="20", and a
    // flex child cannot shrink past that intrinsic width unless told to. Without
    // it the footer's newsletter column sets a ~389px floor and pushes the whole
    // page into horizontal scroll on narrow phones — English only, since the
    // Persian button label is short enough to stay under the limit.
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        name="email"
        required
        disabled={status === "loading"}
        placeholder={locale === "fa" ? "ایمیل شما" : "Your email"}
        // Placeholders are not accessible names — a screen reader reaches this
        // field and announces only "edit text" without one.
        aria-label={locale === "fa" ? "ایمیل شما" : "Your email"}
        className="h-10 min-w-0 flex-1 rounded-full border border-(--color-border-subtle) bg-black/20 px-4 text-sm text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple) disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-4 text-sm font-medium text-white shadow-[0_8px_30px_-8px_rgba(var(--color-accent-glow-rgb),0.6)] transition-all hover:scale-[1.03] hover:shadow-[0_12px_40px_-8px_rgba(var(--color-accent-glow-rgb),0.8)] active:scale-[0.98] disabled:opacity-60"
      >
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : dict.footer.subscribe}
      </button>
    </form>
  );
}
