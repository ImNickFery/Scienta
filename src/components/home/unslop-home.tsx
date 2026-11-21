import Link from "next/link";
import {
  Atom,
  Orbit,
  Cpu,
  Rocket,
  Waves,
  Sigma,
  Dna,
  HeartPulse,
  Cog,
  Microchip,
  ListTree,
  Route,
  ArrowLeft,
  ArrowRight,
  Clock,
  Eye,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { UnslopProofSheet } from "./unslop-proof-sheet";
import { formatCount, formatDate, formatNumber } from "@/lib/utils";
import { resolveArticleCardImage } from "@/lib/image-delivery";
import { sanitizeUrl } from "@/lib/security";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { FieldRecord } from "@/lib/taxonomy";
import type { Numerals } from "@/lib/i18n/numerals";

const FIELD_ICON_MAP = {
  atom: Atom,
  orbit: Orbit,
  cpu: Cpu,
  rocket: Rocket,
  waves: Waves,
  sigma: Sigma,
  dna: Dna,
  "heart-pulse": HeartPulse,
  cog: Cog,
  microchip: Microchip,
};

export interface UnslopHomeProps {
  locale: Locale;
  dict: Dictionary;
  numerals: Numerals;
  allArticles: Article[];
  featured: Article[];
  trending: Article[];
  fields: FieldRecord[];
  equationCount: number;
  readerCount: number;
}

/**
 * Unslop Editorial Homepage — Observatory Press
 * Built on the 9-pass unslop craft system:
 * - Warm archival paper & carbon ink, zero hue gradients, zero glows, zero blobs
 * - One bespoke engraved observatory hero scene blended directly into the paper
 * - Rising live interactive proof specimen & current issue ledger at hero base
 * - Asymmetric broadsheet spread for featured essays, ruled hairline directory for
 *   scientific fields, calm 3-column monograph notes, and 8/4 latest + most-read split
 */
export function UnslopHome({
  locale,
  dict,
  numerals,
  allArticles,
  featured,
  trending,
  fields,
  equationCount,
  readerCount,
}: UnslopHomeProps) {
  const isFa = locale === "fa";
  const ForwardArrow = isFa ? ArrowLeft : ArrowRight;

  const leadArticle = featured[0] ?? allArticles[0];
  const companionFeatured = (featured.length > 1 ? featured.slice(1, 3) : allArticles.slice(1, 3));
  const latestArticles = allArticles.slice(0, 6);
  const trendingArticles = trending.slice(0, 5);

  const stats = [
    {
      value: formatNumber(allArticles.length, locale, numerals),
      label: dict.stats.articles,
    },
    {
      value: formatNumber(fields.length, locale, numerals),
      label: dict.stats.fields,
    },
    {
      value: `${formatNumber(equationCount, locale, numerals)}+`,
      label: dict.stats.equations,
    },
    {
      value: `${formatNumber(readerCount, locale, numerals)}+`,
      label: dict.stats.readers,
    },
  ];

  const apparatus = [
    {
      num: "01",
      icon: ListTree,
      title: dict.journey.step1Title,
      body: dict.journey.step1Body,
    },
    {
      num: "02",
      icon: Sigma,
      title: dict.journey.step2Title,
      body: dict.journey.step2Body,
    },
    {
      num: "03",
      icon: Route,
      title: dict.journey.step3Title,
      body: dict.journey.step3Body,
    },
  ];

  return (
    <div className="bg-(--color-bg-deep) text-(--color-text-primary)">
      {/* =================================================================
          BAND 1 — OBSERVATORY SCENE HERO + RISING INTERACTIVE PROOF SHEET
          ================================================================= */}
      <section className="relative overflow-hidden border-b border-(--color-border-subtle) bg-(--color-bg-deep)">
        {/* Engraved armillary sphere & prism plate blended directly into paper.
            Positioned on the logical end side (right in LTR, left in RTL) with
            paper-white knockout so there is zero rectangular seam and every
            engraved degree numeral remains upright in both languages. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-[540px] max-w-[1440px] select-none overflow-hidden md:block"
        >
          <div className="absolute inset-y-0 end-0 w-[56%] max-w-[760px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/unslop-observatory-hero.webp"
              alt=""
              width={1376}
              height={768}
              fetchPriority="high"
              className="unslop-observatory-plate h-full w-full object-cover object-right"
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse 70% 78% at 54% 47%, #000 56%, transparent 98%)",
                maskImage:
                  "radial-gradient(ellipse 70% 78% at 54% 47%, #000 56%, transparent 98%)",
              }}
            />
          </div>
        </div>

        <Container className="relative z-10 pt-14 sm:pt-20 lg:pt-24">
          {/* Editorial headline sitting on the calm empty half of the plate */}
          <div className="max-w-xl pb-12 sm:pb-16 lg:pb-20">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              <span dir="ltr" className="font-[family-name:var(--font-mono)] text-(--color-accent-purple)">
                § 01
              </span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>
                {isFa ? "فصلنامه علمی ساینتا" : "Scienta Scientific Journal"}
              </span>
            </p>

            <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-medium text-(--color-text-primary) [text-wrap:balance] sm:text-5xl lg:text-[3.75rem]">
              {isFa
                ? "جهان را بخوانید، هر بار با یک اثبات"
                : "Read the universe, one proof at a time"}
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-(--color-text-secondary) sm:text-lg">
              {dict.hero.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={`/${locale}/articles`}
                className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg bg-(--color-text-primary) px-5 text-sm font-medium text-(--color-bg-elevated) transition-[background-color,transform] duration-150 hover:bg-(--color-accent-purple) hover:text-white active:scale-[0.98]"
              >
                <span>{dict.hero.ctaPrimary}</span>
                <ForwardArrow className="h-4 w-4" strokeWidth={1.5} />
              </Link>
              <Link
                href={`/${locale}/about`}
                className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-(--color-border-strong) bg-(--color-bg-elevated) px-5 text-sm font-medium text-(--color-text-primary) transition-[background-color,border-color,transform] duration-150 hover:bg-(--color-bg-secondary) active:scale-[0.98]"
              >
                <span>{dict.hero.ctaSecondary}</span>
              </Link>
            </div>
          </div>

          {/* Rising product view — live KaTeX proof specimen & current issue */}
          <UnslopProofSheet locale={locale} dict={dict} featured={featured.length ? featured : allArticles} />
        </Container>
      </section>

      {/* =================================================================
          BAND 2 — ARCHIVAL SCALE LEDGER STRIP (Real DB counts, tabular)
          ================================================================= */}
      <section className="border-b border-(--color-border-subtle) bg-(--color-bg-secondary)">
        <Container className="py-8 sm:py-10">
          <div className="grid grid-cols-2 divide-y divide-(--color-border-subtle) sm:grid-cols-4 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
            {stats.map((stat, idx) => (
              <div
                key={stat.label}
                className={`py-3 sm:px-6 sm:py-1 ${idx === 0 ? "sm:ps-0" : ""}`}
              >
                <div className="font-[family-name:var(--font-display)] text-2xl font-medium tabular-nums text-(--color-text-primary) sm:text-3xl">
                  <bdi dir="ltr">{stat.value}</bdi>
                </div>
                <div className="mt-1 text-xs text-(--color-text-tertiary)">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* =================================================================
          BAND 3 — FEATURED ESSAYS (Asymmetric 7 / 5 Broadsheet Spread)
          ================================================================= */}
      {leadArticle && (
        <section className="border-b border-(--color-border-subtle) bg-(--color-bg-deep) py-16 sm:py-24">
          <Container>
            <EditorialSectionHeader
              index="§ 02"
              title={dict.sections.featured}
              viewAllHref={`/${locale}/articles`}
              viewAllLabel={dict.sections.viewAll}
              locale={locale}
            />

            <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
              {/* Lead feature — 7 columns */}
              <article className="group lg:col-span-7">
                <LeadArticleCard
                  article={leadArticle}
                  locale={locale}
                  dict={dict}
                  numerals={numerals}
                />
              </article>

              {/* Companion stacked features — 5 columns */}
              <div className="flex flex-col divide-y divide-(--color-border-subtle) border-t border-(--color-border-subtle) lg:col-span-5 lg:border-s lg:border-t-0 lg:ps-8">
                {companionFeatured.map((article) => (
                  <CompanionArticleRow
                    key={article.slug}
                    article={article}
                    locale={locale}
                    dict={dict}
                    numerals={numerals}
                  />
                ))}
              </div>
            </div>
          </Container>
        </section>
      )}

      {/* =================================================================
          BAND 4 — SCIENTIFIC FIELDS (Ruled Archival Directory Index)
          ================================================================= */}
      <section className="border-b border-(--color-border-subtle) bg-(--color-bg-secondary) py-16 sm:py-24">
        <Container>
          <EditorialSectionHeader
            index="§ 03"
            title={dict.sections.fields}
            viewAllHref={`/${locale}/fields`}
            viewAllLabel={dict.sections.viewAll}
            locale={locale}
          />

          <div className="overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated)">
            <div className="grid grid-cols-1 divide-y divide-(--color-border-subtle) sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5">
              {fields.map((field) => {
                const Icon =
                  FIELD_ICON_MAP[field.icon as keyof typeof FIELD_ICON_MAP] ?? Atom;
                return (
                  <Link
                    key={field.slug}
                    href={`/${locale}/fields/${field.slug}`}
                    className="group flex items-center justify-between gap-3 border-(--color-border-subtle) p-4 transition-colors duration-150 hover:bg-(--color-bg-deep) sm:flex-col sm:items-start sm:border-b sm:border-e sm:p-5"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary) transition-colors duration-150 group-hover:border-(--color-border-strong) group-hover:text-(--color-text-primary)">
                        <Icon className="h-4 w-4" strokeWidth={1.5} />
                      </span>
                      <span
                        dir="ltr"
                        className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)"
                      >
                        {formatNumber(field.articleCount ?? 0, locale, numerals)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 sm:mt-4">
                      <span
                        className="h-2 w-2 shrink-0 rounded-xs"
                        style={{ backgroundColor: field.color }}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple)">
                        {field.name[locale]}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      {/* =================================================================
          BAND 5 — READING APPARATUS (3-Column Monograph Notes)
          ================================================================= */}
      <section className="border-b border-(--color-border-subtle) bg-(--color-bg-deep) py-16 sm:py-24">
        <Container>
          <EditorialSectionHeader
            index="§ 04"
            title={`${dict.journey.title} ${dict.journey.titleMuted}`}
            subtitle={dict.journey.subtitle}
            locale={locale}
          />

          <div className="grid gap-8 md:grid-cols-3 md:gap-10">
            {apparatus.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="border-t border-(--color-border-strong) pt-5"
                >
                  <div className="flex items-center justify-between gap-2 text-(--color-text-tertiary)">
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] text-xs tabular-nums"
                    >
                      {step.num}
                    </span>
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-medium text-(--color-text-primary)">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-(--color-text-secondary)">
                    {step.body}
                  </p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* =================================================================
          BAND 6 — LATEST ESSAYS + MOST READ LEDGER (Asymmetric 8 / 4 Split)
          ================================================================= */}
      <section className="bg-(--color-bg-deep) py-16 sm:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Latest essays — 8 columns */}
            <div className="lg:col-span-8">
              <EditorialSectionHeader
                index="§ 05"
                title={dict.sections.latest}
                viewAllHref={`/${locale}/articles`}
                viewAllLabel={dict.sections.viewAll}
                locale={locale}
              />

              <div className="grid gap-6 sm:grid-cols-2">
                {latestArticles.map((article) => (
                  <UnslopEssayCard
                    key={article.slug}
                    article={article}
                    locale={locale}
                    dict={dict}
                    numerals={numerals}
                  />
                ))}
              </div>
            </div>

            {/* Most read numbered ledger — 4 columns */}
            <aside className="lg:col-span-4">
              <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-6">
                <div className="flex items-center justify-between gap-2 border-b border-(--color-border-subtle) pb-4">
                  <div>
                    <span
                      dir="ltr"
                      className="font-[family-name:var(--font-mono)] text-xs text-(--color-accent-purple)"
                    >
                      § 06
                    </span>
                    <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-medium text-(--color-text-primary)">
                      {dict.sections.trending}
                    </h2>
                  </div>
                </div>

                <ol className="divide-y divide-(--color-border-subtle)">
                  {trendingArticles.map((article, idx) => (
                    <li key={article.slug} className="py-4 first:pt-4 last:pb-0">
                      <Link
                        href={`/${locale}/articles/${article.slug}`}
                        className="group flex items-start gap-3"
                      >
                        <span
                          dir="ltr"
                          className="mt-0.5 w-6 shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)"
                        >
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs text-(--color-text-tertiary)">
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-xs"
                              style={{ backgroundColor: article.fieldColor }}
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              {dict.fields[article.field as keyof typeof dict.fields]}
                            </span>
                          </div>
                          <h3 className="mt-1 text-sm font-medium leading-snug text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple)">
                            {article.title}
                          </h3>
                          <div className="mt-1.5 flex items-center gap-3 text-xs tabular-nums text-(--color-text-tertiary)">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                              {formatCount(article.readingTimeMinutes, locale, numerals)} {dict.common.minutes}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                              {formatNumber(article.views, locale, numerals)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </Container>
      </section>
    </div>
  );
}

function EditorialSectionHeader({
  index,
  title,
  subtitle,
  viewAllHref,
  viewAllLabel,
  locale,
}: {
  index: string;
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  locale: Locale;
}) {
  const ForwardArrow = locale === "fa" ? ArrowLeft : ArrowRight;
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-(--color-border-subtle) pb-5 sm:mb-10">
      <div>
        <span
          dir="ltr"
          className="font-[family-name:var(--font-mono)] text-xs font-medium text-(--color-accent-purple)"
        >
          {index}
        </span>
        <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-2xl font-medium text-(--color-text-primary) sm:text-3xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm text-(--color-text-secondary)">
            {subtitle}
          </p>
        )}
      </div>
      {viewAllHref && viewAllLabel && (
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors duration-150 hover:text-(--color-accent-purple)"
        >
          <span>{viewAllLabel}</span>
          <ForwardArrow className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      )}
    </div>
  );
}

function LeadArticleCard({
  article,
  locale,
  dict,
  numerals,
}: {
  article: Article;
  locale: Locale;
  dict: Dictionary;
  numerals: Numerals;
}) {
  const coverSrc = sanitizeUrl(article.cover, { allowRelative: true, allowHash: false });
  const cardImage = coverSrc ? resolveArticleCardImage(coverSrc, "large") : null;
  const href = `/${locale}/articles/${article.slug}`;

  return (
    <Link href={href} className="block">
      {cardImage && (
        <div className="overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardImage.src}
            srcSet={cardImage.srcSet}
            sizes={cardImage.sizes}
            width={cardImage.width}
            height={cardImage.height}
            alt={article.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="aspect-[16/10] w-full object-cover transition-opacity duration-200 group-hover:opacity-92"
          />
        </div>
      )}

      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-text-tertiary)">
          <span
            className="h-2 w-2 shrink-0 rounded-xs"
            style={{ backgroundColor: article.fieldColor }}
            aria-hidden="true"
          />
          <span className="font-medium text-(--color-text-secondary)">
            {dict.fields[article.field as keyof typeof dict.fields]}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(article.publishedAt, locale, numerals)}</span>
        </div>

        <h3 className="mt-2.5 font-[family-name:var(--font-display)] text-2xl font-medium text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple) sm:text-3xl">
          {article.title}
        </h3>

        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-(--color-text-secondary) sm:text-base">
          {article.excerpt}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs tabular-nums text-(--color-text-tertiary)">
          {article.authorName && (
            <span className="font-medium text-(--color-text-secondary)">{article.authorName}</span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
            {formatCount(article.readingTimeMinutes, locale, numerals)} {dict.common.minutes}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
            {formatNumber(article.views, locale, numerals)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function CompanionArticleRow({
  article,
  locale,
  dict,
  numerals,
}: {
  article: Article;
  locale: Locale;
  dict: Dictionary;
  numerals: Numerals;
}) {
  const coverSrc = sanitizeUrl(article.cover, { allowRelative: true, allowHash: false });
  const cardImage = coverSrc ? resolveArticleCardImage(coverSrc, "default") : null;
  const href = `/${locale}/articles/${article.slug}`;

  return (
    <article className="py-6 first:pt-0 last:pb-0">
      <Link href={href} className="group block">
        {cardImage && (
          <div className="mb-4 overflow-hidden rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary)">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardImage.src}
              srcSet={cardImage.srcSet}
              sizes={cardImage.sizes}
              width={cardImage.width}
              height={cardImage.height}
              alt={article.title}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="aspect-[16/9] w-full object-cover transition-opacity duration-200 group-hover:opacity-92"
            />
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-(--color-text-tertiary)">
          <span
            className="h-2 w-2 shrink-0 rounded-xs"
            style={{ backgroundColor: article.fieldColor }}
            aria-hidden="true"
          />
          <span className="font-medium text-(--color-text-secondary)">
            {dict.fields[article.field as keyof typeof dict.fields]}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(article.publishedAt, locale, numerals)}</span>
        </div>

        <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg font-medium text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple)">
          {article.title}
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-(--color-text-secondary)">
          {article.excerpt}
        </p>

        <div className="mt-3 flex items-center gap-3 text-xs tabular-nums text-(--color-text-tertiary)">
          {article.authorName && <span>{article.authorName}</span>}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
            {formatCount(article.readingTimeMinutes, locale, numerals)} {dict.common.minutes}
          </span>
        </div>
      </Link>
    </article>
  );
}

function UnslopEssayCard({
  article,
  locale,
  dict,
  numerals,
}: {
  article: Article;
  locale: Locale;
  dict: Dictionary;
  numerals: Numerals;
}) {
  const coverSrc = sanitizeUrl(article.cover, { allowRelative: true, allowHash: false });
  const cardImage = coverSrc ? resolveArticleCardImage(coverSrc, "default") : null;
  const href = `/${locale}/articles/${article.slug}`;

  return (
    <article className="group flex flex-col rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-3 transition-colors duration-150 hover:border-(--color-border-strong)">
      <Link href={href} className="flex flex-1 flex-col">
        {cardImage && (
          <div className="overflow-hidden rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary)">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardImage.src}
              srcSet={cardImage.srcSet}
              sizes={cardImage.sizes}
              width={cardImage.width}
              height={cardImage.height}
              alt={article.title}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="aspect-[16/10] w-full object-cover transition-opacity duration-200 group-hover:opacity-92"
            />
          </div>
        )}

        <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
          <div className="flex items-center gap-1.5 text-xs text-(--color-text-tertiary)">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-xs"
              style={{ backgroundColor: article.fieldColor }}
              aria-hidden="true"
            />
            <span>{dict.fields[article.field as keyof typeof dict.fields]}</span>
          </div>

          <h3 className="mt-2 font-[family-name:var(--font-display)] text-base font-medium leading-snug text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple)">
            {article.title}
          </h3>

          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-(--color-text-secondary)">
            {article.excerpt}
          </p>

          <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs tabular-nums text-(--color-text-tertiary)">
            <span className="truncate">{article.authorName ?? ""}</span>
            <span className="inline-flex shrink-0 items-center gap-1">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
              {formatCount(article.readingTimeMinutes, locale, numerals)} {dict.common.minutes}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
