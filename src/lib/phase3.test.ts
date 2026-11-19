import test from "node:test";
import assert from "node:assert/strict";
import { buildAllCitations, buildCitationKey, escapeBibtex } from "./citations";
import { buildRssFeed, escapeXml } from "./rss";
import { removeEquationMeta, upsertEquationMeta, type SavedEquationRecord } from "./equation-bookmarks";
import type { Article } from "@/types";

test("buildCitationKey produces deterministic ASCII keys for Latin and Persian names", () => {
  assert.equal(
    buildCitationKey("Dr. Elham Rostami", 2026, "geometry-of-black-holes"),
    "rostami2026geometry"
  );
  assert.equal(
    buildCitationKey("الهام رستمی", 2026, "geometry-of-black-holes"),
    "scienta2026geometry"
  );
});

test("escapeBibtex and buildAllCitations generate valid BibTeX, APA, and IEEE formats", () => {
  assert.equal(escapeBibtex("E = mc^2 & 100% #1"), "E = mc^2 \\& 100\\% \\#1");

  const cited = buildAllCitations({
    title: "The Geometry of Black Holes: 100% Curvature & Gravity",
    authorName: "Dr. Elham Rostami",
    publishedAt: "2026-05-12T00:00:00Z",
    url: "https://scienta.ir/en/articles/geometry-of-black-holes",
    slug: "geometry-of-black-holes",
    locale: "en",
  });

  assert.equal(cited.key, "rostami2026geometry");
  assert.match(cited.bibtex, /@article\{rostami2026geometry,/);
  assert.match(cited.bibtex, /100\\% Curvature \\& Gravity/);
  assert.match(cited.bibtex, /journal\s*=\s*\{Scienta\}/);
  assert.match(cited.apa, /Dr\. Elham Rostami \(2026, May 12\)\./);
  assert.match(cited.ieee, /\[Online\]\. Available: https:\/\/scienta\.ir\/en\/articles\/geometry-of-black-holes/);
});

test("escapeXml and buildRssFeed produce safe, well-formed bilingual RSS 2.0 XML", () => {
  assert.equal(escapeXml(`A & B < "C" > 'D'\u0000`), "A &amp; B &lt; &quot;C&quot; &gt; &apos;D&apos;");

  const sample: Article = {
    id: "art-1",
    slug: "geometry-of-black-holes",
    title: "هندسه سیاه‌چاله‌ها <نسبیت & فضا>",
    excerpt: "بررسی افق رویداد & متریک شوارتزشیلد.",
    publishedAt: "2026-05-12T00:00:00Z",
    field: "astronomy",
    fieldColor: "#FF7A00",
    category: "deep-dive",
    tags: ["نسبیت عام", "black-holes"],
    authorSlug: "elham-rostami",
    authorName: "الهام رستمی",
    views: 18400,
    readingTimeMinutes: 8,
    content: "",
  };

  const xml = buildRssFeed({ locale: "fa", articles: [sample], siteUrl: "https://scienta.ir" });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<language>fa-IR<\/language>/);
  assert.match(xml, /href="https:\/\/scienta\.ir\/fa\/rss\.xml"/);
  assert.match(xml, /<title>هندسه سیاه‌چاله‌ها &lt;نسبیت &amp; فضا&gt;<\/title>/);
  assert.match(xml, /<dc:creator>الهام رستمی<\/dc:creator>/);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/scienta\.ir\/fa\/articles\/geometry-of-black-holes<\/guid>/);
});

test("upsertEquationMeta and removeEquationMeta manage saved equation records cleanly", () => {
  const eq1: SavedEquationRecord = {
    key: "black-holes:eq-1",
    articleSlug: "black-holes",
    articleTitle: "Black Holes",
    equationId: "eq-1",
    index: 1,
    latex: "r_s = \\frac{2GM}{c^2}",
    savedAt: "2026-05-12T00:00:00Z",
  };
  const eq2: SavedEquationRecord = {
    ...eq1,
    key: "black-holes:eq-2",
    equationId: "eq-2",
    index: 2,
    latex: "E = mc^2",
  };

  const added = upsertEquationMeta([eq1], eq2);
  assert.equal(added.length, 2);
  assert.equal(added[0].key, "black-holes:eq-2");

  const updated = upsertEquationMeta(added, { ...eq1, latex: "R_s = 2GM/c^2" });
  assert.equal(updated.length, 2);
  assert.equal(updated[0].latex, "R_s = 2GM/c^2");

  const removed = removeEquationMeta(updated, "black-holes:eq-2");
  assert.deepEqual(
    removed.map((r) => r.key),
    ["black-holes:eq-1"]
  );
});
