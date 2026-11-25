/**
 * Pure geometry and formatting helpers for the 270-degree radial telemetry gauge.
 * Shared between the animated ResourceGauge component and unit tests.
 */

export const GAUGE_MIN_ANGLE = -135;
export const GAUGE_SWEEP_DEGREES = 270;

export function clampGaugePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function percentToNeedleAngle(percent: number): number {
  const clamped = clampGaugePercent(percent);
  return GAUGE_MIN_ANGLE + (clamped / 100) * GAUGE_SWEEP_DEGREES;
}

export function percentToDashOffset(percent: number, arcLength: number): number {
  if (!Number.isFinite(arcLength) || arcLength <= 0) return 0;
  const clamped = clampGaugePercent(percent);
  const filledLength = (clamped / 100) * arcLength;
  return Math.max(0, arcLength - filledLength);
}

export function formatGaugePercent(value: number): string {
  return clampGaugePercent(value).toFixed(1);
}
