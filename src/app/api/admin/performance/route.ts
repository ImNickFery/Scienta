import { NextResponse } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireAdminMutation, requireApiAuth } from "@/lib/session";
import { collectSystemTelemetry } from "@/lib/system-telemetry";
import { ensureAnalyticsTableReady } from "@/lib/analytics-store";
import {
  aggregateApiEndpoints,
  aggregatePageLoads,
  buildLatencyTimeline,
  classifyLatencyHealth,
  computePercentile,
  getRecordedApiMetrics,
  getRecordedPageLoadMetrics,
  recordApiMetric,
  recordPageLoadMetric,
  summarizeLatencySeries,
} from "@/lib/performance-telemetry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ingestSchema = z.object({
  runProbes: z.boolean().optional(),
  pageLoad: z
    .object({
      path: z.string().min(1).max(200),
      locale: z.enum(["fa", "en"]).optional(),
      ttfbMs: z.number().min(0).max(60_000),
      fcpMs: z.number().min(0).max(60_000).nullable().optional(),
      lcpMs: z.number().min(0).max(60_000).nullable().optional(),
      domLoadMs: z.number().min(0).max(60_000),
      deviceType: z.enum(["desktop", "mobile", "tablet"]).optional(),
    })
    .optional(),
  apiSamples: z
    .array(
      z.object({
        route: z.string().min(1).max(200),
        method: z.string().min(1).max(10).optional(),
        status: z.number().int().min(100).max(599).optional(),
        durationMs: z.number().min(0).max(60_000),
      })
    )
    .max(20)
    .optional(),
});

async function executeLiveServerProbes() {
  const probes: Array<{ route: string; fn: () => Promise<unknown> }> = [
    {
      route: "/api/admin/articles",
      fn: () =>
        query(
          `SELECT id, status, views FROM articles WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 10`
        ),
    },
    {
      route: "/api/public/search",
      fn: () =>
        query(
          `SELECT article_id, slug, title FROM article_translations WHERE locale = ? LIMIT 10`,
          ["en"]
        ),
    },
    {
      route: "/api/admin/system/telemetry",
      fn: () => collectSystemTelemetry(),
    },
  ];

  for (const p of probes) {
    const t0 = performance.now();
    let status = 200;
    try {
      await p.fn();
    } catch {
      status = 500;
    }
    recordApiMetric({
      route: p.route,
      method: "GET",
      status,
      durationMs: Math.max(0.2, performance.now() - t0),
      source: "server",
    });
  }
}

async function buildPerformanceResponse(startedAt: number, method: "GET" | "POST") {
  const dbStart = performance.now();
  await queryOne<{ ok: number }>(`SELECT 1 AS ok`).catch(() => null);
  const dbPingMs = Math.round((performance.now() - dbStart) * 10) / 10;

  const [{ snapshot }, pageviews24hRow] = await Promise.all([
    collectSystemTelemetry(),
    (async () => {
      try {
        await ensureAnalyticsTableReady();
        const cutoffIso = new Date(Date.now() - 86_400_000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
        return await queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count FROM analytics_pageviews WHERE created_at >= ?`,
          [cutoffIso]
        );
      } catch {
        return null;
      }
    })(),
  ]);

  const selfDurationMs = Math.round((performance.now() - startedAt) * 10) / 10;
  recordApiMetric({
    route: "/api/admin/performance",
    method,
    status: 200,
    durationMs: selfDurationMs,
    source: "server",
  });

  const apiSamples = getRecordedApiMetrics();
  const pageSamples = getRecordedPageLoadMetrics();

  const apiSummary = summarizeLatencySeries(
    apiSamples.map((s) => s.durationMs),
    apiSamples.filter((s) => s.status >= 400).length
  );

  const ttfbs = pageSamples.map((p) => p.ttfbMs);
  const fcps = pageSamples
    .map((p) => p.fcpMs)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const loads = pageSamples.map((p) => p.domLoadMs);

  const avgOf = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  const avgLoadMs = avgOf(loads);

  const apiTimeline = buildLatencyTimeline(
    apiSamples.map((s) => ({
      durationMs: s.durationMs,
      timestampMs: s.timestampMs,
      isError: s.status >= 400,
    })),
    16
  );

  const pageTimeline = buildLatencyTimeline(
    pageSamples.map((p) => ({
      durationMs: p.domLoadMs,
      timestampMs: p.timestampMs,
      isError: false,
    })),
    16
  );

  return {
    capturedAt: new Date().toISOString(),
    dbPingMs,
    dbHealth: classifyLatencyHealth(dbPingMs, "api"),
    recentPageviews24h: Number(pageviews24hRow?.count ?? 0),
    system: {
      cpuPercent: snapshot.cpu.percent,
      cpuCores: snapshot.cpu.cores,
      loadAvg1m: snapshot.cpu.loadAvg[0],
      memoryPercent: snapshot.memory.percent,
      heapPercent: snapshot.runtime.heapPercent,
      dbEngine: snapshot.runtime.dbEngine,
      processUptimeSec: snapshot.runtime.processUptimeSec,
    },
    api: {
      summary: {
        ...apiSummary,
        health: classifyLatencyHealth(apiSummary.p95Ms, "api"),
      },
      timeline: apiTimeline,
      endpoints: aggregateApiEndpoints(apiSamples),
    },
    pages: {
      summary: {
        samples: pageSamples.length,
        avgTtfbMs: avgOf(ttfbs),
        avgFcpMs: fcps.length > 0 ? avgOf(fcps) : null,
        avgLoadMs,
        p95LoadMs: computePercentile(loads, 95),
        health: classifyLatencyHealth(avgLoadMs, "domLoad"),
      },
      timeline: pageTimeline,
      routes: aggregatePageLoads(pageSamples),
    },
  };
}

export async function GET() {
  const startedAt = performance.now();
  const { response } = await requireApiAuth("dashboard.view");
  if (response) return response;

  const payload = await buildPerformanceResponse(startedAt, "GET");
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const startedAt = performance.now();
  const { response } = await requireAdminMutation(req, "dashboard.view");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid performance payload" }, { status: 400 });
  }

  if (parsed.data.pageLoad) {
    recordPageLoadMetric(parsed.data.pageLoad);
  }
  if (parsed.data.apiSamples) {
    for (const s of parsed.data.apiSamples) {
      if (s.route.startsWith("/api/")) {
        recordApiMetric({
          route: s.route,
          method: s.method ?? "GET",
          status: s.status ?? 200,
          durationMs: s.durationMs,
          source: "client",
        });
      }
    }
  }
  if (parsed.data.runProbes) {
    await executeLiveServerProbes();
  }

  const payload = await buildPerformanceResponse(startedAt, "POST");
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
