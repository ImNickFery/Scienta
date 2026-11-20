import test from "node:test";
import assert from "node:assert/strict";
import {
  computeHorizonRadius,
  extractQueryHintFromPath,
  formatMissingPath,
  resolveLocaleFromPathname,
} from "./not-found";

test("resolveLocaleFromPathname detects /en and /fa prefixes and falls back to fa", () => {
  assert.equal(resolveLocaleFromPathname("/en/articles/missing"), "en");
  assert.equal(resolveLocaleFromPathname("/en"), "en");
  assert.equal(resolveLocaleFromPathname("/fa/articles/missing"), "fa");
  assert.equal(resolveLocaleFromPathname("/unknown/path"), "fa");
  assert.equal(resolveLocaleFromPathname(null), "fa");
});

test("formatMissingPath decodes Persian slugs safely and handles malformed percent sequences", () => {
  assert.equal(
    formatMissingPath("/fa/articles/%D9%81%DB%8C%D8%B2%DB%8C%DA%A9"),
    "/fa/articles/فیزیک"
  );
  assert.equal(formatMissingPath("/en/%E0%A4%A"), "/en/%E0%A4%A");
  assert.equal(formatMissingPath("/"), null);
  assert.equal(formatMissingPath("   "), null);

  const longPath = `/en/articles/${"a".repeat(120)}`;
  const truncated = formatMissingPath(longPath, 30);
  assert.ok(truncated && truncated.length === 30 && truncated.endsWith("…"));
});

test("extractQueryHintFromPath extracts meaningful English and Persian search terms", () => {
  assert.equal(extractQueryHintFromPath("/en/articles/quantum-gravity-intro"), "quantum gravity intro");
  assert.equal(
    extractQueryHintFromPath("/fa/articles/%D9%86%D8%B8%D8%B1%DB%8C%D9%87-%DA%A9%D9%88%D8%A7%D9%86%D8%AA%D9%88%D9%85"),
    "نظریه کوانتوم"
  );
  assert.equal(extractQueryHintFromPath("/en/articles"), "");
  assert.equal(extractQueryHintFromPath("/fa/12345"), "");
  assert.equal(extractQueryHintFromPath("/en/missing-page.html"), "missing page");
});

test("computeHorizonRadius reports accurate Schwarzschild ratio and event-horizon boundary", () => {
  assert.deepEqual(computeHorizonRadius(0, 0, 56), { ratio: 0, insideHorizon: true });
  assert.deepEqual(computeHorizonRadius(56, 0, 56), { ratio: 1, insideHorizon: true });
  assert.deepEqual(computeHorizonRadius(84, 0, 56), { ratio: 1.5, insideHorizon: false });
  assert.deepEqual(computeHorizonRadius(0, -168, 56), { ratio: 3, insideHorizon: false });
});
