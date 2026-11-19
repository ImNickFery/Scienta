import { BOOKMARKS_CHANGED_EVENT } from "@/lib/article-bookmarks";

const STORAGE_KEY = "scienta_bookmarked_equations";
const META_STORAGE_KEY = "scienta_bookmarked_equations_meta";

export interface SavedEquationRecord {
  key: string;
  articleSlug: string;
  articleTitle?: string;
  equationId: string;
  index: number;
  latex: string;
  savedAt: string;
}

/** Pure helper to upsert equation metadata cleanly for deterministic tests. */
export function upsertEquationMeta(
  list: readonly SavedEquationRecord[],
  record: SavedEquationRecord
): SavedEquationRecord[] {
  const filtered = list.filter((item) => item.key !== record.key);
  return [record, ...filtered];
}

/** Pure helper to remove an equation metadata record by key. */
export function removeEquationMeta(
  list: readonly SavedEquationRecord[],
  key: string
): SavedEquationRecord[] {
  return list.filter((item) => item.key !== key);
}

function readAll(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeAll(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(BOOKMARKS_CHANGED_EVENT));
  } catch {
    // Storage unavailable (private browsing, quota) — bookmarking silently
    // no-ops rather than throwing and breaking the reading experience.
  }
}

function readMeta(): SavedEquationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is SavedEquationRecord =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as SavedEquationRecord).key === "string" &&
            typeof (item as SavedEquationRecord).latex === "string"
        )
      : [];
  } catch {
    return [];
  }
}

function writeMeta(records: SavedEquationRecord[]) {
  try {
    window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage failures gracefully.
  }
}

/** Builds the storage key for a specific equation within a specific article. */
export function equationKey(articleSlug: string, equationId: string): string {
  return `${articleSlug}:${equationId}`;
}

export function isEquationBookmarked(key: string): boolean {
  return readAll().includes(key);
}

export function getBookmarkedEquationKeys(): string[] {
  return readAll();
}

export function getSavedEquations(): SavedEquationRecord[] {
  const keys = readAll();
  const metaMap = new Map(readMeta().map((m) => [m.key, m]));
  return keys.map((key) => {
    const existing = metaMap.get(key);
    if (existing) return existing;
    const [articleSlug = "", equationId = "eq-1"] = key.split(":");
    const indexNum = Number(equationId.replace(/^eq-/, "")) || 1;
    return {
      key,
      articleSlug,
      equationId,
      index: indexNum,
      latex: "",
      savedAt: "",
    };
  });
}

export function toggleEquationBookmark(
  key: string,
  meta?: Omit<SavedEquationRecord, "key" | "savedAt">
): boolean {
  const all = readAll();
  const idx = all.indexOf(key);
  if (idx === -1) {
    if (meta) {
      writeMeta(
        upsertEquationMeta(readMeta(), {
          ...meta,
          key,
          savedAt: new Date().toISOString(),
        })
      );
    }
    writeAll([...all, key]);
    return true;
  }
  all.splice(idx, 1);
  writeMeta(removeEquationMeta(readMeta(), key));
  writeAll(all);
  return false;
}

export function removeEquationBookmark(key: string): void {
  const next = readAll().filter((k) => k !== key);
  writeMeta(removeEquationMeta(readMeta(), key));
  writeAll(next);
}
