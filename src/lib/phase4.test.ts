import test from "node:test";
import assert from "node:assert/strict";
import {
  mapApiTranslationToEditorState,
  summarizeRevisionDiff,
  validateUserMutation,
} from "./admin-users";

test("validateUserMutation prevents self-lockout, non-super-admin mutations, and removing last super_admin", () => {
  // Non-super_admin cannot mutate
  assert.equal(
    validateUserMutation({
      actorId: "u1",
      actorRole: "admin",
      targetId: "u2",
      targetCurrentRole: "editor",
      targetCurrentStatus: "active",
      nextStatus: "suspended",
      activeSuperAdminCount: 1,
    }).allowed,
    false
  );

  // Self-delete blocked
  assert.equal(
    validateUserMutation({
      actorId: "u1",
      actorRole: "super_admin",
      targetId: "u1",
      targetCurrentRole: "super_admin",
      targetCurrentStatus: "active",
      deleting: true,
      activeSuperAdminCount: 2,
    }).allowed,
    false
  );

  // Self-demotion blocked
  assert.equal(
    validateUserMutation({
      actorId: "u1",
      actorRole: "super_admin",
      targetId: "u1",
      targetCurrentRole: "super_admin",
      targetCurrentStatus: "active",
      nextRole: "admin",
      activeSuperAdminCount: 2,
    }).allowed,
    false
  );

  // Demoting the last active super_admin blocked
  assert.equal(
    validateUserMutation({
      actorId: "u1",
      actorRole: "super_admin",
      targetId: "u2",
      targetCurrentRole: "super_admin",
      targetCurrentStatus: "active",
      nextRole: "admin",
      activeSuperAdminCount: 1,
    }).allowed,
    false
  );

  // Valid editor promotion allowed
  assert.equal(
    validateUserMutation({
      actorId: "u1",
      actorRole: "super_admin",
      targetId: "u2",
      targetCurrentRole: "editor",
      targetCurrentStatus: "active",
      nextRole: "admin",
      activeSuperAdminCount: 1,
    }).allowed,
    true
  );
});

test("mapApiTranslationToEditorState hydrates snake_case DB SEO columns into camelCase editor state", () => {
  const mapped = mapApiTranslationToEditorState({
    title: "Black Holes",
    slug: "black-holes",
    excerpt: "Short summary",
    content: "## Intro",
    seo_title: "Custom SEO Title",
    seo_description: "Custom SEO Description",
    seo_keywords: "relativity, black holes",
    canonical_url: "https://scienta.ir/en/articles/black-holes",
    twitter_card: "summary",
  });

  assert.equal(mapped.seoTitle, "Custom SEO Title");
  assert.equal(mapped.seoDescription, "Custom SEO Description");
  assert.equal(mapped.seoKeywords, "relativity, black holes");
  assert.equal(mapped.canonicalUrl, "https://scienta.ir/en/articles/black-holes");
  assert.equal(mapped.twitterCard, "summary");
});

test("summarizeRevisionDiff reports word delta and changed lines accurately", () => {
  const diff = summarizeRevisionDiff("Line one\nLine two", "Line one\nLine two edited\nExtra line");
  assert.equal(diff.currentWords, 4);
  assert.equal(diff.revisionWords, 7);
  assert.equal(diff.wordDelta, 3);
  assert.equal(diff.changedLines, 2);
});
