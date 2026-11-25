import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSubscriberGrowth30d,
  buildTrendSvgGeometry,
  clampTrendDays,
  classifyActivitySource,
  computeEditorialCoverage,
} from "./admin-analytics";

test("clampTrendDays normalizes timeframe parameter strictly to 7, 14, or 30", () => {
  assert.equal(clampTrendDays("7"), 7);
  assert.equal(clampTrendDays(30), 30);
  assert.equal(clampTrendDays("14"), 14);
  assert.equal(clampTrendDays("999"), 14);
  assert.equal(clampTrendDays(null), 14);
});

test("computeEditorialCoverage calculates bilingual parity and cover coverage cleanly", () => {
  const empty = computeEditorialCoverage({ totalArticles: 0, bilingualCount: 0, withCoverCount: 0 });
  assert.deepEqual(empty, { bilingualPct: 0, coverPct: 0, missingCoverCount: 0, singleLocaleCount: 0 });

  const stats = computeEditorialCoverage({ totalArticles: 8, bilingualCount: 7, withCoverCount: 6 });
  assert.equal(stats.bilingualPct, 88);
  assert.equal(stats.coverPct, 75);
  assert.equal(stats.missingCoverCount, 2);
  assert.equal(stats.singleLocaleCount, 1);
});

test("classifyActivitySource categorizes editorial, ai_api, moderation, and security events", () => {
  assert.equal(classifyActivitySource("api.article.create"), "ai_api");
  assert.equal(classifyActivitySource("api_key.rotate"), "ai_api");
  assert.equal(classifyActivitySource("api.auth.failed"), "security");
  assert.equal(classifyActivitySource("auth.login"), "security");
  assert.equal(classifyActivitySource("comment.moderate"), "moderation");
  assert.equal(classifyActivitySource("article.update"), "editorial");
});

test("buildTrendSvgGeometry produces valid bounded SVG paths and coordinates", () => {
  const geom = buildTrendSvgGeometry(
    [
      { date: "2026-11-17", label: "Nov 17", count: 0 },
      { date: "2026-11-18", label: "Nov 18", count: 5 },
      { date: "2026-11-19", label: "Nov 19", count: 10 },
    ],
    600,
    180
  );
  assert.equal(geom.coords.length, 3);
  assert.equal(geom.maxValue, 10);
  assert.ok(geom.linePath.startsWith("M12,"));
  assert.ok(geom.areaPath.endsWith("Z"));
  assert.ok(geom.coords[2].y < geom.coords[0].y);
});

test("buildSubscriberGrowth30d handles empty dataset gracefully with 30 zero buckets", () => {
  const now = new Date("2026-11-25T10:00:00Z");
  const summary = buildSubscriberGrowth30d([], { now });

  assert.equal(summary.days, 30);
  assert.equal(summary.points.length, 30);
  assert.equal(summary.points[0].date, "2026-10-27");
  assert.equal(summary.points[29].date, "2026-11-25");
  assert.equal(summary.totalActive, 0);
  assert.equal(summary.previousBaseline, 0);
  assert.equal(summary.addedLast30d, 0);
  assert.equal(summary.growthRatePct, 0);
  assert.equal(summary.avgDaily, 0);
  assert.equal(summary.peakDay.count, 0);
});

test("buildSubscriberGrowth30d computes pre-window baseline, cumulative curve, locale split, and filters unsubscribed", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const records = [
    // Pre-window active subscribers (before 2026-10-27)
    { created_at: "2026-10-01 09:00:00", status: "subscribed", locale: "fa" },
    { created_at: "2026-10-15T14:30:00Z", status: "subscribed", locale: "en" },
    // Unsubscribed should be excluded
    { created_at: "2026-11-20 11:00:00", status: "unsubscribed", locale: "fa" },
    // In-window active subscribers
    { created_at: "2026-11-10 08:15:00", status: "subscribed", locale: "fa" },
    { created_at: "2026-11-24 10:00:00", status: "subscribed", locale: "fa" },
    { created_at: "2026-11-24 16:45:00", status: "subscribed", locale: "en" },
    { created_at: "2026-11-25 04:00:00", status: "subscribed", locale: "en" },
  ];

  const summary = buildSubscriberGrowth30d(records, { now });

  assert.equal(summary.previousBaseline, 2);
  assert.equal(summary.addedLast30d, 4);
  assert.equal(summary.totalActive, 6);
  assert.equal(summary.growthRatePct, 200);
  assert.equal(summary.avgDaily, 0.1);
  assert.equal(summary.peakDay.date, "2026-11-24");
  assert.equal(summary.peakDay.count, 2);

  // First day starts at baseline 2
  assert.equal(summary.points[0].cumulativeSubscribers, 2);

  const nov10 = summary.points.find((p) => p.date === "2026-11-10")!;
  assert.equal(nov10.newSubscribers, 1);
  assert.equal(nov10.faNew, 1);
  assert.equal(nov10.enNew, 0);
  assert.equal(nov10.cumulativeSubscribers, 3);

  const nov24 = summary.points.find((p) => p.date === "2026-11-24")!;
  assert.equal(nov24.newSubscribers, 2);
  assert.equal(nov24.faNew, 1);
  assert.equal(nov24.enNew, 1);
  assert.equal(nov24.cumulativeSubscribers, 5);

  const nov25 = summary.points[29];
  assert.equal(nov25.newSubscribers, 1);
  assert.equal(nov25.cumulativeSubscribers, 6);
});

test("buildSubscriberGrowth30d reconciles baseline with totalActiveOverride when DB exceeds fetched window", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const summary = buildSubscriberGrowth30d(
    [{ created_at: "2026-11-25 08:00:00", status: "subscribed", locale: "en" }],
    { now, totalActiveOverride: 51 }
  );

  assert.equal(summary.previousBaseline, 50);
  assert.equal(summary.addedLast30d, 1);
  assert.equal(summary.totalActive, 51);
  assert.equal(summary.growthRatePct, 2);
  assert.equal(summary.points[0].cumulativeSubscribers, 50);
  assert.equal(summary.points[29].cumulativeSubscribers, 51);
});

