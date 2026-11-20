export interface AnalyticsConfig {
  gtmId: string | null;
  ga4Id: string | null;
  clarityId: string | null;
  yandexMetrikaId: string | null;
}

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,16}$/i;
const GA4_ID_PATTERN = /^G-[A-Z0-9]{6,16}$/i;
const CLARITY_ID_PATTERN = /^[a-z0-9]{6,20}$/i;
const YANDEX_ID_PATTERN = /^\d{5,12}$/;

/** Validates a Google Tag Manager container ID (e.g. GTM-XXXXXXX). */
export function sanitizeGtmId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  return GTM_ID_PATTERN.test(trimmed) ? trimmed : null;
}

/** Validates a Google Analytics 4 measurement ID (e.g. G-XXXXXXXXXX). */
export function sanitizeGa4Id(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  return GA4_ID_PATTERN.test(trimmed) ? trimmed : null;
}

/** Validates a Microsoft Clarity project ID. */
export function sanitizeClarityId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return CLARITY_ID_PATTERN.test(trimmed) ? trimmed : null;
}

/** Validates a numeric Yandex Metrika counter ID. */
export function sanitizeYandexMetrikaId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return YANDEX_ID_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Reads runtime analytics IDs from server environment variables so cPanel `.env`
 * changes take effect immediately on restart without rebuilding Next.js.
 */
export function getAnalyticsConfig(
  env: Record<string, string | undefined> = process.env
): AnalyticsConfig {
  return {
    gtmId: sanitizeGtmId(env.GTM_ID || env.NEXT_PUBLIC_GTM_ID),
    ga4Id: sanitizeGa4Id(env.GA_MEASUREMENT_ID || env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    clarityId: sanitizeClarityId(env.CLARITY_ID || env.NEXT_PUBLIC_CLARITY_ID),
    yandexMetrikaId: sanitizeYandexMetrikaId(
      env.YANDEX_METRIKA_ID || env.NEXT_PUBLIC_YANDEX_METRIKA_ID
    ),
  };
}

export function buildGtmBootstrapScript(gtmId: string): string {
  const safeId = sanitizeGtmId(gtmId);
  if (!safeId) return "";
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(safeId)});`;
}

export function buildGa4BootstrapScript(ga4Id: string): string {
  const safeId = sanitizeGa4Id(ga4Id);
  if (!safeId) return "";
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(safeId)},{anonymize_ip:true,send_page_view:true});`;
}

export function buildClarityBootstrapScript(clarityId: string): string {
  const safeId = sanitizeClarityId(clarityId);
  if (!safeId) return "";
  return `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(safeId)});`;
}

export function buildYandexMetrikaScript(counterId: string): string {
  const safeId = sanitizeYandexMetrikaId(counterId);
  if (!safeId) return "";
  return `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${safeId},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});`;
}
