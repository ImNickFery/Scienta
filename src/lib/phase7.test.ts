import test from "node:test";
import assert from "node:assert/strict";
import {
  clampFontIndex,
  DEFAULT_READING_PREFS,
  FONT_SCALES,
  formatFontPercent,
  getFontScale,
  isDefaultReadingPrefs,
  parseStoredReadingPrefs,
  serializeReadingPrefs,
  WIDTH_CSS_VALUES,
} from "./reading-preferences";

test("clampFontIndex keeps font indices inside valid bounds", () => {
  assert.equal(clampFontIndex(-5), 0);
  assert.equal(clampFontIndex(0), 0);
  assert.equal(clampFontIndex(2), 2);
  assert.equal(clampFontIndex(99), FONT_SCALES.length - 1);
  assert.equal(clampFontIndex(Number.NaN), DEFAULT_READING_PREFS.fontIndex);
});

test("parseStoredReadingPrefs handles valid, partial, out-of-range, and corrupt JSON safely", () => {
  assert.deepEqual(parseStoredReadingPrefs(null), DEFAULT_READING_PREFS);
  assert.deepEqual(parseStoredReadingPrefs("{not-json"), DEFAULT_READING_PREFS);

  const valid = parseStoredReadingPrefs(JSON.stringify({ fontIndex: 3, width: "wide" }));
  assert.deepEqual(valid, { fontIndex: 3, width: "wide" });

  const clamped = parseStoredReadingPrefs(JSON.stringify({ fontIndex: 42, width: "invalid" }));
  assert.deepEqual(clamped, { fontIndex: FONT_SCALES.length - 1, width: "standard" });

  const roundTrip = parseStoredReadingPrefs(serializeReadingPrefs({ fontIndex: 0, width: "narrow" }));
  assert.deepEqual(roundTrip, { fontIndex: 0, width: "narrow" });
});

test("formatFontPercent formats Persian and English reading scales accurately", () => {
  assert.equal(getFontScale(1), 1);
  assert.equal(formatFontPercent(0, "en"), "85%");
  assert.equal(formatFontPercent(1, "en"), "100%");
  assert.equal(formatFontPercent(4, "en"), "145%");
  assert.equal(formatFontPercent(1, "fa"), "۱۰۰٪");
  assert.equal(formatFontPercent(3, "fa"), "۱۳۰٪");
});

test("width presets are ordered monotonically and default detection works", () => {
  const parseRem = (v: string) => Number.parseFloat(v.replace("rem", ""));
  assert.ok(parseRem(WIDTH_CSS_VALUES.narrow) < parseRem(WIDTH_CSS_VALUES.standard));
  assert.ok(parseRem(WIDTH_CSS_VALUES.standard) < parseRem(WIDTH_CSS_VALUES.wide));

  assert.equal(isDefaultReadingPrefs(DEFAULT_READING_PREFS), true);
  assert.equal(isDefaultReadingPrefs({ fontIndex: 2, width: "standard" }), false);
  assert.equal(isDefaultReadingPrefs({ fontIndex: 1, width: "wide" }), false);
});
