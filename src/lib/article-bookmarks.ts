const STORAGE_KEY = "scienta_bookmarked_articles";

/** Pure toggle helper for deterministic unit testing and state updates. */
export function toggleBookmarkList(list: readonly string[], slug: string): { next: string[]; saved: boolean } {
  if (list.includes(slug)) {
    return { next: list.filter((item) => item !== slug), saved: false };
  }
  return { next: [...list, slug], saved: true };
}

export function getBookmarkedArticles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeBookmarks(slugs: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // Ignore private-browsing/quota errors gracefully.
  }
}

export function isArticleBookmarked(slug: string): boolean {
  return getBookmarkedArticles().includes(slug);
}

export function toggleArticleBookmark(slug: string): boolean {
  const { next, saved } = toggleBookmarkList(getBookmarkedArticles(), slug);
  writeBookmarks(next);
  return saved;
}
