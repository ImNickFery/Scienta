import test from "node:test";
import assert from "node:assert/strict";
import {
  assertNoHeaderInjection,
  computeEmailStats,
  decryptEmailSecret,
  encryptEmailSecret,
  extractTemplateVariables,
  htmlToPlainText,
  isValidEmailAddress,
  parseRecipientList,
  renderEmailTemplate,
  sanitizeEmailHtml,
  validateSmtpHost,
  wrapEmailLayout,
} from "./email-core";

test("isValidEmailAddress and parseRecipientList normalize, deduplicate, and reject invalid entries", () => {
  assert.equal(isValidEmailAddress("editor@scienta.org"), true);
  assert.equal(isValidEmailAddress("bad\r\nBcc:evil@x.com"), false);
  assert.equal(isValidEmailAddress("not-an-email"), false);

  const parsed = parseRecipientList(
    "Alice <ALICE@example.com>, bob@example.org;\nalice@example.com, invalid-addr, carol@uni.edu"
  );
  assert.deepEqual(parsed.valid, ["alice@example.com", "bob@example.org", "carol@uni.edu"]);
  assert.deepEqual(parsed.invalid, ["invalid-addr"]);
});

test("assertNoHeaderInjection rejects CRLF and NUL injection attempts", () => {
  assert.equal(assertNoHeaderInjection("  Weekly Digest  ", "subject"), "Weekly Digest");
  assert.throws(() => assertNoHeaderInjection("Hello\r\nBcc: attacker@evil.com", "subject"));
  assert.throws(() => assertNoHeaderInjection("Hello\nX-Injected: 1", "subject"));
  assert.throws(() => assertNoHeaderInjection("Hello\0World", "fromName"));
});

test("validateSmtpHost blocks metadata/unroutable SSRF targets and allows valid mail relays", () => {
  assert.equal(validateSmtpHost("smtp.gmail.com").ok, true);
  assert.equal(validateSmtpHost("mail.scienta.ir").ok, true);

  assert.equal(validateSmtpHost("169.254.169.254").ok, false);
  assert.equal(validateSmtpHost("metadata.google.internal").ok, false);
  assert.equal(validateSmtpHost("0.0.0.0").ok, false);
  assert.equal(validateSmtpHost("https://smtp.gmail.com").ok, false);
  assert.equal(validateSmtpHost("smtp.gmail.com; rm -rf /").ok, false);
});

test("sanitizeEmailHtml strips scripts, event handlers, iframes, and javascript URLs while keeping safe markup", () => {
  const dirty = `
    <h1 style="color:#f8fafc">Scientific Digest</h1>
    <script>alert('xss')</script>
    <iframe src="https://evil.test"></iframe>
    <img src="x" onerror="alert(1)" />
    <a href="javascript:alert(2)">Bad Link</a>
    <a href="https://scienta.org/en" style="color:#a78bfa">Read Article</a>
  `;
  const clean = sanitizeEmailHtml(dirty);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /<iframe/i);
  assert.doesNotMatch(clean, /onerror/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.match(clean, /<h1[^>]*>Scientific Digest<\/h1>/);
  assert.match(clean, /href="https:\/\/scienta\.org\/en"/);
});

test("renderEmailTemplate escapes HTML variables safely and extractTemplateVariables finds unique tokens", () => {
  const tpl = "<p>Hello {{recipient_name}} on {{date}} — {{recipient_name}}</p>";
  assert.deepEqual(extractTemplateVariables(tpl), ["recipient_name", "date"]);

  const rendered = renderEmailTemplate(tpl, {
    recipient_name: '<script>alert("x")</script>',
    date: "2026-11-25",
  });
  assert.doesNotMatch(rendered, /<script>/);
  assert.match(rendered, /&lt;script&gt;/);
  assert.match(rendered, /2026-11-25/);
});

test("htmlToPlainText and wrapEmailLayout produce clean RTL/LTR outputs", () => {
  const txt = htmlToPlainText('<h1>Title</h1><p>Visit <a href="https://scienta.org">Scienta</a></p>');
  assert.match(txt, /Title/);
  assert.match(txt, /Scienta \(https:\/\/scienta\.org\)/);

  const wrapped = wrapEmailLayout({
    bodyHtml: "<p>سلام علمی</p><script>bad()</script>",
    direction: "rtl",
    fromName: "Scienta",
    preheader: "خلاصه ایمیل",
    unsubscribeUrl: "https://scienta.org/fa",
  });
  assert.match(wrapped, /dir="rtl"/);
  assert.match(wrapped, /سلام علمی/);
  assert.doesNotMatch(wrapped, /<script>/i);
  assert.match(wrapped, /لغو عضویت/);
});

test("encryptEmailSecret / decryptEmailSecret round-trips with AES-256-GCM", () => {
  const secretKey = "unit-test-master-secret-at-least-32-chars!!";
  const encrypted = encryptEmailSecret("super-smtp-app-password-99", secretKey);
  assert.ok(encrypted.startsWith("v1:"));
  assert.notEqual(encrypted, "super-smtp-app-password-99");
  assert.equal(decryptEmailSecret(encrypted, secretKey), "super-smtp-app-password-99");
  // Wrong key returns empty string instead of throwing
  assert.equal(decryptEmailSecret(encrypted, "wrong-key-material-0000000000000000"), "");
});

test("computeEmailStats calculates delivery rate accurately", () => {
  const stats = computeEmailStats({ sent: 18, sandbox: 2, failed: 5, suppressed: 3 });
  assert.equal(stats.totalDelivered, 20);
  assert.equal(stats.totalLogged, 28);
  assert.equal(stats.deliveryRate, 80);
});
