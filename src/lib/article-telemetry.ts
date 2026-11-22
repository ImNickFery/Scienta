import type { Locale } from "@/lib/i18n/config";

export interface ArticleEquationItem {
  /** 1-based index matching EquationEnhancer (#eq-1, #eq-2, ...) */
  index: number;
  /** DOM anchor id matching EquationEnhancer */
  id: string;
  /** Raw trimmed LaTeX source */
  latex: string;
  /** Compact single-line LaTeX for previews & accessible labels */
  compactLatex: string;
}

export interface ArticleSpecimenAnalysis {
  wordCount: number;
  displayEquations: ArticleEquationItem[];
  displayEquationCount: number;
  inlineEquationCount: number;
  figureCount: number;
  sectionCount: number;
  exactReadingSeconds: number;
  exactReadingMinutes: number;
  specimenCode: string;
}

export interface ReadingTelemetry {
  percent: number;
  wordsRead: number;
  wordsRemaining: number;
  remainingMinutes: number;
  isComplete: boolean;
}

export type ArchiveDepthFilter = "all" | "quick" | "deep";
export type ArchiveSortKey = "latest" | "views" | "quickest" | "longest";

export interface ArchiveFilterableArticle {
  slug: string;
  title: string;
  excerpt: string;
  field: string;
  fieldLabel: string;
  authorName?: string;
  tags?: string[];
  readingTimeMinutes: number;
  views: number;
  publishedAt: string;
}

export interface ArchiveStats {
  totalArticles: number;
  totalViews: number;
  totalReadingMinutes: number;
  avgReadingMinutes: number;
  fieldCounts: Record<string, number>;
}

const FIELD_CODE_MAP: Record<string, string> = {
  physics: "PHY",
  astronomy: "AST",
  space: "SPC",
  quantum: "QNT",
  ai: "AIX",
  math: "MTH",
  biology: "BIO",
  medicine: "MED",
  engineering: "ENG",
  technology: "TEC",
};

function stripFencedCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, " ");
}

/**
 * Extracts all display math blocks (`$$...$$`) in exact document order,
 * matching the 1-based `#eq-N` numbering applied client-side by EquationEnhancer.
 */
export function extractDisplayEquations(content: string): ArticleEquationItem[] {
  const withoutFences = stripFencedCodeBlocks(content);
  const equations: ArticleEquationItem[] = [];
  const regex = /\$\$([\s\S]+?)\$\$/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(withoutFences)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    const index = equations.length + 1;
    equations.push({
      index,
      id: `eq-${index}`,
      latex: raw,
      compactLatex: raw.replace(/\s+/g, " ").trim(),
    });
  }

  return equations;
}

/**
 * Counts inline LaTeX formulas (`$...$`) while excluding fenced code blocks,
 * display math blocks (`$$...$$`), and escaped dollar signs (`\$`).
 */
export function countInlineEquations(content: string): number {
  const withoutFences = stripFencedCodeBlocks(content);
  const withoutDisplay = withoutFences.replace(/\$\$[\s\S]+?\$\$/g, " ");
  const withoutEscaped = withoutDisplay.replace(/\\\$/g, " ");
  const matches = withoutEscaped.match(/(?<!\$)\$(?!\$|\s)([^$\n]+?)(?<!\s)\$(?!\$)/g);
  return matches ? matches.length : 0;
}

/**
 * Counts figures & scientific illustrations embedded in the MDX body.
 */
export function countFigures(content: string): number {
  const withoutFences = stripFencedCodeBlocks(content);
  const mdImages = withoutFences.match(/!\[[^\]]*\]\([^)]+\)/g)?.length ?? 0;
  const jsxFigures =
    withoutFences.match(/<(?:Figure|SciIllustration|img)\b/g)?.length ?? 0;
  return mdImages + jsxFigures;
}

/**
 * Counts H2 and H3 section headings inside the MDX body.
 */
