"use client";

import { useEffect, useRef, useState } from "react";

type Direction = "up" | "down" | "start" | "end" | "scale" | "none";

/**
 * Reveals its children the first time they scroll into view.
 *
 * `direction` picks the entry vector. "start"/"end" are logical, not
 * physical — under RTL they flip with the document, so a row of cards
 * always animates in from the same visual side as the reading order.
 */
export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  distance = 24,
  blur = false,
  duration = 700,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: Direction;
  distance?: number;
  /** Adds a slight defocus to the entry — reads richer, costs a filter pass. */
  blur?: boolean;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [rtl, setRtl] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    setRtl(document.documentElement.dir === "rtl");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- skips the reveal animation entirely for reduced-motion users
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -80px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hidden = (() => {
    switch (direction) {
      case "up":
        return `translateY(${distance}px)`;
      case "down":
        return `translateY(-${distance}px)`;
      case "start":
        return `translateX(${rtl ? distance : -distance}px)`;
      case "end":
        return `translateX(${rtl ? -distance : distance}px)`;
      case "scale":
        return "scale(0.94)";
      default:
        return "none";
    }
  })();

  const easing = "cubic-bezier(0.16,1,0.3,1)";

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : hidden,
        filter: blur && !visible ? "blur(8px)" : "blur(0)",
        transition: [
          `opacity ${duration}ms ${easing} ${delay}ms`,
          `transform ${duration}ms ${easing} ${delay}ms`,
          `filter ${duration}ms ${easing} ${delay}ms`,
        ].join(", "),
        willChange: visible ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
