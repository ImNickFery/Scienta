import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAllArticles } from "@/lib/content";
import { buildBaseMetadata } from "@/lib/seo";
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
  const base = buildBaseMetadata(locale, "/articles");
  return { ...base, title: locale === "fa" ? "مقالات" : "Articles" };
}

export default async function ArticlesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);
  const articles = await getAllArticles(locale);
  const numerals = await getNumerals();

  return (
    <Container className="py-20">
      <header className="mb-12 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-orange)">
          {locale === "fa" ? "کتابخانه" : "Library"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-aurora">
          {dict.nav.articles}
        </h1>
        <p className="mt-4 text-(--color-text-secondary)">
          {locale === "fa"
            ? `${formatCount(articles.length, locale, numerals)} مقاله در حوزه‌های مختلف علمی.`
            : `${formatCount(articles.length, locale, numerals)} articles across every scientific field.`}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} locale={locale} dict={dict} size="large" />
        ))}
      </div>
    </Container>
  );
}
