"use client";

import { useMemo } from "react";
import katex from "katex";
import { parseCommentMathSegments } from "@/lib/comments";
import { cn } from "@/lib/utils";

/**
 * Safely renders reader comments & editorial replies containing inline `$...$`
 * or display `$$...$$` LaTeX math. Plain text is never passed to HTML APIs;
 * only KaTeX math expressions are rendered via `katex.renderToString` with
 * `trust: false`.
 */
export function MathRichText({
  text,
  dir,
  className,
}: {
  text: string;
  dir?: "rtl" | "ltr";
  className?: string;
}) {
  const rendered = useMemo(() => {
    return parseCommentMathSegments(text).map((seg, idx) => {
      if (seg.type === "text") {
        return { key: `t-${idx}`, type: "text" as const, value: seg.value };
      }
      const html = katex.renderToString(seg.value, {
        displayMode: seg.display,
        throwOnError: false,
        strict: false,
        trust: false,
        maxExpand: 200,
        maxSize: 10,
      });
      return { key: `m-${idx}`, type: "math" as const, display: seg.display, html };
    });
  }, [text]);

  return (
    <div
      dir={dir}
      className={cn(
        "min-w-0 max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed text-(--color-text-secondary)",
        className
      )}
    >
      {rendered.map((item) => {
        if (item.type === "text") {
          return <span key={item.key}>{item.value}</span>;
        }
        if (item.display) {
          return (
            <div
              key={item.key}
              dir="ltr"
              className="my-3 max-w-full overflow-x-auto overflow-y-hidden rounded-xl border border-(--color-border-subtle) bg-black/25 px-3 py-2.5 text-center text-(--color-text-primary)"
              dangerouslySetInnerHTML={{ __html: item.html }}
            />
          );
        }
        return (
          <span
            key={item.key}
            dir="ltr"
            className="mx-0.5 inline-block max-w-full align-middle text-(--color-text-primary)"
            dangerouslySetInnerHTML={{ __html: item.html }}
          />
        );
      })}
    </div>
  );
}
