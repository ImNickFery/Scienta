"use client";

import {
  Heading2,
  Bold,
  Italic,
  Sigma,
  SquareFunction,
  GitBranch,
  Info,
  BookOpenCheck,
  Table2,
  Code2,
  BarChart3,
  ImagePlus,
} from "lucide-react";
import { MDX_SNIPPETS, type MdxSnippetId } from "@/lib/mdx-snippets";

const SNIPPET_ICONS: Record<MdxSnippetId, typeof Heading2> = {
  h2: Heading2,
  bold: Bold,
  italic: Italic,
  "inline-math": Sigma,
  "block-math": SquareFunction,
  mermaid: GitBranch,
  callout: Info,
  theorem: BookOpenCheck,
  table: Table2,
  code: Code2,
  stats: BarChart3,
};

interface MdxToolbarProps {
  onInsertSnippet: (id: MdxSnippetId) => void;
  onOpenMediaPicker: () => void;
  locale: "fa" | "en";
}

export function MdxToolbar({ onInsertSnippet, onOpenMediaPicker, locale }: MdxToolbarProps) {
  const formatSnippets = MDX_SNIPPETS.filter((s) => s.group === "format");
  const mathSnippets = MDX_SNIPPETS.filter((s) => s.group === "math");
  const scientificSnippets = MDX_SNIPPETS.filter((s) => s.group === "scientific");

  return (
    <div
      role="toolbar"
      aria-label="MDX scientific formatting toolbar"
      className="card-elevated flex flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2"
    >
      <div className="flex items-center gap-1">
        {formatSnippets.map((item) => {
          const Icon = SNIPPET_ICONS[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onInsertSnippet(item.id)}
              title={item.label}
              aria-label={item.label}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-(--color-text-secondary) transition-colors hover:bg-white/10 hover:text-(--color-text-primary)"
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{item.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-(--color-border-subtle)" />

      <div className="flex items-center gap-1">
        {mathSnippets.map((item) => {
          const Icon = SNIPPET_ICONS[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onInsertSnippet(item.id)}
              title={item.label}
              aria-label={item.label}
              className="flex h-8 items-center gap-1 rounded-lg bg-(--color-accent-purple)/10 px-2.5 text-xs font-medium text-(--color-accent-purple) transition-colors hover:bg-(--color-accent-purple)/20"
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-(--color-border-subtle)" />

      <div className="flex flex-wrap items-center gap-1">
        {scientificSnippets.map((item) => {
          const Icon = SNIPPET_ICONS[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onInsertSnippet(item.id)}
              title={item.label}
              aria-label={item.label}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-(--color-text-secondary) transition-colors hover:bg-white/10 hover:text-(--color-text-primary)"
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{item.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <div className="ms-auto flex items-center gap-2">
        <span className="hidden text-[11px] uppercase tracking-wider text-(--color-text-tertiary) md:inline">
          {locale === "fa" ? "قالب فارسی" : "EN Snippets"}
        </span>
        <button
          type="button"
          onClick={onOpenMediaPicker}
          aria-label="Insert image from Media Library"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-(--color-accent-orange)/40 bg-(--color-accent-orange)/10 px-3 text-xs font-medium text-(--color-accent-orange) transition-colors hover:bg-(--color-accent-orange)/20"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          <span>Insert Image</span>
        </button>
      </div>
    </div>
  );
}
