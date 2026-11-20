import test from "node:test";
import assert from "node:assert/strict";
import {
  SITE_DESCRIPTION_EN,
  SITE_DESCRIPTION_FA,
  SITE_TITLE_EN,
  SITE_TITLE_FA,
  SITE_URL,
  aboutPageJsonLd,
  articleJsonLd,
  authorProfileJsonLd,
  breadcrumbJsonLd,
  buildArticleMetadata,
  buildBaseMetadata,
  buildPageMetadata,
  collectionPageJsonLd,
  contactPageJsonLd,
  estimateWordCount,
  getSiteVerification,
  organizationJsonLd,
  websiteJsonLd,
} from "./seo";
import robots from "@/app/robots";
import manifest from "@/app/manifest";
import type { Article, Author } from "@/types";

const sampleArticle: Article = {
  id: "art-1",
  slug: "standard-model-symmetries",
  locale: "en",
  title: "Gauge Symmetries of the Standard Model",
  excerpt: "How SU(3) x SU(2) x U(1) invariance predicts fundamental forces and particle interactions.",
  cover: "/uploads/standard-model.webp",
  field: "physics",
  fieldColor: "#7B3FFB",
  tags: ["Gauge Theory", "Particle Physics"],
  authorSlug: "sara-ahmadi",
  authorName: "Sara Ahmadi",
  publishedAt: "2026-08-01T10:00:00Z",
  updatedAt: "2026-08-05T12:00:00Z",
  views: 420,
  content: "# Introduction\n\nSymmetry governs **fundamental physics**.\n\n$$\\mathcal{L} = -\\frac{1}{4} F_{\\mu\\nu} F^{\\mu\\nu}$$\n\n```python\nprint('hi')\n```\n\nEvery conservation law mirrors a continuous symmetry.",
  readingTimeMinutes: 7,
  twitterCard: "summary_large_image",
};

const sampleAuthor: Author = {
  slug: "sara-ahmadi",
  name: { fa: "سارا احمدی", en: "Sara Ahmadi" },
  title: { fa: "پژوهشگر فیزیک نظری", en: "Theoretical Physics Researcher" },
  bio: { fa: "پژوهشگر در حوزه نظریه میدان‌های کوانتومی.", en: "Researcher in quantum field theory." },
  avatar: "",
  social: { twitter: "https://x.com/saraahmadi", github: "https://github.com/saraahmadi" },
};

test("default titles and meta descriptions satisfy SEO snippet length guidelines", () => {
  assert.ok(SITE_TITLE_EN.length >= 30 && SITE_TITLE_EN.length <= 65);
  assert.ok(SITE_TITLE_FA.length >= 30 && SITE_TITLE_FA.length <= 65);
  assert.ok(SITE_DESCRIPTION_EN.length >= 120 && SITE_DESCRIPTION_EN.length <= 165);
  assert.ok(SITE_DESCRIPTION_FA.length >= 120 && SITE_DESCRIPTION_FA.length <= 165);
});

test("buildBaseMetadata emits bilingual hreflang with x-default, OG/Twitter images, and Discover robots", () => {
  const meta = buildBaseMetadata("fa");
  assert.equal(meta.alternates?.canonical, `${SITE_URL}/fa`);
  assert.deepEqual(meta.alternates?.languages, {
    fa: `${SITE_URL}/fa`,
    en: `${SITE_URL}/en`,
    "x-default": `${SITE_URL}/fa`,
  });
  assert.equal(meta.openGraph?.locale, "fa_IR");
  assert.deepEqual(meta.openGraph?.alternateLocale, ["en_US"]);
  assert.ok(Array.isArray(meta.openGraph?.images) && meta.openGraph.images.length === 1);
  assert.ok(meta.twitter && "images" in meta.twitter && Array.isArray(meta.twitter.images));
  assert.deepEqual(meta.robots, {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  });
});

test("buildPageMetadata syncs OG/Twitter title & description, supports noIndex and disabling alternates", () => {
  const searchMeta = buildPageMetadata("en", "/search", {
    title: "Search",
    description: "Search across all Scienta scientific essays.",
    noIndex: true,
  });
  assert.equal(searchMeta.title, "Search");
  assert.equal(searchMeta.openGraph?.title, "Search — Scienta");
  assert.equal(searchMeta.openGraph?.description, "Search across all Scienta scientific essays.");
  assert.equal(searchMeta.twitter?.title, "Search — Scienta");
  assert.deepEqual(searchMeta.robots, {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  });

  const catMeta = buildPageMetadata("fa", "/categories/%DA%A9%D9%88%D8%A7%D9%86%D8%AA%D9%88%D9%85", {
    title: "کوانتوم",
    description: "مقالات علمی کوانتوم",
    includeAlternates: false,
  });
  assert.equal(catMeta.alternates?.languages, undefined);
});

