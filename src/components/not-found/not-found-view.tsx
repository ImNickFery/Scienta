"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Home,
  Search,
  Undo2,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/animations/aurora-background";
import { Starfield } from "@/components/animations/starfield";
import { EventHorizonGraphic } from "./event-horizon-graphic";
import { SpacetimeMotionLayer } from "./spacetime-motion-layer";
import { buildSearchHref } from "@/lib/navigation";
import { copyToClipboard } from "@/lib/clipboard";
import {
  extractQueryHintFromPath,
  formatMissingPath,
  resolveLocaleFromPathname,
} from "@/lib/not-found";
import type { Locale } from "@/lib/i18n/config";
import type { FieldRecord } from "@/lib/taxonomy";

export interface NotFoundArticleSummary {
  slug: string;
  title: string;
  excerpt: string;
  field: string;
  fieldColor: string;
  readingTimeMinutes: number;
}

interface NotFoundViewProps {
  articlesByLocale: Record<Locale, NotFoundArticleSummary[]>;
  fields: FieldRecord[];
}

export function NotFoundView({ articlesByLocale, fields }: NotFoundViewProps) {
  const pathname = usePathname();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const locale = resolveLocaleFromPathname(pathname);
  const isFa = locale === "fa";

  const missingPath = formatMissingPath(pathname);
  const queryHint = extractQueryHintFromPath(pathname);

  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const articles = articlesByLocale[locale] ?? [];
  const activeFields = fields.slice(0, 8);
  const fieldNameMap = new Map<string, string>(fields.map((f) => [f.slug, f.name[locale]]));

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = query.trim() || queryHint;
    router.push(buildSearchHref(locale, target));
  }

  async function handleCopyPath() {
    if (!missingPath) return;
    const ok = await copyToClipboard(missingPath);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleGoBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${locale}`);
    }
  }

  const ForwardIcon = isFa ? ArrowLeft : ArrowRight;
  const enterTransition = { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="relative overflow-hidden">
      {/* Upper Observatory Split Section */}
      <section className="relative py-14 sm:py-20 lg:py-24">
        <AuroraBackground />
        <Starfield density={42} />
        <SpacetimeMotionLayer />

        <Container className="relative">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
            {/* Editorial Copy & Recovery Controls */}
            <motion.div
              className="lg:col-span-7"
              initial={prefersReducedMotion ? false : { opacity: 0.01, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={enterTransition}
            >
              {/* Quiet unboxed status kicker — zero pills, zero decorative dots */}
              <div className="flex flex-wrap items-center gap-2.5 text-sm text-(--color-text-tertiary)">
                <span dir="ltr" className="font-mono font-semibold tabular-nums text-(--color-accent-orange)">
                  404
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-(--color-text-secondary)">
                  {isFa ? "صفحه مورد نظر یافت نشد" : "Page not found"}
                </span>
              </div>

              <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-extrabold text-(--color-text-primary) [text-wrap:balance] sm:text-4xl lg:text-5xl">
                {isFa ? (
                  <>
                    این مسیر فراتر از{" "}
                    <span className="text-gradient-aurora whitespace-nowrap">افق رویداد</span>{" "}
                    ساینتا قرار دارد
                  </>
                ) : (
                  <>
                    This coordinate lies beyond our{" "}
                    <span className="text-gradient-aurora whitespace-nowrap">event horizon</span>
                  </>
                )}
              </h1>

              <p className="mt-4 max-w-xl text-base text-(--color-text-secondary) [text-wrap:pretty] sm:text-lg">
                {isFa
                  ? "نشانی درخواستی ممکن است جابه‌جا شده، حذف شده یا اشتباه وارد شده باشد. می‌توانید در آرشیو مقالات علمی جستجو کنید یا از مسیرهای زیر ادامه دهید."
                  : "The page you requested may have moved, been removed, or been mistyped. Search the scientific archive directly or continue from the curated destinations below."}
              </p>

              {/* Missing path readout with working copy button */}
              {missingPath && (
                <div className="mt-6 flex max-w-xl items-center justify-between gap-3 rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)/90 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="sr-only">
                      {isFa ? "مسیر درخواستی" : "Requested path"}
                    </span>
                    <code
                      dir="ltr"
                      className="block truncate text-left rtl:text-right font-mono text-xs text-(--color-text-secondary) sm:text-sm"
                    >
                      {missingPath}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPath}
                    aria-label={isFa ? "کپی کردن نشانی مسیر" : "Copy missing path"}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-elevated) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-(--color-accent-orange)" aria-hidden="true" />
                        <span>{isFa ? "کپی شد" : "Copied"}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isFa ? "کپی مسیر" : "Copy path"}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Direct Archive Search Form */}
              <form
                onSubmit={handleSearchSubmit}
                role="search"
                className="mt-6 max-w-xl"
              >
                <label htmlFor="not-found-search" className="sr-only">
                  {isFa ? "جستجو در مقالات ساینتا" : "Search Scienta articles"}
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-(--color-border-strong) bg-(--color-bg-secondary) p-1.5 transition-colors focus-within:border-(--color-accent-purple)">
                  <Search
                    className="ms-2.5 h-4 w-4 shrink-0 text-(--color-text-tertiary)"
                    aria-hidden="true"
                  />
                  <input
                    id="not-found-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      isFa
                        ? "جستجوی مقاله، نظریه، فیزیک کوانتوم، نجوم..."
                        : "Search articles, theories, quantum physics, cosmos..."
                    }
                    className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-(--color-bg-elevated) px-4 text-sm font-medium text-(--color-text-primary) border border-(--color-border-subtle) transition-colors hover:border-(--color-accent-purple) hover:text-white"
                  >
                    {isFa ? "جستجو" : "Search"}
                  </button>
                </div>

                {queryHint && (
                  <p className="mt-2.5 text-xs text-(--color-text-tertiary)">
                    {isFa ? "شاید دنبال این موضوع بودید: " : "Looking for something about "}
                    <Link
                      href={buildSearchHref(locale, queryHint)}
                      className="font-medium text-(--color-accent-orange) underline decoration-(--color-accent-orange)/40 underline-offset-4 transition-colors hover:text-(--color-text-primary)"
                    >
                      {queryHint}
                    </Link>
                  </p>
                )}
              </form>

              {/* Primary + Secondary Recovery Actions */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button href={`/${locale}`} size="md" className="w-full sm:w-auto">
                  <Home className="h-4 w-4" aria-hidden="true" />
                  <span>{isFa ? "بازگشت به خانه" : "Back to home"}</span>
                </Button>

                <div className="flex items-center gap-2 sm:gap-3">
                  <Button href={`/${locale}/articles`} variant="secondary" size="md" className="flex-1 sm:flex-none">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    <span>{isFa ? "مرور همه مقالات" : "Browse articles"}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={handleGoBack}
                    className="shrink-0"
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    <span>{isFa ? "صفحه قبلی" : "Go back"}</span>
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Precision Observatory Visual Anchor */}
            <div className="lg:col-span-5">
              <EventHorizonGraphic locale={locale} />
            </div>
          </div>
        </Container>
      </section>

      {/* Curated Recovery Strip: Recommended Articles + Active Scientific Fields */}
      {(articles.length > 0 || activeFields.length > 0) && (
        <section className="seam-top relative py-14 sm:py-16">
          <Container>
            {articles.length > 0 && (
              <div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-(--color-text-primary) sm:text-2xl">
                      {isFa ? "پیشنهادهایی برای ادامه مطالعه" : "Continue reading from the archive"}
                    </h2>
                    <p className="mt-1 text-sm text-(--color-text-tertiary)">
                      {isFa
                        ? "تازه‌ترین مقاله‌های علمی منتشرشده در ساینتا"
                        : "Recent peer-reviewed narratives published on Scienta"}
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/articles`}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary)"
                  >
                    <span>{isFa ? "مشاهده همه مقالات" : "View all articles"}</span>
                    <ForwardIcon className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                  {articles.map((article) => {
                    const fieldLabel = fieldNameMap.get(article.field) ?? article.field;
                    return (
                      <Link
                        key={article.slug}
                        href={`/${locale}/articles/${article.slug}`}
                        className="group flex flex-col justify-between rounded-2xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-(--color-border-strong)"
                      >
                        <div>
                          {/* Unboxed metadata with typographic separator */}
                          <div className="flex items-center gap-2 text-xs text-(--color-text-tertiary)">
                            <span style={{ color: article.fieldColor }} className="font-medium">
                              {fieldLabel}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {article.readingTimeMinutes} {isFa ? "دقیقه مطالعه" : "min read"}
                            </span>
                          </div>

                          <h3 className="mt-2.5 font-[family-name:var(--font-display)] text-base font-bold text-(--color-text-primary) transition-colors group-hover:text-(--color-accent-orange) sm:text-lg">
                            {article.title}
                          </h3>

                          {article.excerpt && (
                            <p className="mt-2 line-clamp-2 text-sm text-(--color-text-secondary)">
                              {article.excerpt}
                            </p>
                          )}
                        </div>

                        <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-(--color-text-secondary) transition-colors group-hover:text-(--color-text-primary)">
                          <span>{isFa ? "مطالعه مقاله" : "Read article"}</span>
                          <ForwardIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Scientific Fields Directory — clean typographic list (no pill cloud) */}
            {activeFields.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2.5 border-t border-(--color-border-subtle) pt-6 text-sm">
                <span className="font-medium text-(--color-text-tertiary)">
                  {isFa ? "شاخه‌های علمی:" : "Explore fields:"}
                </span>
                {activeFields.map((field) => (
                  <Link
                    key={field.slug}
                    href={`/${locale}/fields/${field.slug}`}
                    className="whitespace-nowrap text-(--color-text-secondary) underline-offset-4 transition-colors hover:text-(--color-text-primary) hover:underline"
                  >
                    {field.name[locale]}
                  </Link>
                ))}
              </div>
            )}
          </Container>
        </section>
      )}
    </div>
  );
}
