import type { Locale } from "./i18n/config";

export interface NavLinkItem {
  href: string;
  label: string;
  key: "articles" | "fields" | "categories" | "tags" | "authors" | "about" | "contact";
}

/**
 * Checks whether a navigation link matches the current pathname,
 * supporting nested sub-routes while avoiding partial segment matches.
 */
export function isNavLinkActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname || !href) return false;
  const cleanPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const cleanHref = href.endsWith("/") && href.length > 1 ? href.slice(0, -1) : href;
  return cleanPath === cleanHref || cleanPath.startsWith(`${cleanHref}/`);
}

/**
 * Builds a clean search URL for the active locale, stripping excess whitespace.
 */
export function buildSearchHref(locale: Locale, rawQuery: string): string {
  const trimmed = rawQuery.trim();
  if (!trimmed) return `/${locale}/search`;
  return `/${locale}/search?q=${encodeURIComponent(trimmed)}`;
}
