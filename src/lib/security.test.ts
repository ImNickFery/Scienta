import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import {
  sanitizeAdminRedirect,
  validateEmbedUrl,
  safeJsonLd,
  sanitizeUrl,
  validateMdxSafety,
  validatePasswordStrength,
  verifySameOrigin,
  sanitizeMathComment,
  buildSecurityHeaders,
} from "./security";
import { detectImageFormat } from "./media-validation";
import {
  signAccessToken,
  verifyAccessToken,
  isHttpsRequest,
  buildAuthCookieOptions,
} from "./auth";
import { can } from "./rbac";
import { rateLimit, getClientIp } from "./rate-limit";
import { SEED_ARTICLES } from "./seed-data";

test("sanitizeAdminRedirect allows only valid internal /admin paths", () => {
  assert.equal(sanitizeAdminRedirect("/admin/dashboard"), "/admin/dashboard");
  assert.equal(sanitizeAdminRedirect("/admin/articles/123?tab=fa"), "/admin/articles/123?tab=fa");
  assert.equal(sanitizeAdminRedirect("/admin"), "/admin");

  assert.equal(sanitizeAdminRedirect(null), "/admin/dashboard");
  assert.equal(sanitizeAdminRedirect(""), "/admin/dashboard");
  assert.equal(sanitizeAdminRedirect("//evil.com/admin"), "/admin/dashboard");
  assert.equal(sanitizeAdminRedirect("https://evil.com"), "/admin/dashboard");
  assert.equal(sanitizeAdminRedirect("/admin-evil.com"), "/admin/dashboard");
  assert.equal(sanitizeAdminRedirect("/admin\\evil"), "/admin/dashboard");
  assert.equal(sanitizeAdminRedirect("/en/articles"), "/admin/dashboard");
});

test("sanitizeUrl allows safe protocols and blocks dangerous schemes and tricks", () => {
  assert.equal(sanitizeUrl("https://scienta.ir/en/articles"), "https://scienta.ir/en/articles");
  assert.equal(sanitizeUrl("http://localhost:3000/test"), "http://localhost:3000/test");
  assert.equal(sanitizeUrl("/uploads/media/a.png"), "/uploads/media/a.png");
  assert.equal(sanitizeUrl("#section-1"), "#section-1");
  assert.equal(sanitizeUrl("mailto:info@scienta.ir", { allowMailto: true }), "mailto:info@scienta.ir");

  assert.equal(sanitizeUrl("mailto:info@scienta.ir"), null);
  assert.equal(sanitizeUrl("/uploads/a.png", { allowRelative: false }), null);
  assert.equal(sanitizeUrl("#anchor", { allowHash: false }), null);

  assert.equal(sanitizeUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeUrl("  JaVaScRiPt:alert(1)"), null);
  assert.equal(sanitizeUrl("vbscript:msgbox(1)"), null);
  assert.equal(sanitizeUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(sanitizeUrl("//evil.example.com/phish"), null);
  assert.equal(sanitizeUrl("https://evil.com\\path"), null);
  assert.equal(sanitizeUrl("https://scienta.ir/\nSet-Cookie: a=1"), null);
  assert.equal(sanitizeUrl("   "), null);
  assert.equal(sanitizeUrl(null), null);
});

test("validateEmbedUrl allows trusted HTTPS video hosts and rejects unsafe URLs", () => {
  assert.equal(
    validateEmbedUrl("https://www.youtube-nocookie.com/embed/e-P5IFTqB98"),
    "https://www.youtube-nocookie.com/embed/e-P5IFTqB98"
  );
  assert.equal(
    validateEmbedUrl("https://player.vimeo.com/video/123456"),
    "https://player.vimeo.com/video/123456"
  );
  assert.equal(
    validateEmbedUrl("https://www.aparat.com/video/video/embed/videohash/abc/vt/frame"),
    "https://www.aparat.com/video/video/embed/videohash/abc/vt/frame"
  );

  assert.equal(validateEmbedUrl("javascript:alert(1)"), null);
  assert.equal(validateEmbedUrl("http://www.youtube.com/embed/abc"), null);
  assert.equal(validateEmbedUrl("https://evil.example.com/embed/abc"), null);
  assert.equal(validateEmbedUrl("data:text/html,<script>alert(1)</script>"), null);
});

test("safeJsonLd escapes script-breaking characters", () => {
  const out = safeJsonLd({ title: 'Black </script><script>alert("xss")</script> & more' });
  assert.ok(!out.includes("</script>"));
  assert.ok(out.includes("\\u003c/script\\u003e"));
  assert.ok(out.includes("\\u0026"));
  assert.deepEqual(JSON.parse(out), { title: 'Black </script><script>alert("xss")</script> & more' });
});

test("detectImageFormat verifies magic bytes and rejects SVG/HTML payloads", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(detectImageFormat(jpeg), { mime: "image/jpeg", ext: "jpg" });

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.deepEqual(detectImageFormat(png), { mime: "image/png", ext: "png" });

  const gif = new TextEncoder().encode("GIF89a000000");
  assert.deepEqual(detectImageFormat(gif), { mime: "image/gif", ext: "gif" });

  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  assert.deepEqual(detectImageFormat(webp), { mime: "image/webp", ext: "webp" });

  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal(detectImageFormat(svg), null);

  const html = new TextEncoder().encode("<html><body>hi</body></html>");
  assert.equal(detectImageFormat(html), null);

  assert.equal(detectImageFormat(new Uint8Array([0xff, 0xd8])), null);
});

