import type { Locale } from "@/lib/i18n/config";
import { SITE_NAME } from "@/lib/seo";

export interface CitationInput {
  title: string;
  authorName: string;
  publishedAt: string;
  url: string;
  slug: string;
  locale: Locale;
  siteName?: string;
}

export interface FormattedCitations {
  key: string;
  bibtex: string;
  apa: string;
  ieee: string;
}

/**
 * Produces a deterministic ASCII BibTeX citation key (e.g. `rostami2026geometry`).
 * Falls back gracefully when the author name is written in non-Latin script.
 */
export function buildCitationKey(authorName: string, year: number, slug: string): string {
  const asciiAuthorTokens = authorName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const authorPart = asciiAuthorTokens.length
    ? asciiAuthorTokens[asciiAuthorTokens.length - 1]
    : "scienta";

  const slugPart = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .split("-")
    .find((t) => t.length > 2) ?? "article";

  return `${authorPart}${year}${slugPart}`.slice(0, 48);
}

/** Escapes special BibTeX characters while keeping Unicode readable. */
export function escapeBibtex(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([%$#&_{}])/g, "\\$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateSafe(iso: string): Date {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date("2026-01-01T00:00:00Z") : d;
}

export function formatBibtex(input: CitationInput): string {
  const date = parseDateSafe(input.publishedAt);
  const year = date.getUTCFullYear();
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toLowerCase();
  const key = buildCitationKey(input.authorName, year, input.slug);
  const journal = input.siteName ?? SITE_NAME;

  return [
    `@article{${key},`,
    `  author  = {${escapeBibtex(input.authorName)}},`,
    `  title   = {{${escapeBibtex(input.title)}}},`,
    `  journal = {${escapeBibtex(journal)}},`,
    `  year    = {${year}},`,
    `  month   = ${month},`,
    `  url     = {${input.url}}`,
    `}`,
  ].join("\n");
}

export function formatApa(input: CitationInput): string {
  const date = parseDateSafe(input.publishedAt);
  const year = date.getUTCFullYear();
  const monthDay = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const site = input.siteName ?? SITE_NAME;
  return `${input.authorName.trim()} (${year}, ${monthDay}). ${input.title.trim()}. ${site}. ${input.url}`;
}

export function formatIeee(input: CitationInput): string {
  const date = parseDateSafe(input.publishedAt);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const site = input.siteName ?? SITE_NAME;
  return `${input.authorName.trim()}, "${input.title.trim()}," ${site}, ${formattedDate}. [Online]. Available: ${input.url}`;
}

export function buildAllCitations(input: CitationInput): FormattedCitations {
  const date = parseDateSafe(input.publishedAt);
  return {
    key: buildCitationKey(input.authorName, date.getUTCFullYear(), input.slug),
    bibtex: formatBibtex(input),
    apa: formatApa(input),
    ieee: formatIeee(input),
  };
}
