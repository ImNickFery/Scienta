"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { EquationModal } from "./equation-modal";
import type { Locale } from "@/lib/i18n/config";

interface EquationEnhancerProps {
  children: React.ReactNode;
  articleSlug: string;
  articleTitle?: string;
  locale: Locale;
}

interface OpenEquation {
  latex: string;
  equationId: string;
  index: number;
}

/**
 * Extracts the original LaTeX source KaTeX embeds in every rendered
 * equation via its MathML annotation — this is a standard, built-in part
 * of KaTeX's output (enabled by default), so no separate source-tracking
 * plumbing is needed through the MDX pipeline.
 */
function extractLatexSource(katexDisplayEl: Element): string | null {
  const annotation = katexDisplayEl.querySelector('annotation[encoding="application/x-tex"]');
  return annotation?.textContent?.trim() || null;
}

export function EquationEnhancer({ children, articleSlug, articleTitle, locale }: EquationEnhancerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [openEquation, setOpenEquation] = useState<OpenEquation | null>(null);
  const enhancedRef = useRef(false);

  const openFromElement = useCallback((el: HTMLElement) => {
    const latex = el.dataset.equationLatex;
    const equationId = el.id;
    const index = Number(el.dataset.equationIndex ?? "0");
    if (!latex || !equationId) return;
    setOpenEquation({ latex, equationId, index });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || enhancedRef.current) return;
    enhancedRef.current = true;

    const displayBlocks = Array.from(container.querySelectorAll<HTMLElement>(".katex-display"));
    let count = 0;

    for (const block of displayBlocks) {
      const latex = extractLatexSource(block);
      if (!latex) continue; // defensive — every KaTeX render includes this, but never assume

      count += 1;
      const equationId = `eq-${count}`;
      block.id = equationId;
      block.dataset.equationLatex = latex;
      block.dataset.equationIndex = String(count);
      block.classList.add("equation-interactive");
      block.style.position = "relative";
      block.tabIndex = 0;
      block.setAttribute("role", "button");
      block.setAttribute(
        "aria-label",
        locale === "fa" ? `کاوش معادله ${count}` : `Explore equation ${count}`
      );

      const badge = document.createElement("span");
      badge.className = "equation-number-badge";
      badge.textContent = String(count);
      badge.setAttribute("aria-hidden", "true");
      block.appendChild(badge);
    }

    // Deep link: if the URL already points at a specific equation, open the
    // explorer for it immediately rather than only scrolling to it.
    const hash = window.location.hash.replace("#", "");
    if (hash.startsWith("eq-")) {
      const target = container.querySelector<HTMLElement>(`#${CSS.escape(hash)}`);
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        openFromElement(target);
      }
    }
  }, [locale, openFromElement]);

  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest(".katex-display") as HTMLElement | null;
    if (target) openFromElement(target);
  }

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const target = (e.target as HTMLElement).closest(".katex-display") as HTMLElement | null;
    if (target) {
      e.preventDefault();
      openFromElement(target);
    }
  }

  return (
    <>
      <div ref={containerRef} className="min-w-0 w-full max-w-full" onClick={handleContainerClick} onKeyDown={handleContainerKeyDown}>
        {children}
      </div>
      {openEquation && (
        <EquationModal
          latex={openEquation.latex}
          equationId={openEquation.equationId}
          index={openEquation.index}
          articleSlug={articleSlug}
          articleTitle={articleTitle}
          locale={locale}
          onClose={() => setOpenEquation(null)}
        />
      )}
    </>
  );
}
