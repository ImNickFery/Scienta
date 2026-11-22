"use client";

import { ArrowUp } from "lucide-react";

export function FooterBackToTop({ label }: { label: string }) {
  function scrollToTop() {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: 0,
      behavior: prefersReduced ? "auto" : "smooth",
    });
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="group inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-(--color-text-tertiary) transition-colors duration-150 hover:text-(--color-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent-purple)"
    >
      <span>{label}</span>
      <ArrowUp
        className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-y-0.5"
        strokeWidth={1.75}
      />
    </button>
  );
}
