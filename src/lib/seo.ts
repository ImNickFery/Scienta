import type { Metadata } from "next";
import type { Article, Author } from "@/types";
import type { Locale } from "@/lib/i18n/config";

export const SITE_NAME = "Scienta";
export const SITE_NAME_FA = "ساینتا";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://scienta.ir"
).replace(/\/+$/, "");

export const SITE_TITLE_FA = "ساینتا — مقالات علمی فیزیک، فضا، هوش مصنوعی و ریاضیات";
export const SITE_TITLE_EN = "Scienta — Deep Scientific Narratives in Physics, Space & AI";

export const SITE_DESCRIPTION_FA =
  "ساینتا پلتفرم علمی دوزبانه برای مطالعه مقالات تحلیلی و عمیق در فیزیک، نجوم، فضا، هوش مصنوعی، کوانتوم و ریاضیات با معادلات تعاملی و روایت بصری.";
export const SITE_DESCRIPTION_EN =
  "Explore deep, peer-reviewed scientific narratives in physics, astronomy, space, AI, quantum mechanics, and mathematics with interactive equations on Scienta.";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image`;

function resolveAbsoluteUrl(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${SITE_URL}${trimmed}`;
  return null;
}

/** Strips markdown/MDX syntax to estimate real reading word count for Schema.org metadata. */
export function estimateWordCount(mdxContent: string): number {
  const plain = mdxContent
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`~>\[\]()]/g, " ")
    .trim();
  if (!plain) return 0;
  return plain
    .split(/\s+/)
    .filter((token) => /[A-Za-z0-9\u0600-\u06FF]/.test(token)).length;
}

function getRobotsConfig(noIndex = false): Metadata["robots"] {
  if (noIndex) {
    return {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    };
  }
  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

export function getSiteVerification(
  env: Record<string, string | undefined> = process.env
): Metadata["verification"] {
  const google = env.GOOGLE_SITE_VERIFICATION?.trim() || undefined;
  const yandex = env.YANDEX_VERIFICATION?.trim() || undefined;
  const bing = env.BING_SITE_VERIFICATION?.trim() || undefined;

  if (!google && !yandex && !bing) return undefined;

  return {
    ...(google ? { google } : {}),
    ...(yandex ? { yandex } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

export interface PageMetadataOptions {
  title?: string;
  description?: string;
  keywords?: string[];
  noIndex?: boolean;
  /** Set to false on routes whose slug is locale-specific and has no 1:1 mirror at the same path. */
  includeAlternates?: boolean;
  ogImage?: string;
}

export function buildBaseMetadata(
  locale: Locale,
  pathname = "",
  options: PageMetadataOptions = {}
): Metadata {
  const brandTitle = locale === "fa" ? SITE_TITLE_FA : SITE_TITLE_EN;
  const brandSuffix = locale === "fa" ? SITE_NAME_FA : SITE_NAME;
  const defaultDescription = locale === "fa" ? SITE_DESCRIPTION_FA : SITE_DESCRIPTION_EN;
  const description = options.description?.trim() || defaultDescription;
  const normalizedPath = pathname && !pathname.startsWith("/") ? `/${pathname}` : pathname;
  const url = `${SITE_URL}/${locale}${normalizedPath}`;
  const ogTitle = options.title ? `${options.title} — ${brandSuffix}` : brandTitle;
  const ogImageUrl = resolveAbsoluteUrl(options.ogImage) ?? DEFAULT_OG_IMAGE;
  const includeAlternates = options.includeAlternates ?? true;

  const languages = includeAlternates
    ? {
        fa: `${SITE_URL}/fa${normalizedPath}`,
        en: `${SITE_URL}/en${normalizedPath}`,
        "x-default": `${SITE_URL}/fa${normalizedPath}`,
      }
    : undefined;

  const verification = getSiteVerification();

  return {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    title: options.title
      ? options.title
      : { default: brandTitle, template: `%s — ${brandSuffix}` },
    description,
    ...(options.keywords?.length ? { keywords: options.keywords } : {}),
    alternates: {
      canonical: url,
      ...(languages ? { languages } : {}),
      types: {
        "application/rss+xml": [
          {
            url: `${SITE_URL}/${locale}/rss.xml`,
            title: locale === "fa" ? `${SITE_NAME_FA} RSS (فارسی)` : `${SITE_NAME} RSS (English)`,
          },
        ],
      },
    },
    openGraph: {
      type: "website",
      siteName: locale === "fa" ? `${SITE_NAME_FA} (${SITE_NAME})` : SITE_NAME,
      locale: locale === "fa" ? "fa_IR" : "en_US",
      alternateLocale: [locale === "fa" ? "en_US" : "fa_IR"],
      url,
      title: ogTitle,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: ogTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [ogImageUrl],
    },
    robots: getRobotsConfig(options.noIndex),
    ...(verification ? { verification } : {}),
  };
}

export function buildPageMetadata(
  locale: Locale,
  pathname: string,
  options: PageMetadataOptions & { title: string; description: string }
): Metadata {
  return buildBaseMetadata(locale, pathname, options);
}

export function buildArticleMetadata(
  locale: Locale,
  article: Article,
  alternateSlugs?: Partial<Record<Locale, string>>,
  fieldLabel?: string
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

  const languages: Record<string, string> = {};
  if (alternateSlugs?.fa) languages.fa = `${SITE_URL}/fa/articles/${alternateSlugs.fa}`;
  if (alternateSlugs?.en) languages.en = `${SITE_URL}/en/articles/${alternateSlugs.en}`;
  if (!languages[locale]) languages[locale] = defaultUrl;
  languages["x-default"] = languages.fa ?? languages.en ?? defaultUrl;

  const ogGeneratedUrl = `${SITE_URL}/${locale}/articles/${article.slug}/opengraph-image`;
  const coverAbsolute = resolveAbsoluteUrl(article.cover);
  const ogImages = [
    ...(coverAbsolute ? [{ url: coverAbsolute, alt: title }] : []),
    { url: ogGeneratedUrl, width: 1200, height: 630, alt: title },
  ];
  const twitterImages = [coverAbsolute ?? ogGeneratedUrl];
  const section = fieldLabel || article.field;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords,
    category: section,
    ...(article.authorName
      ? {
          authors: [
            {
              name: article.authorName,
              ...(article.authorSlug
                ? { url: `${SITE_URL}/${locale}/authors/${article.authorSlug}` }
                : {}),
            },
          ],
        }
      : {}),
    alternates: {
      canonical,
      languages,
      types: {
        "application/rss+xml": [
          {
            url: `${SITE_URL}/${locale}/rss.xml`,
            title: locale === "fa" ? `${SITE_NAME_FA} RSS (فارسی)` : `${SITE_NAME} RSS (English)`,
          },
        ],
      },
    },
    openGraph: {
      type: "article",
      siteName: locale === "fa" ? `${SITE_NAME_FA} (${SITE_NAME})` : SITE_NAME,
      title,
      description,
      url: defaultUrl,
      locale: locale === "fa" ? "fa_IR" : "en_US",
      alternateLocale: [locale === "fa" ? "en_US" : "fa_IR"],
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt ?? article.publishedAt,
      section,
      ...(article.authorName ? { authors: [article.authorName] } : {}),
      tags: article.tags,
      images: ogImages,
    },
    twitter: {
      card: article.twitterCard === "summary" ? "summary" : "summary_large_image",
      title,
      description,
      images: twitterImages,
    },
    robots: getRobotsConfig(false),
    other: {
      citation_title: article.title,
      ...(article.authorName ? { citation_author: article.authorName } : {}),
      citation_publication_date: article.publishedAt.slice(0, 10),
      citation_journal_title: SITE_NAME,
      citation_language: locale === "fa" ? "fa" : "en",
      citation_public_url: canonical,
    },
  };
}

export function articleJsonLd(
  locale: Locale,
  article: Article,
  author: Author | undefined,
  fieldLabel?: string
) {
  const url = `${SITE_URL}/${locale}/articles/${article.slug}`;
  const ogImage = `${SITE_URL}/${locale}/articles/${article.slug}/opengraph-image`;
  const coverAbsolute = resolveAbsoluteUrl(article.cover);
  const images = coverAbsolute ? [coverAbsolute, ogImage] : [ogImage];
  const wordCount = estimateWordCount(article.content);

  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    "@id": `${url}#article`,
    url,
    inLanguage: locale === "fa" ? "fa-IR" : "en-US",
    headline: article.title,
    description: article.seoDescription?.trim() || article.excerpt,
    image: images,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    articleSection: fieldLabel || article.field,
    isAccessibleForFree: true,
    ...(wordCount > 0 ? { wordCount } : {}),
    timeRequired: `PT${Math.max(1, article.readingTimeMinutes)}M`,
    author: author
      ? {
          "@type": "Person",
          name: author.name[locale],
          url: `${SITE_URL}/${locale}/authors/${author.slug}`,
          ...(author.title[locale] ? { jobTitle: author.title[locale] } : {}),
        }
      : { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: SITE_NAME_FA,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.svg`,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
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

export function organizationJsonLd(locale: Locale = "fa") {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: SITE_NAME_FA,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logo.svg`,
    },
    description: locale === "fa" ? SITE_DESCRIPTION_FA : SITE_DESCRIPTION_EN,
    email: "hello@scienta.ir",
    contactPoint: [
      {
        "@type": "ContactPoint",
        email: "hello@scienta.ir",
        contactType: "editorial",
        availableLanguage: ["Persian", "English"],
      },
    ],
  };
}

