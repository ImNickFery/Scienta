const ALLOWED_EMBED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "vimeo.com",
  "www.vimeo.com",
  "aparat.com",
  "www.aparat.com",
]);

/**
 * Ensures post-login admin redirects stay strictly on internal `/admin` paths.
 * Blocks protocol-relative URLs (`//evil.com`), backslashes, and control characters.
 */
export function sanitizeAdminRedirect(from: string | null | undefined): string {
  const fallback = "/admin/dashboard";
  if (!from || typeof from !== "string") return fallback;
  const trimmed = from.trim();
  if (!trimmed.startsWith("/admin")) return fallback;
  // Block protocol-relative (`//`), backslash tricks (`/admin\evil`), or whitespace/control chars.
  if (trimmed.startsWith("//") || trimmed.includes("\\") || /[\x00-\x1f\x7f]/.test(trimmed)) {
    return fallback;
  }
  // Ensure the path segment is either `/admin` or `/admin/...` (not `/admin-evil.com`).
  if (trimmed !== "/admin" && !trimmed.startsWith("/admin/")) {
    return fallback;
  }
  return trimmed;
}

/**
 * Validates external video iframe URLs against an explicit HTTPS host allowlist.
 * Returns a normalized HTTPS URL string or null if rejected.
 */
export function validateEmbedUrl(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:") return null;
    if (!ALLOWED_EMBED_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Safely serializes JSON-LD payloads for embedding inside `<script type="application/ld+json">`.
 * Escapes HTML-significant characters and line separators to prevent `</script>` breakout XSS.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
