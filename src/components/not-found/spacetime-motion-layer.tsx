"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Subtle scientific backdrop for the 404 page built with `framer-motion`.
 * Renders slow concentric gravitational-wave ripples and delicate drifting
 * orbital coordinate arcs that harmonize with Scienta's AuroraBackground and
 * Starfield without competing with foreground typography.
 *
 * Pinned to `dir="ltr"` so physical coordinates remain consistent across
 * Persian (RTL) and English (LTR) locales.
 */
export function SpacetimeMotionLayer() {
  const prefersReducedMotion = useReducedMotion();

  const ripples = [
    { delay: 0, duration: 9, color: "rgba(123, 63, 251, 0.22)" },
    { delay: 3, duration: 9, color: "rgba(255, 122, 0, 0.16)" },
    { delay: 6, duration: 9, color: "rgba(255, 60, 90, 0.14)" },
  ];

  return (
    <div
      dir="ltr"
      aria-hidden="true"
      data-testid="spacetime-motion-layer"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Subtle drifting coordinate lattice masked radially toward center */}
      <motion.div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(245, 245, 250, 0.35) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, #000 10%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, #000 10%, transparent 80%)",
        }}
        animate={
          prefersReducedMotion
            ? undefined
            : {
                opacity: [0.1, 0.17, 0.1],
                y: [0, -8, 0],
              }
        }
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Slow gravitational-wave ripples radiating across deep space */}
      <div className="absolute inset-0 flex items-center justify-center">
        {ripples.map((ripple, index) => (
          <motion.div
            key={index}
            className="absolute h-[34rem] w-[34rem] rounded-full border"
            style={{ borderColor: ripple.color }}
            initial={{ scale: 0.45, opacity: 0 }}
            animate={
              prefersReducedMotion
                ? { scale: 1 + index * 0.35, opacity: 0.14 }
                : {
                    scale: [0.45, 1.85],
                    opacity: [0, 0.35, 0],
                  }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : {
                    duration: ripple.duration,
                    delay: ripple.delay,
                    repeat: Infinity,
                    ease: [0.16, 1, 0.3, 1],
                  }
            }
          />
        ))}
      </div>

      {/* Delicate sweeping parabolic trajectory arc across the upper cosmos */}
      <svg
        viewBox="0 0 1440 520"
        fill="none"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 h-full w-full opacity-40"
      >
        <defs>
          <linearGradient id="scienta-404-arc-a" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7b3ffb" stopOpacity="0" />
            <stop offset="45%" stopColor="#7b3ffb" stopOpacity="0.45" />
            <stop offset="75%" stopColor="#ff7a00" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff3c5a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M -60 410 Q 520 120 1500 220"
          stroke="url(#scienta-404-arc-a)"
          strokeWidth="1"
          strokeDasharray="4 8"
          initial={{ pathLength: prefersReducedMotion ? 1 : 0, opacity: 0.2 }}
          animate={{ pathLength: 1, opacity: [0.22, 0.48, 0.22] }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : {
                  pathLength: { duration: 2.2, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 10, repeat: Infinity, ease: "easeInOut" },
                }
          }
        />
      </svg>
    </div>
  );
}
