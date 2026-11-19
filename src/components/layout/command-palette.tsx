"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpLeft,
  ArrowUpRight,
  BookOpen,
  Clock,
  Compass,
  CornerDownLeft,
  Hash,
  Languages,
  Loader2,
  Search,
  Trash2,
  User,
  Bookmark,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/lib/i18n/config";
import type { FieldRecord } from "@/lib/taxonomy";
import { writeClientCookie } from "@/components/i18n/numerals-provider";
import { resolveClientLocaleHref } from "@/components/layout/language-switcher";
import {
  OPEN_COMMAND_PALETTE_EVENT,
  RECENT_SEARCHES_KEY,
  flattenCommandItems,
  parseRecentSearches,
  pushRecentSearch,
  stepActiveIndex,
  type CommandPalettePayload,
  type CommandQuickAction,
  type FlattenedCommandItem,
} from "@/lib/command-palette";

function makeInitialPayload(locale: Locale, fields: FieldRecord[]): CommandPalettePayload {
  return {
    query: "",
    articles: [],
    fields: fields.slice(0, 4).map((f) => ({
      slug: f.slug,
      name: f.name[locale],
      color: f.color,
      articleCount: f.articleCount ?? 0,
    })),
    tags: [],
    authors: [],
  };
}

export function CommandPalette({
  locale,
  fields,
}: {
  locale: Locale;
  fields: FieldRecord[];
}) {
  const isFa = locale === "fa";
  const router = useRouter();
  const pathname = usePathname();
  const CornerArrow = isFa ? ArrowUpLeft : ArrowUpRight;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [payload, setPayload] = useState<CommandPalettePayload>(() =>
    makeInitialPayload(locale, fields)
  );
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const defaultCacheRef = useRef<Record<string, CommandPalettePayload>>({});

  // Load recent searches once on client
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates recent searches from localStorage on mount
      setRecentSearches(parseRecentSearches(saved));
    } catch {
      // ignore storage errors
    }
  }, []);

  // Close palette on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- closes modal when navigation settles
    setOpen(false);
  }, [pathname]);

  // Global Cmd/Ctrl + K shortcut & custom open event
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onCustomOpen = () => setOpen(true);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onCustomOpen);
    };
  }, []);

  // Lock background scroll, handle global Escape, & autofocus input when opened
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onEscape);
    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Fetch categorized hits from API route with debounce & abort control
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();

    if (!trimmed && defaultCacheRef.current[locale]) {
      setPayload(defaultCacheRef.current[locale]);
      setLoading(false);
      setError(false);
      setActiveIndex(0);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);

    const delay = trimmed ? 160 : 0;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/command-palette?locale=${encodeURIComponent(locale)}&q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as CommandPalettePayload;
        if (!trimmed) {
          defaultCacheRef.current[locale] = data;
        }
        setPayload(data);
        setActiveIndex(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, delay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, locale]);

  const showQuickActions = query.trim().length === 0;

  const flatItems = useMemo(
    () => flattenCommandItems(locale, payload, showQuickActions),
    [locale, payload, showQuickActions]
  );

  // Build index lookup for rendering grouped sections cleanly
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    flatItems.forEach((item, idx) => map.set(item.id, idx));
    return map;
  }, [flatItems]);

  // Keep active row scrolled into view during arrow-key navigation
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const activeEl = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${activeIndex}"]`
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const persistQuery = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = pushRecentSearch(prev, trimmed, 5);
      try {
        window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentSearches([]);
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const navigateToItem = useCallback(
    (item: FlattenedCommandItem) => {
      if (query.trim()) {
        persistQuery(query);
      }
      closePalette();
      if (item.id === "action-locale") {
        const targetLocale: Locale = locale === "fa" ? "en" : "fa";
        writeClientCookie(LOCALE_COOKIE, targetLocale, LOCALE_COOKIE_MAX_AGE);
        window.location.assign(resolveClientLocaleHref(pathname, targetLocale));
        return;
      }
      router.push(item.href);
    },
    [closePalette, locale, pathname, persistQuery, query, router]
  );

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => stepActiveIndex(prev, 1, flatItems.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => stepActiveIndex(prev, -1, flatItems.length));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = flatItems[activeIndex] ?? flatItems[0];
      if (target) {
        navigateToItem(target);
      } else if (query.trim()) {
        persistQuery(query);
        closePalette();
        router.push(`/${locale}/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  if (!open) return null;

  const hasTypedQuery = query.trim().length > 0;
  const hasAnyMatches =
    payload.articles.length > 0 ||
    payload.fields.length > 0 ||
    payload.tags.length > 0 ||
    payload.authors.length > 0;

  const quickActions = showQuickActions
    ? flatItems.filter((item): item is Extract<FlattenedCommandItem, { kind: "action" }> => item.kind === "action")
    : [];

  const fullSearchItem = flatItems.find(
    (item): item is Extract<FlattenedCommandItem, { kind: "full-search" }> => item.kind === "full-search"
  );

  const renderQuickActionIcon = (icon: CommandQuickAction["icon"]) => {
    switch (icon) {
      case "articles":
        return <BookOpen className="h-4 w-4 text-(--color-accent-purple)" />;
      case "saved":
        return <Bookmark className="h-4 w-4 text-(--color-accent-orange)" />;
      case "tags":
        return <Hash className="h-4 w-4 text-(--color-accent-purple)" />;
      case "authors":
        return <User className="h-4 w-4 text-(--color-accent-orange)" />;
      case "locale":
        return <Languages className="h-4 w-4 text-(--color-text-secondary)" />;
      default:
        return <Compass className="h-4 w-4 text-(--color-text-secondary)" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center px-3 pt-3 sm:px-6 sm:pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label={isFa ? "جستجوی سریع جهانی" : "Quick global search"}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Dialog panel */}
      <div className="relative z-10 flex max-h-[82dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-(--color-border-strong) bg-[#0B0C14]/98 shadow-[0_32px_90px_-20px_rgba(0,0,0,0.9)] sm:max-h-[74vh]">
        {/* Search Input Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-(--color-border-subtle) px-4 py-3">
          {loading ? (
            <Loader2
              className="h-5 w-5 shrink-0 animate-spin text-(--color-accent-purple)"
              aria-hidden="true"
            />
          ) : (
            <Search
              className="h-5 w-5 shrink-0 text-(--color-text-tertiary)"
              aria-hidden="true"
            />
          )}

          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-autocomplete="list"
            aria-label={
              isFa
                ? "جستجو در مقالات، حوزه‌ها، برچسب‌ها و نویسندگان"
                : "Search articles, fields, tags, and authors"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={
              isFa
                ? "جستجوی مقاله، حوزه یا نویسنده..."
                : "Search articles, fields, or authors..."
            }
            className="min-w-0 flex-1 bg-transparent text-base text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none sm:text-sm"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="flex h-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-medium text-(--color-text-tertiary) transition-colors hover:bg-white/[0.06] hover:text-(--color-text-primary)"
            >
              {isFa ? "پاک کردن" : "Clear"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={isFa ? "بستن جستجوی سریع" : "Close quick search"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) sm:h-9 sm:w-9"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Results Region */}
        <div
          id="command-palette-results"
          ref={listRef}
          role="listbox"
          className="flex-1 overflow-y-auto overscroll-contain px-2 py-2.5 sm:px-3"
        >
          {/* Recent searches when query is empty */}
          {!hasTypedQuery && recentSearches.length > 0 && (
            <div className="mb-3 px-2 pt-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-(--color-text-tertiary)">
                  {isFa ? "جستجوهای اخیر" : "Recent searches"}
                </span>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="inline-flex items-center gap-1 text-xs text-(--color-text-tertiary) transition-colors hover:text-(--color-text-primary)"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{isFa ? "پاک‌سازی" : "Clear"}</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setQuery(term);
                      inputRef.current?.focus();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-white/[0.03] px-2.5 py-1.5 text-xs text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:bg-white/[0.06] hover:text-(--color-text-primary)"
                  >
                    <Clock className="h-3 w-3 opacity-60" />
                    <span>{term}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mx-2 my-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {isFa
                ? "خطا در بارگذاری نتایج جستجو. لطفاً دوباره تلاش کنید."
                : "Could not load search results. Please try again."}
            </div>
          )}

          {/* Articles Group */}
          {payload.articles.length > 0 && (
            <div className="mb-3">
              <div className="px-3 py-1.5 text-xs font-semibold text-(--color-text-tertiary)">
                {hasTypedQuery
                  ? isFa
                    ? "مقالات علمی"
                    : "Scientific articles"
                  : isFa
                    ? "تازه‌ترین و برگزیده‌ها"
                    : "Featured & latest articles"}
              </div>
              <div className="space-y-0.5">
                {payload.articles.map((article) => {
                  const id = `article:${article.slug}`;
                  const idx = indexById.get(id) ?? -1;
                  const isActive = idx === activeIndex;
                  const flatItem = flatItems[idx];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-cmd-index={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => flatItem && navigateToItem(flatItem)}
                      className={cn(
                        "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                        isActive
                          ? "bg-(--color-accent-purple)/16 text-(--color-text-primary)"
                          : "text-(--color-text-secondary) hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-xs"
                          style={{ backgroundColor: article.fieldColor }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-(--color-text-primary)">
                            {article.title}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-(--color-text-tertiary)">
                            {article.authorName && <span>{article.authorName}</span>}
                            {article.authorName && <span aria-hidden="true">·</span>}
                            <span className="tabular-nums">
                              {isFa
                                ? `${article.readingTimeMinutes} دقیقه مطالعه`
                                : `${article.readingTimeMinutes} min read`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <CornerArrow
                        className={cn(
                          "h-4 w-4 shrink-0 transition-opacity",
                          isActive ? "text-(--color-accent-purple) opacity-100" : "opacity-30"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fields Group */}
          {payload.fields.length > 0 && (
            <div className="mb-3">
              <div className="px-3 py-1.5 text-xs font-semibold text-(--color-text-tertiary)">
                {isFa ? "حوزه‌های علمی" : "Scientific fields"}
              </div>
              <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                {payload.fields.map((field) => {
                  const id = `field:${field.slug}`;
                  const idx = indexById.get(id) ?? -1;
                  const isActive = idx === activeIndex;
                  const flatItem = flatItems[idx];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-cmd-index={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => flatItem && navigateToItem(flatItem)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-start transition-colors",
                        isActive
                          ? "bg-(--color-accent-purple)/16 text-(--color-text-primary)"
                          : "text-(--color-text-secondary) hover:bg-white/[0.04]"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-xs"
                          style={{ backgroundColor: field.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate text-sm font-medium text-(--color-text-primary)">
                          {field.name}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular-nums text-(--color-text-tertiary)",
                          !isFa && "font-[family-name:var(--font-mono)]"
                        )}
                      >
                        {isFa ? `${field.articleCount} مقاله` : `${field.articleCount}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags Group */}
          {payload.tags.length > 0 && (
            <div className="mb-3">
              <div className="px-3 py-1.5 text-xs font-semibold text-(--color-text-tertiary)">
                {isFa ? "برچسب‌ها" : "Tags"}
              </div>
              <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                {payload.tags.map((tag) => {
                  const id = `tag:${tag.slug}`;
                  const idx = indexById.get(id) ?? -1;
                  const isActive = idx === activeIndex;
                  const flatItem = flatItems[idx];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-cmd-index={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => flatItem && navigateToItem(flatItem)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-start transition-colors",
                        isActive
                          ? "bg-(--color-accent-purple)/16 text-(--color-text-primary)"
                          : "text-(--color-text-secondary) hover:bg-white/[0.04]"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Hash className="h-3.5 w-3.5 shrink-0 text-(--color-accent-purple)" />
                        <span className="truncate text-sm text-(--color-text-primary)">
                          {tag.name}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular-nums text-(--color-text-tertiary)",
                          !isFa && "font-[family-name:var(--font-mono)]"
                        )}
                      >
                        {tag.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Authors Group */}
          {payload.authors.length > 0 && (
            <div className="mb-3">
              <div className="px-3 py-1.5 text-xs font-semibold text-(--color-text-tertiary)">
                {isFa ? "نویسندگان" : "Authors"}
              </div>
              <div className="space-y-0.5">
                {payload.authors.map((author) => {
                  const id = `author:${author.slug}`;
                  const idx = indexById.get(id) ?? -1;
                  const isActive = idx === activeIndex;
                  const flatItem = flatItems[idx];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-cmd-index={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => flatItem && navigateToItem(flatItem)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start transition-colors",
                        isActive
                          ? "bg-(--color-accent-purple)/16 text-(--color-text-primary)"
                          : "text-(--color-text-secondary) hover:bg-white/[0.04]"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <User className="h-4 w-4 shrink-0 text-(--color-accent-orange)" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-(--color-text-primary)">
                            {author.name}
                          </span>
                          {author.title && (
                            <span className="block truncate text-xs text-(--color-text-tertiary)">
                              {author.title}
                            </span>
                          )}
                        </span>
                      </span>
                      <CornerArrow
                        className={cn(
                          "h-4 w-4 shrink-0 transition-opacity",
                          isActive ? "text-(--color-accent-purple) opacity-100" : "opacity-30"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state when typed query has zero direct hits */}
          {hasTypedQuery && !loading && !hasAnyMatches && !error && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-(--color-text-primary)">
                {isFa
                  ? `نتیجه‌ای برای «${query.trim()}» پیدا نشد`
                  : `No direct matches for "${query.trim()}"`}
              </p>
              <p className="mt-1 text-xs text-(--color-text-tertiary)">
                {isFa
                  ? "می‌توانید کلید Enter را بزنید تا در کل متن مقالات جستجو شود."
                  : "Press Enter to run a full-text search across all articles."}
              </p>
            </div>
          )}

          {/* Quick Navigation Actions when query is empty */}
          {quickActions.length > 0 && (
            <div className="mb-1">
              <div className="px-3 py-1.5 text-xs font-semibold text-(--color-text-tertiary)">
                {isFa ? "دسترسی سریع" : "Quick navigation"}
              </div>
              <div className="space-y-0.5">
                {quickActions.map((item) => {
                  const idx = indexById.get(item.id) ?? -1;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-cmd-index={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => navigateToItem(item)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start transition-colors",
                        isActive
                          ? "bg-(--color-accent-purple)/16 text-(--color-text-primary)"
                          : "text-(--color-text-secondary) hover:bg-white/[0.04]"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {renderQuickActionIcon(item.data.icon)}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-(--color-text-primary)">
                            {item.data.label}
                          </span>
                          <span className="block truncate text-xs text-(--color-text-tertiary)">
                            {item.data.subtitle}
                          </span>
                        </span>
                      </span>
                      <CornerArrow
                        className={cn(
                          "h-4 w-4 shrink-0 transition-opacity",
                          isActive ? "text-(--color-accent-purple) opacity-100" : "opacity-30"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full Search Page Option when query is present */}
          {fullSearchItem && (
            <div className="mt-2 border-t border-(--color-border-subtle) pt-2">
              {(() => {
                const idx = indexById.get(fullSearchItem.id) ?? -1;
                const isActive = idx === activeIndex;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-cmd-index={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => navigateToItem(fullSearchItem)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start transition-colors",
                      isActive
                        ? "bg-(--color-accent-purple)/16 text-(--color-text-primary)"
                        : "text-(--color-text-secondary) hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Search className="h-4 w-4 shrink-0 text-(--color-accent-purple)" />
                      <span className="truncate text-sm font-medium text-(--color-text-primary)">
                        {isFa
                          ? `مشاهده همه نتایج برای «${fullSearchItem.query}»`
                          : `View all search results for "${fullSearchItem.query}"`}
                      </span>
                    </span>
                    <CornerDownLeft className="h-4 w-4 shrink-0 opacity-60" />
                  </button>
                );
              })()}
            </div>
          )}
        </div>

        {/* Clean Footer Legend */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-(--color-border-subtle) bg-black/30 px-4 py-2.5 text-xs text-(--color-text-tertiary)">
          <div className="hidden items-center gap-4 sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-(--color-border-subtle) bg-white/[0.04] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)">
                ↑↓
              </kbd>
              <span>{isFa ? "جابه‌جایی" : "Navigate"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-(--color-border-subtle) bg-white/[0.04] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)">
                ↵
              </kbd>
              <span>{isFa ? "باز کردن" : "Open"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-(--color-border-subtle) bg-white/[0.04] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-secondary)">
                Esc
              </kbd>
              <span>{isFa ? "بستن" : "Close"}</span>
            </span>
          </div>

          <span className="sm:hidden">
            {isFa ? "برای بستن بیرون پنجره ضربه بزنید" : "Tap outside to close"}
          </span>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(
                hasTypedQuery
                  ? `/${locale}/search?q=${encodeURIComponent(query.trim())}`
                  : `/${locale}/search`
              );
            }}
            className="whitespace-nowrap font-medium text-(--color-text-secondary) transition-colors hover:text-(--color-accent-purple)"
          >
            {isFa ? "صفحه جستجوی پیشرفته" : "Full search page"}
          </button>
        </div>
      </div>
    </div>
  );
}
