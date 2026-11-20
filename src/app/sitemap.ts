import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/lib/i18n/config";
import { getAllArticles, getAllTagRecords } from "@/lib/content";
import { getFields, getAuthors } from "@/lib/taxonomy";
import { SITE_URL } from "@/lib/seo";

// Regenerated every 5 minutes so newly published articles appear in the
// sitemap without a full redeploy — the practical equivalent of "automatic
// regeneration after publishing" on a traditional (non-serverless) Node host.
export const revalidate = 300;

function buildPathAlternates(pathname: string): { languages: Record<string, string> } {
  return {
    languages: {
      fa: `${SITE_URL}/fa${pathname}`,
      en: `${SITE_URL}/en${pathname}`,
      "x-default": `${SITE_URL}/fa${pathname}`,
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Exclude utility/non-indexable paths (/search, /saved) and duplicate localized
  // category-name archives (/categories/[name]) in favor of canonical /tags/[slug].
  const staticPaths = [
    "",
    "/articles",
    "/fields",
    "/tags",
    "/categories",
    "/authors",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
  ];

  const [fields, authors, tagRecords, faArticles, enArticles] = await Promise.all([
    getFields(),
    getAuthors(),
    getAllTagRecords(),
    getAllArticles("fa"),
    getAllArticles("en"),
  ]);

  const articlesByLocale: Record<Locale, typeof faArticles> = {
    fa: faArticles,
    en: enArticles,
  };

  // Map article.id -> per-locale slugs so XML sitemap emits accurate xhtml:link hreflang pairs
  const slugsByArticleId = new Map<string, Partial<Record<Locale, string>>>();
  for (const locale of locales) {
    for (const article of articlesByLocale[locale]) {
      const existing = slugsByArticleId.get(article.id) ?? {};
      existing[locale] = article.slug;
      slugsByArticleId.set(article.id, existing);
    }
  }

  const latestArticleDate =
    [...faArticles, ...enArticles]
      .map((a) => a.updatedAt || a.publishedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? undefined;

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const p of staticPaths) {
      entries.push({
        url: `${SITE_URL}/${locale}${p}`,
        ...(p === "" || p === "/articles" ? (latestArticleDate ? { lastModified: latestArticleDate } : {}) : {}),
        changeFrequency: p === "" || p === "/articles" ? "daily" : "weekly",
        priority: p === "" ? 1.0 : p === "/articles" ? 0.9 : 0.7,
        alternates: buildPathAlternates(p),
      });
    }

    for (const article of articlesByLocale[locale]) {
      const pair = slugsByArticleId.get(article.id) ?? { [locale]: article.slug };
      const languages: Record<string, string> = {};
      if (pair.fa) languages.fa = `${SITE_URL}/fa/articles/${pair.fa}`;
      if (pair.en) languages.en = `${SITE_URL}/en/articles/${pair.en}`;
      languages["x-default"] = languages.fa ?? languages.en ?? `${SITE_URL}/${locale}/articles/${article.slug}`;

      entries.push({
        url: `${SITE_URL}/${locale}/articles/${article.slug}`,
        lastModified: article.updatedAt || article.publishedAt,
        changeFrequency: "weekly",
        priority: article.featured ? 0.95 : 0.9,
        alternates: { languages },
      });
    }

    for (const field of fields) {
      entries.push({
        url: `${SITE_URL}/${locale}/fields/${field.slug}`,
        changeFrequency: "weekly",
        priority: 0.75,
        alternates: buildPathAlternates(`/fields/${field.slug}`),
      });
    }

    for (const tag of tagRecords) {
      if (tag.count <= 0) continue;
      entries.push({
        url: `${SITE_URL}/${locale}/tags/${tag.slug}`,
        changeFrequency: "weekly",
        priority: 0.65,
        alternates: buildPathAlternates(`/tags/${tag.slug}`),
      });
    }

    for (const author of authors) {
      entries.push({
        url: `${SITE_URL}/${locale}/authors/${author.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: buildPathAlternates(`/authors/${author.slug}`),
      });
    }
  }

  return entries;
}
