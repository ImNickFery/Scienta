"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TocItem } from "@/types";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function TableOfContents({ items, dict }: { items: TocItem[]; dict: Dictionary }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    const headingEls = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-100px 0px -70% 0px" }
    );

    headingEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label={dict.article.tableOfContents} className="sticky top-28">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-(--color-text-tertiary)">
        {dict.article.tableOfContents}
      </h2>
      <ul className="space-y-1 border-s border-(--color-border-subtle) text-sm">
        {items.map((item) => (
          <li key={item.id} style={{ paddingInlineStart: item.depth === 3 ? "1.5rem" : "0.9rem" }}>
            <a
              href={`#${item.id}`}
              className={cn(
                "-ms-px block border-s py-1.5 transition-colors",
                activeId === item.id
                  ? "border-(--color-accent-purple) text-(--color-accent-purple) font-medium"
                  : "border-transparent text-(--color-text-tertiary) hover:text-(--color-text-primary)"
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
