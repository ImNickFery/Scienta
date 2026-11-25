/**
 * Collects CSS rules from already-loaded stylesheets whose selector touches
 * `.katex`. Used to make the exported SVG self-contained (viewable/editable
 * outside the page it came from) without bundling a second copy of KaTeX's
 * CSS or a whole separate rendering engine.
 */
function collectKatexCss(): string {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      // Cross-origin stylesheets throw on access — none of our own CSS is
      // cross-origin, so skipping these loses nothing we need.
      continue;
    }
    for (const rule of Array.from(cssRules)) {
      if (rule.cssText.includes(".katex")) rules.push(rule.cssText);
    }
  }
  return rules.join("\n");
}

/**
 * Builds a standalone SVG string containing the given KaTeX-rendered
 * element, suitable for copying to the clipboard or downloading. Returns
 * null if the browser doesn't support the APIs involved — callers should
 * hide the "copy as SVG" affordance in that case rather than show a button
 * that fails silently.
 */
export function exportKatexElementToSvg(katexEl: HTMLElement): string | null {
  if (typeof window === "undefined" || typeof XMLSerializer === "undefined") return null;

  try {
    const rect = katexEl.getBoundingClientRect();
    const width = Math.ceil(rect.width) || 400;
    const height = Math.ceil(rect.height) || 100;
    const css = collectKatexCss();
    const clone = katexEl.cloneNode(true) as HTMLElement;

    // Serialize the cloned KaTeX HTML so it can live inside foreignObject's
    // XHTML namespace.
    const innerHtml = new XMLSerializer()
      .serializeToString(clone)
      // cloneNode + serializer occasionally leaves bare `&` from entities —
      // guard against producing invalid XML.
      .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;");

    const safeCss = css.replace(/\]\]>/g, "]]&gt;");
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<style><![CDATA[${safeCss}]]></style>`,
      `<foreignObject width="100%" height="100%">`,
      `<div xmlns="http://www.w3.org/1999/xhtml" style="color:#f5f5fa;font-size:${window.getComputedStyle(katexEl).fontSize};display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${innerHtml}</div>`,
      `</foreignObject>`,
      `</svg>`,
    ].join("");

    return svg;
  } catch {
    return null;
  }
}
