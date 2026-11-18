"use client";

import { useMemo, useState } from "react";
import { Search as SearchIcon, X, SearchX } from "lucide-react";
import { ArticleCard } from "@/components/article/article-card";
import { ScrollReveal } from "@/components/animations/scroll-reveal";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function SearchClient({
  articles,
  locale,
  dict,
}: {
  articles: Article[];
  locale: Locale;
  dict: Dictionary;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [articles, query]);

  const trendingTags = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => a.tags.forEach((t) => set.add(t)));
    return Array.from(set).slice(0, 8);
  }, [articles]);

  return (
    <div>
      <div className="relative mb-10">
        <SearchIcon className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-5 h-5 w-5 text-(--color-text-tertiary)" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.nav.searchPlaceholder}
          className="glass-panel h-16 w-full rounded-2xl ps-14 pe-14 text-lg text-(--color-text-primary) outline-none transition-shadow focus:border-(--color-accent-purple) focus:shadow-[0_0_0_4px_rgba(123,63,251,0.15)] placeholder:text-(--color-text-tertiary)"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label={locale === "fa" ? "پاک کردن جستجو" : "Clear search"}
            className="absolute top-1/2 -translate-y-1/2 end-5 flex h-8 w-8 items-center justify-center rounded-full text-(--color-text-tertiary) transition-colors hover:bg-white/10 hover:text-(--color-text-primary)"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!query && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-(--color-text-tertiary)">
            {dict.search.trending}
          </p>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setQuery(tag)}
                className="rounded-full border border-(--color-border-subtle) px-4 py-2 text-sm text-(--color-text-secondary) transition-colors hover:border-(--color-accent-purple)/50 hover:text-(--color-text-primary)"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {query && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] text-(--color-text-tertiary)">
            <SearchX className="h-6 w-6" />
          </span>
          <p className="text-(--color-text-tertiary)">{dict.search.noResults}</p>
          <p className="text-sm text-(--color-text-tertiary)">
            {locale === "fa" ? `«${query}»` : `"${query}"`}
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <p className="mb-5 text-sm text-(--color-text-tertiary)">
            {locale === "fa" ? `${results.length} نتیجه برای «${query}»` : `${results.length} results for "${query}"`}
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
