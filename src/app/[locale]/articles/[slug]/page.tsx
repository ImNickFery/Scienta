import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getArticle,
  getArticleLocaleSlugs,
  getAdjacentArticles,
  getRelatedArticles,
  extractToc,
  incrementArticleViews,
} from "@/lib/content";
import { getAuthorBySlug, getFieldBySlug } from "@/lib/taxonomy";
import { renderMdx } from "@/lib/render-mdx";
import { buildArticleMetadata, articleJsonLd, breadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { safeJsonLd, sanitizeUrl } from "@/lib/security";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { ReadingProgress } from "@/components/article/reading-progress";
import { TableOfContents } from "@/components/article/table-of-contents";
import { MobileTocDrawer } from "@/components/article/mobile-toc-drawer";
import { AuthorBox } from "@/components/article/author-box";
import { ShareBar } from "@/components/article/share-bar";
import { ReadingControls } from "@/components/article/reading-controls";
import { ArticleComments } from "@/components/article/article-comments";
import { ArticleViewTracker } from "@/components/article/article-view-tracker";
import { EquationEnhancer } from "@/components/equation-explorer/equation-enhancer";
import { ArticleSection } from "@/components/home/article-section";
import { getApprovedCommentsForArticle } from "@/lib/comments-server";
import { formatCount, formatDate, formatNumber } from "@/lib/utils";
import { getNumerals } from "@/lib/i18n/numerals-server";
import { Clock, Eye, ArrowLeft, ArrowRight, Hash } from "lucide-react";
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
  const [alternateSlugs, field] = await Promise.all([
    getArticleLocaleSlugs(article.id),
    getFieldBySlug(article.field),
  ]);
  return buildArticleMetadata(rawLocale, article, alternateSlugs, field?.name[rawLocale]);
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
  const initialComments = await getApprovedCommentsForArticle(article.id, locale);

  // Fire-and-forget view increment — doesn't block the response.
  incrementArticleViews(article.id).catch(() => {});

  const { prev: prevArticle, next: nextArticle } = await getAdjacentArticles(locale, article.id);

  const fieldColor = field?.color ?? article.fieldColor;
  const fieldLabel = field?.name[locale] ?? dict.fields[article.field as keyof typeof dict.fields];
  const url = `${SITE_URL}/${locale}/articles/${article.slug}`;
  const jsonLd = articleJsonLd(locale, article, author ?? undefined, fieldLabel);
  const breadcrumb = breadcrumbJsonLd([
    { name: dict.nav.home, url: `${SITE_URL}/${locale}` },
    { name: fieldLabel, url: `${SITE_URL}/${locale}/fields/${article.field}` },
    { name: article.title, url },
  ]);

  const NextIcon = locale === "fa" ? ArrowLeft : ArrowRight;
  const PrevIcon = locale === "fa" ? ArrowRight : ArrowLeft;
  const coverSrc = sanitizeUrl(article.cover, { allowRelative: true, allowHash: false });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <ReadingProgress />
      <ArticleViewTracker slug={article.slug} locale={locale} />

      {/* Hero */}
      <section className="article-hero relative overflow-hidden border-b border-(--color-border-subtle) transition-opacity duration-300">
        <div className="article-hero-ambient absolute inset-0">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className="h-full w-full scale-110 object-cover opacity-30 blur-2xl"
            />
          ) : (
            <SciIllustration variant={HERO_ILLUSTRATION[article.field] ?? "orbit"} palette="aurora" className="h-full w-full opacity-70" />
          )}
        </div>
        <div className="article-hero-ambient absolute inset-0 bg-gradient-to-t from-(--color-bg-deep) via-(--color-bg-deep)/75 to-(--color-bg-deep)/40" />
        <div
          className="article-hero-ambient absolute inset-0 opacity-60"
          style={{
            background: `radial-gradient(60% 60% at 20% 0%, ${fieldColor}33, transparent 60%), radial-gradient(50% 50% at 90% 30%, ${fieldColor}22, transparent 60%)`,
          }}
        />
        <Container className="relative py-16 sm:py-24">
          <div className={coverSrc ? "grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-12" : ""}>
            <div>
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
            </div>

            {coverSrc && (
              <div
                className="article-hero-cover relative overflow-hidden rounded-2xl border border-white/10 bg-(--color-bg-elevated) shadow-2xl"
                style={{ boxShadow: `0 24px 64px -20px ${fieldColor}44, 0 12px 32px -12px rgba(0,0,0,0.75)` }}
              >
                <div className="aspect-[16/9] w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverSrc}
                    alt={article.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10"
                />
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* Body */}
      <Container className="py-16">
        <div className="article-body-grid grid min-w-0 gap-12 lg:grid-cols-[220px_1fr]">
          <aside className="article-toc-aside hidden min-w-0 transition-opacity duration-300 lg:block">
            <TableOfContents items={toc} dict={dict} />
          </aside>

          <div className="min-w-0 w-full">
            <ReadingControls dict={dict} locale={locale}>
              <EquationEnhancer articleSlug={article.slug} articleTitle={article.title} locale={locale}>
                {rendered}
              </EquationEnhancer>
            </ReadingControls>

            <div className="article-post-chrome mx-auto mt-12 w-full max-w-3xl min-w-0 space-y-10 transition-opacity duration-300">
              {article.tagItems && article.tagItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-(--color-border-subtle) pt-6">
                  <span className="text-xs font-medium text-(--color-text-tertiary)">
                    {locale === "fa" ? "برچسب‌ها:" : "Tags:"}
                  </span>
                  {article.tagItems.map((tag) => (
                    <Link
                      key={tag.slug}
                      href={`/${locale}/tags/${tag.slug}`}
                      className="inline-flex items-center gap-1 rounded-full border border-(--color-border-subtle) bg-white/[0.03] px-3 py-1 text-xs text-(--color-text-secondary) transition-colors hover:border-(--color-accent-purple)/50 hover:bg-(--color-accent-purple)/10 hover:text-(--color-text-primary)"
                    >
                      <Hash className="h-3 w-3 text-(--color-accent-purple)" />
                      {tag.name}
                    </Link>
                  ))}
                </div>
              )}

              <ShareBar
                article={article}
                url={url}
                authorName={author?.name[locale] ?? "Scienta"}
                locale={locale}
                dict={dict}
              />

              {author && <AuthorBox author={author} locale={locale} dict={dict} />}

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {prevArticle && (
                  <Link
                    href={`/${locale}/articles/${prevArticle.slug}`}
                    className="card-elevated group flex min-w-0 items-center gap-3 rounded-2xl p-4"
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
                    className="card-elevated group flex min-w-0 items-center justify-end gap-3 rounded-2xl p-4 text-end sm:order-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-(--color-text-tertiary)">{dict.article.nextArticle}</p>
                      <p className="truncate text-sm font-medium text-(--color-text-primary)">{nextArticle.title}</p>
                    </div>
                    <NextIcon className="h-4 w-4 shrink-0 text-(--color-text-tertiary)" />
                  </Link>
                )}
              </div>

              <ArticleComments
                articleId={article.id}
                locale={locale}
                initialComments={initialComments}
              />
            </div>
          </div>
        </div>
      </Container>

      <MobileTocDrawer items={toc} locale={locale} dict={dict} />

      {related.length > 0 && (
        <div className="article-related-section transition-opacity duration-300">
          <ArticleSection
            articles={related}
            locale={locale}
            dict={dict}
            title={dict.article.relatedArticles}
            columns={3}
          />
        </div>
      )}
    </>
  );
}
