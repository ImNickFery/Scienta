import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAllArticles } from "@/lib/content";
import { getAuthorBySlug } from "@/lib/taxonomy";
import { authorProfileJsonLd, breadcrumbJsonLd, buildPageMetadata, SITE_URL } from "@/lib/seo";
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
  const author = await getAuthorBySlug(slug);
  if (!author) return {};
  const fallbackDesc =
    locale === "fa"
      ? `آشنایی با ${author.name.fa}${author.title.fa ? ` (${author.title.fa})` : ""} و مطالعه مقالات علمی منتشرشده در ساینتا.`
      : `Read scientific articles and biography of ${author.name.en}${author.title.en ? `, ${author.title.en}` : ""} on Scienta.`;
  return buildPageMetadata(locale, `/authors/${slug}`, {
    title: author.name[locale],
    description: author.bio[locale]?.trim() || fallbackDesc,
  });
}

export default async function AuthorDetailPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const dict = await getDictionary(locale);
  const articles = (await getAllArticles(locale)).filter((a) => a.authorSlug === slug);

  const profileJsonLd = authorProfileJsonLd(locale, author, articles);
  const breadcrumb = breadcrumbJsonLd([
    { name: dict.nav.home, url: `${SITE_URL}/${locale}` },
    { name: locale === "fa" ? "نویسندگان" : "Authors", url: `${SITE_URL}/${locale}/authors` },
    { name: author.name[locale], url: `${SITE_URL}/${locale}/authors/${slug}` },
  ]);

  return (
    <Container size="narrow" className="py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(profileJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <header className="mb-12 flex flex-col items-center text-center">
        <span className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-(--color-accent-purple) to-(--color-accent-orange) font-[family-name:var(--font-display)] text-3xl font-bold text-white">
          {author.name[locale].charAt(0)}
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-(--color-text-primary)">
          {author.name[locale]}
        </h1>
        <p className="mt-1 text-(--color-accent-orange)">{author.title[locale]}</p>
        <p className="mt-5 max-w-xl leading-relaxed text-(--color-text-secondary)">{author.bio[locale]}</p>
      </header>

      <h2 className="mb-6 text-lg font-bold text-(--color-text-primary)">
        {locale === "fa" ? "مقالات" : "Articles"}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} locale={locale} dict={dict} size="default" />
        ))}
      </div>
    </Container>
  );
}
