import type { Locale } from "./config";

/**
 * Which digits Persian readers see: ۰۱۲۳ or 0123.
 *
 * Persian prose conventionally uses Persian-Indic digits, but plenty of
 * readers — especially anyone working with data, code, or citations — find
 * them harder to scan. English has no such choice, so the preference only
 * ever applies under `dir="rtl"`.
 */
export type Numerals = "fa" | "latn";

export const NUMERALS_COOKIE = "scienta-numerals";
export const DEFAULT_NUMERALS: Numerals = "fa";

/** A year, so the choice survives; readable by the server on the next request. */
export const NUMERALS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isNumerals(value: unknown): value is Numerals {
  return value === "fa" || value === "latn";
}

export function parseNumerals(value: string | undefined): Numerals {
  return isNumerals(value) ? value : DEFAULT_NUMERALS;
}

/**
 * The BCP-47 tag to hand Intl.
 *
 * `-u-nu-latn` swaps only the numbering system: the Jalali calendar, the month
 * names, and compact forms ("۲۴ هزار") all survive, and the group separator
 * follows the digits — ٬ with Persian numerals, , with Latin ones.
 */
export function intlLocale(locale: Locale, numerals: Numerals): string {
  if (locale !== "fa") return "en-US";
  return numerals === "latn" ? "fa-IR-u-nu-latn" : "fa-IR";
}
