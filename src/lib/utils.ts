import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Locale } from "@/lib/i18n/config";
import { DEFAULT_NUMERALS, intlLocale, type Numerals } from "@/lib/i18n/numerals";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, locale: Locale, numerals: Numerals = DEFAULT_NUMERALS): string {
  return new Intl.NumberFormat(intlLocale(locale, numerals), {
    notation: n > 9999 ? "compact" : "standard",
  }).format(n);
}

/**
 * Digits in the locale's own numeral system, with no thousands separator.
 * For years, counts, and reading times — anything where grouping would be
 * wrong (a year must read ۲۰۲۶, never ۲٬۰۲۶). Use formatNumber for
 * quantities big enough to want grouping or compact notation.
 */
export function formatCount(n: number, locale: Locale, numerals: Numerals = DEFAULT_NUMERALS): string {
  return new Intl.NumberFormat(intlLocale(locale, numerals), {
    useGrouping: false,
  }).format(n);
}

/**
 * Ink that stays legible on a filled swatch: near-black or white, whichever
 * WCAG-contrasts better against `hex`.
 *
 * The field accents span too wide a luminance range for one fixed foreground
 * — white on #FF7A00 is 2.6:1 and white on #FF3C5A is 3.5:1 (both below the
 * 4.5:1 floor for small text), while near-black on #7B3FFB is only 3.8:1.
 * Choosing per colour clears 4.5:1 on all three.
 */
export function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const onDark = (luminance + 0.05) / 0.05;
  const onLight = 1.05 / (luminance + 0.05);
  return onDark >= onLight ? "#05050A" : "#FFFFFF";
}

export function formatDate(iso: string, locale: Locale, numerals: Numerals = DEFAULT_NUMERALS): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(intlLocale(locale, numerals), {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
