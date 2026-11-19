import type { Locale } from "./i18n/config";

export const FONT_SCALES = [0.85, 1, 1.15, 1.3, 1.45] as const;
export const DEFAULT_FONT_INDEX = 1; // 100%

export const WIDTH_PRESETS = ["narrow", "standard", "wide"] as const;
export type ReadingWidthPreset = (typeof WIDTH_PRESETS)[number];

export const WIDTH_CSS_VALUES: Record<ReadingWidthPreset, string> = {
  narrow: "34rem",
  standard: "46rem",
  wide: "64rem",
};

export interface StoredReadingPreferences {
  fontIndex: number;
  width: ReadingWidthPreset;
}

export const DEFAULT_READING_PREFS: StoredReadingPreferences = {
  fontIndex: DEFAULT_FONT_INDEX,
  width: "standard",
};

export const READING_PREFS_STORAGE_KEY = "scienta_reading_prefs";
export const READING_PREFS_EVENT = "scienta:reading-prefs-changed";

export function clampFontIndex(index: number): number {
  if (!Number.isFinite(index)) return DEFAULT_FONT_INDEX;
  const rounded = Math.round(index);
  return Math.max(0, Math.min(FONT_SCALES.length - 1, rounded));
}

export function isReadingWidthPreset(value: unknown): value is ReadingWidthPreset {
  return typeof value === "string" && (WIDTH_PRESETS as readonly string[]).includes(value);
}

export function parseStoredReadingPrefs(raw: string | null): StoredReadingPreferences {
  if (!raw) return DEFAULT_READING_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredReadingPreferences>;
    return {
      fontIndex:
        typeof parsed.fontIndex === "number" ? clampFontIndex(parsed.fontIndex) : DEFAULT_FONT_INDEX,
      width: isReadingWidthPreset(parsed.width) ? parsed.width : "standard",
    };
  } catch {
    return DEFAULT_READING_PREFS;
  }
}

export function serializeReadingPrefs(prefs: StoredReadingPreferences): string {
  return JSON.stringify({
    fontIndex: clampFontIndex(prefs.fontIndex),
    width: isReadingWidthPreset(prefs.width) ? prefs.width : "standard",
  });
}

export function getFontScale(fontIndex: number): number {
  return FONT_SCALES[clampFontIndex(fontIndex)];
}

export function formatFontPercent(fontIndex: number, locale: Locale): string {
  const pct = Math.round(getFontScale(fontIndex) * 100);
  if (locale === "fa") {
    const faDigits = String(pct).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
    return `${faDigits}٪`;
  }
  return `${pct}%`;
}

export function isDefaultReadingPrefs(prefs: StoredReadingPreferences): boolean {
  return prefs.fontIndex === DEFAULT_FONT_INDEX && prefs.width === "standard";
}
