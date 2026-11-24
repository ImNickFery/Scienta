"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw, Search } from "lucide-react";
import { adminFetch } from "@/lib/admin-api-client";
import {
  buildPerformanceChartGeometry,
  type EndpointPerformanceRow,
  type LatencyHealth,
  type LatencySummary,
  type PagePerformanceRow,
  type PerformanceTimelineBucket,
} from "@/lib/performance-telemetry";

export interface PerformanceTelemetryPayload {
  capturedAt: string;
  dbPingMs: number;
  dbHealth: LatencyHealth;
  recentPageviews24h: number;
  system: {
    cpuPercent: number;
    cpuCores: number;
    loadAvg1m: number;
    memoryPercent: number;
    heapPercent: number;
    dbEngine: "sqlite" | "mysql";
    processUptimeSec: number;
  };
  api: {
    summary: LatencySummary & { health: LatencyHealth };
    timeline: PerformanceTimelineBucket[];
    endpoints: EndpointPerformanceRow[];
  };
  pages: {
    summary: {
      samples: number;
      avgTtfbMs: number;
      avgFcpMs: number | null;
      avgLoadMs: number;
      p95LoadMs: number;
      health: LatencyHealth;
    };
    timeline: PerformanceTimelineBucket[];
    routes: PagePerformanceRow[];
  };
}

interface DashboardPerformanceMonitorProps {
  isFa: boolean;
  refreshNonce?: number;
}

type PerfViewTab = "api" | "pages";
type EndpointSort = "p95" | "requests" | "avg";

function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms > 0 && ms < 10) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

function healthText(health: LatencyHealth, isFa: boolean): { label: string; className: string } {
  if (health === "good") {
    return {
      label: isFa ? "بهینه" : "Nominal",
      className: "text-emerald-400",
    };
  }
  if (health === "warn") {
    return {
      label: isFa ? "متوسط" : "Elevated",
      className: "text-amber-400",
    };
  }
  return {
    label: isFa ? "کند" : "Slow",
    className: "text-red-400",
  };
}

function healthBarColor(health: LatencyHealth): string {
  if (health === "good") return "#10b981";
  if (health === "warn") return "#f59e0b";
  return "#ef4444";
}

function formatTimeShort(iso: string, isFa: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(isFa ? "fa-IR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function collectBrowserTimingPayload(
  seenResourceKeys: Set<string>,
  includePageLoad: boolean
) {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return {};
  }

  let pageLoad:
    | {
        path: string;
        locale: "fa" | "en";
        ttfbMs: number;
        fcpMs: number | null;
        domLoadMs: number;
        deviceType: "desktop" | "mobile" | "tablet";
      }
    | undefined;

  if (includePageLoad) {
    try {
      const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      const fcpEntry = performance
        .getEntriesByType("paint")
        .find((entry) => entry.name === "first-contentful-paint");

      if (nav) {
        const ttfbMs = Math.max(0, Math.round(nav.responseStart - nav.requestStart));
        const rawLoad =
          (nav.loadEventEnd > 0 ? nav.loadEventEnd : nav.domContentLoadedEventEnd) - nav.startTime;
        const domLoadMs = Math.max(ttfbMs, Math.round(rawLoad > 0 ? rawLoad : performance.now()));
        const fcpMs = fcpEntry ? Math.max(0, Math.round(fcpEntry.startTime)) : null;
        const width = window.innerWidth;
        const deviceType: "desktop" | "mobile" | "tablet" =
          width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";

        pageLoad = {
          path: window.location.pathname || "/admin/dashboard",
          locale: document.documentElement.lang === "fa" ? "fa" : "en",
          ttfbMs,
          fcpMs,
          domLoadMs,
          deviceType,
        };
      }
    } catch {
      // Ignore restricted Navigation Timing APIs
    }
  }

  const apiSamples: Array<{
    route: string;
    method: string;
    status: number;
    durationMs: number;
  }> = [];

  try {
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    for (const r of resources) {
      if (!r.name) continue;
      let pathname = "";
      try {
        const u = new URL(r.name, window.location.origin);
        if (u.origin !== window.location.origin) continue;
        pathname = u.pathname;
      } catch {
        continue;
      }
      if (!pathname.startsWith("/api/")) continue;
      const key = `${pathname}:${Math.round(r.startTime)}`;
      if (seenResourceKeys.has(key)) continue;
      seenResourceKeys.add(key);

      const status =
        "responseStatus" in r && typeof (r as { responseStatus?: number }).responseStatus === "number"
          ? ((r as { responseStatus: number }).responseStatus || 200)
          : 200;

      if (Number.isFinite(r.duration) && r.duration >= 0) {
        apiSamples.push({
          route: pathname,
          method: "GET",
          status: status >= 100 && status <= 599 ? status : 200,
          durationMs: Math.round(r.duration * 10) / 10,
        });
      }
      if (apiSamples.length >= 16) break;
    }
  } catch {
    // Ignore restricted Resource Timing APIs
  }

  return {
    ...(pageLoad ? { pageLoad } : {}),
    ...(apiSamples.length > 0 ? { apiSamples } : {}),
  };
}

