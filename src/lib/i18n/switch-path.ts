import type { Locale } from "./config";

function normalizePathname(pathname: string): string {
  const clean = pathname.trim() || "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function normalizeSearch(search?: string | null): string {
  if (!search) return "";
  const trimmed = search.trim();
  if (!trimmed || trimmed === "?") return "";
  return trimmed.startsWith("?") ? trimmed : `?${trimmed}`;
}

/**
 * Resolves the target pathname (plus query string) when switching locales.
 * If the current page declares a `<link rel="alternate" hreflang="<target>">`
 * for an article (whose Persian and English slugs may differ) or matching
 * non-root path, that exact path is used. Otherwise, falls back to replacing
 * the leading locale segment while preserving any current query parameters.
 */
export function resolveLocaleSwitchPath(
  currentPathname: string,
  targetLocale: Locale,
  alternateHref?: string | null,
  currentSearch?: string | null
): string {
  const safePath = normalizePathname(currentPathname);
  const fallbackSearch = normalizeSearch(currentSearch);
  const isCurrentRoot = /^\/(fa|en)\/?$/.test(safePath) || safePath === "/";
  const isArticleDetail = /^\/(fa|en)\/articles\/[^/]+\/?$/.test(safePath);

  if (alternateHref) {
    try {
      const parsed = new URL(alternateHref, "https://scienta.ir");
      const matchesLocale =
        parsed.pathname.startsWith(`/${targetLocale}/`) || parsed.pathname === `/${targetLocale}`;
      const isAltRoot = parsed.pathname === `/${targetLocale}` || parsed.pathname === `/${targetLocale}/`;
      const isAltArticleDetail = new RegExp(`^/${targetLocale}/articles/[^/]+/?$`).test(parsed.pathname);

      const allowAlternate =
        matchesLocale &&
        (isArticleDetail ? isAltArticleDetail : isCurrentRoot || !isAltRoot);

      if (allowAlternate) {
        const search = parsed.search || fallbackSearch;
        return `${parsed.pathname}${search}`;
      }
    } catch {
      // Fall through to segment replacement.
    }
  }

  const segments = safePath.split("/");
  if (segments[1] === "fa" || segments[1] === "en") {
    segments[1] = targetLocale;
  } else {
    segments.splice(1, 0, targetLocale);
  }
  const base = segments.join("/") || `/${targetLocale}`;
  return `${base}${fallbackSearch}`;
}

