import Link from "next/link";
import { Rss } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { FooterBackToTop } from "./footer-actions";
import { Container } from "@/components/ui/container";
import { NewsletterForm } from "@/components/forms/newsletter-form";
import { formatCount } from "@/lib/utils";
import type { FieldRecord } from "@/lib/taxonomy";
import type { Locale } from "@/lib/i18n/config";
import { DEFAULT_NUMERALS, type Numerals } from "@/lib/i18n/numerals";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { isUnslopStyle, type DesignMode } from "@/lib/site-modes";

export interface FooterProps {
  locale: Locale;
  dict: Dictionary;
  fields: FieldRecord[];
  numerals?: Numerals;
  designMode?: DesignMode;
}

export function Footer({
  locale,
  dict,
  fields,
  numerals = DEFAULT_NUMERALS,
  designMode = "classic",
}: FooterProps) {
  const isFa = locale === "fa";
  const isUnslop = isUnslopStyle(designMode);
  const year = formatCount(new Date().getFullYear(), locale, numerals);

  const publicationLinks = [
    { href: `/${locale}/articles`, label: dict.nav.articles },
    { href: `/${locale}/authors`, label: isFa ? "نویسندگان" : "Authors" },
    { href: `/${locale}/saved`, label: isFa ? "کتابخانه ذخیره‌شده" : "Saved Library" },
    { href: `/${locale}/about`, label: dict.nav.about },
    { href: `/${locale}/contact`, label: dict.nav.contact },
    { href: "/admin/login", label: isFa ? "پنل مدیریت" : "Admin Panel" },
  ];

  const isEditorial = designMode === "unslop";
  const isKinetic = designMode === "unslop-kinetic";

  return (
    <footer
      className={
        isEditorial
          ? "relative mt-24 border-t-2 border-(--color-text-primary)/75 bg-(--color-bg-secondary) text-(--color-text-primary)"
          : isKinetic
            ? "relative mt-24 border-t border-(--color-border-subtle) bg-(--color-bg-secondary) text-(--color-text-primary)"
            : "relative mt-28 border-t border-(--color-border-subtle) bg-(--color-bg-secondary) text-(--color-text-primary)"
      }
    >
      {/* Subtle mode-specific top accent hairline */}
      {isKinetic && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[2px] pointer-events-none"
        >
          <Container>
            <div className="h-[2px] w-16 bg-(--color-accent-purple)" />
          </Container>
        </div>
      )}
      {!isUnslop && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-(--color-accent-purple)/45 to-transparent"
        />
      )}

      <Container className="pb-5 pt-11 sm:pb-6 sm:pt-12">
        {/* Single calm 3-zone row: Brand + inline newsletter | 10 Fields (2x5) | Publication */}
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Zone 1: Brand, brief manifesto & unboxed inline newsletter */}
          <div className="min-w-0 lg:col-span-5">
            <BrandMark locale={locale} designMode={designMode} />
            <p className="mt-3.5 max-w-sm text-sm leading-relaxed text-(--color-text-secondary)">
              {dict.footer.tagline}
            </p>

            <div className="mt-6 max-w-md">
              <p className="mb-2.5 text-xs font-medium text-(--color-text-tertiary)">
                {dict.footer.newsletter} — {dict.footer.newsletterCta}
              </p>
              <NewsletterForm locale={locale} dict={dict} designMode={designMode} />
            </div>
          </div>

          {/* Zone 2: Clean borderless 2x5 scientific fields index */}
          <div className="min-w-0 lg:col-span-4">
            <h3 className="mb-4 text-xs font-semibold text-(--color-text-primary)">
              {dict.nav.fields}
            </h3>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm text-(--color-text-secondary)">
              {fields.map((field) => (
                <li key={field.slug} className="min-w-0">
                  <Link
                    href={`/${locale}/fields/${field.slug}`}
                    className="inline-block max-w-full truncate transition-colors duration-150 hover:text-(--color-accent-purple)"
                  >
                    {field.name[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Zone 3: Essential publication links (6 rows — matches 2x5 field height) */}
          <div className="min-w-0 lg:col-span-3">
            <h3 className="mb-4 text-xs font-semibold text-(--color-text-primary)">
              {isFa ? "ساینتا" : "Scienta"}
            </h3>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm text-(--color-text-secondary) sm:grid-cols-1">
              {publicationLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-block transition-colors duration-150 hover:text-(--color-accent-purple)"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Quiet bottom colophon bar */}
        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-(--color-border-subtle) pt-4 text-xs text-(--color-text-tertiary) sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <p>© {year} Scienta — {dict.footer.rights}</p>
            <span aria-hidden="true" className="hidden opacity-50 sm:inline">·</span>
            <Link
              href={`/${locale}/privacy`}
              className="transition-colors hover:text-(--color-text-primary)"
            >
              {dict.footer.privacy}
            </Link>
            <Link
              href={`/${locale}/terms`}
              className="transition-colors hover:text-(--color-text-primary)"
            >
              {dict.footer.terms}
            </Link>
            <a
              href={`/${locale}/rss.xml`}
              className="inline-flex items-center gap-1 transition-colors hover:text-(--color-accent-purple)"
            >
              <Rss className="h-3 w-3" strokeWidth={1.75} />
              <span dir="ltr" className="font-[family-name:var(--font-mono)]">RSS</span>
            </a>
          </div>

          <FooterBackToTop label={dict.common.backToTop} />
        </div>
      </Container>
    </footer>
  );
}
