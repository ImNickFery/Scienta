import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAllArticles } from "@/lib/content";
import { getAuthorBySlug } from "@/lib/taxonomy";
import { buildBaseMetadata } from "@/lib/seo";
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
  const base = buildBaseMetadata(locale, `/authors/${slug}`);
  return { ...base, title: author.name[locale] };
}

export default async function AuthorDetailPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const dict = await getDictionary(locale);
  const articles = (await getAllArticles(locale)).filter((a) => a.authorSlug === slug);

  return (
    <Container size="narrow" className="py-20">
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