test("validateMdxSafety blocks XSS and server-side JS RCE payloads", () => {
  const maliciousPayloads = [
    '<script>alert("xss")</script>',
    '<iframe src="https://evil.com"></iframe>',
    '<object data="evil.swf"></object>',
    '[click](javascript:alert(1))',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<div onClick={alert(1)}>x</div>',
    "{process.env.JWT_SECRET}",
    "{globalThis.process.mainModule.require('child_process').execSync('id')}",
    "{require('fs').readFileSync('/etc/passwd')}",
    "{eval('1+1')}",
    "{new Function('return process')()}",
    "{({}).constructor.constructor('return process')()}",
    "{import('fs')}",
    "import fs from 'fs'\n\n# Title",
    "export const meta = { secret: process.env }",
    "Hello\u0000World",
    "x".repeat(250_001),
  ];

  for (const payload of maliciousPayloads) {
    const res = validateMdxSafety(payload);
    assert.equal(res.safe, false, `Expected payload to be rejected: ${payload.slice(0, 60)}`);
  }
});

test("validateMdxSafety allows legitimate scientific MDX, code fences, math, and all seed articles", () => {
  const legitimate = `
# Quantum Mechanics

Consider the inequality $x < y$ and the Schrödinger equation:

$$i\\hbar \\frac{\\partial}{\\partial t} \\Psi = \\hat{H} \\Psi$$

\`\`\`ts
// Code examples mentioning process.env or <script> must NOT trigger false positives
console.log(process.env.NODE_ENV);
const tag = "<script>alert(1)</script>";
\`\`\`

<Callout type="note" title="Reminder">
  Use \`process.env\` only inside server components.
</Callout>

<StatHighlight value="299,792 km/s" label="Speed of light" />
`;

  assert.deepEqual(validateMdxSafety(legitimate), { safe: true });

  for (const article of SEED_ARTICLES) {
    const faRes = validateMdxSafety(article.fa.content);
    assert.equal(faRes.safe, true, `Seed FA article "${article.slug}" failed: ${faRes.reason}`);
    const enRes = validateMdxSafety(article.en.content);
    assert.equal(enRes.safe, true, `Seed EN article "${article.slug}" failed: ${enRes.reason}`);
  }
});

test("validatePasswordStrength enforces minimum length and character classes", () => {
  assert.equal(validatePasswordStrength("Short1!").valid, false);
  assert.equal(validatePasswordStrength("alllowercase123!").valid, false);
  assert.equal(validatePasswordStrength("ALLUPPERCASE123!").valid, false);
  assert.equal(validatePasswordStrength("NoNumbersOrSymbols").valid, false);
  assert.equal(validatePasswordStrength("A".repeat(129) + "a1!").valid, false);

  assert.equal(validatePasswordStrength("ChangeMe_2026!").valid, true);
  assert.equal(validatePasswordStrength("ScientaAdmin99").valid, true);
});

