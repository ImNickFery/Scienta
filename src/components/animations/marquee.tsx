import { cn } from "@/lib/utils";

/**
 * Infinite horizontal ticker. The children are rendered twice back-to-back
 * and the track translates exactly -50%, so the second copy lands where the
 * first started and the loop is seamless.
 *
 * Direction is handled in CSS (`.marquee-track` swaps to a mirrored
 * keyframe under RTL) so the ticker always travels against the reading
 * direction, which is what makes it feel like content arriving rather than
 * content fleeing.
 */
export function Marquee({
  children,
  duplicate,
  duration = 42,
  className,
}: {
  children: React.ReactNode;
  /** Optional non-interactive copy rendered inside the aria-hidden seamless track. */
  duplicate?: React.ReactNode;
  /** Seconds for one full pass. Longer = calmer. */
  duration?: number;
  className?: string;
}) {
  return (
    <div className={cn("marquee-mask relative overflow-hidden", className)}>
      <div className="marquee-track" style={{ ["--marquee-duration" as string]: `${duration}s` }}>
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true" inert={true}>
          {duplicate ?? children}
        </div>
      </div>
    </div>
  );
}
