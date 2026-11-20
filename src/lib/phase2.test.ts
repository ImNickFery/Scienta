import test from "node:test";
import assert from "node:assert/strict";
import { toggleBookmarkList } from "./article-bookmarks";
import { resolveLocaleSwitchPath } from "./i18n/switch-path";
import { buildArticleMetadata } from "./seo";
import { safeParseSocialJson } from "./taxonomy";
import type { Article } from "@/types";

test("toggleBookmarkList adds and removes slugs deterministically", () => {
  const first = toggleBookmarkList([], "geometry-of-black-holes");
  assert.equal(first.saved, true);
  assert.deepEqual(first.next, ["geometry-of-black-holes"]);

  const second = toggleBookmarkList(first.next, "quantum-computing");
  assert.equal(second.saved, true);
  assert.deepEqual(second.next, ["geometry-of-black-holes", "quantum-computing"]);

  const third = toggleBookmarkList(second.next, "geometry-of-black-holes");
  assert.equal(third.saved, false);
  assert.deepEqual(third.next, ["quantum-computing"]);
});

test("resolveLocaleSwitchPath prefers alternate hreflang slug over naive prefix swap", () => {
  assert.equal(
    resolveLocaleSwitchPath(
      "/en/articles/geometry-of-black-holes",
      "fa",
      "https://scienta.ir/fa/articles/هندسه-سیاهچاله-ها"
    ),
    "/fa/articles/%D9%87%D9%86%D8%AF%D8%B3%D9%87-%D8%B3%DB%8C%D8%A7%D9%87%DA%86%D8%A7%D9%84%D9%87-%D9%87%D8%A7"
  );

  assert.equal(
    resolveLocaleSwitchPath("/en/articles", "fa", null),
    "/fa/articles"
  );

  assert.equal(
    resolveLocaleSwitchPath("/fa/about", "en", "https://scienta.ir/fa/wrong-locale"),
    "/en/about"
  );

  assert.equal(
    resolveLocaleSwitchPath("/fa/search", "en", "https://scienta.ir/en/search", "?q=black"),
    "/en/search?q=black"
  );

  assert.equal(
    resolveLocaleSwitchPath("/fa/articles", "en", "https://scienta.ir/en", "?field=quantum"),
    "/en/articles?field=quantum"
  );
});

test("buildArticleMetadata honors custom SEO fields and emits bilingual hreflang alternates", () => {
  const article: Article = {
    id: "a1",
    slug: "black-holes",
    locale: "en",
    title: "Black Holes",
    excerpt: "Default excerpt",
    cover: "",
    field: "astronomy",
    fieldColor: "#7B3FFB",
    tags: ["Relativity", "Cosmology"],
    authorSlug: "elham-rostami",
    authorName: "Elham Rostami",
    publishedAt: "2026-05-12T00:00:00Z",
    updatedAt: "2026-05-13T00:00:00Z",
    views: 100,
    content: "",
    readingTimeMinutes: 5,
    seoTitle: "Custom SEO Black Holes",
    seoDescription: "Custom SEO description",
    seoKeywords: "gravity, schwarzschild",
    canonicalUrl: "https://scienta.ir/en/articles/black-holes-canonical",
    twitterCard: "summary",
  };

  const meta = buildArticleMetadata("en", article, {
    en: "black-holes",
    fa: "سیاهچاله-ها",
  });

  assert.equal(meta.title, "Custom SEO Black Holes");
  assert.equal(meta.description, "Custom SEO description");
  assert.deepEqual(meta.keywords, ["gravity", "schwarzschild"]);
  assert.equal(meta.alternates?.canonical, "https://scienta.ir/en/articles/black-holes-canonical");
  assert.deepEqual(meta.alternates?.languages, {
    en: "https://scienta.ir/en/articles/black-holes",
    fa: "https://scienta.ir/fa/articles/سیاهچاله-ها",
    "x-default": "https://scienta.ir/fa/articles/سیاهچاله-ها",
  });
});

test("safeParseSocialJson handles valid, malformed, and empty JSON safely", () => {
  assert.deepEqual(safeParseSocialJson('{"twitter":"@scienta"}'), { twitter: "@scienta" });
  assert.equal(safeParseSocialJson("{broken json"), undefined);
  assert.equal(safeParseSocialJson("[1,2,3]"), undefined);
  assert.equal(safeParseSocialJson(null), undefined);
});
