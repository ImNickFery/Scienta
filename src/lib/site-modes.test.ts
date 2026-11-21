import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SITE_MODES,
  SITE_COLOR_SCHEMES,
  SITE_DESIGN_MODES,
  SITE_MODES_SETTING_KEY,
  SITE_THEMES,
  isColorScheme,
  isDesignMode,
  isSiteThemeId,
  isUnslopStyle,
  parseSiteModes,
  siteModesSchema,
} from "./site-modes";
import { SqliteFallbackDb } from "./sqlite-fallback";

test("SITE_DESIGN_MODES includes classic, unslop, and unslop-kinetic with bilingual labels and highlights", () => {
  const ids = SITE_DESIGN_MODES.map((m) => m.id);
  assert.deepEqual(ids, ["classic", "unslop", "unslop-kinetic"]);
  assert.equal(isUnslopStyle("classic"), false);
  assert.equal(isUnslopStyle("unslop"), true);
  assert.equal(isUnslopStyle("unslop-kinetic"), true);
  for (const mode of SITE_DESIGN_MODES) {
    assert.ok(mode.nameEn.length > 0);
    assert.ok(mode.nameFa.length > 0);
    assert.ok(mode.highlightsEn.length >= 3);
    assert.ok(mode.highlightsFa.length >= 3);
  }
});

test("SITE_COLOR_SCHEMES includes light and dark with bilingual labels", () => {
  const ids = SITE_COLOR_SCHEMES.map((c) => c.id);
  assert.deepEqual(ids, ["light", "dark"]);
  for (const scheme of SITE_COLOR_SCHEMES) {
    assert.ok(scheme.nameEn.length > 0);
    assert.ok(scheme.nameFa.length > 0);
    assert.ok(scheme.descriptionEn.length > 0);
    assert.ok(scheme.descriptionFa.length > 0);
  }
});

test("SITE_THEMES includes both aurora and emerald-blue palettes with bilingual labels and swatches", () => {
  const ids = SITE_THEMES.map((t) => t.id);
  assert.deepEqual(ids, ["aurora", "emerald-blue"]);
  for (const theme of SITE_THEMES) {
    assert.ok(theme.nameEn.length > 0);
    assert.ok(theme.nameFa.length > 0);
    assert.ok(theme.swatches.length >= 4);
    assert.ok(theme.preview.bgDeep.startsWith("#"));
  }
});

test("parseSiteModes safely normalizes invalid, legacy, partial, and valid configs", () => {
  assert.deepEqual(parseSiteModes(null), DEFAULT_SITE_MODES);
  assert.deepEqual(parseSiteModes("{invalid json"), DEFAULT_SITE_MODES);
  assert.deepEqual(
    parseSiteModes({
      designMode: "hacked-layout",
      colorScheme: "sepia",
      theme: "malicious-theme",
      ambientMode: "unknown",
      contrastMode: "high",
      applyToAdmin: "yes",
    }),
    {
      designMode: "classic",
      colorScheme: "dark",
      theme: "aurora",
      ambientMode: "cinematic",
      contrastMode: "high",
      applyToAdmin: true,
    }
  );

  // Legacy payloads saved before colorScheme existed infer "dark" for classic and "light" for unslop modes
  const legacyClassicJson = JSON.stringify({
    theme: "emerald-blue",
    ambientMode: "calm",
    contrastMode: "high",
    applyToAdmin: false,
  });
  assert.deepEqual(parseSiteModes(legacyClassicJson), {
    designMode: "classic",
    colorScheme: "dark",
    theme: "emerald-blue",
    ambientMode: "calm",
    contrastMode: "high",
    applyToAdmin: false,
  });

  const legacyUnslopJson = JSON.stringify({
    designMode: "unslop",
    theme: "aurora",
    ambientMode: "calm",
    contrastMode: "standard",
    applyToAdmin: true,
  });
  assert.deepEqual(parseSiteModes(legacyUnslopJson), {
    designMode: "unslop",
    colorScheme: "light",
    theme: "aurora",
    ambientMode: "calm",
    contrastMode: "standard",
    applyToAdmin: true,
  });

  // Explicit combinations work cleanly: unslop-kinetic + dark, classic + light
  assert.deepEqual(
    parseSiteModes({
      designMode: "unslop-kinetic",
      colorScheme: "dark",
      theme: "aurora",
      ambientMode: "calm",
      contrastMode: "standard",
      applyToAdmin: true,
    }),
    {
      designMode: "unslop-kinetic",
      colorScheme: "dark",
      theme: "aurora",
      ambientMode: "calm",
      contrastMode: "standard",
      applyToAdmin: true,
    }
  );
  assert.deepEqual(
    parseSiteModes({
      designMode: "classic",
      colorScheme: "light",
      theme: "emerald-blue",
      ambientMode: "cinematic",
      contrastMode: "standard",
      applyToAdmin: true,
    }),
    {
      designMode: "classic",
      colorScheme: "light",
      theme: "emerald-blue",
      ambientMode: "cinematic",
      contrastMode: "standard",
      applyToAdmin: true,
    }
  );
});

