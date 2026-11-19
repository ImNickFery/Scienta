"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { intlLocale } from "@/lib/i18n/numerals";
import { useNumerals } from "@/components/i18n/numerals-provider";

/**
 * Counts from 0 to `value` the first time the element scrolls into view.
 *
 * The number is formatted through Intl on every frame so Persian renders in
 * Persian digits with Persian grouping — animating the raw Latin number and
 * localizing only at the end would visibly switch numeral systems mid-count.
 */
export function CountUp({
  value,
  locale,
  duration = 1600,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: {
  value: number;
  locale: Locale;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const { numerals } = useNumerals();
  const ref = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof window === "undefined" ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync final value when reduced motion or IO is unavailable
      setCurrent(value);
      return;
    }

    // If already visible on mount, keep the real value instead of flashing 0.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      setCurrent(value);
      return;
    }

    let frame = 0;
    let start: number | null = null;

    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      // easeOutExpo — fast off the line, long settle, which reads as a
      // counter locking onto its final value rather than sliding to it.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCurrent(value * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  const formatted = new Intl.NumberFormat(intlLocale(locale, numerals), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(current);

  return (
    <span ref={ref} className={className}>
      {/* Tabular figures stop the box from reflowing as digits change width. */}
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {prefix}
        {formatted}
        {suffix}
      </span>
    </span>
  );
}
