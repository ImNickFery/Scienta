"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

export function CodeBlock(props: React.HTMLAttributes<HTMLPreElement>) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const language = (props as { "data-language"?: string })["data-language"];

  async function copy() {
    const text = preRef.current?.textContent ?? "";
    if (await copyToClipboard(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="group relative my-8 w-full max-w-full overflow-hidden rounded-xl border border-(--color-border-subtle) bg-[#0a0a12]">
      {language && (
        <div className="flex items-center justify-between border-b border-(--color-border-subtle) px-4 py-2">
          <span className="font-[family-name:var(--font-mono)] text-xs text-(--color-text-tertiary)">
            {language}
          </span>
          <button
            onClick={copy}
            aria-label="Copy code"
            className="flex items-center gap-1 text-xs text-(--color-text-tertiary) transition-colors hover:text-(--color-text-primary)"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
      <pre
        ref={preRef}
        className="max-w-full overflow-x-auto p-4 text-sm leading-relaxed [&_code]:font-[family-name:var(--font-mono)]"
        {...props}
      />
    </div>
  );
}
