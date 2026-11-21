"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import katex from "katex";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { formatCount } from "@/lib/utils";
import { useNumerals } from "@/components/i18n/numerals-provider";
import type { Article } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface ProofSpecimen {
  id: string;
  labelFa: string;
  labelEn: string;
  fieldFa: string;
  fieldEn: string;
  latex: string;
  givenFa: string;
  givenEn: string;
  givenValue: string;
  resultLabelFa: string;
  resultLabelEn: string;
  resultValue: string;
  noteFa: string;
  noteEn: string;
}

const SPECIMENS: readonly ProofSpecimen[] = [
  {
    id: "schwarzschild",
    labelFa: "شعاع شوارتزشیلد",
    labelEn: "Schwarzschild radius",
    fieldFa: "نسبیت عام",
    fieldEn: "General relativity",
    latex: "r_s = \\frac{2GM}{c^2}",
    givenFa: "جرم خورشید",
    givenEn: "Solar mass",
    givenValue: "M = 1.989 × 10³⁰ kg",
    resultLabelFa: "افق رویداد",
    resultLabelEn: "Event horizon",
    resultValue: "rₛ ≈ 2.95 km",
    noteFa: "حل خلأ معادلات میدان اینشتین برای جرم کروی بدون چرخش",
    noteEn: "Vacuum solution of Einstein's field equations for a spherical non-rotating mass",
  },
  {
    id: "hawking",
    labelFa: "دمای هاوکینگ",
    labelEn: "Hawking temperature",
    fieldFa: "ترمودینامیک سیاه‌چاله",
    fieldEn: "Black hole thermodynamics",
    latex: "T_H = \\frac{\\hbar c^3}{8\\pi G M k_B}",
    givenFa: "سیاه‌چاله با جرم خورشید",
    givenEn: "One solar-mass horizon",
    givenValue: "M = 1.0 M☉",
    resultLabelFa: "دمای تابش",
    resultLabelEn: "Radiation temperature",
    resultValue: "Tₕ ≈ 6.17 × 10⁻⁸ K",
    noteFa: "پیوند میان مکانیک کوانتومی، گرانش و آنتروپی افق رویداد",
    noteEn: "Bridging quantum field theory, gravity, and horizon entropy",
  },
  {
    id: "debroglie",
    labelFa: "طول موج دوبروی",
    labelEn: "de Broglie wavelength",
    fieldFa: "مکانیک کوانتومی",
    fieldEn: "Quantum mechanics",
    latex: "\\lambda = \\frac{h}{p} = \\frac{h}{m v}",
    givenFa: "الکترون با تندی مشخص",
    givenEn: "Electron velocity",
    givenValue: "v = 1.00 × 10⁶ m/s",
    resultLabelFa: "طول موج مادی",
    resultLabelEn: "Matter wavelength",
    resultValue: "λ ≈ 0.727 nm",
    noteFa: "دوگانگی موج و ذره برای ذرات جرم‌دار در مقیاس اتمی",
    noteEn: "Wave-particle duality for massive particles at atomic scales",
  },
];

