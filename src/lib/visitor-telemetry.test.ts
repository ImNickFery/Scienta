import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateVisitorIntelligence,
  buildPrivacyVisitorHash,
  classifyTrafficSource,
  detectCountryInfo,
  isBotUserAgent,
  parseBrowserInfo,
  parseDeviceInfo,
  parseOsInfo,
  type StoredPageviewRow,
} from "./visitor-telemetry";

test("detectCountryInfo prioritizes trusted CDN geo headers and falls back cleanly to timezone", () => {
  const cfHeaders = new Headers({
    "cf-ipcountry": "IR",
    "cf-ipcity": "Tehran",
    "cf-region": "Tehran",
  });
  const fromCf = detectCountryInfo({ headers: cfHeaders, timezone: "America/New_York" });
  assert.equal(fromCf.countryCode, "IR");
  assert.equal(fromCf.countryName, "Iran");
  assert.equal(fromCf.city, "Tehran");
  assert.equal(fromCf.geoSource, "edge-header");

  const emptyHeaders = new Headers();
  const fromTz = detectCountryInfo({ headers: emptyHeaders, timezone: "Europe/Berlin" });
  assert.equal(fromTz.countryCode, "DE");
  assert.equal(fromTz.countryName, "Germany");
  assert.equal(fromTz.geoSource, "timezone");

  const unknown = detectCountryInfo({ headers: emptyHeaders, timezone: "UTC" });
  assert.equal(unknown.countryCode, "ZZ");
  assert.equal(unknown.geoSource, "unknown");
});

test("parseBrowserInfo, parseOsInfo, and parseDeviceInfo parse desktop, mobile, and Persian-popular clients", () => {
  const samsungUa =
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
  assert.deepEqual(parseBrowserInfo(samsungUa), { name: "Samsung Internet", version: "25" });
  assert.deepEqual(parseOsInfo(samsungUa), { name: "Android", version: "14" });
  assert.deepEqual(parseDeviceInfo(samsungUa, 390), {
    deviceType: "mobile",
    vendor: "Samsung",
    screenBucket: "Mobile (<640px)",
  });

  const safariIosUa =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
  assert.deepEqual(parseBrowserInfo(safariIosUa), { name: "Safari", version: "18" });
  assert.deepEqual(parseOsInfo(safariIosUa), { name: "iOS", version: "18" });
  assert.equal(parseDeviceInfo(safariIosUa, 414).vendor, "Apple");

  const edgeWinUa =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
  assert.deepEqual(parseBrowserInfo(edgeWinUa), { name: "Edge", version: "131" });
  assert.deepEqual(parseOsInfo(edgeWinUa), { name: "Windows", version: "10/11" });
  assert.equal(parseDeviceInfo(edgeWinUa, 1920).screenBucket, "Wide (1920px+)");

  assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isBotUserAgent(safariIosUa), false);
});

test("classifyTrafficSource distinguishes search engines, AI answer engines, social, UTM, and direct", () => {
  const google = classifyTrafficSource({
    referrer: "https://www.google.com/search?q=quantum+gravity",
    siteHost: "scienta.ir",
  });
  assert.equal(google.channel, "search");
  assert.equal(google.searchEngine, "Google");

  const scholar = classifyTrafficSource({
    referrer: "https://scholar.google.com/scholar?q=hawking",
    siteHost: "scienta.ir",
  });
  assert.equal(scholar.channel, "search");
  assert.equal(scholar.searchEngine, "Google Scholar");

  const perplexity = classifyTrafficSource({
    referrer: "https://www.perplexity.ai/search/black-holes",
    siteHost: "scienta.ir",
  });
  assert.equal(perplexity.channel, "ai_search");
  assert.equal(perplexity.searchEngine, "Perplexity");

  const gemini = classifyTrafficSource({
    referrer: "https://gemini.google.com/app",
    siteHost: "scienta.ir",
  });
  assert.equal(gemini.channel, "ai_search");
  assert.equal(gemini.searchEngine, "Gemini");

  const telegram = classifyTrafficSource({
    referrer: "https://t.me/scienta_ir",
    siteHost: "scienta.ir",
  });
  assert.equal(telegram.channel, "social");
  assert.equal(telegram.searchEngine, null);

  const utm = classifyTrafficSource({
    referrer: "",
    siteHost: "scienta.ir",
    utmSource: "newsletter",
    utmMedium: "email",
    utmCampaign: "winter_issue",
  });
  assert.equal(utm.channel, "campaign");
  assert.equal(utm.utmCampaign, "winter_issue");
});

