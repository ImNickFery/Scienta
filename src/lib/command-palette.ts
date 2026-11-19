import type { Locale } from "@/lib/i18n/config";
import type { FieldRecord } from "@/lib/taxonomy";
import type { TagRecord } from "@/lib/content";
import type { Author } from "@/types";

export interface CommandArticleHit {
  slug: string;
  title: string;
  excerpt: string;
  field: string;
  fieldColor: string;
  authorName: string;
  readingTimeMinutes: number;
}

export interface CommandFieldHit {
  slug: string;
  name: string;
  color: string;
  articleCount: number;
}

export interface CommandTagHit {
  slug: string;
  name: string;
  count: number;
}

export interface CommandAuthorHit {
  slug: string;
  name: string;
  title: string;
}

export interface CommandQuickAction {
  id: string;
  label: string;
  subtitle: string;
  href: string;
  icon: "articles" | "fields" | "tags" | "authors" | "saved" | "search" | "locale";
}

export interface CommandPalettePayload {
  query: string;
  articles: CommandArticleHit[];
  fields: CommandFieldHit[];
  tags: CommandTagHit[];
  authors: CommandAuthorHit[];
}

export type FlattenedCommandItem =
  | { kind: "article"; id: string; href: string; data: CommandArticleHit }
  | { kind: "field"; id: string; href: string; data: CommandFieldHit }
  | { kind: "tag"; id: string; href: string; data: CommandTagHit }
  | { kind: "author"; id: string; href: string; data: CommandAuthorHit }
  | { kind: "action"; id: string; href: string; data: CommandQuickAction }
  | { kind: "full-search"; id: string; href: string; query: string };

export const RECENT_SEARCHES_KEY = "scienta_recent_searches_v1";
export const OPEN_COMMAND_PALETTE_EVENT = "scienta:open-command-palette";

/** Normalizes Persian/Arabic letter variants and trims whitespace for reliable bilingual matching. */
export function normalizeSearchText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\u064a/g, "\u06cc") // Arabic Yeh -> Persian Yeh
    .replace(/\u0643/g, "\u06a9") // Arabic Kaf -> Persian Kaf
    .replace(/\u200c/g, " ")      // ZWNJ -> space for forgiving Persian queries
    .replace(/\s+/g, " ");
}

function matchesQuery(needle: string, candidates: Array<string | null | undefined>): boolean {
  if (!needle) return true;
  const compactNeedle = needle.replace(/\s+/g, "");
  return candidates.some((c) => {
    if (!c) return false;
    const norm = normalizeSearchText(c);
    return norm.includes(needle) || norm.replace(/\s+/g, "").includes(compactNeedle);
  });
}

/** Filters fields, tags, and authors across both Persian and English names + slugs. */
export function filterTaxonomyForPalette(
  rawQuery: string,
  locale: Locale,
  fields: FieldRecord[],
  tags: TagRecord[],
  authors: Author[],
  limits: { fields?: number; tags?: number; authors?: number } = {}
): {
  fields: CommandFieldHit[];
  tags: CommandTagHit[];
  authors: CommandAuthorHit[];
} {
  const q = normalizeSearchText(rawQuery);
  const maxFields = limits.fields ?? 5;
  const maxTags = limits.tags ?? 6;
  const maxAuthors = limits.authors ?? 4;

  const matchedFields = fields
    .filter((f) => matchesQuery(q, [f.name.fa, f.name.en, f.slug]))
    .slice(0, maxFields)
    .map((f) => ({
      slug: f.slug,
      name: f.name[locale],
      color: f.color,
      articleCount: f.articleCount ?? 0,
    }));

  const matchedTags = tags
    .filter((t) => matchesQuery(q, [t.name.fa, t.name.en, t.slug]))
    .slice(0, maxTags)
    .map((t) => ({
      slug: t.slug,
      name: t.name[locale],
      count: t.count,
    }));

  const matchedAuthors = authors
    .filter((a) => matchesQuery(q, [a.name.fa, a.name.en, a.title.fa, a.title.en, a.slug]))
    .slice(0, maxAuthors)
    .map((a) => ({
      slug: a.slug,
      name: a.name[locale],
      title: a.title[locale],
    }));

  return {
    fields: matchedFields,
    tags: matchedTags,
    authors: matchedAuthors,
  };
}

