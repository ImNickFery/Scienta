const STORAGE_KEY = "scienta_bookmarked_equations";

function readAll(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeAll(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable (private browsing, quota) — bookmarking silently
    // no-ops rather than throwing and breaking the reading experience.
  }
}

/** Builds the storage key for a specific equation within a specific article. */
export function equationKey(articleSlug: string, equationId: string): string {
  return `${articleSlug}:${equationId}`;
}

export function isEquationBookmarked(key: string): boolean {
  return readAll().includes(key);
}

export function toggleEquationBookmark(key: string): boolean {
  const all = readAll();
  const idx = all.indexOf(key);
  if (idx === -1) {
    writeAll([...all, key]);
    return true;
  }
  all.splice(idx, 1);
  writeAll(all);
  return false;
}
