import localFont from "next/font/local";

/**
 * Vazirmatn — variable weight (100–900), Persian + Latin coverage.
 * Used for all Persian (RTL) UI and body text, and for headings site-wide.
 */
export const vazirmatn = localFont({
  src: [
    { path: "../fonts/Vazirmatn-Variable.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
  preload: false,
  fallback: ["Tahoma", "system-ui", "sans-serif"],
});

/**
 * InterVariable — variable weight (100–900), used for English (LTR) body
 * and UI text.
 */
export const inter = localFont({
  src: [
    { path: "../fonts/Inter-Variable.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: false,
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

/**
 * Newsreader — refined editorial serif used exclusively for English display
 * headings when Unslop Editorial (Observatory Press) mode is active.
 * Bundled locally to avoid Turbopack next/font/google import map resolution bugs.
 */
export const newsreader = localFont({
  src: [
    { path: "../fonts/Newsreader-Variable.woff2", weight: "300 700", style: "normal" },
  ],
  variable: "--font-newsreader",
  display: "swap",
  preload: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

/**
 * Space Grotesk — geometric technical grotesque used for English display
 * headings when Unslop Kinetic (Living Optical Lab) mode is active.
 * Bundled locally to avoid Turbopack next/font/google import map resolution bugs.
 */
export const spaceGrotesk = localFont({
  src: [
    { path: "../fonts/SpaceGrotesk-Variable.woff2", weight: "300 700", style: "normal" },
  ],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: false,
  fallback: ["system-ui", "sans-serif"],
});

/**
 * JetBrains Mono — code blocks and monospaced UI (both locales).
 */
export const jetbrainsMono = localFont({
  src: [
    { path: "../fonts/JetBrainsMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/JetBrainsMono-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

/**
 * Only attach the active locale's primary font variable on public routes so
 * `/en` does not preload Vazirmatn (109 KB) and `/fa` does not preload Inter
 * (344 KB). Admin routes continue using `fontVariables` with both locales.
 */
export function getLocaleFontVariables(locale: "fa" | "en"): string {
  return locale === "fa"
    ? `${vazirmatn.variable} ${jetbrainsMono.variable}`
    : `${inter.variable} ${newsreader.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`;
}

export const fontVariables = `${vazirmatn.variable} ${inter.variable} ${newsreader.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`;
