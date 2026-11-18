import { cn } from "@/lib/utils";

/**
 * Deterministic PRNG (mulberry32). Particle positions must be identical on
 * the server and on the client — `Math.random()` here would produce a
 * hydration mismatch on every load, so the layout is seeded instead.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Slow motes rising through a section — the ambient "something is alive
 * here" layer behind the hero and feature bands. Rendered server-side as
 * plain divs on CSS animations, so it adds no JS and no canvas.
 */
export function ParticleField({
  count = 26,
  seed = 7,
  color = "rgba(255,255,255,0.55)",
  className,
}: {
  count?: number;
  /** Change to get a different (but still stable) scatter. */
  seed?: number;
  color?: string;
  className?: string;
}) {
  const rand = mulberry32(seed);

  const particles = Array.from({ length: count }, () => {
    const size = 1 + Math.round(rand() * 2.5);
    return {
      left: rand() * 100,
      // Staggered start so the field is already mid-flight on first paint
      // rather than every mote launching from the floor together.
      delay: -rand() * 26,
      duration: 20 + rand() * 22,
      drift: (rand() - 0.5) * 120,
      opacity: 0.22 + rand() * 0.4,
      size,
    };
  });

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-[-20px] rounded-full"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: color,
            animation: `particle-rise ${p.duration}s linear ${p.delay}s infinite`,
            ["--particle-drift" as string]: `${p.drift}px`,
            ["--particle-opacity" as string]: p.opacity,
          }}
        />
      ))}
    </div>
  );
}
