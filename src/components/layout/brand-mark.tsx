import Link from "next/link";
import { Aperture, Compass, Sparkles } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { DesignMode } from "@/lib/site-modes";

/**
 * Scienta brand wordmark.
 * - Classic mode preserves the original aurora gradient tile + gradient wordmark.
 * - Unslop Observatory Press renders a flat 1-ink compass mark + solid wordmark.
 * - Unslop Kinetic (Optical Lab) renders a flat precision aperture mark + solid wordmark.
 */
export function BrandMark({
  locale,
  designMode = "classic",
}: {
  locale: Locale;
  designMode?: DesignMode;
}) {
  if (designMode === "unslop-kinetic") {
    return (
      <Link
        href={`/${locale}`}
        className="group inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap text-base font-medium text-(--color-text-primary) transition-colors duration-150 hover:text-(--color-accent-purple)"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-(--color-border-strong) bg-(--color-bg-elevated) text-(--color-accent-purple) transition-colors duration-150 group-hover:border-(--color-accent-purple)"
        >
          <Aperture className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <span className="font-[family-name:var(--font-display)] text-lg font-medium tracking-normal">
          Scienta
        </span>
      </Link>
    );
  }

  if (designMode === "unslop") {
    return (
      <Link
        href={`/${locale}`}
        className="group inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap text-base font-medium text-(--color-text-primary) transition-colors duration-150 hover:text-(--color-accent-purple)"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-(--color-border-strong) bg-(--color-bg-elevated) text-(--color-text-primary) transition-colors duration-150 group-hover:border-(--color-accent-purple) group-hover:text-(--color-accent-purple)"
        >
          <Compass className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <span className="font-[family-name:var(--font-display)] text-lg font-medium tracking-normal">
          Scienta
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/${locale}`}
      className="group flex shrink-0 items-center gap-2 whitespace-nowrap font-[family-name:var(--font-display)] text-lg font-bold"
    >
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-(--color-accent-purple) to-(--color-aurora-3) transition-transform duration-300 group-hover:scale-105">
        <Sparkles className="h-4 w-4 text-white" />
      </span>
      <span className="text-gradient-aurora">Scienta</span>
    </Link>
  );
}
