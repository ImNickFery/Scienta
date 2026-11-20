import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Microscope, Sparkles as SparklesIcon, Globe2 } from "lucide-react";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { aboutPageJsonLd, breadcrumbJsonLd, buildPageMetadata, SITE_URL } from "@/lib/seo";
import { safeJsonLd } from "@/lib/security";
import { Container } from "@/components/ui/container";
import { formatCount } from "@/lib/utils";
import { getNumerals } from "@/lib/i18n/numerals-server";
import { AuroraBackground } from "@/components/animations/aurora-background";
import { Starfield } from "@/components/animations/starfield";
import { ScrollReveal } from "@/components/animations/scroll-reveal";
import { getAuthors, getFields } from "@/lib/taxonomy";
import { getAllArticles } from "@/lib/content";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const revalidate = 60;

const ABOUT_DESC = {
  fa: "درباره ساینتا (Scienta)؛ پلتفرم علمی دوزبانه برای روایت دقیق و بصری فیزیک، نجوم، فضا، هوش مصنوعی و ریاضیات.",
  en: "Learn about Scienta, a bilingual scientific publication pairing academic rigor with cinematic visual storytelling across physics, space, AI, and math.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};
  return buildPageMetadata(locale, "/about", {
    title: locale === "fa" ? "درباره ما" : "About",
    description: ABOUT_DESC[locale],
  });
}

const values = {
  fa: [
    { title: "دقت علمی", desc: "هر مقاله پیش از انتشار توسط متخصصان همان حوزه بازبینی می‌شود.", Icon: Microscope },
    { title: "زیبایی بصری", desc: "علم را با طراحی‌ای در خور آن روایت می‌کنیم.", Icon: SparklesIcon },
    { title: "دسترس‌پذیری", desc: "محتوای علمی باید برای همه، فارغ از زبان، قابل فهم باشد.", Icon: Globe2 },
  ],
  en: [
    { title: "Scientific Rigor", desc: "Every article is reviewed by specialists in its field before publishing.", Icon: Microscope },
    { title: "Visual Beauty", desc: "We tell science with design that matches its wonder.", Icon: SparklesIcon },
    { title: "Accessibility", desc: "Scientific content should be understandable for everyone, in any language.", Icon: Globe2 },
  ],
};

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const [authors, fields, articles] = await Promise.all([getAuthors(), getFields(), getAllArticles(locale)]);
  const numerals = await getNumerals();

  const stats = [
    { value: articles.length, label: locale === "fa" ? "مقاله منتشرشده" : "Published articles" },
    { value: fields.length, label: locale === "fa" ? "حوزه علمی" : "Scientific fields" },
    { value: authors.length, label: locale === "fa" ? "نویسنده" : "Contributing authors" },
  ];

  const aboutSchema = aboutPageJsonLd(locale, ABOUT_DESC[locale]);
  const breadcrumb = breadcrumbJsonLd([
    { name: locale === "fa" ? "خانه" : "Home", url: `${SITE_URL}/${locale}` },
    { name: locale === "fa" ? "درباره ما" : "About", url: `${SITE_URL}/${locale}/about` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(aboutSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <section className="relative overflow-hidden border-b border-(--color-border-subtle) py-24">
        <AuroraBackground />
        <Starfield density={70} />
        <Container className="relative text-center" size="narrow">
          <ScrollReveal>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-orange)">
              {locale === "fa" ? "درباره ما" : "About"}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-aurora sm:text-5xl">
              {locale === "fa" ? "علمی که ارزش دیدن دارد" : "Science worth seeing"}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-(--color-text-secondary)">
              {locale === "fa"
                ? "Scienta پلتفرمی است برای روایت عمیق و بصری علم؛ جایی که دقت آکادمیک با طراحی سینمایی ترکیب می‌شود تا کنجکاوی علمی به تجربه‌ای فراموش‌نشدنی بدل شود."
                : "Scienta is a platform for deep, visual scientific storytelling — where academic rigor meets cinematic design so scientific curiosity becomes an unforgettable experience."}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <div className="mx-auto mt-12 grid max-w-md grid-cols-3 gap-4 rounded-2xl border border-(--color-border-subtle) bg-white/[0.02] p-6">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="font-[family-name:var(--font-display)] text-3xl font-black text-gradient-aurora">{formatCount(s.value, locale, numerals)}</p>
                  <p className="mt-1 text-xs text-(--color-text-tertiary)">{s.label}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <div className="grid gap-6 sm:grid-cols-3">
            {values[locale].map((v, i) => (
              <ScrollReveal key={v.title} delay={i * 100}>
                <div className="card-elevated group rounded-2xl p-7">
                  <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-(--color-accent-purple)/15 text-(--color-accent-purple) transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                    <v.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)">
                    {v.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-(--color-text-tertiary)">{v.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <ScrollReveal>
            <h2 className="mb-10 text-center font-[family-name:var(--font-display)] text-2xl font-bold text-(--color-text-primary)">
              {locale === "fa" ? "تیم نویسندگان" : "Our Writers"}
            </h2>
          </ScrollReveal>
          <div className="grid gap-5 sm:grid-cols-3">
            {authors.map((author, i) => (
              <ScrollReveal key={author.slug} delay={i * 80}>
                <Link
                  href={`/${locale}/authors/${author.slug}`}
                  className="card-elevated group flex flex-col items-center gap-3 rounded-2xl p-7 text-center"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-(--color-accent-purple) to-(--color-accent-orange) font-[family-name:var(--font-display)] text-xl font-bold text-white transition-transform duration-500 group-hover:scale-110">
                    {author.name[locale].charAt(0)}
                  </span>
                  <div>
                    <p className="font-semibold text-(--color-text-primary)">{author.name[locale]}</p>
                    <p className="text-sm text-(--color-text-tertiary)">{author.title[locale]}</p>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
