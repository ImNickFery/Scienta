import { cn } from "@/lib/utils";
import { AnimatedGrid } from "@/components/animations/animated-grid";

/**
 * The standard band wrapper for homepage sections.
 *
 * Stacked dark sections go flat and undifferentiated very quickly. This
 * alternates the ground tone, floats one or two very soft colour blobs
 * behind the content, optionally lays a drifting lattice over the top, and
 * closes the top edge with a hairline that fades out at both ends — so the
 * page reads as distinct rooms rather than one long scroll.
 */
export function SectionShell({
  children,
  tone = "deep",
  grid = "none",
  glow = "purple",
  seam = true,
  className,
  id,
}: {
  children: React.ReactNode;
  tone?: "deep" | "raised";
  grid?: "none" | "line" | "dot";
  /** Which accent the ambient blobs take. "none" leaves the band clean. */
  glow?: "purple" | "orange" | "mixed" | "none";
  seam?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden py-20 sm:py-24",
        tone === "deep" ? "bg-(--color-bg-deep)" : "bg-(--color-bg-secondary)",
        seam && "seam-top",
        className
      )}
    >
      {glow !== "none" && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {(glow === "purple" || glow === "mixed") && (
            <div className="animate-orb absolute -top-32 start-[-10%] h-[34rem] w-[34rem] rounded-full bg-(--color-accent-purple)/[0.07] blur-[140px]" />
          )}
          {(glow === "orange" || glow === "mixed") && (
            <div
              className="animate-orb absolute -bottom-40 end-[-10%] h-[30rem] w-[30rem] rounded-full bg-(--color-accent-orange)/[0.06] blur-[140px]"
              style={{ animationDelay: "3s" }}
            />
          )}
        </div>
      )}

      {grid !== "none" && <AnimatedGrid variant={grid} size={grid === "dot" ? 26 : 44} opacity={0.03} />}

      <div className="relative z-10">{children}</div>
    </section>
  );
}
