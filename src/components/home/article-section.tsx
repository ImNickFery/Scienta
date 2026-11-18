import { Container } from "@/components/ui/container";
import { SectionShell } from "@/components/ui/section-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { ArticleCard } from "@/components/article/article-card";
import { ScrollReveal } from "@/components/animations/scroll-reveal";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function ArticleSection({
  articles,
  locale,
  dict,
  title,
  eyebrow,
  viewAllHref,
  cardSize = "default",
  columns = 3,
  tone = "deep",
  grid = "none",
  glow = "purple",
}: {
  articles: Article[];
  locale: Locale;
  dict: Dictionary;
  title: string;
  eyebrow?: string;
  viewAllHref?: string;
  cardSize?: "default" | "large" | "compact";
  columns?: 2 | 3 | 4;
  tone?: "deep" | "raised";
  grid?: "none" | "line" | "dot";
  glow?: "purple" | "orange" | "mixed" | "none";
}) {
  if (articles.length === 0) return null;

  const gridCols =
    columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <SectionShell tone={tone} grid={grid} glow={glow}>
      <Container>
        <ScrollReveal>
          <SectionHeading
            eyebrow={eyebrow}
            title={title}
            viewAllHref={viewAllHref}
            viewAllLabel={dict.sections.viewAll}
            locale={locale}
          />
        </ScrollReveal>

        <div className={`grid grid-cols-1 gap-6 ${gridCols}`}>
          {articles.map((article, i) => (
            // Cards enter from the reading-start edge in sequence, so the
            // row assembles in the same order it will be read.
            <ScrollReveal key={article.slug} delay={Math.min(i, 5) * 80} direction="start" distance={20}>
              <ArticleCard article={article} locale={locale} dict={dict} size={cardSize} />
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </SectionShell>
  );
}
