import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidCommentStatus,
  parseCommentMathSegments,
  validateCommentSubmission,
} from "./comments";
import { SqliteFallbackDb } from "./sqlite-fallback";

test("parseCommentMathSegments cleanly separates plain text, inline math, display math, and escaped dollar signs", () => {
  const input =
    "انرژی با $E = mc^2$ برابر است و قیمت \\$50 نیست. معادله کامل: $$G_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}$$ پایان.";
  const segments = parseCommentMathSegments(input);

  assert.deepEqual(segments, [
    { type: "text", value: "انرژی با " },
    { type: "math", value: "E = mc^2", display: false },
    { type: "text", value: " برابر است و قیمت $50 نیست. معادله کامل: " },
    { type: "math", value: "G_{\\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\\mu\\nu}", display: true },
    { type: "text", value: " پایان." },
  ]);
});

test("parseCommentMathSegments ignores currency whitespace and unclosed delimiters safely", () => {
  const input = "Cost is $ 100 or $200 without closing and $a + b$ works.";
  const segments = parseCommentMathSegments(input);

  assert.equal(segments.filter((s) => s.type === "math").length, 1);
  assert.deepEqual(segments.find((s) => s.type === "math"), {
    type: "math",
    value: "a + b",
    display: false,
  });
});

test("validateCommentSubmission enforces honeypot, email, length bounds, and defaults locale cleanly", () => {
  const valid = validateCommentSubmission({
    articleId: "art-1",
    locale: "fa",
    name: "دکتر سارا احمدی",
    email: "SARA@Example.EDU",
    content: "آیا $r_s = 2GM/c^2$ برای جرم چرخان تغییر می‌کند؟",
    isQuestion: true,
    website: "",
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.email, "sara@example.edu");
    assert.equal(valid.data.isQuestion, true);
    assert.equal(valid.data.locale, "fa");
  }

  const bot = validateCommentSubmission({
    articleId: "art-1",
    name: "Spammer",
    email: "bot@spam.test",
    content: "Buy links here",
    website: "https://spam.example",
  });
  assert.equal(bot.ok, false);

  const badEmail = validateCommentSubmission({
    articleId: "art-1",
    name: "Reader",
    email: "not-an-email",
    content: "Thoughtful comment here",
  });
  assert.equal(badEmail.ok, false);

  const tooShort = validateCommentSubmission({
    articleId: "art-1",
    name: "Reader",
    email: "reader@example.com",
    content: "hi",
  });
  assert.equal(tooShort.ok, false);

  assert.equal(isValidCommentStatus("approved"), true);
  assert.equal(isValidCommentStatus("pending"), true);
  assert.equal(isValidCommentStatus("rejected"), true);
  assert.equal(isValidCommentStatus("spam"), false);
});

test("SqliteFallbackDb migrates comments schema, seeds KaTeX comments, and exposes tag slugs", () => {
  const db = new SqliteFallbackDb(":memory:");
  try {
    const comments = db.query<{ status: string; locale: string; is_question: number; admin_reply: string | null }>(
      `SELECT status, locale, is_question, admin_reply FROM comments`
    );
    assert.ok(comments.length >= 3, "expected at least 3 seeded scientific comments");
    assert.ok(comments.some((c) => c.status === "approved" && c.locale === "fa" && c.admin_reply));
    assert.ok(comments.some((c) => c.status === "pending"));

    const tags = db.query<{ slug: string; name_fa: string; name_en: string }>(
      `SELECT slug, name_fa, name_en FROM tags`
    );
    assert.ok(tags.length >= 3, "expected seeded tags with slugs");
    assert.ok(tags.every((t) => Boolean(t.slug && t.name_fa && t.name_en)));
  } finally {
    db.close();
  }
});
