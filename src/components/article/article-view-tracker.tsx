"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n/config";

/**
 * Fires a single, idle-deferred, session-deduplicated pageview beacon for an
 * article essay so the Admin Analytics Hub tracks live traffic, geography,
 * search engines, browsers, OS, devices, and referrers with zero impact on LCP/FCP.
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

      let timezone: string | undefined;
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
      } catch {
        // Ignore Intl restrictions
      }

      let screenWidth: number | undefined;
      if (typeof window !== "undefined") {
        const w = Math.round(window.screen?.width || window.innerWidth || 0);
        if (w >= 100 && w <= 10_000) screenWidth = w;
      }

      const language =
        typeof navigator !== "undefined" && navigator.language
          ? navigator.language.slice(0, 32)
          : undefined;

      let utmSource: string | undefined;
      let utmMedium: string | undefined;
      let utmCampaign: string | undefined;
      if (typeof window !== "undefined" && window.location.search) {
        try {
          const sp = new URLSearchParams(window.location.search);
          utmSource = sp.get("utm_source")?.slice(0, 80) || undefined;
          utmMedium = sp.get("utm_medium")?.slice(0, 80) || undefined;
          utmCampaign = sp.get("utm_campaign")?.slice(0, 80) || undefined;
        } catch {
          // Ignore malformed query string
        }
      }

      const payload = JSON.stringify({
        slug,
        locale,
        referrer: typeof document !== "undefined" ? document.referrer || "" : "",
        timezone,
        screenWidth,
        language,
        utmSource,
        utmMedium,
        utmCampaign,
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
