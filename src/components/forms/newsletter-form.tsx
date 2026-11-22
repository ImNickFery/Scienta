"use client";

import { useState } from "react";
import { Loader2, Check, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { isUnslopStyle, type DesignMode } from "@/lib/site-modes";

export function NewsletterForm({
  locale,
  dict,
  designMode = "classic",
}: {
  locale: Locale;
  dict: Dictionary;
  designMode?: DesignMode;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const isFa = locale === "fa";
  const isUnslop = isUnslopStyle(designMode);
  const ForwardArrow = isFa ? ArrowLeft : ArrowRight;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const rawEmail = String(new FormData(form).get("email") ?? "").trim();
    if (!rawEmail) {
      setStatus("error");
      setErrorMessage(
        isFa ? "لطفاً نشانی ایمیل معتبر وارد کنید." : "Please enter a valid email address."
      );
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/public/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: rawEmail, locale }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          setErrorMessage(
            isFa
              ? "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید."
              : "Too many attempts. Please try again in a few minutes."
          );
        } else if (res.status === 400) {
          setErrorMessage(
            isFa ? "لطفاً نشانی ایمیل معتبر وارد کنید." : "Please enter a valid email address."
          );
        } else {
          setErrorMessage(
            isFa ? "ثبت اشتراک انجام نشد؛ لطفاً دوباره تلاش کنید." : "Could not subscribe. Please try again."
          );
        }
        setStatus("error");
        return;
      }
      setStatus("success");
      form.reset();
    } catch {
      setErrorMessage(
        isFa ? "خطا در برقراری ارتباط با سرور." : "Network error. Please try again."
      );
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-sm",
          isUnslop
            ? "rounded-lg border-(--color-accent-purple)/40 bg-(--color-bg-secondary) text-(--color-text-primary)"
            : "rounded-xl border-(--color-accent-orange)/30 bg-(--color-accent-orange)/10 text-(--color-text-primary)"
        )}
      >
        <span className="inline-flex items-center gap-2 font-medium">
          <Check className="h-4 w-4 shrink-0 text-(--color-accent-purple)" strokeWidth={2} />
          <span>
            {isFa ? "اشتراک شما با موفقیت ثبت شد." : "You are subscribed to the dispatch."}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="text-xs font-medium text-(--color-text-tertiary) underline-offset-4 transition-colors hover:text-(--color-text-primary) hover:underline"
        >
          {isFa ? "ثبت ایمیل دیگر" : "Add another"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-2.5" noValidate>
      {/* min-w-0 on the input prevents intrinsic width (~20 chars) from widening narrow mobile viewports. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-2">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          disabled={status === "loading"}
          onChange={() => {
            if (status === "error") {
              setStatus("idle");
              setErrorMessage("");
            }
          }}
          placeholder={isFa ? "name@domain.com" : "you@institution.edu"}
          aria-label={isFa ? "نشانی ایمیل برای خبرنامه علمی" : "Email address for science newsletter"}
          aria-invalid={status === "error"}
          dir="ltr"
          className={cn(
            "h-11 w-full min-w-0 border px-3.5 text-sm text-(--color-text-primary) outline-none transition-colors placeholder:text-(--color-text-tertiary) disabled:opacity-50 sm:w-auto sm:flex-1",
            isUnslop
              ? "rounded-lg border-(--color-border-strong) bg-(--color-bg-deep) text-start focus:border-(--color-accent-purple)"
              : "rounded-full border-(--color-border-subtle) bg-(--color-bg-deep)/70 px-4 focus:border-(--color-accent-purple)"
          )}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={cn(
            "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-5 text-sm font-medium transition-all disabled:opacity-60",
            isUnslop
              ? "scienta-btn-primary rounded-lg bg-(--color-text-primary) text-(--color-bg-elevated) hover:bg-(--color-accent-purple) hover:text-white active:scale-[0.99]"
              : "rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) text-white shadow-[0_8px_30px_-8px_rgba(var(--color-accent-glow-rgb),0.55)] hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span>{dict.footer.subscribe}</span>
              {isUnslop && <ForwardArrow className="h-3.5 w-3.5" strokeWidth={1.75} />}
            </>
          )}
        </button>
      </div>

      {status === "error" && errorMessage && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-(--color-accent-red)">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </p>
      )}
    </form>
  );
}
