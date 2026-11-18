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
  preload: true,
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
  preload: true,
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
  preload: true,
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

export const fontVariables = `${vazirmatn.variable} ${inter.variable} ${jetbrainsMono.variable}`;
