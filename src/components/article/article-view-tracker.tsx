"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n/config";

/**
 * Fires a single, idle-deferred, session-deduplicated pageview beacon for an
 * article essay so the Admin Analytics Hub tracks real live traffic, locales,
 * device classes, and referrers with zero impact on LCP/FCP.
 */
export function ArticleViewTracker({ slug, locale }: { slug: string; locale: Locale }) {
  useEffect(() => {
    const key = `scienta:viewed:${locale}:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private browsing / restricted storage: proceed once on mount.
    }

    const timer = setTimeout(() => {
      let perf: { ttfbMs: number; fcpMs: number | null; domLoadMs: number } | undefined;
      try {
        if (typeof performance !== "undefined") {
          const nav = performance.getEntriesByType("navigation")[0] as
            | PerformanceNavigationTiming
            | undefined;
          const paintEntries = performance.getEntriesByType("paint");
          const fcpEntry = paintEntries.find((e) => e.name === "first-contentful-paint");
          if (nav) {
            const ttfbMs = Math.max(0, Math.round(nav.responseStart - nav.requestStart));
            const domLoadMs = Math.max(
              ttfbMs,
              Math.round(
                (nav.loadEventEnd > 0 ? nav.loadEventEnd : nav.domContentLoadedEventEnd) -
                  nav.startTime
              )
            );
            const fcpMs = fcpEntry ? Math.max(0, Math.round(fcpEntry.startTime)) : null;
            if (domLoadMs > 0) {
              perf = { ttfbMs, fcpMs, domLoadMs };
            }
          }
        }
      } catch {
        // Ignore Performance API restrictions
      }

      const payload = JSON.stringify({
        slug,
        locale,
        referrer: typeof document !== "undefined" ? document.referrer || "" : "",
        ...(perf ? { perf } : {}),
      });

      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/public/track", blob);
      } else {
        fetch("/api/public/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [slug, locale]);

  return null;
}
