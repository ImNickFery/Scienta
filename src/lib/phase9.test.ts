import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuickActions,
  filterTaxonomyForPalette,
  flattenCommandItems,
  normalizeSearchText,
  parseRecentSearches,
  pushRecentSearch,
  stepActiveIndex,
  type CommandPalettePayload,
} from "./command-palette";
import type { FieldRecord } from "./taxonomy";
import type { TagRecord } from "./content";
import type { Author } from "@/types";

const sampleFields: FieldRecord[] = [
  { slug: "physics", name: { fa: "فیزیک", en: "Physics" }, color: "#7B3FFB", icon: "atom", articleCount: 2 },
  { slug: "astronomy", name: { fa: "نجوم و فضا", en: "Astronomy & Space" }, color: "#FF6A00", icon: "orbit", articleCount: 1 },
  { slug: "quantum", name: { fa: "محاسبات کوانتومی", en: "Quantum Computing" }, color: "#38BDF8", icon: "cpu", articleCount: 1 },
];

const sampleTags: TagRecord[] = [
  { slug: "black-holes", name: { fa: "سیاه‌چاله‌ها", en: "Black Holes" }, count: 2 },
  { slug: "neural-networks", name: { fa: "شبکه‌های عصبی", en: "Neural Networks" }, count: 1 },
];

const sampleAuthors: Author[] = [
  {
    slug: "elham-rostami",
    name: { fa: "الهام رستمی", en: "Elham Rostami" },
    title: { fa: "اخترفیزیکدان نظری", en: "Theoretical Astrophysicist" },
    bio: { fa: "", en: "" },
    avatar: "",
  },
];

test("normalizeSearchText unifies Arabic/Persian Yeh, Kaf, and ZWNJ spacing", () => {
  assert.equal(normalizeSearchText("  كوانتوم  "), "کوانتوم");
  assert.equal(normalizeSearchText("فيزيك"), "فیزیک");
  assert.equal(normalizeSearchText("سیاه‌چاله"), "سیاه چاله");
});

test("filterTaxonomyForPalette matches Persian, Arabic variants, and English slugs cross-lingually", () => {
  const byArabicVariant = filterTaxonomyForPalette("فيزيك", "fa", sampleFields, sampleTags, sampleAuthors);
  assert.equal(byArabicVariant.fields.length, 1);
  assert.equal(byArabicVariant.fields[0].slug, "physics");

  const byCompactPersian = filterTaxonomyForPalette("سیاهچاله", "fa", sampleFields, sampleTags, sampleAuthors);
  assert.equal(byCompactPersian.tags.length, 1);
  assert.equal(byCompactPersian.tags[0].slug, "black-holes");

  const byEnglishInFa = filterTaxonomyForPalette("quantum", "fa", sampleFields, sampleTags, sampleAuthors);
  assert.equal(byEnglishInFa.fields.length, 1);
  assert.equal(byEnglishInFa.fields[0].name, "محاسبات کوانتومی");

  const byAuthorTitle = filterTaxonomyForPalette("astrophysicist", "en", sampleFields, sampleTags, sampleAuthors);
  assert.equal(byAuthorTitle.authors.length, 1);
  assert.equal(byAuthorTitle.authors[0].slug, "elham-rostami");
});

test("stepActiveIndex wraps deterministically and handles empty lists", () => {
  assert.equal(stepActiveIndex(0, 1, 0), -1);
  assert.equal(stepActiveIndex(-1, 1, 4), 0);
  assert.equal(stepActiveIndex(-1, -1, 4), 3);
  assert.equal(stepActiveIndex(3, 1, 4), 0);
  assert.equal(stepActiveIndex(0, -1, 4), 3);
  assert.equal(stepActiveIndex(1, 1, 4), 2);
});

test("flattenCommandItems orders groups cleanly and appends full-search item when query is present", () => {
  const payload: CommandPalettePayload = {
    query: "سیاه‌چاله",
    articles: [
      {
        slug: "geometry-of-black-holes",
        title: "هندسه سیاه‌چاله‌ها",
        excerpt: "",
        field: "astronomy",
        fieldColor: "#FF6A00",
        authorName: "الهام رستمی",
        readingTimeMinutes: 4,
      },
    ],
    fields: [{ slug: "astronomy", name: "نجوم و فضا", color: "#FF6A00", articleCount: 1 }],
    tags: [{ slug: "black-holes", name: "سیاه‌چاله‌ها", count: 1 }],
    authors: [{ slug: "elham-rostami", name: "الهام رستمی", title: "اخترفیزیکدان" }],
  };

  const flat = flattenCommandItems("fa", payload, false);
  assert.equal(flat.length, 5);
  assert.deepEqual(
    flat.map((i) => i.kind),
    ["article", "field", "tag", "author", "full-search"]
  );
  assert.equal(flat[4].href, "/fa/search?q=%D8%B3%DB%8C%D8%A7%D9%87%E2%80%8C%DA%86%D8%A7%D9%84%D9%87");

  const emptyFlat = flattenCommandItems("en", { query: "", articles: [], fields: [], tags: [], authors: [] }, true);
  assert.equal(emptyFlat.length, buildQuickActions("en").length);
  assert.equal(emptyFlat[0].kind, "action");
});

test("recent search helpers deduplicate Persian/case variants and enforce max length", () => {
  const initial = parseRecentSearches(JSON.stringify(["Quantum", "  quantum ", "فيزيك", "فیزیک", "", 123]));
  assert.deepEqual(initial, ["Quantum", "فيزيك"]);

  const next = pushRecentSearch(initial, "فیزیک", 3);
  assert.deepEqual(next, ["فیزیک", "Quantum"]);

  const capped = pushRecentSearch(["a", "b", "c"], "d", 3);
  assert.deepEqual(capped, ["d", "a", "b"]);

  assert.deepEqual(parseRecentSearches("{bad json"), []);
});
