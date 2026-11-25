"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { computeMetricStats, getUsageSeverity } from "@/lib/system-updater-core";
import {
  clampGaugePercent,
  formatGaugePercent,
  percentToDashOffset,
} from "@/lib/gauge-animation";

interface ResourceGaugeProps {
  title: string;
  percent: number;
  primaryStat: string;
  secondaryStat: string;
  tertiaryStat?: string;
  history?: number[];
  icon: ReactNode;
  accentHex?: string;
  loading?: boolean;
  isFa: boolean;
}

const SEVERITY_COLORS = {
  healthy: {
    stroke: "#10b981", // emerald-500
    textClass: "text-emerald-400",
    labelEn: "Nominal",
    labelFa: "پایدار",
  },
  elevated: {
    stroke: "#f59e0b", // amber-500
    textClass: "text-amber-400",
    labelEn: "Elevated",
    labelFa: "متوسط",
  },
  critical: {
    stroke: "#ef4444", // red-500
    textClass: "text-red-400",
    labelEn: "High Load",
    labelFa: "فشار بالا",
  },
} as const;

// Critically-damped instrument spring (zeta ≈ 1.03): silky, authoritative needle & arc glide
// with zero overshoot and seamless mid-flight retargeting when live samples arrive.
const INSTRUMENT_SPRING = {
  stiffness: 95,
  damping: 19,
  mass: 0.9,
} as const;

const REDUCED_SPRING = {
  stiffness: 1000,
  damping: 100,
  mass: 0.1,
} as const;

/**
 * 3x-ui-inspired 270-degree SVG radial instrument gauge driven by a single
 * unified Framer Motion spring so the active arc, precision dial needle, and
 * rolling center percentage readout stay frame-locked at 60fps. Includes a
 * subtle luminous calibration sweep while loading.
 */
