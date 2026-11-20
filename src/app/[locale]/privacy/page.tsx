import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildPageMetadata } from "@/lib/seo";
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
  return buildPageMetadata(locale, "/privacy", {
    title: dict.footer.privacy,
    description:
      locale === "fa"
        ? "سیاست حفظ حریم خصوصی ساینتا؛ نحوه نگهداری تنظیمات مطالعه، کوکی‌های ضروری و حفاظت از داده‌های کاربران."
        : "Scienta Privacy Policy detailing how reading preferences, essential cookies, and user privacy are protected.",
  });
}

const content = {
  fa: [
    { h: "داده‌هایی که جمع‌آوری می‌کنیم", p: "ما تنها اطلاعات لازم برای بهبود تجربه خواندن شما مانند تنظیمات زبان و ترجیحات نمایش را به‌صورت محلی ذخیره می‌کنیم." },
    { h: "کوکی‌ها", p: "از کوکی‌های ضروری برای عملکرد سایت و تحلیل ناشناس بازدید استفاده می‌شود." },
    { h: "اشتراک‌گذاری اطلاعات", p: "اطلاعات شخصی شما هرگز به ثالث فروخته نمی‌شود." },
    { h: "تماس", p: "برای هرگونه پرسش درباره حریم خصوصی با ما در بخش تماس در ارتباط باشید." },
  ],
  en: [
    { h: "Data We Collect", p: "We only store what's necessary to improve your reading experience, such as language and display preferences, stored locally." },
    { h: "Cookies", p: "We use essential cookies for site functionality and anonymous visit analytics." },
    { h: "Data Sharing", p: "Your personal information is never sold to third parties." },
    { h: "Contact", p: "For any privacy questions, please reach out through our contact page." },
  ],
};

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);

  return (
    <Container size="narrow" className="py-20">
      <h1 className="mb-2 font-[family-name:var(--font-display)] text-4xl font-bold text-(--color-text-primary)">
        {dict.footer.privacy}
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
