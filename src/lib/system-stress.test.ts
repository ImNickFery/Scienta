import test from "node:test";
import assert from "node:assert/strict";
import { v4 as uuid } from "uuid";
import { SqliteFallbackDb } from "./sqlite-fallback";
import {
  isArticleSlugConflictError,
  parseSqlUtcDate,
  toSqlUtcDateTime,
} from "./sql-dates";
import {
  sanitizeAdminRedirect,
  sanitizeMathComment,
  sanitizeUrl,
  validateMdxSafety,
} from "./security";
import { isPrivateOrReservedIp, validateExternalImageUrl } from "./ai-api-media";
import { extractKnownSymbols } from "./equation-parser";
import { generateSlug } from "./sanitize";
import { rateLimit } from "./rate-limit";
import { remarkStrictStaticMdx, validateMdxEstreeExpression } from "./mdx-safety-ast";
import { v1Headers } from "./ai-api-auth";
import { can } from "./rbac";
import { signAccessToken, verifyAccessToken } from "./auth";

test("SqliteFallbackDb.withTransaction safely serializes 24 concurrent async transactions with partial rollbacks", async () => {
  const db = new SqliteFallbackDb(":memory:");
  try {
    const jobs = Array.from({ length: 24 }, (_, idx) => {
      const shouldFail = idx % 4 === 0;
      const slug = `stress-tag-${idx}`;
      return db
        .withTransaction(async (conn) => {
          await conn.execute(
            `INSERT INTO tags (id, slug, name_fa, name_en) VALUES (?, ?, ?, ?)`,
            [uuid(), slug, `تگ ${idx}`, `Tag ${idx}`]
          );
          // Yield across timers/microtasks to force maximum concurrency overlap
          await new Promise((resolve) => setTimeout(resolve, (idx % 5) + 1));
          if (shouldFail) {
            throw new Error(`Intentional rollback #${idx}`);
          }
          return slug;
        })
        .then(
          (value) => ({ ok: true as const, value }),
          (err: unknown) => ({
            ok: false as const,
            message: err instanceof Error ? err.message : String(err),
          })
        );
    });

    const results = await Promise.all(jobs);
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    assert.equal(succeeded.length, 18, "Expected 18 committed transactions");
    assert.equal(failed.length, 6, "Expected 6 intentionally rolled-back transactions");
    for (const f of failed) {
      assert.match(f.message, /Intentional rollback/, "Unexpected SQLite concurrency error");
    }

    const rows = db.query<{ slug: string }>(
      `SELECT slug FROM tags WHERE slug LIKE 'stress-tag-%'`
    );
    assert.equal(rows.length, 18, "Committed rows must match exactly with zero leaked rollbacks");
    for (let i = 0; i < 24; i += 4) {
      assert.ok(
        !rows.some((r) => r.slug === `stress-tag-${i}`),
        `Rolled-back row stress-tag-${i} must not exist`
      );
    }
  } finally {
    db.close();
  }
});

test("SQL UTC datetime normalization makes scheduled_at comparisons accurate in SQLite", () => {
  assert.equal(toSqlUtcDateTime("2026-11-24T12:34:56.789Z"), "2026-11-24 12:34:56");
  assert.equal(toSqlUtcDateTime("2026-11-24T16:04:56+03:30"), "2026-11-24 12:34:56");
  assert.equal(toSqlUtcDateTime("2026-11-24 12:34:56"), "2026-11-24 12:34:56");
  assert.equal(toSqlUtcDateTime(null), null);
  assert.equal(toSqlUtcDateTime("not-a-date"), null);

  const parsedSql = parseSqlUtcDate("2026-11-24 12:34:56");
  assert.ok(parsedSql);
  assert.equal(parsedSql.toISOString(), "2026-11-24T12:34:56.000Z");

  const parsedIso = parseSqlUtcDate("2026-11-24T12:34:56Z");
  assert.ok(parsedIso);
  assert.equal(parsedIso.toISOString(), "2026-11-24T12:34:56.000Z");
  assert.equal(parseSqlUtcDate(""), null);

  // End-to-end SQLite boundary test: past scheduled article is live, future scheduled is hidden
  const db = new SqliteFallbackDb(":memory:");
  try {
    const pastId = uuid();
    const futureId = uuid();
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const futureIso = new Date(Date.now() + 3600_000).toISOString();

    db.execute(
      `INSERT INTO articles (id, status, scheduled_at) VALUES (?, 'scheduled', ?)`,
      [pastId, toSqlUtcDateTime(pastIso)]
    );
    db.execute(
      `INSERT INTO articles (id, status, scheduled_at) VALUES (?, 'scheduled', ?)`,
      [futureId, toSqlUtcDateTime(futureIso)]
    );

    const liveRows = db.query<{ id: string }>(
      `SELECT id FROM articles
        WHERE id IN (?, ?)
          AND status = 'scheduled'
          AND scheduled_at IS NOT NULL
          AND scheduled_at <= NOW()`,
      [pastId, futureId]
    );
    assert.deepEqual(
      liveRows.map((r) => r.id),
      [pastId]
    );
  } finally {
    db.close();
  }
});