export function countSections(content: string): number {
  const withoutFences = stripFencedCodeBlocks(content);
  const headings = withoutFences.match(/^#{2,3}\s+.+$/gm);
  return headings ? headings.length : 0;
}

/**
 * Counts Persian and Latin prose words accurately after removing code fences,
 * math expressions, JSX/HTML tags, and markdown formatting tokens.
 */
export function countProseWords(content: string): number {
  const cleaned = stripFencedCodeBlocks(content)
    .replace(/\$\$[\s\S]+?\$\$/g, " ")
    .replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_~>#|]/g, " ");

  const tokens = cleaned.match(/[\p{L}\p{N}\u200C]+/gu);
  if (!tokens) return 0;
  return tokens.filter((t) => t.replace(/\u200C/g, "").length > 0).length;
}

/**
 * Deterministic archival specimen identifier (e.g. `SCI-AST-264F`).
 */
export function buildSpecimenCode(
  field: string,
  slug: string,
  publishedAt: string
): string {
  const fieldCode =
    FIELD_CODE_MAP[field] ?? field.slice(0, 3).toUpperCase().padEnd(3, "X");
  const yearMatch = publishedAt.match(/^(\d{4})/);
  const yearSuffix = yearMatch ? yearMatch[1].slice(2) : "26";

  let hash = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = ((hash >>> 0) % 256).toString(16).toUpperCase().padStart(2, "0");
  return `SCI-${fieldCode}-${yearSuffix}${hex}`;
}

/**
 * Produces exact archival & reading-time telemetry for a scientific essay.
 * Calibrated for scientific prose:
 *  - Persian scientific prose: ~195 WPM
 *  - English scientific prose: ~225 WPM
 *  - +12s per display equation (reader pauses to parse mathematical notation)
 *  - +8s per figure/illustration
 */
export function analyzeArticleSpecimen(
  content: string,
  locale: Locale,
  meta: { field: string; slug: string; publishedAt: string }
): ArticleSpecimenAnalysis {
  const displayEquations = extractDisplayEquations(content);
  const inlineEquationCount = countInlineEquations(content);
  const figureCount = countFigures(content);
  const sectionCount = countSections(content);
  const wordCount = countProseWords(content);

  const wordsPerMinute = locale === "fa" ? 195 : 225;
  const proseSeconds = (wordCount / wordsPerMinute) * 60;
  const equationSeconds = displayEquations.length * 12;
  const figureSeconds = figureCount * 8;
  const exactReadingSeconds = Math.max(
    60,
    Math.round(proseSeconds + equationSeconds + figureSeconds)
  );
  const exactReadingMinutes = Math.max(1, Math.round(exactReadingSeconds / 60));

  return {
    wordCount,
    displayEquations,
    displayEquationCount: displayEquations.length,
    inlineEquationCount,
    figureCount,
    sectionCount,
    exactReadingSeconds,
    exactReadingMinutes,
    specimenCode: buildSpecimenCode(meta.field, meta.slug, meta.publishedAt),
  };
}

/**
 * Computes clamped live reading telemetry from normalized scroll progress [0..1].
 */
export function computeReadingTelemetry(
  scrollProgress: number,
  totalWords: number,
  totalMinutes: number
): ReadingTelemetry {
  const safeProgress = Number.isFinite(scrollProgress)
    ? Math.min(1, Math.max(0, scrollProgress))
    : 0;
  const safeWords = Math.max(0, Math.round(totalWords));
  const safeMinutes = Math.max(1, Math.round(totalMinutes));

  const percent = Math.round(safeProgress * 100);
  const isComplete = percent >= 97;
  const wordsRead = isComplete ? safeWords : Math.round(safeWords * safeProgress);
  const wordsRemaining = Math.max(0, safeWords - wordsRead);
  const remainingMinutes = isComplete
    ? 0
    : Math.max(1, Math.ceil(safeMinutes * (1 - safeProgress)));

  return {
    percent,
    wordsRead,
    wordsRemaining,
    remainingMinutes,
    isComplete,
  };
}

/**
 * Pure archive filter + sort engine supporting instant search, discipline filter,
 * reading-depth filter, and 4 deterministic sort orders.
 */
export function filterAndSortArchiveArticles<T extends ArchiveFilterableArticle>(
  articles: readonly T[],
  options: {
    field?: string;
    depth?: ArchiveDepthFilter;
    query?: string;
    sort?: ArchiveSortKey;
  }
): T[] {
  const field = options.field ?? "all";
  const depth = options.depth ?? "all";
  const sort = options.sort ?? "latest";
  const normalizedQuery = (options.query ?? "").trim().toLowerCase();

  let result = articles.filter((article) => {
    if (field && field !== "all" && article.field !== field) return false;
    if (depth === "quick" && article.readingTimeMinutes > 3) return false;
    if (depth === "deep" && article.readingTimeMinutes < 4) return false;

    if (normalizedQuery) {
      const haystack = [
        article.title,
        article.excerpt,
        article.fieldLabel,
        article.authorName ?? "",
        ...(article.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  });

  result = [...result];

  if (sort === "views") {
    result.sort((a, b) => b.views - a.views || (b.publishedAt > a.publishedAt ? 1 : -1));
  } else if (sort === "quickest") {
    result.sort(
      (a, b) =>
        a.readingTimeMinutes - b.readingTimeMinutes ||
        (b.publishedAt > a.publishedAt ? 1 : -1)
    );
  } else if (sort === "longest") {
    result.sort(
      (a, b) =>
        b.readingTimeMinutes - a.readingTimeMinutes ||
        (b.publishedAt > a.publishedAt ? 1 : -1)
    );
  } else {
    result.sort((a, b) => (b.publishedAt > a.publishedAt ? 1 : -1));
  }

  return result;
}

/**
 * Computes aggregate metrics across the visible or complete archive.
 */
export function computeArchiveStats(
  articles: readonly Pick<ArchiveFilterableArticle, "field" | "views" | "readingTimeMinutes">[]
): ArchiveStats {
  const fieldCounts: Record<string, number> = {};
  let totalViews = 0;
  let totalReadingMinutes = 0;

  for (const a of articles) {
    totalViews += Math.max(0, a.views);
    totalReadingMinutes += Math.max(1, a.readingTimeMinutes);
    fieldCounts[a.field] = (fieldCounts[a.field] ?? 0) + 1;
  }

  const totalArticles = articles.length;
  const avgReadingMinutes =
    totalArticles > 0 ? Math.round((totalReadingMinutes / totalArticles) * 10) / 10 : 0;

  return {
    totalArticles,
    totalViews,
    totalReadingMinutes,
    avgReadingMinutes,
    fieldCounts,
  };
}
