import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeArticleSpecimen,
  buildSpecimenCode,
  computeArchiveStats,
  computeReadingTelemetry,
  countFigures,
  countInlineEquations,
  countProseWords,
  extractDisplayEquations,
  filterAndSortArchiveArticles,
  type ArchiveFilterableArticle,
} from "./article-telemetry";

const SAMPLE_MDX = `
## هندسه فضا-زمان

نسبیت عام انیشتین گرانش را به عنوان انحنای فضا-زمان توصیف می‌کند و انرژی هر فوتون برابر $E = h\\nu$ است.

$$
G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}
$$

برای یک جرم کروی بدون چرخش، شعاع شوارتزشیلد با $r_s$ نمایش داده می‌شود:

$$r_s = \\frac{2GM}{c^2}$$

\`\`\`latex
$$ \\text{not an equation inside code fence} $$
\`\`\`

![افق رویداد سیاهچاله](/images/black-hole.jpg)
<Figure caption="نمودار انحنا" />

### پیامدهای رصدی

تلسکوپ افق رویداد حلقه فوتونی را در فاصله $1.5 r_s$ آشکارسازی کرد.
`;

describe("article-telemetry extraction", () => {
  it("extracts display equations in exact order and skips code fences", () => {
    const eqs = extractDisplayEquations(SAMPLE_MDX);
    assert.equal(eqs.length, 2);
    assert.equal(eqs[0].index, 1);
    assert.equal(eqs[0].id, "eq-1");
    assert.match(eqs[0].compactLatex, /G_\{\\mu\\nu\}/);
    assert.equal(eqs[1].index, 2);
    assert.equal(eqs[1].id, "eq-2");
    assert.equal(eqs[1].compactLatex, "r_s = \\frac{2GM}{c^2}");
  });

  it("counts inline equations accurately without double-counting display blocks", () => {
    const inlineCount = countInlineEquations(SAMPLE_MDX);
    assert.equal(inlineCount, 3);
  });

  it("counts markdown images and JSX figures accurately", () => {
    assert.equal(countFigures(SAMPLE_MDX), 2);
  });

  it("counts Persian and English prose words while excluding math and code fences", () => {
    const count = countProseWords(SAMPLE_MDX);
    assert.ok(count >= 30 && count <= 55, `Expected ~42 words, got ${count}`);
  });

  it("builds deterministic archival specimen codes", () => {
    const codeA = buildSpecimenCode("astronomy", "geometry-of-black-holes", "2026-02-14");
    const codeB = buildSpecimenCode("astronomy", "geometry-of-black-holes", "2026-02-14");
    const codeC = buildSpecimenCode("quantum", "quantum-entanglement", "2025-11-01");
    assert.equal(codeA, codeB);
    assert.match(codeA, /^SCI-AST-26[0-9A-F]{2}$/);
    assert.match(codeC, /^SCI-QNT-25[0-9A-F]{2}$/);
  });

  it("analyzes full specimen including reading time with equations & figures", () => {
    const analysis = analyzeArticleSpecimen(SAMPLE_MDX, "fa", {
      field: "astronomy",
      slug: "geometry-of-black-holes",
      publishedAt: "2026-02-14",
    });
    assert.equal(analysis.displayEquationCount, 2);
    assert.equal(analysis.inlineEquationCount, 3);
    assert.equal(analysis.figureCount, 2);
    assert.equal(analysis.sectionCount, 2);
    assert.ok(analysis.exactReadingMinutes >= 1);
    assert.ok(analysis.exactReadingSeconds >= 60);
    assert.match(analysis.specimenCode, /^SCI-AST-26[0-9A-F]{2}$/);
  });
});

