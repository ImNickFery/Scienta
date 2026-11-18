import Link from "next/link";
import type { Author } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function AuthorBox({ author, locale, dict }: { author: Author; locale: Locale; dict: Dictionary }) {
  return (
    <Link
      href={`/${locale}/authors/${author.slug}`}
      className="glass-panel flex items-center gap-4 rounded-2xl p-5 transition-colors hover:border-(--color-border-strong)"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-(--color-accent-purple) to-(--color-accent-orange) font-[family-name:var(--font-display)] text-lg font-bold text-white">
        {author.name[locale].charAt(0)}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-(--color-text-tertiary)">{dict.article.author}</p>
        <p className="truncate font-semibold text-(--color-text-primary)">{author.name[locale]}</p>
        <p className="truncate text-sm text-(--color-text-tertiary)">{author.title[locale]}</p>
      </div>
    </Link>
  );
}
