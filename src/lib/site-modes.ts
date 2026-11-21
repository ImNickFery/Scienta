import { z } from "zod";

export const SITE_THEME_IDS = ["aurora", "emerald-blue"] as const;
export type SiteThemeId = (typeof SITE_THEME_IDS)[number];

export const DESIGN_MODES = ["classic", "unslop", "unslop-kinetic"] as const;
export type DesignMode = (typeof DESIGN_MODES)[number];

export const COLOR_SCHEMES = ["light", "dark"] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

export const AMBIENT_MODES = ["cinematic", "calm"] as const;
export type AmbientMode = (typeof AMBIENT_MODES)[number];

export const CONTRAST_MODES = ["standard", "high"] as const;
export type ContrastMode = (typeof CONTRAST_MODES)[number];

export interface SiteModesConfig {
  designMode: DesignMode;
  colorScheme: ColorScheme;
  theme: SiteThemeId;
  ambientMode: AmbientMode;
  contrastMode: ContrastMode;
  applyToAdmin: boolean;
}

export const SITE_MODES_SETTING_KEY = "site_modes";

export const DEFAULT_SITE_MODES: SiteModesConfig = {
  designMode: "classic",
  colorScheme: "dark",
  theme: "aurora",
  ambientMode: "cinematic",
  contrastMode: "standard",
  applyToAdmin: true,
};

export const siteModesSchema = z.object({
  designMode: z.enum(DESIGN_MODES).default("classic"),
  colorScheme: z.enum(COLOR_SCHEMES).default("dark"),
  theme: z.enum(SITE_THEME_IDS),
  ambientMode: z.enum(AMBIENT_MODES),
  contrastMode: z.enum(CONTRAST_MODES),
  applyToAdmin: z.boolean(),
});

export interface SiteColorSchemeDefinition {
  id: ColorScheme;
  nameEn: string;
  nameFa: string;
  taglineEn: string;
  taglineFa: string;
  descriptionEn: string;
  descriptionFa: string;
}

export const SITE_COLOR_SCHEMES: readonly SiteColorSchemeDefinition[] = [
  {
    id: "light",
    nameEn: "Light (White / Paper)",
    nameFa: "حالت روشن (سفید)",
    taglineEn: "Bright Canvas · Crisp Daylight Contrast",
    taglineFa: "پس‌زمینه روشن و سفید · خوانایی شفاف روزانه",
    descriptionEn:
      "Luminous white and archival paper surfaces with deep ink typography — works seamlessly across both Unslop Editorial and Classic Cosmic designs.",
    descriptionFa:
      "پس‌زمینه سفید و کاغذ آرشیوی روشن با جوهر تیره خوانا؛ قابل استفاده روی هر دو طراحی Unslop و کلاسیک.",
  },
  {
    id: "dark",
    nameEn: "Dark (Nocturnal)",
    nameFa: "حالت تاریک (دارک)",
    taglineEn: "Obsidian Slate · Low-Glare Night Reading",
    taglineFa: "پس‌زمینه تیره و شبانه · آرامش چشم در مطالعه شب",
    descriptionEn:
      "Deep nocturnal slate and obsidian surfaces with luminous high-contrast typography — turns Unslop into a dark observatory atlas and Classic into deep space.",
    descriptionFa:
      "پس‌زمینه تیره و کم‌خیرگی برای مطالعه شبانه؛ طراحی Unslop را به اطلس رصدخانه‌ای شب و طراحی کلاسیک را به فضای کیهانی تیره تبدیل می‌کند.",
  },
] as const;

export interface SiteDesignModeDefinition {
  id: DesignMode;
  nameEn: string;
  nameFa: string;
  taglineEn: string;
  taglineFa: string;
  descriptionEn: string;
  descriptionFa: string;
  highlightsEn: readonly string[];
  highlightsFa: readonly string[];
}

