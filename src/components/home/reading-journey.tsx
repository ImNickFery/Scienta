import { ListTree, Sigma, Route } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { ScrollReveal } from "@/components/animations/scroll-reveal";
import { SpotlightCard } from "@/components/animations/spotlight-card";
import { ConnectorLine } from "./connector-line";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * A three-beat explainer of what reading an article here actually gives
 * you. Structurally this is the "how it works" band every product page
 * has — numbered steps on a drawn rail — but the content is the reading
 * apparatus this site genuinely ships (TOC + reading controls, the
 * equation explorer, the taxonomy links), so it's a tour, not a pitch.
 */
export function ReadingJourney({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const steps = [
    { icon: ListTree, title: dict.journey.step1Title, body: dict.journey.step1Body, color: "var(--color-accent-purple)" },
    { icon: Sigma, title: dict.journey.step2Title, body: dict.journey.step2Body, color: "var(--color-accent-orange)" },
    { icon: Route, title: dict.journey.step3Title, body: dict.journey.step3Body, color: "var(--color-aurora-3)" },
  ];

  return (
    <SectionShell tone="deep" grid="line" glow="mixed">
      <Container>
        <ScrollReveal>
          <SectionHeading
            align="center"
            eyebrow={dict.journey.eyebrow}
            title={dict.journey.title}
            titleMuted={dict.journey.titleMuted}
            subtitle={dict.journey.subtitle}
            locale={locale}
          />
        </ScrollReveal>

        <div className="relative">
          <ConnectorLine />

          <div className="grid gap-10 lg:grid-cols-3 lg:gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <ScrollReveal key={step.title} delay={200 + i * 160} distance={30}>
                  <SpotlightCard
                    color={step.color}
                    className="h-full rounded-2xl border border-(--color-border-subtle) bg-(--color-bg-elevated)/70 p-7 text-center backdrop-blur-sm"
                  >
                    {/* Numbered node — sits on the rail on desktop. */}
                    <span
                      className="relative mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border transition-transform duration-500 group-hover:scale-105"
                      style={{
                        background: `linear-gradient(135deg, color-mix(in srgb, ${step.color} 18%, transparent), transparent)`,
                        borderColor: `color-mix(in srgb, ${step.color} 32%, transparent)`,
                        color: step.color,
                        boxShadow: `0 0 40px -12px ${step.color}`,
                      }}
                    >
                      <Icon className="h-6 w-6" />
                      <span
                        className="absolute -top-2 -end-2 flex h-6 w-6 items-center justify-center rounded-full border border-(--color-border-subtle) bg-(--color-bg-deep) font-[family-name:var(--font-mono)] text-[11px] font-bold text-(--color-text-secondary)"
                        dir="ltr"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </span>

                    <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-(--color-text-primary)">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-(--color-text-secondary)">{step.body}</p>
                  </SpotlightCard>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </Container>
    </SectionShell>
  );
}
