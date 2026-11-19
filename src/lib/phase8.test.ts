import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchHref, isNavLinkActive } from "./navigation";

test("isNavLinkActive matches exact routes and nested sub-routes without false prefix hits", () => {
  assert.equal(isNavLinkActive("/fa/articles", "/fa/articles"), true);
  assert.equal(isNavLinkActive("/fa/articles/geometry-of-black-holes", "/fa/articles"), true);
  assert.equal(isNavLinkActive("/fa/articles/", "/fa/articles"), true);
  assert.equal(isNavLinkActive("/fa/articles-archive", "/fa/articles"), false);
  assert.equal(isNavLinkActive("/fa/fields/physics", "/fa/fields"), true);
  assert.equal(isNavLinkActive("/fa", "/fa/articles"), false);
  assert.equal(isNavLinkActive(null, "/fa/articles"), false);
});

test("buildSearchHref trims and URL-encodes Persian and English search queries", () => {
  assert.equal(buildSearchHref("fa", "   "), "/fa/search");
  assert.equal(buildSearchHref("en", "black holes"), "/en/search?q=black%20holes");
  assert.equal(
    buildSearchHref("fa", "  سیاه‌چاله  "),
    `/fa/search?q=${encodeURIComponent("سیاه‌چاله")}`
  );
});
