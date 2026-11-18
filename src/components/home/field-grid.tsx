import {
  Atom, Orbit, Cpu, Rocket, Waves, Sigma, Dna, HeartPulse, Cog, Microchip,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { getFields } from "@/lib/taxonomy";
import { ScrollReveal } from "@/components/animations/scroll-reveal";
import { SpotlightCard } from "@/components/animations/spotlight-card";
import { formatNumber } from "@/lib/utils";
import { getNumerals } from "@/lib/i18n/numerals-server";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const iconMap = {
  atom: Atom,
  orbit: Orbit,
  cpu: Cpu,
  rocket: Rocket,
  waves: Waves,
  sigma: Sigma,
  dna: Dna,
  "heart-pulse": HeartPulse,
  cog: Cog,
  microchip: Microchip,
};

export async function FieldGrid({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const fields = await getFields();
  const numerals = await getNumerals();

  return (
    <SectionShell tone="raised" grid="dot" glow="orange">
      <Container>
        <ScrollReveal>
          <SectionHeading
            align="center"
            eyebrow={locale === "fa" ? "کاوش کنید" : "Explore"}
            title={dict.sections.fields}
            locale={locale}
          />
        </ScrollReveal>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {fields.map((f, i) => {
            const Icon = iconMap[f.icon as keyof typeof iconMap] ?? Atom;
            return (
              <ScrollReveal key={f.slug} delay={Math.min(i, 9) * 60} direction="scale" duration={620}>
                <SpotlightCard
                  href={`/${locale}/fields/${f.slug}`}
                  color={f.color}
                  className="flex h-full flex-col items-center gap-3 rounded-2xl border border-(--color-border-subtle) bg-(--color-bg-elevated)/60 p-6 text-center backdrop-blur-sm"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl border transition-all duration-500 group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:rotate-6"
                    style={{
                      background: `linear-gradient(135deg, ${f.color}2E, ${f.color}0D)`,
                      borderColor: `${f.color}33`,
                      color: f.color,
                    }}
                  >
                    <Icon className="h-6 w-6" />
                  </span>

                  <span className="text-sm font-medium text-(--color-text-secondary) transition-colors duration-300 group-hover:text-(--color-text-primary)">
                    {f.name[locale]}
                  </span>

                  {/* Article count fades up on hover — keeps the resting
                      card calm while still rewarding a closer look. */}
                  <span
                    className="translate-y-1 font-[family-name:var(--font-mono)] text-[11px] text-(--color-text-tertiary) opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100"
                    dir="ltr"
                  >
                    {formatNumber(f.articleCount ?? 0, locale, numerals)}
                  </span>

                  {/* Ambient bloom in the accent of this field. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{ boxShadow: `0 24px 60px -24px ${f.color}` }}
                  />
                </SpotlightCard>
              </ScrollReveal>
            );
          })}
        </div>
      </Container>
    </SectionShell>
  );
}