test("verifySameOrigin blocks cross-site browser requests and allows same-origin", () => {
  const crossSiteFetch = new Request("https://scienta.ir/api/admin/articles", {
    method: "POST",
    headers: {
      host: "scienta.ir",
      "sec-fetch-site": "cross-site",
      origin: "https://evil.example",
    },
  });
  assert.equal(verifySameOrigin(crossSiteFetch), false);

  const mismatchedOrigin = new Request("https://scienta.ir/api/admin/articles", {
    method: "POST",
    headers: {
      host: "scienta.ir",
      origin: "https://attacker.example",
    },
  });
  assert.equal(verifySameOrigin(mismatchedOrigin), false);

  const mismatchedReferer = new Request("https://scienta.ir/api/public/comments", {
    method: "POST",
    headers: {
      host: "scienta.ir",
      referer: "https://attacker.example/form",
    },
  });
  assert.equal(verifySameOrigin(mismatchedReferer), false);

  const sameOrigin = new Request("https://scienta.ir/api/admin/articles", {
    method: "POST",
    headers: {
      host: "scienta.ir",
      "sec-fetch-site": "same-origin",
      origin: "https://scienta.ir",
    },
  });
  assert.equal(verifySameOrigin(sameOrigin), true);

  const forwardedHost = new Request("http://127.0.0.1:3000/api/admin/articles", {
    method: "POST",
    headers: {
      "x-forwarded-host": "scienta.ir",
      origin: "https://scienta.ir",
    },
  });
  assert.equal(verifySameOrigin(forwardedHost), true);

  const forwardedHostWithDefaultPort = new Request("http://127.0.0.1:3000/api/admin/auth/login", {
    method: "POST",
    headers: {
      "x-forwarded-host": "scienta.ir:443",
      origin: "https://scienta.ir",
    },
  });
  assert.equal(verifySameOrigin(forwardedHostWithDefaultPort), true);

  const mismatchedPort = new Request("https://scienta.ir/api/admin/auth/login", {
    method: "POST",
    headers: {
      host: "scienta.ir:8443",
      origin: "https://scienta.ir",
    },
  });
  assert.equal(verifySameOrigin(mismatchedPort), false);

  const nonBrowserCaller = new Request("https://scienta.ir/api/public/contact", {
    method: "POST",
    headers: { host: "scienta.ir" },
  });
  assert.equal(verifySameOrigin(nonBrowserCaller), true);
});

test("sanitizeMathComment strips HTML/XSS while preserving LaTeX inequalities", () => {
  const input = 'Great proof! For $x < y$ and $$a < b \\implies c > d$$, <script>alert(1)</script><img src=x onerror=alert(1)> works.';
  const out = sanitizeMathComment(input);
  assert.ok(out.includes("$x < y$"));
  assert.ok(out.includes("$$a < b \\implies c > d$$"));
  assert.ok(!out.includes("<script"));
  assert.ok(!out.includes("<img"));
  assert.ok(!out.includes("onerror"));

  const insideMathScript = "Check $<script>alert(1)</script> x < y$";
  const outMath = sanitizeMathComment(insideMathScript);
  assert.ok(!outMath.includes("<script>"));
  assert.ok(outMath.includes("x < y"));
});

test("buildSecurityHeaders enforces strict CSP and production framing/HSTS protections", () => {
  const prodHeaders = Object.fromEntries(buildSecurityHeaders(true).map((h) => [h.key, h.value]));
  assert.ok(prodHeaders["Content-Security-Policy"]?.includes("object-src 'none'"));
  assert.ok(prodHeaders["Content-Security-Policy"]?.includes("frame-ancestors 'self'"));
  assert.ok(prodHeaders["Content-Security-Policy"]?.includes("upgrade-insecure-requests"));
  assert.ok(prodHeaders["Content-Security-Policy"]?.includes("https://www.googletagmanager.com"));
  assert.ok(prodHeaders["Content-Security-Policy"]?.includes("https://www.google-analytics.com"));
  assert.ok(prodHeaders["Content-Security-Policy"]?.includes("https://www.clarity.ms"));
  assert.ok(prodHeaders["Content-Security-Policy"]?.includes("https://mc.yandex.ru"));
  assert.ok(prodHeaders["Content-Security-Policy"]?.includes("https://static.cloudflareinsights.com"));
  assert.ok(prodHeaders["Content-Security-Policy"]?.includes("https://cloudflareinsights.com"));
  assert.ok(!prodHeaders["Content-Security-Policy"]?.includes("'unsafe-eval'"));
  assert.equal(prodHeaders["X-Frame-Options"], "SAMEORIGIN");
  assert.equal(prodHeaders["X-Content-Type-Options"], "nosniff");
  assert.equal(prodHeaders["Cross-Origin-Opener-Policy"], "same-origin");
  assert.ok(prodHeaders["Strict-Transport-Security"]?.includes("max-age=63072000"));

  const devHeaders = Object.fromEntries(buildSecurityHeaders(false).map((h) => [h.key, h.value]));
  assert.equal(devHeaders["X-Frame-Options"], undefined);
  assert.equal(devHeaders["Strict-Transport-Security"], undefined);
  assert.ok(!devHeaders["Content-Security-Policy"]?.includes("frame-ancestors"));

  const previewProdHeaders = Object.fromEntries(
    buildSecurityHeaders(true, {
      previewFrameAncestors: "frame-ancestors 'self' https://*.google.com;",
    }).map((h) => [h.key, h.value])
  );
  assert.equal(previewProdHeaders["X-Frame-Options"], undefined);
  assert.equal(previewProdHeaders["Cross-Origin-Opener-Policy"], undefined);
  assert.ok(previewProdHeaders["Content-Security-Policy"]?.includes("frame-ancestors 'self' https://*.google.com"));
});

