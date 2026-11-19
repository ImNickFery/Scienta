"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import { Bookmark, Sigma, Trash2, Copy, Check, ArrowUpRight, BookOpen } from "lucide-react";
import { ArticleCard } from "@/components/article/article-card";
import {
  BOOKMARKS_CHANGED_EVENT,
  getBookmarkedArticles,
} from "@/lib/article-bookmarks";
import {
  getSavedEquations,
  removeEquationBookmark,
  type SavedEquationRecord,
} from "@/lib/equation-bookmarks";
import { cn, formatCount } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { useNumerals } from "@/components/i18n/numerals-provider";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type SavedTab = "articles" | "equations";

const COPY = {
  fa: {
    articlesTab: "مقالات ذخیره‌شده",
    equationsTab: "معادلات ذخیره‌شده",
    emptyArticlesTitle: "هنوز مقاله‌ای ذخیره نکرده‌اید",
    emptyArticlesBody: "روی آیکون نشان روی هر مقاله کلیک کنید تا کتابخانه شخصی مطالعه‌تان ساخته شود.",
    emptyEquationsTitle: "هنوز معادله‌ای نشان نکرده‌اید",
    emptyEquationsBody: "هنگام خواندن مقالات، روی هر معادله کلیک کنید و دکمه نشان کردن را بزنید تا اینجا ذخیره شود.",
    exploreArticles: "کاوش مقالات",
    openInArticle: "باز کردن در مقاله",
    copyLatex: "کپی LaTeX",
    copied: "کپی شد",
    remove: "حذف",
    equationPrefix: "معادله",
  },
  en: {
    articlesTab: "Saved Articles",
    equationsTab: "Saved Equations",
    emptyArticlesTitle: "No saved articles yet",
    emptyArticlesBody: "Click the bookmark icon on any article card or reading page to build your personal library.",
    emptyEquationsTitle: "No saved equations yet",
    emptyEquationsBody: "Click any formula while reading an article and bookmark it in the Equation Explorer.",
    exploreArticles: "Explore articles",
    openInArticle: "Open in article",
    copyLatex: "Copy LaTeX",
    copied: "Copied",
    remove: "Remove",
    equationPrefix: "Equation",
  },
} as const;

