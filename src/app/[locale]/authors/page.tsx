import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildBaseMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { getAuthors } from "@/lib/taxonomy";
import { getAllArticles } from "@/lib/content";

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
  const base = buildBaseMetadata(locale, "/authors");
  return { ...base, title: locale === "fa" ? "نویسندگان" : "Authors" };
}

export default async function AuthorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);
  const all = await getAllArticles(locale);
  const authors = await getAuthors();

  return (
    <Container className="py-20">
      <header className="mb-12 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-orange)">
          {locale === "fa" ? "تیم" : "Team"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-aurora">
          {locale === "fa" ? "نویسندگان" : "Authors"}
        </h1>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {authors.map((author) => {
          const count = all.filter((a) => a.authorSlug === author.slug).length;
          return (
            <Link
              key={author.slug}
              href={`/${locale}/authors/${author.slug}`}
              className="card-elevated flex flex-col items-center gap-3 rounded-2xl p-8 text-center"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-(--color-accent-purple) to-(--color-accent-orange) font-[family-name:var(--font-display)] text-2xl font-bold text-white">
                {author.name[locale].charAt(0)}
              </span>
              <div>
                <p className="text-lg font-semibold text-(--color-text-primary)">{author.name[locale]}</p>
                <p className="text-sm text-(--color-text-tertiary)">{author.title[locale]}</p>
              </div>
              <p className="text-xs text-(--color-text-tertiary)">
                {count} {locale === "fa" ? "مقاله" : "articles"}
              </p>
            </Link>
          );
        })}
      </div>
      <p className="sr-only">{dict.nav.articles}</p>
    </Container>
  );
}
