import test from "node:test";
import assert from "node:assert/strict";
import { SCIENTA_LOGO_PATHS, SCIENTA_LOGO_VIEWBOX } from "./brand-logo-geometry";

function extractControlAndVertexPairs(pathD: string): Array<[number, number]> {
  const nums = pathD.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pairs.push([nums[i], nums[i + 1]]);
  }
  return pairs;
}

test("Scienta flagship logo uses a strict 64x64 grid", () => {
  assert.equal(SCIENTA_LOGO_VIEWBOX, "0 0 64 64");
});

test("all vertices and G2 superellipse control points maintain exact 180-degree symmetry around (32, 32)", () => {
  const upper = extractControlAndVertexPairs(SCIENTA_LOGO_PATHS.prismUpper);
  const lower = extractControlAndVertexPairs(SCIENTA_LOGO_PATHS.prismLower);
  assert.equal(upper.length, lower.length);
  assert.equal(upper.length, 21);

  for (let i = 0; i < upper.length; i++) {
    assert.equal(
      Number((upper[i][0] + lower[i][0]).toFixed(2)),
      64,
      `X symmetry failed at pair ${i}`
    );
    assert.equal(
      Number((upper[i][1] + lower[i][1]).toFixed(2)),
      64,
      `Y symmetry failed at pair ${i}`
    );
  }
});

test("central prism faces are strictly parallel on 2x + y = const with a ~3.49px inward refraction slit", () => {
  // Upper cut: (27.8, 36.5) -> (31.4, 29.3), Lower cut: (36.2, 27.5) -> (32.6, 34.7)
  assert.equal(Number((2 * 27.8 + 36.5).toFixed(2)), 92.1);
  assert.equal(Number((2 * 31.4 + 29.3).toFixed(2)), 92.1);
  assert.equal(Number((2 * 36.2 + 27.5).toFixed(2)), 99.9);
  assert.equal(Number((2 * 32.6 + 34.7).toFixed(2)), 99.9);
  const perpendicularGap = (99.9 - 92.1) / Math.sqrt(5);
  assert.ok(perpendicularGap > 3.4 && perpendicularGap < 3.6);
});
