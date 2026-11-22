import { cache } from "react";
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

const SITE_MODES_CACHE_TTL_MS = 5_000;

let cachedSiteModes: { value: SiteModesConfig; expiresAt: number } | null = null;

export function invalidateSiteModesCache(): void {
  cachedSiteModes = null;
}

/**
 * Loads the persisted site modes configuration from the `settings` table.
 * Uses a 5-second in-memory TTL cache + React per-request deduplication to avoid
 * repeated `settings` lookups across layout and page renders, and falls back
 * gracefully to defaults if the row does not exist yet.
 */
export const getSiteModes = cache(async (): Promise<SiteModesConfig> => {
  const now = Date.now();
  if (cachedSiteModes && cachedSiteModes.expiresAt > now) {
    return { ...cachedSiteModes.value };
  }

  try {
    const row = await queryOne<SettingRow>(
      "SELECT `value` FROM settings WHERE `key` = ? LIMIT 1",
      [SITE_MODES_SETTING_KEY]
    );
    const parsed = row?.value ? parseSiteModes(row.value) : { ...DEFAULT_SITE_MODES };
    cachedSiteModes = { value: parsed, expiresAt: now + SITE_MODES_CACHE_TTL_MS };
    return { ...parsed };
  } catch {
    return { ...DEFAULT_SITE_MODES };
  }
});

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
    const modes = parseSiteModes(row.value);
    cachedSiteModes = { value: modes, expiresAt: Date.now() + SITE_MODES_CACHE_TTL_MS };
    return {
      modes,
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
  invalidateSiteModesCache();
  return safe;
}
