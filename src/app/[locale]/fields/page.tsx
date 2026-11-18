import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Atom, Orbit, Cpu, Rocket, Waves, Sigma, Dna, HeartPulse, Cog, Microchip,
} from "lucide-react";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildBaseMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { getFields } from "@/lib/taxonomy";

const iconMap = {
  atom: Atom, orbit: Orbit, cpu: Cpu, rocket: Rocket, waves: Waves,
  sigma: Sigma, dna: Dna, "heart-pulse": HeartPulse, cog: Cog, microchip: Microchip,
};

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
  const base = buildBaseMetadata(locale, "/fields");
  return { ...base, title: locale === "fa" ? "حوزه‌های علمی" : "Scientific Fields" };
}

export default async function FieldsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);
  const fields = await getFields();

  return (
    <Container className="py-20">
      <header className="mb-12 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-orange)">
          {locale === "fa" ? "کاوش کنید" : "Explore"}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-aurora">
          {dict.sections.fields}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => {
          const Icon = iconMap[f.icon as keyof typeof iconMap] ?? Atom;
          const count = f.articleCount ?? 0;
          return (
            <Link
              key={f.slug}
              href={`/${locale}/fields/${f.slug}`}
              className="card-elevated group flex items-center gap-4 rounded-2xl p-6"
            >
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
                style={{ background: `${f.color}22`, color: f.color }}
              >
                <Icon className="h-7 w-7" />
              </span>
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)">
                  {f.name[locale]}
                </h2>
                <p className="text-sm text-(--color-text-tertiary)">
                  {count} {locale === "fa" ? "مقاله" : "articles"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </Container>
  );
}
