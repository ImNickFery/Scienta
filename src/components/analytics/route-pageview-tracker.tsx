"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    ym?: (id: number, action: string, url?: string) => void;
  }
}

interface RoutePageviewTrackerProps {
  ga4Id: string | null;
  gtmId: string | null;
  yandexMetrikaId: string | null;
}

/**
 * Emits SPA route-change pageviews on Next.js App Router client navigations
 * without double-counting the initial SSR page load.
 */
export function RoutePageviewTracker({
  ga4Id,
  gtmId,
  yandexMetrikaId,
}: RoutePageviewTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);
  const query = searchParams?.toString() ?? "";

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const pagePath = query ? `${pathname}?${query}` : pathname;
    const pageLocation = typeof window !== "undefined" ? window.location.href : pagePath;

    if (ga4Id && typeof window.gtag === "function") {
      window.gtag("event", "page_view", {
        page_path: pagePath,
        page_location: pageLocation,
        page_title: document.title,
      });
    }

    if (gtmId && Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: "virtual_pageview",
        page_path: pagePath,
        page_location: pageLocation,
        page_title: document.title,
      });
    }

    if (yandexMetrikaId && typeof window.ym === "function") {
      window.ym(Number(yandexMetrikaId), "hit", pageLocation);
    }
  }, [pathname, query, ga4Id, gtmId, yandexMetrikaId]);

  return null;
}
