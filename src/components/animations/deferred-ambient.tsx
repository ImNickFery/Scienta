"use client";

import { useEffect, useState } from "react";

/**
 * Defers mounting purely decorative ambient layers (blurred aurora orbs,
 * starfields, rising particle motes, animated grids) until after the document
 * finishes loading and the browser hits an idle window.
 *
 * This keeps FCP, LCP, and main-thread load pressure minimal on both mobile
 * and desktop while preserving 100% of the visual richness once loaded,
 * fading in smoothly on the compositor with zero layout shift (CLS = 0).
 */
export function DeferredAmbient({
  children,
  delayMs = 700,
}: {
  children: React.ReactNode;
  delayMs?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;

    const activate = () => {
      if (cancelled) return;
      setMounted(true);
      rafId = requestAnimationFrame(() => {
        if (!cancelled) setVisible(true);
      });
    };

    const schedule = () => {
      timerId = setTimeout(() => {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          idleId = window.requestIdleCallback(activate, { timeout: 1200 });
        } else {
          activate();
        }
      }, delayMs);
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (timerId !== null) clearTimeout(timerId);
      if (idleId !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [delayMs]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
