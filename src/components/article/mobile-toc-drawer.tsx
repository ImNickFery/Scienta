"use client";

import { useEffect, useState } from "react";
import { ListTree, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TocItem } from "@/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export function MobileTocDrawer({
  items,
  locale,
  dict,
}: {
  items: TocItem[];
  locale: Locale;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0) return;
    const headingEls = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    if (headingEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-90px 0px -70% 0px" }
    );

    headingEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (items.length === 0) return null;

  const activeItem = items.find((item) => item.id === activeId);
  const JumpIcon = locale === "fa" ? ChevronLeft : ChevronRight;

  function handleJump(id: string) {
    setOpen(false);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
      setActiveId(id);
    }
  }

  return (
    <div className="lg:hidden print:hidden">
      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={dict.article.tableOfContents}
        aria-expanded={open}
        className="glass-panel safe-bottom fixed bottom-5 end-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-(--color-accent-purple)/40 bg-(--color-bg-elevated)/90 px-4 py-2.5 text-xs font-medium text-(--color-text-primary) shadow-[0_12px_36px_-8px_rgba(var(--color-accent-glow-rgb),0.55)] transition-transform active:scale-95"
      >
        <ListTree className="h-4 w-4 shrink-0 text-(--color-accent-purple)" />
        <span className="shrink-0">{dict.article.tableOfContents}</span>
        {activeItem && (
          <span className="hidden max-w-[140px] truncate border-s border-(--color-border-subtle) ps-2 text-(--color-text-tertiary) sm:inline">
            {activeItem.text}
          </span>
        )}
      </button>

      {/* Bottom sheet drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dict.article.tableOfContents}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel safe-bottom flex max-h-[75dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-t border-(--color-border-strong) bg-(--color-bg-secondary)/95 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-(--color-border-subtle) px-5 py-4">
              <div className="flex items-center gap-2">
                <ListTree className="h-4 w-4 text-(--color-accent-purple)" />
                <h2 className="text-sm font-bold text-(--color-text-primary)">
                  {dict.article.tableOfContents}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={locale === "fa" ? "بستن فهرست مطالب" : "Close table of contents"}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-(--color-border-subtle) text-(--color-text-secondary) hover:text-(--color-text-primary)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="overflow-y-auto overscroll-contain px-4 py-3">
              <ul className="space-y-1">
                {items.map((item) => {
                  const isActive = activeId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleJump(item.id)}
                        style={{ paddingInlineStart: item.depth === 3 ? "1.75rem" : "0.75rem" }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl py-2.5 pe-3 text-start text-sm transition-colors",
                          isActive
                            ? "bg-(--color-accent-purple)/15 font-semibold text-(--color-accent-purple)"
                            : "text-(--color-text-secondary) hover:bg-white/[0.04] hover:text-(--color-text-primary)"
                        )}
                      >
                        <span className="min-w-0 leading-relaxed">{item.text}</span>
                        <JumpIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
