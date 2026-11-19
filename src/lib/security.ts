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

export interface SanitizeUrlOptions {
  allowRelative?: boolean;
  allowMailto?: boolean;
  allowHash?: boolean;
}

/**
 * Validates and normalizes URLs used in links, images, avatars, social profiles,
 * and canonical tags. Explicitly blocks `javascript:`, `vbscript:`, `data:`,
 * protocol-relative (`//evil.com`), backslashes, and ASCII control characters.
 */
export function sanitizeUrl(
  raw: string | null | undefined,
  options: SanitizeUrlOptions = {}
): string | null {
  const { allowRelative = true, allowMailto = false, allowHash = true } = options;
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/[\x00-\x1f\x7f]/.test(trimmed) || trimmed.includes("\\")) return null;

  if (trimmed.startsWith("#")) {
    return allowHash ? trimmed : null;
  }

  if (trimmed.startsWith("/")) {
    // Reject protocol-relative URLs like //evil.com
    if (trimmed.startsWith("//")) return null;
    return allowRelative ? trimmed : null;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "https:" || protocol === "http:") {
      return parsed.toString();
    }
    if (protocol === "mailto:" && allowMailto) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

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

const DANGEROUS_MDX_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /<\s*script\b/i, reason: "Raw <script> tags are forbidden in MDX content." },
  { pattern: /<\s*iframe\b/i, reason: "Raw <iframe> tags are forbidden — use <VideoEmbed> instead." },
  { pattern: /<\s*(object|embed|applet|base|meta|link)\b/i, reason: "Unsafe HTML tag is forbidden in MDX content." },
  { pattern: /\b(?:javascript|vbscript)\s*:/i, reason: "Executable URI schemes are forbidden in MDX content." },
  { pattern: /\bdata\s*:\s*text\/html/i, reason: "HTML data URIs are forbidden in MDX content." },
  { pattern: /\bon[a-z]{2,20}\s*=/i, reason: "Inline DOM event handlers are forbidden in MDX content." },
  {
    pattern:
      /\b(?:process\s*(?:\.|\[)|globalThis\b|global\s*(?:\.|\[)|require\s*\(|child_process\b|eval\s*\(|new\s+Function\b|Function\s*\(|Reflect\s*\.|__proto__\b|constructor\s*(?:\.|\[|\())/,
    reason: "Server-side JavaScript execution primitives are forbidden in MDX content.",
  },
  {
    pattern: /\bimport\s*\(/,
    reason: "Dynamic import() expressions are forbidden in MDX content.",
  },
  {
    pattern: /^\s*(?:import|export)\s+/m,
    reason: "Top-level MDX import/export statements are disabled for security.",
  },
];

/**
 * Strips fenced code blocks, inline code, and LaTeX math spans before inspecting
 * executable MDX markup/expressions so legitimate programming or math articles
 * never trigger false positives.
 */
function stripCodeAndMathSpans(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/(?<!\\)\$[^$\n]+\$/g, " ");
}

/**
 * Defense-in-depth MDX safety validator used before saving articles and before
 * server-side `compileMDX` execution. Blocks raw HTML XSS and JS RCE primitives
 * while preserving legitimate scientific components (`<StatHighlight>`, `<Timeline>`, etc.).
 */
export function validateMdxSafety(source: string): { safe: boolean; reason?: string } {
  if (typeof source !== "string") {
    return { safe: false, reason: "MDX content must be a string." };
  }
  if (source.length > 250_000) {
    return { safe: false, reason: "MDX content exceeds the maximum allowed size (250 KB)." };
  }
  if (source.includes("\u0000")) {
    return { safe: false, reason: "Null bytes are not allowed in MDX content." };
  }

  const executableSurface = stripCodeAndMathSpans(source);
  for (const { pattern, reason } of DANGEROUS_MDX_PATTERNS) {
    if (pattern.test(executableSurface)) {
      return { safe: false, reason };
    }
  }
  return { safe: true };
}

/**
 * Validates admin account passwords against baseline complexity rules.
 */
export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (typeof password !== "string" || password.length < 10) {
    return { valid: false, reason: "Password must be at least 10 characters long." };
  }
  if (password.length > 128) {
    return { valid: false, reason: "Password must be at most 128 characters long." };
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return { valid: false, reason: "Password must include both uppercase and lowercase letters." };
  }
  if (!/[\d\W_]/.test(password)) {
    return { valid: false, reason: "Password must include at least one number or special character." };
  }
  return { valid: true };
}

/**
 * Verifies that state-changing browser requests originate from the same host
 * (defense-in-depth alongside double-submit CSRF tokens and SameSite cookies).
 */
export function verifySameOrigin(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return false;
  }

  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");
  const candidate = originHeader || refererHeader;

  // Non-browser / direct server-side callers may omit Origin & Referer.
  if (!candidate) {
    return true;
  }

  const rawHost =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.trim() ||
    "";

  let expectedHost = rawHost.toLowerCase();
  if (!expectedHost) {
    try {
      expectedHost = new URL(req.url).host.toLowerCase();
    } catch {
      return false;
    }
  }

  try {
    const parsedCandidate = new URL(candidate);
    return parsedCandidate.host.toLowerCase() === expectedHost;
  } catch {
    return false;
  }
}

/**
 * Sanitizes reader comments & editorial replies while preserving legitimate LaTeX
 * inequalities (e.g. `$x < y$`, `$$a < b$$`) intact. Strips HTML tags outside math
 * spans and removes ASCII control characters everywhere.
 */
export function sanitizeMathComment(input: string): string {
  const cleaned = input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
  const mathSpans = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
  return cleaned
    .split(mathSpans)
    .map((segment, index) => {
      if (index % 2 === 1) {
        // Inside math: KaTeX renders with `trust: false` and escapes HTML, but
        // block raw `<script` tags as extra defense-in-depth.
        return segment.replace(/<\/?\s*script\b[^>]*>/gi, "");
      }
      return segment.replace(/<\/?[a-zA-Z][^>]*>/g, "");
    })
    .join("")
    .trim();
}

export interface SecurityHeader {
  key: string;
  value: string;
}

export interface SecurityHeaderOptions {
  /**
   * Optional raw `frame-ancestors ...` directive injected by Cloud Run / AI Studio
   * preview runtimes (e.g. from `CSP_HEADER_VALUE`). When provided, `X-Frame-Options`
   * and `Cross-Origin-Opener-Policy: same-origin` are omitted so the preview iframe loads cleanly.
   */
  previewFrameAncestors?: string | null;
}

/**
 * Builds the global HTTP security headers including a strict Content-Security-Policy.
 * Frame restrictions (`X-Frame-Options` & `frame-ancestors 'self'`) are enabled in
 * production so local iframe-based development environments remain unobstructed.
 */
export function buildSecurityHeaders(
  isProd: boolean,
  options: SecurityHeaderOptions = {}
): SecurityHeader[] {
  const previewAncestors = options.previewFrameAncestors?.trim().replace(/;+$/, "") || "";
  const isPreviewEmbed = Boolean(previewAncestors && /^frame-ancestors\s+/i.test(previewAncestors));

  const cspDirectives = [
    "default-src 'self'",
    isProd ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' https:",
    "frame-src https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://youtube-nocookie.com https://player.vimeo.com https://vimeo.com https://www.aparat.com https://aparat.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isPreviewEmbed ? [previewAncestors] : []),
    ...(isProd ? [...(!isPreviewEmbed ? ["frame-ancestors 'self'"] : []), "upgrade-insecure-requests"] : []),
  ];

  return [
    { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ...(isProd && !isPreviewEmbed
      ? [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ]
      : []),
    ...(isProd
      ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
      : []),
  ];
}
