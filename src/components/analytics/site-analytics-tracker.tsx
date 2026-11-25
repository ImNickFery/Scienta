"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";

function readClientTelemetryMeta() {
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
    typeof navigator !== "undefined" && navigator.language ? navigator.language.slice(0, 32) : undefined;

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
            (nav.loadEventEnd > 0 ? nav.loadEventEnd : nav.domContentLoadedEventEnd) - nav.startTime
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

  return { timezone, screenWidth, language, utmSource, utmMedium, utmCampaign, perf };
}

/**
 * Privacy-first, zero-cookie site-wide pageview beacon mounted in `[locale]/layout.tsx`.
 * Article pages are tracked by `ArticleViewTracker` (with article_id attribution) using
 * the shared session deduplication key so no view is ever double-counted.
 */
export function SiteAnalyticsTracker({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    // Let ArticleViewTracker handle individual article routes so article_id is attached.
    if (/^\/(fa|en)\/articles\/[^/]+/.test(pathname)) return;
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    const dedupeKey = `scienta:pv:${pathname}`;
    try {
      if (sessionStorage.getItem(dedupeKey)) return;
      sessionStorage.setItem(dedupeKey, "1");
    } catch {
      // Proceed once if sessionStorage is restricted
    }

    const timer = setTimeout(() => {
      const meta = readClientTelemetryMeta();
      const payload = JSON.stringify({
        path: pathname,
        locale,
        referrer: typeof document !== "undefined" ? document.referrer || "" : "",
        ...meta,
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
    }, 1200);

    return () => clearTimeout(timer);
  }, [pathname, locale]);

  return null;
}