export const SITE_DESIGN_MODES: readonly SiteDesignModeDefinition[] = [
  {
    id: "classic",
    nameEn: "Classic Cosmic",
    nameFa: "طراحی فعلی (کلاسیک کیهانی)",
    taglineEn: "Dark Space Canvas · Atmospheric Orbs & Live Console",
    taglineFa: "پس‌زمینه تاریک فضایی · هاله‌های شفق و کنسول زنده",
    descriptionEn:
      "The original Scienta visual architecture with deep cosmic dark surfaces, glowing aurora gradients, spotlight cards, and kinetic space backdrops.",
    descriptionFa:
      "طراحی اصلی و فعلی ساینتا با فضای تاریک کیهانی، گرادیان‌های شفق، کارت‌های نورپرداز و جلوه‌های محیطی متحرک.",
    highlightsEn: [
      "Dark obsidian / marine canvas",
      "Aurora glow & spotlight cards",
      "Interactive derivation terminal",
    ],
    highlightsFa: [
      "فضای تاریک فضایی با هاله‌های شفق",
      "کارت‌های نورپرداز و دکمه‌های کپسولی",
      "کنسول ترمینال اثبات معادلات",
    ],
  },
  {
    id: "unslop",
    nameEn: "Unslop Editorial (Observatory Press)",
    nameFa: "طراحی Unslop (نشریه علمی رصدخانه‌ای)",
    taglineEn: "Archival Paper · Engraved Observatory Plate & Broadsheet Grid",
    taglineFa: "کاغذ آرشیوی · گراور رصدخانه‌ای و صفحه‌آرایی نشریه‌ای",
    descriptionEn:
      "A complete editorial redesign built strictly on Unslop craft: zero glows or hue gradients, warm archival paper, bespoke observatory engraving, asymmetric broadsheet layout, disciplined 4px spacing, and calm high-contrast reading typography.",
    descriptionFa:
      "بازطراحی کامل ظاهر سایت بر اساس قوانین Unslop: حذف کامل نورپردازی‌های کلیشه‌ای و گرادیان‌های شلوغ، کاغذ آرشیوی گرم، گراور اختصاصی رصدخانه‌ای، صفحه‌آرایی نامتقارن ژورنالی، تایپوگرافی دقیق فارسی/لاتین و تجربه مطالعه آرام.",
    highlightsEn: [
      "Zero glows, blobs, or gradient text",
      "Observatory engraving + rising proof sheet",
      "Asymmetric broadsheet & hairline directory",
    ],
    highlightsFa: [
      "حذف کامل گرادیان متن، هاله و افکت‌های اضافه",
      "گراور اختصاصی + برگه زنده اثبات معادلات",
      "صفحه‌آرایی ژورنالی نامتقارن و خوانایی آرشیوی",
    ],
  },
  {
    id: "unslop-kinetic",
    nameEn: "Unslop Kinetic (Living Optical Lab)",
    nameFa: "طراحی Unslop زنده (آزمایشگاه نور و موج)",
    taglineEn: "Studio Prism Optics · Live 60fps Physics Bench & Filterable Deck",
    taglineFa: "عکاسی استودیویی منشور · شبیه‌ساز زنده فیزیک و فیلتر تعاملی مقالات",
    descriptionEn:
      "A completely fresh, living Unslop architecture built around an optical physics bench: real studio prism photography, a live interactive 60fps Canvas simulator (wave interference, Kepler orbits, event horizons) with draggable sliders, live filterable essay deck, and Swiss calibration precision.",
    descriptionFa:
      "طراحی کاملاً متفاوت و زنده بر پایه قوانین Unslop در دنیای آزمایشگاه اپتیک: عکاسی استودیویی منشور شیشه‌ای، میز شبیه‌ساز زنده فیزیک (تداخل دو شکاف، مدار کپلری و افق نسبیتی) با اسلایدرهای تعاملی و نمودار زنده، فیلتر فوری مقالات و دقت کالیبراسیون آزمایشگاهی.",
    highlightsEn: [
      "Live 60fps wave, orbit & gravity simulator",
      "Studio optical prism hero (Light & Dark)",
      "Live filterable & sortable essay deck",
    ],
    highlightsFa: [
      "شبیه‌ساز زنده ۶۰ فریم موج، مدار و گرانش",
      "عکاسی واقعی منشور نوری (نسخه سفید و دارک)",
      "فیلتر و مرتب‌سازی زنده مقالات در صفحه اصلی",
    ],
  },
] as const;

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
      "The signature Scienta palette with deep space obsidian surfaces, electric violet accents, and warm solar orange highlights. In Unslop mode, pairs with warm archival ivory paper and deep observatory cobalt ink.",
    descriptionFa:
      "تم اصلی و فعلی ساینتا با پس‌زمینه مشکی کیهانی، رنگ تاکیدی بنفش و هایلایت‌های گرم نارنجی. در حالت Unslop با کاغذ آرشیوی گرم و جوهر آبی کبالت ترکیب می‌شود.",
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
      "A calm nocturnal palette pairing deep midnight blue canvases with dark emerald green surfaces and ocean sapphire highlights. In Unslop mode, pairs with pale mineral paper and deep botanical forest ink.",
    descriptionFa:
      "تم شبانه آرام و علمی با ترکیب پس‌زمینه آبی تیره عمیق، رنگ‌های سبز زمردی تیره و جلوه‌های آبی اقیانوسی. در حالت Unslop با کاغذ معدنی خنک و جوهر سبز جنگلی ترکیب می‌شود.",
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

export function isDesignMode(value: unknown): value is DesignMode {
  return typeof value === "string" && (DESIGN_MODES as readonly string[]).includes(value);
}

export function isUnslopStyle(mode: DesignMode): boolean {
  return mode === "unslop" || mode === "unslop-kinetic";
}

export function isColorScheme(value: unknown): value is ColorScheme {
  return typeof value === "string" && (COLOR_SCHEMES as readonly string[]).includes(value);
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

  const designMode = isDesignMode(obj.designMode)
    ? obj.designMode
    : DEFAULT_SITE_MODES.designMode;
  const inferredScheme: ColorScheme = isUnslopStyle(designMode) ? "light" : "dark";
  const colorScheme = isColorScheme(obj.colorScheme) ? obj.colorScheme : inferredScheme;
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

  return { designMode, colorScheme, theme, ambientMode, contrastMode, applyToAdmin };
}
