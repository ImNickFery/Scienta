import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/config";
import { getAllArticles, getAllTagRecords, getAllTags } from "@/lib/content";
import { getFields, getAuthors } from "@/lib/taxonomy";
import { SITE_URL } from "@/lib/seo";

// Regenerated every 5 minutes so newly published articles appear in the
// sitemap without a full redeploy — the practical equivalent of "automatic
// regeneration after publishing" on a traditional (non-serverless) Node host.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["", "/articles", "/categories", "/tags", "/fields", "/search", "/about", "/contact", "/authors", "/privacy", "/terms"];

  const entries: MetadataRoute.Sitemap = [];
  const fields = await getFields();
  const authors = await getAuthors();
  const tagRecords = await getAllTagRecords();

  for (const locale of locales) {
    for (const p of staticPaths) {
      entries.push({
        url: `${SITE_URL}/${locale}${p}`,
        changeFrequency: p === "" ? "daily" : "weekly",
        priority: p === "" ? 1 : 0.7,
      });
    }

    const articles = await getAllArticles(locale);
    for (const article of articles) {
      entries.push({
        url: `${SITE_URL}/${locale}/articles/${article.slug}`,
        lastModified: article.publishedAt,
        changeFrequency: "monthly",
        priority: 0.9,
      });
    }

    for (const field of fields) {
      entries.push({ url: `${SITE_URL}/${locale}/fields/${field.slug}`, priority: 0.6 });
    }

    for (const tag of tagRecords) {
      entries.push({ url: `${SITE_URL}/${locale}/tags/${tag.slug}`, priority: 0.6 });
    }

    const tags = await getAllTags(locale);
    for (const { tag } of tags) {
      entries.push({ url: `${SITE_URL}/${locale}/categories/${encodeURIComponent(tag)}`, priority: 0.5 });
    }

    for (const author of authors) {
      entries.push({ url: `${SITE_URL}/${locale}/authors/${author.slug}`, priority: 0.5 });
    }
  }

  return entries;
}
