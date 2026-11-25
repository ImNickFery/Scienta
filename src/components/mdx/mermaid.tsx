"use client";

import { useEffect, useId, useRef, useState } from "react";

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "-");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            background: "#0d0d15",
            primaryColor: "#7B3FFB",
            primaryTextColor: "#f5f5fa",
            primaryBorderColor: "#7B3FFB",
            lineColor: "#7a7a92",
            // Mermaid's dark theme labels edges in #ccc, which lands at 4.43:1
            // on this background — just under AA. Everything else here is
            // already pinned to the palette, so pin the label ink too.
            textColor: "#f5f5fa",
            secondaryColor: "#FF7A00",
            tertiaryColor: "#14141f",
            fontFamily: "var(--font-body)",
          },
          securityLevel: "strict",
        });
        const { svg } = await mermaid.render(`mermaid-${id}`, chart);
        const DOMPurify = (await import("isomorphic-dompurify")).default;
        const cleanSvg = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true, html: true },
          ADD_TAGS: ["foreignObject"],
          FORBID_TAGS: ["script", "iframe", "object", "embed"],
          FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
        });
        if (!cancelled && ref.current) {
          ref.current.innerHTML = cleanSvg;
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Diagram render failed");
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="my-6 rounded-xl border border-(--color-accent-red)/30 bg-(--color-accent-red)/5 p-4 text-sm text-(--color-text-secondary)">
        {error}
      </div>
    );
  }

  return (
    <div className="glass-panel my-8 flex w-full max-w-full justify-center overflow-x-auto rounded-2xl p-4 sm:p-6 [&_svg]:h-auto [&_svg]:max-w-full" ref={ref}>
      <div className="h-8 w-8 animate-pulse rounded-full bg-(--color-accent-purple)/30" />
    </div>
  );
}
