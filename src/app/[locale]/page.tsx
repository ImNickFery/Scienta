import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAllArticles, getFeaturedArticles, getTrendingArticles, getMostViewedArticles } from "@/lib/content";
import { getFields } from "@/lib/taxonomy";
import { Hero } from "@/components/home/hero";
import { TopicsTicker } from "@/components/home/topics-ticker";
import { StatsBand } from "@/components/home/stats-band";
import { ArticleSection } from "@/components/home/article-section";
import { FieldGrid } from "@/components/home/field-grid";
import { ReadingJourney } from "@/components/home/reading-journey";
import { notFound } from "next/navigation";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);

  const all = await getAllArticles(locale);
  const featured = await getFeaturedArticles(locale);
  const trending = await getTrendingArticles(locale);
  const mostViewed = await getMostViewedArticles(locale, 4);
  const fields = await getFields();

  // Every stat is derived from what's actually in the database. The
  // equation count is a floor, not a guess: it counts display-math blocks
  // ($$…$$) across published MDX, so it can only under-report.
  const equationCount = all.reduce((sum, a) => sum + Math.floor((a.content.match(/\$\$/g)?.length ?? 0) / 2), 0);
  const readerCount = all.reduce((sum, a) => sum + a.views, 0);

  return (
    <>
      <Hero locale={locale} dict={dict} />

      <TopicsTicker locale={locale} />

      <StatsBand
        locale={locale}
        dict={dict}
        articleCount={all.length}
        fieldCount={fields.length}
        equationCount={equationCount}
        readerCount={readerCount}
      />

      <ArticleSection
        articles={featured}
        locale={locale}
        dict={dict}
        title={dict.sections.featured}
        eyebrow={locale === "fa" ? "دست‌چین‌شده" : "Curated"}
        viewAllHref={`/${locale}/articles`}
        cardSize="large"
        columns={3}
        tone="deep"
        glow="purple"
      />

      <FieldGrid locale={locale} dict={dict} />

      <ReadingJourney locale={locale} dict={dict} />

      <ArticleSection
        articles={all}
        locale={locale}
        dict={dict}
        title={dict.sections.latest}
        eyebrow={locale === "fa" ? "همین امروز" : "Fresh today"}
        viewAllHref={`/${locale}/articles`}
        cardSize="default"
        columns={3}
        tone="raised"
        grid="dot"
        glow="mixed"
      />

      <ArticleSection
        articles={trending.length ? trending : mostViewed}
        locale={locale}
        dict={dict}
        title={dict.sections.trending}
        eyebrow={locale === "fa" ? "داغ" : "Hot"}
        cardSize="compact"
        columns={2}
        tone="deep"
        glow="orange"
      />
    </>
  );
}
