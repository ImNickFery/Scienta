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
      const payload = JSON.stringify({
        slug,
        locale,
        referrer: typeof document !== "undefined" ? document.referrer || "" : "",
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
