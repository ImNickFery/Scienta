"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import katex from "katex";
import { ArrowUp, ArrowUpRight, CheckCircle2, ListTree, Sigma } from "lucide-react";
import {
  computeReadingTelemetry,
  type ArticleEquationItem,
} from "@/lib/article-telemetry";
import { formatCount, formatNumber } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Numerals } from "@/lib/i18n/numerals";
import type { TocItem } from "@/types";

interface KineticArticleRailProps {
  toc: TocItem[];
  equations: ArticleEquationItem[];
  wordCount: number;
  readingTimeMinutes: number;
  inlineEquationCount: number;
  figureCount: number;
  specimenCode: string;
  locale: Locale;
  dict: Dictionary;
  numerals: Numerals;
}

export function KineticArticleRail({
  toc,
  equations,
  wordCount,
  readingTimeMinutes,
  inlineEquationCount,
  figureCount,
  specimenCode,
  locale,
  dict,
  numerals,
}: KineticArticleRailProps) {
  const isFa = locale === "fa";
  const [activeId, setActiveId] = useState<string>(toc[0]?.id ?? "");
  const [activeEqId, setActiveEqId] = useState<string>("");
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  // Pre-render compact KaTeX previews once per equation list
  const renderedEquations = useMemo(
    () =>
      equations.map((eq) => {
        let html = "";
        try {
          html = katex.renderToString(eq.compactLatex, {
            throwOnError: false,
            displayMode: false,
            trust: false,
            maxExpand: 100,
            maxSize: 10,
          });
        } catch {
          html = "";
        }
        return { ...eq, html };
      }),
    [equations]
  );

  // Live scroll progress + accurate active heading tracking
  useEffect(() => {
    let rafId = 0;

    const updateFromScroll = () => {
      rafId = 0;
      const docEl = document.documentElement;
      const articleEl = document.querySelector<HTMLElement>("article.prose-scientific");

      if (articleEl) {
        const rect = articleEl.getBoundingClientRect();
        const articleTop = rect.top + window.scrollY;
        const scrollableSpan = Math.max(1, articleEl.offsetHeight - window.innerHeight * 0.65);
        const progress = (window.scrollY - articleTop + window.innerHeight * 0.25) / scrollableSpan;
        setScrollProgress(Math.min(1, Math.max(0, progress)));
      } else {
        const total = Math.max(1, docEl.scrollHeight - window.innerHeight);
        setScrollProgress(Math.min(1, Math.max(0, window.scrollY / total)));
      }

      // Active heading detection via upper-mid viewport threshold so headings
      // above centered jumped equations highlight immediately
      if (toc.length > 0) {
        const threshold = Math.max(180, Math.round(window.innerHeight * 0.46));
        let current = toc[0].id;
        for (const item of toc) {
          const el = document.getElementById(item.id);
          if (!el) continue;
          if (el.getBoundingClientRect().top <= threshold) {
            current = item.id;
          } else {
            break;
          }
        }
        setActiveId(current);
      }
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateFromScroll);
      }
    };

    updateFromScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [toc]);

  const jumpToEquation = useCallback((eqId: string, openExplorer: boolean) => {
    const target = document.getElementById(eqId);
    if (!target) return;
    setActiveEqId(eqId);
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("kinetic-eq-flash");
    // Trigger reflow to restart highlight pulse cleanly
    void target.offsetWidth;
    target.classList.add("kinetic-eq-flash");
    if (openExplorer) {
      window.setTimeout(() => {
        target.click();
      }, 280);
    }
  }, []);

  const telemetry = computeReadingTelemetry(
    scrollProgress,
    wordCount,
    readingTimeMinutes
  );

  const activeSectionIdx = Math.max(
    1,
    toc.findIndex((item) => item.id === activeId) + 1
  );

  return (
    <nav
      aria-label={dict.article.tableOfContents}
      data-kinetic-article-rail
      className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col gap-4 overflow-y-auto pe-1"
    >
      {/* 1. Live Reading Telemetry Module */}
      <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-(--color-text-secondary)">
            {isFa ? "پیشرفت مطالعه" : "Reading Progress"}
          </span>
          <span
            dir="ltr"
            data-kinetic-reading-percent
            className="font-[family-name:var(--font-mono)] text-xs font-semibold tabular-nums text-(--color-accent-purple)"
          >
            {telemetry.percent}%
          </span>
        </div>

        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-xs bg-(--color-bg-secondary)">
          <div
            className="h-full bg-(--color-accent-purple) transition-[width] duration-150"
            style={{ width: `${telemetry.percent}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-(--color-text-tertiary) tabular-nums">
          <span className="inline-flex items-center gap-1" data-kinetic-remaining-time>
            {telemetry.isComplete ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-(--color-accent-purple)" strokeWidth={1.6} />
                <span className="text-(--color-text-primary)">
                  {isFa ? "مطالعه تکمیل شد" : "Completed"}
                </span>
              </>
            ) : (
              <span>
                {isFa
                  ? `حدود ${formatCount(telemetry.remainingMinutes, locale, numerals)} دقیقه باقی‌مانده`
                  : `~${telemetry.remainingMinutes} min remaining`}
              </span>
            )}
          </span>

          {toc.length > 0 && (
            <span dir="ltr" className="font-[family-name:var(--font-mono)]">
              {String(activeSectionIdx).padStart(2, "0")}/{String(toc.length).padStart(2, "0")}
            </span>
          )}
        </div>
      </div>

      {/* 2. Indexed Table of Contents */}
      {toc.length > 0 && (
        <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-4">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-(--color-border-subtle) pb-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-(--color-text-primary)">
              <ListTree className="h-3.5 w-3.5 text-(--color-accent-purple)" strokeWidth={1.5} />
              {dict.article.tableOfContents}
            </span>
            <span
              dir="ltr"
              className="font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-(--color-text-tertiary)"
            >
              {String(toc.length).padStart(2, "0")}
            </span>
          </div>

          <ul className="space-y-1 text-xs">
            {toc.map((item, idx) => {
              const active = activeId === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={active ? "location" : undefined}
                    className={`group flex items-start gap-2 rounded-md border-s-2 py-1.5 pe-2 transition-colors ${
                      item.depth === 3 ? "ps-4" : "ps-2.5"
                    } ${
                      active
                        ? "border-(--color-accent-purple) bg-(--color-bg-secondary) font-medium text-(--color-text-primary)"
                        : "border-transparent text-(--color-text-tertiary) hover:bg-(--color-bg-secondary)/60 hover:text-(--color-text-primary)"
                    }`}
                  >
                    <span
                      dir="ltr"
                      className={`mt-0.5 shrink-0 font-[family-name:var(--font-mono)] text-[10px] tabular-nums ${
                        active ? "text-(--color-accent-purple)" : "opacity-60"
                      }`}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-snug">{item.text}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 3. Interactive Equation Index (KaTeX previews + direct jump & inspect) */}
      {renderedEquations.length > 0 && (
        <div
          data-kinetic-equation-index
          className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-(--color-border-subtle) pb-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-(--color-text-primary)">
              <Sigma className="h-3.5 w-3.5 text-(--color-accent-purple)" strokeWidth={1.6} />
              {isFa ? "فهرست معادلات" : "Equation Index"}
            </span>
            <span
              dir="ltr"
              className="font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-(--color-text-tertiary)"
            >
              {String(renderedEquations.length).padStart(2, "0")}
            </span>
          </div>

          <div className="max-h-56 space-y-1.5 overflow-y-auto pe-0.5">
            {renderedEquations.map((eq) => {
              const selected = activeEqId === eq.id;
              return (
                <div
                  key={eq.id}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${
                    selected
                      ? "border-(--color-accent-purple) bg-(--color-bg-secondary)"
                      : "border-(--color-border-subtle) bg-(--color-bg-secondary)/45 hover:border-(--color-border-strong)"
                  }`}
                >
                  <button
                    type="button"
                    data-kinetic-eq-jump={eq.id}
                    onClick={() => jumpToEquation(eq.id, false)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-start"
                    title={isFa ? `پرش به معادله ${eq.index}` : `Jump to equation ${eq.index}`}
                  >
                    <span
                      dir="ltr"
                      className="shrink-0 rounded border border-(--color-border-subtle) bg-(--color-bg-elevated) px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium tabular-nums text-(--color-accent-purple)"
                    >
                      {String(eq.index).padStart(2, "0")}
                    </span>
                    <span
                      dir="ltr"
                      className="block min-w-0 flex-1 truncate text-[11px] text-(--color-text-primary) [&_.katex]:text-[0.82em]"
                      dangerouslySetInnerHTML={
                        eq.html ? { __html: eq.html } : undefined
                      }
                    >
                      {eq.html ? null : eq.compactLatex}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-kinetic-eq-inspect={eq.id}
                    onClick={() => jumpToEquation(eq.id, true)}
                    aria-label={
                      isFa
                        ? `کاوش تعاملی معادله ${eq.index}`
                        : `Inspect equation ${eq.index}`
                    }
                    title={isFa ? "کاوش معادله" : "Explore equation"}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-transparent text-(--color-text-tertiary) transition-colors hover:border-(--color-border-subtle) hover:bg-(--color-bg-elevated) hover:text-(--color-accent-purple)"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Archival Specimen Spec Footer */}
      <div className="rounded-xl border border-(--color-border-subtle) bg-(--color-bg-elevated) p-3.5 text-[11px] text-(--color-text-tertiary)">
        <div className="flex items-center justify-between border-b border-(--color-border-subtle) pb-2">
          <span>{isFa ? "شناسه سند" : "Specimen"}</span>
          <span
            dir="ltr"
            className="font-[family-name:var(--font-mono)] font-medium text-(--color-text-primary)"
          >
            {specimenCode}
          </span>
        </div>

        <dl className="mt-2 space-y-1.5 tabular-nums">
          <div className="flex items-center justify-between">
            <dt>{isFa ? "تعداد واژگان" : "Words"}</dt>
            <dd className="font-[family-name:var(--font-mono)] text-(--color-text-secondary)">
              {formatNumber(wordCount, locale, numerals)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt>{isFa ? "معادلات (نمایشی / خطی)" : "Equations (disp / inline)"}</dt>
            <dd dir="ltr" className="font-[family-name:var(--font-mono)] text-(--color-text-secondary)">
              {equations.length} / {inlineEquationCount}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt>{isFa ? "شکل‌ها و نمودارها" : "Figures"}</dt>
            <dd className="font-[family-name:var(--font-mono)] text-(--color-text-secondary)">
              {formatCount(figureCount, locale, numerals)}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-(--color-border-subtle) bg-(--color-bg-secondary) text-[11px] font-medium text-(--color-text-secondary) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text-primary)"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>{isFa ? "بازگشت به ابتدای مقاله" : "Back to top"}</span>
        </button>
      </div>
    </nav>
  );
}
