"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search as SearchIcon, X, SearchX, Loader2 } from "lucide-react";
import { ArticleCard } from "@/components/article/article-card";
import { ScrollReveal } from "@/components/animations/scroll-reveal";
import { formatCount } from "@/lib/utils";
import { useNumerals } from "@/components/i18n/numerals-provider";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function SearchClient({
  trendingTags,
  initialQuery = "",
  initialResults = [],
  locale,
  dict,
}: {
  trendingTags: string[];
  initialQuery?: string;
  initialResults?: Article[];
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { numerals } = useNumerals();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Article[]>(initialResults);
  const [loading, setLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState(initialQuery);
  const isFirstRun = useRef(true);

  const updateQuery = (next: string) => {
    setQuery(next);
    const trimmed = next.trim();
    if (!trimmed) {
      setResults([]);
      setSearchedQuery("");
      setLoading(false);
    } else {
      setLoading(true);
    }
  };

  useEffect(() => {
    const trimmed = query.trim();

    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (trimmed === initialQuery) return;
    }

    const nextUrl = trimmed ? `${pathname}?q=${encodeURIComponent(trimmed)}` : pathname;
    router.replace(nextUrl, { scroll: false });

    if (!trimmed) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/search?locale=${encodeURIComponent(locale)}&q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as { items: Article[] };
        setResults(data.items);
        setSearchedQuery(trimmed);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setResults([]);
          setSearchedQuery(trimmed);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, locale, pathname, router, initialQuery]);

  return (
    <div>
      <div className="relative mb-10">
        <SearchIcon className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-5 h-5 w-5 text-(--color-text-tertiary)" />
        <input
          autoFocus
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          placeholder={dict.nav.searchPlaceholder}
          aria-label={dict.search.title}
          className="glass-panel h-16 w-full rounded-2xl ps-14 pe-14 text-lg text-(--color-text-primary) outline-none transition-shadow focus:border-(--color-accent-purple) focus:shadow-[0_0_0_4px_rgba(123,63,251,0.15)] placeholder:text-(--color-text-tertiary)"
        />
        {loading ? (
          <Loader2 className="absolute top-1/2 -translate-y-1/2 end-5 h-5 w-5 animate-spin text-(--color-accent-purple)" />
        ) : (
          query && (
            <button
              type="button"
              onClick={() => updateQuery("")}
              aria-label={locale === "fa" ? "پاک کردن جستجو" : "Clear search"}
              className="absolute top-1/2 -translate-y-1/2 end-5 flex h-8 w-8 items-center justify-center rounded-full text-(--color-text-tertiary) transition-colors hover:bg-white/10 hover:text-(--color-text-primary)"
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {!query.trim() && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-(--color-text-tertiary)">
            {dict.search.trending}
          </p>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => updateQuery(tag)}
                className="rounded-full border border-(--color-border-subtle) px-4 py-2 text-sm text-(--color-text-secondary) transition-colors hover:border-(--color-accent-purple)/50 hover:text-(--color-text-primary)"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && searchedQuery && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] text-(--color-text-tertiary)">
            <SearchX className="h-6 w-6" />
          </span>
          <p className="text-(--color-text-tertiary)">{dict.search.noResults}</p>
          <p className="text-sm text-(--color-text-tertiary)">
            {locale === "fa" ? `«${searchedQuery}»` : `"${searchedQuery}"`}
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <p className="mb-5 text-sm text-(--color-text-tertiary)">
            {locale === "fa"
              ? `${formatCount(results.length, locale, numerals)} نتیجه برای «${searchedQuery}»`
              : `${formatCount(results.length, locale, numerals)} results for "${searchedQuery}"`}
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((article, i) => (
              <ScrollReveal key={article.slug} delay={Math.min(i, 5) * 60}>
                <ArticleCard article={article} locale={locale} dict={dict} size="large" />
              </ScrollReveal>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
