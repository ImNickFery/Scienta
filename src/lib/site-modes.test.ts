import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SITE_MODES,
  SITE_MODES_SETTING_KEY,
  SITE_THEMES,
  isSiteThemeId,
  parseSiteModes,
  siteModesSchema,
} from "./site-modes";
import { SqliteFallbackDb } from "./sqlite-fallback";

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

test("parseSiteModes safely normalizes invalid, partial, and valid configs", () => {
  assert.deepEqual(parseSiteModes(null), DEFAULT_SITE_MODES);
  assert.deepEqual(parseSiteModes("{invalid json"), DEFAULT_SITE_MODES);
  assert.deepEqual(
    parseSiteModes({
      theme: "malicious-theme",
      ambientMode: "unknown",
      contrastMode: "high",
      applyToAdmin: "yes",
    }),
    {
      theme: "aurora",
      ambientMode: "cinematic",
      contrastMode: "high",
      applyToAdmin: true,
    }
  );

  const validJson = JSON.stringify({
    theme: "emerald-blue",
    ambientMode: "calm",
    contrastMode: "high",
    applyToAdmin: false,
  });
  assert.deepEqual(parseSiteModes(validJson), {
    theme: "emerald-blue",
    ambientMode: "calm",
    contrastMode: "high",
    applyToAdmin: false,
  });
});

test("siteModesSchema validates allowlisted fields and rejects unknown themes", () => {
  assert.equal(isSiteThemeId("aurora"), true);
  assert.equal(isSiteThemeId("emerald-blue"), true);
  assert.equal(isSiteThemeId("neon-pink"), false);

  const ok = siteModesSchema.safeParse({
    theme: "emerald-blue",
    ambientMode: "cinematic",
    contrastMode: "standard",
    applyToAdmin: true,
  });
  assert.equal(ok.success, true);

  const bad = siteModesSchema.safeParse({
    theme: "invalid",
    ambientMode: "cinematic",
    contrastMode: "standard",
    applyToAdmin: true,
  });
  assert.equal(bad.success, false);
});

test("site_modes roundtrips cleanly in SQLite settings table", () => {
  const db = new SqliteFallbackDb(":memory:");
  try {
    const payload = JSON.stringify({
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
      theme: "emerald-blue",
      ambientMode: "calm",
      contrastMode: "high",
      applyToAdmin: true,
    });

    const updatedPayload = JSON.stringify({
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
      theme: "aurora",
      ambientMode: "cinematic",
      contrastMode: "standard",
      applyToAdmin: false,
    });
  } finally {
    db.close();
  }
});
