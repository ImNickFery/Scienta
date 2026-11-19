import type { Locale } from "./config";

/**
 * Resolves the target pathname when switching locales.
 * If the current page declares a `<link rel="alternate" hreflang="<target>">`
 * (for example, an article whose Persian and English slugs differ), that exact
 * path is used. Otherwise, falls back to replacing the leading locale segment.
 */
export function resolveLocaleSwitchPath(
  currentPathname: string,
  targetLocale: Locale,
  alternateHref?: string | null
): string {
  if (alternateHref) {
    try {
      const parsed = new URL(alternateHref, "https://scienta.ir");
      if (parsed.pathname.startsWith(`/${targetLocale}/`) || parsed.pathname === `/${targetLocale}`) {
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      // Fall through to segment replacement.
    }
  }

  const segments = currentPathname.split("/");
  segments[1] = targetLocale;
  return segments.join("/") || `/${targetLocale}`;
}
