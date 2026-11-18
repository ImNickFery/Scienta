"use client";

import { useState } from "react";
import { Link2, Printer, Check, Share2, X as XIcon } from "lucide-react";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { formatDate } from "@/lib/utils";
import { useNumerals } from "@/components/i18n/numerals-provider";
import { SITE_NAME } from "@/lib/seo";

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
  const [copiedCitation, setCopiedCitation] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1600);
  }

  async function copyCitation() {
    const year = new Date(article.publishedAt).getFullYear();
    const citation = `${authorName} (${year}). ${article.title}. ${SITE_NAME}. ${url}`;
    await navigator.clipboard.writeText(citation);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 1600);
  }

  const shareText = encodeURIComponent(article.title);
  const shareUrl = encodeURIComponent(url);

  return (
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
        onClick={copyLink}
        aria-label={dict.card.share}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
      >
        {copiedLink ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      </button>
      <button
        onClick={() => window.print()}
        aria-label={dict.article.print}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
      >
        <Printer className="h-4 w-4" />
      </button>
      <button
        onClick={copyCitation}
        className="ms-1 flex h-10 items-center gap-1.5 rounded-full border border-(--color-border-subtle) px-4 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
      >
        {copiedCitation ? <Check className="h-3.5 w-3.5" /> : null}
        {dict.article.copyCitation}
      </button>
      <span className="ms-auto text-xs text-(--color-text-tertiary)">
        {dict.article.publishedOn} {formatDate(article.publishedAt, locale, numerals)}
      </span>
    </div>
  );
}
