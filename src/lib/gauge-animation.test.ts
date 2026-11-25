import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampGaugePercent,
  formatGaugePercent,
  percentToDashOffset,
  percentToNeedleAngle,
} from "./gauge-animation";

describe("gauge-animation", () => {
  it("clamps percent safely to [0, 100] including NaN and Infinity", () => {
    assert.equal(clampGaugePercent(-15), 0);
    assert.equal(clampGaugePercent(0), 0);
    assert.equal(clampGaugePercent(42.7), 42.7);
    assert.equal(clampGaugePercent(135), 100);
    assert.equal(clampGaugePercent(Number.NaN), 0);
    assert.equal(clampGaugePercent(Number.POSITIVE_INFINITY), 0);
  });

  it("maps percent linearly across the 270-degree sweep (-135° to +135°)", () => {
    assert.equal(percentToNeedleAngle(0), -135);
    assert.equal(percentToNeedleAngle(50), 0);
    assert.equal(percentToNeedleAngle(100), 135);
    assert.equal(percentToNeedleAngle(25), -67.5);
    assert.equal(percentToNeedleAngle(75), 67.5);
    assert.equal(percentToNeedleAngle(150), 135);
    assert.equal(percentToNeedleAngle(-20), -135);
  });

  it("computes exact SVG strokeDashoffset from percent and arcLength", () => {
    const arcLength = 200;
    assert.equal(percentToDashOffset(0, arcLength), 200);
    assert.equal(percentToDashOffset(50, arcLength), 100);
    assert.equal(percentToDashOffset(100, arcLength), 0);
    assert.equal(percentToDashOffset(60, arcLength), 80);
    assert.equal(percentToDashOffset(120, arcLength), 0);
    assert.equal(percentToDashOffset(50, 0), 0);
  });

  it("formats displayed percentage with 1 decimal place and clamping", () => {
    assert.equal(formatGaugePercent(0), "0.0");
    assert.equal(formatGaugePercent(76.84), "76.8");
    assert.equal(formatGaugePercent(100), "100.0");
    assert.equal(formatGaugePercent(-0.4), "0.0");
    assert.equal(formatGaugePercent(104.2), "100.0");
  });
});
