import sanitizeHtml from "sanitize-html";
import slugify from "slugify";

/**
 * Sanitizes rich-text/HTML fragments before storage or render — strips
 * script tags, inline event handlers, javascript: URLs, etc. MDX source
 * itself is compiled server-side (not rendered as raw HTML), so this is
 * primarily for any HTML-ish fields (settings, page content, comments).
 */
export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "figure", "figcaption"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height", "loading"],
      a: ["href", "name", "target", "rel"],
      "*": ["class", "id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

/** Strips all HTML — used for plain-text fields like names, excerpts. */
export function stripHtml(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}

/**
 * Generates a URL-safe slug. Persian text is transliterated by `slugify`
 * only for Latin scripts, so for Persian input we keep the original
 * characters (minus punctuation/spaces) since Persian URLs are valid and
 * expected for the `fa` locale.
 */
export function generateSlug(title: string, locale: "fa" | "en"): string {
  if (locale === "en") {
    return slugify(title, { lower: true, strict: true, trim: true });
  }
  return title
    .trim()
    .replace(/[.,،؛:;!؟?"'`«»<>]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}