export function UnslopProofSheet({
  locale,
  dict,
  featured,
}: {
  locale: Locale;
  dict: Dictionary;
  featured: Article[];
}) {
  const isFa = locale === "fa";
  const { numerals } = useNumerals();
  const [activeId, setActiveId] = useState<string>(SPECIMENS[0].id);
  const ForwardArrow = isFa ? ArrowLeft : ArrowRight;

  const activeSpecimen = SPECIMENS.find((s) => s.id === activeId) ?? SPECIMENS[0];

  const renderedFormula = useMemo(() => {
    try {
      return katex.renderToString(activeSpecimen.latex, {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return "";
    }
  }, [activeSpecimen.latex]);

  const issueItems = featured.slice(0, 3);

  return (
    <div className="overflow-hidden rounded-t-2xl border border-b-0 border-(--color-border-strong) bg-(--color-bg-elevated) shadow-[0_-8px_28px_rgba(24,22,19,0.05)]">
      {/* Top ledger rule & interactive specimen selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--color-border-subtle) px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2.5 text-xs text-(--color-text-tertiary)">
          <span dir="ltr" className="font-[family-name:var(--font-mono)] font-medium text-(--color-accent-purple)">
            § 01
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-medium text-(--color-text-secondary)">
            {isFa ? "برگه اثبات تعاملی" : "Interactive proof specimen"}
          </span>
        </div>

        <div
          role="tablist"
          aria-label={isFa ? "انتخاب معادله نمونه" : "Choose proof specimen"}
          className="flex flex-wrap items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) p-1"
        >
          {SPECIMENS.map((item) => {
            const selected = item.id === activeSpecimen.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveId(item.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                  selected
                    ? "bg-(--color-bg-elevated) text-(--color-text-primary) shadow-[0_1px_2px_rgba(24,22,19,0.08)]"
                    : "text-(--color-text-tertiary) hover:text-(--color-text-primary)"
                }`}
              >
                {isFa ? item.labelFa : item.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 12-column sheet body: Live KaTeX specimen + Current issue index */}
      <div className="grid divide-y divide-(--color-border-subtle) lg:grid-cols-12 lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse">
        {/* Left/Start 7 cols: Live equation derivation */}
        <div className="p-5 sm:p-6 lg:col-span-7">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-(--color-text-primary)">
              {isFa ? activeSpecimen.labelFa : activeSpecimen.labelEn}
            </h2>
            <span className="text-xs text-(--color-text-tertiary)">
              {isFa ? activeSpecimen.fieldFa : activeSpecimen.fieldEn}
            </span>
          </div>

          <div
            className="mt-4 overflow-x-auto rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep) px-4 py-5 text-(--color-text-primary)"
            dir="ltr"
            dangerouslySetInnerHTML={{ __html: renderedFormula }}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-bg-deep)/60 px-3.5 py-2.5">
              <div className="text-xs text-(--color-text-tertiary)">
                {isFa ? activeSpecimen.givenFa : activeSpecimen.givenEn}
              </div>
              <div
                dir="ltr"
                className="mt-1 text-start font-[family-name:var(--font-mono)] text-xs font-medium tabular-nums text-(--color-text-primary)"
              >
                <bdi dir="ltr">{activeSpecimen.givenValue}</bdi>
              </div>
            </div>

            <div className="rounded-lg border border-(--color-border-strong) bg-(--color-bg-deep) px-3.5 py-2.5">
              <div className="text-xs text-(--color-text-tertiary)">
                {isFa ? activeSpecimen.resultLabelFa : activeSpecimen.resultLabelEn}
              </div>
              <div
                dir="ltr"
                className="mt-1 text-start font-[family-name:var(--font-mono)] text-sm font-medium tabular-nums text-(--color-accent-purple)"
              >
                <bdi dir="ltr">{activeSpecimen.resultValue}</bdi>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-(--color-text-tertiary)">
            {isFa ? activeSpecimen.noteFa : activeSpecimen.noteEn}
          </p>
        </div>

        {/* Right/End 5 cols: Real selected essays from database */}
        <div className="flex flex-col p-5 sm:p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-2 pb-3">
            <span className="text-xs font-medium text-(--color-text-tertiary)">
              {isFa ? "مقالات منتخب این شماره" : "In this issue"}
            </span>
            <Link
              href={`/${locale}/articles`}
              className="inline-flex items-center gap-1 text-xs font-medium text-(--color-accent-purple) transition-colors duration-150 hover:text-(--color-text-primary)"
            >
              <span>{dict.sections.viewAll}</span>
              <ForwardArrow className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>

          <div className="divide-y divide-(--color-border-subtle) border-t border-(--color-border-subtle)">
            {issueItems.map((article, idx) => (
              <Link
                key={article.slug}
                href={`/${locale}/articles/${article.slug}`}
                className="group flex items-start gap-3 py-3 transition-colors duration-150 first:pt-3 last:pb-0"
              >
                <span
                  dir="ltr"
                  className="mt-0.5 w-5 shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums text-(--color-text-tertiary)"
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-(--color-text-tertiary)">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-xs"
                      style={{ backgroundColor: article.fieldColor }}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {dict.fields[article.field as keyof typeof dict.fields]}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm font-medium text-(--color-text-primary) transition-colors duration-150 group-hover:text-(--color-accent-purple)">
                    {article.title}
                  </p>
                </div>
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-(--color-text-tertiary)">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {formatCount(article.readingTimeMinutes, locale, numerals)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
