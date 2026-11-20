import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Hash, Tags } from "lucide-react";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getAllTagRecords } from "@/lib/content";
import { buildPageMetadata, breadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import { safeJsonLd } from "@/lib/security";
import { getNumerals } from "@/lib/i18n/numerals-server";
import { formatCount } from "@/lib/utils";
import { Container } from "@/components/ui/container";
import { ScrollReveal } from "@/components/animations/scroll-reveal";

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
  return buildPageMetadata(locale, "/tags", {
    title: locale === "fa" ? "برچسب‌های علمی" : "Scientific Tags",
    description:
      locale === "fa"
        ? "مرور و کشف مقالات علمی ساینتا بر اساس کلیدواژه‌ها، مفاهیم و برچسب‌های تخصصی در فیزیک، نجوم، هوش مصنوعی و ریاضیات."
        : "Browse and discover Scienta scientific articles by specialized keywords, concepts, and research tags across physics, space, AI, and math.",
  });
}

const ACCENTS = ["#7B3FFB", "#FF7A00", "#FF3C5A", "#38BDF8", "#10B981"];

export default async function TagsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const numerals = await getNumerals();
  const tags = await getAllTagRecords();

  const breadcrumb = breadcrumbJsonLd([
    { name: locale === "fa" ? "خانه" : "Home", url: `${SITE_URL}/${locale}` },
    { name: locale === "fa" ? "برچسب‌ها" : "Tags", url: `${SITE_URL}/${locale}/tags` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }}
      />
      <Container className="py-20">
        <nav className="mb-6 flex items-center gap-2 text-xs text-(--color-text-tertiary)">
          <Link href={`/${locale}`} className="hover:text-(--color-text-primary)">
            {locale === "fa" ? "خانه" : "Home"}
          </Link>
          <span>/</span>
          <span className="text-(--color-text-secondary)">
            {locale === "fa" ? "برچسب‌ها" : "Tags"}
          </span>
        </nav>

        <header className="mb-12 max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-purple)">
            {locale === "fa" ? "نمایه موضوعی" : "Topic Index"}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-aurora">
            {locale === "fa" ? "برچسب‌های علمی" : "Scientific Tags"}
          </h1>
          <p className="mt-3 text-(--color-text-secondary)">
            {locale === "fa"
              ? "مقالات را بر اساس مفاهیم و کلیدواژه‌های تخصصی دنبال کنید."
              : "Explore published research essays grouped by core scientific concepts."}
          </p>
        </header>

        {tags.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-(--color-border-subtle) py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] text-(--color-text-tertiary)">
              <Tags className="h-6 w-6" />
            </span>
            <p className="text-(--color-text-tertiary)">
              {locale === "fa" ? "هنوز برچسبی ثبت نشده است." : "No tags have been published yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag, idx) => {
              const accent = ACCENTS[idx % ACCENTS.length];
              return (
                <ScrollReveal key={tag.slug} delay={Math.min(idx, 9) * 35}>
                  <Link
                    href={`/${locale}/tags/${tag.slug}`}
                    className="card-elevated group flex items-center justify-between gap-3 rounded-2xl p-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: `${accent}20`, color: accent }}
                      >
                        <Hash className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-(--color-text-primary) group-hover:text-(--color-accent-orange)">
                          {tag.name[locale]}
                        </p>
                        <p className="text-xs text-(--color-text-tertiary)" dir="ltr">
                          #{tag.slug}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-(--color-border-subtle) bg-white/[0.04] px-3 py-1 text-xs text-(--color-text-secondary)">
                      {formatCount(tag.count, locale, numerals)}{" "}
                      {locale === "fa" ? "مقاله" : tag.count === 1 ? "article" : "articles"}
                    </span>
                  </Link>
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </Container>
    </>
  );
}
