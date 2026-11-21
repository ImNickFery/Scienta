"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Eye, Bookmark, ArrowUpRight } from "lucide-react";
import { SpotlightCard } from "@/components/animations/spotlight-card";
import { cn, formatCount, formatDate, formatNumber, readableOn } from "@/lib/utils";
import { useNumerals } from "@/components/i18n/numerals-provider";
import { isArticleBookmarked, toggleArticleBookmark } from "@/lib/article-bookmarks";
import { resolveArticleCardImage } from "@/lib/image-delivery";
import { sanitizeUrl } from "@/lib/security";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function ArticleCard({
  article,
  locale,
  dict,
  size = "default",
}: {
  article: Article;
  locale: Locale;
  dict: Dictionary;
  size?: "default" | "large" | "compact";
}) {
  const { numerals } = useNumerals();
  const [bookmarked, setBookmarked] = useState(false);
  const coverSrc = sanitizeUrl(article.cover, { allowRelative: true, allowHash: false });
  const cardImage = coverSrc ? resolveArticleCardImage(coverSrc, size) : null;
  const href = `/${locale}/articles/${article.slug}`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate client-only localStorage bookmark state after mount
    setBookmarked(isArticleBookmarked(article.slug));
  }, [article.slug]);

  return (
    <SpotlightCard
      as="article"
      color={article.fieldColor}
      className={cn(
        "article-card-shell flex h-full flex-col overflow-hidden rounded-2xl border border-(--color-border-subtle)",
        "bg-gradient-to-b from-(--color-bg-elevated) to-(--color-bg-secondary)",
        "focus-within:ring-2 focus-within:ring-(--color-accent-purple)/60",
        size === "compact" && "flex-row items-center gap-4 p-3"
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-(--color-bg-elevated)",
          size === "large" ? "aspect-[16/9]" : size === "compact" ? "h-20 w-20 shrink-0 rounded-xl" : "aspect-[16/10]"
        )}
      >
        {cardImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardImage.src}
              srcSet={cardImage.srcSet}
              sizes={cardImage.sizes}
              width={cardImage.width}
              height={cardImage.height}
              alt={article.title}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="article-card-img h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
            />
            <div
              aria-hidden="true"
              className="article-card-cover-scrim pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/15"
            />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0 opacity-70 transition-transform duration-700 group-hover:scale-110"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${article.fieldColor}55, transparent 60%), radial-gradient(circle at 80% 80%, ${article.fieldColor}33, transparent 55%)`,
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-[family-name:var(--font-display)] text-4xl font-black opacity-20"
                style={{ color: article.fieldColor }}
              >
                {dict.fields[article.field as keyof typeof dict.fields]?.[0]}
              </span>
            </div>
          </>
        )}
        {/* Shine that sweeps across the cover as the pointer arrives. */}
        <div
          aria-hidden="true"
          className="article-card-cover-shine pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-full"
        />
        {size !== "compact" && (
          <span
            className="article-card-cover-chip absolute top-3 start-3 rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm backdrop-blur-sm"
            // Opaque fill, and ink picked from the fill's luminance: at CC alpha
            // the chip sat over whatever the cover art happened to be, so its
            // contrast was never actually knowable.
            style={{ background: article.fieldColor, color: readableOn(article.fieldColor) }}
          >
            {dict.fields[article.field as keyof typeof dict.fields]}
          </span>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col p-5", size === "compact" && "p-0")}>
        <h3
          className={cn(
            "font-[family-name:var(--font-display)] font-bold text-(--color-text-primary) transition-colors duration-300 group-hover:text-(--color-accent-orange)",
            size === "large" ? "text-xl" : size === "compact" ? "text-sm line-clamp-2" : "text-base"
          )}
        >
          <Link href={href} className="after:absolute after:inset-0 focus:outline-none">
            {article.title}
          </Link>
        </h3>

        {size !== "compact" && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-(--color-text-tertiary)">
            {article.excerpt}
          </p>
        )}

        <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-(--color-text-tertiary)">
          {article.authorName && size !== "compact" && (
            <span className="truncate">{article.authorName}</span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatCount(article.readingTimeMinutes, locale, numerals)} {dict.common.minutes}
          </span>
          {size !== "compact" && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatNumber(article.views, locale, numerals)}
            </span>
          )}
          {size === "large" && (
            <button
              type="button"
              aria-label={`${dict.card.bookmark}: ${article.title}`}
              aria-pressed={bookmarked}
              onClick={() => {
                setBookmarked(toggleArticleBookmark(article.slug));
              }}
              className={cn(
                "relative z-10 ms-auto -me-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                "hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-(--color-accent-purple)",
                bookmarked
                  ? "text-(--color-accent-orange)"
                  : "text-(--color-text-tertiary) hover:text-(--color-accent-orange)"
              )}
            >
              <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
            </button>
          )}

          {size !== "compact" && (
            /* Affordance that only materializes on hover — signals the whole
               card is the link without adding permanent chrome. */
            <ArrowUpRight
              aria-hidden="true"
              className={cn(
                "h-4 w-4 -translate-x-1 opacity-0 transition-all duration-300 rtl:translate-x-1",
                "group-hover:translate-x-0 group-hover:opacity-100 rtl:group-hover:translate-x-0",
                "text-(--color-accent-orange)",
                size !== "large" && "ms-auto"
              )}
            />
          )}
        </div>
        {size === "large" && (
          <p className="mt-1 text-[11px] text-(--color-text-tertiary)">
            {formatDate(article.publishedAt, locale, numerals)}
          </p>
        )}
      </div>
    </SpotlightCard>
  );
}
