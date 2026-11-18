import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildBaseMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/container";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};
  const dict = await getDictionary(locale);
  const base = buildBaseMetadata(locale, "/terms");
  return { ...base, title: dict.footer.terms };
}

const content = {
  fa: [
    { h: "پذیرش شرایط", p: "با استفاده از این سایت، شما با شرایط استفاده زیر موافقت می‌کنید." },
    { h: "مالکیت محتوا", p: "تمامی مقالات، تصاویر و تصویرسازی‌ها متعلق به Scienta یا نویسندگان آن است." },
    { h: "استفاده مجاز", p: "می‌توانید مطالب را برای استفاده شخصی و آموزشی به اشتراک بگذارید، مشروط به ذکر منبع." },
    { h: "محدودیت مسئولیت", p: "محتوای علمی صرفاً جنبه آموزشی دارد و جایگزین مشاوره تخصصی نیست." },
  ],
  en: [
    { h: "Acceptance of Terms", p: "By using this site, you agree to the following terms of use." },
    { h: "Content Ownership", p: "All articles, images, and illustrations belong to Scienta or their respective authors." },
    { h: "Permitted Use", p: "You may share content for personal and educational use, provided proper attribution is given." },
    { h: "Limitation of Liability", p: "Scientific content is provided for educational purposes only and is not a substitute for professional advice." },
  ],
};

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);

  return (
    <Container size="narrow" className="py-20">
      <h1 className="mb-2 font-[family-name:var(--font-display)] text-4xl font-bold text-(--color-text-primary)">
        {dict.footer.terms}
      </h1>
      <p className="mb-12 text-sm text-(--color-text-tertiary)">
        {locale === "fa" ? "آخرین به‌روزرسانی: ۱۲ مرداد ۱۴۰۵" : "Last updated: August 2, 2026"}
      </p>
      <div className="prose-scientific space-y-8">
        {content[locale].map((section) => (
          <div key={section.h}>
            <h2 className="mb-2 text-xl font-bold text-(--color-text-primary)">{section.h}</h2>
            <p>{section.p}</p>
          </div>
        ))}
      </div>
    </Container>
  );
}
