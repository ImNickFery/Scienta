import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Eye,
  ListTree,
  Sigma,
  Route,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { UnslopKineticBench } from "./unslop-kinetic-bench";
import { UnslopKineticExplorer } from "./unslop-kinetic-explorer";
import { UnslopKineticDisciplines } from "./unslop-kinetic-disciplines";
import { formatCount, formatNumber } from "@/lib/utils";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { FieldRecord } from "@/lib/taxonomy";
import type { Numerals } from "@/lib/i18n/numerals";
import type { ColorScheme } from "@/lib/site-modes";

export interface UnslopKineticHomeProps {
  locale: Locale;
  dict: Dictionary;
  numerals: Numerals;
  colorScheme: ColorScheme;
  allArticles: Article[];
  trending: Article[];
  fields: FieldRecord[];
  equationCount: number;
  readerCount: number;
}

/**
 * Unslop Kinetic Homepage — Living Optical Lab
 * A completely fresh architectural direction built on the Unslop 9-pass system:
 * - World: Precision studio optical physics bench (alabaster light / dark-room slate)
 * - Hero Visual: Real studio optical glass prism photograph matched to light/dark canvas
 * - Rising Living Centerpiece: Real-time 60fps Canvas simulator (Double-Slit, Kepler Orbit, Horizon)
 * - Interactive Essay Deck: Live discipline tabs + instant sort switcher over real DB essays
 * - Disciplines Share Matrix: Proportional hairline bars (one accent on leader, neutral ramp)
 */
