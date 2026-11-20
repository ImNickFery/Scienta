import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAllArticles, stripArticleContent } from "@/lib/content";
import { getFields } from "@/lib/taxonomy";
import { buildPageMetadata, breadcrumbJsonLd, collectionPageJsonLd, SITE_URL } from "@/lib/seo";
import { safeJsonLd } from "@/lib/security";
import { Container } from "@/components/ui/container";
import { ArticleCard } from "@/components/article/article-card";
import { formatCount } from "@/lib/utils";
import { getNumerals } from "@/lib/i18n/numerals-server";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};
  return buildPageMetadata(locale, "/articles", {
    title: locale === "fa" ? "مقالات علمی" : "Scientific Articles",
    description:
      locale === "fa"
        ? "آرشیو کامل مقالات تحلیلی و عمیق ساینتا در حوزه‌های فیزیک، نجوم، فضا، هوش مصنوعی، کوانتوم و ریاضیات با قابلیت فیلتر و مرتب‌سازی."
        : "Browse the complete library of deep scientific essays on physics, astronomy, space, AI, quantum mechanics, and mathematics on Scienta.",
  });
}

export default async function ArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ field?: string; sort?: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const { field: activeField = "", sort = "latest" } = await searchParams;

  const [dict, allArticles, fields, numerals] = await Promise.all([
    getDictionary(locale),
    getAllArticles(locale),
    getFields(),
    getNumerals(),
  ]);

  const activeFields = fields.filter((f) => (f.articleCount ?? 0) > 0);
  let filtered = activeField
    ? allArticles.filter((a) => a.field === activeField)
    : allArticles;

  if (sort === "views") {
    filtered = [...filtered].sort((a, b) => b.views - a.views);
  }

  const summaries = filtered.map(stripArticleContent);

  const buildHref = (nextField: string, nextSort: string) => {
    const qs = new URLSearchParams();
    if (nextField) qs.set("field", nextField);
    if (nextSort && nextSort !== "latest") qs.set("sort", nextSort);
    const queryStr = qs.toString();
    return `/${locale}/articles${queryStr ? `?${queryStr}` : ""}`;
  };

  const pageUrl = `${SITE_URL}/${locale}/articles`;
  const breadcrumb = breadcrumbJsonLd([
    { name: dict.nav.home, url: `${SITE_URL}/${locale}` },
    { name: dict.nav.articles, url: pageUrl },
  ]);
  const collection = collectionPageJsonLd(locale, {
    name: locale === "fa" ? "مقالات علمی ساینتا" : "Scienta Scientific Articles",
    description:
      locale === "fa"
        ? "آرشیو مقالات علمی ساینتا در فیزیک، فضا، هوش مصنوعی و ریاضیات."
        : "Complete collection of peer-reviewed scientific essays on Scienta.",
    url: pageUrl,
    items: summaries.map((a) => ({
      name: a.title,
      url: `${SITE_URL}/${locale}/articles/${a.slug}`,
    })),
  });

  return (
    <Container className="py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(collection) }} />
      <header className="mb-10 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-orange)">
          {locale === "fa" ? "کتابخانه" : "Library"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-aurora">
          {dict.nav.articles}
        </h1>
        <p className="mt-4 text-(--color-text-secondary)">
          {locale === "fa"
            ? `${formatCount(summaries.length, locale, numerals)} مقاله در حوزه‌های مختلف علمی.`
            : `${formatCount(summaries.length, locale, numerals)} articles across every scientific field.`}
        </p>
      </header>

      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-(--color-border-subtle) pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildHref("", sort)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              !activeField
                ? "bg-(--color-accent-purple) text-white"
                : "border border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
            }`}
          >
            {locale === "fa" ? "همه حوزه‌ها" : "All fields"}
          </Link>
          {activeFields.map((f) => {
            const isSelected = activeField === f.slug;
            return (
              <Link
                key={f.slug}
                href={buildHref(f.slug, sort)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-(--color-accent-purple) text-white"
                    : "border border-(--color-border-subtle) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                }`}
              >
                {f.name[locale]}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-(--color-text-tertiary)">{locale === "fa" ? "مرتب‌سازی:" : "Sort:"}</span>
          <Link
            href={buildHref(activeField, "latest")}
            className={`rounded-full px-3 py-1 transition-colors ${
              sort !== "views"
                ? "bg-white/10 text-(--color-text-primary)"
                : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            }`}
          >
            {locale === "fa" ? "جدیدترین" : "Latest"}
          </Link>
          <Link
            href={buildHref(activeField, "views")}
            className={`rounded-full px-3 py-1 transition-colors ${
              sort === "views"
                ? "bg-white/10 text-(--color-text-primary)"
                : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
            }`}
          >
            {locale === "fa" ? "پربازدیدترین" : "Most viewed"}
          </Link>
        </div>
      </div>

      {summaries.length === 0 ? (
        <div className="card-elevated rounded-2xl py-16 text-center text-sm text-(--color-text-tertiary)">
          {locale === "fa" ? "مقاله‌ای در این حوزه یافت نشد." : "No articles found in this field."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((article) => (
            <ArticleCard key={article.slug} article={article} locale={locale} dict={dict} size="large" />
          ))}
        </div>
      )}
    </Container>
  );
}
