import { useId } from "react";
import { SCIENTA_LOGO_PATHS, SCIENTA_LOGO_VIEWBOX } from "@/lib/brand-logo-geometry";

export type ScientaLogoVariant = "luxury" | "editorial" | "kinetic" | "monochrome";

export interface ScientaLogoMarkProps {
  /** Pixel dimensions (square 1:1). Defaults to 30. */
  size?: number;
  /**
   * Visual finish:
   * - `luxury`: Crisp platinum-ivory upper prism + luminous Scienta amethyst-violet lower prism.
   * - `editorial`: Clean archival editorial finish (primary ink + brand accent).
   * - `kinetic`: Optical-lab dual-prism with micro-kinetic hover glide along the refraction axis.
   * - `monochrome`: Pure `currentColor` geometric mark for stamps and watermarks.
   */
  variant?: ScientaLogoVariant;
  /**
   * When true, mounts the monogram on a matte obsidian squircle with a top-lit 1px hairline bezel
   * (used for Admin Login, Admin Sidebar, favicon, and standalone /logo.svg).
   */
  framed?: boolean;
  /** Enables subtle hover glide along the 63.4-degree optical refraction axis when inside a `.group` link. */
  interactive?: boolean;
  /**
   * Crops outer canvas padding tightly to the glyph ink bounds (viewBox 12 8 40 48) so the mark
   * locks inline directly as the capital "S" in the "Scienta" wordmark with exact baseline alignment.
   */
  tight?: boolean;
  /** Accessible label when rendered standalone; omit when paired beside visible text. */
  label?: string;
  className?: string;
}

/**
 * Scienta Flagship Minimalist SVG Monogram.
 *
 * Two G2-superellipse optical prisms in exact 180-degree rotational symmetry,
 * shifted by a deliberate 1.8px inward Snell refraction step across a 63.4-degree light slit,
 * with subtly inflected inward terminals and crisp platinum + violet dual-tone finish.
 */
export function ScientaLogoMark({
  size = 30,
  variant = "luxury",
  framed = false,
  interactive = false,
  tight = false,
  label,
  className = "",
}: ScientaLogoMarkProps) {
  const uid = useId().replace(/:/g, "");
  const isMono = variant === "monochrome";
  const isEditorial = variant === "editorial";
  const enableGlide = interactive || variant === "kinetic";
  const useTight = tight && !framed;

  const svgWidth = useTight ? Math.round(size * (40 / 48) * 10) / 10 : size;
  const svgHeight = size;
  const viewBox = useTight ? "12 8 40 48" : SCIENTA_LOGO_VIEWBOX;

  const plateGradId = `sc-p-${uid}`;
  const rimGradId = `sc-r-${uid}`;
  const upperGradId = `sc-u-${uid}`;
  const lowerGradId = `sc-l-${uid}`;

  // Crisp Platinum Ivory + Active Theme Accent (violet in Classic, vermilion-orange in Unslop Kinetic)
  const upperStart = framed ? "#FFFFFF" : "var(--logo-primary-1, #FFFFFF)";
  const upperEnd = framed ? "#D8D8E4" : "var(--logo-primary-2, #D8D8E4)";
  const lowerStart = "var(--logo-accent-1, #B89BFF)";
  const lowerEnd = "var(--logo-accent-2, #7B3FFB)";

  const accessibilityProps = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none overflow-visible ${className}`.trim()}
      {...accessibilityProps}
    >
      <defs>
        {framed && (
          <>
            <linearGradient id={plateGradId} x1="15%" y1="0%" x2="85%" y2="100%">
              <stop offset="0%" stopColor="#13131E" />
              <stop offset="100%" stopColor="#07070C" />
            </linearGradient>
            <linearGradient id={rimGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.2" />
              <stop offset="55%" stopColor="#B89BFF" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.06" />
            </linearGradient>
          </>
        )}

        {!isMono && !isEditorial && (
          <>
            <linearGradient id={upperGradId} x1="15%" y1="10%" x2="85%" y2="70%">
              <stop offset="0%" stopColor={upperStart} />
              <stop offset="100%" stopColor={upperEnd} />
            </linearGradient>
            <linearGradient id={lowerGradId} x1="85%" y1="90%" x2="20%" y2="35%">
              <stop offset="0%" stopColor={lowerStart} />
              <stop offset="100%" stopColor={lowerEnd} />
            </linearGradient>
          </>
        )}
      </defs>

      {framed && (
        <>
          <rect x="1" y="1" width="62" height="62" rx="15" fill={`url(#${plateGradId})`} />
          <rect
            x="1.5"
            y="1.5"
            width="61"
            height="61"
            rx="14.5"
            stroke={`url(#${rimGradId})`}
            strokeWidth="1"
          />
        </>
      )}

      <g transform={framed ? "translate(32 32) scale(0.76) translate(-32 -32)" : undefined}>
        <path
          d={SCIENTA_LOGO_PATHS.prismUpper}
          fill={
            isMono
              ? "currentColor"
              : isEditorial
                ? "var(--color-text-primary)"
                : `url(#${upperGradId})`
          }
          className={
            enableGlide
              ? "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-[0.65px] group-hover:-translate-y-[1.3px] motion-reduce:transition-none"
              : undefined
          }
        />
        <path
          d={SCIENTA_LOGO_PATHS.prismLower}
          fill={
            isMono
              ? "currentColor"
              : isEditorial
                ? "var(--color-accent-purple)"
                : `url(#${lowerGradId})`
          }
          fillOpacity={isMono ? 0.65 : 1}
          className={
            enableGlide
              ? "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[0.65px] group-hover:translate-y-[1.3px] motion-reduce:transition-none"
              : undefined
          }
        />
      </g>
    </svg>
  );
}
