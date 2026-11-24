import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateApiEndpoints,
  aggregatePageLoads,
  buildLatencyTimeline,
  buildPerformanceChartGeometry,
  classifyLatencyHealth,
  computePercentile,
  getRecordedApiMetrics,
  getRecordedPageLoadMetrics,
  normalizeTelemetryRoute,
  recordApiMetric,
  recordPageLoadMetric,
  resetPerformanceTelemetryStore,
  summarizeLatencySeries,
} from "./performance-telemetry";

test("normalizeTelemetryRoute strips query strings and collapses UUID and numeric IDs", () => {
  assert.equal(
    normalizeTelemetryRoute("/api/admin/articles/550e8400-e29b-41d4-a716-446655440000?tab=fa"),
    "/api/admin/articles/:id"
  );
  assert.equal(normalizeTelemetryRoute("/api/admin/comments/42/"), "/api/admin/comments/:id");
  assert.equal(
    normalizeTelemetryRoute("https://scienta.ir/fa/articles?page=2#top"),
    "/fa/articles"
  );
  assert.equal(normalizeTelemetryRoute(""), "/");
});

test("computePercentile and summarizeLatencySeries calculate accurate stats", () => {
  assert.equal(computePercentile([], 95), 0);
  assert.equal(computePercentile([25], 95), 25);
  assert.equal(computePercentile([10, 20, 30, 40, 100], 50), 30);
  assert.equal(computePercentile([10, 20, 30, 40, 100], 95), 100);

  const summary = summarizeLatencySeries([10, 30, 50, 110], 1);
  assert.equal(summary.count, 4);
  assert.equal(summary.avgMs, 50);
  assert.equal(summary.maxMs, 110);
  assert.equal(summary.errorCount, 1);
  assert.equal(summary.errorRatePct, 25);
});

test("classifyLatencyHealth applies API and Web Vitals thresholds", () => {
  assert.equal(classifyLatencyHealth(80, "api"), "good");
  assert.equal(classifyLatencyHealth(240, "api"), "warn");
  assert.equal(classifyLatencyHealth(500, "api"), "slow");

  assert.equal(classifyLatencyHealth(180, "ttfb"), "good");
  assert.equal(classifyLatencyHealth(350, "ttfb"), "warn");
  assert.equal(classifyLatencyHealth(650, "ttfb"), "slow");

  assert.equal(classifyLatencyHealth(1100, "domLoad"), "good");
  assert.equal(classifyLatencyHealth(2200, "domLoad"), "warn");
  assert.equal(classifyLatencyHealth(3800, "domLoad"), "slow");
});

test("aggregateApiEndpoints groups normalized endpoints and tracks errors", () => {
  const now = Date.now();
  const rows = aggregateApiEndpoints([
    {
      id: "1",
      route: "/api/admin/articles/550e8400-e29b-41d4-a716-446655440000",
      method: "GET",
      status: 200,
      durationMs: 40,
      timestampMs: now - 1000,
      source: "server",
    },
    {
      id: "2",
      route: "/api/admin/articles/660e8400-e29b-41d4-a716-446655440001",
      method: "GET",
      status: 200,
      durationMs: 100,
      timestampMs: now,
      source: "server",
    },
    {
      id: "3",
      route: "/api/public/search?q=gravity",
      method: "GET",
      status: 500,
      durationMs: 420,
      timestampMs: now,
      source: "server",
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].route, "/api/public/search");
  assert.equal(rows[0].health, "slow");
  assert.equal(rows[0].errorCount, 1);

  assert.equal(rows[1].route, "/api/admin/articles/:id");
  assert.equal(rows[1].requests, 2);
  assert.equal(rows[1].avgMs, 70);
  assert.equal(rows[1].health, "good");
});

test("aggregatePageLoads computes per-route TTFB, FCP, avg load, and p95", () => {
  const now = Date.now();
  const rows = aggregatePageLoads([
    {
      id: "p1",
      path: "/fa/articles/black-holes",
      locale: "fa",
      ttfbMs: 100,
      fcpMs: 420,
      lcpMs: null,
      domLoadMs: 900,
      deviceType: "desktop",
      timestampMs: now - 500,
    },
    {
      id: "p2",
      path: "/fa/articles/black-holes?ref=home",
      locale: "fa",
      ttfbMs: 140,
      fcpMs: 580,
      lcpMs: null,
      domLoadMs: 1300,
      deviceType: "mobile",
      timestampMs: now,
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].path, "/fa/articles/black-holes");
  assert.equal(rows[0].samples, 2);
  assert.equal(rows[0].avgTtfbMs, 120);
  assert.equal(rows[0].avgFcpMs, 500);
  assert.equal(rows[0].avgLoadMs, 1100);
  assert.equal(rows[0].p95LoadMs, 1300);
  assert.equal(rows[0].health, "good");
});

test("buildLatencyTimeline and buildPerformanceChartGeometry generate valid SVG paths", () => {
  const base = Date.UTC(2026, 10, 23, 10, 0, 0);
  const samples = Array.from({ length: 20 }, (_, i) => ({
    durationMs: 25 + i * 8,
    timestampMs: base + i * 5000,
    isError: i === 19,
  }));

  const timeline = buildLatencyTimeline(samples, 8);
  assert.ok(timeline.length >= 4 && timeline.length <= 8);
  assert.equal(
    timeline.reduce((sum, b) => sum + b.count, 0),
    20
  );

  const geom = buildPerformanceChartGeometry(timeline, 640, 196, 120, 14, 18);
  assert.equal(geom.points.length, timeline.length);
  assert.ok(geom.avgLinePath.startsWith("M"));
  assert.ok(geom.p95LinePath.startsWith("M"));
  assert.ok(geom.avgAreaPath.endsWith("Z"));
  assert.ok(geom.maxMs >= 177);
});

test("in-process ring store records metrics and enforces bounded capacity", () => {
  resetPerformanceTelemetryStore();
  for (let i = 0; i < 260; i += 1) {
    recordApiMetric({
      route: "/api/admin/dashboard/stats",
      method: "GET",
      status: 200,
      durationMs: 10 + (i % 30),
    });
  }
  recordPageLoadMetric({
    path: "/admin/dashboard",
    locale: "en",
    ttfbMs: 85,
    fcpMs: 360,
    domLoadMs: 820,
    deviceType: "desktop",
  });

  assert.equal(getRecordedApiMetrics().length, 240);
  assert.equal(getRecordedPageLoadMetrics().length, 1);
  resetPerformanceTelemetryStore();
});
