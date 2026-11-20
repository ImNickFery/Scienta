import test from "node:test";
import assert from "node:assert/strict";
import { resolveArticleCardImage } from "./image-delivery";

test("resolveArticleCardImage pairs bundled article covers with 480w thumbnails", () => {
  const defaultImg = resolveArticleCardImage("/images/articles/particle-collider-tracks.webp", "default");
  assert.equal(defaultImg.src, "/images/articles/thumbs/particle-collider-tracks_thumb.webp");
  assert.equal(
    defaultImg.srcSet,
    "/images/articles/thumbs/particle-collider-tracks_thumb.webp 480w, /images/articles/particle-collider-tracks.webp 1376w"
  );
  assert.ok(defaultImg.sizes?.includes("440px"));

  const compactImg = resolveArticleCardImage("/images/articles/black-hole-horizon.webp", "compact");
  assert.equal(compactImg.src, "/images/articles/thumbs/black-hole-horizon_thumb.webp");
  assert.equal(compactImg.srcSet, undefined);
  assert.equal(compactImg.width, 480);

  const largeImg = resolveArticleCardImage("/images/articles/neural-network-synapse.webp", "large");
  assert.equal(largeImg.src, "/images/articles/neural-network-synapse.webp");
  assert.ok(largeImg.srcSet?.includes("neural-network-synapse_thumb.webp 480w"));
  assert.ok(largeImg.srcSet?.includes("neural-network-synapse.webp 1376w"));
});

test("resolveArticleCardImage passes uploaded and unknown covers through unchanged", () => {
  const uploaded = resolveArticleCardImage("/uploads/media/custom-cover.webp", "default");
  assert.equal(uploaded.src, "/uploads/media/custom-cover.webp");
  assert.equal(uploaded.srcSet, undefined);

  const unknownBundled = resolveArticleCardImage("/images/articles/nonexistent-cover.webp", "default");
  assert.equal(unknownBundled.src, "/images/articles/nonexistent-cover.webp");
  assert.equal(unknownBundled.srcSet, undefined);
});
