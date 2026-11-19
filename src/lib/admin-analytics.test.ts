import test from "node:test";
import assert from "node:assert/strict";
import {
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
