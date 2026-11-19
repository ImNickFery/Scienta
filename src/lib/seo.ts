import type { Metadata } from "next";
import type { Article, Author } from "@/types";
import type { Locale } from "@/lib/i18n/config";

export const SITE_NAME = "Scienta";
export const SITE_URL = "https://scienta.ir";
export const SITE_DESCRIPTION_FA =
  "پلتفرم علمی غوطه‌ور برای روایت‌های عمیق در فیزیک، فضا، هوش مصنوعی و ریاضیات.";
export const SITE_DESCRIPTION_EN =
  "An immersive scientific platform for deep narratives in physics, space, AI, and mathematics.";

export function buildBaseMetadata(locale: Locale, pathname = ""): Metadata {
  const description = locale === "fa" ? SITE_DESCRIPTION_FA : SITE_DESCRIPTION_EN;
  const url = `${SITE_URL}/${locale}${pathname}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
    description,
    alternates: {
      canonical: url,
      languages: {
        fa: `${SITE_URL}/fa${pathname}`,
        en: `${SITE_URL}/en${pathname}`,
      },
      types: {
        "application/rss+xml": [
          {
            url: `${SITE_URL}/${locale}/rss.xml`,
            title: locale === "fa" ? `${SITE_NAME} RSS (فارسی)` : `${SITE_NAME} RSS (English)`,
          },
        ],
      },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: locale === "fa" ? "fa_IR" : "en_US",
      url,
      title: SITE_NAME,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export function buildArticleMetadata(
  locale: Locale,
  article: Article,
  alternateSlugs?: Partial<Record<Locale, string>>
): Metadata {
  const defaultUrl = `${SITE_URL}/${locale}/articles/${article.slug}`;
  const canonical = article.canonicalUrl?.trim() || defaultUrl;
  const title = article.seoTitle?.trim() || article.title;
  const description = article.seoDescription?.trim() || article.excerpt;
  const keywords = article.seoKeywords
    ? article.seoKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : article.tags;

  const languages: Partial<Record<Locale, string>> = {};
  if (alternateSlugs?.fa) languages.fa = `${SITE_URL}/fa/articles/${alternateSlugs.fa}`;
  if (alternateSlugs?.en) languages.en = `${SITE_URL}/en/articles/${alternateSlugs.en}`;
  if (!languages[locale]) languages[locale] = defaultUrl;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
      languages,
      types: {
        "application/rss+xml": [
          {
            url: `${SITE_URL}/${locale}/rss.xml`,
            title: locale === "fa" ? `${SITE_NAME} RSS (فارسی)` : `${SITE_NAME} RSS (English)`,
          },
        ],
      },
    },
    openGraph: {
      type: "article",
      title,
      description,
      url: defaultUrl,
      locale: locale === "fa" ? "fa_IR" : "en_US",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt ?? article.publishedAt,
      tags: article.tags,
    },
    twitter: {
      card: article.twitterCard === "summary" ? "summary" : "summary_large_image",
      title,
      description,
    },
  };
}

export function articleJsonLd(locale: Locale, article: Article, author: Author | undefined) {
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: article.title,
    description: article.excerpt,
    image: `${SITE_URL}/${locale}/articles/${article.slug}/opengraph-image`,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    author: author
      ? { "@type": "Person", name: author.name[locale] }
      : { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/${locale}/articles/${article.slug}` },
    keywords: article.tags.join(", "),
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
  };
}