test("buildAuthCookieOptions adapts between plain HTTP localhost and HTTPS preview iframes", () => {
  const localHttpReq = new Request("http://localhost:3000/api/admin/auth/login", { method: "POST" });
  assert.equal(isHttpsRequest(localHttpReq), false);
  assert.deepEqual(buildAuthCookieOptions(localHttpReq, { httpOnly: true, path: "/", maxAge: 900 }), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 900,
  });

  const proxiedHttpsReq = new Request("http://127.0.0.1:3000/api/admin/auth/login", {
    method: "POST",
    headers: { "x-forwarded-proto": "https" },
  });
  assert.equal(isHttpsRequest(proxiedHttpsReq), true);
  assert.deepEqual(buildAuthCookieOptions(proxiedHttpsReq, { httpOnly: true, path: "/", maxAge: 900 }), {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    partitioned: true,
    path: "/",
    maxAge: 900,
  });
});

test("JWT access tokens pin HS256, issuer, audience, and payload validation", async () => {
  const token = await signAccessToken({
    sub: "user-1",
    email: "admin@scienta.ir",
    name: "Admin",
    role: "admin",
  });
  const verified = await verifyAccessToken(token);
  assert.equal(verified?.sub, "user-1");
  assert.equal(verified?.role, "admin");

  // Tampered token must fail
  assert.equal(await verifyAccessToken(token.slice(0, -3) + "xxx"), null);

  const secretKey = new TextEncoder().encode(
    process.env.JWT_SECRET?.trim() || "scienta-local-dev-jwt-secret-change-in-production-2026"
  );

  // Token with wrong audience/issuer must fail
  const wrongAud = await new SignJWT({ email: "a@b.c", name: "X", role: "super_admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("user-1")
    .setIssuer("other-app")
    .setAudience("other-aud")
    .setExpirationTime("60s")
    .sign(secretKey);
  assert.equal(await verifyAccessToken(wrongAud), null);

  // Token with fabricated role must fail
  const invalidRole = await new SignJWT({ email: "a@b.c", name: "X", role: "root" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("user-1")
    .setIssuer("scienta")
    .setAudience("scienta-admin")
    .setExpirationTime("60s")
    .sign(secretKey);
  assert.equal(await verifyAccessToken(invalidRole), null);
});

test("RBAC matrix grants implied view permissions and enforces least privilege", () => {
  assert.equal(can("admin", "categories.view"), true);
  assert.equal(can("admin", "fields.view"), true);
  assert.equal(can("admin", "authors.view"), true);
  assert.equal(can("admin", "comments.manage"), true);
  assert.equal(can("admin", "users.view"), true);
  assert.equal(can("admin", "users.manage"), false);

  assert.equal(can("editor", "articles.manage"), true);
  assert.equal(can("editor", "authors.view"), true);
  assert.equal(can("editor", "authors.manage"), false);
  assert.equal(can("editor", "users.view"), false);

  assert.equal(can("super_admin", "users.manage"), true);
  assert.equal(can("super_admin", "backup.manage"), true);
});

test("rateLimit enforces cap with Retry-After and getClientIp sanitizes headers", () => {
  const key = `test-rl-${Date.now()}-${Math.random()}`;
  const r1 = rateLimit(key, 2, 60_000);
  const r2 = rateLimit(key, 2, 60_000);
  const r3 = rateLimit(key, 2, 60_000);
  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.equal(r3.allowed, false);
  assert.ok(r3.retryAfterSeconds >= 1 && r3.retryAfterSeconds <= 60);

  const poisonedReq = new Request("https://scienta.ir/api/public/search", {
    headers: {
      "x-forwarded-for": "203.0.113.5<script>, 10.0.0.1",
    },
  });
  assert.equal(getClientIp(poisonedReq), "10.0.0.1");

  const garbageReq = new Request("https://scienta.ir/api/public/search", {
    headers: {
      "x-forwarded-for": "not-an-ip<script>",
    },
  });
  assert.equal(getClientIp(garbageReq), "unknown");

  const validIpv6Req = new Request("https://scienta.ir/api/public/search", {
    headers: {
      "cf-connecting-ip": "2001:db8::1",
    },
  });
  assert.equal(getClientIp(validIpv6Req), "2001:db8::1");
});
