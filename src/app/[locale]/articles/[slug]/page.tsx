import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getArticle,
  getAllArticles,
  getRelatedArticles,
  extractToc,
  incrementArticleViews,
} from "@/lib/content";
import { getAuthorBySlug, getFieldBySlug } from "@/lib/taxonomy";
import { renderMdx } from "@/lib/render-mdx";
import { buildArticleMetadata, articleJsonLd, breadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { ReadingProgress } from "@/components/article/reading-progress";
import { TableOfContents } from "@/components/article/table-of-contents";
import { AuthorBox } from "@/components/article/author-box";
import { ShareBar } from "@/components/article/share-bar";
import { ReadingControls } from "@/components/article/reading-controls";
import { EquationEnhancer } from "@/components/equation-explorer/equation-enhancer";
import { ArticleSection } from "@/components/home/article-section";
import { formatCount, formatDate, formatNumber } from "@/lib/utils";
import { getNumerals } from "@/lib/i18n/numerals-server";
import { Clock, Eye, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { SciIllustration } from "@/components/mdx/sci-illustration";
import type { FieldSlug } from "@/types";

const HERO_ILLUSTRATION: Record<FieldSlug, "orbit" | "nebula" | "circuit" | "wave" | "molecule" | "field-lines"> = {
  physics: "field-lines",
  astronomy: "nebula",
  ai: "circuit",
  space: "orbit",
  quantum: "wave",
  math: "molecule",
  biology: "molecule",
  medicine: "molecule",
  engineering: "circuit",
  technology: "circuit",
};

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 30;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  if (!isValidLocale(rawLocale)) return {};
  const article = await getArticle(rawLocale, slug);
  if (!article) return {};
  return buildArticleMetadata(rawLocale, article);
}

export default async function ArticlePage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;

  const article = await getArticle(locale, slug);
  if (!article) notFound();

  const dict = await getDictionary(locale);
  const numerals = await getNumerals();
  const author = article.authorSlug ? await getAuthorBySlug(article.authorSlug) : null;
  const field = await getFieldBySlug(article.field);
  const toc = extractToc(article.content);
  const related = await getRelatedArticles(locale, article);
  const rendered = await renderMdx(article.content, numerals);

  // Fire-and-forget view increment — doesn't block the response.
  incrementArticleViews(article.id).catch(() => {});

  const allInLocale = await getAllArticles(locale);
  const currentIndex = allInLocale.findIndex((a) => a.slug === article.slug);
  const nextArticle = allInLocale[currentIndex + 1];
  const prevArticle = allInLocale[currentIndex - 1];

  const url = `${SITE_URL}/${locale}/articles/${article.slug}`;
  const jsonLd = articleJsonLd(locale, article, author ?? undefined);
  const breadcrumb = breadcrumbJsonLd([
    { name: dict.nav.home, url: `${SITE_URL}/${locale}` },
    { name: dict.nav.articles, url: `${SITE_URL}/${locale}/articles` },
    { name: article.title, url },
  ]);

  const NextIcon = locale === "fa" ? ArrowLeft : ArrowRight;
  const PrevIcon = locale === "fa" ? ArrowRight : ArrowLeft;
  const fieldColor = field?.color ?? article.fieldColor;
  const fieldLabel = field?.name[locale] ?? dict.fields[article.field as keyof typeof dict.fields];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ReadingProgress />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-(--color-border-subtle)">
        <div className="absolute inset-0">
          <SciIllustration variant={HERO_ILLUSTRATION[article.field] ?? "orbit"} palette="aurora" className="h-full w-full opacity-70" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-(--color-bg-deep) via-(--color-bg-deep)/70 to-(--color-bg-deep)/30" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `radial-gradient(60% 60% at 20% 0%, ${fieldColor}33, transparent 60%), radial-gradient(50% 50% at 90% 30%, ${fieldColor}22, transparent 60%)`,
          }}
        />
        <Container className="relative py-20 sm:py-28">
          <nav className="mb-6 flex items-center gap-2 text-xs text-(--color-text-tertiary)">
            <Link href={`/${locale}`} className="hover:text-(--color-text-primary)">{dict.nav.home}</Link>
            <span>/</span>
            <Link href={`/${locale}/fields/${article.field}`} className="hover:text-(--color-text-primary)">
              {fieldLabel}
            </Link>
          </nav>

          <Badge style={{ background: `${fieldColor}22`, color: fieldColor, borderColor: `${fieldColor}44` }}>
            {fieldLabel}
          </Badge>

          <h1 className="mt-5 max-w-4xl font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight sm:text-5xl">
            {article.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-(--color-text-secondary)">{article.excerpt}</p>

          <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-(--color-text-tertiary)">
            {author && <span className="text-(--color-text-primary)">{author.name[locale]}</span>}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatCount(article.readingTimeMinutes, locale, numerals)} {dict.common.minutes} {dict.article.readingTime.toLowerCase()}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              {formatNumber(article.views, locale, numerals)} {dict.card.views}
            </span>
            <span>{formatDate(article.publishedAt, locale, numerals)}</span>
          </div>
        </Container>
      </section>

      {/* Body */}
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:block">
            <TableOfContents items={toc} dict={dict} />
          </aside>

          <div>
            <ReadingControls dict={dict}>
              <EquationEnhancer articleSlug={article.slug} locale={locale}>
                {rendered}
              </EquationEnhancer>
            </ReadingControls>

            <div className="mx-auto mt-12 max-w-3xl space-y-10">
              <ShareBar
                article={article}
                url={url}
                authorName={author?.name[locale] ?? "Scienta"}
                locale={locale}
                dict={dict}
              />

              {author && <AuthorBox author={author} locale={locale} dict={dict} />}

              <div className="grid gap-4 sm:grid-cols-2">
                {prevArticle && (
                  <Link
                    href={`/${locale}/articles/${prevArticle.slug}`}
                    className="card-elevated group flex items-center gap-3 rounded-2xl p-4"
                  >
                    <PrevIcon className="h-4 w-4 shrink-0 text-(--color-text-tertiary)" />
                    <div className="min-w-0">
                      <p className="text-xs text-(--color-text-tertiary)">{dict.article.prevArticle}</p>
                      <p className="truncate text-sm font-medium text-(--color-text-primary)">{prevArticle.title}</p>
                    </div>
                  </Link>
                )}
                {nextArticle && (
                  <Link
                    href={`/${locale}/articles/${nextArticle.slug}`}
                    className="card-elevated group flex items-center justify-end gap-3 rounded-2xl p-4 text-end sm:order-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-(--color-text-tertiary)">{dict.article.nextArticle}</p>
                      <p className="truncate text-sm font-medium text-(--color-text-primary)">{nextArticle.title}</p>
                    </div>
                    <NextIcon className="h-4 w-4 shrink-0 text-(--color-text-tertiary)" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>

      {related.length > 0 && (
        <ArticleSection
          articles={related}
          locale={locale}
          dict={dict}
          title={dict.article.relatedArticles}
          columns={3}
        />
      )}
    </>
  );
}
