/**
 * Helpers for converting between ISO-8601 timestamps and SQL UTC DATETIME strings
 * (`YYYY-MM-DD HH:MM:SS`) compatible with both MySQL `DATETIME` and SQLite `datetime('now')`.
 */

/**
 * Formats an ISO-8601 string or Date into a UTC SQL DATETIME string (`YYYY-MM-DD HH:MM:SS`).
 * Returns null if the input is null/undefined/empty or invalid.
 */
export function toSqlUtcDateTime(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Already normalized SQL UTC format
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 19).replace("T", " ");
  }
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Parses a SQL UTC DATETIME string (`YYYY-MM-DD HH:MM:SS`) or ISO-8601 string strictly as UTC.
 * Avoids the JS `new Date("YYYY-MM-DD HH:MM:SS")` local-timezone pitfall.
 */
export function parseSqlUtcDate(raw: string | Date | null | undefined): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
    normalized = `${trimmed.replace(" ", "T")}Z`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
    normalized = `${trimmed}Z`;
  }

  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Checks whether a database error represents a duplicate `(locale, slug)` violation
 * across both MySQL (`uq_locale_slug`) and SQLite (`UNIQUE constraint failed: article_translations...`).
 */
export function isArticleSlugConflictError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    message.includes("uq_locale_slug") ||
    (message.includes("UNIQUE constraint failed") && message.includes("article_translations"))
  );
}
