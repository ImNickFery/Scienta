import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";
import "../globals.css";
import { locales, isValidLocale, dir, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getFields } from "@/lib/taxonomy";
import { buildBaseMetadata, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { safeJsonLd } from "@/lib/security";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { KineticScrollRuler } from "@/components/layout/kinetic-scroll-ruler";
import { getLocaleFontVariables } from "@/fonts";
import { getNumerals } from "@/lib/i18n/numerals-server";
import { getSiteModes } from "@/lib/site-modes-server";
import { NumeralsProvider } from "@/components/i18n/numerals-provider";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";
import { SiteAnalyticsTracker } from "@/components/analytics/site-analytics-tracker";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05050A",
  // Lets fixed/sticky UI opt into padding for the notch/Dynamic Island and
  // home-indicator area via env(safe-area-inset-*) — without this the env()
  // values are always 0 and safe-area CSS below is a no-op.
  viewportFit: "cover",
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
  return buildBaseMetadata(locale);
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isValidLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const [dict, fields, numerals, siteModes] = await Promise.all([
    getDictionary(locale),
    getFields(),
    getNumerals(),
    getSiteModes(),
  ]);

  return (
    // data-numerals drives the font-feature rule in globals.css. Rendering it
    // from the cookie here is what keeps the first paint in the reader's chosen
    // numerals instead of flipping once the client picks the preference up.
    // data-site-theme / data-ambient-mode / data-contrast-mode are loaded from
    // DB settings so the admin-configured site mode renders on first paint.
    <html
      lang={locale}
      dir={dir(locale)}
      data-numerals={numerals}
      data-design-mode={siteModes.designMode}
      data-color-scheme={siteModes.colorScheme}
      data-site-theme={siteModes.theme}
      data-ambient-mode={siteModes.ambientMode}
      data-contrast-mode={siteModes.contrastMode}
      data-scroll-behavior="smooth"
      className={getLocaleFontVariables(locale)}
    >
      <body className="min-h-dvh bg-(--color-bg-deep) antialiased">
        <AnalyticsScripts />
        <SiteAnalyticsTracker locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd(locale)) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd(locale)) }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[100] focus:rounded-full focus:bg-(--color-accent-purple) focus:px-4 focus:py-2 focus:text-white"
        >
          {locale === "fa" ? "رفتن به محتوای اصلی" : "Skip to main content"}
        </a>
        <NumeralsProvider initial={numerals}>
          {siteModes.designMode === "unslop-kinetic" && <KineticScrollRuler />}
          <Navbar locale={locale} dict={dict} fields={fields} designMode={siteModes.designMode} />
          <main id="main-content" className="overflow-x-clip">{children}</main>
          <Footer
            locale={locale}
            dict={dict}
            fields={fields}
            numerals={numerals}
            designMode={siteModes.designMode}
          />
        </NumeralsProvider>
      </body>
    </html>
  );
}