test("isArticleSlugConflictError detects both MySQL and SQLite unique slug errors", () => {
  assert.equal(
    isArticleSlugConflictError(new Error("Duplicate entry 'en-test' for key 'article_translations.uq_locale_slug'")),
    true
  );
  assert.equal(
    isArticleSlugConflictError(
      new Error("UNIQUE constraint failed: article_translations.locale, article_translations.slug")
    ),
    true
  );
  assert.equal(isArticleSlugConflictError(new Error("FOREIGN KEY constraint failed")), false);
});

test("validateMdxSafety blocks currency/dollar-wrapped JSX bypasses while allowing math and fenced code", () => {
  const bypassAttempts = [
    "Price is $5 {process.env.JWT_SECRET} and $10",
    "Equation $$a + b {globalThis.process} c$$",
    "$1 <script>alert(1)</script> $2",
    "Inline {({}).constructor['constructor']('return 1')()}",
    "<div onMouseEnter={() => eval('1')}>hover</div>",
    "Check ```not-a-fence``` {require('fs')}",
  ];

  for (const payload of bypassAttempts) {
    const result = validateMdxSafety(payload);
    assert.equal(result.safe, false, `Expected bypass payload to be blocked: ${payload}`);
  }

  const safeScientificMdx = `
# Einstein Field Equations

In general relativity, curvature relates to energy via $G_{\\mu\\nu} + \\Lambda g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}$.

$$
R_{\\mu\\nu} - \\frac{1}{2} R g_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}
$$

\`\`\`javascript
// Legitimate fenced code example
const key = process.env.DEMO_KEY;
\`\`\`
`;
  assert.deepEqual(validateMdxSafety(safeScientificMdx), { safe: true });
});

test("SSRF & URL sanitizers reject private/metadata IPs, IPv4-mapped IPv6, and malicious schemes", () => {
  const blockedIps = [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.5.10",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
  ];
  for (const ip of blockedIps) {
    assert.equal(isPrivateOrReservedIp(ip), true, `Expected IP ${ip} to be rejected`);
  }
  assert.equal(isPrivateOrReservedIp("93.184.216.34"), false);

  const blockedUrls = [
    "http://images.example.com/a.png",
    "https://localhost/a.png",
    "https://127.0.0.1/a.png",
    "https://169.254.169.254/latest/meta-data/",
    "https://user:pass@images.example.com/a.png",
    "file:///etc/passwd",
    "javascript:alert(1)",
  ];
  for (const url of blockedUrls) {
    assert.equal(validateExternalImageUrl(url).ok, false, `Expected external URL to fail: ${url}`);
  }
  assert.equal(validateExternalImageUrl("https://images.unsplash.com/photo-1.webp").ok, true);

  // Additional fuzzing on sanitizeUrl, sanitizeAdminRedirect, and sanitizeMathComment
  assert.equal(sanitizeUrl("https://example.com/\r\ninjected"), null);
  assert.equal(sanitizeAdminRedirect("/admin/articles\nfoo"), "/admin/dashboard");
  const cleanComment = sanitizeMathComment("For $x < y < z$, <svg onload=alert(1)>nice</svg>!");
  assert.ok(cleanComment.includes("$x < y < z$"));
  assert.ok(!cleanComment.includes("<svg"));
});

