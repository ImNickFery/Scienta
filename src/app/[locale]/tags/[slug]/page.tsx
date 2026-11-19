import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Hash, Newspaper } from "lucide-react";
import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAllTagRecords, getArticlesByTagSlug, getTagBySlug } from "@/lib/content";
import { buildBaseMetadata, breadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { safeJsonLd } from "@/lib/security";
import { getNumerals } from "@/lib/i18n/numerals-server";
import { formatCount } from "@/lib/utils";
import { Container } from "@/components/ui/container";
import { ArticleCard } from "@/components/article/article-card";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) return {};
  const tag = await getTagBySlug(slug);
  if (!tag) return {};
  const base = buildBaseMetadata(locale, `/tags/${slug}`);
  const title =
    locale === "fa"
      ? `برچسب: ${tag.name.fa}`
      : `Tag: ${tag.name.en}`;
  const description =
    locale === "fa"
      ? `مجموعه مقالات علمی با برچسب ${tag.name.fa} در ساینتا.`
      : `Scientific articles tagged with ${tag.name.en} on Scienta.`;
  return { ...base, title, description };
}

export default async function TagDetailPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;

  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const [dict, numerals, articles, allTags] = await Promise.all([
    getDictionary(locale),
    getNumerals(),
    getArticlesByTagSlug(locale, slug),
    getAllTagRecords(),
  ]);

  const otherTags = allTags.filter((t) => t.slug !== slug && t.count > 0).slice(0, 12);

  const breadcrumb = breadcrumbJsonLd([
    { name: dict.nav.home, url: `${SITE_URL}/${locale}` },
    { name: locale === "fa" ? "برچسب‌ها" : "Tags", url: `${SITE_URL}/${locale}/tags` },
    { name: tag.name[locale], url: `${SITE_URL}/${locale}/tags/${slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }}
      />

      <Container className="py-20">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-(--color-text-tertiary)">
          <Link href={`/${locale}`} className="hover:text-(--color-text-primary)">
            {dict.nav.home}
          </Link>
          <span>/</span>
          <Link href={`/${locale}/tags`} className="hover:text-(--color-text-primary)">
            {locale === "fa" ? "برچسب‌ها" : "Tags"}
          </Link>
          <span>/</span>
          <span className="text-(--color-text-secondary)">{tag.name[locale]}</span>
        </nav>

        <header className="mb-12 max-w-2xl">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-accent-purple)/15 text-(--color-accent-purple)">
            <Hash className="h-6 w-6" />
          </span>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-(--color-text-primary)">
            {tag.name[locale]}
          </h1>
          <p className="mt-3 text-(--color-text-secondary)">
            {formatCount(articles.length, locale, numerals)}{" "}
            {locale === "fa"
              ? "مقاله با این برچسب"
              : articles.length === 1
                ? "article with this tag"
                : "articles with this tag"}
          </p>
        </header>

        {articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} locale={locale} dict={dict} size="large" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-(--color-border-subtle) py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] text-(--color-text-tertiary)">
              <Newspaper className="h-6 w-6" />
            </span>
            <p className="text-(--color-text-tertiary)">
              {locale === "fa"
                ? "هنوز مقاله‌ای با این برچسب منتشر نشده است."
                : "No published articles for this tag yet."}
            </p>
          </div>
        )}

        {otherTags.length > 0 && (
          <section className="mt-16 border-t border-(--color-border-subtle) pt-10">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-(--color-text-primary)">
                {locale === "fa" ? "سایر برچسب‌های علمی" : "Explore Other Tags"}
              </h2>
              <Link
                href={`/${locale}/tags`}
                className="text-xs text-(--color-accent-purple) hover:underline"
              >
                {locale === "fa" ? "مشاهده همه" : "View all"}
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {otherTags.map((item) => (
                <Link
                  key={item.slug}
                  href={`/${locale}/tags/${item.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border-subtle) bg-white/[0.03] px-3.5 py-1.5 text-xs text-(--color-text-secondary) transition-colors hover:border-(--color-accent-purple)/50 hover:text-(--color-text-primary)"
                >
                  <Hash className="h-3 w-3 text-(--color-accent-purple)" />
                  {item.name[locale]}
                  <span className="text-(--color-text-tertiary)">
                    ({formatCount(item.count, locale, numerals)})
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
