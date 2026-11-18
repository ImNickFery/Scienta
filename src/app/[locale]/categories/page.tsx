import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Tag, Tags } from "lucide-react";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAllTags } from "@/lib/content";
import { buildBaseMetadata } from "@/lib/seo";
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
  const base = buildBaseMetadata(locale, "/categories");
  return { ...base, title: locale === "fa" ? "دسته‌بندی‌ها" : "Categories" };
}

const ACCENTS = [
  { solid: "#7B3FFB", glow: "rgba(123, 63, 251, 0.4)" },
  { solid: "#FF7A00", glow: "rgba(255, 122, 0, 0.4)" },
  { solid: "#FF3C5A", glow: "rgba(255, 60, 90, 0.4)" },
];

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);
  const tags = await getAllTags(locale);

  const sizeClass = (count: number) => {
    if (count >= 3) return "text-lg px-5 py-2.5";
    if (count === 2) return "text-base px-4 py-2";
    return "text-sm px-3.5 py-1.5";
  };

  return (
    <Container className="py-20">
      <header className="mb-12 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-orange)">
          {locale === "fa" ? "موضوعات" : "Topics"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-aurora">
          {dict.nav.categories}
        </h1>
      </header>

      {tags.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-(--color-border-subtle) py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.04] text-(--color-text-tertiary)">
            <Tags className="h-6 w-6" />
          </span>
          <p className="text-(--color-text-tertiary)">
            {locale === "fa" ? "هنوز موضوعی ثبت نشده است." : "No topics yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map(({ tag, count }, i) => {
            const accent = ACCENTS[i % ACCENTS.length];
            return (
              <ScrollReveal key={tag} delay={Math.min(i, 12) * 40}>
                <Link
                  href={`/${locale}/categories/${encodeURIComponent(tag)}`}
                  style={{ "--tag-glow": accent.glow } as React.CSSProperties}
                  className={`card-elevated group inline-flex items-center gap-2 rounded-full text-(--color-text-secondary) transition-colors hover:text-(--color-text-primary) hover:shadow-[0_12px_30px_-12px_var(--tag-glow)] ${sizeClass(count)}`}
                >
                  <Tag className="h-3.5 w-3.5" style={{ color: accent.solid }} />
                  {tag}
                  <span className="text-(--color-text-tertiary)">({count})</span>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      )}
    </Container>
  );
}