test("Equation parser, bilingual slug generator, and rate limiter withstand stress inputs", () => {
  const symbols = extractKnownSymbols(
    String.raw`r_s = \frac{2GM}{c^2}, \quad i\hbar\frac{\partial \psi}{\partial t} = \hat{H}\psi, \quad \alpha + \pi`
  );
  assert.ok(symbols.length >= 4, "Should recognize multiple physics constants/symbols");
  // Malformed LaTeX must never throw
  assert.doesNotThrow(() => extractKnownSymbols("\\frac{{{$$$$\\invalidcommand"));

  // Persian/Unicode slug stress
  const faSlug = generateSlug("نسبیت عام: سیاه‌چاله‌ها و افق رویداد (۲۰۲۶)!", "fa");
  assert.ok(faSlug.length > 0 && !faSlug.includes(" ") && !faSlug.includes("!"));
  const enSlug = generateSlug("  Quantum Entanglement & Bell's Theorem — 2026!  ", "en");
  assert.equal(enSlug, "quantum-entanglement-and-bells-theorem-2026");

  // High-churn rate limit test
  const prefix = `stress-rl-${Date.now()}`;
  for (let i = 0; i < 200; i++) {
    const r = rateLimit(`${prefix}-${i}`, 3, 10_000);
    assert.equal(r.allowed, true);
    assert.equal(r.remaining, 2);
  }
  const hotKey = `${prefix}-hot`;
  for (let i = 0; i < 5; i++) {
    assert.equal(rateLimit(hotKey, 5, 10_000).allowed, true);
  }
  const blocked = rateLimit(hotKey, 5, 10_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds >= 1 && blocked.retryAfterSeconds <= 10);
});

test("AST-level MDX guard allows static JSON-like JSX props and blocks obfuscated JS execution", () => {
  // Static array-of-objects prop (used by <StatHighlight>, <Timeline>, <ComparisonCards>) must pass
  assert.doesNotThrow(() =>
    validateMdxEstreeExpression({
      type: "Program",
      body: [
        {
          type: "ExpressionStatement",
          expression: {
            type: "ArrayExpression",
            elements: [
              {
                type: "ObjectExpression",
                properties: [
                  {
                    type: "Property",
                    computed: false,
                    method: false,
                    shorthand: false,
                    kind: "init",
                    key: { type: "Identifier", name: "value" },
                    value: { type: "Literal", value: "150M K" },
                  },
                  {
                    type: "Property",
                    computed: false,
                    method: false,
                    shorthand: false,
                    kind: "init",
                    key: { type: "Identifier", name: "featured" },
                    value: { type: "Literal", value: true },
                  },
                ],
              },
            ],
          },
        },
      ],
    })
  );

  // Obfuscated string-concat + computed member call (`[]["at"]["const"+"ructor"]()`) must throw
  assert.throws(
    () =>
      validateMdxEstreeExpression({
        type: "Program",
        body: [
          {
            type: "ExpressionStatement",
            expression: {
              type: "CallExpression",
            },
          },
        ],
      }),
    /Unsafe MDX expression/
  );

  // Binary expression (`"const" + "ructor"`) must throw
  assert.throws(
    () =>
      validateMdxEstreeExpression({
        type: "Program",
        body: [
          {
            type: "ExpressionStatement",
            expression: {
              type: "BinaryExpression",
            },
          },
        ],
      }),
    /Unsafe MDX expression/
  );

  // Prototype-polluting object key (`__proto__`) must throw
  assert.throws(
    () =>
      validateMdxEstreeExpression({
        type: "Program",
        body: [
          {
            type: "ExpressionStatement",
            expression: {
              type: "ObjectExpression",
              properties: [
                {
                  type: "Property",
                  computed: false,
                  method: false,
                  shorthand: false,
                  kind: "init",
                  key: { type: "Identifier", name: "__proto__" },
                  value: { type: "Literal", value: "polluted" },
                },
              ],
            },
          },
        ],
      }),
    /forbidden property key/
  );

  const guard = remarkStrictStaticMdx();

  // JSX comment `{/* note */}` (empty ESTree body) is permitted
  assert.doesNotThrow(() =>
    guard({
      type: "root",
      children: [{ type: "mdxFlowExpression", data: { estree: { type: "Program", body: [] } } }],
    })
  );

  // Executable inline expression `{1 + 1}` or `{fetch(...)}` is blocked
  assert.throws(
    () =>
      guard({
        type: "root",
        children: [
          {
            type: "mdxTextExpression",
            data: { estree: { type: "Program", body: [{ type: "ExpressionStatement" }] } },
          },
        ],
      }),
    /Executable inline MDX/
  );

  // JSX spread attribute (`<div {...props} />`) is blocked
  assert.throws(
    () =>
      guard({
        type: "root",
        children: [
          {
            type: "mdxJsxFlowElement",
            name: "div",
            attributes: [{ type: "mdxJsxExpressionAttribute" }],
          },
        ],
      }),
    /JSX spread attributes/
  );

  // Event handler attribute (`onClick`) and forbidden tag (`<iframe />`) are blocked
  assert.throws(
    () =>
      guard({
        type: "root",
        children: [
          {
            type: "mdxJsxFlowElement",
            name: "Callout",
            attributes: [{ type: "mdxJsxAttribute", name: "onClick", value: "alert(1)" }],
          },
        ],
      }),
    /Unsafe JSX attribute/
  );
  assert.throws(
    () =>
      guard({
        type: "root",
        children: [{ type: "mdxJsxFlowElement", name: "iframe", attributes: [] }],
      }),
    /Unsafe HTML\/JSX tag/
  );
});

