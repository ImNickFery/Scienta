import test from "node:test";
import assert from "node:assert/strict";
import {
  computeArticleEtag,
  extractApiToken,
  generateApiKeyToken,
  hasScope,
  matchesIfMatchHeader,
  parseScopesJson,
  readTextBodyWithLimit,
} from "./ai-api-auth";
import {
  decodeBase64Image,
  isPrivateOrReservedIp,
  validateExternalImageUrl,
} from "./ai-api-media";
import {
  aiCreateArticleSchema,
  generateOpenApiSpec,
  lintMdxEditorialQuality,
  normalizeAiArticleTranslations,
} from "./ai-api-articles";
import { can } from "./rbac";
import { SqliteFallbackDb } from "./sqlite-fallback";

test("generateApiKeyToken emits sci_live_ prefix and SHA-256 hash", async () => {
  const { token, keyPrefix, keyHash } = await generateApiKeyToken();
  assert.ok(token.startsWith("sci_live_"));
  assert.ok(token.length >= 48);
  assert.equal(keyPrefix, token.slice(0, 17));
  assert.match(keyHash, /^[0-9a-f]{64}$/);
});

test("extractApiToken parses Authorization Bearer and X-API-Key headers", () => {
  const r1 = new Request("https://example.com/api/v1/me", {
    headers: { Authorization: "Bearer sci_live_abc123" },
  });
  assert.equal(extractApiToken(r1), "sci_live_abc123");

  const r2 = new Request("https://example.com/api/v1/me", {
    headers: { "X-API-Key": "sci_live_xyz987" },
  });
  assert.equal(extractApiToken(r2), "sci_live_xyz987");

  const r3 = new Request("https://example.com/api/v1/me");
  assert.equal(extractApiToken(r3), null);
});

test("hasScope enforces write/read hierarchy and rejects missing publish", () => {
  assert.equal(hasScope(["articles:write"], "articles:read"), true);
  assert.equal(hasScope(["articles:write"], "articles:publish"), false);
  assert.equal(hasScope(["articles:publish"], "articles:read"), true);
  assert.equal(hasScope(["media:write"], "media:read"), true);
  assert.equal(hasScope(["taxonomy:write"], "taxonomy:read"), true);
  assert.deepEqual(parseScopesJson('["articles:read","invalid:scope"]'), ["articles:read"]);
});

test("isPrivateOrReservedIp blocks loopback, private, metadata, and link-local ranges", () => {
  for (const blocked of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.5",
    "192.168.1.42",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
  ]) {
    assert.equal(isPrivateOrReservedIp(blocked), true, `Expected ${blocked} to be blocked`);
  }

  for (const pub of ["8.8.8.8", "1.1.1.1", "151.101.1.69", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateOrReservedIp(pub), false, `Expected ${pub} to be allowed`);
  }
});

test("validateExternalImageUrl rejects non-HTTPS, credentials, custom ports, localhost, and private IPs", () => {
  assert.equal(validateExternalImageUrl("http://example.com/a.png").ok, false);
  assert.equal(validateExternalImageUrl("file:///etc/passwd").ok, false);
  assert.equal(validateExternalImageUrl("https://user:pass@example.com/a.png").ok, false);
  assert.equal(validateExternalImageUrl("https://example.com:8443/a.png").ok, false);
  assert.equal(validateExternalImageUrl("https://localhost/a.png").ok, false);
  assert.equal(validateExternalImageUrl("https://metadata.google.internal/a.png").ok, false);
  assert.equal(validateExternalImageUrl("https://169.254.169.254/latest").ok, false);
  assert.equal(validateExternalImageUrl("https://upload.wikimedia.org/image.png").ok, true);
});

test("normalizeAiArticleTranslations supports shorthand + bilingual mirroring + safety checks", () => {
  const shorthand = aiCreateArticleSchema.parse({
    locale: "en",
    title: "Topological Quantum Error Correction",
    excerpt: "Surface codes and anyonic braiding.",
    content: "## Surface Codes\n\nThreshold accuracy $p_{th} \\approx 1\\%$.",
  });
  const res1 = normalizeAiArticleTranslations(shorthand);
  assert.equal(res1.ok, true);
  if (res1.ok) {
    assert.equal(res1.value.en.slug, "topological-quantum-error-correction");
    assert.equal(res1.value.fa.slug, "topological-quantum-error-correction");
    assert.equal(res1.value.warnings.length, 1);
  }

  const strictMissing = aiCreateArticleSchema.parse({
    locale: "en",
    mirrorMissingLocale: false,
    title: "Strict Bilingual Test",
    content: "## Body\n\nContent.",
  });
  const res2 = normalizeAiArticleTranslations(strictMissing);
  assert.equal(res2.ok, false);

  const unsafeMdx = aiCreateArticleSchema.parse({
    locale: "en",
    title: "Malicious Article Attempt",
    content: "Hello <script>alert(1)</script>",
  });
  const res3 = normalizeAiArticleTranslations(unsafeMdx);
  assert.equal(res3.ok, false);
});

