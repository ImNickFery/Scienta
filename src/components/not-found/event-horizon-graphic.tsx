"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { computeHorizonRadius } from "@/lib/not-found";
import type { Locale } from "@/lib/i18n/config";

interface EventHorizonGraphicProps {
  locale: Locale;
}

const VIEWBOX_SIZE = 440;
const CENTER = VIEWBOX_SIZE / 2;
const HORIZON_RADIUS = 56; // r = r_s
const PHOTON_RADIUS = 88; // r = 1.5 r_s (photon sphere)
const ISCO_RADIUS = 152; // r = 3 r_s (innermost stable circular orbit)
const OUTER_RADIUS = 198;

const DEFAULT_PROBE_X = CENTER + PHOTON_RADIUS * 0.72;
const DEFAULT_PROBE_Y = CENTER - PHOTON_RADIUS * 0.69;

const GEODESIC_PATHS = [
  "M 28 112 Q 220 132 412 68",
  "M 28 152 Q 214 148 398 112",
  "M 28 328 Q 220 308 412 372",
  "M 28 288 Q 214 292 398 328",
];

export function EventHorizonGraphic({ locale }: EventHorizonGraphicProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const rawProbeX = useMotionValue(DEFAULT_PROBE_X);
  const rawProbeY = useMotionValue(DEFAULT_PROBE_Y);
  const probeX = useSpring(rawProbeX, { stiffness: 240, damping: 28, mass: 0.6 });
  const probeY = useSpring(rawProbeY, { stiffness: 240, damping: 28, mass: 0.6 });

  const [probeMeta, setProbeMeta] = useState<{
    ratio: number;
    insideHorizon: boolean;
    active: boolean;
  }>({
    ratio: 1.5,
    insideHorizon: false,
    active: false,
  });

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scaleX = VIEWBOX_SIZE / rect.width;
    const scaleY = VIEWBOX_SIZE / rect.height;
    const svgX = Math.max(24, Math.min(VIEWBOX_SIZE - 24, (e.clientX - rect.left) * scaleX));
    const svgY = Math.max(24, Math.min(VIEWBOX_SIZE - 24, (e.clientY - rect.top) * scaleY));

    rawProbeX.set(svgX);
    rawProbeY.set(svgY);

    const { ratio, insideHorizon } = computeHorizonRadius(
      svgX - CENTER,
      svgY - CENTER,
      HORIZON_RADIUS
    );
    setProbeMeta({ ratio, insideHorizon, active: true });
  }

  function handlePointerLeave() {
    rawProbeX.set(DEFAULT_PROBE_X);
    rawProbeY.set(DEFAULT_PROBE_Y);
    setProbeMeta({ ratio: 1.5, insideHorizon: false, active: false });
  }

  // 24 subtle angular ticks around the outer coordinate circle
  const ticks = Array.from({ length: 24 }, (_, idx) => {
    const angle = (idx * 15 * Math.PI) / 180;
    const isMajor = idx % 6 === 0;
    const inner = OUTER_RADIUS - (isMajor ? 10 : 5);
    return {
      x1: CENTER + Math.cos(angle) * inner,
      y1: CENTER + Math.sin(angle) * inner,
      x2: CENTER + Math.cos(angle) * OUTER_RADIUS,
      y2: CENTER + Math.sin(angle) * OUTER_RADIUS,
      isMajor,
    };
  });

  const probeStroke = probeMeta.insideHorizon
    ? "var(--color-accent-red)"
    : "var(--color-accent-orange)";

  return (
    <motion.div
      ref={stageRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      data-testid="event-horizon-observatory"
      initial={prefersReducedMotion ? false : { opacity: 0.01, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-full max-w-[440px] select-none overflow-hidden rounded-2xl border border-(--color-border-subtle) bg-(--color-bg-secondary)/90 p-5 sm:p-6 cursor-crosshair"
    >
      {/* Top scientific coordinate header — clean unboxed typography */}
      <div className="mb-3 flex items-center justify-between gap-4 border-b border-(--color-border-subtle) pb-3 text-xs text-(--color-text-tertiary)">
        <span className="font-medium text-(--color-text-secondary)">
          {locale === "fa" ? "نمودار افق رویداد شوارتزشیلد" : "Schwarzschild Horizon Plot"}
        </span>
        <span dir="ltr" className="font-mono tabular-nums text-(--color-text-secondary)">
          r / r<sub className="text-[10px]">s</sub> = {probeMeta.ratio.toFixed(2)}
        </span>
      </div>

      {/* Main Observatory SVG (strictly LTR to prevent RTL mathematical flip) */}
      <div className="relative aspect-square w-full" dir="ltr">
        <svg
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          className="h-full w-full"
          direction="ltr"
          role="img"
          aria-label={
            locale === "fa"
              ? "نمودار هندسی افق رویداد و خمیدگی نور برای خطای ۴۰۴"
              : "Geometric Schwarzschild event horizon and gravitational lensing diagram for 404"
          }
        >
          <defs>
            <radialGradient id="scienta-404-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--color-bg-deep)" stopOpacity="1" />
              <stop offset="32%" stopColor="var(--color-bg-deep)" stopOpacity="1" />
              <stop offset="44%" stopColor="var(--color-accent-orange)" stopOpacity="0.48" />
              <stop offset="62%" stopColor="var(--color-accent-purple)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-accent-purple)" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="scienta-404-photon-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-accent-orange)" stopOpacity="0.95" />
              <stop offset="50%" stopColor="var(--color-aurora-3)" stopOpacity="0.78" />
              <stop offset="100%" stopColor="var(--color-accent-purple)" stopOpacity="0.95" />
            </linearGradient>

            <linearGradient id="scienta-404-geodesic" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-accent-purple)" stopOpacity="0.08" />
              <stop offset="50%" stopColor="var(--color-text-primary)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--color-accent-orange)" stopOpacity="0.14" />
            </linearGradient>
          </defs>

          {/* Subtle breathing radial lensing wash centered on singularity */}
          <motion.circle
            cx={CENTER}
            cy={CENTER}
            r="170"
            fill="url(#scienta-404-glow)"
            style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            animate={
              prefersReducedMotion
                ? undefined
                : { scale: [0.96, 1.05, 0.96], opacity: [0.82, 1, 0.82] }
            }
            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Orthogonal coordinate crosshairs */}
          <line
            x1={CENTER - OUTER_RADIUS}
            y1={CENTER}
            x2={CENTER + OUTER_RADIUS}
            y2={CENTER}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
          <line
            x1={CENTER}
            y1={CENTER - OUTER_RADIUS}
            x2={CENTER}
            y2={CENTER + OUTER_RADIUS}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
            strokeDasharray="3 5"
          />

          {/* Outer calibrated compass ring + degree ticks */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
          {ticks.map((t, idx) => (
            <line
              key={idx}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isMajor ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)"}
              strokeWidth={t.isMajor ? "1.25" : "1"}
            />
          ))}

          {/* Gravitationally deflected null-geodesic light rays drawn via framer-motion */}
          <g fill="none" stroke="url(#scienta-404-geodesic)" strokeWidth="1.2">
            {GEODESIC_PATHS.map((d, idx) => (
              <motion.path
                key={idx}
                d={d}
                initial={prefersReducedMotion ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  duration: 1.15,
                  delay: 0.1 + idx * 0.12,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            ))}
          </g>

          {/* Subtle outgoing spacetime wave pulse from the event horizon */}
          {!prefersReducedMotion && (
            <motion.circle
              cx={CENTER}
              cy={CENTER}
              r={HORIZON_RADIUS}
              fill="none"
              stroke="rgba(var(--color-accent-glow-rgb), 0.45)"
              strokeWidth="1"
              style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
              animate={{ scale: [1, 3.1], opacity: [0.45, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
            />
          )}

          {/* ISCO ring (r = 3 r_s) — slow counter-rotation via framer-motion */}
          <motion.g
            style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            animate={prefersReducedMotion ? undefined : { rotate: -360 }}
            transition={{ duration: 54, repeat: Infinity, ease: "linear" }}
          >
            <circle
              cx={CENTER}
              cy={CENTER}
              r={ISCO_RADIUS}
              fill="none"
              stroke="rgba(var(--color-accent-glow-rgb), 0.28)"
              strokeWidth="1"
              strokeDasharray="6 8"
            />
            <circle cx={CENTER} cy={CENTER - ISCO_RADIUS} r="3" fill="var(--color-accent-purple)" />
          </motion.g>

          {/* Photon sphere (r = 1.5 r_s) — smooth clockwise orbit via framer-motion */}
          <motion.g
            style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            animate={prefersReducedMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          >
            <circle
              cx={CENTER}
              cy={CENTER}
              r={PHOTON_RADIUS}
              fill="none"
              stroke="rgba(var(--color-accent-secondary-rgb), 0.42)"
              strokeWidth="1.25"
              strokeDasharray="12 6"
            />
            <circle cx={CENTER + PHOTON_RADIUS} cy={CENTER} r="3.5" fill="var(--color-accent-orange)" />
          </motion.g>

          {/* Tilted relativistic accretion ellipse with subtle harmonic precession */}
          <motion.ellipse
            cx={CENTER}
            cy={CENTER}
            rx="126"
            ry="34"
            fill="none"
            stroke="url(#scienta-404-photon-ring)"
            strokeWidth="1.6"
            style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            initial={{ rotate: -18, opacity: 0.78 }}
            animate={
              prefersReducedMotion
                ? { rotate: -18, opacity: 0.78 }
                : { rotate: [-18, -14, -18], opacity: [0.68, 0.92, 0.68] }
            }
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Event horizon shadow core (r = r_s) */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={HORIZON_RADIUS}
            fill="var(--color-bg-deep)"
            stroke="url(#scienta-404-photon-ring)"
            strokeWidth="2"
          />

          {/* Precision 404 numeral anchored cleanly at the singularity core */}
          <text
            x={CENTER}
            y={CENTER + 11}
            textAnchor="middle"
            className="fill-(--color-text-primary) font-mono text-[32px] font-bold tracking-[0.14em]"
          >
            404
          </text>

          {/* Spring-damped interactive radial probe reticle */}
          <g opacity={probeMeta.active ? 0.95 : 0.68}>
            <motion.line
              x1={CENTER}
              y1={CENTER}
              x2={probeX}
              y2={probeY}
              stroke={probeStroke}
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <motion.circle
              cx={probeX}
              cy={probeY}
              r="5"
              fill="none"
              stroke={probeStroke}
              strokeWidth="1.25"
            />
            <motion.circle
              cx={probeX}
              cy={probeY}
              r="1.75"
              fill={probeMeta.insideHorizon ? "#ff3c5a" : "#f5f5fa"}
            />
          </g>

          {/* Minimal technical ring annotations */}
          <text
            x={CENTER + 8}
            y={CENTER - PHOTON_RADIUS - 7}
            className="fill-(--color-text-tertiary) font-mono text-[10px]"
          >
            1.5 r<tspan dy="2.5" fontSize="8">s</tspan>
          </text>
          <text
            x={CENTER + 8}
            y={CENTER - ISCO_RADIUS - 7}
            className="fill-(--color-text-tertiary) font-mono text-[10px]"
          >
            3.0 r<tspan dy="2.5" fontSize="8">s</tspan>
          </text>
        </svg>
      </div>

      {/* Bottom calibrated legend — clean unboxed text with typographic separator */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-(--color-border-subtle) pt-3 text-xs text-(--color-text-tertiary)">
        <span dir="ltr" className="font-mono tabular-nums">
          r<sub className="text-[10px]">s</sub> = 2GM / c²
        </span>
        <span className={probeMeta.insideHorizon ? "text-(--color-accent-red)" : "text-(--color-text-secondary)"}>
          {probeMeta.insideHorizon
            ? locale === "fa"
              ? "درون افق رویداد · بدون بازگشت سیگنال"
              : "Inside horizon · no escaping path"
            : locale === "fa"
              ? "مدار پایدار · بازگشت ممکن است"
              : "Stable orbit · safe trajectory"}
        </span>
      </div>
    </motion.div>
  );
}