export function DashboardPerformanceMonitor({
  isFa,
  refreshNonce = 0,
}: DashboardPerformanceMonitorProps) {
  const [data, setData] = useState<PerformanceTelemetryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<PerfViewTab>("api");
  const [routeFilter, setRouteFilter] = useState("");
  const [sortBy, setSortBy] = useState<EndpointSort>("p95");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const seenResourcesRef = useRef<Set<string>>(new Set());
  const didInitialIngestRef = useRef(false);
  const pageLoadIngestedRef = useRef(false);
  const initialPromiseRef = useRef<Promise<PerformanceTelemetryPayload> | null>(null);

  const loadMetrics = useCallback(async (withBrowserIngest: boolean, runProbes = false) => {
    const includePageLoad = withBrowserIngest && !pageLoadIngestedRef.current;
    const body = withBrowserIngest
      ? collectBrowserTimingPayload(seenResourcesRef.current, includePageLoad)
      : {};

    if (includePageLoad && body.pageLoad) {
      pageLoadIngestedRef.current = true;
    }

    if (runProbes || (withBrowserIngest && (body.pageLoad || body.apiSamples?.length))) {
      return adminFetch<PerformanceTelemetryPayload>("/api/admin/performance", {
        method: "POST",
        body: JSON.stringify({ ...body, ...(runProbes ? { runProbes: true } : {}) }),
      });
    }
    return adminFetch<PerformanceTelemetryPayload>("/api/admin/performance");
  }, []);

  useEffect(() => {
    let cancelled = false;
    let requestPromise: Promise<PerformanceTelemetryPayload>;

    if (refreshNonce === 0 && !didInitialIngestRef.current) {
      if (!initialPromiseRef.current) {
        initialPromiseRef.current = loadMetrics(true, true).finally(() => {
          didInitialIngestRef.current = true;
          initialPromiseRef.current = null;
        });
      }
      requestPromise = initialPromiseRef.current;
    } else {
      requestPromise = loadMetrics(false, false);
    }

    requestPromise
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load performance metrics");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setProbing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadMetrics, refreshNonce]);

  async function handleRunProbe() {
    setProbing(true);
    setError(null);
    try {
      const payload = await loadMetrics(true, true);
      setData(payload);
      setHoveredIdx(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live probe failed");
    } finally {
      setProbing(false);
    }
  }

  const filteredEndpoints = useMemo(() => {
    if (!data) return [];
    const q = routeFilter.trim().toLowerCase();
    const list = q
      ? data.api.endpoints.filter(
          (row) =>
            row.route.toLowerCase().includes(q) || row.method.toLowerCase().includes(q)
        )
      : [...data.api.endpoints];

    if (sortBy === "requests") {
      list.sort((a, b) => b.requests - a.requests || b.p95Ms - a.p95Ms);
    } else if (sortBy === "avg") {
      list.sort((a, b) => b.avgMs - a.avgMs || b.requests - a.requests);
    } else {
      list.sort((a, b) => b.p95Ms - a.p95Ms || b.requests - a.requests);
    }
    return list;
  }, [data, routeFilter, sortBy]);

  const filteredPages = useMemo(() => {
    if (!data) return [];
    const q = routeFilter.trim().toLowerCase();
    const list = q
      ? data.pages.routes.filter((row) => row.path.toLowerCase().includes(q))
      : [...data.pages.routes];

    if (sortBy === "requests") {
      list.sort((a, b) => b.samples - a.samples || b.p95LoadMs - a.p95LoadMs);
    } else if (sortBy === "avg") {
      list.sort((a, b) => b.avgLoadMs - a.avgLoadMs || b.samples - a.samples);
    } else {
      list.sort((a, b) => b.p95LoadMs - a.p95LoadMs || b.samples - a.samples);
    }
    return list;
  }, [data, routeFilter, sortBy]);

  if (loading && !data) {
    return (
      <section
        aria-label={isFa ? "پایش عملکرد سامانه" : "Performance Monitoring"}
        className="overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)"
      >
        <div className="flex items-center justify-between border-b border-(--color-border-subtle) px-5 py-4">
          <div className="h-5 w-48 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-8 w-56 animate-pulse rounded bg-white/[0.06]" />
        </div>
        <div className="grid h-24 animate-pulse divide-x divide-(--color-border-subtle) border-b border-(--color-border-subtle) lg:grid-cols-4" />
        <div className="grid gap-6 p-5 lg:grid-cols-5">
          <div className="h-56 animate-pulse rounded-lg bg-white/[0.04] lg:col-span-3" />
          <div className="h-56 animate-pulse rounded-lg bg-white/[0.04] lg:col-span-2" />
        </div>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="rounded-xl border border-(--color-accent-red)/30 bg-(--color-accent-red)/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-(--color-accent-red)">{error}</p>
          <button
            type="button"
            onClick={handleRunProbe}
            className="rounded-lg border border-(--color-border-strong) px-3.5 py-2 text-xs font-medium text-(--color-text-primary) hover:bg-white/[0.05] whitespace-nowrap"
          >
            {isFa ? "تلاش مجدد" : "Retry Probe"}
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const activeTimeline = activeTab === "api" ? data.api.timeline : data.pages.timeline;
  const slaTargetMs = activeTab === "api" ? 120 : 1500;
  const chartWidth = 640;
  const chartHeight = 196;
  const geom = buildPerformanceChartGeometry(
    activeTimeline,
    chartWidth,
    chartHeight,
    slaTargetMs,
    14,
    18
  );
  const activePoint =
    hoveredIdx !== null && geom.points[hoveredIdx] ? geom.points[hoveredIdx] : null;

  const apiHealth = healthText(data.api.summary.health, isFa);
  const dbHealth = healthText(data.dbHealth, isFa);
  const pageHealth = healthText(data.pages.summary.health, isFa);

  const maxEndpointP95 = Math.max(1, ...filteredEndpoints.map((r) => r.p95Ms));
  const maxPageLoad = Math.max(1, ...filteredPages.map((r) => r.p95LoadMs));

  return (
    <section
      aria-labelledby="perf-monitor-heading"
      className="overflow-hidden rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary)"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) px-5 py-4">
        <div>
          <h2
            id="perf-monitor-heading"
            className="text-sm font-semibold text-(--color-text-primary)"
          >
            {isFa ? "پایش عملکرد API و بارگذاری صفحات" : "Performance Monitoring"}
          </h2>
          <p className="mt-0.5 text-xs text-(--color-text-tertiary)">
            <span>
              {isFa
                ? "زمان پاسخ واقعی مسیرهای API، تاخیر دیتابیس و سرعت بارگذاری صفحات"
                : "Live API response latency, database ping, and browser page load telemetry"}
            </span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <span dir="ltr" className="font-[family-name:var(--font-mono)] tabular-nums">
              {isFa ? "بروزرسانی" : "Updated"} {formatTimeShort(data.capturedAt, isFa)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Interactive View Switcher */}
          <div
            role="tablist"
            aria-label={isFa ? "حالت نمایش عملکرد" : "Performance telemetry view"}
            className="flex items-center gap-0.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) p-0.5 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "api"}
              onClick={() => {
                setActiveTab("api");
                setHoveredIdx(null);
              }}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === "api"
                  ? "bg-(--color-accent-purple) text-white"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              {isFa ? "زمان پاسخ API" : "API Latency"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "pages"}
              onClick={() => {
                setActiveTab("pages");
                setHoveredIdx(null);
              }}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === "pages"
                  ? "bg-(--color-accent-purple) text-white"
                  : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              }`}
            >
              {isFa ? "بارگذاری صفحات" : "Page Loads"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleRunProbe}
            disabled={probing}
            aria-label={isFa ? "اجرای سنجش زنده عملکرد" : "Run live performance probe"}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-3 text-xs font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary) disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${probing ? "animate-spin" : ""}`} />
            <span>{isFa ? "سنجش زنده" : "Run Probe"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-(--color-accent-red)/30 bg-(--color-accent-red)/10 px-5 py-2 text-xs text-(--color-accent-red)">
          {error}
        </div>
      )}

      {/* 4-Cell Hairline Performance KPI Strip */}
      <div className="grid divide-y divide-(--color-border-subtle) border-b border-(--color-border-subtle) sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x rtl:lg:divide-x-reverse">
        {/* KPI 1: API Response Latency */}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-(--color-text-tertiary)">
              {isFa ? "میانگین پاسخ API" : "API Avg / p95"}
            </span>
            <span className={`text-[11px] font-medium ${apiHealth.className}`}>
              {apiHealth.label}
            </span>
          </div>
          <p
            dir="ltr"
            className="mt-2 font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums text-(--color-text-primary)"
          >
            {formatMs(data.api.summary.avgMs)}
            <span className="ms-1.5 text-xs font-normal text-(--color-text-tertiary)">
              / p95 {formatMs(data.api.summary.p95Ms)}
            </span>
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
            {isFa
              ? `${data.api.summary.count} نمونه · خطا ${data.api.summary.errorRatePct}%`
              : `${data.api.summary.count} ${data.api.summary.count === 1 ? "sample" : "samples"} · ${data.api.summary.errorRatePct}% errors`}
          </p>
        </div>

        {/* KPI 2: Database Round-Trip Ping */}
        <div className="border-t border-(--color-border-subtle) p-4 sm:border-t-0 sm:border-s lg:border-s-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-(--color-text-tertiary)">
              {isFa ? "تاخیر پایگاه داده" : "Database Query Ping"}
            </span>
            <span className={`text-[11px] font-medium ${dbHealth.className}`}>
              {dbHealth.label}
            </span>
          </div>
          <p
            dir="ltr"
            className="mt-2 font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums text-(--color-text-primary)"
          >
            {formatMs(data.dbPingMs)}
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
            {data.system.dbEngine.toUpperCase()}
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            {isFa
              ? `${data.recentPageviews24h.toLocaleString()} بازدید ۲۴ ساعته`
              : `${data.recentPageviews24h.toLocaleString()} ${data.recentPageviews24h === 1 ? "pageview" : "pageviews"} (24h)`}
          </p>
        </div>

        {/* KPI 3: Page Load & TTFB */}
        <div className="border-t border-(--color-border-subtle) p-4 lg:border-t-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-(--color-text-tertiary)">
              {isFa ? "سرعت بارگذاری صفحه" : "Page Load / TTFB"}
            </span>
            <span className={`text-[11px] font-medium ${pageHealth.className}`}>
              {data.pages.summary.samples > 0
                ? pageHealth.label
                : isFa
                  ? "در انتظار نمونه"
                  : "Awaiting"}
            </span>
          </div>
          <p
            dir="ltr"
            className="mt-2 font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums text-(--color-text-primary)"
          >
            {data.pages.summary.samples > 0 ? formatMs(data.pages.summary.avgLoadMs) : "—"}
            <span className="ms-1.5 text-xs font-normal text-(--color-text-tertiary)">
              / TTFB {data.pages.summary.samples > 0 ? formatMs(data.pages.summary.avgTtfbMs) : "—"}
            </span>
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
            {data.pages.summary.avgFcpMs !== null
              ? `FCP ${formatMs(data.pages.summary.avgFcpMs)} · ${data.pages.summary.samples} ${isFa ? "نمونه" : data.pages.summary.samples === 1 ? "sample" : "samples"}`
              : `${data.pages.summary.samples} ${isFa ? "نمونه ثبت‌شده" : data.pages.summary.samples === 1 ? "recorded load" : "recorded loads"}`}
          </p>
        </div>

        {/* KPI 4: Live Host Telemetry Link */}
        <Link
          href="/admin/system"
          className="group block border-t border-(--color-border-subtle) p-4 transition-colors hover:bg-white/[0.02] sm:border-s lg:border-t-0 lg:border-s-0"
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-(--color-text-tertiary)">
              {isFa ? "منابع سرور (زنده)" : "Runtime Telemetry"}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-(--color-text-tertiary) transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-(--color-text-primary)" />
          </div>
          <p
            dir="ltr"
            className="mt-2 font-[family-name:var(--font-mono)] text-xl font-bold tabular-nums text-(--color-text-primary)"
          >
            {data.system.cpuPercent.toFixed(1)}%
            <span className="ms-1.5 text-xs font-normal text-(--color-text-tertiary)">
              CPU
            </span>
          </p>
          <p
            dir="ltr"
            className="mt-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)"
          >
            RAM {data.system.memoryPercent.toFixed(1)}% · Heap {data.system.heapPercent.toFixed(1)}%
          </p>
        </Link>
      </div>

      {/* Main Content Split: Interactive Latency Timeline Chart + Breakdown Table */}
      <div className="grid divide-y divide-(--color-border-subtle) lg:grid-cols-12 lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse">
        {/* Left: SVG Dual-Curve Latency Chart (Avg + p95 + SLA Budget) */}
        <div className="min-w-0 p-5 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold text-(--color-text-primary)">
                {activeTab === "api"
                  ? isFa
                    ? "نمودار زمانی تاخیر پاسخ API (میانگین و p95)"
                    : "API Response Time Distribution (Avg & p95)"
                  : isFa
                    ? "نمودار زمانی بارگذاری صفحات (میانگین و p95)"
                    : "Page Load Duration Timeline (Avg & p95)"}
              </h3>
              <p className="mt-0.5 text-[11px] text-(--color-text-tertiary)">
                {activeTab === "api"
                  ? isFa
                    ? "خط هدف SLA روی ۱۲۰ میلی‌ثانیه"
                    : "Target API budget line at 120 ms"
                  : isFa
                    ? "خط هدف بارگذاری روی ۱.۵ ثانیه"
                    : "Target full-load budget line at 1.50s"}
              </p>
            </div>
            <div className="flex items-center gap-3 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary)">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-3 bg-[#7b3ffb]" aria-hidden="true" />
                {isFa ? "میانگین" : "Avg"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-3 border-t border-dashed border-[#ff7a00]" aria-hidden="true" />
                p95
              </span>
            </div>
          </div>

          {activeTimeline.length === 0 ? (
            <div className="mt-6 flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-(--color-border-subtle) px-4 text-center">
              <p className="text-xs font-medium text-(--color-text-secondary)">
                {isFa
                  ? "هنوز نمونه‌ای برای این بخش ثبت نشده است."
                  : "No telemetry samples captured for this series yet."}
              </p>
              <button
                type="button"
                onClick={handleRunProbe}
                className="mt-3 rounded-lg bg-(--color-accent-purple) px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                {isFa ? "ثبت اولین سنجش" : "Run Live Probe"}
              </button>
            </div>
          ) : (
            <div className="mt-4" dir="ltr">
              {/* Zero-shift live hover readout */}
              <div className="mb-2 flex h-5 items-center justify-between font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                <span>
                  {activePoint
                    ? `${activePoint.label} · ${activePoint.count} ${isFa ? "درخواست" : "req"}`
                    : isFa
                      ? "برای بررسی دقیق روی نقاط نمودار حرکت کنید"
                      : "Hover points to inspect bucketed Avg & p95 latency"}
                </span>
                <span className="font-semibold text-(--color-text-primary)">
                  {activePoint
                    ? `Avg ${formatMs(activePoint.avgMs)} · p95 ${formatMs(activePoint.p95Ms)}`
                    : activeTab === "api"
                      ? `p50 ${formatMs(data.api.summary.p50Ms)} · Max ${formatMs(data.api.summary.maxMs)}`
                      : `p95 ${formatMs(data.pages.summary.p95LoadMs)}`}
                </span>
              </div>

              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="h-48 w-full overflow-visible"
                role="img"
                aria-label={
                  activeTab === "api"
                    ? "API response latency timeline chart"
                    : "Page load duration timeline chart"
                }
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <defs>
                  <linearGradient id="perfAvgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7b3ffb" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#7b3ffb" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Reference horizontal gridlines */}
                {[0, 0.5, 1].map((fraction, idx) => {
                  const y = 18 + (chartHeight - 36) * fraction;
                  const val =
                    fraction === 0 ? geom.maxMs : fraction === 0.5 ? Math.round(geom.maxMs / 2) : 0;
                  return (
                    <g key={idx}>
                      <line
                        x1={14}
                        y1={y}
                        x2={chartWidth - 14}
                        y2={y}
                        stroke="rgba(255,255,255,0.07)"
                        strokeDasharray={fraction === 1 ? undefined : "3 4"}
                      />
                      <text
                        x={chartWidth - 14}
                        y={y - 4}
                        textAnchor="end"
                        fill="#7a7a92"
                        fontSize="10"
                        fontFamily="var(--font-mono)"
                      >
                        {formatMs(val)}
                      </text>
                    </g>
                  );
                })}

                {/* SLA budget target reference line */}
                <g>
                  <line
                    x1={14}
                    y1={geom.slaY}
                    x2={chartWidth - 14}
                    y2={geom.slaY}
                    stroke="rgba(16, 185, 129, 0.48)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={16}
                    y={Math.max(12, geom.slaY - 4)}
                    textAnchor="start"
                    fill="#34d399"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                  >
                    {`SLA ${formatMs(slaTargetMs)}`}
                  </text>
                </g>

                {/* Avg area + line + p95 line (drawn on top so dashed p95 stays legible) */}
                {geom.avgAreaPath && <path d={geom.avgAreaPath} fill="url(#perfAvgGrad)" />}
                {geom.avgLinePath && (
                  <path
                    d={geom.avgLinePath}
                    fill="none"
                    stroke="#7b3ffb"
                    strokeWidth="2.25"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {geom.p95LinePath && (
                  <path
                    d={geom.p95LinePath}
                    fill="none"
                    stroke="#ff7a00"
                    strokeWidth="1.75"
                    strokeDasharray="4 3"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover vertical crosshair */}
                {activePoint && (
                  <line
                    x1={activePoint.x}
                    y1={14}
                    x2={activePoint.x}
                    y2={chartHeight - 18}
                    stroke="rgba(255,255,255,0.22)"
                    strokeDasharray="2 3"
                  />
                )}

                {/* Hit targets & data markers */}
                {geom.points.map((pt, idx) => {
                  const isActive = hoveredIdx === idx;
                  const hitW =
                    geom.points.length > 1 ? (chartWidth - 28) / geom.points.length : 60;
                  return (
                    <g key={`${pt.label}-${idx}`}>
                      <rect
                        x={pt.x - hitW / 2}
                        y={0}
                        width={hitW}
                        height={chartHeight}
                        fill="transparent"
                        className="cursor-crosshair"
                        onMouseEnter={() => setHoveredIdx(idx)}
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.avgY}
                        r={isActive ? 4.5 : 2.5}
                        fill={isActive ? "#f5f5fa" : "#7b3ffb"}
                        stroke="#7b3ffb"
                        strokeWidth={isActive ? 2 : 0}
                      />
                      {isActive && (
                        <circle
                          cx={pt.x}
                          cy={pt.p95Y}
                          r={3.5}
                          fill="#ff7a00"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* X-axis timestamps */}
              {(() => {
                const firstLabel = activeTimeline[0]?.label ?? "";
                const lastLabel =
                  activeTimeline.length > 1
                    ? (activeTimeline[activeTimeline.length - 1]?.label ?? "")
                    : "";
                const rawMid =
                  activeTimeline.length > 2
                    ? (activeTimeline[Math.floor(activeTimeline.length / 2)]?.label ?? "")
                    : "";
                const midLabel =
                  rawMid && rawMid !== firstLabel && rawMid !== lastLabel ? rawMid : "";
                return (
                  <div className="mt-1.5 flex items-center justify-between font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-(--color-text-tertiary)">
                    <span>{firstLabel}</span>
                    <span>{midLabel}</span>
                    <span>{lastLabel && lastLabel !== firstLabel ? lastLabel : ""}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Right: Filterable High-Density Endpoint / Page Load Table */}
        <div className="flex min-w-0 flex-col lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--color-border-subtle) px-5 py-3">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 start-2.5 h-3.5 w-3.5 -translate-y-1/2 text-(--color-text-tertiary)" />
              <input
                type="search"
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                aria-label={isFa ? "فیلتر مسیرها" : "Filter routes"}
                placeholder={
                  activeTab === "api"
                    ? isFa
                      ? "فیلتر مسیر API..."
                      : "Filter API endpoints..."
                    : isFa
                      ? "فیلتر آدرس صفحه..."
                      : "Filter page routes..."
                }
                className="h-8 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) ps-8 pe-3 text-xs text-(--color-text-primary) outline-none placeholder:text-(--color-text-tertiary) focus:border-(--color-accent-purple)"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as EndpointSort)}
              aria-label={isFa ? "مرتب‌سازی" : "Sort telemetry rows"}
              className="h-8 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-2.5 text-xs text-(--color-text-secondary) outline-none focus:border-(--color-accent-purple)"
            >
              <option value="p95">{isFa ? "کندترین (p95)" : "Slowest (p95)"}</option>
              <option value="avg">{isFa ? "میانگین تاخیر" : "Highest Avg"}</option>
              <option value="requests">{isFa ? "پرترافیک‌ترین" : "Most Samples"}</option>
            </select>
          </div>

          <div className="flex-1 overflow-x-auto">
            {activeTab === "api" ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-(--color-border-subtle) text-[11px] font-medium text-(--color-text-tertiary)">
                    <th className="px-5 py-2.5 text-start font-medium">
                      {isFa ? "مسیر API" : "Endpoint"}
                    </th>
                    <th className="px-2.5 py-2.5 text-end font-medium">
                      {isFa ? "تعداد" : "Req"}
                    </th>
                    <th className="px-2.5 py-2.5 text-end font-medium">
                      {isFa ? "میانگین" : "Avg"}
                    </th>
                    <th className="px-2.5 py-2.5 text-end font-medium">p95</th>
                    <th className="px-5 py-2.5 text-end font-medium">
                      {isFa ? "وضعیت" : "Status"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border-subtle)">
                  {filteredEndpoints.slice(0, 7).map((row) => {
                    const status = healthText(row.health, isFa);
                    const pct = Math.max(6, Math.round((row.p95Ms / maxEndpointP95) * 100));
                    return (
                      <tr key={row.key} className="transition-colors hover:bg-white/[0.02]">
                        <td className="max-w-[260px] px-5 py-2.5">
                          <div dir="ltr" className="flex items-center gap-2 truncate">
                            <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] font-semibold text-(--color-accent-purple)">
                              {row.method}
                            </span>
                            <span
                              title={row.route}
                              className="truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-primary)"
                            >
                              {row.route}
                            </span>
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-end font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-secondary)">
                          {row.requests}
                        </td>
                        <td
                          dir="ltr"
                          className="px-2.5 py-2.5 text-end font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-secondary)"
                        >
                          {formatMs(row.avgMs)}
                        </td>
                        <td className="px-2.5 py-2.5 text-end">
                          <div className="flex items-center justify-end gap-2">
                            <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-white/[0.07] sm:block">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: healthBarColor(row.health),
                                }}
                              />
                            </div>
                            <span
                              dir="ltr"
                              className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                            >
                              {formatMs(row.p95Ms)}
                            </span>
                          </div>
                        </td>
                        <td className={`px-5 py-2.5 text-end text-[11px] font-medium ${status.className}`}>
                          {status.label}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredEndpoints.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-xs text-(--color-text-tertiary)"
                      >
                        {routeFilter ? (
                          <div className="flex flex-col items-center gap-2">
                            <span>
                              {isFa
                                ? "مسیری با این عبارت یافت نشد."
                                : "No endpoints match your filter."}
                            </span>
                            <button
                              type="button"
                              onClick={() => setRouteFilter("")}
                              className="text-xs font-medium text-(--color-accent-purple) hover:underline"
                            >
                              {isFa ? "پاک کردن فیلتر" : "Clear filter"}
                            </button>
                          </div>
                        ) : isFa ? (
                          "هنوز درخواست API ثبت نشده است."
                        ) : (
                          "No API endpoint telemetry recorded yet."
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-(--color-border-subtle) text-[11px] font-medium text-(--color-text-tertiary)">
                    <th className="px-5 py-2.5 text-start font-medium">
                      {isFa ? "مسیر صفحه" : "Page Route"}
                    </th>
                    <th className="px-2.5 py-2.5 text-end font-medium">TTFB</th>
                    <th className="hidden px-2.5 py-2.5 text-end font-medium sm:table-cell">
                      FCP
                    </th>
                    <th className="px-2.5 py-2.5 text-end font-medium">
                      {isFa ? "بارگذاری" : "Load"}
                    </th>
                    <th className="px-5 py-2.5 text-end font-medium">
                      {isFa ? "وضعیت" : "Status"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border-subtle)">
                  {filteredPages.slice(0, 7).map((row) => {
                    const status = healthText(row.health, isFa);
                    const pct = Math.max(6, Math.round((row.p95LoadMs / maxPageLoad) * 100));
                    return (
                      <tr key={row.path} className="transition-colors hover:bg-white/[0.02]">
                        <td className="max-w-[200px] px-5 py-2.5">
                          <div dir="ltr" className="truncate font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-primary)" title={row.path}>
                            {row.path}
                          </div>
                        </td>
                        <td
                          dir="ltr"
                          className="px-2.5 py-2.5 text-end font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-secondary)"
                        >
                          {formatMs(row.avgTtfbMs)}
                        </td>
                        <td
                          dir="ltr"
                          className="hidden px-2.5 py-2.5 text-end font-[family-name:var(--font-mono)] tabular-nums text-(--color-text-secondary) sm:table-cell"
                        >
                          {formatMs(row.avgFcpMs)}
                        </td>
                        <td className="px-2.5 py-2.5 text-end">
                          <div className="flex items-center justify-end gap-2">
                            <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-white/[0.07] sm:block">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: healthBarColor(row.health),
                                }}
                              />
                            </div>
                            <span
                              dir="ltr"
                              className="font-[family-name:var(--font-mono)] font-medium tabular-nums text-(--color-text-primary)"
                            >
                              {formatMs(row.avgLoadMs)}
                            </span>
                          </div>
                        </td>
                        <td className={`px-5 py-2.5 text-end text-[11px] font-medium ${status.className}`}>
                          {status.label}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPages.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-xs text-(--color-text-tertiary)"
                      >
                        {routeFilter ? (
                          <div className="flex flex-col items-center gap-2">
                            <span>
                              {isFa
                                ? "صفحه‌ای با این عبارت یافت نشد."
                                : "No page routes match your filter."}
                            </span>
                            <button
                              type="button"
                              onClick={() => setRouteFilter("")}
                              className="text-xs font-medium text-(--color-accent-purple) hover:underline"
                            >
                              {isFa ? "پاک کردن فیلتر" : "Clear filter"}
                            </button>
                          </div>
                        ) : isFa ? (
                          "برای ثبت زمان بارگذاری صفحه، سنجش زنده را اجرا کنید."
                        ) : (
                          "Run a live probe or visit an article page to record page load timings."
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
