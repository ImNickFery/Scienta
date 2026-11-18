/**
 * Colour wash behind the hero and the standalone page headers. Positions are
 * physical rather than logical: the wash is pure decoration, so it should sit
 * in the same place in Persian as in English instead of mirroring with `dir`.
 * The `aurora-shift` keyframes and the mesh gradient are already
 * direction-independent.
 */
export function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-40 left-[-10%] h-[36rem] w-[36rem] rounded-full bg-(--color-accent-purple)/30 blur-[120px] animate-[aurora-shift_18s_ease-in-out_infinite_alternate]" />
      <div className="absolute top-0 right-[-15%] h-[32rem] w-[32rem] rounded-full bg-(--color-accent-orange)/20 blur-[120px] animate-[aurora-shift_22s_ease-in-out_infinite_alternate-reverse]" />
      <div className="absolute bottom-[-20%] left-1/3 h-[30rem] w-[30rem] rounded-full bg-(--color-accent-red)/20 blur-[130px] animate-[aurora-shift_26s_ease-in-out_infinite_alternate]" />
      <div className="bg-aurora-mesh absolute inset-0" />
    </div>
  );
}
