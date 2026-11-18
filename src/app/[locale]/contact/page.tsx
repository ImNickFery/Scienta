import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import { isValidLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { buildBaseMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { ContactForm } from "@/components/forms/contact-form";
import { AuroraBackground } from "@/components/animations/aurora-background";

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
  const base = buildBaseMetadata(locale, "/contact");
  return { ...base, title: locale === "fa" ? "تماس با ما" : "Contact" };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);

  const info = [
    { Icon: Mail, label: locale === "fa" ? "ایمیل" : "Email", value: "hello@scienta.ir" },
    { Icon: MessageCircle, label: locale === "fa" ? "شبکه‌های اجتماعی" : "Social", value: "@scienta" },
    { Icon: MapPin, label: locale === "fa" ? "موقعیت" : "Location", value: locale === "fa" ? "دورکار — جهانی" : "Remote — Worldwide" },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem]">
        <AuroraBackground />
      </div>
      <Container size="narrow" className="relative py-20">
        <header className="mb-12 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent-orange)">
            {locale === "fa" ? "در ارتباط باشید" : "Get in touch"}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-gradient-aurora">
            {dict.nav.contact}
          </h1>
          <p className="mt-4 text-(--color-text-secondary)">
            {locale === "fa"
              ? "پیشنهاد مقاله دارید یا می‌خواهید همکاری کنید؟ برایمان بنویسید."
              : "Have a story idea or want to collaborate? We'd love to hear from you."}
          </p>
        </header>

        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          {info.map(({ Icon, label, value }) => (
            <div
              key={label}
              className="card-elevated flex flex-col items-center gap-2 rounded-2xl p-6 text-center"
            >
              <Icon className="h-5 w-5 text-(--color-accent-purple)" />
              <p className="text-xs text-(--color-text-tertiary)">{label}</p>
              <p className="text-sm font-medium text-(--color-text-primary)">{value}</p>
            </div>
          ))}
        </div>

        <ContactForm locale={locale} />
      </Container>
    </div>
  );
}