test("v1Headers omits wildcard CORS on authenticated endpoints and enforces explicit allowlist", () => {
  const prevAllowed = process.env.API_ALLOWED_ORIGINS;
  try {
    delete process.env.API_ALLOWED_ORIGINS;
    const defaultHeaders = v1Headers();
    assert.equal(defaultHeaders.get("Access-Control-Allow-Origin"), null);

    const publicHeaders = v1Headers(undefined, { publicCors: true });
    assert.equal(publicHeaders.get("Access-Control-Allow-Origin"), "*");

    process.env.API_ALLOWED_ORIGINS = "https://studio.scienta.ir, *";
    const allowedReq = new Request("https://scienta.ir/api/v1/me", {
      headers: { origin: "https://studio.scienta.ir" },
    });
    const matchedHeaders = v1Headers(undefined, { req: allowedReq });
    assert.equal(matchedHeaders.get("Access-Control-Allow-Origin"), "https://studio.scienta.ir");
    assert.equal(matchedHeaders.get("Vary"), "Origin");

    const evilReq = new Request("https://scienta.ir/api/v1/me", {
      headers: { origin: "https://evil.example" },
    });
    const blockedHeaders = v1Headers(undefined, { req: evilReq });
    assert.equal(blockedHeaders.get("Access-Control-Allow-Origin"), null);
  } finally {
    if (prevAllowed === undefined) delete process.env.API_ALLOWED_ORIGINS;
    else process.env.API_ALLOWED_ORIGINS = prevAllowed;
  }
});

test("RBAC restricts system.deploy exclusively to super_admin and ephemeral JWT secret works without hardcoded strings", async () => {
  assert.equal(can("super_admin", "system.deploy"), true);
  assert.equal(can("admin", "system.deploy"), false);
  assert.equal(can("editor", "system.deploy"), false);

  const prevSecret = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    const token = await signAccessToken({
      sub: "u-ephemeral",
      email: "admin@scienta.ir",
      name: "Admin",
      role: "super_admin",
    });
    const verified = await verifyAccessToken(token);
    assert.equal(verified?.sub, "u-ephemeral");
  } finally {
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  }
});
