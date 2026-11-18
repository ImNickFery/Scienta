const PALETTES: Record<string, [string, string, string]> = {
  purple: ["#7B3FFB", "#0D0D15", "#05050A"],
  orange: ["#FF7A00", "#0D0D15", "#05050A"],
  red: ["#FF3C5A", "#0D0D15", "#05050A"],
  aurora: ["#7B3FFB", "#FF7A00", "#05050A"],
};

/**
 * Deterministic abstract SVG illustration used as figure/hero imagery
 * when no real photograph is supplied. Picks a pattern by name so the
 * same `variant` always renders the same artwork (stable across SSR).
 */
export function SciIllustration({
  variant = "orbit",
  palette = "aurora",
  className = "",
}: {
  variant?: "orbit" | "nebula" | "circuit" | "wave" | "molecule" | "field-lines";
  palette?: keyof typeof PALETTES;
  className?: string;
}) {
  const [c1, c2, bg] = PALETTES[palette] ?? PALETTES.aurora;
  const id = `${variant}-${palette}`;

  return (
    <svg viewBox="0 0 800 450" className={className} preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
      <defs>
        <radialGradient id={`bg-${id}`} cx="30%" cy="20%" r="80%">
          <stop offset="0%" stopColor={c1} stopOpacity="0.35" />
          <stop offset="100%" stopColor={bg} stopOpacity="1" />
        </radialGradient>
        <linearGradient id={`stroke-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill={`url(#bg-${id})`} />

      {variant === "orbit" && (
        <g fill="none" stroke={`url(#stroke-${id})`} strokeWidth="1.5" opacity="0.8">
          <ellipse cx="400" cy="225" rx="260" ry="90" className="animate-orbit-slow" />
          <ellipse cx="400" cy="225" rx="200" ry="150" transform="rotate(35 400 225)" className="animate-orbit-slower" />
          <ellipse cx="400" cy="225" rx="150" ry="200" transform="rotate(-25 400 225)" className="animate-orbit-slow" />
          <circle cx="400" cy="225" r="34" fill={c1} opacity="0.9" stroke="none" className="animate-pulse-glow-soft" />
          <circle cx="640" cy="200" r="6" fill={c2} stroke="none" />
          <circle cx="220" cy="320" r="4" fill={c1} stroke="none" />
        </g>
      )}

      {variant === "nebula" && (
        <g opacity="0.85">
          {Array.from({ length: 60 }).map((_, i) => {
            const x = (i * 137) % 800;
            const y = (i * 89) % 450;
            const r = (i % 5) + 0.5;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                fill={i % 3 === 0 ? c1 : "#f5f5fa"}
                opacity={0.2 + (i % 4) * 0.15}
                className="animate-twinkle"
                style={{ animationDelay: `${(i % 12) * 0.35}s`, animationDuration: `${3 + (i % 5)}s` }}
              />
            );
          })}
          <ellipse cx="500" cy="180" rx="220" ry="130" fill={c1} opacity="0.12" />
          <ellipse cx="300" cy="280" rx="180" ry="110" fill={c2} opacity="0.1" />
        </g>
      )}

      {variant === "circuit" && (
        <g fill="none" stroke={`url(#stroke-${id})`} strokeWidth="2" opacity="0.75" strokeLinecap="round">
          <path d="M60 100 H300 V220 H460 V80 H740" />
          <path d="M60 350 H220 V260 H500 V380 H740" />
          <path d="M180 100 V40" />
          <path d="M460 380 V420" />
          {[[300, 100], [460, 220], [220, 260], [500, 380], [180, 40], [460, 420]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="6" fill={c1} stroke="none" />
          ))}
        </g>
      )}

      {variant === "wave" && (
        <g fill="none" stroke={`url(#stroke-${id})`} strokeWidth="2" opacity="0.8">
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M0 ${140 + i * 60} Q200 ${60 + i * 60} 400 ${140 + i * 60} T800 ${140 + i * 60}`}
              opacity={0.9 - i * 0.18}
              className="animate-drift"
              style={{ animationDelay: `${i * 0.8}s`, animationDuration: `${5 + i}s` }}
            />
          ))}
        </g>
      )}

      {variant === "molecule" && (
        <g stroke={`url(#stroke-${id})`} strokeWidth="2" opacity="0.85">
          <line x1="250" y1="180" x2="400" y2="120" />
          <line x1="400" y1="120" x2="560" y2="190" />
          <line x1="400" y1="120" x2="420" y2="300" />
          <line x1="420" y1="300" x2="280" y2="360" />
          <line x1="420" y1="300" x2="580" y2="340" />
          {[[250, 180, 14], [400, 120, 20], [560, 190, 12], [420, 300, 16], [280, 360, 10], [580, 340, 10]].map(
            ([x, y, r], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                fill={i % 2 === 0 ? c1 : c2}
                stroke="none"
                opacity="0.9"
                className={i === 1 ? "animate-pulse-glow-soft" : undefined}
              />
            )
          )}
        </g>
      )}

      {variant === "field-lines" && (
        <g fill="none" stroke={`url(#stroke-${id})`} strokeWidth="1.5" opacity="0.7">
          {Array.from({ length: 10 }).map((_, i) => (
            <path key={i} d={`M${50 + i * 75} 40 Q400 ${225 + (i - 5) * 20} ${50 + i * 75} 410`} />
          ))}
          <circle cx="400" cy="225" r="24" fill={c1} stroke="none" className="animate-pulse-glow-soft" />
        </g>
      )}
    </svg>
  );
}
