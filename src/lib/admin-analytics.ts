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