test("decodeBase64Image parses raw and data-uri payloads cleanly", () => {
  const tinyPngB64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  assert.ok(decodeBase64Image(tinyPngB64).length > 10);
  assert.ok(decodeBase64Image(`data:image/png;base64,${tinyPngB64}`).length > 10);
  assert.throws(() => decodeBase64Image("not valid base64 !!!"));
});

test("generateOpenApiSpec emits valid OpenAPI 3.1 schema with revisions, ETag/If-Match, and MCP endpoint", () => {
  const spec = generateOpenApiSpec("https://scienta.example.com/");
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.servers[0].url, "https://scienta.example.com");
  assert.ok("/api/v1/articles" in spec.paths);
  assert.ok("/api/v1/articles/{idOrSlug}/revisions" in spec.paths);
  assert.ok("/api/v1/media" in spec.paths);
  assert.ok("/api/v1/taxonomy" in spec.paths);
  assert.ok("BearerAuth" in spec.components.securitySchemes);
  assert.equal(spec["x-scienta-mcp-endpoint"], "https://scienta.example.com/api/v1/mcp");
});

test("computeArticleEtag and matchesIfMatchHeader enforce optimistic concurrency accurately", () => {
  const etag1 = computeArticleEtag("art-1", "2026-11-19 12:00:00");
  const etag2 = computeArticleEtag("art-1", "2026-11-19 12:05:00");
  assert.notEqual(etag1, etag2);
  assert.equal(matchesIfMatchHeader(null, etag1), true);
  assert.equal(matchesIfMatchHeader("*", etag1), true);
  assert.equal(matchesIfMatchHeader(etag1, etag1), true);
  // Weak vs strong tag equivalence
  assert.equal(matchesIfMatchHeader(etag1.replace(/^W\//, ""), etag1), true);
  assert.equal(matchesIfMatchHeader(`"other", ${etag1}`, etag1), true);
  assert.equal(matchesIfMatchHeader(etag2, etag1), false);
});

test("readTextBodyWithLimit enforces byte cap via Content-Length and streaming body", async () => {
  const okReq = new Request("https://example.com/api/v1/articles", {
    method: "POST",
    body: JSON.stringify({ hello: "world" }),
  });
  const okRes = await readTextBodyWithLimit(okReq, 1024);
  assert.equal(okRes.ok, true);

  const oversizedReq = new Request("https://example.com/api/v1/articles", {
    method: "POST",
    body: "x".repeat(2048),
  });
  const bigRes = await readTextBodyWithLimit(oversizedReq, 512);
  assert.equal(bigRes.ok, false);

  const headerOversized = new Request("https://example.com/api/v1/articles", {
    method: "POST",
    headers: { "content-length": "9999999" },
    body: "{}",
  });
  const headerRes = await readTextBodyWithLimit(headerOversized, 1024);
  assert.equal(headerRes.ok, false);
});

test("lintMdxEditorialQuality catches unbalanced math, missing headings, short excerpt, and missing cover", () => {
  const warnings = lintMdxEditorialQuality({
    locale: "en",
    content: "Plain paragraph with broken math $$E=mc^2 without closing delimiter.",
    excerpt: "Short",
    hasCover: false,
  });
  assert.equal(warnings.length, 4);

  const clean = lintMdxEditorialQuality({
    locale: "en",
    content: "## Quantum Decoherence\n\n$$\\rho(t) = e^{-iHt}\\rho(0)e^{iHt}$$\n\nDetailed derivation.",
    excerpt: "A complete explanation of environment-induced superselection and decoherence times.",
    hasCover: true,
  });
  assert.equal(clean.length, 0);
});

test("aiCreateArticleSchema supports conflictStrategy defaulting to error and accepting suffix", () => {
  const def = aiCreateArticleSchema.parse({ locale: "en", title: "Alpha Title", content: "Body" });
  assert.equal(def.conflictStrategy, "error");
  const suf = aiCreateArticleSchema.parse({
    locale: "en",
    title: "Alpha Title",
    content: "Body",
    conflictStrategy: "suffix",
  });
  assert.equal(suf.conflictStrategy, "suffix");
});

test("RBAC grants api_keys.manage to super_admin and admin only", () => {
  assert.equal(can("super_admin", "api_keys.manage"), true);
  assert.equal(can("admin", "api_keys.manage"), true);
  assert.equal(can("editor", "api_keys.manage"), false);
});

test("SQLite fallback initializes api_keys and api_idempotency_keys tables cleanly", () => {
  const db = new SqliteFallbackDb(":memory:");
  const tables = db
    .query<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('api_keys', 'api_idempotency_keys')`)
    .map((r) => r.name);
  assert.ok(tables.includes("api_keys"));
  assert.ok(tables.includes("api_idempotency_keys"));
  db.close();
});
