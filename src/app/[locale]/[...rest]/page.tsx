import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLocale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isFa = !isValidLocale(locale) || locale === "fa";
  return {
    title: isFa ? "صفحه یافت نشد (۴۰۴)" : "Page Not Found (404)",
    robots: { index: false, follow: true },
  };
}

/**
 * Catch-all route inside `[locale]` so every unmatched URL under `/fa/*` or `/en/*`
 * invokes `notFound()`, preserving HTTP 404 semantics while rendering Scienta's
 * localized `src/app/[locale]/not-found.tsx` boundary with the `framer-motion`
 * SpacetimeMotionLayer and interactive Schwarzschild EventHorizonGraphic.
 */
export default function LocaleCatchAllNotFound() {
  notFound();
}