describe("computeReadingTelemetry", () => {
  it("clamps negative and overflow progress values safely", () => {
    const start = computeReadingTelemetry(-0.4, 1200, 6);
    assert.equal(start.percent, 0);
    assert.equal(start.wordsRead, 0);
    assert.equal(start.remainingMinutes, 6);
    assert.equal(start.isComplete, false);

    const mid = computeReadingTelemetry(0.5, 1200, 6);
    assert.equal(mid.percent, 50);
    assert.equal(mid.wordsRead, 600);
    assert.equal(mid.wordsRemaining, 600);
    assert.equal(mid.remainingMinutes, 3);
    assert.equal(mid.isComplete, false);

    const end = computeReadingTelemetry(0.98, 1200, 6);
    assert.equal(end.percent, 98);
    assert.equal(end.wordsRead, 1200);
    assert.equal(end.wordsRemaining, 0);
    assert.equal(end.remainingMinutes, 0);
    assert.equal(end.isComplete, true);
  });
});

describe("filterAndSortArchiveArticles & computeArchiveStats", () => {
  const sampleArticles: ArchiveFilterableArticle[] = [
    {
      slug: "black-holes",
      title: "هندسه سیاهچاله‌ها",
      excerpt: "نسبیت عام و افق رویداد",
      field: "astronomy",
      fieldLabel: "نجوم",
      authorName: "دکتر سارا نادری",
      tags: ["گرانش", "نسبیت"],
      readingTimeMinutes: 6,
      views: 4200,
      publishedAt: "2026-03-01",
    },
    {
      slug: "double-slit",
      title: "آزمایش دو شکاف یانگ",
      excerpt: "تداخل موجی نور و کوانتوم",
      field: "quantum",
      fieldLabel: "کوانتوم",
      authorName: "دکتر آرمان رضایی",
      tags: ["اپتیک", "کوانتوم"],
      readingTimeMinutes: 3,
      views: 9100,
      publishedAt: "2026-01-15",
    },
    {
      slug: "jwst-deep-field",
      title: "میدان عمیق جیمز وب",
      excerpt: "کهکشان‌های نخستین کیهان",
      field: "space",
      fieldLabel: "فضا",
      authorName: "دکتر سارا نادری",
      tags: ["کیهان‌شناسی"],
      readingTimeMinutes: 2,
      views: 1800,
      publishedAt: "2026-04-10",
    },
  ];

  it("filters by field, reading depth, and query across title/tags/author", () => {
    assert.equal(
      filterAndSortArchiveArticles(sampleArticles, { depth: "quick" }).length,
      2
    );
    assert.equal(
      filterAndSortArchiveArticles(sampleArticles, { depth: "deep" }).map((a) => a.slug)[0],
      "black-holes"
    );
    assert.equal(
      filterAndSortArchiveArticles(sampleArticles, { query: "گرانش" }).map((a) => a.slug)[0],
      "black-holes"
    );
    assert.equal(
      filterAndSortArchiveArticles(sampleArticles, { query: "سارا نادری" }).length,
      2
    );
  });

  it("sorts deterministically by latest, views, quickest, and longest", () => {
    assert.deepEqual(
      filterAndSortArchiveArticles(sampleArticles, { sort: "latest" }).map((a) => a.slug),
      ["jwst-deep-field", "black-holes", "double-slit"]
    );
    assert.deepEqual(
      filterAndSortArchiveArticles(sampleArticles, { sort: "views" }).map((a) => a.slug),
      ["double-slit", "black-holes", "jwst-deep-field"]
    );
    assert.deepEqual(
      filterAndSortArchiveArticles(sampleArticles, { sort: "quickest" }).map((a) => a.slug),
      ["jwst-deep-field", "double-slit", "black-holes"]
    );
    assert.deepEqual(
      filterAndSortArchiveArticles(sampleArticles, { sort: "longest" }).map((a) => a.slug),
      ["black-holes", "double-slit", "jwst-deep-field"]
    );
  });

  it("computes aggregate archive stats accurately", () => {
    const stats = computeArchiveStats(sampleArticles);
    assert.equal(stats.totalArticles, 3);
    assert.equal(stats.totalViews, 15100);
    assert.equal(stats.totalReadingMinutes, 11);
    assert.equal(stats.avgReadingMinutes, 3.7);
    assert.equal(stats.fieldCounts.astronomy, 1);
    assert.equal(stats.fieldCounts.quantum, 1);
    assert.equal(stats.fieldCounts.space, 1);
  });
});
