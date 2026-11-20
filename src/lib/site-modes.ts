import { z } from "zod";

export const SITE_THEME_IDS = ["aurora", "emerald-blue"] as const;
export type SiteThemeId = (typeof SITE_THEME_IDS)[number];

export const AMBIENT_MODES = ["cinematic", "calm"] as const;
export type AmbientMode = (typeof AMBIENT_MODES)[number];

export const CONTRAST_MODES = ["standard", "high"] as const;
export type ContrastMode = (typeof CONTRAST_MODES)[number];

export interface SiteModesConfig {
  theme: SiteThemeId;
  ambientMode: AmbientMode;
  contrastMode: ContrastMode;
  applyToAdmin: boolean;
}

export const SITE_MODES_SETTING_KEY = "site_modes";

export const DEFAULT_SITE_MODES: SiteModesConfig = {
  theme: "aurora",
  ambientMode: "cinematic",
  contrastMode: "standard",
  applyToAdmin: true,
};

export const siteModesSchema = z.object({
  theme: z.enum(SITE_THEME_IDS),
  ambientMode: z.enum(AMBIENT_MODES),
  contrastMode: z.enum(CONTRAST_MODES),
  applyToAdmin: z.boolean(),
});

export interface ThemeSwatch {
  labelEn: string;
  labelFa: string;
  hex: string;
}

export interface SiteThemeDefinition {
  id: SiteThemeId;
  nameEn: string;
  nameFa: string;
  taglineEn: string;
  taglineFa: string;
  descriptionEn: string;
  descriptionFa: string;
  swatches: ThemeSwatch[];
  preview: {
    bgDeep: string;
    bgSecondary: string;
    bgElevated: string;
    accentPrimary: string;
    accentSecondary: string;
    auroraThird: string;
    gradientStart: string;
    gradientMid: string;
    gradientEnd: string;
    textPrimary: string;
    textSecondary: string;
    borderSubtle: string;
  };
}

export const SITE_THEMES: readonly SiteThemeDefinition[] = [
  {
    id: "aurora",
    nameEn: "Cosmic Aurora",
    nameFa: "شفق کیهانی (پیش‌فرض)",
    taglineEn: "Deep Obsidian · Violet & Solar Orange",
    taglineFa: "ابسیدین تیره · بنفش و نارنجی خورشیدی",
    descriptionEn:
      "The signature Scienta palette with deep space obsidian surfaces, electric violet accents, and warm solar orange highlights.",
    descriptionFa:
      "تم اصلی و فعلی ساینتا با پس‌زمینه مشکی کیهانی، رنگ تاکیدی بنفش و هایلایت‌های گرم نارنجی.",
    swatches: [
      { labelEn: "Canvas", labelFa: "پس‌زمینه", hex: "#05050A" },
      { labelEn: "Surface", labelFa: "سطح کارت", hex: "#14141F" },
      { labelEn: "Primary", labelFa: "تاکید اصلی", hex: "#7B3FFB" },
      { labelEn: "Secondary", labelFa: "تاکید دوم", hex: "#FF7A00" },
      { labelEn: "Glow", labelFa: "هاله سوم", hex: "#FF3C5A" },
    ],
    preview: {
      bgDeep: "#05050a",
      bgSecondary: "#0d0d15",
      bgElevated: "#14141f",
      accentPrimary: "#7b3ffb",
      accentSecondary: "#ff7a00",
      auroraThird: "#ff3c5a",
      gradientStart: "#7b3ffb",
      gradientMid: "#ff7a00",
      gradientEnd: "#ff3c5a",
      textPrimary: "#f5f5fa",
      textSecondary: "#a8a8bd",
      borderSubtle: "rgba(255, 255, 255, 0.1)",
    },
  },
  {
    id: "emerald-blue",
    nameEn: "Deep Emerald & Ocean Blue",
    nameFa: "سبز و آبی تیره (اقیانوس و جنگل)",
    taglineEn: "Midnight Navy · Forest Emerald & Deep Sapphire",
    taglineFa: "آبی شبانه · سبز زمردی تیره و آبی اقیانوسی",
    descriptionEn:
      "A calm nocturnal palette pairing deep midnight blue canvases with dark emerald green surfaces and ocean sapphire highlights.",
    descriptionFa:
      "تم شبانه آرام و علمی با ترکیب پس‌زمینه آبی تیره عمیق، رنگ‌های سبز زمردی تیره و جلوه‌های آبی اقیانوسی.",
    swatches: [
      { labelEn: "Canvas", labelFa: "پس‌زمینه", hex: "#040B12" },
      { labelEn: "Surface", labelFa: "سطح کارت", hex: "#0B212C" },
      { labelEn: "Primary", labelFa: "سبز تیره", hex: "#158F69" },
      { labelEn: "Secondary", labelFa: "آبی تیره", hex: "#2B8FD6" },
      { labelEn: "Glow", labelFa: "فیروزه‌ای عمق", hex: "#0E6369" },
    ],
    preview: {
      bgDeep: "#040b12",
      bgSecondary: "#071620",
      bgElevated: "#0b212c",
      accentPrimary: "#158f69",
      accentSecondary: "#2b8fd6",
      auroraThird: "#0e6369",
      gradientStart: "#23b582",
      gradientMid: "#3498db",
      gradientEnd: "#168a78",
      textPrimary: "#edf7f5",
      textSecondary: "#9cb9c4",
      borderSubtle: "rgba(116, 198, 186, 0.16)",
    },
  },
] as const;

export function isSiteThemeId(value: unknown): value is SiteThemeId {
  return typeof value === "string" && (SITE_THEME_IDS as readonly string[]).includes(value);
}

/**
 * Safely parses a JSON string or unknown object from storage into a complete,
 * allowlist-validated `SiteModesConfig`, falling back field-by-field to defaults.
 */
export function parseSiteModes(raw: unknown): SiteModesConfig {
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      return { ...DEFAULT_SITE_MODES };
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }

  if (!obj) return { ...DEFAULT_SITE_MODES };

  const theme = isSiteThemeId(obj.theme) ? obj.theme : DEFAULT_SITE_MODES.theme;
  const ambientMode =
    typeof obj.ambientMode === "string" && (AMBIENT_MODES as readonly string[]).includes(obj.ambientMode)
      ? (obj.ambientMode as AmbientMode)
      : DEFAULT_SITE_MODES.ambientMode;
  const contrastMode =
    typeof obj.contrastMode === "string" && (CONTRAST_MODES as readonly string[]).includes(obj.contrastMode)
      ? (obj.contrastMode as ContrastMode)
      : DEFAULT_SITE_MODES.contrastMode;
  const applyToAdmin =
    typeof obj.applyToAdmin === "boolean" ? obj.applyToAdmin : DEFAULT_SITE_MODES.applyToAdmin;

  return { theme, ambientMode, contrastMode, applyToAdmin };
}
