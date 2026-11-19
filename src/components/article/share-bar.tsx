"use client";

import { useEffect, useState } from "react";
import { Link2, Printer, Check, Share2, X as XIcon, Quote, Bookmark } from "lucide-react";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn, formatDate } from "@/lib/utils";
import { useNumerals } from "@/components/i18n/numerals-provider";
import { isArticleBookmarked, toggleArticleBookmark } from "@/lib/article-bookmarks";
import { CiteModal } from "./cite-modal";

export function ShareBar({
  article,
  url,
  authorName,
  locale,
  dict,
}: {
  article: Article;
  url: string;
  authorName: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const { numerals } = useNumerals();
  const [copiedLink, setCopiedLink] = useState(false);
  const [citeOpen, setCiteOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate client-only localStorage bookmark state once after mount
    setBookmarked(isArticleBookmarked(article.slug));
  }, [article.slug]);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1600);
  }

  const shareText = encodeURIComponent(article.title);
  const shareUrl = encodeURIComponent(url);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <a
          href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
        >
          <XIcon className="h-4 w-4" />
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on LinkedIn"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
        >
          <Share2 className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={copyLink}
          aria-label={dict.card.share}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
        >
          {copiedLink ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          aria-label={dict.article.print}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
        >
          <Printer className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-pressed={bookmarked}
          aria-label={dict.card.bookmark}
          onClick={() => setBookmarked(toggleArticleBookmark(article.slug))}
          className={cn(
            "flex h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-medium transition-colors",
            bookmarked
              ? "border-(--color-accent-orange)/50 bg-(--color-accent-orange)/10 text-(--color-accent-orange)"
              : "border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
          )}
        >
          <Bookmark className={cn("h-3.5 w-3.5", bookmarked && "fill-current")} />
          {bookmarked
            ? locale === "fa"
              ? "نشان‌شده"
              : "Saved"
            : dict.card.bookmark}
        </button>
        <button
          type="button"
          onClick={() => setCiteOpen(true)}
          className="flex h-10 items-center gap-1.5 rounded-full border border-(--color-accent-purple)/40 bg-(--color-accent-purple)/10 px-4 text-xs font-medium text-(--color-text-primary) transition-colors hover:border-(--color-accent-purple) hover:bg-(--color-accent-purple)/20"
        >
          <Quote className="h-3.5 w-3.5 text-(--color-accent-purple)" />
          {locale === "fa" ? "استناد علمی (BibTeX / APA)" : "Cite (BibTeX / APA)"}
        </button>
        <span className="ms-auto text-xs text-(--color-text-tertiary)">
          {dict.article.publishedOn} {formatDate(article.publishedAt, locale, numerals)}
        </span>
      </div>

      {citeOpen && (
        <CiteModal
          input={{
            title: article.title,
            authorName,
            publishedAt: article.publishedAt,
            url,
            slug: article.slug,
            locale,
          }}
          locale={locale}
          onClose={() => setCiteOpen(false)}
        />
      )}
    </>
  );
}
