import katex from "katex";
import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/animations/aurora-background";
import { Starfield } from "@/components/animations/starfield";
import { FloatingFormulas } from "@/components/animations/floating-formulas";
import { AnimatedGrid } from "@/components/animations/animated-grid";
import { ParticleField } from "@/components/animations/particle-field";
import { RotatingWord } from "@/components/animations/rotating-word";
import { ScrollReveal } from "@/components/animations/scroll-reveal";
import { DerivationConsole, type ConsoleLine } from "./derivation-console";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * Renders LaTeX to HTML on the server so the hero panel ships finished
 * markup — no client-side KaTeX bundle, no layout shift while math
 * typesets. `katex/dist/katex.min.css` is already loaded by the locale
 * layout, so the output is styled on arrival.
 */
function tex(source: string): string {
  return katex.renderToString(source, {
    displayMode: true,
    throwOnError: false,
    output: "html",
  });
}

export function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const c = dict.hero.console;

  const consoleLines: ConsoleLine[] = [
    { kind: "command", text: c.step1 },
    { kind: "log", text: c.log1 },
    { kind: "math", html: tex(String.raw`r_s = \frac{2GM}{c^2}`) },
    { kind: "log", text: c.log2 },
    {
      kind: "result",
      label: c.resultLabel,
      html: tex(String.raw`r_s \approx 2.95\ \text{km}`),
    },
    { kind: "log", text: c.log3 },
  ];

  return (
    <section className="relative flex min-h-[100dvh] items-center overflow-hidden border-b border-(--color-border-subtle)">
      {/* Backdrop stack, back to front: colour wash → lattice → stars →
          rising motes → drifting formulas. Each layer moves at a different
          rate, which is what gives the hero depth rather than just texture. */}
      <AuroraBackground />
      <AnimatedGrid variant="line" size={56} opacity={0.04} />
      <Starfield />
      <ParticleField count={22} seed={11} />
      <FloatingFormulas />

      <Container className="relative z-10 py-28 lg:py-32">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-12">
          {/* ---------- Copy ---------- */}
          <div className="text-center lg:text-start">
            <ScrollReveal immediate direction="scale" duration={550}>
              <div className="inline-flex items-center gap-2 rounded-full border border-(--color-border-subtle) bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-(--color-text-secondary) backdrop-blur-sm">
                <span className="pulse-ring relative h-1.5 w-1.5 rounded-full bg-(--color-accent-orange) text-(--color-accent-orange)" />
                {dict.hero.eyebrow}
              </div>
            </ScrollReveal>

            <ScrollReveal immediate delay={70} blur>
              <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
                <span className="text-gradient-flow">{dict.hero.titleLead}</span>{" "}
                <span className="text-(--color-text-tertiary)">{dict.hero.titleTail}</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal immediate delay={140}>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-(--color-text-secondary) sm:text-lg lg:mx-0">
                {dict.hero.subtitle}
              </p>
            </ScrollReveal>

            <ScrollReveal immediate delay={210}>
              <p className="mt-7 flex flex-wrap items-baseline justify-center gap-x-2 font-[family-name:var(--font-mono)] text-sm text-(--color-text-tertiary) lg:justify-start">
                <span>{dict.hero.rotatingPrefix}</span>
                <RotatingWord
                  words={dict.hero.rotating}
                  locale={locale}
                  className="font-[family-name:var(--font-display)] text-base font-bold"
                />
              </p>
            </ScrollReveal>

            <ScrollReveal immediate delay={280}>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                <Button href={`/${locale}/articles`} size="lg">
                  {dict.hero.ctaPrimary}
                </Button>
                <Button href={`/${locale}/about`} variant="secondary" size="lg">
                  {dict.hero.ctaSecondary}
                </Button>
              </div>
            </ScrollReveal>
          </div>

          {/* ---------- Live derivation panel ---------- */}
          <ScrollReveal immediate direction="end" delay={200} distance={40} blur>
            <DerivationConsole
              lines={consoleLines}
              title={c.title}
              statusRunning={c.statusRunning}
              statusDone={c.statusDone}
              chips={[...c.chips]}
            />
          </ScrollReveal>
        </div>
      </Container>

      <div className="absolute inset-x-0 bottom-8 z-10 hidden flex-col items-center gap-2 text-(--color-text-tertiary) sm:flex">
        <span className="text-xs">{dict.hero.scroll}</span>
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-(--color-bg-deep) to-transparent" />
    </section>
  );
}
