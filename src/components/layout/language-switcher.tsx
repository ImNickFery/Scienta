"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Globe, Loader2 } from "lucide-react";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  locales,
  localeLabels,
  type Locale,
} from "@/lib/i18n/config";
import { resolveLocaleSwitchPath } from "@/lib/i18n/switch-path";
import { useNumerals, writeClientCookie } from "@/components/i18n/numerals-provider";
import type { Numerals } from "@/lib/i18n/numerals";
import { cn } from "@/lib/utils";

const numeralOptions: { value: Numerals; label: string; sample: string }[] = [
  { value: "fa", label: "ارقام فارسی", sample: "۱۲۳" },
  { value: "latn", label: "ارقام انگلیسی", sample: "123" },
];

export function resolveClientLocaleHref(pathname: string | null, locale: Locale): string {
  const altLink =
    typeof document !== "undefined"
      ? document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${locale}"]`)
      : null;
  const search = typeof window !== "undefined" ? window.location.search : "";
  return resolveLocaleSwitchPath(pathname ?? "/", locale, altLink?.getAttribute("href"), search);
}

function useLocaleAndNumerals(currentLocale: Locale) {
  const pathname = usePathname();
  const router = useRouter();
  const { numerals, setNumerals } = useNumerals();
  const [switchingTo, setSwitchingTo] = useState<Locale | null>(null);

  function getLocaleHref(locale: Locale): string {
    return resolveLocaleSwitchPath(pathname ?? "/", locale);
  }

  function switchTo(locale: Locale) {
    if (locale === currentLocale) return;
    setSwitchingTo(locale);
    writeClientCookie(LOCALE_COOKIE, locale, LOCALE_COOKIE_MAX_AGE);
    const target = resolveClientLocaleHref(pathname, locale);
    // Full document navigation guarantees <html lang dir>, fonts, and direction CSS reset cleanly
    // without stale Next.js client-router cache or HMR chunk mismatches across root layouts.
    window.location.assign(target);
  }

  function chooseNumerals(next: Numerals) {
    if (next === numerals) return;
    setNumerals(next);
    router.refresh();
  }

  return { numerals, switchingTo, getLocaleHref, switchTo, chooseNumerals };
}

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { numerals, switchingTo, getLocaleHref, switchTo, chooseNumerals } =
    useLocaleAndNumerals(currentLocale);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={currentLocale === "fa" ? "تغییر زبان و شکل اعداد" : "Change language"}
        className={cn(
          "language-switcher-trigger flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm transition-colors",
          open
            ? "border-(--color-accent-purple)/60 bg-(--color-accent-purple)/10 text-(--color-text-primary)"
            : "border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
        )}
      >
        {switchingTo ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-(--color-accent-purple)" />
        ) : (
          <Globe className="h-4 w-4 shrink-0" />
        )}
        <span>{switchingTo ? localeLabels[switchingTo] : localeLabels[currentLocale]}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="language-switcher-menu absolute end-0 top-full z-50 mt-2 min-w-[12.5rem] rounded-xl border border-(--color-border-strong) bg-(--color-bg-elevated)/95 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          {locales.map((locale) => {
            const active = locale === currentLocale;
            const href = getLocaleHref(locale);
            return (
              <a
                key={locale}
                href={href}
                role="menuitemradio"
                aria-checked={active}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  switchTo(locale);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-white/[0.06]",
                  active ? "font-medium text-(--color-accent-orange)" : "text-(--color-text-secondary)"
                )}
              >
                <span>{localeLabels[locale]}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </a>
            );
          })}

          {currentLocale === "fa" && (
            <div className="mt-1.5 border-t border-(--color-border-subtle) pt-1.5">
              <p className="px-3 pb-1 text-[11px] text-(--color-text-tertiary)">شکل اعداد</p>
              {numeralOptions.map((option) => {
                const active = option.value === numerals;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      chooseNumerals(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-white/[0.06]",
                      active ? "font-medium text-(--color-accent-orange)" : "text-(--color-text-secondary)"
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className="font-[family-name:var(--font-mono)] text-xs text-(--color-text-tertiary)"
                      dir="ltr"
                    >
                      {option.sample}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Touch-friendly inline language & numeral selector for the mobile slide-over drawer.
 * Avoids floating popovers that can clip inside scrollable drawers.
 */
export function MobileLanguageControls({
  currentLocale,
  onSelect,
}: {
  currentLocale: Locale;
  onSelect?: () => void;
}) {
  const { numerals, switchingTo, getLocaleHref, switchTo, chooseNumerals } =
    useLocaleAndNumerals(currentLocale);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-(--color-border-subtle) bg-black/30 p-1">
        {locales.map((locale) => {
          const active = locale === currentLocale;
          const isLoading = switchingTo === locale;
          const href = getLocaleHref(locale);
          return (
            <a
              key={locale}
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={(e) => {
                if (active) {
                  e.preventDefault();
                  onSelect?.();
                  return;
                }
                e.preventDefault();
                switchTo(locale);
                onSelect?.();
              }}
              className={cn(
                "flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-(--color-accent-purple) text-white"
                  : "text-(--color-text-secondary) hover:bg-white/[0.06] hover:text-(--color-text-primary)"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Globe className="h-3.5 w-3.5" />
              )}
              <span>{localeLabels[locale]}</span>
            </a>
          );
        })}
      </div>

      {currentLocale === "fa" && (
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-(--color-border-subtle) bg-black/30 p-1">
          {numeralOptions.map((option) => {
            const active = option.value === numerals;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  chooseNumerals(option.value);
                }}
                className={cn(
                  "flex min-h-[40px] items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-(--color-accent-orange)/20 text-(--color-accent-orange) ring-1 ring-(--color-accent-orange)/40"
                    : "text-(--color-text-secondary) hover:bg-white/[0.06] hover:text-(--color-text-primary)"
                )}
              >
                <span>{option.label}</span>
                <span className="font-[family-name:var(--font-mono)] opacity-75" dir="ltr">
                  {option.sample}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
