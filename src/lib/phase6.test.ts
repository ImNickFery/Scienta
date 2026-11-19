import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFigureMdx,
  insertRawBlockAtSelection,
  insertSnippetAtSelection,
  MDX_SNIPPETS,
} from "./mdx-snippets";
import { buildSubscribersCsv, escapeCsvCell } from "./csv";
import {
  buildDailyTrend,
  computeFieldAnalytics,
  computePipelineShares,
} from "./admin-analytics";

test("MDX snippet insertion wraps selected text for inline formatting and math", () => {
  const res = insertSnippetAtSelection("Consider E = mc^2 in relativity.", 9, 17, "inline-math", "en");
  assert.equal(res.nextText, "Consider $E = mc^2$ in relativity.");
  assert.equal(res.nextText.slice(res.selectionStart, res.selectionEnd), "E = mc^2");

  const boldFa = insertSnippetAtSelection("سلام دنیا", 0, 4, "bold", "fa");
  assert.equal(boldFa.nextText, "**سلام** دنیا");
});

test("MDX snippet insertion injects locale-aware scientific blocks cleanly", () => {
  const enTheorem = insertSnippetAtSelection("Intro paragraph.", 16, 16, "theorem", "en");
  assert.ok(enTheorem.nextText.includes("<Theorem title=\"Theorem Title\">"));
  assert.ok(enTheorem.nextText.includes("<Proof>"));

  const faTheorem = insertSnippetAtSelection("مقدمه مقاله.", 12, 12, "theorem", "fa");
  assert.ok(faTheorem.nextText.includes('<Theorem label="قضیه"'));
  assert.ok(faTheorem.nextText.includes('<Proof label="برهان.">'));

  assert.ok(MDX_SNIPPETS.length >= 10);
});

test("buildFigureMdx escapes quotes and formats optional caption and aspect", () => {
  const basic = buildFigureMdx({
    src: "/uploads/nebula.webp",
    alt: 'NGC 3324 "Cosmic Cliffs"',
    caption: "JWST NIRCam infrared observation",
  });
  assert.equal(
    basic,
    '<Figure src="/uploads/nebula.webp" alt="NGC 3324 &quot;Cosmic Cliffs&quot;" caption="JWST NIRCam infrared observation" />'
  );

  const wide = buildFigureMdx({
    src: "/uploads/horizon.png",
    alt: "Event horizon",
    aspect: "wide",
  });
  assert.equal(wide, '<Figure src="/uploads/horizon.png" alt="Event horizon" aspect="wide" />');

  const inserted = insertRawBlockAtSelection("Line one.", 9, 9, wide);
  assert.equal(inserted.nextText, `Line one.\n\n${wide}\n`);
});

test("CSV escaping neutralizes formula injection and preserves RFC 4180 quoting", () => {
  assert.equal(escapeCsvCell("=SUM(A1:A5)"), "'=SUM(A1:A5)");
  assert.equal(escapeCsvCell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(escapeCsvCell("-2+3"), "'-2+3");
  assert.equal(escapeCsvCell("@hyper"), "'@hyper");
  assert.equal(escapeCsvCell('hello, "world"'), '"hello, ""world"""');

  const csv = buildSubscribersCsv([
    { email: "scientist@scienta.ir", locale: "fa", status: "subscribed", created_at: "2026-11-18 10:00:00" },
    { email: "=EVIL@test.com", locale: "en", status: "unsubscribed", created_at: "2026-11-17 09:30:00" },
  ]);
  assert.ok(csv.startsWith("\uFEFFemail,locale,status,subscribed_at\r\n"));
  assert.ok(csv.includes("scientist@scienta.ir,fa,subscribed,2026-11-18 10:00:00\r\n"));
  assert.ok(csv.includes("'=EVIL@test.com,en,unsubscribed,2026-11-17 09:30:00\r\n"));
});

test("buildDailyTrend groups SQLite and ISO timestamps into trailing daily buckets", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const series = buildDailyTrend(
    [
      "2026-11-18 08:15:00",
      "2026-11-18T11:30:00.000Z",
      "2026-11-16 22:00:00",
      "2025-01-01 00:00:00", // outside window
      null,
    ],
    7,
    now
  );

  assert.equal(series.length, 7);
  assert.equal(series[0].date, "2026-11-12");
  assert.equal(series[6].date, "2026-11-18");
  assert.equal(series[6].count, 2);
  assert.equal(series[4].date, "2026-11-16");
  assert.equal(series[4].count, 1);
  assert.equal(series.reduce((s, d) => s + d.count, 0), 3);
});

test("computeFieldAnalytics and computePipelineShares handle counts and zero totals", () => {
  const fields = computeFieldAnalytics([
    { name: "Physics", color: "#7B3FFB", count: 3, views: 750 },
    { name: "Astronomy", color: "#FF7A00", count: 1, views: 250 },
  ]);
  assert.equal(fields[0].articleShare, 75);
  assert.equal(fields[0].viewShare, 75);
  assert.equal(fields[1].articleShare, 25);
  assert.equal(fields[1].viewShare, 25);

  const empty = computePipelineShares({ published: 0, draft: 0, scheduled: 0 });
  assert.deepEqual(empty, { publishedPct: 0, draftPct: 0, scheduledPct: 0 });

  const shares = computePipelineShares({ published: 3, draft: 1, scheduled: 1 });
  assert.equal(shares.publishedPct + shares.draftPct + shares.scheduledPct, 100);
  assert.equal(shares.publishedPct, 60);
});
