import { execute, queryOne } from "./db";
import {
  DEFAULT_SITE_MODES,
  SITE_MODES_SETTING_KEY,
  parseSiteModes,
  type SiteModesConfig,
} from "./site-modes";

interface SettingRow {
  value: string | null;
  updated_at?: string | null;
}

/**
 * Loads the persisted site modes configuration from the `settings` table.
 * Falls back gracefully to defaults if the row does not exist yet.
 */
export async function getSiteModes(): Promise<SiteModesConfig> {
  try {
    const row = await queryOne<SettingRow>(
      "SELECT `value` FROM settings WHERE `key` = ? LIMIT 1",
      [SITE_MODES_SETTING_KEY]
    );
    if (!row?.value) return { ...DEFAULT_SITE_MODES };
    return parseSiteModes(row.value);
  } catch {
    return { ...DEFAULT_SITE_MODES };
  }
}

export async function getSiteModesWithMeta(): Promise<{
  modes: SiteModesConfig;
  updatedAt: string | null;
}> {
  try {
    const row = await queryOne<SettingRow>(
      "SELECT `value`, updated_at FROM settings WHERE `key` = ? LIMIT 1",
      [SITE_MODES_SETTING_KEY]
    );
    if (!row?.value) {
      return { modes: { ...DEFAULT_SITE_MODES }, updatedAt: null };
    }
    return {
      modes: parseSiteModes(row.value),
      updatedAt: row.updated_at ?? null,
    };
  } catch {
    return { modes: { ...DEFAULT_SITE_MODES }, updatedAt: null };
  }
}

/**
 * Persists a validated `SiteModesConfig` in the `settings` table using
 * dialect-neutral UPDATE-then-INSERT so both MySQL and SQLite behave identically.
 */
export async function saveSiteModes(config: SiteModesConfig): Promise<SiteModesConfig> {
  const safe = parseSiteModes(config);
  const serialized = JSON.stringify(safe);
  const updated = await execute(
    "UPDATE settings SET `value` = ?, updated_at = NOW() WHERE `key` = ?",
    [serialized, SITE_MODES_SETTING_KEY]
  );
  if (!updated.affectedRows) {
    await execute(
      "INSERT INTO settings (`key`, `value`) VALUES (?, ?)",
      [SITE_MODES_SETTING_KEY, serialized]
    );
  }
  return safe;
}