test("buildArticleMetadata includes cover + OG image, Google Scholar citation tags, and x-default hreflang", () => {
  const meta = buildArticleMetadata(
    "en",
    sampleArticle,
    { en: "standard-model-symmetries", fa: "تقارن-مدل-استاندارد" },
    "Physics"
  );
  assert.equal(meta.alternates?.canonical, `${SITE_URL}/en/articles/standard-model-symmetries`);
  assert.deepEqual(meta.alternates?.languages, {
    fa: `${SITE_URL}/fa/articles/تقارن-مدل-استاندارد`,
    en: `${SITE_URL}/en/articles/standard-model-symmetries`,
    "x-default": `${SITE_URL}/fa/articles/تقارن-مدل-استاندارد`,
  });

  const ogImages = meta.openGraph?.images as Array<{ url: string }>;
  assert.equal(ogImages.length, 2);
  assert.equal(ogImages[0].url, `${SITE_URL}/uploads/standard-model.webp`);
  assert.equal(ogImages[1].url, `${SITE_URL}/en/articles/standard-model-symmetries/opengraph-image`);

  const other = meta.other as Record<string, string>;
  assert.equal(other.citation_title, sampleArticle.title);
  assert.equal(other.citation_author, "Sara Ahmadi");
  assert.equal(other.citation_publication_date, "2026-08-01");
  assert.equal(other.citation_language, "en");
});

test("estimateWordCount excludes fenced code and display math", () => {
  assert.equal(estimateWordCount(sampleArticle.content), 12);
});

test("JSON-LD builders emit valid Schema.org structured data across pages", () => {
  const art = articleJsonLd("en", sampleArticle, sampleAuthor, "Physics");
  assert.equal(art["@type"], "ScholarlyArticle");
  assert.equal(art.inLanguage, "en-US");
  assert.equal(art.articleSection, "Physics");
  assert.equal(art.timeRequired, "PT7M");
  assert.equal(art.isAccessibleForFree, true);
  assert.equal(art.wordCount, 12);
  assert.equal(art.image.length, 2);
  assert.equal((art.author as { url: string }).url, `${SITE_URL}/en/authors/sara-ahmadi`);

  const org = organizationJsonLd("fa");
  assert.equal(org["@type"], "Organization");
  assert.equal(org.alternateName, "ساینتا");

  const site = websiteJsonLd("en");
  assert.equal(site["@type"], "WebSite");
  assert.equal(site.potentialAction["@type"], "SearchAction");
  assert.match(site.potentialAction.target.urlTemplate, /\/en\/search\?q=\{search_term_string\}$/);

  const profile = authorProfileJsonLd("en", sampleAuthor, [sampleArticle]);
  assert.equal(profile["@type"], "ProfilePage");
  assert.equal(profile.mainEntity["@type"], "Person");
  assert.deepEqual(profile.mainEntity.sameAs, ["https://x.com/saraahmadi", "https://github.com/saraahmadi"]);

  const col = collectionPageJsonLd("en", {
    name: "Physics",
    description: "Physics essays",
    url: `${SITE_URL}/en/fields/physics`,
    items: [{ name: sampleArticle.title, url: `${SITE_URL}/en/articles/${sampleArticle.slug}` }],
  });
  assert.equal(col["@type"], "CollectionPage");
  assert.equal(col.mainEntity.numberOfItems, 1);

  assert.equal(aboutPageJsonLd("en", "About Scienta")["@type"], "AboutPage");
  assert.equal(contactPageJsonLd("fa", "تماس با ساینتا")["@type"], "ContactPage");
  assert.equal(breadcrumbJsonLd([{ name: "Home", url: `${SITE_URL}/en` }]).itemListElement[0].position, 1);
});

test("robots() disallows private/utility routes and manifest() exposes Scienta metadata", () => {
  const r = robots();
  const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
  const disallowed = Array.isArray(rule.disallow) ? rule.disallow : [];
  assert.ok(disallowed.includes("/admin/"));
  assert.ok(disallowed.includes("/api/"));
  assert.ok(disallowed.includes("/fa/search"));
  assert.ok(disallowed.includes("/en/saved"));
  assert.equal(r.sitemap, `${SITE_URL}/sitemap.xml`);

  const m = manifest();
  assert.equal(m.short_name, "Scienta");
  assert.equal(m.start_url, "/fa");
});

test("getSiteVerification emits Google, Bing (msvalidate.01), and Yandex verification tokens when configured", () => {
  assert.equal(getSiteVerification({}), undefined);
  assert.deepEqual(
    getSiteVerification({
      GOOGLE_SITE_VERIFICATION: " google-tok-123 ",
      BING_SITE_VERIFICATION: "bing-tok-456",
      YANDEX_VERIFICATION: "yandex-tok-789",
    }),
    {
      google: "google-tok-123",
      yandex: "yandex-tok-789",
      other: { "msvalidate.01": "bing-tok-456" },
    }
  );
});
