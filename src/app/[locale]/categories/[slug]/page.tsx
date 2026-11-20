import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getArticlesByTag } from "@/lib/content";
import { breadcrumbJsonLd, buildPageMetadata, collectionPageJsonLd, SITE_URL } from "@/lib/seo";
import { safeJsonLd } from "@/lib/security";
import { Container } from "@/components/ui/container";
import { ArticleCard } from "@/components/article/article-card";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) return {};
  const tag = decodeURIComponent(slug);
  return buildPageMetadata(locale, `/categories/${slug}`, {
    title: tag,
    description:
      locale === "fa"
        ? `مقالات علمی منتشرشده در موضوع ${tag} در پلتفرم علمی ساینتا.`
        : `Scientific articles published under the topic ${tag} on Scienta.`,
    includeAlternates: false,
  });
}

export default async function CategoryDetailPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const tag = decodeURIComponent(slug);
  const dict = await getDictionary(locale);
  const articles = await getArticlesByTag(locale, tag);

  if (articles.length === 0) notFound();

  const pageUrl = `${SITE_URL}/${locale}/categories/${slug}`;
  const breadcrumb = breadcrumbJsonLd([
    { name: dict.nav.home, url: `${SITE_URL}/${locale}` },
    { name: dict.nav.categories, url: `${SITE_URL}/${locale}/categories` },
    { name: tag, url: pageUrl },
  ]);
  const collection = collectionPageJsonLd(locale, {
    name: tag,
    description:
      locale === "fa"
        ? `مجموعه مقالات علمی در موضوع ${tag} در ساینتا.`
        : `Scientific articles in ${tag} on Scienta.`,
    url: pageUrl,
    items: articles.map((a) => ({
      name: a.title,
      url: `${SITE_URL}/${locale}/articles/${a.slug}`,
    })),
  });

  return (
    <Container className="py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(collection) }} />
      <header className="mb-12 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-orange)">
          {dict.nav.categories}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-(--color-text-primary)">
          {tag}
        </h1>
        <p className="mt-3 text-(--color-text-secondary)">
          {articles.length} {locale === "fa" ? "مقاله" : "articles"}
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
