import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAllArticles, stripArticleContent } from "@/lib/content";
import { buildPageMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { SavedLibraryClient } from "@/components/saved/saved-library-client";

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
  return buildPageMetadata(locale, "/saved", {
    title: locale === "fa" ? "کتابخانه ذخیره‌شده" : "Saved Library",
    description:
      locale === "fa"
        ? "مقالات و معادلات نشان‌شده شما در ساینتا که به‌صورت محلی در مرورگر ذخیره می‌شوند."
        : "Your bookmarked articles and equations on Scienta, stored locally in your browser.",
    noIndex: true,
  });
}

export default async function SavedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;

  const [dict, allArticles] = await Promise.all([
    getDictionary(locale),
    getAllArticles(locale),
  ]);

  const summaries = allArticles.map(stripArticleContent);

  return (
    <Container className="py-20">
      <header className="mb-10 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-orange)">
          {locale === "fa" ? "کتابخانه شخصی" : "Personal Library"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-aurora">
          {locale === "fa" ? "مقالات و معادلات نشان‌شده" : "Saved Articles & Equations"}
        </h1>
        <p className="mt-4 text-(--color-text-secondary)">
          {locale === "fa"
            ? "مقالات و معادلاتی که هنگام مطالعه ذخیره کرده‌اید؛ به‌صورت محلی روی مرورگر شما نگهداری می‌شوند."
            : "Articles and equations you bookmarked while reading, stored locally in your browser."}
        </p>
      </header>

      <SavedLibraryClient articles={summaries} locale={locale} dict={dict} />
    </Container>
  );
}