test("siteModesSchema validates allowlisted fields and rejects unknown themes, designModes, or colorSchemes", () => {
  assert.equal(isSiteThemeId("aurora"), true);
  assert.equal(isSiteThemeId("emerald-blue"), true);
  assert.equal(isSiteThemeId("neon-pink"), false);
  assert.equal(isDesignMode("classic"), true);
  assert.equal(isDesignMode("unslop"), true);
  assert.equal(isDesignMode("unslop-kinetic"), true);
  assert.equal(isDesignMode("retro-90s"), false);
  assert.equal(isColorScheme("light"), true);
  assert.equal(isColorScheme("dark"), true);
  assert.equal(isColorScheme("dim"), false);

  const ok = siteModesSchema.safeParse({
    designMode: "unslop-kinetic",
    colorScheme: "dark",
    theme: "emerald-blue",
    ambientMode: "cinematic",
    contrastMode: "standard",
    applyToAdmin: true,
  });
  assert.equal(ok.success, true);

  const badTheme = siteModesSchema.safeParse({
    designMode: "classic",
    colorScheme: "light",
    theme: "invalid",
    ambientMode: "cinematic",
    contrastMode: "standard",
    applyToAdmin: true,
  });
  assert.equal(badTheme.success, false);

  const badDesign = siteModesSchema.safeParse({
    designMode: "brutalist",
    colorScheme: "dark",
    theme: "aurora",
    ambientMode: "cinematic",
    contrastMode: "standard",
    applyToAdmin: true,
  });
  assert.equal(badDesign.success, false);

  const badScheme = siteModesSchema.safeParse({
    designMode: "unslop",
    colorScheme: "sepia",
    theme: "aurora",
    ambientMode: "cinematic",
    contrastMode: "standard",
    applyToAdmin: true,
  });
  assert.equal(badScheme.success, false);
});

test("site_modes roundtrips cleanly in SQLite settings table across classic/unslop and light/dark", () => {
  const db = new SqliteFallbackDb(":memory:");
  try {
    const payload = JSON.stringify({
      designMode: "unslop",
      colorScheme: "dark",
      theme: "emerald-blue",
      ambientMode: "calm",
      contrastMode: "high",
      applyToAdmin: true,
    });
    const upd = db.execute("UPDATE settings SET `value` = ?, updated_at = NOW() WHERE `key` = ?", [
      payload,
      SITE_MODES_SETTING_KEY,
    ]);
    assert.equal(upd.affectedRows, 0);

    db.execute("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", [
      SITE_MODES_SETTING_KEY,
      payload,
    ]);

    const rows = db.query<{ value: string }>(
      "SELECT `value` FROM settings WHERE `key` = ? LIMIT 1",
      [SITE_MODES_SETTING_KEY]
    );
    assert.equal(rows.length, 1);
    assert.deepEqual(parseSiteModes(rows[0].value), {
      designMode: "unslop",
      colorScheme: "dark",
      theme: "emerald-blue",
      ambientMode: "calm",
      contrastMode: "high",
      applyToAdmin: true,
    });

    const updatedPayload = JSON.stringify({
      designMode: "classic",
      colorScheme: "light",
      theme: "aurora",
      ambientMode: "cinematic",
      contrastMode: "standard",
      applyToAdmin: false,
    });
    const upd2 = db.execute("UPDATE settings SET `value` = ?, updated_at = NOW() WHERE `key` = ?", [
      updatedPayload,
      SITE_MODES_SETTING_KEY,
    ]);
    assert.equal(upd2.affectedRows, 1);

    const rows2 = db.query<{ value: string }>(
      "SELECT `value` FROM settings WHERE `key` = ? LIMIT 1",
      [SITE_MODES_SETTING_KEY]
    );
    assert.deepEqual(parseSiteModes(rows2[0].value), {
      designMode: "classic",
      colorScheme: "light",
      theme: "aurora",
      ambientMode: "cinematic",
      contrastMode: "standard",
      applyToAdmin: false,
    });
  } finally {
    db.close();
  }
});
