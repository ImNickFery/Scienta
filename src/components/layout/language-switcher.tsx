"use client";

import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { locales, localeLabels, type Locale } from "@/lib/i18n/config";
import { resolveLocaleSwitchPath } from "@/lib/i18n/switch-path";
import { useNumerals } from "@/components/i18n/numerals-provider";
import type { Numerals } from "@/lib/i18n/numerals";

const numeralOptions: { value: Numerals; label: string; sample: string }[] = [
  { value: "fa", label: "ارقام فارسی", sample: "۱۲۳" },
  { value: "latn", label: "ارقام انگلیسی", sample: "123" },
];

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const { numerals, setNumerals } = useNumerals();

  function switchTo(locale: Locale) {
    if (locale === currentLocale) return;
    const altLink = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${locale}"]`);
    const target = resolveLocaleSwitchPath(pathname, locale, altLink?.getAttribute("href"));
    router.push(target);
  }

  function chooseNumerals(next: Numerals) {
    if (next === numerals) return;
    setNumerals(next);
    // The <html> attribute retypes what is already painted; this re-runs the
    // Server Components so Intl emits the matching digits and separator.
    router.refresh();
  }

  return (
    <div className="group relative">
      <button
        className="flex h-10 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-3 text-sm text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
        aria-haspopup="listbox"
        aria-label="Change language"
      >
        <Globe className="h-4 w-4" />
        {localeLabels[currentLocale]}
      </button>
      <div className="invisible absolute end-0 top-full z-50 mt-2 min-w-[11rem] rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-1.5 opacity-0 shadow-2xl transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        {locales.map((locale) => (
          <button
            key={locale}
            onClick={() => switchTo(locale)}
            className={`w-full rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-white/5 ${
              locale === currentLocale ? "text-(--color-accent-orange)" : "text-(--color-text-secondary)"
            }`}
          >
            {localeLabels[locale]}
          </button>
        ))}

        {/* English has no second numeral system in common use, so the choice
            only appears where it means something. */}
        {currentLocale === "fa" && (
          <div className="mt-1.5 border-t border-(--color-border-subtle) pt-1.5">
            <p className="px-3 pb-1 text-[11px] text-(--color-text-tertiary)">شکل اعداد</p>
            {numeralOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => chooseNumerals(option.value)}
                aria-pressed={option.value === numerals}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-white/5 ${
                  option.value === numerals
                    ? "text-(--color-accent-orange)"
                    : "text-(--color-text-secondary)"
                }`}
              >
                <span>{option.label}</span>
                {/* Both samples have to show their own numerals no matter what
                    is selected. The mono stack is what guarantees it: JetBrains
                    has no ss01, so "123" stays Latin even while ss01 is on, and
                    it has no Persian digits either, so "۱۲۳" falls through to
                    Vazirmatn and renders Persian. */}
                <span
                  className="font-[family-name:var(--font-mono)] text-xs text-(--color-text-tertiary)"
                  dir="ltr"
                >
                  {option.sample}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
