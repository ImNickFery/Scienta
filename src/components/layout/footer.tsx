import Link from "next/link";
import { Sparkles, Rss } from "lucide-react";
import { Container } from "@/components/ui/container";
import { formatCount } from "@/lib/utils";
import type { FieldRecord } from "@/lib/taxonomy";
import { NewsletterForm } from "@/components/forms/newsletter-form";
import type { Locale } from "@/lib/i18n/config";
import { DEFAULT_NUMERALS, type Numerals } from "@/lib/i18n/numerals";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function Footer({
  locale,
  dict,
  fields,
  numerals = DEFAULT_NUMERALS,
}: {
  locale: Locale;
  dict: Dictionary;
  fields: FieldRecord[];
  numerals?: Numerals;
}) {
  const year = formatCount(new Date().getFullYear(), locale, numerals);

  return (
    <footer className="relative mt-32 border-t border-(--color-border-subtle) bg-(--color-bg-secondary)">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-(--color-accent-purple)/40 to-transparent" />
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Link href={`/${locale}`} className="group flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-accent-purple) to-(--color-aurora-3) transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              <span className="text-gradient-aurora">
                Scienta
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-(--color-text-tertiary)">
              {dict.footer.tagline}
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-(--color-text-primary)">{dict.footer.explore}</h3>
            <ul className="space-y-2.5 text-sm text-(--color-text-tertiary)">
              {fields.slice(0, 6).map((f) => (
                <li key={f.slug}>
                  <Link href={`/${locale}/fields/${f.slug}`} className="transition-colors hover:text-(--color-text-primary)">
                    {f.name[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-(--color-text-primary)">{dict.footer.company}</h3>
            <ul className="space-y-2.5 text-sm text-(--color-text-tertiary)">
              <li><Link href={`/${locale}/about`} className="transition-colors hover:text-(--color-text-primary)">{dict.nav.about}</Link></li>
              <li><Link href={`/${locale}/authors`} className="transition-colors hover:text-(--color-text-primary)">{locale === "fa" ? "نویسندگان" : "Authors"}</Link></li>
              <li><Link href={`/${locale}/saved`} className="transition-colors hover:text-(--color-text-primary)">{locale === "fa" ? "کتابخانه ذخیره‌شده" : "Saved Library"}</Link></li>
              <li><Link href={`/${locale}/contact`} className="transition-colors hover:text-(--color-text-primary)">{dict.nav.contact}</Link></li>
              <li><Link href="/admin/login" className="transition-colors hover:text-(--color-text-primary)">{locale === "fa" ? "پنل مدیریت" : "Admin Panel"}</Link></li>
              <li><Link href={`/${locale}/privacy`} className="transition-colors hover:text-(--color-text-primary)">{dict.footer.privacy}</Link></li>
              <li><Link href={`/${locale}/terms`} className="transition-colors hover:text-(--color-text-primary)">{dict.footer.terms}</Link></li>
            </ul>
          </div>

          {/* min-w-0: a grid item defaults to min-width:auto, so this panel would
              otherwise hold the single mobile column open at its own min-content
              (~389px) and push the page into horizontal scroll below ~410px. */}
          <div className="glass-panel min-w-0 rounded-2xl p-6">
            <h3 className="mb-1.5 text-sm font-semibold text-(--color-text-primary)">{dict.footer.newsletter}</h3>
            <p className="mb-4 text-xs text-(--color-text-tertiary)">{dict.footer.newsletterCta}</p>
            <NewsletterForm locale={locale} dict={dict} />
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-(--color-border-subtle) pt-8 text-xs text-(--color-text-tertiary) sm:flex-row">
          <p>
            © {year} Scienta — {dict.footer.rights}
          </p>
          <div className="flex items-center gap-6">
            <a
              href={`/${locale}/rss.xml`}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-(--color-accent-orange)"
            >
              <Rss className="h-3.5 w-3.5" />
              RSS
            </a>
            <Link href={`/${locale}/privacy`} className="transition-colors hover:text-(--color-text-primary)">{dict.footer.privacy}</Link>
            <Link href={`/${locale}/terms`} className="transition-colors hover:text-(--color-text-primary)">{dict.footer.terms}</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
