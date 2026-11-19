import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import { SITE_DESCRIPTION_EN, SITE_DESCRIPTION_FA, SITE_NAME, SITE_URL } from "@/lib/seo";

/** Escapes XML entities and strips XML 1.0 illegal control characters. */
export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc2822(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export function buildRssFeed({
  locale,
  articles,
  siteUrl = SITE_URL,
}: {
  locale: Locale;
  articles: readonly Article[];
  siteUrl?: string;
}): string {
  const cleanBase = siteUrl.replace(/\/+$/, "");
  const channelLink = `${cleanBase}/${locale}`;
  const selfLink = `${cleanBase}/${locale}/rss.xml`;
  const title = locale === "fa" ? `${SITE_NAME} — پلتفرم علمی` : `${SITE_NAME} — Scientific Journal`;
  const description = locale === "fa" ? SITE_DESCRIPTION_FA : SITE_DESCRIPTION_EN;
  const language = locale === "fa" ? "fa-IR" : "en-US";
  const lastBuildDate = articles[0]?.publishedAt ? toRfc2822(articles[0].publishedAt) : new Date().toUTCString();

  const itemsXml = articles
    .map((article) => {
      const link = `${cleanBase}/${locale}/articles/${article.slug}`;
      const categories = [article.field, ...article.tags]
        .filter(Boolean)
        .map((cat) => `      <category>${escapeXml(cat)}</category>`)
        .join("\n");
      const creator = article.authorName
        ? `\n      <dc:creator>${escapeXml(article.authorName)}</dc:creator>`
        : "";

      return [
        "    <item>",
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${toRfc2822(article.publishedAt)}</pubDate>`,
        `      <description>${escapeXml(article.excerpt)}</description>${creator}`,
        categories,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(channelLink)}</link>`,
    `    <atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml" />`,
    `    <description>${escapeXml(description)}</description>`,
    `    <language>${language}</language>`,
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    itemsXml,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");
}
