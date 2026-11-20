import { Suspense } from "react";
import Script from "next/script";
import {
  buildClarityBootstrapScript,
  buildGa4BootstrapScript,
  buildGtmBootstrapScript,
  buildYandexMetrikaScript,
  getAnalyticsConfig,
} from "@/lib/analytics";
import { RoutePageviewTracker } from "./route-pageview-tracker";

/**
 * Server Component that reads runtime analytics IDs (GTM, GA4, Microsoft Clarity,
 * Yandex Metrika) from process.env and injects only the configured tags.
 * Mounted exclusively in public `[locale]/layout.tsx` (never on `/admin`).
 */
export function AnalyticsScripts() {
  const { gtmId, ga4Id, clarityId, yandexMetrikaId } = getAnalyticsConfig();

  if (!gtmId && !ga4Id && !clarityId && !yandexMetrikaId) {
    return null;
  }

  return (
    <>
      {gtmId && (
        <>
          <Script id="scienta-gtm" strategy="afterInteractive">
            {buildGtmBootstrapScript(gtmId)}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        </>
      )}

      {ga4Id && (
        <>
          <Script
            id="scienta-ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`}
            strategy="afterInteractive"
          />
          <Script id="scienta-ga4-init" strategy="afterInteractive">
            {buildGa4BootstrapScript(ga4Id)}
          </Script>
        </>
      )}

      {clarityId && (
        <Script id="scienta-clarity" strategy="afterInteractive">
          {buildClarityBootstrapScript(clarityId)}
        </Script>
      )}

      {yandexMetrikaId && (
        <Script id="scienta-yandex-metrika" strategy="afterInteractive">
          {buildYandexMetrikaScript(yandexMetrikaId)}
        </Script>
      )}

      {(ga4Id || gtmId || yandexMetrikaId) && (
        <Suspense fallback={null}>
          <RoutePageviewTracker
            ga4Id={ga4Id}
            gtmId={gtmId}
            yandexMetrikaId={yandexMetrikaId}
          />
        </Suspense>
      )}
    </>
  );
}
