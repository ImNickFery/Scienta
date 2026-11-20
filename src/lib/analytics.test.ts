import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClarityBootstrapScript,
  buildGa4BootstrapScript,
  buildGtmBootstrapScript,
  buildYandexMetrikaScript,
  getAnalyticsConfig,
  sanitizeClarityId,
  sanitizeGa4Id,
  sanitizeGtmId,
  sanitizeYandexMetrikaId,
} from "./analytics";

test("analytics ID sanitizers accept valid IDs and reject malformed or XSS payloads", () => {
  assert.equal(sanitizeGtmId(" gtm-ab12cd3 "), "GTM-AB12CD3");
  assert.equal(sanitizeGtmId("GTM-12"), null);
  assert.equal(sanitizeGtmId("GTM-12345';alert(1)//"), null);
  assert.equal(sanitizeGtmId("G-1234567890"), null);

  assert.equal(sanitizeGa4Id(" g-abc123def4 "), "G-ABC123DEF4");
  assert.equal(sanitizeGa4Id("G-123"), null);
  assert.equal(sanitizeGa4Id("G-123456<script>"), null);
  assert.equal(sanitizeGa4Id("UA-123456-1"), null);

  assert.equal(sanitizeClarityId(" m9x8k2p4q1 "), "m9x8k2p4q1");
  assert.equal(sanitizeClarityId("abc"), null);
  assert.equal(sanitizeClarityId("abc123;alert(1)"), null);

  assert.equal(sanitizeYandexMetrikaId(" 98765432 "), "98765432");
  assert.equal(sanitizeYandexMetrikaId("123"), null);
  assert.equal(sanitizeYandexMetrikaId("98765432);alert(1)"), null);
  assert.equal(sanitizeYandexMetrikaId(undefined), null);
});

test("getAnalyticsConfig prefers server runtime env vars and falls back to NEXT_PUBLIC aliases", () => {
  assert.deepEqual(getAnalyticsConfig({}), {
    gtmId: null,
    ga4Id: null,
    clarityId: null,
    yandexMetrikaId: null,
  });

  assert.deepEqual(
    getAnalyticsConfig({
      GTM_ID: "GTM-LIVE999",
      NEXT_PUBLIC_GTM_ID: "GTM-OLD1111",
      NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST123456",
      CLARITY_ID: "clar123456",
      YANDEX_METRIKA_ID: "98765432",
    }),
    {
      gtmId: "GTM-LIVE999",
      ga4Id: "G-TEST123456",
      clarityId: "clar123456",
      yandexMetrikaId: "98765432",
    }
  );
});

test("bootstrap script builders emit valid scripts only for sanitized IDs", () => {
  const gtm = buildGtmBootstrapScript("gtm-xyz1234");
  assert.ok(gtm.includes("https://www.googletagmanager.com/gtm.js?id="));
  assert.ok(gtm.includes('"GTM-XYZ1234"'));
  assert.equal(buildGtmBootstrapScript("bad-id"), "");

  const ga4 = buildGa4BootstrapScript("g-meas123456");
  assert.ok(ga4.includes("gtag('config',\"G-MEAS123456\""));
  assert.ok(ga4.includes("anonymize_ip:true"));
  assert.equal(buildGa4BootstrapScript("bad"), "");

  const clarity = buildClarityBootstrapScript("proj987654");
  assert.ok(clarity.includes("https://www.clarity.ms/tag/"));
  assert.ok(clarity.includes('"proj987654"'));
  assert.equal(buildClarityBootstrapScript("<script>"), "");

  const ym = buildYandexMetrikaScript("98765432");
  assert.ok(ym.includes("https://mc.yandex.ru/metrika/tag.js"));
  assert.ok(ym.includes('ym(98765432,"init"'));
  assert.equal(buildYandexMetrikaScript("not-a-number"), "");
});