export function UnslopKineticHome({
  locale,
  dict,
  numerals,
  colorScheme,
  allArticles,
  trending,
  fields,
  equationCount,
  readerCount,
}: UnslopKineticHomeProps) {
  const isFa = locale === "fa";
  const ForwardArrow = isFa ? ArrowLeft : ArrowRight;
  const heroPrismSrc =
    colorScheme === "dark"
      ? "/images/unslop-prism-dark.webp"
      : "/images/unslop-prism-light.webp";

  const stats = [
    {
      index: "01",
      value: formatNumber(allArticles.length, locale, numerals),
      plus: false,
      label: dict.stats.articles,
    },
    {
      index: "02",
      value: formatNumber(fields.length, locale, numerals),
      plus: false,
      label: dict.stats.fields,
    },
    {
      index: "03",
      value: formatNumber(equationCount, locale, numerals),
      plus: true,
      label: dict.stats.equations,
    },
    {
      index: "04",
      value: formatNumber(readerCount, locale, numerals),
      plus: true,
      label: dict.stats.readers,
    },
  ];

  const trendingTop = trending.slice(0, 5);
  const maxTrendingViews = Math.max(1, ...trendingTop.map((a) => a.views));

  const protocol = [
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
          BAND 1 — OPTICAL PRISM STUDIO HERO + RISING LIVE PHYSICS BENCH
          ================================================================= */}
      <section className="relative overflow-hidden border-b border-(--color-border-subtle) bg-(--color-bg-deep)">
        {/* Studio photograph of real optical glass prism splitting daylight/beam.
            Zero text in image, so rtl:scale-x-[-1] cleanly keeps the calm empty
            bench behind the right-aligned Persian headline. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-[540px] max-w-[1440px] select-none overflow-hidden md:block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroPrismSrc}
            alt=""
            width={1376}
            height={768}
            fetchPriority="high"
            className="h-full w-full object-cover object-right rtl:scale-x-[-1]"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, #000 0%, #000 70%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, #000 0%, #000 70%, transparent 100%)",
            }}
          />
        </div>

        <Container className="relative z-10 pt-14 sm:pt-20 lg:pt-24">
          <div className="max-w-xl pb-12 sm:pb-16 lg:pb-20">
            <p className="text-xs font-medium text-(--color-text-tertiary)">
              <span
                dir="ltr"
                className="font-[family-name:var(--font-mono)] text-(--color-accent-purple)"
              >
                01 / LAB
              </span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>
                {isFa ? "آزمایشگاه زنده علمی ساینتا" : "Scienta Optical Press"}
              </span>
            </p>

            <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-medium text-(--color-text-primary) [text-wrap:balance] sm:text-5xl lg:text-[3.5rem]">
              {isFa
                ? "فیزیک و ریاضیات را زنده تجربه کنید"
                : "Read science as a living instrument"}
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-(--color-text-secondary) sm:text-lg">
              {dict.hero.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={`/${locale}/articles`}
                className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg bg-(--color-text-primary) px-5 text-sm font-medium text-(--color-bg-deep) transition-[background-color,transform] duration-150 hover:bg-(--color-accent-purple) hover:text-white active:scale-[0.98]"
              >
                <span>{dict.hero.ctaPrimary}</span>
                <ForwardArrow className="h-4 w-4" strokeWidth={1.5} />
              </Link>
              <Link
                href={`/${locale}/fields`}
                className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg border border-(--color-border-strong) bg-(--color-bg-elevated) px-5 text-sm font-medium text-(--color-text-primary) transition-[background-color,border-color,transform] duration-150 hover:bg-(--color-bg-secondary) active:scale-[0.98]"
              >
                <span>{dict.nav.fields}</span>
              </Link>
            </div>
          </div>

          {/* Rising centerpiece: Live 60fps interactive Canvas physics bench */}
          <UnslopKineticBench locale={locale} />
        </Container>
      </section>

      {/* =================================================================
          BAND 2 — CALIBRATION TELEMETRY STRIP
          ================================================================= */}
      <section className="border-b border-(--color-border-subtle) bg-(--color-bg-secondary)">
        <Container className="py-8 sm:py-10">
          <div className="grid grid-cols-2 divide-y divide-(--color-border-subtle) sm:grid-cols-4 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
            {stats.map((stat, idx) => (
              <div
                key={stat.label}
                className={`py-3 sm:px-6 sm:py-1 ${idx === 0 ? "sm:ps-0" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="inline-flex items-baseline gap-0.5 font-[family-name:var(--font-display)] text-2xl font-medium tabular-nums text-(--color-text-primary) sm:text-3xl">
                    <span>{stat.value}</span>
                    {stat.plus && (
                      <span className="text-(--color-accent-purple)" aria-hidden="true">+</span>
                    )}
                  </div>
                  <span
                    dir="ltr"
                    className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)"
                  >
                    {stat.index}
                  </span>
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
          BAND 3 — LIVE INTERACTIVE FILTERABLE ESSAY DECK
          ================================================================= */}
      <section className="border-b border-(--color-border-subtle) py-16 sm:py-20">
        <Container>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p
                dir="ltr"
                className="font-[family-name:var(--font-mono)] text-xs text-(--color-accent-purple)"
              >
                02 / DECK
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-medium text-(--color-text-primary) sm:text-3xl">
                {isFa ? "میز کاوش زنده مقالات" : "Interactive essay deck"}
              </h2>
            </div>

            <Link
              href={`/${locale}/articles`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors duration-150 hover:text-(--color-text-primary)"
            >
              <span>{dict.sections.viewAll}</span>
              <ForwardArrow className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </div>

          <UnslopKineticExplorer
            locale={locale}
            dict={dict}
            numerals={numerals}
            articles={allArticles}
            fields={fields}
          />
        </Container>
      </section>

      {/* =================================================================
          BAND 4 — SCIENTIFIC DISCIPLINES PROPORTIONAL SHARE MATRIX
          One accent for the leading discipline, neutral ramp for the rest.
          ================================================================= */}
      <section className="border-b border-(--color-border-subtle) bg-(--color-bg-secondary) py-16 sm:py-20">
        <Container>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-(--color-border-subtle) pb-6">
            <div>
              <p
                dir="ltr"
                className="font-[family-name:var(--font-mono)] text-xs text-(--color-accent-purple)"
              >
                03 / INDEX
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-medium text-(--color-text-primary) sm:text-3xl">
                {dict.sections.fields}
              </h2>
            </div>
            <Link
              href={`/${locale}/fields`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-(--color-text-secondary) transition-colors duration-150 hover:text-(--color-text-primary)"
            >
              <span>{dict.sections.viewAll}</span>
              <ForwardArrow className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </div>

          <UnslopKineticDisciplines
            locale={locale}
            dict={dict}
            numerals={numerals}
            articles={allArticles}
            fields={fields}
          />
        </Container>
      </section>

      {/* =================================================================
          BAND 5 — RANKED MOST-READ LEDGER + 3-STEP READING PROTOCOL
          ================================================================= */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
            {/* Ranked Most-Read with Proportional Hairline Bars (7 cols) */}
            <div className="lg:col-span-7">
              <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-(--color-border-subtle) pb-4">
                <div>
                  <p
                    dir="ltr"
                    className="font-[family-name:var(--font-mono)] text-xs text-(--color-accent-purple)"
                  >
                    04 / MOST READ
                  </p>
                  <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-medium text-(--color-text-primary)">
                    {dict.sections.trending}
                  </h2>
                </div>
              </div>

              <div className="divide-y divide-(--color-border-subtle)">
                {trendingTop.map((article, idx) => {
                  const pct = Math.max(12, Math.round((article.views / maxTrendingViews) * 100));
                  return (
                    <Link
                      key={article.slug}
                      href={`/${locale}/articles/${article.slug}`}
                      className="group flex items-start gap-4 py-4 transition-colors duration-150"
                    >
                      <span
                        dir="ltr"
                        className={`mt-0.5 w-6 shrink-0 font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums ${
                          idx === 0 ? "text-(--color-accent-purple)" : "text-(--color-text-tertiary)"
                        }`}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="text-base font-medium text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple)">
                            {article.title}
                          </h3>
                          <span className="inline-flex shrink-0 items-center gap-1 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)">
                            <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                            {formatNumber(article.views, locale, numerals)}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-(--color-border-subtle)">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor:
                                  idx === 0
                                    ? "var(--color-accent-purple)"
                                    : "var(--color-text-tertiary)",
                              }}
                            />
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-(--color-text-tertiary)">
                            <Clock className="h-3 w-3" strokeWidth={1.5} />
                            {formatCount(article.readingTimeMinutes, locale, numerals)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 3-Step Reading Protocol (5 cols) */}
            <div className="lg:col-span-5">
              <div className="mb-6 border-b border-(--color-border-subtle) pb-4">
                <p
                  dir="ltr"
                  className="font-[family-name:var(--font-mono)] text-xs text-(--color-accent-purple)"
                >
                  05 / METHOD
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-medium text-(--color-text-primary)">
                  {dict.journey.title}
                </h2>
              </div>

              <div className="space-y-4">
                {protocol.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.num}
                      className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-5"
                    >
                      <div className="flex items-center justify-between text-xs text-(--color-text-tertiary)">
                        <span dir="ltr" className="font-[family-name:var(--font-mono)] tabular-nums">
                          {step.num}
                        </span>
                        <Icon className="h-4 w-4 text-(--color-accent-purple)" strokeWidth={1.5} />
                      </div>
                      <h3 className="mt-3 text-base font-medium text-(--color-text-primary)">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-(--color-text-secondary)">
                        {step.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
