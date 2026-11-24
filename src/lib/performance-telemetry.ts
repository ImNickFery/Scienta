export type LatencyMetricKind = "api" | "ttfb" | "fcp" | "lcp" | "domLoad";
export type LatencyHealth = "good" | "warn" | "slow";

export interface ApiMetricSample {
  id: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  timestampMs: number;
  source: "server" | "client";
}

export interface PageLoadMetricSample {
  id: string;
  path: string;
  locale: string;
  ttfbMs: number;
  fcpMs: number | null;
  lcpMs: number | null;
  domLoadMs: number;
  deviceType: "desktop" | "mobile" | "tablet";
  timestampMs: number;
}

export interface LatencySummary {
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  errorCount: number;
  errorRatePct: number;
}

export interface EndpointPerformanceRow {
  key: string;
  method: string;
  route: string;
  requests: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  errorCount: number;
  errorRatePct: number;
  lastStatus: number;
  lastSeenMs: number;
  health: LatencyHealth;
}

export interface PagePerformanceRow {
  path: string;
  samples: number;
  avgTtfbMs: number;
  avgFcpMs: number | null;
  avgLcpMs: number | null;
  avgLoadMs: number;
  p95LoadMs: number;
  lastSeenMs: number;
  health: LatencyHealth;
}

export interface PerformanceTimelineBucket {
  index: number;
  label: string;
  timestampMs: number;
  avgMs: number;
  p95Ms: number;
  count: number;
  errors: number;
}

export interface PerformanceChartPoint {
  x: number;
  avgY: number;
  p95Y: number;
  avgMs: number;
  p95Ms: number;
  count: number;
  errors: number;
  label: string;
}

export interface PerformanceChartGeometry {
  avgLinePath: string;
  avgAreaPath: string;
  p95LinePath: string;
  points: PerformanceChartPoint[];
  maxMs: number;
  slaY: number;
}

const MAX_RING_SAMPLES = 240;

const UUID_SEGMENT_RE =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;
const NUMERIC_ID_SEGMENT_RE = /\/\d+(?=\/|$)/g;

/**
 * Normalizes API or page paths by stripping query strings and collapsing
 * dynamic UUID/numeric identifiers so per-route aggregates stay compact.
 */
export function normalizeTelemetryRoute(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "/";
  let pathOnly = trimmed;
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      pathOnly = new URL(trimmed).pathname;
    } else {
      pathOnly = trimmed.split("?")[0]?.split("#")[0] || "/";
    }
  } catch {
    pathOnly = trimmed.split("?")[0]?.split("#")[0] || "/";
  }

  if (!pathOnly.startsWith("/")) {
    pathOnly = `/${pathOnly}`;
  }
  const collapsed = pathOnly
    .replace(UUID_SEGMENT_RE, "/:id")
    .replace(NUMERIC_ID_SEGMENT_RE, "/:id")
    .replace(/\/{2,}/g, "/");

  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1).slice(0, 140);
  }
  return collapsed.slice(0, 140);
}

/**
 * Computes the p-th percentile (0..100) of a numeric array using nearest-rank
 * interpolation with rounding to 1 decimal place.
 */
