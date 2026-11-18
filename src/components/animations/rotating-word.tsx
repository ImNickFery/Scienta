"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

const TYPE_MS = 68;
const DELETE_MS = 34;
const HOLD_MS = 1700;
const PAUSE_MS = 260;

/**
 * The rotating word in the hero headline.
 *
 * Two different treatments by script, deliberately:
 *
 * - **Latin** gets the classic character-by-character typewriter. Letters
 *   are discrete, so revealing them one at a time reads correctly.
 * - **Persian** gets a cross-fade instead. Arabic-script letters change
 *   shape depending on their neighbours, so typing one character at a time
 *   makes previously-typed glyphs visibly re-form as each new letter lands
 *   — the word looks like it is glitching, not being typed. A fade/lift
 *   swap gives the same "the subject keeps changing" beat without
 *   mangling the letterforms.
 *
 * Both variants reserve the width of the longest word so the headline
 * never reflows mid-cycle.
 */
export function RotatingWord({
  words,
  locale,
  className,
}: {
  words: readonly string[];
  locale: Locale;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(locale === "fa" ? words[0] : "");
  const [deleting, setDeleting] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time media-query read on mount
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // --- Persian / reduced motion: swap the whole word on an interval ---
  useEffect(() => {
    if (locale !== "fa" && !reduced) return;
    if (words.length < 2) return;

    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, HOLD_MS + 900);
    return () => clearInterval(id);
  }, [locale, reduced, words.length]);

  // --- Latin: type / hold / delete cycle ---
  useEffect(() => {
    if (locale === "fa" || reduced) return;

    const word = words[index];
    const atFullWord = !deleting && typed === word;
    const atEmpty = deleting && typed === "";

    // Every transition is scheduled, never applied synchronously in the
    // effect body — the cycle is a timer, so the timer owns the state.
    const delay = atFullWord ? HOLD_MS : atEmpty ? PAUSE_MS : deleting ? DELETE_MS : TYPE_MS;

    const id = setTimeout(() => {
      if (atFullWord) {
        setDeleting(true);
        return;
      }
      if (atEmpty) {
        setDeleting(false);
        setIndex((i) => (i + 1) % words.length);
        return;
      }
      setTyped((prev) => (deleting ? word.slice(0, prev.length - 1) : word.slice(0, prev.length + 1)));
    }, delay);

    return () => clearTimeout(id);
  }, [locale, reduced, deleting, typed, index, words]);

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "");
  const useFade = locale === "fa" || reduced;

  return (
    <span className={cn("relative inline-grid align-bottom", className)}>
      {/* Invisible sizer: holds the width of the longest option so the line
          above/below never jumps as the word changes. */}
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-nowrap">
        {longest}
      </span>

      <span className="col-start-1 row-start-1 flex items-baseline justify-center whitespace-nowrap">
        {useFade ? (
          <span
            key={index}
            className="text-gradient-flow"
            style={{ animation: "reveal-word 0.55s var(--ease-premium) both" }}
          >
            {words[index]}
          </span>
        ) : (
          <>
            <span className="text-gradient-flow">{typed}</span>
            <span
              aria-hidden="true"
              className="animate-caret ms-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.06em] rounded-full bg-(--color-accent-orange)"
            />
          </>
        )}
      </span>

      {/* Screen readers get the full list once, not a stream of partial words. */}
      <span className="sr-only">{words.join("، ")}</span>
    </span>
  );
}
