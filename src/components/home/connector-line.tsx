"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The rail that joins the numbered steps. Draws itself from the reading-
 * start edge outward once the row scrolls into view, so the eye is pulled
 * along the sequence in the order the steps are meant to be read.
 *
 * `transform-origin` has no logical keyword, so the origin edge is chosen
 * from the document direction at mount rather than in CSS.
 */
export function ConnectorLine() {
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(true);
  const [rtl, setRtl] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    setRtl(document.documentElement.dir === "rtl");

    if (
      typeof window === "undefined" ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      el.getBoundingClientRect().top < window.innerHeight
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-x-[16%] top-7 hidden h-px lg:block">
      <div className="absolute inset-0 rounded-full bg-(--color-border-subtle)" />
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-(--color-accent-purple) via-(--color-accent-orange) to-(--color-accent-red)"
        style={{
          transformOrigin: rtl ? "right" : "left",
          transform: drawn ? "scaleX(1)" : "scaleX(0)",
          transition: "transform 1.4s cubic-bezier(0.16,1,0.3,1) 200ms",
        }}
      />
    </div>
  );
}
