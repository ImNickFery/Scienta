import type { DailyTrendPoint } from "./admin-analytics";

export type ProWindowDays = 7 | 14 | 30 | 90;

export function clampProWindowDays(raw: string | number | null | undefined): ProWindowDays {
  const n = Number(raw);
  if (n === 7) return 7;
  if (n === 14) return 14;
  if (n === 90) return 90;
  return 30;
}

export interface PeriodDelta {
  current: number;
  previous: number;
  deltaPct: number | null;
  direction: "up" | "down" | "flat";
}

/**
 * Computes real period-over-period percentage change between the current window
 * and the immediately preceding window of equal length.
 */
export function computePeriodDelta(current: number, previous: number): PeriodDelta {
  const cur = Math.max(0, Number(current || 0));
  const prev = Math.max(0, Number(previous || 0));

  if (prev === 0) {
    if (cur === 0) return { current: 0, previous: 0, deltaPct: 0, direction: "flat" };
    return { current: cur, previous: 0, deltaPct: null, direction: "up" };
  }

  const rawPct = Math.round(((cur - prev) / prev) * 100);
  return {
    current: cur,
    previous: prev,
    deltaPct: rawPct,
    direction: rawPct > 0 ? "up" : rawPct < 0 ? "down" : "flat",
  };
}

/**
 * Computes a trailing moving average over a daily trend series.
 */
export function computeMovingAverage(
  points: DailyTrendPoint[],
  windowSize = 7
): Array<{ date: string; label: string; value: number }> {
  const w = Math.max(1, Math.floor(windowSize));
  const out: Array<{ date: string; label: string; value: number }> = [];
  let runningSum = 0;

  for (let i = 0; i < points.length; i++) {
    runningSum += points[i].count;
    if (i >= w) {
      runningSum -= points[i - w].count;
    }
    const denom = Math.min(i + 1, w);
    out.push({
      date: points[i].date,
      label: points[i].label,
      value: Number((runningSum / denom).toFixed(2)),
    });
  }
  return out;
}

export type SeoMissingKey =
  | "seo_title"
  | "seo_description"
  | "cover"
  | "excerpt"
  | "bilingual";

export interface SeoChecklistResult {
  passed: number;
  total: 5;
  missing: SeoMissingKey[];
}

/**
 * Evaluates real, verifiable metadata fields on an article row.
 * Zero invented scores — strictly counts concrete database fields present.
 */
export function computeSeoChecklist(input: {
  seoTitle?: string | null;
  seoDescription?: string | null;
  hasCover: boolean;
  excerpt?: string | null;
  isBilingual: boolean;
}): SeoChecklistResult {
  const missing: SeoMissingKey[] = [];
  if (!input.seoTitle || input.seoTitle.trim().length < 15) missing.push("seo_title");
  if (!input.seoDescription || input.seoDescription.trim().length < 50) missing.push("seo_description");
  if (!input.hasCover) missing.push("cover");
  if (!input.excerpt || input.excerpt.trim().length < 30) missing.push("excerpt");
  if (!input.isBilingual) missing.push("bilingual");

  return {
    passed: 5 - missing.length,
    total: 5,
    missing,
  };
}

/**
 * Estimates word count from MDX article prose (excluding fenced code blocks
 * and display LaTeX blocks) for both Persian and English essays.
 */
