import { Container } from "@/components/ui/container";
import { CountUp } from "@/components/animations/count-up";
import { ScrollReveal } from "@/components/animations/scroll-reveal";
import { AnimatedGrid } from "@/components/animations/animated-grid";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * The "here's the scale of this thing" band. Numbers are counted from real
 * data passed in by the page, not hardcoded — a stat band that lies is
 * worse than no stat band.
 */
export function StatsBand({
  locale,
  dict,
  articleCount,
  fieldCount,
  equationCount,
  readerCount,
}: {
  locale: Locale;
  dict: Dictionary;
  articleCount: number;
  fieldCount: number;
  equationCount: number;
  readerCount: number;
}) {
  const stats = [
    { value: articleCount, label: dict.stats.articles, suffix: "" },
    { value: fieldCount, label: dict.stats.fields, suffix: "" },
    { value: equationCount, label: dict.stats.equations, suffix: "+" },
    { value: readerCount, label: dict.stats.readers, suffix: "+" },
  ];

  return (
    <section className="seam-top relative overflow-hidden border-y border-(--color-border-subtle) bg-(--color-bg-secondary) py-14">
      <AnimatedGrid variant="dot" size={24} opacity={0.05} fade={false} />
      <div
        aria-hidden="true"
        className="animate-orb pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--color-accent-purple)/[0.07] blur-[150px]"
      />

      <Container className="relative z-10">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <ScrollReveal key={stat.label} delay={i * 90} direction="up" distance={18}>
              <div className="group text-center">
                <div className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight sm:text-5xl">
                  <span className="text-gradient-flow">
                    <CountUp value={stat.value} locale={locale} suffix={stat.suffix} />
                  </span>
                </div>
                <div className="mt-2 text-xs text-(--color-text-tertiary) sm:text-sm">{stat.label}</div>
                {/* Underline that draws itself in on hover — a small reward
                    for the pointer landing somewhere that isn't a link. */}
                <div className="mx-auto mt-3 h-px w-8 origin-center scale-x-0 bg-gradient-to-r from-transparent via-(--color-accent-orange) to-transparent transition-transform duration-500 group-hover:scale-x-[3]" />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
