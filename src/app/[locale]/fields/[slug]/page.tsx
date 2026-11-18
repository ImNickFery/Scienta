import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getArticlesByField } from "@/lib/content";
import { getFieldBySlug } from "@/lib/taxonomy";
import { buildBaseMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { ArticleCard } from "@/components/article/article-card";
import { Newspaper } from "lucide-react";
import type { FieldSlug } from "@/types";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) return {};
  const field = await getFieldBySlug(slug);
  const base = buildBaseMetadata(locale, `/fields/${slug}`);
  return { ...base, title: field?.name[locale] ?? slug };
}

export default async function FieldDetailPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const fieldSlug = slug as FieldSlug;

  const dict = await getDictionary(locale);
  const field = await getFieldBySlug(fieldSlug);
  if (!field) notFound();

  const articles = await getArticlesByField(locale, fieldSlug);

  return (
    <Container className="py-20">
      <header className="mb-12 max-w-2xl">
        <span
          className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl font-bold"
          style={{ background: `${field.color}22`, color: field.color }}
        >
          {field.name[locale][0]}
        </span>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-(--color-text-primary)">
          {field.name[locale]}
        </h1>
        <p className="mt-3 text-(--color-text-secondary)">
          {articles.length} {locale === "fa" ? "مقاله در این حوزه" : "articles in this field"}
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
            {locale === "fa" ? "به‌زودی مقالاتی در این حوزه منتشر می‌شود." : "Articles for this field are coming soon."}
          </p>
        </div>
      )}
    </Container>
  );
}
