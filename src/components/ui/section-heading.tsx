import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Section header.
 *
 * The eyebrow is a bordered pill with a live dot rather than loose small
 * caps — it reads as a label on the section, and the pulsing dot ties the
 * static heading into the page's overall motion without animating the type
 * itself. `titleMuted` is the second half of a two-tone headline: the
 * statement stays bright, the qualifier drops back to tertiary, which
 * gives a long title a natural emphasis break.
 */
export function SectionHeading({
  eyebrow,
  title,
  titleMuted,
  subtitle,
  viewAllHref,
  viewAllLabel,
  locale,
  align = "start",
  className,
}: {
  eyebrow?: string;
  title: string;
  titleMuted?: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  locale: string;
  align?: "start" | "center";
  className?: string;
}) {
  const Arrow = locale === "fa" ? ArrowLeft : ArrowRight;
  const centered = align === "center";

  return (
    <div
      className={cn(
        "mb-12 gap-4",
        centered ? "flex flex-col items-center text-center" : "flex flex-wrap items-end justify-between",
        className
      )}
    >
      <div className={cn(centered && "flex flex-col items-center")}>
        {eyebrow && (
          <span className="section-eyebrow-pill mb-4 inline-flex items-center gap-2 rounded-full border border-(--color-border-subtle) bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--color-text-secondary) backdrop-blur-sm">
            <span className="pulse-ring relative h-1.5 w-1.5 rounded-full bg-(--color-accent-orange) text-(--color-accent-orange)" />
            {eyebrow}
          </span>
        )}

        <h2
          className={cn(
            "font-[family-name:var(--font-display)] font-bold tracking-tight text-(--color-text-primary)",
            centered ? "text-3xl sm:text-4xl lg:text-5xl" : "text-2xl sm:text-3xl lg:text-4xl"
          )}
        >
          {title}
          {titleMuted && <span className="text-(--color-text-tertiary)"> {titleMuted}</span>}
        </h2>

        {subtitle && (
          <p
            className={cn(
              "mt-4 max-w-2xl text-(--color-text-secondary)",
              centered ? "text-base sm:text-lg" : "text-sm sm:text-base"
            )}
          >
            {subtitle}
          </p>
        )}
      </div>

      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="section-view-all-link group inline-flex items-center gap-1.5 rounded-full border border-(--color-border-subtle) bg-white/[0.02] px-4 py-2 text-sm font-medium text-(--color-text-secondary) transition-all duration-300 hover:border-(--color-accent-orange)/40 hover:bg-(--color-accent-orange)/[0.06] hover:text-(--color-accent-orange)"
        >
          {viewAllLabel}
          <Arrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
        </Link>
      )}
    </div>
  );
}
