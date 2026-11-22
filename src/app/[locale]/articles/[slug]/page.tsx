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
import { KineticArticleRail } from "@/components/article/kinetic-article-rail";
import { EquationEnhancer } from "@/components/equation-explorer/equation-enhancer";
import { ArticleSection } from "@/components/home/article-section";
import { getApprovedCommentsForArticle } from "@/lib/comments-server";
import { analyzeArticleSpecimen } from "@/lib/article-telemetry";
import { getSiteModes } from "@/lib/site-modes-server";
import { formatCount, formatDate, formatNumber } from "@/lib/utils";
import { getNumerals } from "@/lib/i18n/numerals-server";
import {
  Clock,
  Eye,
  ArrowLeft,
  ArrowRight,
  Hash,
  FileText,
  Sigma,
  Calendar,
  User,
} from "lucide-react";
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

  const [dict, numerals, siteModes, author, field, related, initialComments, adjacent] =
    await Promise.all([
      getDictionary(locale),
      getNumerals(),
      getSiteModes(),
      article.authorSlug ? getAuthorBySlug(article.authorSlug) : Promise.resolve(null),
      getFieldBySlug(article.field),
      getRelatedArticles(locale, article),
      getApprovedCommentsForArticle(article.id, locale),
      getAdjacentArticles(locale, article.id),
    ]);

  const toc = extractToc(article.content);
  const rendered = await renderMdx(article.content, numerals);

  // Fire-and-forget view increment — doesn't block the response.
  incrementArticleViews(article.id).catch(() => {});

  const { prev: prevArticle, next: nextArticle } = adjacent;

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
  const isFa = locale === "fa";

  if (siteModes.designMode === "unslop-kinetic") {
    const specimen = analyzeArticleSpecimen(article.content, locale, {
      field: article.field,
      slug: article.slug,
      publishedAt: article.publishedAt,
    });

    return (
      <div className="kinetic-article-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }}
        />
        <ArticleViewTracker slug={article.slug} locale={locale} />

        {/* Unslop Kinetic Architectural Article Hero — zero blur, zero gradient halos */}
        <section className="article-hero border-b border-(--color-border-subtle) bg-(--color-bg-secondary) transition-opacity duration-300">
          <Container className="py-10 sm:py-14">
            {/* Top Specimen Breadcrumb + Archival ID Bar */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) pb-4 text-xs text-(--color-text-tertiary)">
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2">
                <Link href={`/${locale}`} className="transition-colors hover:text-(--color-text-primary)">
                  {dict.nav.home}
                </Link>
                <span aria-hidden="true">/</span>
                <Link href={`/${locale}/articles`} className="transition-colors hover:text-(--color-text-primary)">
                  {dict.nav.articles}
                </Link>
                <span aria-hidden="true">/</span>
                <Link
                  href={`/${locale}/fields/${article.field}`}
                  className="inline-flex items-center gap-1.5 font-medium text-(--color-text-primary) transition-colors hover:text-(--color-accent-purple)"
                >
                  <span
                    className="h-2 w-2 rounded-xs"
                    style={{ backgroundColor: fieldColor }}
                    aria-hidden="true"
                  />
                  {fieldLabel}
                </Link>
              </nav>

              <div className="flex items-center gap-3">
                <span
                  dir="ltr"
                  data-kinetic-specimen-code
                  className="rounded border border-(--color-border-subtle) bg-(--color-bg-elevated) px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] font-medium tabular-nums text-(--color-text-primary)"
                >
                  {specimen.specimenCode}
                </span>
              </div>
            </div>

            <div className={coverSrc ? "grid items-start gap-8 lg:grid-cols-12 lg:gap-10" : "max-w-4xl"}>
              <div className={coverSrc ? "space-y-6 lg:col-span-7" : "space-y-6"}>
                <h1 className="text-balance font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-(--color-text-primary) sm:text-4xl lg:text-[2.75rem]">
                  {article.title}
                </h1>

                <p className="max-w-2xl text-base leading-relaxed text-(--color-text-secondary) sm:text-lg">
                  {article.excerpt}
                </p>

                {/* 4-Cell Precision Specimen Telemetry Strip */}
                <div
                  data-kinetic-specimen-bar
                  className="grid grid-cols-2 divide-x divide-y divide-(--color-border-subtle) overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) sm:grid-cols-4 sm:divide-y-0 rtl:divide-x-reverse"
                >
                  <div className="px-3.5 py-3">
                    <p className="inline-flex items-center gap-1 text-[11px] text-(--color-text-tertiary)">
                      <User className="h-3 w-3" strokeWidth={1.5} />
                      <span>{dict.article.author}</span>
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-(--color-text-primary)">
                      {author ? (
                        <Link
                          href={`/${locale}/authors/${author.slug}`}
                          className="transition-colors hover:text-(--color-accent-purple)"
                        >
                          {author.name[locale]}
                        </Link>
                      ) : (
                        article.authorName || "Scienta"
                      )}
                    </p>
                  </div>

                  <div className="px-3.5 py-3">
                    <p className="inline-flex items-center gap-1 text-[11px] text-(--color-text-tertiary)">
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      <span>{isFa ? "زمان و حجم" : "Time & Length"}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs font-medium tabular-nums text-(--color-text-primary)">
                      <span>
                        {formatCount(specimen.exactReadingMinutes, locale, numerals)} {dict.common.minutes}
                      </span>
                      <span className="text-[11px] font-normal text-(--color-text-tertiary)">
                        {formatNumber(specimen.wordCount, locale, numerals)} {isFa ? "واژه" : "words"}
                      </span>
                    </div>
                  </div>

                  <div className="px-3.5 py-3">
                    <p className="inline-flex items-center gap-1 text-[11px] text-(--color-text-tertiary)">
                      <Sigma className="h-3 w-3" strokeWidth={1.5} />
                      <span>{isFa ? "معادلات و بخش‌ها" : "Eqs & Sections"}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs font-medium tabular-nums text-(--color-text-primary)">
                      <span>
                        {formatCount(specimen.displayEquationCount, locale, numerals)}{" "}
                        {isFa ? "معادله" : "eq"}
                      </span>
                      <span className="text-[11px] font-normal text-(--color-text-tertiary)">
                        {formatCount(toc.length, locale, numerals)} {isFa ? "بخش" : "sec"}
                      </span>
                    </div>
                  </div>

                  <div className="px-3.5 py-3">
                    <p className="inline-flex items-center gap-1 text-[11px] text-(--color-text-tertiary)">
                      <Calendar className="h-3 w-3" strokeWidth={1.5} />
                      <span>{isFa ? "انتشار و بازدید" : "Published & Reads"}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium tabular-nums text-(--color-text-primary)">
                      <span>{formatDate(article.publishedAt, locale, numerals)}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-normal text-(--color-text-tertiary)">
                        <Eye className="h-3 w-3" strokeWidth={1.5} />
                        {formatNumber(article.views, locale, numerals)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {coverSrc && (
                <figure className="overflow-hidden rounded-xl border border-(--color-border-strong) bg-(--color-bg-elevated) lg:col-span-5">
                  <div className="aspect-[16/10] w-full overflow-hidden bg-(--color-bg-deep)">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverSrc}
                      alt={article.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <figcaption className="flex items-center justify-between gap-2 border-t border-(--color-border-subtle) px-3.5 py-2 text-[11px] text-(--color-text-tertiary)">
                    <span dir="ltr" className="font-[family-name:var(--font-mono)]">
                      FIG. 00 · {specimen.specimenCode}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" strokeWidth={1.5} />
                      {fieldLabel}
                    </span>
                  </figcaption>
                </figure>
              )}
            </div>
          </Container>
        </section>

        {/* Precision Reading Body with Sticky Telemetry & Equation Rail */}
        <Container className="py-12 sm:py-16">
          <div className="article-body-grid grid min-w-0 gap-10 lg:grid-cols-[276px_minmax(0,1fr)] xl:gap-14">
            <aside className="article-toc-aside hidden min-w-0 transition-opacity duration-300 lg:block">
              <KineticArticleRail
                toc={toc}
                equations={specimen.displayEquations}
                wordCount={specimen.wordCount}
                readingTimeMinutes={specimen.exactReadingMinutes}
                inlineEquationCount={specimen.inlineEquationCount}
                figureCount={specimen.figureCount}
                specimenCode={specimen.specimenCode}
                locale={locale}
                dict={dict}
                numerals={numerals}
              />
            </aside>

            <div className="min-w-0 w-full">
              <ReadingControls dict={dict} locale={locale}>
                <EquationEnhancer
                  articleSlug={article.slug}
                  articleTitle={article.title}
                  locale={locale}
                >
                  {rendered}
                </EquationEnhancer>
              </ReadingControls>

              <div className="article-post-chrome mx-auto mt-12 w-full max-w-3xl min-w-0 space-y-8 transition-opacity duration-300">
                {article.tagItems && article.tagItems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-(--color-border-subtle) pt-6">
                    <span className="text-xs font-medium text-(--color-text-tertiary)">
                      {isFa ? "برچسب‌های کلیدی:" : "Keywords:"}
                    </span>
                    {article.tagItems.map((tag) => (
                      <Link
                        key={tag.slug}
                        href={`/${locale}/tags/${tag.slug}`}
                        className="inline-flex items-center gap-1 rounded-md border border-(--color-border-subtle) bg-(--color-bg-elevated) px-2.5 py-1 text-xs text-(--color-text-secondary) transition-colors hover:border-(--color-accent-purple) hover:text-(--color-text-primary)"
                      >
                        <Hash className="h-3 w-3 text-(--color-accent-purple)" strokeWidth={1.5} />
                        {tag.name}
                      </Link>
                    ))}
                  </div>
                )}

                <div className="kinetic-share-wrap rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-4">
                  <ShareBar
                    article={article}
                    url={url}
                    authorName={author?.name[locale] ?? "Scienta"}
                    locale={locale}
                    dict={dict}
                  />
                </div>

                {author && <AuthorBox author={author} locale={locale} dict={dict} />}

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  {prevArticle && (
                    <Link
                      href={`/${locale}/articles/${prevArticle.slug}`}
                      className="group flex min-w-0 items-center gap-3 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-4 transition-colors hover:border-(--color-border-strong)"
                    >
                      <PrevIcon className="h-4 w-4 shrink-0 text-(--color-text-tertiary) transition-colors group-hover:text-(--color-accent-purple)" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-(--color-text-tertiary)">
                          {dict.article.prevArticle}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-medium text-(--color-text-primary)">
                          {prevArticle.title}
                        </p>
                      </div>
                    </Link>
                  )}
                  {nextArticle && (
                    <Link
                      href={`/${locale}/articles/${nextArticle.slug}`}
                      className="group flex min-w-0 items-center justify-end gap-3 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-4 text-end transition-colors hover:border-(--color-border-strong) sm:order-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] text-(--color-text-tertiary)">
                          {dict.article.nextArticle}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-medium text-(--color-text-primary)">
                          {nextArticle.title}
                        </p>
                      </div>
                      <NextIcon className="h-4 w-4 shrink-0 text-(--color-text-tertiary) transition-colors group-hover:text-(--color-accent-purple)" />
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
          <div className="article-related-section border-t border-(--color-border-subtle) transition-opacity duration-300">
            <ArticleSection
              articles={related}
              locale={locale}
              dict={dict}
              title={dict.article.relatedArticles}
              columns={3}
            />
          </div>
        )}
      </div>
    );
  }

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
