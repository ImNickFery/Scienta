import { DeferredAmbient } from "./deferred-ambient";

/**
 * Colour wash behind the hero and the standalone page headers. Positions are
 * physical rather than logical: the wash is pure decoration, so it should sit
 * in the same place in Persian as in English instead of mirroring with `dir`.
 *
 * The lightweight CSS radial `.bg-aurora-mesh` paints immediately on SSR, while
 * the three large Gaussian-blurred animated orbs mount progressively right after
 * initial page load so both mobile and desktop get the full atmospheric depth
 * without delaying FCP/LCP.
 */
export function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="bg-aurora-mesh absolute inset-0" />
      <DeferredAmbient delayMs={600}>
        <div className="ambient-effects-layer absolute inset-0">
          <div className="absolute -top-40 left-[-10%] h-[36rem] w-[36rem] rounded-full bg-(--color-aurora-1)/30 blur-[120px] animate-[aurora-shift_18s_ease-in-out_infinite_alternate]" />
          <div className="absolute top-0 right-[-15%] h-[32rem] w-[32rem] rounded-full bg-(--color-aurora-2)/22 blur-[120px] animate-[aurora-shift_22s_ease-in-out_infinite_alternate-reverse]" />
          <div className="absolute bottom-[-20%] left-1/3 h-[30rem] w-[30rem] rounded-full bg-(--color-aurora-3)/22 blur-[130px] animate-[aurora-shift_26s_ease-in-out_infinite_alternate]" />
        </div>
      </DeferredAmbient>
    </div>
  );
}