export function ResourceGauge({
  title,
  percent,
  primaryStat,
  secondaryStat,
  tertiaryStat,
  history = [],
  icon,
  accentHex,
  loading = false,
  isFa,
}: ResourceGaugeProps) {
  const gradientId = useId();
  const prefersReducedMotion = useReducedMotion();
  const clamped = clampGaugePercent(percent);
  const severity = getUsageSeverity(clamped);
  const meta = SEVERITY_COLORS[severity];
  const strokeColor = severity === "healthy" && accentHex ? accentHex : meta.stroke;

  // 270-degree open arc geometry (radius = 44, circumference = 2 * pi * 44 ≈ 276.46)
  // Arc sweeps clockwise from -135° (7:30 = 0%) through 0° (12:00 = 50%) to +135° (4:30 = 100%)
  const radius = 44;
  const fullCircumference = 2 * Math.PI * radius;
  const arcLength = fullCircumference * 0.75; // 270 deg
  const loadingSweepLength = arcLength * 0.24;

  // Inner dial tick ring (radius = 35, 270 deg)
  const tickRadius = 35;
  const tickCircumference = 2 * Math.PI * tickRadius;
  const tickArcLength = tickCircumference * 0.75;

  // Single unified spring value: starts at 0 so initial data smoothly sweeps up from 0%
  const targetPercent = useMotionValue(0);
  const springPercent = useSpring(
    targetPercent,
    prefersReducedMotion ? REDUCED_SPRING : INSTRUMENT_SPRING
  );

  // Frame-locked SVG arc dashOffset derived from springPercent
  const animatedDashOffset = useTransform(springPercent, (v) =>
    percentToDashOffset(v, arcLength)
  );

  // Direct DOM ref for zero-re-render 60fps rolling percentage counter
  const percentTextRef = useRef<HTMLSpanElement>(null);

  useMotionValueEvent(springPercent, "change", (latest) => {
    if (percentTextRef.current) {
      percentTextRef.current.textContent = formatGaugePercent(latest);
    }
  });

  useEffect(() => {
    const nextValue = loading ? 0 : clamped;
    if (prefersReducedMotion) {
      targetPercent.jump(nextValue);
      springPercent.jump(nextValue);
      if (percentTextRef.current) {
        percentTextRef.current.textContent = formatGaugePercent(nextValue);
      }
      return;
    }
    targetPercent.set(nextValue);
  }, [clamped, loading, prefersReducedMotion, targetPercent, springPercent]);

  // Sync displayed digits immediately when transitioning out of the loading skeleton
  useEffect(() => {
    if (!loading && percentTextRef.current) {
      percentTextRef.current.textContent = formatGaugePercent(springPercent.get());
    }
  }, [loading, springPercent]);

  // Build mini sparkline polyline + area polygon (last 24 ticks)
  const samples = history.slice(-24);
  const stats = computeMetricStats(samples);
  const sparkGeometry = (() => {
    if (samples.length < 2) return null;
    const width = 140;
    const height = 24;
    const coords = samples.map((val, i) => {
      const x = (i / (samples.length - 1)) * width;
      const y = height - (clampGaugePercent(val) / 100) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const linePoints = coords.join(" ");
    const areaPoints = `0,${height} ${linePoints} ${width},${height}`;
    return { linePoints, areaPoints };
  })();

  const colorTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.45, ease: "easeOut" as const };

  return (
    <div
      data-testid="resource-gauge"
      data-loading={loading ? "true" : "false"}
      data-percent={clamped.toFixed(1)}
      className="flex flex-col justify-between rounded-xl border border-(--color-border-subtle) bg-(--color-bg-secondary) p-5 transition-colors hover:border-(--color-border-strong)"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) text-(--color-text-secondary)">
            {icon}
          </span>
          <h3 className="truncate text-sm font-semibold text-(--color-text-primary)">{title}</h3>
        </div>
        <span
          className={`shrink-0 text-[11px] font-medium transition-colors duration-500 ${
            loading ? "text-(--color-text-tertiary)" : meta.textClass
          }`}
        >
          {loading ? (isFa ? "اتصال…" : "Syncing…") : isFa ? meta.labelFa : meta.labelEn}
        </span>
      </div>

      {/* Center 270° Radial Arc + Precision Dial Needle */}
      <div className="my-4 flex items-center justify-center">
        <div className="relative h-28 w-28">
          <svg
            viewBox="0 0 112 112"
            className="h-full w-full overflow-visible"
            role="img"
            aria-label={loading ? `${title}: loading` : `${title}: ${clamped.toFixed(1)}%`}
          >
            {/* Subtle radial instrument tick marks */}
            <circle
              cx="56"
              cy="56"
              r={tickRadius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              strokeDasharray="1.5 9.45"
              strokeDashoffset={0}
              pathLength={tickArcLength}
              transform="rotate(135 56 56)"
              style={{
                strokeDasharray: "1.5 7.6",
              }}
              clipPath="inset(0 0 14% 0)"
            />

            {/* Background track arc (rotated 135° so gap sits cleanly at bottom) */}
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${fullCircumference}`}
              transform="rotate(135 56 56)"
            />

            {/* Calibration loading sweep along the 270° track while waiting for first sample */}
            {loading && (
              <motion.circle
                data-testid="gauge-loading-sweep"
                cx="56"
                cy="56"
                r={radius}
                fill="none"
                stroke={accentHex ?? "#38bdf8"}
                strokeOpacity={0.55}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${loadingSweepLength} ${fullCircumference}`}
                transform="rotate(135 56 56)"
                initial={{ strokeDashoffset: 0 }}
                animate={
                  prefersReducedMotion
                    ? { strokeDashoffset: 0 }
                    : { strokeDashoffset: [0, -(arcLength - loadingSweepLength), 0] }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        duration: 1.8,
                        ease: "easeInOut",
                        repeat: Number.POSITIVE_INFINITY,
                      }
                }
              />
            )}

            {/* Active value arc — frame-locked to unified springPercent */}
            <motion.circle
              data-testid="gauge-active-arc"
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${fullCircumference}`}
              transform="rotate(135 56 56)"
              style={{ strokeDashoffset: animatedDashOffset }}
              initial={{ stroke: strokeColor, opacity: loading ? 0 : 1 }}
              animate={{
                stroke: strokeColor,
                opacity: loading ? 0 : 1,
              }}
              transition={colorTransition}
            />
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
            {loading ? (
              <div className="flex flex-col items-center gap-1">
                <span className="h-6 w-14 animate-pulse rounded bg-(--color-bg-deep)" />
                <span className="h-2.5 w-9 animate-pulse rounded bg-(--color-bg-deep)/70" />
              </div>
            ) : (
              <>
                <span
                  dir="ltr"
                  className="font-[family-name:var(--font-mono)] text-2xl font-bold tracking-tight tabular-nums text-(--color-text-primary)"
                >
                  <span ref={percentTextRef} data-testid="gauge-percent-value">
                    {formatGaugePercent(prefersReducedMotion ? clamped : 0)}
                  </span>
                  <span className="text-xs font-medium text-(--color-text-tertiary)">%</span>
                </span>
                {samples.length >= 2 && (
                  <span
                    dir="ltr"
                    className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-(--color-text-tertiary)"
                  >
                    {isFa ? `اوج ${stats.peak.toFixed(0)}%` : `Peak ${stats.peak.toFixed(0)}%`}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Live Gradient Area Sparkline */}
      <div className="mb-3 h-7 w-full overflow-hidden rounded bg-(--color-bg-deep)/60 px-1.5 py-0.5">
        {sparkGeometry ? (
          <svg viewBox="0 0 140 24" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon fill={`url(#${gradientId})`} points={sparkGeometry.areaPoints} />
            <polyline
              fill="none"
              stroke={strokeColor}
              strokeOpacity="0.9"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={sparkGeometry.linePoints}
            />
          </svg>
        ) : (
          <div className="flex h-full items-center justify-between px-1 font-[family-name:var(--font-mono)] text-[10px] text-(--color-text-tertiary)">
            <span>{isFa ? "در حال جمع‌آوری روند…" : "Collecting samples…"}</span>
            <span className="tabular-nums">{samples.length}/2</span>
          </div>
        )}
      </div>

      {/* Clean Tabular Breakdown Footer */}
      <div className="space-y-1 border-t border-(--color-border-subtle) pt-3">
        {loading ? (
          <>
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-(--color-bg-deep)" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-(--color-bg-deep)" />
          </>
        ) : (
          <>
            <p
              dir="ltr"
              className="truncate font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-text-primary)"
            >
              {primaryStat}
            </p>
            <p className="truncate text-[11px] tabular-nums text-(--color-text-tertiary)">
              {secondaryStat}
              {tertiaryStat ? ` · ${tertiaryStat}` : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
