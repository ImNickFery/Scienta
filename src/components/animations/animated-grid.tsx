import { cn } from "@/lib/utils";

/**
 * A slowly drifting technical lattice used as a section backdrop. Pure CSS
 * (no JS, no canvas) so it renders on the server and costs one compositor
 * layer; the `prefers-reduced-motion` rule in globals.css freezes it.
 *
 * `variant="line"` reads as a wireframe/blueprint, `variant="dot"` as graph
 * paper — dots stay quieter behind text-dense sections.
 */
export function AnimatedGrid({
  variant = "line",
  size = 48,
  opacity = 0.035,
  fade = true,
  className,
}: {
  variant?: "line" | "dot";
  size?: number;
  /** Overall layer opacity — deliberately tiny; the grid should register as texture, not pattern. */
  opacity?: number;
  /** Fades the lattice out toward the top and bottom edges of its container. */
  fade?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        variant === "line" ? "bg-grid-drift" : "bg-dot-drift",
        className
      )}
      style={{
        ["--grid-size" as string]: `${size}px`,
        opacity,
        ...(fade
          ? {
              maskImage: "linear-gradient(to bottom, transparent, #000 15%, #000 85%, transparent)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 15%, #000 85%, transparent)",
            }
          : {}),
      }}
    />
  );
}
