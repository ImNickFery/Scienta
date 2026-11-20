import { defaultLocale, isValidLocale, type Locale } from "@/lib/i18n/config";

const GENERIC_SEGMENTS = new Set([
  "fa",
  "en",
  "articles",
  "article",
  "fields",
  "field",
  "categories",
  "category",
  "tags",
  "tag",
  "authors",
  "author",
  "search",
  "about",
  "contact",
  "saved",
  "privacy",
  "terms",
  "page",
  "index",
]);

/** Extracts the active locale from a URL pathname, defaulting to Persian (`fa`). */
export function resolveLocaleFromPathname(pathname: string | null | undefined): Locale {
  if (!pathname) return defaultLocale;
  const firstSegment = pathname.replace(/^\/+/, "").split("/")[0]?.toLowerCase();
  if (firstSegment && isValidLocale(firstSegment)) {
    return firstSegment;
  }
  return defaultLocale;
}

/**
 * Safely decodes percent-encoded UTF-8 paths (including Persian slugs), strips
 * control characters, and truncates overly long paths for clean UI display.
 */
export function formatMissingPath(
  pathname: string | null | undefined,
  maxLength = 72
): string | null {
  if (!pathname || typeof pathname !== "string") return null;
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") return null;

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }

  const cleaned = decoded.replace(/[\x00-\x1f\x7f]/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(12, maxLength - 1))}…`;
}

/**
 * Derives a human-readable search query suggestion from the deepest meaningful
 * segment of a missing URL (e.g. `/en/articles/quantum-gravity` -> `"quantum gravity"`).
 */
export function extractQueryHintFromPath(pathname: string | null | undefined): string {
  const formatted = formatMissingPath(pathname, 160);
  if (!formatted) return "";

  const segments = formatted
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (GENERIC_SEGMENTS.has(segment.toLowerCase())) continue;

    const normalized = segment
      .replace(/\.[a-z0-9]{1,5}$/i, "")
      .replace(/[-_+]+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (normalized.length >= 2 && normalized.length <= 60 && !/^\d+$/.test(normalized)) {
      return normalized;
    }
  }

  return "";
}

/**
 * Computes radial distance in Schwarzschild-radius units (`r / r_s`) for the
 * interactive observatory coordinate reticle on the 404 page.
 */
export function computeHorizonRadius(
  dx: number,
  dy: number,
  horizonRadiusPx: number
): { ratio: number; insideHorizon: boolean } {
  const safeHorizon = Math.max(1, horizonRadiusPx);
  const distance = Math.hypot(dx, dy);
  const ratio = Number((distance / safeHorizon).toFixed(2));
  return {
    ratio,
    insideHorizon: distance <= safeHorizon,
  };
}
