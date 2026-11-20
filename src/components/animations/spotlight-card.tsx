"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SpotlightCardProps {
  children: React.ReactNode;
  /** Renders as a next/link when given, otherwise a plain container (`div` or `article`). */
  href?: string;
  /** Semantic tag used when `href` is omitted. */
  as?: "div" | "article";
  /** Accent the spotlight takes on — pass the field colour to tint per card. */
  color?: string;
  /** Adds the lit 1px border ring on top of the interior glow. */
  edge?: boolean;
  className?: string;
}

/**
 * A surface that lights up under the pointer. All the visual work lives in
 * the `.spotlight-surface` / `.spotlight-edge` utilities; this component
 * only feeds them the pointer position as CSS custom properties.
 *
 * Writes are coalesced into one animation frame — pointermove fires far
 * more often than the compositor can use, and setting a custom property on
 * every event is the difference between a smooth card and a janky one on
 * a grid of twelve of them.
 */
export function SpotlightCard({
  children,
  href,
  as = "div",
  color,
  edge = true,
  className,
}: SpotlightCardProps) {
  const ref = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);
  const next = useRef<{ x: number; y: number } | null>(null);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    next.current = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
    ref.current = el;

    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const target = ref.current;
      const pos = next.current;
      if (!target || !pos) return;
      target.style.setProperty("--spot-x", `${pos.x}%`);
      target.style.setProperty("--spot-y", `${pos.y}%`);
    });
  }, []);

  // `group` is baked in so callers can hang `group-hover:` on anything
  // inside the card without remembering to add it themselves.
  const classes = cn("group spotlight-surface", edge && "spotlight-edge", className);
  const style = color ? ({ ["--spot-color" as string]: color } as React.CSSProperties) : undefined;

  if (href) {
    return (
      <Link href={href} className={classes} style={style} onPointerMove={handlePointerMove}>
        {children}
      </Link>
    );
  }

  const Tag = as;
  return (
    <Tag className={classes} style={style} onPointerMove={handlePointerMove}>
      {children}
    </Tag>
  );
}
