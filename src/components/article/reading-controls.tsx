"use client";

import { useState } from "react";
import { Minus, Plus, Focus, AlignJustify } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const FONT_STEPS = [1, 1.0625, 1.125, 1.1875, 1.25];
const WIDTH_STEPS = ["42rem", "48rem", "54rem"];

export function ReadingControls({
  children,
  dict,
}: {
  children: React.ReactNode;
  dict: Dictionary;
}) {
  const [fontIndex, setFontIndex] = useState(1);
  const [widthIndex, setWidthIndex] = useState(1);
  const [focusMode, setFocusMode] = useState(false);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <div className="glass-panel flex items-center gap-1 rounded-full p-1">
          <button
            aria-label="Decrease font size"
            onClick={() => setFontIndex((i) => Math.max(0, i - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-(--color-text-secondary) hover:text-(--color-text-primary)"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="px-1 text-xs text-(--color-text-tertiary)">{dict.article.fontSize}</span>
          <button
            aria-label="Increase font size"
            onClick={() => setFontIndex((i) => Math.min(FONT_STEPS.length - 1, i + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-(--color-text-secondary) hover:text-(--color-text-primary)"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={() => setWidthIndex((i) => (i + 1) % WIDTH_STEPS.length)}
          className="glass-panel flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary)"
        >
          <AlignJustify className="h-3.5 w-3.5" />
          {dict.article.readingWidth}
        </button>

        <button
          onClick={() => setFocusMode((v) => !v)}
          className={`glass-panel flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs transition-colors ${
            focusMode ? "text-(--color-accent-orange)" : "text-(--color-text-secondary) hover:text-(--color-text-primary)"
          }`}
        >
          <Focus className="h-3.5 w-3.5" />
          {dict.article.focusMode}
        </button>
      </div>

      <div
        className="prose-scientific mx-auto transition-all duration-500"
        style={{
          fontSize: `${FONT_STEPS[fontIndex]}rem`,
          maxWidth: WIDTH_STEPS[widthIndex],
        }}
      >
        {children}
      </div>
    </div>
  );
}