export function estimateArticleWords(content: string | null | undefined): number {
  if (!content) return 0;
  const cleaned = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`[\]()>|~]/g, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export interface HeatmapCell {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  dayOfWeek: number; // 0 = Sun .. 6 = Sat
}

function formatUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Builds a trailing N-week daily intensity calendar matrix for the activity
 * cadence heatmap. Levels 0..4 scale relative to the peak non-zero day.
 */
export function buildHeatmapGrid(
  timestamps: Array<string | Date | null | undefined>,
  weeks = 12,
  now: Date = new Date()
): { cells: HeatmapCell[]; total: number; peak: number; activeDays: number } {
  const totalDays = Math.max(7, Math.min(26, Math.floor(weeks)) * 7);
  const endUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const counts = new Map<string, number>();
  const orderedDates: Date[] = [];

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(endUtc.getTime() - i * 86_400_000);
    orderedDates.push(d);
    counts.set(formatUtcDate(d), 0);
  }

  for (const raw of timestamps) {
    if (!raw) continue;
    let key: string | null = null;
    if (raw instanceof Date) {
      if (!Number.isNaN(raw.getTime())) key = formatUtcDate(raw);
    } else {
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
      if (m) {
        key = m[1];
      } else {
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) key = formatUtcDate(parsed);
      }
    }
    if (key && counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  let peak = 0;
  let total = 0;
  let activeDays = 0;
  for (const c of counts.values()) {
    total += c;
    if (c > 0) activeDays += 1;
    if (c > peak) peak = c;
  }

  const cells: HeatmapCell[] = orderedDates.map((d) => {
    const date = formatUtcDate(d);
    const count = counts.get(date) ?? 0;
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count > 0 && peak > 0) {
      const ratio = count / peak;
      if (ratio >= 0.75) level = 4;
      else if (ratio >= 0.5) level = 3;
      else if (ratio >= 0.25) level = 2;
      else level = 1;
    }
    return {
      date,
      count,
      level,
      dayOfWeek: d.getUTCDay(),
    };
  });

  return { cells, total, peak, activeDays };
}

export interface DonutInputItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutSegment extends DonutInputItem {
  pct: number;
  dashLength: number;
  dashOffset: number;
}

/**
 * Computes stroke-dasharray geometry for an SVG donut ring of radius `r`.
 */
export function buildDonutSegments(
  items: DonutInputItem[],
  radius = 44
): { segments: DonutSegment[]; total: number; circumference: number } {
  const circumference = Number((2 * Math.PI * radius).toFixed(2));
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.value || 0)), 0);

  if (total === 0) {
    return {
      segments: items.map((item) => ({
        ...item,
        value: 0,
        pct: 0,
        dashLength: 0,
        dashOffset: 0,
      })),
      total: 0,
      circumference,
    };
  }

  let consumed = 0;
  const segments: DonutSegment[] = items.map((item) => {
    const val = Math.max(0, Number(item.value || 0));
    const ratio = val / total;
    const dashLength = Number((ratio * circumference).toFixed(2));
    const dashOffset = Number((-consumed).toFixed(2));
    consumed += dashLength;
    return {
      ...item,
      value: val,
      pct: Math.round(ratio * 100),
      dashLength,
      dashOffset,
    };
  });

  return { segments, total, circumference };
}

/**
 * Extracts a clean privacy-safe referrer hostname (`Direct` for empty or same-host).
 */
export function parseReferrerHost(referrer: string | null | undefined, siteHost?: string | null): string {
  if (!referrer || typeof referrer !== "string") return "Direct";
  const trimmed = referrer.trim();
  if (!trimmed) return "Direct";
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return "Direct";
    const own = siteHost?.toLowerCase().replace(/^www\./, "").split(":")[0];
    if (own && host === own) return "Direct";
    return host.slice(0, 100);
  } catch {
    return "Direct";
  }
}

export type DeviceType = "mobile" | "tablet" | "desktop";

export function detectDeviceType(userAgent: string | null | undefined): DeviceType {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

function escapeCsvCell(raw: string | number | boolean | null | undefined): string {
  let str = raw === null || raw === undefined ? "" : String(raw);
  // Neutralize spreadsheet formula injection (=, +, -, @)
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvArticleExportRow {
  slug: string;
  titleEn: string;
  titleFa: string;
  field: string;
  author: string;
  status: string;
  views: number;
  comments: number;
  words: number;
  bilingual: boolean;
  seoPassed: number;
  seoTotal: number;
  publishedAt: string | null;
}

export function serializeAnalyticsCsv(rows: CsvArticleExportRow[]): string {
  const header = [
    "Slug",
    "Title (EN)",
    "Title (FA)",
    "Field",
    "Author",
    "Status",
    "Views",
    "Comments",
    "Estimated Words",
    "Bilingual",
    "SEO Fields Passed",
    "Published At",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.slug,
        r.titleEn,
        r.titleFa,
        r.field,
        r.author,
        r.status,
        r.views,
        r.comments,
        r.words,
        r.bilingual ? "Yes" : "No",
        `${r.seoPassed}/${r.seoTotal}`,
        r.publishedAt ?? "",
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }
  return lines.join("\n");
}