export function computePercentile(values: readonly number[], percentile: number): number {
  const clean = values
    .filter((v) => typeof v === "number" && Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  if (clean.length === 0) return 0;
  if (clean.length === 1) return Math.round(clean[0] * 10) / 10;

  const p = Math.max(0, Math.min(100, percentile)) / 100;
  const idx = Math.min(clean.length - 1, Math.max(0, Math.ceil(p * clean.length) - 1));
  return Math.round(clean[idx] * 10) / 10;
}

/**
 * Classifies a millisecond latency reading into nominal (`good`), warning (`warn`),
 * or slow (`slow`) bands based on Web Vitals & API response budgets.
 */
export function classifyLatencyHealth(ms: number, kind: LatencyMetricKind): LatencyHealth {
  const value = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const thresholds: Record<LatencyMetricKind, [number, number]> = {
    api: [120, 350],
    ttfb: [200, 500],
    fcp: [1800, 3000],
    lcp: [2500, 4000],
    domLoad: [1500, 3000],
  };
  const [goodLimit, warnLimit] = thresholds[kind];
  if (value <= goodLimit) return "good";
  if (value <= warnLimit) return "warn";
  return "slow";
}

export function summarizeLatencySeries(
  durationsMs: readonly number[],
  errorCount = 0
): LatencySummary {
  const clean = durationsMs.filter((v) => typeof v === "number" && Number.isFinite(v) && v >= 0);
  const count = clean.length;
  if (count === 0) {
    return {
      count: 0,
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      maxMs: 0,
      errorCount: 0,
      errorRatePct: 0,
    };
  }
  const sum = clean.reduce((acc, v) => acc + v, 0);
  const maxMs = Math.round(Math.max(...clean) * 10) / 10;
  const safeErrors = Math.min(count, Math.max(0, Math.floor(errorCount)));
  return {
    count,
    avgMs: Math.round((sum / count) * 10) / 10,
    p50Ms: computePercentile(clean, 50),
    p95Ms: computePercentile(clean, 95),
    maxMs,
    errorCount: safeErrors,
    errorRatePct: Math.round((safeErrors / count) * 1000) / 10,
  };
}

export function aggregateApiEndpoints(
  samples: readonly ApiMetricSample[]
): EndpointPerformanceRow[] {
  const groups = new Map<
    string,
    {
      method: string;
      route: string;
      durations: number[];
      errors: number;
      lastStatus: number;
      lastSeenMs: number;
    }
  >();

  for (const s of samples) {
    const method = (s.method || "GET").toUpperCase();
    const route = normalizeTelemetryRoute(s.route);
    const key = `${method} ${route}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        method,
        route,
        durations: [],
        errors: 0,
        lastStatus: s.status,
        lastSeenMs: s.timestampMs,
      };
      groups.set(key, g);
    }
    g.durations.push(s.durationMs);
    if (s.status >= 400) g.errors += 1;
    if (s.timestampMs >= g.lastSeenMs) {
      g.lastSeenMs = s.timestampMs;
      g.lastStatus = s.status;
    }
  }

  const rows: EndpointPerformanceRow[] = [];
  for (const [key, g] of groups.entries()) {
    const summary = summarizeLatencySeries(g.durations, g.errors);
    rows.push({
      key,
      method: g.method,
      route: g.route,
      requests: summary.count,
      avgMs: summary.avgMs,
      p95Ms: summary.p95Ms,
      maxMs: summary.maxMs,
      errorCount: summary.errorCount,
      errorRatePct: summary.errorRatePct,
      lastStatus: g.lastStatus,
      lastSeenMs: g.lastSeenMs,
      health: classifyLatencyHealth(summary.p95Ms, "api"),
    });
  }

  return rows.sort((a, b) => b.p95Ms - a.p95Ms || b.requests - a.requests);
}

export function aggregatePageLoads(
  samples: readonly PageLoadMetricSample[]
): PagePerformanceRow[] {
  const groups = new Map<
    string,
    {
      path: string;
      ttfbs: number[];
      fcps: number[];
      lcps: number[];
      loads: number[];
      lastSeenMs: number;
    }
  >();

  for (const s of samples) {
    const path = normalizeTelemetryRoute(s.path);
    let g = groups.get(path);
    if (!g) {
      g = { path, ttfbs: [], fcps: [], lcps: [], loads: [], lastSeenMs: s.timestampMs };
      groups.set(path, g);
    }
    if (Number.isFinite(s.ttfbMs) && s.ttfbMs >= 0) g.ttfbs.push(s.ttfbMs);
    if (typeof s.fcpMs === "number" && Number.isFinite(s.fcpMs) && s.fcpMs >= 0) g.fcps.push(s.fcpMs);
    if (typeof s.lcpMs === "number" && Number.isFinite(s.lcpMs) && s.lcpMs >= 0) g.lcps.push(s.lcpMs);
    if (Number.isFinite(s.domLoadMs) && s.domLoadMs >= 0) g.loads.push(s.domLoadMs);
    if (s.timestampMs > g.lastSeenMs) g.lastSeenMs = s.timestampMs;
  }

  const avgOf = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  const rows: PagePerformanceRow[] = [];
  for (const g of groups.values()) {
    const avgLoadMs = avgOf(g.loads);
    const p95LoadMs = computePercentile(g.loads, 95);
    rows.push({
      path: g.path,
      samples: g.loads.length,
      avgTtfbMs: avgOf(g.ttfbs),
      avgFcpMs: g.fcps.length > 0 ? avgOf(g.fcps) : null,
      avgLcpMs: g.lcps.length > 0 ? avgOf(g.lcps) : null,
      avgLoadMs,
      p95LoadMs,
      lastSeenMs: g.lastSeenMs,
      health: classifyLatencyHealth(avgLoadMs, "domLoad"),
    });
  }

  return rows.sort((a, b) => b.samples - a.samples || b.avgLoadMs - a.avgLoadMs);
}

function formatClockLabel(tsMs: number): string {
  const d = new Date(tsMs);
  if (Number.isNaN(d.getTime())) return "--:--";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Buckets a stream of latency samples into chronological chart points (up to `maxBuckets`)
 * so the performance timeline stays crisp even under high traffic bursts.
 */
export function buildLatencyTimeline(
  samples: readonly { durationMs: number; timestampMs: number; isError?: boolean }[],
  maxBuckets = 16
): PerformanceTimelineBucket[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort((a, b) => a.timestampMs - b.timestampMs);
  const bucketCount = Math.min(Math.max(1, maxBuckets), sorted.length);
  const chunkSize = Math.ceil(sorted.length / bucketCount);

  const buckets: PerformanceTimelineBucket[] = [];
  for (let i = 0; i < sorted.length; i += chunkSize) {
    const slice = sorted.slice(i, i + chunkSize);
    const durations = slice.map((s) => s.durationMs);
    const errors = slice.filter((s) => s.isError).length;
    const summary = summarizeLatencySeries(durations, errors);
    const lastTs = slice[slice.length - 1].timestampMs;
    buckets.push({
      index: buckets.length,
      label: formatClockLabel(lastTs),
      timestampMs: lastTs,
      avgMs: summary.avgMs,
      p95Ms: summary.p95Ms,
      count: summary.count,
      errors: summary.errorCount,
    });
  }
  return buckets;
}

/**
 * Computes SVG line & area paths for paired Avg + p95 latency curves plus an SLA line.
 */
export function buildPerformanceChartGeometry(
  buckets: readonly PerformanceTimelineBucket[],
  width: number,
  height: number,
  slaTargetMs: number,
  padX = 14,
  padY = 18
): PerformanceChartGeometry {
  if (buckets.length === 0) {
    return {
      avgLinePath: "",
      avgAreaPath: "",
      p95LinePath: "",
      points: [],
      maxMs: slaTargetMs,
      slaY: padY,
    };
  }

  const peakData = Math.max(
    ...buckets.map((b) => Math.max(b.avgMs, b.p95Ms)),
    10
  );
  const rawMax = Math.max(peakData * 1.18, slaTargetMs * 1.1, 40);
  const maxMs = Math.ceil(rawMax / 10) * 10;

  const usableW = Math.max(1, width - padX * 2);
  const usableH = Math.max(1, height - padY * 2);
  const stepX = buckets.length > 1 ? usableW / (buckets.length - 1) : 0;

  const toY = (ms: number) => {
    const ratio = Math.min(1, Math.max(0, ms / maxMs));
    return Number((padY + usableH * (1 - ratio)).toFixed(2));
  };

  const points: PerformanceChartPoint[] = buckets.map((b, idx) => ({
    x: Number((buckets.length === 1 ? padX + usableW / 2 : padX + idx * stepX).toFixed(2)),
    avgY: toY(b.avgMs),
    p95Y: toY(b.p95Ms),
    avgMs: b.avgMs,
    p95Ms: b.p95Ms,
    count: b.count,
    errors: b.errors,
    label: b.label,
  }));

  const avgLinePath = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x},${p.avgY}`)
    .join(" ");
  const p95LinePath = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x},${p.p95Y}`)
    .join(" ");

  const baselineY = Number((padY + usableH).toFixed(2));
  const avgAreaPath =
    points.length > 1
      ? `${avgLinePath} L${points[points.length - 1].x},${baselineY} L${points[0].x},${baselineY} Z`
      : "";

  return {
    avgLinePath,
    avgAreaPath,
    p95LinePath,
    points,
    maxMs,
    slaY: toY(slaTargetMs),
  };
}

// ---------------------------------------------------------------------------
// Bounded in-process ring buffer (shared across Next.js route handlers)
// ---------------------------------------------------------------------------

interface PerformanceRingStore {
  apiSamples: ApiMetricSample[];
  pageSamples: PageLoadMetricSample[];
  seq: number;
}

declare global {
  var __scientaPerfStore: PerformanceRingStore | undefined;
}

function getStore(): PerformanceRingStore {
  if (!globalThis.__scientaPerfStore) {
    globalThis.__scientaPerfStore = {
      apiSamples: [],
      pageSamples: [],
      seq: 0,
    };
  }
  return globalThis.__scientaPerfStore;
}

function clampDuration(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.round(Math.min(60_000, ms) * 10) / 10;
}

export function recordApiMetric(input: {
  route: string;
  method?: string;
  status: number;
  durationMs: number;
  source?: "server" | "client";
  timestampMs?: number;
}): ApiMetricSample {
  const store = getStore();
  store.seq += 1;
  const sample: ApiMetricSample = {
    id: `api-${store.seq}`,
    route: normalizeTelemetryRoute(input.route),
    method: (input.method || "GET").toUpperCase().slice(0, 8),
    status: Math.max(100, Math.min(599, Math.floor(input.status || 200))),
    durationMs: clampDuration(input.durationMs),
    timestampMs: input.timestampMs ?? Date.now(),
    source: input.source ?? "server",
  };
  store.apiSamples.push(sample);
  if (store.apiSamples.length > MAX_RING_SAMPLES) {
    store.apiSamples.splice(0, store.apiSamples.length - MAX_RING_SAMPLES);
  }
  return sample;
}

export function recordPageLoadMetric(input: {
  path: string;
  locale?: string;
  ttfbMs: number;
  fcpMs?: number | null;
  lcpMs?: number | null;
  domLoadMs: number;
  deviceType?: "desktop" | "mobile" | "tablet";
  timestampMs?: number;
}): PageLoadMetricSample {
  const store = getStore();
  store.seq += 1;
  const sample: PageLoadMetricSample = {
    id: `page-${store.seq}`,
    path: normalizeTelemetryRoute(input.path),
    locale: input.locale === "en" ? "en" : "fa",
    ttfbMs: clampDuration(input.ttfbMs),
    fcpMs:
      typeof input.fcpMs === "number" && Number.isFinite(input.fcpMs)
        ? clampDuration(input.fcpMs)
        : null,
    lcpMs:
      typeof input.lcpMs === "number" && Number.isFinite(input.lcpMs)
        ? clampDuration(input.lcpMs)
        : null,
    domLoadMs: clampDuration(input.domLoadMs),
    deviceType: input.deviceType ?? "desktop",
    timestampMs: input.timestampMs ?? Date.now(),
  };
  store.pageSamples.push(sample);
  if (store.pageSamples.length > MAX_RING_SAMPLES) {
    store.pageSamples.splice(0, store.pageSamples.length - MAX_RING_SAMPLES);
  }
  return sample;
}

export function getRecordedApiMetrics(): ApiMetricSample[] {
  return [...getStore().apiSamples];
}

export function getRecordedPageLoadMetrics(): PageLoadMetricSample[] {
  return [...getStore().pageSamples];
}

export function resetPerformanceTelemetryStore(): void {
  globalThis.__scientaPerfStore = {
    apiSamples: [],
    pageSamples: [],
    seq: 0,
  };
}