function SavedEquationCard({
  item,
  articleTitle,
  locale,
  onRemove,
}: {
  item: SavedEquationRecord;
  articleTitle: string;
  locale: Locale;
  onRemove: (key: string) => void;
}) {
  const t = COPY[locale];
  const [copied, setCopied] = useState(false);

  const renderedHtml = useMemo(() => {
    if (!item.latex || item.latex.length > 2000) return "";
    try {
      return katex.renderToString(item.latex, {
        displayMode: true,
        throwOnError: false,
        strict: false,
        trust: false,
        maxExpand: 200,
        maxSize: 10,
      });
    } catch {
      return "";
    }
  }, [item.latex]);

  async function handleCopy() {
    if (!item.latex) return;
    if (await copyToClipboard(item.latex)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="card-elevated flex flex-col justify-between rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--color-accent-purple)/15 px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-(--color-accent-purple)">
            <Sigma className="h-3 w-3" />
            {t.equationPrefix} #{item.index}
          </span>
          <h3 className="mt-2 truncate font-[family-name:var(--font-display)] text-sm font-bold text-(--color-text-primary)">
            {articleTitle}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.key)}
          aria-label={t.remove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-tertiary) transition-colors hover:border-(--color-accent-red)/50 hover:text-(--color-accent-red)"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        dir="ltr"
        className="mb-5 flex min-h-24 items-center justify-center overflow-x-auto rounded-xl border border-(--color-border-subtle) bg-black/30 px-4 py-4"
      >
        {renderedHtml ? (
          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        ) : (
          <span className="font-[family-name:var(--font-mono)] text-xs text-(--color-text-tertiary)">
            #{item.equationId}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        {item.latex ? (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-3.5 py-1.5 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t.copied : t.copyLatex}
          </button>
        ) : (
          <span />
        )}
        <Link
          href={`/${locale}/articles/${item.articleSlug}#${item.equationId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-(--color-accent-orange) hover:underline"
        >
          {t.openInArticle}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export function SavedLibraryClient({
  articles,
  locale,
  dict,
}: {
  articles: Article[];
  locale: Locale;
  dict: Dictionary;
}) {
  const t = COPY[locale];
  const { numerals } = useNumerals();
  const [tab, setTab] = useState<SavedTab>("articles");
  const [savedSlugs, setSavedSlugs] = useState<string[]>([]);
  const [savedEquations, setSavedEquations] = useState<SavedEquationRecord[]>([]);

  useEffect(() => {
    const sync = () => {
      setSavedSlugs(getBookmarkedArticles());
      setSavedEquations(getSavedEquations());
    };
    sync();
    window.addEventListener(BOOKMARKS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BOOKMARKS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const articleMap = useMemo(() => new Map(articles.map((a) => [a.slug, a])), [articles]);
  const savedArticles = useMemo(
    () => savedSlugs.map((slug) => articleMap.get(slug)).filter((a): a is Article => Boolean(a)),
    [savedSlugs, articleMap]
  );

  function handleRemoveEquation(key: string) {
    removeEquationBookmark(key);
    setSavedEquations(getSavedEquations());
  }

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-center gap-3 border-b border-(--color-border-subtle) pb-6" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "articles"}
          onClick={() => setTab("articles")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
            tab === "articles"
              ? "bg-(--color-accent-purple) text-white"
              : "border border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
          )}
        >
          <Bookmark className="h-4 w-4" />
          {t.articlesTab}
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs">
            {formatCount(savedArticles.length, locale, numerals)}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === "equations"}
          onClick={() => setTab("equations")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
            tab === "equations"
              ? "bg-(--color-accent-purple) text-white"
              : "border border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
          )}
        >
          <Sigma className="h-4 w-4" />
          {t.equationsTab}
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs">
            {formatCount(savedEquations.length, locale, numerals)}
          </span>
        </button>
      </div>

      {tab === "articles" ? (
        savedArticles.length === 0 ? (
          <div className="card-elevated flex flex-col items-center rounded-2xl px-6 py-16 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-accent-purple)/15 text-(--color-accent-purple)">
              <BookOpen className="h-6 w-6" />
            </span>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)">
              {t.emptyArticlesTitle}
            </h2>
            <p className="mt-2 max-w-md text-sm text-(--color-text-tertiary)">{t.emptyArticlesBody}</p>
            <Link
              href={`/${locale}/articles`}
              className="mt-6 inline-flex h-10 items-center rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-6 text-xs font-semibold text-white transition-opacity hover:opacity-95"
            >
              {t.exploreArticles}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {savedArticles.map((article) => (
              <ArticleCard key={article.slug} article={article} locale={locale} dict={dict} size="large" />
            ))}
          </div>
        )
      ) : savedEquations.length === 0 ? (
        <div className="card-elevated flex flex-col items-center rounded-2xl px-6 py-16 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-accent-orange)/15 text-(--color-accent-orange)">
            <Sigma className="h-6 w-6" />
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)">
            {t.emptyEquationsTitle}
          </h2>
          <p className="mt-2 max-w-md text-sm text-(--color-text-tertiary)">{t.emptyEquationsBody}</p>
          <Link
            href={`/${locale}/articles`}
            className="mt-6 inline-flex h-10 items-center rounded-full bg-gradient-to-r from-(--color-accent-purple) to-(--color-accent-orange) px-6 text-xs font-semibold text-white transition-opacity hover:opacity-95"
          >
            {t.exploreArticles}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {savedEquations.map((eq) => (
            <SavedEquationCard
              key={eq.key}
              item={eq}
              articleTitle={articleMap.get(eq.articleSlug)?.title ?? eq.articleTitle ?? eq.articleSlug}
              locale={locale}
              onRemove={handleRemoveEquation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
