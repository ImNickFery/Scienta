import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDonutSegments,
  buildHeatmapGrid,
  clampProWindowDays,
  computeMovingAverage,
  computePeriodDelta,
  computeSeoChecklist,
  detectDeviceType,
  estimateArticleWords,
  parseReferrerHost,
  serializeAnalyticsCsv,
} from "./admin-analytics-pro";

test("clampProWindowDays restricts window strictly to 7, 14, 30, or 90", () => {
  assert.equal(clampProWindowDays("7"), 7);
  assert.equal(clampProWindowDays("14"), 14);
  assert.equal(clampProWindowDays("30"), 30);
  assert.equal(clampProWindowDays("90"), 90);
  assert.equal(clampProWindowDays("999"), 30);
  assert.equal(clampProWindowDays(null), 30);
});

test("computePeriodDelta calculates growth percentages and handles zero baselines safely", () => {
  assert.deepEqual(computePeriodDelta(150, 100), {
    current: 150,
    previous: 100,
    deltaPct: 50,
    direction: "up",
  });
  assert.deepEqual(computePeriodDelta(80, 100), {
    current: 80,
    previous: 100,
    deltaPct: -20,
    direction: "down",
  });
  assert.deepEqual(computePeriodDelta(0, 0), {
    current: 0,
    previous: 0,
    deltaPct: 0,
    direction: "flat",
  });
  assert.deepEqual(computePeriodDelta(12, 0), {
    current: 12,
    previous: 0,
    deltaPct: null,
    direction: "up",
  });
});

test("computeMovingAverage produces trailing window averages", () => {
  const ma = computeMovingAverage(
    [
      { date: "2026-11-01", label: "Nov 1", count: 2 },
      { date: "2026-11-02", label: "Nov 2", count: 4 },
      { date: "2026-11-03", label: "Nov 3", count: 6 },
      { date: "2026-11-04", label: "Nov 4", count: 8 },
    ],
    2
  );
  assert.deepEqual(
    ma.map((p) => p.value),
    [2, 3, 5, 7]
  );
});

test("computeSeoChecklist audits concrete database fields without fabricated scores", () => {
  const full = computeSeoChecklist({
    seoTitle: "Hidden Symmetries of the Standard Model",
    seoDescription: "A deep mathematical exploration of spontaneous symmetry breaking and the Higgs field.",
    hasCover: true,
    excerpt: "How gauge symmetries unify nature's fundamental forces.",
    isBilingual: true,
  });
  assert.equal(full.passed, 5);
  assert.deepEqual(full.missing, []);

  const partial = computeSeoChecklist({
    seoTitle: "Short",
    seoDescription: null,
    hasCover: false,
    excerpt: "Too short",
    isBilingual: false,
  });
  assert.equal(partial.passed, 0);
  assert.deepEqual(partial.missing, ["seo_title", "seo_description", "cover", "excerpt", "bilingual"]);
});

test("estimateArticleWords strips code fences and display LaTeX while counting Persian & English words", () => {
  const mdx = `
# عنوان مقاله

$$r_s = \\frac{2GM}{c^2}$$

\`\`\`ts
const ignored = "code block should not be counted";
\`\`\`

این یک متن علمی با هشت کلمه است.
`;
  assert.equal(estimateArticleWords(mdx), 10);
});

test("buildHeatmapGrid buckets timestamps into an N-week calendar matrix", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const grid = buildHeatmapGrid(
    [
      "2026-11-20T08:00:00Z",
      "2026-11-20T09:00:00Z",
      "2026-11-20T10:00:00Z",
      "2026-11-20T11:00:00Z",
      "2026-11-19 14:30:00",
    ],
    12,
    now
  );
  assert.equal(grid.cells.length, 84);
  assert.equal(grid.total, 5);
  assert.equal(grid.peak, 4);
  assert.equal(grid.activeDays, 2);
  assert.equal(grid.cells[83].date, "2026-11-20");
  assert.equal(grid.cells[83].level, 4);
  assert.equal(grid.cells[82].level, 2);
});

test("buildDonutSegments computes proportional SVG ring dash lengths", () => {
  const donut = buildDonutSegments(
    [
      { id: "fa", label: "Persian", value: 75, color: "#7b3ffb" },
      { id: "en", label: "English", value: 25, color: "#ff7a00" },
    ],
    44
  );
  assert.equal(donut.total, 100);
  assert.equal(donut.segments[0].pct, 75);
  assert.equal(donut.segments[1].pct, 25);
  assert.ok(donut.segments[1].dashOffset < 0);
});

test("parseReferrerHost and detectDeviceType classify sources cleanly", () => {
  assert.equal(parseReferrerHost("https://www.google.com/search?q=scienta", "scienta.ir"), "google.com");
  assert.equal(parseReferrerHost("https://scienta.ir/en/articles", "scienta.ir"), "Direct");
  assert.equal(parseReferrerHost("", "scienta.ir"), "Direct");

  assert.equal(detectDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile"), "mobile");
  assert.equal(detectDeviceType("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
  assert.equal(detectDeviceType("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "desktop");
});

test("serializeAnalyticsCsv escapes quotes and neutralizes spreadsheet formula injection", () => {
  const csv = serializeAnalyticsCsv([
    {
      slug: "test-slug",
      titleEn: '=CMD("evil")',
      titleFa: 'عنوان "ویژه"',
      field: "Physics",
      author: "Dr. Sara",
      status: "published",
      views: 1200,
      comments: 4,
      words: 980,
      bilingual: true,
      seoPassed: 5,
      seoTotal: 5,
      publishedAt: "2026-11-20",
    },
  ]);
  assert.ok(csv.includes(`"'=CMD(""evil"")"`));
  assert.ok(csv.includes(`"عنوان ""ویژه"""`));
});
