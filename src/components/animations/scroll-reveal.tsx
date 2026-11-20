"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Direction = "up" | "down" | "start" | "end" | "scale" | "none";

/**
 * Progressive-enhancement entrance wrapper.
 *
 * - Content is ALWAYS visible by default (`opacity: 1` on SSR and initial
 *   paint) so no section, card, heading, or CTA can ever remain stuck invisible
 *   in embedded iframes, nested scroll containers, or slow hydration paths.
 * - `immediate` plays a pure CSS entrance animation (`.hero-enter`) on mount.
 * - Below-the-fold instances observe entry with `IntersectionObserver` and play
 *   a subtle `.reveal-settle` CSS glide when the element actually scrolls in
 *   from below the viewport.
 */
export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  distance = 20,
  duration = 650,
  immediate = false,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: Direction;
  distance?: number;
  /** Kept for API compatibility; blur is avoided so content stays crisp immediately. */
  blur?: boolean;
  duration?: number;
  /** Above-the-fold mode: animates via CSS immediately without waiting on IntersectionObserver. */
  immediate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [settling, setSettling] = useState(false);
  const [rtl, setRtl] = useState(false);

  useEffect(() => {
    if (immediate) return;
    const el = ref.current;
    if (!el) return;

    if (
      typeof window === "undefined" ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let initialized = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((e) => e.isIntersecting);
        if (!initialized) {
          initialized = true;
          // Elements already visible on initial paint stay crisp with zero forced layout read.
          if (intersecting) {
            observer.disconnect();
          }
          return;
        }
        if (intersecting) {
          setRtl(document.documentElement.dir === "rtl");
          setSettling(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01, rootMargin: "0px 0px 40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate]);

  if (immediate) {
    return (
      <div
        ref={ref}
        className={`hero-enter ${className}`}
        style={{
          animationDuration: `${duration}ms`,
          animationDelay: `${delay}ms`,
        }}
      >
        {children}
      </div>
    );
  }

  const revealVars: CSSProperties & Record<string, string | number> = {};
  if (settling) {
    revealVars.animationDuration = `${duration}ms`;
    revealVars.animationDelay = `${Math.min(delay, 240)}ms`;
    switch (direction) {
      case "up":
        revealVars["--reveal-y"] = `${Math.min(distance, 24)}px`;
        break;
      case "down":
        revealVars["--reveal-y"] = `-${Math.min(distance, 24)}px`;
        break;
      case "start":
        revealVars["--reveal-x"] = `${rtl ? Math.min(distance, 20) : -Math.min(distance, 20)}px`;
        revealVars["--reveal-y"] = "0px";
        break;
      case "end":
        revealVars["--reveal-x"] = `${rtl ? -Math.min(distance, 20) : Math.min(distance, 20)}px`;
        revealVars["--reveal-y"] = "0px";
        break;
      case "scale":
        revealVars["--reveal-y"] = "8px";
        revealVars["--reveal-scale"] = "0.96";
        break;
      default:
        revealVars["--reveal-y"] = "0px";
        break;
    }
  }

  return (
    <div
      ref={ref}
      className={`${settling ? "reveal-settle " : ""}${className}`}
      style={settling ? revealVars : undefined}
    >
      {children}
    </div>
  );
}
