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
  // With experimental.inlineCss enabled, @font-face rules arrive inline in the
  // initial HTML. Keeping preload: false prevents `/en` from downloading the
  // 109 KB Persian font and `/fa` from downloading the 344 KB English font.
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
 * JetBrains Mono — code blocks and monospaced UI (both locales).
 */
export const jetbrainsMono = localFont({
  src: [
    { path: "../fonts/JetBrainsMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/JetBrainsMono-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
  // Monospace is secondary (console/code blocks), never the LCP headline — skip
  // <link rel="preload"> so it doesn't compete with the primary display font on
  // slow mobile connections.
  preload: false,
  // No fallback chain here on purpose: --font-mono in globals.css needs to
  // slot Vazirmatn in for Persian *before* any generic monospace, and a
  // fallback list baked into this variable would sit in front of it.
  //
  // adjustFontFallback is off for the same reason. next/font/local otherwise
  // synthesises a "jetbrainsMono Fallback" face from Arial, and both Arial and
  // the Windows generic monospace (Courier New) carry Arabic glyphs — either
  // one silently served every Persian run in the terminal-styled panels, so
  // the stack never reached Vazirmatn.
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
    : `${inter.variable} ${jetbrainsMono.variable}`;
}

export const fontVariables = `${vazirmatn.variable} ${inter.variable} ${jetbrainsMono.variable}`;
