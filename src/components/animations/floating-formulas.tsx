/**
 * Decorative math drifting behind the hero. The layer is pinned to LTR
 * because Persian flips it twice over otherwise: logical insets move every
 * formula to the opposite edge, and the bidi algorithm throws leading
 * operators (`∇ ·`, `∫`) to the far side of their own expression. Physical
 * `left` plus `dir="ltr"` keep the backdrop identical in every locale —
 * same rule the stylesheet already applies to code and KaTeX output.
 */
const formulas = [
  { text: "E = mc²", top: "12%", left: "6%", delay: "0s", size: "text-2xl" },
  { text: "∇ · E = ρ/ε₀", top: "68%", left: "10%", delay: "1.4s", size: "text-lg" },
  { text: "iħ∂ψ/∂t = Ĥψ", top: "22%", left: "82%", delay: "0.6s", size: "text-xl" },
  { text: "∫e^{-x²}dx = √π", top: "78%", left: "78%", delay: "2.1s", size: "text-lg" },
  { text: "a² + b² = c²", top: "45%", left: "4%", delay: "3s", size: "text-base" },
  { text: "F = G(m₁m₂)/r²", top: "8%", left: "62%", delay: "1s", size: "text-base" },
];

export function FloatingFormulas() {
  return (
    <div
      dir="ltr"
      className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block"
      aria-hidden="true"
    >
      {formulas.map((f, i) => (
        <span
          key={i}
          style={{ top: f.top, left: f.left, animationDelay: f.delay }}
          className={`absolute font-[family-name:var(--font-mono)] ${f.size} text-(--color-text-tertiary)/30 animate-float-slow select-none`}
        >
          {f.text}
        </span>
      ))}
    </div>
  );
}