/** Quick navigation actions shown when the command palette opens with an empty query. */
export function buildQuickActions(locale: Locale): CommandQuickAction[] {
  const isFa = locale === "fa";
  const otherLocale: Locale = isFa ? "en" : "fa";
  return [
    {
      id: "action-articles",
      label: isFa ? "مرور همه مقالات علمی" : "Browse all scientific articles",
      subtitle: isFa ? "آرشیو کامل پژوهش‌ها و یادداشت‌ها" : "Full archive of research & essays",
      href: `/${locale}/articles`,
      icon: "articles",
    },
    {
      id: "action-saved",
      label: isFa ? "کتابخانه ذخیره‌شده" : "Saved library",
      subtitle: isFa ? "مقالات و معادلات نشان‌شده شما" : "Your bookmarked articles & equations",
      href: `/${locale}/saved`,
      icon: "saved",
    },
    {
      id: "action-tags",
      label: isFa ? "فهرست برچسب‌های علمی" : "Explore scientific tags",
      subtitle: isFa ? "جستجو بر اساس موضوعات تخصصی" : "Browse topics and sub-disciplines",
      href: `/${locale}/tags`,
      icon: "tags",
    },
    {
      id: "action-authors",
      label: isFa ? "نویسندگان و پژوهشگران" : "Authors & researchers",
      subtitle: isFa ? "مشاهده پروفایل و مقالات نویسندگان" : "Profiles and published essays",
      href: `/${locale}/authors`,
      icon: "authors",
    },
    {
      id: "action-locale",
      label: isFa ? "تغییر زبان به English" : "Switch language to فارسی",
      subtitle: isFa ? "ورود به نسخه انگلیسی ساینتا" : "Open Persian edition of Scienta",
      href: `/${otherLocale}`,
      icon: "locale",
    },
  ];
}

/** Flattens categorized palette results into a single linear list for keyboard navigation. */
export function flattenCommandItems(
  locale: Locale,
  payload: CommandPalettePayload,
  includeQuickActions: boolean
): FlattenedCommandItem[] {
  const items: FlattenedCommandItem[] = [];

  for (const article of payload.articles) {
    items.push({
      kind: "article",
      id: `article:${article.slug}`,
      href: `/${locale}/articles/${article.slug}`,
      data: article,
    });
  }

  for (const field of payload.fields) {
    items.push({
      kind: "field",
      id: `field:${field.slug}`,
      href: `/${locale}/fields/${field.slug}`,
      data: field,
    });
  }

  for (const tag of payload.tags) {
    items.push({
      kind: "tag",
      id: `tag:${tag.slug}`,
      href: `/${locale}/tags/${tag.slug}`,
      data: tag,
    });
  }

  for (const author of payload.authors) {
    items.push({
      kind: "author",
      id: `author:${author.slug}`,
      href: `/${locale}/authors/${author.slug}`,
      data: author,
    });
  }

  if (includeQuickActions) {
    for (const action of buildQuickActions(locale)) {
      items.push({
        kind: "action",
        id: action.id,
        href: action.href,
        data: action,
      });
    }
  }

  const trimmed = payload.query.trim();
  if (trimmed) {
    items.push({
      kind: "full-search",
      id: "action:full-search",
      href: `/${locale}/search?q=${encodeURIComponent(trimmed)}`,
      query: trimmed,
    });
  }

  return items;
}

/** Deterministic wrap-around cursor movement for keyboard Up/Down navigation. */
export function stepActiveIndex(current: number, delta: 1 | -1, total: number): number {
  if (total <= 0) return -1;
  if (current < 0 || current >= total) {
    return delta === 1 ? 0 : total - 1;
  }
  return (current + delta + total) % total;
}

/** Parses persisted recent search strings safely from localStorage JSON. */
export function parseRecentSearches(raw: string | null | undefined, max = 5): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "string") continue;
      const trimmed = entry.trim().slice(0, 80);
      const key = normalizeSearchText(trimmed);
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Prepends a query to the recent search list with case/variant deduplication and max cap. */
export function pushRecentSearch(history: string[], rawQuery: string, max = 5): string[] {
  const trimmed = rawQuery.trim().slice(0, 80);
  if (!trimmed) return history.slice(0, max);
  const key = normalizeSearchText(trimmed);
  const filtered = history.filter((item) => normalizeSearchText(item) !== key);
  return [trimmed, ...filtered].slice(0, max);
}
