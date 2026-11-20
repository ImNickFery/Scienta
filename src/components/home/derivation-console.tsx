"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConsoleLine =
  | { kind: "command"; text: string }
  | { kind: "log"; text: string }
  | { kind: "math"; html: string }
  | { kind: "result"; label: string; html: string };

/**
 * The hero's live panel: a derivation that plays itself out line by line,
 * ending on a rendered result.
 *
 * This is Scienta's equivalent of the "watch it deploy" terminal that
 * product sites use — the same beat (a real process, narrated, resolving
 * to something concrete) pointed at what this site actually does. The
 * formulas are real KaTeX, rendered on the server and passed in as HTML,
 * so what the hero shows is the same renderer the articles use rather
 * than a picture of one.
 */
export function DerivationConsole({
  lines,
  title,
  statusRunning,
  statusDone,
  chips,
  className,
}: {
  lines: ConsoleLine[];
  title: string;
  statusRunning: string;
  statusDone: string;
  chips: string[];
  className?: string;
}) {
  const [shown, setShown] = useState(lines.length);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced motion finishes immediately
      setShown(lines.length);
      setDone(true);
      return;
    }

    const totalMs = Math.max(600, lines.length * 140 + 200);
    const id = setTimeout(() => setDone(true), totalMs);
    return () => clearTimeout(id);
  }, [lines.length]);

  const running = !done;

  return (
    <div
      className={cn(
        "glass-panel relative overflow-hidden rounded-2xl shadow-[0_40px_120px_-40px_rgba(var(--color-accent-glow-rgb),0.55)]",
        className
      )}
      dir="ltr"
    >
      {/* Sweep of light that runs while the derivation is still resolving. */}
      {running && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-(--color-accent-purple)/10 to-transparent" />
        </div>
      )}

      {/* Window chrome */}
      <div className="relative flex items-center gap-3 border-b border-(--color-border-subtle) px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-(--color-aurora-3)/75" />
          <span className="h-2.5 w-2.5 rounded-full bg-(--color-accent-orange)/75" />
          <span className="h-2.5 w-2.5 rounded-full bg-(--color-accent-purple)/75" />
        </div>
        <span className="font-[family-name:var(--font-mono)] text-xs text-(--color-text-tertiary)">{title}</span>
        <span className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-(--color-border-subtle) bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-(--color-text-secondary)">
          <span
            className={cn(
              "relative h-1.5 w-1.5 rounded-full",
              done ? "bg-emerald-400" : "pulse-ring bg-(--color-accent-orange) text-(--color-accent-orange)"
            )}
          />
          {done ? statusDone : statusRunning}
        </span>
      </div>

      {/* Body */}
      <div className="relative min-h-[19rem] space-y-3 p-5 font-[family-name:var(--font-mono)] text-[13px] leading-relaxed sm:min-h-[21rem]">
        {lines.slice(0, shown).map((line, i) => (
          <div key={i} style={{ animation: `reveal-word 0.35s var(--ease-premium) ${i * 100}ms both` }}>
            {line.kind === "command" && (
              <div className="flex items-center gap-2 text-(--color-text-primary)">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-(--color-accent-purple)" />
                <span>{line.text}</span>
              </div>
            )}

            {line.kind === "log" && (
              <div className="flex items-start gap-2 ps-5 text-(--color-text-tertiary)">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
                <span>{line.text}</span>
              </div>
            )}

            {line.kind === "math" && (
              <div
                className="overflow-x-auto rounded-lg border border-(--color-border-subtle) bg-black/25 px-4 py-3 text-(--color-text-secondary)"
                dangerouslySetInnerHTML={{ __html: line.html }}
              />
            )}

            {line.kind === "result" && (
              <div className="relative overflow-hidden rounded-xl border border-(--color-accent-purple)/40 bg-(--color-accent-purple)/[0.08] px-4 py-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-(--color-accent-orange)">
                  <Sparkles className="h-3 w-3" />
                  {line.label}
                </div>
                <div
                  className="overflow-x-auto text-(--color-text-primary)"
                  dangerouslySetInnerHTML={{ __html: line.html }}
                />
              </div>
            )}
          </div>
        ))}

        {/* Caret sits on the next line to be written. */}
        {!done && (
          <span
            aria-hidden="true"
            className="animate-caret inline-block h-4 w-[7px] translate-y-0.5 bg-(--color-accent-orange)"
          />
        )}
      </div>

      {/* Status chips */}
      <div className="relative flex flex-wrap items-center gap-2 border-t border-(--color-border-subtle) px-4 py-3">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-(--color-border-subtle) bg-white/[0.02] px-2.5 py-1 text-[10px] text-(--color-text-tertiary)"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
