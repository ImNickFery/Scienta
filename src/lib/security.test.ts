import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAdminRedirect, validateEmbedUrl, safeJsonLd } from "./security";
import { detectImageFormat } from "./media-validation";

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