export function websiteJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/${locale}#website`,
    name: locale === "fa" ? `${SITE_NAME_FA} (${SITE_NAME})` : SITE_NAME,
    alternateName: locale === "fa" ? SITE_NAME : SITE_NAME_FA,
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale === "fa" ? "fa-IR" : "en-US",
    description: locale === "fa" ? SITE_DESCRIPTION_FA : SITE_DESCRIPTION_EN,
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/${locale}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function collectionPageJsonLd(
  locale: Locale,
  {
    name,
    description,
    url,
    items,
  }: {
    name: string;
    description: string;
    url: string;
    items: { name: string; url: string }[];
  }
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name,
    description,
    url,
    inLanguage: locale === "fa" ? "fa-IR" : "en-US",
    isPartOf: { "@id": `${SITE_URL}/${locale}#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.slice(0, 50).map((item, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: item.name,
        url: item.url,
      })),
    },
  };
}

export function authorProfileJsonLd(
  locale: Locale,
  author: Author,
  articles: readonly Pick<Article, "slug" | "title">[]
) {
  const url = `${SITE_URL}/${locale}/authors/${author.slug}`;
  const sameAs = author.social
    ? Object.values(author.social)
        .filter((v): v is string => typeof v === "string" && /^https?:\/\//i.test(v.trim()))
    : [];

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${url}#profile`,
    url,
    inLanguage: locale === "fa" ? "fa-IR" : "en-US",
    mainEntity: {
      "@type": "Person",
      "@id": `${url}#person`,
      name: author.name[locale],
      ...(author.title[locale] ? { jobTitle: author.title[locale] } : {}),
      ...(author.bio[locale] ? { description: author.bio[locale] } : {}),
      url,
      worksFor: { "@id": `${SITE_URL}/#organization` },
      ...(sameAs.length > 0 ? { sameAs } : {}),
    },
    ...(articles.length > 0
      ? {
          hasPart: articles.slice(0, 20).map((a) => ({
            "@type": "ScholarlyArticle",
            headline: a.title,
            url: `${SITE_URL}/${locale}/articles/${a.slug}`,
          })),
        }
      : {}),
  };
}

export function aboutPageJsonLd(locale: Locale, description: string) {
  const url = `${SITE_URL}/${locale}/about`;
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${url}#about`,
    url,
    name: locale === "fa" ? `درباره ${SITE_NAME_FA}` : `About ${SITE_NAME}`,
    description,
    inLanguage: locale === "fa" ? "fa-IR" : "en-US",
    mainEntity: { "@id": `${SITE_URL}/#organization` },
  };
}

export function contactPageJsonLd(locale: Locale, description: string) {
  const url = `${SITE_URL}/${locale}/contact`;
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${url}#contact`,
    url,
    name: locale === "fa" ? `تماس با ${SITE_NAME_FA}` : `Contact ${SITE_NAME}`,
    description,
    inLanguage: locale === "fa" ? "fa-IR" : "en-US",
    mainEntity: { "@id": `${SITE_URL}/#organization` },
  };
}
