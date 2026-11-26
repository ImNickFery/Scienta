import Link from "next/link";
import { ScientaLogoMark } from "./scienta-logo-mark";
import type { Locale } from "@/lib/i18n/config";
import type { DesignMode } from "@/lib/site-modes";

/**
 * Scienta integrated typographic logotype: the optical-refraction "S" emblem
 * serves directly as the initial capital "S" of "Scienta" ([S]cienta).
 * Always forced to `dir="ltr"` so the wordmark never reverses in Persian RTL layouts,
 * while exposing clean accessible name "Scienta" for screen readers and SEO.
 */
export function BrandMark({
  locale,
  designMode = "classic",
  onClick,
}: {
  locale: Locale;
  designMode?: DesignMode;
  onClick?: () => void;
}) {
  if (designMode === "unslop-kinetic") {
    return (
      <Link
        href={`/${locale}`}
        onClick={onClick}
        aria-label="Scienta"
        className="group inline-flex shrink-0 items-center whitespace-nowrap text-(--color-text-primary) transition-colors duration-150 hover:text-(--color-accent-purple) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent-purple) focus-visible:rounded-md"
      >
        <span dir="ltr" aria-hidden="true" className="inline-flex items-baseline gap-[1.5px]">
          <ScientaLogoMark size={17} variant="kinetic" tight interactive className="translate-y-[0.5px]" />
          <span className="font-[family-name:var(--font-latin-display)] text-[21px] font-semibold leading-none tracking-[-0.025em]">
            cienta
          </span>
        </span>
      </Link>
    );
  }

  if (designMode === "unslop") {
    return (
      <Link
        href={`/${locale}`}
        onClick={onClick}
        aria-label="Scienta"
        className="group inline-flex shrink-0 items-center whitespace-nowrap text-(--color-text-primary) transition-colors duration-150 hover:text-(--color-accent-purple) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent-purple) focus-visible:rounded-md"
      >
        <span dir="ltr" aria-hidden="true" className="inline-flex items-baseline gap-[1.5px]">
          <ScientaLogoMark size={17} variant="editorial" tight interactive className="translate-y-[0.5px]" />
          <span className="font-[family-name:var(--font-latin-display)] text-[21px] font-semibold leading-none tracking-[-0.025em]">
            cienta
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/${locale}`}
      onClick={onClick}
      aria-label="Scienta"
      className="group inline-flex shrink-0 items-center whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent-purple) focus-visible:rounded-md"
    >
      <span dir="ltr" aria-hidden="true" className="inline-flex items-baseline gap-[1.5px]">
        <ScientaLogoMark size={18} variant="luxury" tight interactive className="translate-y-[0.5px]" />
        <span className="text-gradient-aurora font-[family-name:var(--font-latin-display)] text-[22px] font-bold leading-none tracking-[-0.03em]">
          cienta
        </span>
      </span>
    </Link>
  );
}
