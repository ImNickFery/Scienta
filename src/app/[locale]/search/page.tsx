import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAllArticles } from "@/lib/content";
import { buildBaseMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { SearchClient } from "@/components/search/search-client";

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
  const dict = await getDictionary(locale);
  const base = buildBaseMetadata(locale, "/search");
  return { ...base, title: dict.search.title };
}

export default async function SearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);
  const articles = await getAllArticles(locale);

  return (
    <Container size="narrow" className="py-20">
      <header className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-orange)">
          {locale === "fa" ? "کاوش کنید" : "Discover"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-aurora">
          {dict.search.title}
        </h1>
        <p className="mt-3 text-(--color-text-secondary)">{dict.search.subtitle}</p>
      </header>
      <SearchClient articles={articles} locale={locale} dict={dict} />
    </Container>
  );
}