test("aggregateVisitorIntelligence computes multi-dimensional breakdowns, bot exclusion, and cross-filtering", () => {
  const rows: StoredPageviewRow[] = [
    {
      id: "1",
      article_id: "a1",
      locale: "fa",
      path: "/fa/articles/black-holes",
      referrer_host: "google.com",
      device_type: "mobile",
      country_code: "IR",
      country_name: "Iran",
      city: "Tehran",
      traffic_channel: "search",
      search_engine: "Google",
      browser_name: "Chrome",
      browser_version: "131",
      os_name: "Android",
      os_version: "14",
      device_vendor: "Samsung",
      screen_bucket: "Mobile (<640px)",
      browser_lang: "fa-IR",
      visitor_hash: "v1",
      is_bot: 0,
      created_at: "2026-11-25 10:15:00",
    },
    {
      id: "2",
      article_id: "a2",
      locale: "fa",
      path: "/fa/articles/quantum",
      referrer_host: "google.com",
      device_type: "mobile",
      country_code: "IR",
      country_name: "Iran",
      city: "Tehran",
      traffic_channel: "search",
      search_engine: "Google",
      browser_name: "Chrome",
      browser_version: "131",
      os_name: "Android",
      os_version: "14",
      device_vendor: "Samsung",
      screen_bucket: "Mobile (<640px)",
      browser_lang: "fa-IR",
      visitor_hash: "v1",
      is_bot: 0,
      created_at: "2026-11-25 10:20:00",
    },
    {
      id: "3",
      article_id: "a1",
      locale: "en",
      path: "/en/articles/black-holes",
      referrer_host: "perplexity.ai",
      device_type: "desktop",
      country_code: "DE",
      country_name: "Germany",
      city: "Berlin",
      traffic_channel: "ai_search",
      search_engine: "Perplexity",
      browser_name: "Safari",
      browser_version: "18",
      os_name: "macOS",
      os_version: "15.1",
      device_vendor: "Apple",
      screen_bucket: "Desktop (1440-1920px)",
      browser_lang: "en-US",
      visitor_hash: "v2",
      is_bot: 0,
      created_at: "2026-11-25 14:05:00",
    },
    {
      id: "4",
      article_id: "a1",
      locale: "en",
      path: "/en/articles/black-holes",
      referrer_host: "Direct",
      device_type: "desktop",
      country_code: "US",
      traffic_channel: "direct",
      browser_name: "Other",
      os_name: "Linux",
      visitor_hash: "bot1",
      is_bot: 1,
      created_at: "2026-11-25 14:10:00",
    },
  ];

  const summary = aggregateVisitorIntelligence(rows);
  assert.equal(summary.botHitsExcluded, 1);
  assert.equal(summary.totalPageviews, 3);
  assert.equal(summary.uniqueVisitors, 2);
  assert.equal(summary.viewsPerVisitor, 1.5);
  assert.equal(summary.singlePageRatePct, 50);
  assert.equal(summary.countriesCount, 2);
  assert.equal(summary.countries[0].code, "IR");
  assert.equal(summary.countries[0].pageviews, 2);
  assert.equal(summary.countries[0].topCity, "Tehran");
  assert.equal(summary.searchEngines[0].label, "Google");
  assert.equal(summary.searchEngines[1].label, "Perplexity");
  assert.equal(summary.hourlyDistribution[10].pageviews, 2);
  assert.equal(summary.hourlyDistribution[14].pageviews, 1);

  // Cross-filtering by country narrows all metrics cleanly
  const deOnly = aggregateVisitorIntelligence(rows, { country: "DE" });
  assert.equal(deOnly.totalPageviews, 1);
  assert.equal(deOnly.uniqueVisitors, 1);
  assert.equal(deOnly.browsers[0].label, "Safari");
  assert.equal(deOnly.operatingSystems[0].label, "macOS");
});

test("buildPrivacyVisitorHash rotates daily and never exposes raw IP", () => {
  const h1 = buildPrivacyVisitorHash("203.0.113.5", "Chrome/131", "2026-11-25", "secret-salt");
  const h2 = buildPrivacyVisitorHash("203.0.113.5", "Chrome/131", "2026-11-26", "secret-salt");
  assert.equal(h1.length, 24);
  assert.notEqual(h1, h2);
  assert.ok(!h1.includes("203.0.113.5"));
});
