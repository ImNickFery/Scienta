export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD (UTC)
  label: string; // e.g. "Nov 18"
  count: number;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatUtcDay(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatShortLabel(date: Date): string {
  return `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export type TrendWindowDays = 7 | 14 | 30;

export function clampTrendDays(raw: string | number | null | undefined): TrendWindowDays {
  const n = Number(raw);
  if (n === 7) return 7;
  if (n === 30) return 30;
  return 14;
}

/**
 * Normalizes ISO or SQLite `YYYY-MM-DD HH:MM:SS` timestamps into UTC `YYYY-MM-DD` buckets
 * across the trailing `days` window ending at `now` (inclusive).
 */
export function buildDailyTrend(
  timestamps: Array<string | Date | null | undefined>,
  days = 14,
  now: Date = new Date()
): DailyTrendPoint[] {
  const safeDays = Math.max(1, Math.min(90, Math.floor(days)));
  const endUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const buckets = new Map<string, DailyTrendPoint>();
  const orderedKeys: string[] = [];

  for (let i = safeDays - 1; i >= 0; i--) {
    const day = new Date(endUtc.getTime() - i * 86_400_000);
    const key = formatUtcDay(day);
    orderedKeys.push(key);
    buckets.set(key, {
      date: key,
      label: formatShortLabel(day),
      count: 0,
    });
  }

  for (const raw of timestamps) {
    if (!raw) continue;
    let dayKey: string | null = null;
    if (raw instanceof Date) {
      if (!Number.isNaN(raw.getTime())) dayKey = formatUtcDay(raw);
    } else {
      const trimmed = raw.trim();
      const directMatch = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
      if (directMatch) {
        dayKey = directMatch[1];
      } else {
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) dayKey = formatUtcDay(parsed);
      }
    }
    if (dayKey && buckets.has(dayKey)) {
      buckets.get(dayKey)!.count += 1;
    }
  }

  return orderedKeys.map((k) => buckets.get(k)!);
}

export interface FieldAnalyticsInput {
  name: string;
  nameFa?: string;
  color: string;
  count: number;
  views: number;
}

export interface FieldAnalyticsItem extends FieldAnalyticsInput {
  articleShare: number;
  viewShare: number;
}

export function computeFieldAnalytics(rows: FieldAnalyticsInput[]): FieldAnalyticsItem[] {
  const totalArticles = rows.reduce((sum, r) => sum + Number(r.count || 0), 0);
  const totalViews = rows.reduce((sum, r) => sum + Number(r.views || 0), 0);

  return rows.map((row) => {
    const count = Number(row.count || 0);
    const views = Number(row.views || 0);
    return {
      ...row,
      count,
      views,
      articleShare: totalArticles > 0 ? Math.round((count / totalArticles) * 100) : 0,
      viewShare: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0,
    };
  });
}

export interface PipelineShares {
  publishedPct: number;
  draftPct: number;
  scheduledPct: number;
}

export function computePipelineShares(counts: { published: number; draft: number; scheduled: number }): PipelineShares {
  const total = Math.max(0, counts.published) + Math.max(0, counts.draft) + Math.max(0, counts.scheduled);
  if (total === 0) {
    return { publishedPct: 0, draftPct: 0, scheduledPct: 0 };
  }
  const publishedPct = Math.round((Math.max(0, counts.published) / total) * 100);
  const draftPct = Math.round((Math.max(0, counts.draft) / total) * 100);
  const scheduledPct = Math.max(0, 100 - publishedPct - draftPct);
  return { publishedPct, draftPct, scheduledPct };
}

export interface EditorialCoverageSummary {
  bilingualPct: number;
  coverPct: number;
  missingCoverCount: number;
  singleLocaleCount: number;
}

export function computeEditorialCoverage(params: {
  totalArticles: number;
  bilingualCount: number;
  withCoverCount: number;
}): EditorialCoverageSummary {
  const total = Math.max(0, params.totalArticles);
  if (total === 0) {
    return { bilingualPct: 0, coverPct: 0, missingCoverCount: 0, singleLocaleCount: 0 };
  }
  const bilingual = Math.min(total, Math.max(0, params.bilingualCount));
  const withCover = Math.min(total, Math.max(0, params.withCoverCount));
  return {
    bilingualPct: Math.round((bilingual / total) * 100),
    coverPct: Math.round((withCover / total) * 100),
    missingCoverCount: Math.max(0, total - withCover),
    singleLocaleCount: Math.max(0, total - bilingual),
  };
}

export type ActivityCategory = "editorial" | "ai_api" | "moderation" | "security";

export function classifyActivitySource(action: string): ActivityCategory {
  const normalized = action.trim().toLowerCase();
  if (normalized.startsWith("api.auth.") || normalized.startsWith("auth.") || normalized.startsWith("user.")) {
    return "security";
  }
  if (normalized.startsWith("api.") || normalized.startsWith("api_key.")) {
    return "ai_api";
  }
  if (normalized.startsWith("comment.") || normalized.startsWith("message.") || normalized.startsWith("subscriber.")) {
    return "moderation";
  }
  return "editorial";
}

export interface ChartCoordinates {
  x: number;
  y: number;
  value: number;
  label: string;
  date: string;
}

/**
 * Computes clean SVG polyline & area paths for a daily time-series within a fixed viewBox.
 */
export function buildTrendSvgGeometry(
  points: DailyTrendPoint[],
  width: number,
  height: number,
  padX = 12,
  padY = 14,
  maxOverride?: number
): { linePath: string; areaPath: string; coords: ChartCoordinates[]; maxValue: number } {
  if (points.length === 0) {
    return { linePath: "", areaPath: "", coords: [], maxValue: 1 };
  }
  const maxValue = Math.max(1, maxOverride ?? Math.max(...points.map((p) => p.count)));
  const usableW = Math.max(1, width - padX * 2);
  const usableH = Math.max(1, height - padY * 2);
  const stepX = points.length > 1 ? usableW / (points.length - 1) : 0;

  const coords: ChartCoordinates[] = points.map((p, idx) => {
    const x = Number((padX + idx * stepX).toFixed(2));
    const ratio = Math.min(1, Math.max(0, p.count / maxValue));
    const y = Number((padY + usableH * (1 - ratio)).toFixed(2));
    return { x, y, value: p.count, label: p.label, date: p.date };
  });

  const linePath = coords.map((c, idx) => `${idx === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const baselineY = Number((padY + usableH).toFixed(2));
  const areaPath =
    coords.length > 0
      ? `${linePath} L${coords[coords.length - 1].x},${baselineY} L${coords[0].x},${baselineY} Z`
      : "";

  return { linePath, areaPath, coords, maxValue };
}
